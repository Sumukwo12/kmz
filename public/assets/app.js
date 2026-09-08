(function () {
  // ---------- Kenya bounds (south, west) to (north, east) ----------
  const KENYA_BOUNDS = [[-4.9, 33.9], [5.1, 41.9]];

  // ---------- Map setup: Terrain & multi-layer tiles, locked to Kenya ----------
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    minZoom: 5.5,
    maxBoundsViscosity: 1.0
  });

  const layers = {
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      className: 'dark-terrain-tile',
      attribution: 'Tiles &copy; Esri &mdash; Esri, USGS'
    }),
    opentopo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      className: 'dark-topo-tile',
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    }),
    darkmatter: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    })
  };

  let activeLayerKey = 'terrain';
  layers[activeLayerKey].addTo(map);

  // Wire up map layer switcher buttons
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const layerKey = btn.dataset.layer;
      if (!layers[layerKey] || layerKey === activeLayerKey) return;
      
      map.removeLayer(layers[activeLayerKey]);
      layers[layerKey].addTo(map);
      activeLayerKey = layerKey;

      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  map.setMaxBounds(KENYA_BOUNDS);
  fitMapToKenya();

  function getMapPadding() {
    const w = window.innerWidth;
    if (w <= 480) return [20, 20];
    if (w <= 768) return [40, 40];
    return [70, 70];
  }

  function fitMapToKenya() {
    map.fitBounds(KENYA_BOUNDS, { padding: getMapPadding() });
  }

  // Handle window resizing & orientation change
  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      map.invalidateSize();
      if (points.length > 1) {
        map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: getMapPadding() });
      }
    }, 150);
  });

  // ---------- State ----------
  let points = [];          // all loaded points, in file order
  let hubIndex = -1;        // index into points[] of the hub (e.g. "Vilcom HQ")
  let targetOrder = [];     // indices into points[], every point except the hub
  let markers = [];         // Leaflet markers, indexed like points[]
  let beamLine = null;      // polyline hub -> current target, grows as light travels
  let light = null;         // the moving light marker
  let targetCursor = 0;     // index into targetOrder[]
  let playing = false;
  let animHandle = null;
  let timeoutHandle = null;

  // DOM Elements
  const speedSlider = document.getElementById('speedSlider');
  const statusLine = document.getElementById('statusLine');
  const heroSub = document.getElementById('heroSub');
  const playBtn = document.getElementById('playBtn');
  const playBtnText = document.getElementById('playBtnText');
  const restartBtn = document.getElementById('restartBtn');
  const locationsPanel = document.getElementById('locationsPanel');
  const locationsList = document.getElementById('locationsList');
  const locationsCount = document.getElementById('locationsCount');
  const headerLocationsBadge = document.getElementById('headerLocationsBadge');
  const locationsSearch = document.getElementById('locationsSearch');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const toggleLocationsBtn = document.getElementById('toggleLocationsBtn');
  const closeLocationsBtn = document.getElementById('closeLocationsBtn');
  const legendPanel = document.getElementById('legendPanel');
  const toggleLegendBtn = document.getElementById('toggleLegendBtn');
  const closeLegendBtn = document.getElementById('closeLegendBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const controlsPanel = document.getElementById('controlsPanel');
  const collapseControlsBtn = document.getElementById('collapseControlsBtn');

  function travelDuration() {
    const v = parseInt(speedSlider.value, 10); // 1 (slow) .. 10 (fast)
    return 2200 - (v - 1) * (1800 / 9); // 2200ms .. 400ms
  }
  const HOLD_AT_TARGET_MS = 550;
  const FADE_OUT_MS = 260;

  function setStatus(html, isError) {
    statusLine.innerHTML = html;
    statusLine.classList.toggle('is-error', !!isError);
  }

  function clearTimers() {
    if (animHandle) cancelAnimationFrame(animHandle);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    animHandle = null;
    timeoutHandle = null;
  }

  // ---------- Drawer & Modal Management ----------
  function openLocationsDrawer() {
    locationsPanel.classList.add('drawer-open');
    drawerBackdrop.classList.add('active');
    toggleLocationsBtn.classList.add('active');
  }

  function closeLocationsDrawer() {
    locationsPanel.classList.remove('drawer-open');
    drawerBackdrop.classList.remove('active');
    toggleLocationsBtn.classList.remove('active');
  }

  function toggleLocationsDrawer() {
    if (locationsPanel.classList.contains('drawer-open')) {
      closeLocationsDrawer();
    } else {
      closeLegendModal();
      openLocationsDrawer();
    }
  }

  function openLegendModal() {
    legendPanel.classList.add('is-open');
    toggleLegendBtn.classList.add('active');
  }

  function closeLegendModal() {
    legendPanel.classList.remove('is-open');
    toggleLegendBtn.classList.remove('active');
  }

  function toggleLegendModal() {
    if (legendPanel.classList.contains('is-open')) {
      closeLegendModal();
    } else {
      closeLocationsDrawer();
      openLegendModal();
    }
  }

  toggleLocationsBtn.addEventListener('click', toggleLocationsDrawer);
  closeLocationsBtn.addEventListener('click', closeLocationsDrawer);
  toggleLegendBtn.addEventListener('click', toggleLegendModal);
  closeLegendBtn.addEventListener('click', closeLegendModal);
  drawerBackdrop.addEventListener('click', () => {
    closeLocationsDrawer();
    closeLegendModal();
  });

  // Controls minimization / expand
  if (collapseControlsBtn) {
    collapseControlsBtn.addEventListener('click', () => {
      controlsPanel.classList.toggle('is-collapsed');
    });
  }

  // ---------- Locations Search / Filter ----------
  if (locationsSearch) {
    locationsSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      clearSearchBtn.style.display = q ? 'block' : 'none';
      const items = locationsList.querySelectorAll('.location-item');
      items.forEach(item => {
        const text = item.querySelector('.location-name').textContent.toLowerCase();
        item.style.display = text.includes(q) ? 'flex' : 'none';
      });
    });

    clearSearchBtn.addEventListener('click', () => {
      locationsSearch.value = '';
      clearSearchBtn.style.display = 'none';
      const items = locationsList.querySelectorAll('.location-item');
      items.forEach(item => item.style.display = 'flex');
      locationsSearch.focus();
    });
  }

  // ---------- Drawing ----------
  function clearLayers() {
    markers.forEach(m => {
      if (map.hasLayer(m)) map.removeLayer(m);
    });
    markers = [];
    if (beamLine) map.removeLayer(beamLine);
    if (light) map.removeLayer(light);
    beamLine = null;
    light = null;
    clearTimers();
  }

  function stopIcon(n, state) {
    return L.divIcon({
      className: '',
      html: '<div class="stop-dot ' + state + '">' + n + '</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  function hubIcon() {
    return L.divIcon({
      className: '',
      html: '<div class="hub-marker"><div class="hub-ring"></div><div class="hub-ring hub-ring-delay"></div><div class="hub-core">HQ</div></div>',
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });
  }

  function findHubIndex(pts) {
    let idx = pts.findIndex(p => /vilcom\s*hq/i.test(p.name));
    if (idx === -1) {
      idx = pts.findIndex(p => /\bhq\b/i.test(p.name) || /headquarters/i.test(p.name));
    }
    return idx;
  }

  function loadRoute(pts, sourceLabel, skippedCount) {
    clearLayers();
    points = pts;
    targetCursor = 0;
    playing = false;
    updatePlayButtonState(false);

    if (points.length === 0) {
      setStatus('No points found in <b>' + escapeHtml(sourceLabel) + '</b>.', true);
      playBtn.disabled = true;
      restartBtn.disabled = true;
      locationsList.innerHTML = '';
      locationsCount.textContent = '0 / 0 pinned';
      headerLocationsBadge.textContent = '0';
      return;
    }

    hubIndex = points.length > 1 ? findHubIndex(points) : -1;
    if (hubIndex === -1) hubIndex = 0;
    targetOrder = points.map((_, i) => i).filter(i => i !== hubIndex);

    const latlngs = points.map(p => [p.lat, p.lng]);

    markers = points.map((p, i) => {
      const isHub = i === hubIndex;
      const m = L.marker([p.lat, p.lng], {
        icon: isHub ? hubIcon() : stopIcon(targetLabelNumber(i), 'idle'),
        zIndexOffset: isHub ? 900 : 0
      });
      m.bindTooltip(p.name, { className: 'stop-label', direction: 'top', offset: [0, -6] });
      m.bindPopup('<b>' + escapeHtml(p.name) + '</b><br>' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5));
      if (isHub) {
        m.addTo(map);
      }
      return m;
    });

    beamLine = L.polyline([], { color: '#f0c878', weight: 2.5, opacity: 0 }).addTo(map);
    light = L.marker(latlngs[hubIndex], {
      icon: L.divIcon({ className: '', html: '<div class="light-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
      zIndexOffset: 1000,
      opacity: 0
    }).addTo(map);

    buildLocationsList();

    if (points.length > 1) {
      map.fitBounds(latlngs, { padding: getMapPadding() });
    } else {
      map.setView(latlngs[0], 10);
    }

    let statusHtml = '<b>' + points.length + ' location' + (points.length === 1 ? '' : 's') + '</b> loaded';
    statusHtml += ' · hub: ' + escapeHtml(points[hubIndex].name);
    if (skippedCount) {
      statusHtml += ' · ' + skippedCount + ' outside Kenya skipped';
    }
    setStatus(statusHtml, false);

    const canAnimate = targetOrder.length > 0;
    playBtn.disabled = !canAnimate;
    restartBtn.disabled = !canAnimate;

    if (canAnimate) {
      togglePlay(true);
    }
  }

  function targetLabelNumber(pointIdx) {
    const pos = targetOrder.indexOf(pointIdx);
    return pos === -1 ? '·' : pos + 1;
  }

  function buildLocationsList() {
    locationsList.innerHTML = '';
    const total = targetOrder.length;
    locationsCount.textContent = '0 / ' + total + ' pinned';
    headerLocationsBadge.textContent = String(total);

    points.forEach((p, i) => {
      const isHub = i === hubIndex;
      const item = document.createElement('button');
      item.className = 'location-item' + (isHub ? ' is-hub' : '');
      item.type = 'button';
      item.dataset.pointIndex = String(i);
      const badge = isHub ? 'HQ' : String(targetLabelNumber(i));
      item.innerHTML =
        '<span class="location-badge">' + badge + '</span>' +
        '<span class="location-name">' + escapeHtml(p.name) + '</span>';
      
      if (!isHub) {
        item.addEventListener('click', () => {
          jumpToTarget(targetOrder.indexOf(i));
          if (window.innerWidth <= 768) {
            closeLocationsDrawer();
          }
        });
      }
      locationsList.appendChild(item);
    });
  }

  function syncLocationsHighlight(activeTargetCursor) {
    const activePointIdx = activeTargetCursor >= 0 ? targetOrder[activeTargetCursor] : -1;
    const pinnedCount = activeTargetCursor >= 0 ? (activeTargetCursor + 1) : 0;
    locationsCount.textContent = pinnedCount + ' / ' + targetOrder.length + ' pinned';

    const items = locationsList.querySelectorAll('.location-item');
    items.forEach((item) => {
      const pIdx = parseInt(item.dataset.pointIndex, 10);
      const posInOrder = targetOrder.indexOf(pIdx);
      const isPinned = posInOrder !== -1 && posInOrder <= activeTargetCursor;
      const isActive = pIdx === activePointIdx;
      item.classList.toggle('is-pinned', isPinned);
      item.classList.toggle('is-active', isActive);
    });

    const activeItem = locationsList.querySelector('.location-item.is-active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function jumpToTarget(cursor) {
    if (!targetOrder[cursor]) return;
    clearTimers();
    playing = false;
    updatePlayButtonState(false);

    targetCursor = cursor;
    const pointIdx = targetOrder[cursor];
    const to = points[pointIdx];
    const hub = points[hubIndex];

    targetOrder.forEach((p, i) => {
      if (i <= cursor) {
        if (!map.hasLayer(markers[p])) {
          markers[p].addTo(map);
        }
        markers[p].setIcon(stopIcon(targetLabelNumber(p), i === cursor ? 'active' : 'pinned'));
      } else {
        if (map.hasLayer(markers[p])) {
          map.removeLayer(markers[p]);
        }
      }
    });

    syncLocationsHighlight(cursor);
    beamLine.setLatLngs([[hub.lat, hub.lng], [to.lat, to.lng]]);
    beamLine.setStyle({ opacity: 0.85 });
    light.setLatLng([to.lat, to.lng]);
    light.setOpacity(1);

    map.flyTo([to.lat, to.lng], Math.max(map.getZoom(), 8), { duration: 0.6 });
    markers[pointIdx].openPopup();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateBeam(cursor, onDone) {
    const pointIdx = targetOrder[cursor];
    const hub = points[hubIndex];
    const to = points[pointIdx];
    const dur = travelDuration();
    let start = null;

    setStatus('Pinning stop <b>' + (cursor + 1) + ' / ' + targetOrder.length + '</b>: ' + escapeHtml(to.name), false);
    beamLine.setStyle({ opacity: 0.85 });
    light.setOpacity(1);

    function travelFrame(ts) {
      if (!start) start = ts;
      const t = Math.min((ts - start) / dur, 1);
      const e = easeOutCubic(t);

      const lat = hub.lat + (to.lat - hub.lat) * e;
      const lng = hub.lng + (to.lng - hub.lng) * e;
      light.setLatLng([lat, lng]);
      beamLine.setLatLngs([[hub.lat, hub.lng], [lat, lng]]);

      const el = light.getElement();
      if (el) {
        const dot = el.querySelector('.light-dot');
        if (dot) {
          const pulse = 1 + 0.12 * Math.sin(ts / 90);
          dot.style.transform = 'scale(' + pulse + ')';
        }
      }

      if (t < 1) {
        animHandle = requestAnimationFrame(travelFrame);
      } else {
        if (!map.hasLayer(markers[pointIdx])) {
          markers[pointIdx].addTo(map);
        }
        markers[pointIdx].setIcon(stopIcon(targetLabelNumber(pointIdx), 'active just-pinned'));
        syncLocationsHighlight(cursor);
        timeoutHandle = setTimeout(() => fadeOut(cursor, onDone), HOLD_AT_TARGET_MS);
      }
    }
    animHandle = requestAnimationFrame(travelFrame);
  }

  function fadeOut(cursor, onDone) {
    const start = performance.now();
    function fadeFrame(ts) {
      const t = Math.min((ts - start) / FADE_OUT_MS, 1);
      const opacity = 1 - t;
      beamLine.setStyle({ opacity: 0.85 * opacity });
      light.setOpacity(opacity);
      if (t < 1) {
        animHandle = requestAnimationFrame(fadeFrame);
      } else {
        const pointIdx = targetOrder[cursor];
        markers[pointIdx].setIcon(stopIcon(targetLabelNumber(pointIdx), 'pinned'));
        onDone();
      }
    }
    animHandle = requestAnimationFrame(fadeFrame);
  }

  function loopStep() {
    if (!playing) return;
    animateBeam(targetCursor, () => {
      if (!playing) return;
      const nextCursor = targetCursor + 1;

      if (nextCursor < targetOrder.length) {
        targetCursor = nextCursor;
        timeoutHandle = setTimeout(loopStep, 90);
      } else {
        setStatus('<b>All ' + targetOrder.length + ' locations pinned!</b> Restarting cycle in 2s…', false);
        timeoutHandle = setTimeout(() => {
          if (!playing) return;
          targetOrder.forEach(pIdx => {
            if (map.hasLayer(markers[pIdx])) {
              map.removeLayer(markers[pIdx]);
            }
          });
          targetCursor = 0;
          syncLocationsHighlight(-1);
          loopStep();
        }, 2000);
      }
    });
  }

  function updatePlayButtonState(isPlaying) {
    if (playBtnText) {
      playBtnText.textContent = isPlaying ? 'Pause' : 'Play';
    }
    const icon = playBtn.querySelector('.play-icon');
    if (icon) {
      icon.innerHTML = isPlaying
        ? '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>'
        : '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }
  }

  function togglePlay(force) {
    if (targetOrder.length === 0) return;
    playing = (typeof force === 'boolean') ? force : !playing;
    updatePlayButtonState(playing);
    if (playing) loopStep();
    else clearTimers();
  }

  playBtn.addEventListener('click', () => togglePlay());
  restartBtn.addEventListener('click', () => {
    clearTimers();
    targetCursor = 0;
    targetOrder.forEach(pointIdx => {
      if (map.hasLayer(markers[pointIdx])) {
        map.removeLayer(markers[pointIdx]);
      }
    });
    beamLine.setLatLngs([]);
    beamLine.setStyle({ opacity: 0 });
    light.setOpacity(0);
    syncLocationsHighlight(-1);
    togglePlay(true);
  });

  // ---------- Talking to the PHP backend ----------
  async function loadFromEndpoint(url, options, fallbackLabel) {
    setStatus('Processing…', false);
    heroSub.textContent = 'Processing…';
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        throw new Error('Server returned invalid response (' + (res.status || '500') + ')');
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || ('Request failed (' + res.status + ')'));
      }
      heroSub.textContent = data.filename || fallbackLabel;
      loadRoute(data.points, data.filename || fallbackLabel, data.skipped || 0);
    } catch (err) {
      heroSub.textContent = 'Could not load data';
      setStatus('Error: ' + escapeHtml(err.message), true);
    }
  }

  function uploadFile(file) {
    const formData = new FormData();
    formData.append('kmzFile', file);
    loadFromEndpoint('upload.php', { method: 'POST', body: formData }, file.name);
  }

  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) uploadFile(e.target.files[0]);
  });
  document.getElementById('sampleBtn').addEventListener('click', () => {
    loadFromEndpoint('sample.php', { method: 'GET' }, 'sample data');
  });

  // Drag & drop
  const dropHint = document.getElementById('dropHint');
  ['dragenter', 'dragover'].forEach(ev => {
    document.body.addEventListener(ev, (e) => { e.preventDefault(); dropHint.classList.add('active'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    document.body.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && e.target !== document.body) return;
      dropHint.classList.remove('active');
    });
  });
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });

  // ---------- Boot: load the bundled sample on first visit ----------
  loadFromEndpoint('sample.php', { method: 'GET' }, 'sample data');
})();
