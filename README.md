# Kenya Site Route Viewer (PHP + Terrain / Leaflet Map)

A modern PHP app that reads real `.kmz` / `.kml` files, plots the site
points inside them on a rich **Terrain / Topographic** map locked to Kenya, and
animates a marker jumping stop-to-stop along the route.

It ships pre-loaded with your **VILCOM_POP_SITES_UPDATED.kmz** as the
default sample (`data/VILCOM_POP_SITES_UPDATED.kmz`) — open the app and it
loads automatically. You can switch between **Terrain**, **OpenTopo**, **Satellite**, and **Streets** views anytime, or upload any other `.kmz`/`.kml`.

## What it does with your file

Your KMZ contains two very different kinds of geometry:

- **100 `Point` placemarks** — the actual POP/site locations (Muranga PoP,
  Kisumu PoP, Wajir Pop, NBO sites, etc). These are what get plotted and
  animated.
- **462 `Polygon` shapes** — Kenya sub-county administrative boundaries,
  bundled in the file as reference layers. These make the underlying KML
  ~42MB, but they are **not** route stops, so the parser deliberately skips
  them (see "Performance" below).

All 100 site points fall inside Kenya's bounding box, so nothing gets
filtered out from your sample file. If you upload a different file that
contains points outside Kenya, those are dropped and the status line tells
you how many were skipped.

## Requirements

- PHP 8.0+
- PHP extensions: `zip`, `dom`, `xmlreader`, `libxml` (all bundled with a
  standard PHP install)
- Any web server that can run PHP (Apache, Nginx+PHP-FPM, or PHP's built-in
  server for local testing)

## Project structure

```
kenya-kmz-app/
├── data/
│   └── VILCOM_POP_SITES_UPDATED.kmz   ← bundled sample
├── public/                             ← point your web server here
│   ├── index.php                       ← page shell
│   ├── upload.php                      ← handles uploaded files
│   ├── sample.php                      ← serves the bundled sample
│   └── assets/
│       ├── style.css
│       └── app.js                      ← Leaflet map + animation
├── src/
│   └── KmzParser.php                   ← unzip + KML parsing + Kenya bounds check
├── uploads/                             ← unused at runtime, kept locked down
│   └── .htaccess                       ← denies direct access
└── README.md
```

## Running with Docker (Recommended for Deployment)

### Using Docker Compose:
```bash
docker compose up -d --build
```
Then visit **`http://localhost:8000`** in your browser.

### Using Docker CLI directly:
```bash
# Build the image
docker build -t kenya-kmz-app .

# Run the container
docker run -d -p 8000:80 --name kenya-kmz-app kenya-kmz-app
```

## Running it locally with PHP CLI

From the project root:

```bash
php -d upload_max_filesize=25M -d post_max_size=26M -d memory_limit=256M -S localhost:8000 -t public
```

Then open `http://localhost:8000` in a browser.

## Running it on a real server (Apache/Nginx)

Point the web server's document root at the `public/` folder — `data/`
and `src/` should sit **outside** the public web root (as shown above) so
they can't be requested directly, only included by PHP.

Recommended `php.ini` settings for larger KMZ files (the bundled sample is
~16MB, so the defaults below give some headroom):

```ini
upload_max_filesize = 25M
post_max_size = 26M
memory_limit = 256M
max_execution_time = 30
```

If you're using PHP's built-in server for local testing, pass these as
`-d` flags instead of editing `php.ini`:

```bash
php -d upload_max_filesize=25M -d post_max_size=26M -d memory_limit=256M \
    -S localhost:8000 -t public
```

## How the upload flow works

1. The browser posts the file to `upload.php` via `fetch`/`FormData` (no
   page reload).
2. `upload.php` validates the extension, file size, and the ZIP "PK" magic
   bytes, then hands the temp file to `src/KmzParser.php`.
3. `KmzParser` unzips the `.kmz` with `ZipArchive`, finds the `.kml` inside,
   and streams through it with `XMLReader` — reading each `<Placemark>`,
   keeping `Point`/`LineString` coordinates, and skipping `Polygon`
   subtrees entirely without parsing their coordinate lists.
4. Every coordinate is checked against Kenya's bounding box
   (`-4.9, 33.9` to `5.1, 41.9`); out-of-bounds points are dropped and
   counted.
5. The endpoint returns JSON; `app.js` draws numbered stop markers, a
   dashed "upcoming" line and solid "traveled" line, and animates a marker
   hopping between stops in order, looping when it reaches the end.
6. The uploaded file is never written to disk permanently — PHP's own
   temp file is used and discarded automatically at the end of the
   request.

## Performance note on large KMZs

Your sample file's underlying KML is ~42MB almost entirely because of the
462 sub-county boundary polygons. The parser uses `XMLReader::next()` to
skip past each Placemark's full subtree once it's been read, rather than
loading the whole document into one big DOM tree, so it stays reasonably
fast even with that boundary layer included. If you regularly work with
much larger boundary layers, consider stripping the `ke_subcounty` folder
out of future exports to keep files smaller and parsing quicker.

## Security notes

- File type is checked by extension **and** by content (`PK` zip
  signature for `.kmz`).
- `libxml_disable_entity_loader` is enabled and `LIBXML_NONET` is used to
  harden the XML parser against XXE and external entity attacks.
- Upload size is capped (15MB) at both the PHP and application level.
- Nothing is persisted to `/uploads` — there's nothing to clean up or
  leak later.
- `uploads/.htaccess` denies direct web access as defense in depth, in
  case a future version does start writing there.

## Customizing

- **Change the region:** edit the `SOUTH`/`WEST`/`NORTH`/`EAST` constants
  in `src/KmzParser.php` and `KENYA_BOUNDS` in `public/assets/app.js`.
- **Adjust speed bounds:** tweak the `travelDuration()` function in `app.js`.