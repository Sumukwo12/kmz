<?php
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kenya Site Route Viewer</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>

<div id="map"></div>
<div class="drop-hint" id="dropHint">Drop your .kmz or .kml file</div>

<div class="hero-title">Kenya <span>Site Route</span> Viewer</div>
<div class="hero-sub" id="heroSub">Load the sample sites, or upload your own KMZ</div>

<div class="panel map-mode-bar" id="mapModeBar">
  <button class="mode-btn active" data-layer="terrain" type="button">Dark Terrain</button>
  <button class="mode-btn" data-layer="opentopo" type="button">OpenTopo</button>
  <button class="mode-btn" data-layer="darkmatter" type="button">Dark Map</button>
  <button class="mode-btn" data-layer="satellite" type="button">Satellite</button>
</div>

<div class="panel legend">
  <div class="row"><div class="swatch dot" style="background:var(--gold); box-shadow:0 0 10px 3px rgba(215,162,74,0.55);"></div>hub (HQ)</div>
  <div class="row"><div class="swatch dot" style="background:var(--gold)"></div>light beam</div>
  <div class="row"><div class="swatch dot" style="background:var(--panel); border:1.5px solid var(--gold-dim); width:8px; height:8px; border-radius:50%;"></div>pinned sites</div>
</div>

<div class="panel locations" id="locationsPanel">
  <div class="locations-header">
    <span>Locations</span>
    <span class="locations-count" id="locationsCount">0</span>
  </div>
  <div class="locations-list" id="locationsList"></div>
</div>

<div class="panel controls">
  <div class="row">
    <button class="upload-btn" id="uploadBtn">Upload KMZ / KML</button>
    <input type="file" id="fileInput" accept=".kmz,.kml">
  </div>
  <div class="row">
    <button class="sample-btn" id="sampleBtn">Load sample: Vilcom POP sites</button>
  </div>
  <div class="row between">
    <div class="row" style="gap:8px;">
      <button class="ctrl-btn" id="playBtn" title="Play / Pause">Play</button>
      <button class="ctrl-btn" id="restartBtn" title="Restart">Restart</button>
    </div>
    <div class="row" style="flex:1; margin-left:14px;">
      <span class="speed-label">Speed</span>
      <input type="range" id="speedSlider" min="1" max="10" value="5">
    </div>
  </div>
  <div class="status-line" id="statusLine">Loading…</div>
</div>

<script src="assets/app.js"></script>
</body>
</html>
