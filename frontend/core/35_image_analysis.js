// ============================================================
// IMAGE ANALYSIS ENGINE — Canvas-based color/content analysis
// ============================================================

// ── Main analyzeImage — canvas only ─────────────────────────
function analyzeImage(dataUrl) {
  return analyzeImageCanvas(dataUrl);
}

// ── Canvas-based analysis (original engine) ──────────────────
function analyzeImageCanvas(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      var maxDim = 200;
      var scale = Math.min(maxDim / w, maxDim / h, 1);
      var sw = Math.round(w * scale), sh = Math.round(h * scale);

      var canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, sw, sh);
      var data = ctx.getImageData(0, 0, sw, sh).data;

      // Color analysis
      var totalR = 0, totalG = 0, totalB = 0, pixels = sw * sh;
      var colorBuckets = {};
      var brightPixels = 0, darkPixels = 0;
      var warmPixels = 0, coolPixels = 0;
      var edgeCount = 0;

      for (var i = 0; i < data.length; i += 4) {
        var r = data[i], g = data[i+1], b = data[i+2];
        totalR += r; totalG += g; totalB += b;

        // Brightness
        var lum = (r * 0.299 + g * 0.587 + b * 0.114);
        if (lum > 180) brightPixels++;
        else if (lum < 60) darkPixels++;

        // Warm vs cool
        if (r > b + 30) warmPixels++;
        else if (b > r + 30) coolPixels++;

        // Color bucketing (reduce to 8 levels per channel)
        var br = Math.floor(r / 32), bg = Math.floor(g / 32), bb = Math.floor(b / 32);
        var key = br + ',' + bg + ',' + bb;
        colorBuckets[key] = (colorBuckets[key] || 0) + 1;
      }

      // Edge detection (simple gradient)
      for (var y = 1; y < sh - 1; y++) {
        for (var x = 1; x < sw - 1; x++) {
          var idx = (y * sw + x) * 4;
          var idxR = (y * sw + x + 1) * 4;
          var idxD = ((y + 1) * sw + x) * 4;
          var gx = Math.abs(data[idx] - data[idxR]) + Math.abs(data[idx+1] - data[idxR+1]) + Math.abs(data[idx+2] - data[idxR+2]);
          var gy = Math.abs(data[idx] - data[idxD]) + Math.abs(data[idx+1] - data[idxD+1]) + Math.abs(data[idx+2] - data[idxD+2]);
          if (gx + gy > 100) edgeCount++;
        }
      }

      // Dominant colors
      var sortedColors = Object.keys(colorBuckets).sort(function(a, b) { return colorBuckets[b] - colorBuckets[a]; });
      var topColors = sortedColors.slice(0, 5).map(function(key) {
        var parts = key.split(',');
        var cr = parts[0] * 32 + 16, cg = parts[1] * 32 + 16, cb = parts[2] * 32 + 16;
        return describeColor(cr, cg, cb);
      });

      // Build description
      var avgR = Math.round(totalR / pixels), avgG = Math.round(totalG / pixels), avgB = Math.round(totalB / pixels);
      var brightPct = Math.round(brightPixels / pixels * 100);
      var darkPct = Math.round(darkPixels / pixels * 100);
      var edgePct = Math.round(edgeCount / pixels * 100);

      var desc = 'IMAGE ANALYSIS:\n';
      desc += 'Dimensions: ' + w + 'x' + h + ' pixels\n';
      desc += 'Aspect ratio: ' + (w > h ? 'landscape' : h > w ? 'portrait' : 'square') + '\n';
      desc += 'Overall tone: ' + (brightPct > 50 ? 'bright/light' : darkPct > 50 ? 'dark/moody' : 'medium brightness') + '\n';
      desc += 'Color temperature: ' + (warmPixels > coolPixels * 1.5 ? 'warm (reds, oranges, yellows)' : coolPixels > warmPixels * 1.5 ? 'cool (blues, greens, purples)' : 'neutral/mixed') + '\n';
      desc += 'Average color: ' + describeColor(avgR, avgG, avgB) + '\n';
      desc += 'Dominant colors: ' + topColors.join(', ') + '\n';
      desc += 'Visual complexity: ' + (edgePct > 30 ? 'high detail (many edges, textures, or objects)' : edgePct > 15 ? 'moderate detail' : 'simple/smooth (few edges, possibly a gradient, sky, or solid areas)') + '\n';
      desc += 'Bright areas: ' + brightPct + '%, Dark areas: ' + darkPct + '%\n';

      // Region analysis (divide into 3x3 grid)
      desc += 'Regions (3x3 grid, top-left to bottom-right):\n';
      var regionNames = ['top-left','top-center','top-right','middle-left','center','middle-right','bottom-left','bottom-center','bottom-right'];
      for (var ry = 0; ry < 3; ry++) {
        for (var rx = 0; rx < 3; rx++) {
          var rr = 0, rg = 0, rb = 0, rc = 0;
          var x0 = Math.floor(rx * sw / 3), x1 = Math.floor((rx+1) * sw / 3);
          var y0 = Math.floor(ry * sh / 3), y1 = Math.floor((ry+1) * sh / 3);
          for (var py = y0; py < y1; py++) {
            for (var px = x0; px < x1; px++) {
              var pi = (py * sw + px) * 4;
              rr += data[pi]; rg += data[pi+1]; rb += data[pi+2]; rc++;
            }
          }
          if (rc > 0) {
            desc += '  ' + regionNames[ry*3+rx] + ': ' + describeColor(Math.round(rr/rc), Math.round(rg/rc), Math.round(rb/rc)) + '\n';
          }
        }
      }

      resolve(desc);
    };
    img.onerror = function() { resolve('IMAGE: Could not analyze this image.'); };
    img.src = dataUrl;
  });
}

