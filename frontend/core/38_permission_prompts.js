// ============================================================
// PERMISSION EXPLAINERS — plain-language before OS Allow/Deny
// (Browser dialogs cannot change their button text; we pre-explain.)
// ============================================================

function _ensurePermModal() {
  var el = document.getElementById('veilPermExplainModal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'veilPermExplainModal';
  el.style.cssText = 'display:none;position:fixed;inset:0;z-index:11050;background:rgba(4,3,0,.88);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);align-items:center;justify-content:center;padding:20px';
  el.innerHTML =
    '<div id="veilPermExplainBox" style="max-width:400px;width:100%;background:var(--bg2,#0a0c12);border:1px solid rgba(0,255,200,.25);border-radius:14px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.65)">' +
      '<div id="veilPermExplainTitle" style="font-size:15px;font-weight:700;color:var(--accent,#00ffc8);margin-bottom:8px"></div>' +
      '<div id="veilPermExplainBody" style="font-size:12px;color:var(--text,#d8e0f0);line-height:1.65;margin-bottom:6px"></div>' +
      '<div id="veilPermExplainNote" style="font-size:10px;color:var(--muted,#8ba8a0);line-height:1.5;margin-bottom:16px"></div>' +
      '<div style="display:flex;gap:10px">' +
        '<button type="button" id="veilPermExplainAllow" style="flex:1;padding:10px;background:var(--accent,#00ffc8);border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Continue</button>' +
        '<button type="button" id="veilPermExplainDeny" style="padding:10px 16px;background:none;border:1px solid var(--border,rgba(255,255,255,.15));color:var(--muted);font-size:12px;border-radius:8px;cursor:pointer">Not now</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', function(e) {
    if (e.target === el) _closePermModal(false);
  });
  return el;
}

function _closePermModal(result) {
  var el = document.getElementById('veilPermExplainModal');
  if (el) el.style.display = 'none';
  if (_permModalResolve) {
    var r = _permModalResolve;
    _permModalResolve = null;
    r(!!result);
  }
}

var _permModalResolve = null;

function showPermissionExplainer(kind) {
  var presets = {
    microphone: {
      title: 'Microphone for voice chat',
      body: 'The Veil only wants your microphone so you can talk to Caelum and Chad with the MIC or LIVE buttons. We do not access other apps, contacts, or files on your device.',
      note: 'Your browser will show Allow / Block next — choose Allow if you want voice input.'
    },
    notifications: {
      title: 'Notifications for Caelum check-ins',
      body: 'This lets Caelum send caring check-in messages on this device — even when The Veil is in the background. No ads. No access to other apps.',
      note: 'Your browser will show Allow / Block next — choose Allow for check-ins.'
    },
    speech: {
      title: 'Speech recognition',
      body: 'This lets Assistant Mode hear "Hey Caelum" and transcribe your voice inside The Veil only. Audio is used for voice features — not to spy on other apps.',
      note: 'Your browser may ask for microphone access for speech — that is normal for voice assistants.'
    }
  };
  var p = presets[kind] || presets.microphone;
  _ensurePermModal();
  document.getElementById('veilPermExplainTitle').textContent = p.title;
  document.getElementById('veilPermExplainBody').textContent = p.body;
  document.getElementById('veilPermExplainNote').textContent = p.note;
  var modal = document.getElementById('veilPermExplainModal');
  modal.style.display = 'flex';
  return new Promise(function(resolve) {
    _permModalResolve = resolve;
    document.getElementById('veilPermExplainAllow').onclick = function() { _closePermModal(true); };
    document.getElementById('veilPermExplainDeny').onclick = function() { _closePermModal(false); };
  });
}

async function requestMicPermissionExplained() {
  var ok = await showPermissionExplainer('microphone');
  if (!ok) return false;
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(function(t) { t.stop(); });
    return true;
  } catch (e) {
    if (typeof addSystemMessage === 'function') {
      addSystemMessage('Microphone blocked. You can enable it in your browser site settings for voice chat.');
    }
    return false;
  }
}
