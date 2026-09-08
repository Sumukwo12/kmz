<?php
declare(strict_types=1);

/**
 * KmzParser
 *
 * Extracts route/site points from a .kmz or .kml file and validates
 * that they fall within Kenya's bounding box. Uses XMLReader so large
 * KML documents (e.g. ones bundling administrative boundary polygons)
 * don't have to be fully loaded as a DOM tree — polygon subtrees are
 * skipped rather than parsed.
 */
final class KmzParser
{
    // Kenya bounding box: [south, west] to [north, east]
    private const SOUTH = -4.9;
    private const WEST  = 33.9;
    private const NORTH = 5.1;
    private const EAST  = 41.9;

    /**
     * @return array{points: array<int, array{name:string,lat:float,lng:float}>, skipped:int}
     */
    public static function parseFile(string $tmpPath, string $originalName): array
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        if ($ext === 'kmz') {
            $kml = self::extractKmlFromKmz($tmpPath);
        } elseif ($ext === 'kml') {
            $kml = file_get_contents($tmpPath);
            if ($kml === false) {
                throw new RuntimeException('Could not read the uploaded KML file.');
            }
        } else {
            throw new InvalidArgumentException('Only .kmz and .kml files are supported.');
        }

        return self::extractPoints($kml);
    }

    private static function extractKmlFromKmz(string $tmpPath): string
    {
        $zip = new ZipArchive();
        if ($zip->open($tmpPath) !== true) {
            throw new RuntimeException('This does not look like a valid KMZ (zip) archive.');
        }

        $kmlEntry = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if ($name !== false && preg_match('/\.kml$/i', $name) === 1) {
                $kmlEntry = $name;
                break;
            }
        }

        if ($kmlEntry === null) {
            $zip->close();
            throw new RuntimeException('No .kml file was found inside the archive.');
        }

        $content = $zip->getFromName($kmlEntry);
        $zip->close();

        if ($content === false) {
            throw new RuntimeException('Could not read the .kml file inside the archive.');
        }

        return $content;
    }

    /**
     * @return array{points: array<int, array{name:string,lat:float,lng:float}>, skipped:int}
     */
    private static function extractPoints(string $kml): array
    {
        libxml_use_internal_errors(true);

        $reader = new XMLReader();
        $ok = $reader->XML($kml, 'UTF-8', LIBXML_NONET);

        if (!$ok) {
            throw new RuntimeException('The KML content could not be parsed. The file may be corrupted.');
        }

        $points = [];
        $skipped = 0;
        $counter = 0;

        $inPlacemark = false;
        $placemarkName = null;
        $currentGeom = null; // 'Point' | 'LineString' | null
        $lineVertexIndex = 0;

        // Single streaming pass — no expand()/DOM materialization, so this
        // stays correct and memory-light even on multi-megabyte KML files.
        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT) {
                switch ($reader->localName) {
                    case 'Placemark':
                        $inPlacemark = !$reader->isEmptyElement;
                        $placemarkName = null;
                        $currentGeom = null;
                        break;

                    case 'name':
                        if ($inPlacemark && $currentGeom === null && $placemarkName === null) {
                            $placemarkName = trim($reader->readString());
                        }
                        break;

                    case 'Point':
                        if ($inPlacemark) {
                            $currentGeom = 'Point';
                        }
                        break;

                    case 'LineString':
                        if ($inPlacemark) {
                            $currentGeom = 'LineString';
                            $lineVertexIndex = 0;
                        }
                        break;

                    case 'Polygon':
                        // Administrative/coverage boundary shapes — not route
                        // stops. Skip the whole subtree (including its large
                        // coordinate lists) without reading through it.
                        if (!$reader->isEmptyElement) {
                            $reader->next();
                        }
                        break;

                    case 'coordinates':
                        if ($inPlacemark && $currentGeom === 'Point') {
                            $text = trim($reader->readString());
                            $parsed = self::parseLonLat($text);
                            if ($parsed !== null) {
                                [$lat, $lng] = $parsed;
                                $counter++;
                                $label = ($placemarkName !== null && $placemarkName !== '')
                                    ? $placemarkName
                                    : ('Stop ' . $counter);
                                if (self::inKenya($lat, $lng)) {
                                    $points[] = ['name' => $label, 'lat' => $lat, 'lng' => $lng];
                                } else {
                                    $skipped++;
                                }
                            }
                        } elseif ($inPlacemark && $currentGeom === 'LineString') {
                            $text = trim($reader->readString());
                            $verts = preg_split('/\s+/', $text);
                            foreach ($verts as $vertex) {
                                if ($vertex === '') {
                                    continue;
                                }
                                $parsed = self::parseLonLat($vertex);
                                if ($parsed === null) {
                                    continue;
                                }
                                [$lat, $lng] = $parsed;
                                $lineVertexIndex++;
                                $label = (($placemarkName !== null && $placemarkName !== '') ? $placemarkName : 'Track')
                                    . ' #' . $lineVertexIndex;
                                if (self::inKenya($lat, $lng)) {
                                    $points[] = ['name' => $label, 'lat' => $lat, 'lng' => $lng];
                                } else {
                                    $skipped++;
                                }
                            }
                        }
                        break;
                }
            } elseif ($reader->nodeType === XMLReader::END_ELEMENT) {
                switch ($reader->localName) {
                    case 'Placemark':
                        $inPlacemark = false;
                        $currentGeom = null;
                        break;
                    case 'Point':
                    case 'LineString':
                        $currentGeom = null;
                        break;
                }
            }
        $reader->close();
        return ['points' => $points, 'skipped' => $skipped];
    }

    /**
     * Parses a single "lon,lat[,alt]" coordinate string.
     * @return array{0: float, 1: float}|null [lat, lng]
     */
    private static function parseLonLat(string $raw): ?array
    {
        $parts = explode(',', trim($raw));
        if (count($parts) < 2) {
            return null;
        }
        $lng = filter_var($parts[0], FILTER_VALIDATE_FLOAT);
        $lat = filter_var($parts[1], FILTER_VALIDATE_FLOAT);
        if ($lng === false || $lat === false) {
            return null;
        }
        return [$lat, $lng];
    }

    private static function inKenya(float $lat, float $lng): bool
    {
        return $lat >= self::SOUTH && $lat <= self::NORTH
            && $lng >= self::WEST && $lng <= self::EAST;
    }

    public static function kenyaBounds(): array
    {
        return [
            'south' => self::SOUTH, 'west' => self::WEST,
            'north' => self::NORTH, 'east' => self::EAST,
        ];
    }
}
