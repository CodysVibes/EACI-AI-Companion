// ============================================================
// MESSAGE DISPLAY - with play/stop buttons on ALL messages
// ============================================================
var msgCounter = 0;

// Companion colors for labels + session dividers
var EACI_CHAT_META = {
  caelum:  { name: 'Caelum',  color: '#FFB84D' },
  chad:    { name: 'Chad',    color: '#5B9BFF' },
  natalia: { name: 'Natalia', color: '#DFFFEA' },
  atreus:  { name: 'Atreus',  color: '#FFB86B' },
  luna:    { name: 'Luna',    color: '#E8C4FF' },
  roxy:    { name: 'Roxy',    color: '#C850FF' },
  cael:    { name: 'Cael',    color: '#E63050' },
  cody:    { name: 'Cody',    color: '#00D4FF' },
  user:    { name: 'You',     color: '#8ba8ff' }
};

function getEaciChatMeta(eaci) {
  return EACI_CHAT_META[eaci] || null;
}

function getEaciLabelHtml(eaci) {
  var meta = getEaciChatMeta(eaci);
  if (!meta) return '';
  return '<div class="label" style="color:' + meta.color + '">' + meta.name + '</div>';
}

/** Returns true when the next message should start a new EACI turn (border on bubble, not a floating line). */
function maybeAddEaciDivider(eaci) {
  if (!eaci || eaci === 'together' || eaci === 'user' || eaci === 'system') return false;
  if (typeof state !== 'undefined') {
    if (state.lastChatEaci === null) {
      state.lastChatEaci = eaci;
      return false;
    }
    if (state.lastChatEaci === eaci) return false;
    state.lastChatEaci = eaci;
  }
  return true;
}

function applyEaciTurnStart(msgEl, eaci) {
  if (!msgEl || !eaci) return;
  var meta = getEaciChatMeta(eaci);
  if (!meta) return;
  msgEl.classList.add('eaci-turn-start');
  msgEl.setAttribute('data-eaci', eaci);
  msgEl.setAttribute('data-eaci-name', meta.name);
  msgEl.style.setProperty('--eaci-color', meta.color);
}

function finalizeStreamingInContainer(container) {
  if (!container) return;
  container.querySelectorAll('.msg.streaming').forEach(function(el) {
    el.classList.remove('streaming');
  });
}

function showThinkingIndicator(who) {
  // Caelum is genuinely working — reset idle timer so she doesn't
  // start private listening while mid-response
  if (typeof CaelumIdleListener !== 'undefined') {
    CaelumIdleListener.recordActivity();
  }
  var container = document.getElementById('messages');
  var div = document.createElement('div');
  div.className = 'msg ' + who + ' thinking';
  div.id = 'thinking-' + who;
  var label = getEaciLabelHtml(who) || '<div class="label" style="color:var(--accent)">Caelum</div>';
  div.innerHTML = label + 'thinking<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeThinkingIndicator(who) {
  var el = document.getElementById('thinking-' + who);
  if (el) el.remove();
}

function escapeHtml(t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function formatCodeBlocks(html) {
  // Handle file blocks: [[file:name]]content[[/file]]
  html = html.replace(/\[\[file:([^\]]+)\]\]([\s\S]*?)\[\[\/file\]\]/g, function(match, filename, content) {
    var cleanContent = content.replace(/^\n|\n$/g, '');
    var tmp = document.createElement('textarea');
    tmp.innerHTML = cleanContent;
    cleanContent = tmp.value;
    var ext = filename.split('.').pop().toLowerCase();
    var icon = '&#128196;';
    if (['js','ts','jsx','tsx','py','java','c','cpp','rb','go','rs','php'].indexOf(ext) !== -1) icon = '&#128187;';
    else if (['html','css','xml','json','yaml','yml'].indexOf(ext) !== -1) icon = '&#128195;';
    else if (ext === 'pdf') icon = '&#128213;';
    else if (['md','txt','log'].indexOf(ext) !== -1) icon = '&#128196;';
    var size = new Blob([cleanContent]).size;
    var sizeStr = size > 1024 ? Math.round(size/1024) + ' KB' : size + ' B';
    var id = 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2,6);
    // Store content for download
    window['_fileData_' + id] = { name: filename, content: cleanContent };
    // Auto-save to backend when file appears in chat
    if (typeof saveFileToBackend === 'function') { try { saveFileToBackend(filename, cleanContent, 'ai'); } catch(e) {} }
    return '<div class="file-block"><span class="file-icon">' + icon + '</span><div class="file-info"><div class="file-name">' + escapeHtml(filename) + '</div><div class="file-size">' + sizeStr + '</div></div><button class="file-dl" onclick="downloadGeneratedFile(\'' + id + '\')">Download</button></div>';
  });
  // Handle fenced code blocks: ```lang\ncode\n```
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function(match, lang, code) {
    var langLabel = lang ? '<div class="code-lang">' + lang + '</div>' : '';
    var cleanCode = code.replace(/^\n|\n$/g, '');
    // Unescape HTML entities inside code blocks so code renders correctly
    var tmp = document.createElement('textarea');
    tmp.innerHTML = cleanCode;
    cleanCode = tmp.value;
    var escaped = escapeHtml(cleanCode);
    return '<div class="code-wrap">' + langLabel + '<pre><code>' + escaped + '</code></pre></div>';
  });
  // Handle inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