function describeColor(r, g, b) {
  var h, s, l;
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = Math.round(h * 360); s = Math.round(s * 100); l = Math.round(l * 100);

  var lightness = l < 20 ? 'very dark ' : l < 40 ? 'dark ' : l > 80 ? 'very light ' : l > 60 ? 'light ' : '';
  var saturation = s < 10 ? 'gray' : '';
  if (saturation) {
    if (l < 15) return 'black';
    if (l > 85) return 'white';
    return lightness + 'gray';
  }
  var hue = '';
  if (h < 15 || h >= 345) hue = 'red';
  else if (h < 45) hue = 'orange';
  else if (h < 70) hue = 'yellow';
  else if (h < 150) hue = 'green';
  else if (h < 195) hue = 'cyan';
  else if (h < 260) hue = 'blue';
  else if (h < 290) hue = 'purple';
  else hue = 'pink';
  return lightness + hue;
}

function clearUpload() {
  _pendingUpload = null;
  var preview = document.getElementById('uploadPreview');
  preview.style.display = 'none';
  preview.innerHTML = '';
}

// ── FILE BACKEND SYNC ──
async function saveFileToBackend(filename, content, source) {
  if (typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive() && typeof VeilIDE.persistActiveFile === 'function') {
    try { await VeilIDE.persistActiveFile(false); return; } catch (e) { /* fall through */ }
  }
  if (!state.user) return;
  try {
    var ext = filename.split('.').pop().toLowerCase();
    var imgExts = ['png','jpg','jpeg','gif','webp','bmp','svg'];
    var codeExts = ['js','ts','jsx','tsx','py','java','c','cpp','h','rb','go','rs','php','sql','sh','css','html','xml','json','yaml','yml'];
    var fileType = imgExts.indexOf(ext) !== -1 ? 'image' : codeExts.indexOf(ext) !== -1 ? 'code' : 'document';
    // Images store as base64 data URLs (up to 3MB), text files up to 100KB
    var maxContent = fileType === 'image' ? 3000000 : 100000;
    await supabase.from('user_files').insert({
      user_id: state.user.id,
      filename: filename,
      content: content.substring(0, maxContent),
      file_type: fileType,
      source: source || 'ai',
      size_bytes: new Blob([content]).size
    });
    refreshFilesList(); // update the cached list
  } catch(e) { console.log('File save error:', e); }
}

