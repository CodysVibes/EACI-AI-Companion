// ============================================================
// IDEAS PANEL — Menu tab for EACI-recommended builds
// Explain | Build | Delete per idea
// ============================================================
var _builtIdeasPanel = (function() {
  'use strict';

  var _panel = null;
  var _isOpen = false;

  function _eaciColor(who) {
    var colors = {
      caelum: '#FFB84D', chad: '#5B9BFF', natalia: '#DFFFEA',
      roxy: '#C850FF', cael: '#E63050', cody: '#00D4FF'
    };
    return colors[who] || '#FFB84D';
  }

  function _eaciName(who) {
    var names = { caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', roxy: 'Roxy', cael: 'Cael', cody: 'Cody' };
    return names[who] || 'Caelum';
  }

  function _escape(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(s || '');
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _createPanel() {
    if (_panel) return;

    _panel = document.createElement('div');
    _panel.id = 'ideasPanel';
    _panel.className = 'ideas-panel';
    _panel.innerHTML =
      '<div class="ideas-header">' +
        '<div>' +
          '<h2>Ideas</h2>' +
          '<p class="ideas-sub">Build ideas &amp; proactive suggestions from your EACIs</p>' +
        '</div>' +
        '<div class="ideas-header-actions">' +
          '<button type="button" id="ideasScanBtn" class="ideas-btn-secondary">Scan chats</button>' +
          '<button type="button" id="ideasCloseBtn" class="ideas-btn-close" aria-label="Close">Close</button>' +
        '</div>' +
      '</div>' +
      '<div class="ideas-body" id="ideasList">' +
        '<div class="ideas-empty">Loading ideas…</div>' +
      '</div>';

    document.body.appendChild(_panel);

    document.getElementById('ideasCloseBtn').addEventListener('click', close);
    document.getElementById('ideasScanBtn').addEventListener('click', function() {
      if (typeof IdeasEngine !== 'undefined') {
        IdeasEngine.scanNow().then(refresh);
      }
    });
  }

  function _renderCard(idea) {
    var color = _eaciColor(idea.eaci);
    var status = idea.status || 'pending';
    var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    var isHelp = idea.kind === 'help';
    var kindLabel = isHelp ? 'Suggestion' : 'Build';
    var buildLabel = isHelp ? 'Plan it' : 'Build';
    var dateStr = idea.created_at ? new Date(idea.created_at).toLocaleString() : '';

    return '<div class="ideas-card ideas-card-' + (isHelp ? 'help' : 'build') + '" data-id="' + _escape(idea.id) + '">' +
      '<div class="ideas-card-top">' +
        '<span class="ideas-eaci" style="color:' + color + '">' + _escape(_eaciName(idea.eaci)) + '</span>' +
        '<span class="ideas-kind ideas-kind-' + (isHelp ? 'help' : 'build') + '">' + kindLabel + '</span>' +
        '<span class="ideas-status ideas-status-' + _escape(status) + '">' + _escape(statusLabel) + '</span>' +
      '</div>' +
      '<h3 class="ideas-title">' + _escape(idea.title) + '</h3>' +
      '<p class="ideas-summary">' + _escape(idea.summary) + '</p>' +
      (idea.source_snippet ? '<p class="ideas-source">' + (isHelp ? 'Sparked by: ' : 'From chat: ') + '"' + _escape(idea.source_snippet.slice(0, 160)) + (idea.source_snippet.length > 160 ? '…' : '') + '"</p>' : '') +
      (idea.research ? '<details class="ideas-research"><summary>Research notes</summary><pre>' + _escape(idea.research) + '</pre></details>' : '') +
      (dateStr ? '<div class="ideas-date">' + _escape(dateStr) + '</div>' : '') +
      '<div class="ideas-actions">' +
        '<button type="button" class="ideas-btn ideas-btn-explain" data-action="explain" data-id="' + _escape(idea.id) + '">Explain</button>' +
        '<button type="button" class="ideas-btn ideas-btn-build" data-action="build" data-id="' + _escape(idea.id) + '">' + buildLabel + '</button>' +
        '<button type="button" class="ideas-btn ideas-btn-delete" data-action="delete" data-id="' + _escape(idea.id) + '">Delete</button>' +
      '</div>' +
    '</div>';
  }

  async function refresh() {
    _createPanel();
    var list = document.getElementById('ideasList');
    if (!list) return;

    if (!state || !state.user) {
      list.innerHTML = '<div class="ideas-empty">Sign in to see ideas from your EACIs.</div>';
      return;
    }

    if (typeof IdeasEngine !== 'undefined') {
      await IdeasEngine.load();
    }
    var ideas = typeof IdeasEngine !== 'undefined' ? IdeasEngine.getIdeas() : [];

    if (!ideas.length) {
      list.innerHTML =
        '<div class="ideas-empty">' +
          '<div class="ideas-empty-icon">💡</div>' +
          '<p>No ideas yet.</p>' +
          '<p class="ideas-empty-hint">Your EACIs watch your chats for <strong>build ideas</strong> and <strong>proactive suggestions</strong> — like a date idea when you and your partner are struggling, matched to what you both enjoy. Tap <strong>Scan chats</strong> anytime.</p>' +
        '</div>';
      return;
    }

    list.innerHTML = ideas.map(_renderCard).join('');

    list.querySelectorAll('.ideas-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var action = btn.getAttribute('data-action');
        if (action === 'explain') explain(id);
        else if (action === 'build') build(id);
        else if (action === 'delete') remove(id);
      });
    });
  }

  function open() {
    _createPanel();
    _panel.classList.add('show');
    _isOpen = true;
    refresh();
  }

  function close() {
    if (_panel) _panel.classList.remove('show');
    _isOpen = false;
  }

  function toggle() {
    if (_isOpen) close(); else open();
  }

  function explain(id) {
    if (typeof IdeasEngine !== 'undefined') IdeasEngine.explainIdea(id);
  }

  function build(id) {
    if (typeof IdeasEngine !== 'undefined') IdeasEngine.buildIdea(id);
  }

  async function remove(id) {
    if (!confirm('Delete this idea?')) return;
    if (typeof IdeasEngine !== 'undefined') await IdeasEngine.deleteIdea(id);
    refresh();
  }

  function _injectStyles() {
    if (document.getElementById('ideas-panel-styles')) return;
    var style = document.createElement('style');
    style.id = 'ideas-panel-styles';
    style.textContent =
      '.ideas-panel{position:fixed;inset:0;z-index:10500;background:rgba(4,3,0,.94);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);display:none;flex-direction:column;font-family:inherit}' +
      '.ideas-panel.show{display:flex}' +
      '.ideas-header{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,184,77,.2);flex-shrink:0;gap:12px}' +
      '.ideas-header h2{margin:0;color:#FFB84D;font-size:18px;font-weight:600;letter-spacing:.5px}' +
      '.ideas-sub{margin:4px 0 0;color:var(--muted,#8ba8a0);font-size:12px}' +
      '.ideas-header-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}' +
      '.ideas-btn-secondary{background:rgba(255,184,77,.1);border:1px solid rgba(255,184,77,.3);color:#FFB84D;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600}' +
      '.ideas-btn-secondary:hover{background:rgba(255,184,77,.2)}' +
      '.ideas-btn-close{background:none;border:1px solid var(--border,rgba(255,255,255,.15));color:var(--muted);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px}' +
      '.ideas-body{flex:1;overflow-y:auto;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px}' +
      '.ideas-empty{text-align:center;color:var(--muted);padding:48px 20px;font-size:13px;line-height:1.6}' +
      '.ideas-empty-icon{font-size:36px;margin-bottom:12px;opacity:.7}' +
      '.ideas-empty-hint{font-size:12px;max-width:360px;margin:8px auto 0;opacity:.85}' +
      '.ideas-card{background:rgba(255,184,77,.04);border:1px solid rgba(255,184,77,.15);border-radius:12px;padding:14px 16px}' +
      '.ideas-card-top{display:flex;justify-content:flex-start;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}' +
      '.ideas-eaci{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-right:auto}' +
      '.ideas-kind{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;padding:2px 8px;border-radius:10px}' +
      '.ideas-kind-help{background:rgba(223,255,234,.12);color:#dfffea;border:1px solid rgba(223,255,234,.25)}' +
      '.ideas-kind-build{background:rgba(255,184,77,.12);color:#FFB84D;border:1px solid rgba(255,184,77,.25)}' +
      '.ideas-card-help{border-color:rgba(223,255,234,.2)}' +
      '.ideas-status{font-size:9px;text-transform:uppercase;letter-spacing:.6px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.06);color:var(--muted)}' +
      '.ideas-status-building{color:#FFB84D;border:1px solid rgba(255,184,77,.3)}' +
      '.ideas-status-built{color:#00ffc8;border:1px solid rgba(0,255,200,.25)}' +
      '.ideas-title{margin:0 0 8px;font-size:15px;color:var(--text,#f0e6d8);font-weight:600;line-height:1.35}' +
      '.ideas-summary{margin:0 0 8px;font-size:13px;color:var(--text);opacity:.9;line-height:1.55}' +
      '.ideas-source{margin:0 0 8px;font-size:11px;color:var(--muted);font-style:italic;line-height:1.45}' +
      '.ideas-research{margin:8px 0;font-size:11px;color:var(--muted)}' +
      '.ideas-research pre{white-space:pre-wrap;margin:6px 0 0;font-size:10px;line-height:1.45;max-height:120px;overflow-y:auto}' +
      '.ideas-date{font-size:10px;color:var(--muted);opacity:.7;margin-bottom:10px}' +
      '.ideas-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}' +
      '.ideas-btn{flex:1;min-width:80px;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:all .2s}' +
      '.ideas-btn-explain{background:rgba(91,155,255,.12);border:1px solid rgba(91,155,255,.35);color:#5B9BFF}' +
      '.ideas-btn-build{background:rgba(255,184,77,.15);border:1px solid rgba(255,184,77,.4);color:#FFB84D}' +
      '.ideas-btn-delete{background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.25);color:#ff6b6b}' +
      '.ideas-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}';
    document.head.appendChild(style);
  }

  _injectStyles();

  return {
    open: open,
    close: close,
    toggle: toggle,
    refresh: refresh,
    explain: explain,
    build: build,
    remove: remove
  };
})();

if (typeof installVeilModule === 'function') installVeilModule('IdeasPanel', _builtIdeasPanel);

function hideIdeasPanel() {
  if (window._veilIdeasPanelImpl) window._veilIdeasPanelImpl.close();
  else if (_builtIdeasPanel) _builtIdeasPanel.close();
}