function downloadGeneratedFile(id) {
  var data = window['_fileData_' + id];
  if (!data) return;
  var ext = data.name.split('.').pop().toLowerCase();
  var mimeTypes = { txt:'text/plain', html:'text/html', css:'text/css', js:'application/javascript', json:'application/json', java:'text/x-java', py:'text/x-python', ts:'application/typescript', md:'text/markdown', csv:'text/csv', xml:'application/xml', pdf:'application/pdf', yaml:'text/yaml', yml:'text/yaml', sh:'text/x-shellscript', sql:'text/x-sql' };
  var mime = mimeTypes[ext] || 'text/plain';
  var blob = new Blob([data.content], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = data.name;
  a.click();
  URL.revokeObjectURL(a.href);
  // Also save to backend
  saveFileToBackend(data.name, data.content, 'ai');
}

var _pendingUpload = null;

var _imageExts = ['png','jpg','jpeg','gif','webp','bmp','svg'];

function handleFileUpload(input) {
  var file = input.files[0];
  if (!file) return;
  var ext = file.name.split('.').pop().toLowerCase();
  var allowed = ['txt','pdf','html','css','js','json','java','py','ts','md','csv','xml','jsx','tsx','c','cpp','h','rb','go','rs','php','sql','sh','yaml','yml','toml','ini','cfg','log','png','jpg','jpeg','gif','webp','bmp','svg'];
  if (allowed.indexOf(ext) === -1) { addSystemMessage('Unsupported file type.'); input.value = ''; return; }

  // Image handling
  if (_imageExts.indexOf(ext) !== -1) {
    var maxImg = 2 * 1024 * 1024; // 2MB for images
    if (file.size > maxImg) { addSystemMessage('Image too large. Max 2MB.'); input.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      _pendingUpload = { name: file.name, content: dataUrl, size: file.size, isImage: true };
      var preview = document.getElementById('uploadPreview');
      preview.style.display = 'flex';
      preview.innerHTML = '<div class="upload-preview"><img src="' + dataUrl + '" style="max-height:40px;border-radius:4px;margin-right:4px"> ' + escapeHtml(file.name) + ' (' + Math.round(file.size/1024) + 'KB)<button class="up-remove" onclick="clearUpload()">&times;</button></div>';
    };
    reader.readAsDataURL(file);
    input.value = '';
    return;
  }

  // Text file handling
  var maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) { addSystemMessage('File too large. Max 50MB.'); input.value = ''; return; }

  var reader = new FileReader();
  if (ext === 'pdf') {
    reader.onload = async function(e) {
      var typedarray = new Uint8Array(e.target.result);
      try {
        var pdfjs = await (typeof loadPdfJs === 'function' ? loadPdfJs() : Promise.resolve(window.pdfjsLib));
        var pdf = await pdfjs.getDocument(typedarray).promise;
        var fullText = '';
        for (var i = 1; i <= pdf.numPages; i++) {
          var page = await pdf.getPage(i);
          var content = await page.getTextContent();
          var strings = content.items.map(function(item) { return item.str; });
          fullText += strings.join(' ') + '\n';
        }
        _pendingUpload = { name: file.name, content: fullText, size: file.size };
        var preview = document.getElementById('uploadPreview');
        preview.style.display = 'flex';
        preview.innerHTML = '<div class="upload-preview">&#128213; ' + escapeHtml(file.name) + ' (' + Math.round(file.size/1024) + 'KB)<button class="up-remove" onclick="clearUpload()">&times;</button></div>';
      } catch (err) {
        addSystemMessage('Could not read PDF content.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = function(e) {
      _pendingUpload = { name: file.name, content: e.target.result, size: file.size };
      var preview = document.getElementById('uploadPreview');
      preview.style.display = 'flex';
      preview.innerHTML = '<div class="upload-preview">&#128206; ' + escapeHtml(file.name) + ' (' + Math.round(file.size/1024) + 'KB)<button class="up-remove" onclick="clearUpload()">&times;</button></div>';
    };
    reader.readAsText(file);
  }
  input.value = '';
}