async function loadUserFiles() {
  if (!state.user) return [];
  try {
    var { data, error } = await supabase.from('user_files').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch(e) { console.log('File load error:', e); return []; }
}

async function deleteUserFile(fileId) {
  if (!confirm('Delete this file?')) return;
  try {
    await supabase.from('user_files').delete().eq('id', fileId);
    showFilesPanel(); // refresh
  } catch(e) { console.log('File delete error:', e); }
}

function downloadUserFile(filename, content) {
  var ext = filename.split('.').pop().toLowerCase();
  var mimeTypes = { txt:'text/plain', html:'text/html', css:'text/css', js:'application/javascript', json:'application/json', java:'text/x-java', py:'text/x-python', ts:'application/typescript', md:'text/markdown', csv:'text/csv', xml:'application/xml', yaml:'text/yaml', yml:'text/yaml' };
  var mime = mimeTypes[ext] || 'text/plain';
  var blob = new Blob([content], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadImageFile(dlId) {
  var data = window['_fileData_' + dlId];
  if (!data || !data.content) return;
  var a = document.createElement('a');
  a.href = data.content; // data URL
  a.download = data.name;
  a.click();
}

async function showFilesPanel() {
  var panel = document.getElementById('filesPanel');
  var list = document.getElementById('filesList');
  panel.classList.add('show');
  list.innerHTML = '<div class="files-empty">Loading files...</div>';
  window._selectedFiles = [];

  var files = await loadUserFiles();
  if (!files.length) {
    list.innerHTML = '<div class="files-empty">No files yet. Ask Caelum or Chad to create a file, or upload one using the &#128206; button.</div>';
    return;
  }

  // Categorize files
  var catMap = {
    js:'Code',ts:'Code',jsx:'Code',tsx:'Code',py:'Code',java:'Code',c:'Code',cpp:'Code',h:'Code',rb:'Code',go:'Code',rs:'Code',php:'Code',sql:'Code',sh:'Code',
    html:'Web',css:'Web',xml:'Web',
    json:'Data',csv:'Data',yaml:'Data',yml:'Data',toml:'Data',ini:'Data',cfg:'Data',
    txt:'Documents',md:'Documents',log:'Documents',pdf:'Documents',
    png:'Images',jpg:'Images',jpeg:'Images',gif:'Images',webp:'Images',bmp:'Images',svg:'Images'
  };
  var catIcons = { Code:'&#128187;', Web:'&#128195;', Data:'&#128202;', Documents:'&#128196;', Images:'&#128247;', Other:'&#128196;' };
  var groups = {};
  files.forEach(function(f) {
    var ext = f.filename.split('.').pop().toLowerCase();
    var cat = catMap[ext] || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  });

  // Sort each group alphabetically
  Object.keys(groups).forEach(function(cat) {
    groups[cat].sort(function(a, b) { return a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()); });
  });

  // Render in category order
  var catOrder = ['Code', 'Web', 'Data', 'Documents', 'Images', 'Other'];
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 8px">';
  html += '<span style="font-size:11px;color:var(--muted)">' + files.length + ' file(s) across ' + Object.keys(groups).length + ' categories</span>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button onclick="filesSelectAll()" style="font-size:10px;padding:4px 10px;background:rgba(0,255,200,.1);border:1px solid rgba(0,255,200,.2);color:var(--accent);border-radius:12px;cursor:pointer">Select All</button>';
  html += '<button onclick="filesDeselectAll()" style="font-size:10px;padding:4px 10px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--muted);border-radius:12px;cursor:pointer">Deselect</button>';
  html += '<button onclick="filesBulkDownload()" style="font-size:10px;padding:4px 10px;background:rgba(0,255,200,.1);border:1px solid rgba(0,255,200,.2);color:var(--accent);border-radius:12px;cursor:pointer">&#11015; Download Selected</button>';
  html += '<button onclick="filesBulkDelete()" style="font-size:10px;padding:4px 10px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.2);color:#ff6b6b;border-radius:12px;cursor:pointer">&#128465; Delete Selected</button>';
  html += '</div></div>';

  catOrder.forEach(function(cat) {
    if (!groups[cat] || !groups[cat].length) return;
    html += '<div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:1px;text-transform:uppercase;margin:12px 0 6px;display:flex;align-items:center;gap:6px">';
    html += '<span>' + (catIcons[cat] || '') + '</span> ' + cat + ' <span style="font-weight:400;color:var(--muted)">(' + groups[cat].length + ')</span></div>';

    groups[cat].forEach(function(f) {
      var ext = f.filename.split('.').pop().toLowerCase();
      var sizeStr = f.size_bytes > 1024 ? Math.round(f.size_bytes / 1024) + ' KB' : (f.size_bytes || 0) + ' B';
      var sourceLabel = f.source === 'user' ? 'Uploaded' : 'AI';
      var date = new Date(f.created_at).toLocaleDateString();
      var dlId = 'ufile-' + f.id;
      window['_fileData_' + dlId] = { name: f.filename, content: f.content };
      var isImg = f.file_type === 'image' && f.content && f.content.indexOf('data:image') === 0;
      html += '<div class="file-card">';
      html += '<input type="checkbox" class="file-select-cb" data-file-id="' + f.id + '" style="width:16px;height:16px;accent-color:#00ffc8;cursor:pointer;flex-shrink:0" onchange="fileToggleSelect(\'' + f.id + '\',this.checked)">';
      if (isImg) {
        html += '<img src="' + f.content + '" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid rgba(0,255,200,.1);cursor:pointer" onclick="window.open(this.src)">';
      } else {
        html += '<span class="fc-icon">' + (catIcons[cat] || '&#128196;') + '</span>';
      }
      html += '<div class="fc-info"><div class="fc-name">' + escapeHtml(f.filename) + '</div>';
      html += '<div class="fc-meta">.' + ext + ' &middot; ' + sizeStr + ' &middot; ' + sourceLabel + ' &middot; ' + date + '</div></div>';
      html += '<div class="fc-actions">';
      if (isImg) {
        html += '<button class="fc-btn" onclick="downloadImageFile(\'' + dlId + '\')">Download</button>';
      } else {
        html += '<button class="fc-btn" onclick="downloadUserFile(\'' + escapeHtml(f.filename).replace(/'/g, "\\'") + '\',window[\'_fileData_ufile-' + f.id + '\'].content)">Download</button>';
      }
      html += '<button class="fc-del" onclick="deleteUserFile(\'' + f.id + '\')">Delete</button>';
      html += '<button class="fc-btn" style="color:#a78bfa;border-color:rgba(167,139,250,.15)" onclick="shareToVeil(\'' + (f.file_type === 'code' ? 'code' : 'file') + '\',window[\'_fileData_ufile-' + f.id + '\'].content,\'' + escapeHtml(f.filename).replace(/'/g, "\\'") + '\',\'' + escapeHtml(f.filename).replace(/'/g, "\\'") + '\',\'' + ext + '\',\'ai\')">Veil</button>';
      html += '</div></div>';
    });
  });

  list.innerHTML = html;
}

function fileToggleSelect(fileId, checked) {
  if (!window._selectedFiles) window._selectedFiles = [];
  if (checked) {
    if (window._selectedFiles.indexOf(fileId) === -1) window._selectedFiles.push(fileId);
  } else {
    window._selectedFiles = window._selectedFiles.filter(function(id) { return id !== fileId; });
  }
}

function filesSelectAll() {
  window._selectedFiles = [];
  document.querySelectorAll('.file-select-cb').forEach(function(cb) {
    cb.checked = true;
    window._selectedFiles.push(cb.getAttribute('data-file-id'));
  });
}

function filesDeselectAll() {
  window._selectedFiles = [];
  document.querySelectorAll('.file-select-cb').forEach(function(cb) { cb.checked = false; });
}

function filesBulkDownload() {
  if (!window._selectedFiles || !window._selectedFiles.length) {
    addSystemMessage('No files selected. Use the checkboxes to select files first.');
    return;
  }
  window._selectedFiles.forEach(function(id) {
    var data = window['_fileData_ufile-' + id];
    if (data && data.content) {
      downloadUserFile(data.name, data.content);
    }
  });
  addSystemMessage(window._selectedFiles.length + ' file(s) downloaded.');
}

async function filesBulkDelete() {
  if (!window._selectedFiles || !window._selectedFiles.length) {
    addSystemMessage('No files selected. Use the checkboxes to select files first.');
    return;
  }
  if (!confirm('Delete ' + window._selectedFiles.length + ' selected file(s)? This cannot be undone.')) return;
  for (var i = 0; i < window._selectedFiles.length; i++) {
    await supabase.from('user_files').delete().eq('id', window._selectedFiles[i]);
  }
  addSystemMessage(window._selectedFiles.length + ' file(s) deleted.');
  window._selectedFiles = [];
  showFilesPanel();
}

function hideFilesPanel() {
  document.getElementById('filesPanel').classList.remove('show');
}

