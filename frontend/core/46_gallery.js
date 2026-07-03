// ============================================================
// PAINTING GALLERY — Saves all paintings per user profile
// ============================================================
function getGalleryKey() {
  return state.user ? 'veil_gallery_' + state.user.username : 'veil_gallery';
}

function loadGallery() {
  try {
    var saved = localStorage.getItem(getGalleryKey());
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
}

function savePaintingToGallery(description, dataUrl) {
  var gallery = loadGallery();
  gallery.push({
    description: description,
    dataUrl: dataUrl,
    timestamp: Date.now()
  });
  // Keep last 50 paintings
  if (gallery.length > 50) gallery = gallery.slice(-50);
  try {
    localStorage.setItem(getGalleryKey(), JSON.stringify(gallery));
  } catch(e) {
    // localStorage might be full — trim older paintings
    gallery = gallery.slice(-10);
    try { localStorage.setItem(getGalleryKey(), JSON.stringify(gallery)); } catch(e2) {}
  }
}

function showGallery() {
  var gallery = loadGallery();
  var overlay = document.getElementById('galleryOverlay');
  var container = document.getElementById('galleryGrid');
  if (!overlay || !container) return;

  container.innerHTML = '';
  if (gallery.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:40px 0">No paintings yet. Ask Caelum to paint something.</div>';
  } else {
    gallery.slice().reverse().forEach(function(item, idx) {
      var div = document.createElement('div');
      div.style.cssText = 'background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;cursor:pointer';
      var img = document.createElement('img');
      img.src = item.dataUrl;
      img.style.cssText = 'width:100%;border-radius:4px;image-rendering:pixelated';
      img.title = item.description;
      var label = document.createElement('div');
      label.style.cssText = 'font-size:10px;color:var(--dim);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      label.textContent = item.description;
      var date = document.createElement('div');
      date.style.cssText = 'font-size:9px;color:var(--muted);margin-top:2px';
      date.textContent = new Date(item.timestamp).toLocaleDateString();
      var dlBtn = document.createElement('button');
      dlBtn.textContent = 'Download';
      dlBtn.style.cssText = 'margin-top:4px;padding:3px 10px;background:var(--accent);border:none;color:var(--bg);font-size:9px;font-weight:700;border-radius:4px;cursor:pointer';
      dlBtn.onclick = function() {
        var link = document.createElement('a');
        link.download = 'caelum-' + item.description.replace(/[^a-z0-9]/gi, '-').substring(0, 30) + '.png';
        link.href = item.dataUrl;
        link.click();
      };
      div.appendChild(img);
      div.appendChild(label);
      div.appendChild(date);
      div.appendChild(dlBtn);
      container.appendChild(div);
    });
  }
  overlay.classList.add('show');
}

function hideGallery() {
  var overlay = document.getElementById('galleryOverlay');
  if (overlay) overlay.classList.remove('show');
}

function stripBackgroundCommand(text) {
  text = text.replace(/\[\[bg:[^\]]*\]\]/g, '');
  text = text.replace(/\[\[bg:.*$/g, '');
  return text.trim();
}

function checkAndApplyBackground(text) {
  try {
    var bgData = parseBackgroundCommand(text);
    if (bgData) {
      if (bgData.type === 'paint') {
        var parts = bgData.raw.split(':');
        var dims = (parts[0] || '72x128').split('x');
        var w = parseInt(dims[0]) || 72, h = parseInt(dims[1]) || 128;
        var desc = parts.slice(1).join(':') || 'abstract art';
        w = Math.min(w, 72); h = Math.min(h, 128);
        startBackgroundPaint(w, h, desc);
      } else {
        renderPixelBackground(bgData);
      }
    }
  } catch(e) { console.log('Background apply error:', e); }
  return stripBackgroundCommand(text);
}

