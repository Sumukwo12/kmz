<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

require_once __DIR__ . '/../src/KmzParser.php';

header('Content-Type: application/json; charset=utf-8');
ini_set('memory_limit', '256M');
set_time_limit(30);

function respond_error(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_error('Invalid request method.', 405);
}

if (!isset($_FILES['kmzFile'])) {
    respond_error('No file was uploaded.');
}

$file = $_FILES['kmzFile'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    $message = match ($file['error']) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File is too large.',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded.',
        UPLOAD_ERR_PARTIAL => 'The upload was interrupted. Please try again.',
        default => 'File upload failed.',
    };
    respond_error($message);
}

$originalName = $file['name'];
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

if (!in_array($ext, ['kmz', 'kml'], true)) {
    respond_error('Only .kmz and .kml files are supported.');
}

// 25MB cap — matches upload_max_filesize / post_max_size recommended in README.
$maxBytes = 25 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
    respond_error('File exceeds the 25MB limit.');
}

// Sanity-check content, not just the extension: a .kmz is a zip archive
// and every zip file starts with the "PK" signature.
$handle = fopen($file['tmp_name'], 'rb');
$magic = $handle ? fread($handle, 2) : '';
if ($handle) {
    fclose($handle);
}
if ($ext === 'kmz' && $magic !== 'PK') {
    respond_error('This does not look like a valid KMZ (zip) file.');
}

try {
    $result = KmzParser::parseFile($file['tmp_name'], $originalName);
} catch (Throwable $e) {
    respond_error('Could not process file: ' . $e->getMessage());
}

// Uploaded tmp file is discarded automatically by PHP at request end —
// nothing is written to /uploads, so there is nothing to clean up later.

if (empty($result['points'])) {
    respond_error('No usable Point or track locations were found in this file.');
}

echo json_encode([
    'points'   => $result['points'],
    'skipped'  => $result['skipped'],
    'filename' => basename($originalName),
]);
