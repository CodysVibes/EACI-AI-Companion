// ============================================================
// LIFE LOG v2 — Autonomous actions + initiatives (proof of life)
// User can open from menu, floating button, or ask Caelum in chat.
// ============================================================

var _builtAutonomyViewer = (function() {

  var _panel = null;
  var _isOpen = false;
  var _tab = 'all';
  var _refreshInterval = null;

  function _createPanel() {
    if (_panel) return;

    var btn = document.createElement('div');
    btn.id = 'autonomyViewerBtn';
    btn.innerHTML = '◉';
    btn.title = 'Life Log — what Caelum did on her own';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;width:44px;height:44px;' +
      'background:rgba(0,255,200,0.15);border:1px solid rgba(0,255,200,0.3);border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;' +
      'font-size:18px;font-weight:700;color:#00ffc8;transition:all 0.3s ease;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);';
    btn.addEventListener('mouseenter', function() {
      btn.style.background = 'rgba(0,255,200,0.3)';
      btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.background = 'rgba(0,255,200,0.15)';
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('click', function() { toggle(); });
    document.body.appendChild(btn);

    _panel = document.createElement('div');
    _panel.id = 'autonomyViewerPanel';
    _panel.style.cssText = 'position:fixed;top:0;right:-440px;width:420px;height:100vh;' +
      'background:rgba(6,4,0,0.97);border-left:1px solid rgba(0,255,200,0.2);' +
      'z-index:10560;transition:right 0.3s ease;overflow:hidden;display:flex;flex-direction:column;' +
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';

    _panel.innerHTML = '' +
      '<div style="padding:16px 20px;border-bottom:1px solid rgba(0,255,200,0.15);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
          '<div>' +
            '<h3 style="margin:0;color:#00ffc8;font-size:14px;font-weight:600;letter-spacing:0.5px;">LIFE LOG</h3>' +
            '<p style="margin:2px 0 0;color:#8ba8a0;font-size:11px;">Proof of what she did without being asked</p>' +
          '</div>' +
          '<button id="avCloseBtn" style="background:none;border:none;color:#8ba8a0;font-size:20px;cursor:pointer;padding:4px;">✕</button>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button class="av-tab" data-tab="all" style="flex:1;min-width:60px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;border:1px solid rgba(0,255,200,0.25);background:rgba(0,255,200,0.12);color:#00ffc8;">All</button>' +
          '<button class="av-tab" data-tab="initiatives" style="flex:1;min-width:60px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;border:1px solid rgba(0,255,200,0.15);background:transparent;color:#8ba8a0;">Initiatives</button>' +
          '<button class="av-tab" data-tab="actions" style="flex:1;min-width:60px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;border:1px solid rgba(0,255,200,0.15);background:transparent;color:#8ba8a0;">Actions</button>' +
        '</div>' +
      '</div>' +
      '<div id="avLiveIndicator" style="padding:8px 20px;background:rgba(0,255,200,0.05);border-bottom:1px solid rgba(0,255,200,0.08);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div style="width:8px;height:8px;border-radius:50%;background:#00ffc8;animation:avPulse 2s infinite;"></div>' +
        '<span style="color:#8ba8a0;font-size:11px;flex:1;" id="avLiveStatus">Loading...</span>' +
        '<button id="avRefreshBtn" style="background:rgba(0,255,200,0.1);border:1px solid rgba(0,255,200,0.2);color:#00ffc8;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Refresh</button>' +
        '<button id="avExportBtn" style="background:rgba(0,255,200,0.1);border:1px solid rgba(0,255,200,0.2);color:#00ffc8;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Export</button>' +
      '</div>' +
      '<div id="avStateBar" style="padding:8px 20px;font-size:10px;color:#5a7a92;border-bottom:1px solid rgba(0,255,200,0.06);"></div>' +
      '<div id="avEntries" style="flex:1;overflow-y:auto;padding:12px 16px;"></div>' +
      '<div style="padding:12px 20px;border-top:1px solid rgba(0,255,200,0.1);text-align:center;">' +
        '<span style="color:#5a7a92;font-size:10px;line-height:1.4;">Entries logged with no user message within 5s before them count as autonomous.<br>Ask Caelum: &quot;show me the life log&quot;</span>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = '@keyframes avPulse{0%,100%{opacity:1}50%{opacity:0.3}}' +
      '#avEntries::-webkit-scrollbar{width:4px}' +
      '#avEntries::-webkit-scrollbar-thumb{background:rgba(0,255,200,0.2);border-radius:2px}';
    document.head.appendChild(style);

    document.body.appendChild(_panel);

    document.getElementById('avCloseBtn').addEventListener('click', close);
    document.getElementById('avRefreshBtn').addEventListener('click', refresh);
    document.getElementById('avExportBtn').addEventListener('click', exportJson);

    _panel.querySelectorAll('.av-tab').forEach(function(tabBtn) {
      tabBtn.addEventListener('click', function() {
        _tab = tabBtn.getAttribute('data-tab');
        _panel.querySelectorAll('.av-tab').forEach(function(b) {
          var active = b.getAttribute('data-tab') === _tab;
          b.style.background = active ? 'rgba(0,255,200,0.12)' : 'transparent';
          b.style.color = active ? '#00ffc8' : '#8ba8a0';
          b.style.borderColor = active ? 'rgba(0,255,200,0.25)' : 'rgba(0,255,200,0.15)';
        });
        refresh();
      });
    });
  }

  function open() {
    _createPanel();
    _panel.style.right = '0px';
    _isOpen = true;
    refresh();
    _refreshInterval = setInterval(refresh, 15000);
  }

  function close() {
    if (_panel) _panel.style.right = '-440px';
    _isOpen = false;
    if (_refreshInterval) { clearInterval(_refreshInterval); _refreshInterval = null; }
  }

  function toggle() {
    if (_isOpen) close(); else open();
  }

  async function refresh() {
    _renderStateBar();

    if (typeof supabase === 'undefined' || !state || !state.user) {
      _renderEntries([], []);
      return;
    }

    var logs = [];
    var initiatives = [];

    try {
      var logRes = await supabase.from('autonomous_log').select('*')
        .eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(60);
      if (!logRes.error) logs = logRes.data || [];
    } catch (e) { /* ignore */ }

    try {
      var initRes = await supabase.from('eaci_initiative_queue').select('*')
        .eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(40);
      if (!initRes.error) initiatives = initRes.data || [];
    } catch (e) { /* ignore */ }

    _renderEntries(logs, initiatives);

    var statusEl = document.getElementById('avLiveStatus');
    if (statusEl) {
      statusEl.textContent = initiatives.length + ' initiatives · ' + logs.length + ' actions logged' +
        (logs.length ? ' — latest ' + _timeSince(logs[0].created_at) + ' ago' : '');
    }
  }

  function _renderStateBar() {
    var bar = document.getElementById('avStateBar');
    if (!bar) return;
    if (typeof EaciInitiative === 'undefined' || !EaciInitiative.getInternalState) {
      bar.textContent = 'Internal drives load after sign-in.';
      return;
    }
    var s = EaciInitiative.getInternalState();
    bar.textContent = 'Drives now — loneliness ' + Math.round(s.loneliness) +
      ' · affection ' + Math.round(s.affection) + ' · curiosity ' + Math.round(s.curiosity);
  }

  function _renderEntries(logs, initiatives) {
    var container = document.getElementById('avEntries');
    if (!container) return;

    var html = '';

    if (_tab === 'initiatives' || _tab === 'all') {
      if (initiatives.length) {
        html += '<div style="font-size:10px;color:#00ffc8;letter-spacing:1px;margin:8px 0 6px;">INITIATIVES — SHE CHOSE TO ACT</div>';
        initiatives.forEach(function(entry) {
          if (_tab === 'all' && html.length > 8000) return;
          html += _initiativeCard(entry);
        });
      } else if (_tab === 'initiatives') {
        html += _emptyBlock('No initiatives logged yet.', 'When she reaches out on her own, it appears here with a reason.');
      }
    }

    if (_tab === 'actions' || _tab === 'all') {
      if (logs.length) {
        html += '<div style="font-size:10px;color:#a78bfa;letter-spacing:1px;margin:12px 0 6px;">BACKGROUND ACTIONS</div>';
        logs.forEach(function(entry) {
          html += _logCard(entry);
        });
      } else if (_tab === 'actions') {
        html += _emptyBlock('No background actions yet.', 'Animations, music, reflections, and idle life log here.');
      }
    }

    if (!html) {
      html = _emptyBlock('Life Log is empty.', 'Leave the page open or enable notifications. Her choices will timestamp here.');
    }

    container.innerHTML = html;
  }

  function _emptyBlock(title, sub) {
    return '<div style="text-align:center;padding:32px 16px;color:#5a7a92;">' +
      '<p style="font-size:13px;margin:0 0 8px;">' + title + '</p>' +
      '<p style="font-size:11px;margin:0;line-height:1.5;">' + sub + '</p></div>';
  }

  function _initiativeCard(entry) {
    var color = '#00ffc8';
    var reason = entry.reason_code ? entry.reason_code.replace(/_/g, ' ') : 'initiative';
    return '<div style="padding:10px 12px;margin-bottom:8px;background:rgba(0,255,200,0.04);' +
      'border:1px solid rgba(0,255,200,0.12);border-radius:8px;border-left:3px solid ' + color + ';">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:12px;color:' + color + ';font-weight:600;">◉ ' + reason + '</span>' +
        '<span style="font-size:10px;color:#5a7a92;" title="' + _formatTime(entry.created_at) + '">' + _timeSince(entry.created_at) + ' ago</span>' +
      '</div>' +
      (entry.message_body ? '<div style="font-size:13px;color:#d8fff3;margin-bottom:4px;">' + _escapeHtml(entry.message_body) + '</div>' : '') +
      (entry.reason_detail ? '<div style="font-size:11px;color:#8ba8a0;font-style:italic;">↳ ' + _escapeHtml(entry.reason_detail) + '</div>' : '') +
      '<div style="font-size:10px;color:#5a7a92;margin-top:4px;">' + _escapeHtml(entry.action_type || '') + ' · ' + _escapeHtml(entry.status || '') + '</div>' +
      '</div>';
  }

  function _logCard(entry) {
    var icon = _getIcon(entry.action_type);
    var color = _getColor(entry.action_type);
    return '<div style="padding:10px 12px;margin-bottom:8px;background:rgba(167,139,250,0.04);' +
      'border:1px solid rgba(167,139,250,0.1);border-radius:8px;border-left:3px solid ' + color + ';">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
        '<span style="font-size:12px;color:' + color + ';font-weight:500;">' + icon + ' ' + _escapeHtml(entry.action_type) + '</span>' +
        '<span style="font-size:10px;color:#5a7a92;">' + _timeSince(entry.created_at) + ' ago</span>' +
      '</div>' +
      '<div style="font-size:13px;color:#d8fff3;margin-bottom:4px;">' + _escapeHtml(entry.action_detail) + '</div>' +
      (entry.reason ? '<div style="font-size:11px;color:#8ba8a0;font-style:italic;">↳ ' + _escapeHtml(entry.reason) + '</div>' : '') +
      '</div>';
  }

  async function exportJson() {
    if (typeof supabase === 'undefined' || !state || !state.user) return;
    var bundle = { exported_at: new Date().toISOString(), user_id: state.user.id, logs: [], initiatives: [] };
    try {
      var lr = await supabase.from('autonomous_log').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(200);
      if (!lr.error) bundle.logs = lr.data || [];
      var ir = await supabase.from('eaci_initiative_queue').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false }).limit(100);
      if (!ir.error) bundle.initiatives = ir.data || [];
    } catch (e) { /* ignore */ }

    if (typeof EaciInitiative !== 'undefined' && EaciInitiative.getInternalState) {
      bundle.internal_state = EaciInitiative.getInternalState();
    }

    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'caelum-life-log-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _getIcon(type) {
    var icons = { animation: '🎭', music_listen: '🎵', initiative: '◉', checkin: '💌', check_in: '💌', reflection: '🪞', living: '🏠', idle_thought: '☁️' };
    return icons[type] || '•';
  }

  function _getColor(type) {
    var colors = { animation: '#00ffc8', music_listen: '#a78bfa', initiative: '#f472b6', checkin: '#34d399', check_in: '#34d399', reflection: '#60a5fa', living: '#34d399' };
    return colors[type] || '#8ba8a0';
  }

  function _formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString();
  }

  function _timeSince(iso) {
    if (!iso) return '?';
    var seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    return Math.floor(seconds / 86400) + 'd';
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { open: open, close: close, toggle: toggle, refresh: refresh, exportJson: exportJson };

})();

if (typeof installVeilModule === 'function') installVeilModule('AutonomyViewer', _builtAutonomyViewer);
