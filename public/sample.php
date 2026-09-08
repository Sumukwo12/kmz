<?php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

require_once __DIR__ . '/../src/KmzParser.php';

header('Content-Type: application/json; charset=utf-8');
ini_set('memory_limit', '256M');
set_time_limit(30);

$sampleFile = __DIR__ . '/../data/VILCOM_POP_SITES_UPDATED.kmz';

if (!file_exists($sampleFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Sample file not found on the server.']);
    exit;
}

try {
    $result = KmzParser::parseFile($sampleFile, 'VILCOM_POP_SITES_UPDATED.kmz');
    echo json_encode([
        'points'   => $result['points'],
        'skipped'  => $result['skipped'],
        'filename' => 'VILCOM_POP_SITES_UPDATED.kmz (sample)',
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
