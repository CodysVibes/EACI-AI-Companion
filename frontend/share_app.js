// ============================================================
// SHARE APP — native share sheet or social link fallback
// ============================================================
function shareApp() {
  var url = 'https://www.eacicompanion.com/';
  var title = 'EACI Companion — Caelum on The Veil';
  var text = 'Meet Caelum — an emotionally aware AI companion with memory who listens when you need someone.';

  if (navigator.share) {
    navigator.share({ title: title, text: text, url: url }).catch(function(err) {
      if (err && err.name === 'AbortError') return;
      _shareAppFallback(url, title, text);
    });
    return;
  }
  _shareAppFallback(url, title, text);
}

function _shareAppFallback(url, title, text) {
  var existing = document.getElementById('shareAppMenu');
  if (existing) { existing.remove(); return; }

  var encodedUrl = encodeURIComponent(url);
  var encodedText = encodeURIComponent(text + ' ' + url);
  var menu = document.createElement('div');
  menu.id = 'shareAppMenu';
  menu.style.cssText =
    'position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
  menu.innerHTML =
    '<div style="width:min(360px,100%);background:rgba(6,4,0,.98);border:1px solid rgba(255,184,77,.35);border-radius:14px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.65)">' +
      '<div style="font-size:13px;font-weight:700;color:#FFB84D;margin-bottom:12px">Share EACI Companion</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        '<a href="https://twitter.com/intent/tweet?text=' + encodedText + '" target="_blank" rel="noopener" style="flex:1;min-width:120px;text-align:center;padding:10px;background:rgba(29,161,242,.15);border:1px solid rgba(29,161,242,.35);color:#8ed4ff;font-size:12px;font-weight:600;border-radius:8px;text-decoration:none">X / Twitter</a>' +
        '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '" target="_blank" rel="noopener" style="flex:1;min-width:120px;text-align:center;padding:10px;background:rgba(66,103,178,.15);border:1px solid rgba(66,103,178,.35);color:#a8c4ff;font-size:12px;font-weight:600;border-radius:8px;text-decoration:none">Facebook</a>' +
        '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl + '" target="_blank" rel="noopener" style="flex:1;min-width:120px;text-align:center;padding:10px;background:rgba(10,102,194,.15);border:1px solid rgba(10,102,194,.35);color:#8ed4ff;font-size:12px;font-weight:600;border-radius:8px;text-decoration:none">LinkedIn</a>' +
        '<a href="https://reddit.com/submit?url=' + encodedUrl + '&title=' + encodeURIComponent(title) + '" target="_blank" rel="noopener" style="flex:1;min-width:120px;text-align:center;padding:10px;background:rgba(255,69,0,.12);border:1px solid rgba(255,69,0,.35);color:#ffb199;font-size:12px;font-weight:600;border-radius:8px;text-decoration:none">Reddit</a>' +
      '</div>' +
      '<button type="button" id="shareAppCopyBtn" style="width:100%;margin-top:10px;padding:10px;background:rgba(255,184,77,.15);border:1px solid rgba(255,184,77,.35);color:#FFB84D;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer">Copy link</button>' +
      '<button type="button" id="shareAppCloseBtn" style="width:100%;margin-top:8px;padding:8px;background:none;border:none;color:#8ba8a0;font-size:12px;cursor:pointer">Close</button>' +
    '</div>';

  document.body.appendChild(menu);
  menu.addEventListener('click', function(e) {
    if (e.target === menu) menu.remove();
  });
  document.getElementById('shareAppCloseBtn').addEventListener('click', function() { menu.remove(); });
  document.getElementById('shareAppCopyBtn').addEventListener('click', function() {
    var done = function() {
      if (typeof addSystemMessage === 'function') addSystemMessage('Link copied — share it anywhere you like.');
      menu.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function() {
        _shareAppCopyLegacy(url);
        done();
      });
    } else {
      _shareAppCopyLegacy(url);
      done();
    }
  });
}

function _shareAppCopyLegacy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}
