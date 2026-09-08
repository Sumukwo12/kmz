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

<!-- Top Navigation & Header Bar -->
<header class="app-header">
  <div class="header-brand">
    <h1 class="hero-title">Kenya <span>Site Route</span> Viewer</h1>
    <div class="hero-sub" id="heroSub">Load the sample sites, or upload your own KMZ</div>
  </div>

  <div class="header-actions">
    <!-- Map Mode Switcher -->
    <div class="panel map-mode-bar" id="mapModeBar">
      <button class="mode-btn active" data-layer="terrain" type="button" title="Dark Terrain Map">Terrain</button>
      <button class="mode-btn" data-layer="opentopo" type="button" title="Topographic Map">OpenTopo</button>
      <button class="mode-btn" data-layer="darkmatter" type="button" title="Dark Canvas Map">Dark</button>
      <button class="mode-btn" data-layer="satellite" type="button" title="Satellite Imagery">Satellite</button>
    </div>

    <!-- Mobile / Tablet Action Toggles -->
    <div class="header-toggles">
      <button class="toggle-btn" id="toggleLegendBtn" type="button" title="Toggle Legend" aria-label="Toggle Legend">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="btn-text">Legend</span>
      </button>
      <button class="toggle-btn" id="toggleLocationsBtn" type="button" title="Toggle Locations" aria-label="Toggle Locations">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="btn-text">Sites</span>
        <span class="badge-count" id="headerLocationsBadge">0</span>
      </button>
    </div>
  </div>
</header>

<!-- Map Legend -->
<aside class="panel legend" id="legendPanel">
  <div class="legend-header">
    <span>Map Legend</span>
    <button class="panel-close-btn" id="closeLegendBtn" type="button" aria-label="Close Legend">&times;</button>
  </div>
  <div class="row"><div class="swatch dot" style="background:var(--gold); box-shadow:0 0 10px 3px rgba(215,162,74,0.55);"></div>Hub (Vilcom HQ)</div>
  <div class="row"><div class="swatch dot" style="background:var(--gold)"></div>Light Beam Route</div>
  <div class="row"><div class="swatch dot" style="background:var(--panel); border:1.5px solid var(--gold-dim); width:9px; height:9px; border-radius:50%;"></div>Pinned Sites</div>
</aside>

<!-- Locations Drawer / Panel -->
<aside class="panel locations" id="locationsPanel">
  <div class="locations-header">
    <div class="locations-title-wrap">
      <span>Locations</span>
      <span class="locations-count" id="locationsCount">0 / 0 pinned</span>
    </div>
    <button class="panel-close-btn" id="closeLocationsBtn" type="button" aria-label="Close Locations Panel">&times;</button>
  </div>
  <div class="locations-search-wrap">
    <input type="text" id="locationsSearch" placeholder="Search site or city…" autocomplete="off" spellcheck="false">
    <button type="button" id="clearSearchBtn" class="clear-search-btn" aria-label="Clear Search" style="display:none;">&times;</button>
  </div>
  <div class="locations-list" id="locationsList"></div>
</aside>

<!-- Backdrop overlay for mobile drawer -->
<div class="drawer-backdrop" id="drawerBackdrop"></div>

<!-- Bottom Playback & Upload Controls -->
<section class="panel controls" id="controlsPanel">
  <div class="controls-header">
    <span class="controls-title">Playback Controls</span>
    <button class="controls-collapse-btn" id="collapseControlsBtn" type="button" title="Minimize / Expand Controls" aria-label="Minimize or Expand controls">
      <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
  </div>

  <div class="controls-body" id="controlsBody">
    <div class="row action-buttons-row">
      <button class="upload-btn" id="uploadBtn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload KMZ / KML
      </button>
      <input type="file" id="fileInput" accept=".kmz,.kml">
      <button class="sample-btn" id="sampleBtn">Load Sample</button>
    </div>

    <div class="row between playback-row">
      <div class="row play-btns-group">
        <button class="ctrl-btn" id="playBtn" title="Play / Pause">
          <svg class="play-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span id="playBtnText">Play</span>
        </button>
        <button class="ctrl-btn" id="restartBtn" title="Restart">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>Restart</span>
        </button>
      </div>

      <div class="row speed-control-group">
        <span class="speed-label">Speed</span>
        <input type="range" id="speedSlider" min="1" max="10" value="5" aria-label="Playback speed">
      </div>
    </div>
  </div>

  <div class="status-line" id="statusLine">Loading…</div>
</section>

<script src="assets/app.js"></script>
</body>
</html>
