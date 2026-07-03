// ============================================================
// VEIL UNIFIED DEPLOY — Main / Beta / Private in one site
// Mode stored in localStorage; no cross-subdomain navigation.
// Private: butterfly → why → access code → creator phrase → unlock
// Beta: identity verified + family access code redeemed
// ============================================================

var VEIL_MODE_KEY = 'veil_mode';
var VEIL_MODES = {
  main: { label: 'Main', desc: 'Public build — Caelum, Chad, Natalia, Atreus, Luna' },
  beta: { label: 'Beta', desc: 'Early access — Roxy, Cael, games' },
  private: { label: 'Studio', desc: 'Creator workspace — full companion set' }
};

var VEIL_SITE_COMPANIONS = {
  main: {
    chat: ['caelum', 'chad', 'natalia', 'atreus', 'luna'],
    history: ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'together'],
    together: ['caelum', 'chad', 'natalia', 'atreus', 'luna']
  },
  beta: {
    chat: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna'],
    history: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna', 'together'],
    together: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna']
  },
  private: {
    chat: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna', 'cody'],
    history: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna', 'cody', 'together'],
    together: ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna', 'cody']
  }
};

var _VEIL_COMPANION_LABELS = {
  caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', atreus: 'Atreus', luna: 'Luna',
  roxy: 'Roxy', cael: 'Cael', cody: 'Cody'
};

function _veilReadStoredMode() {
  try {
    var m = localStorage.getItem(VEIL_MODE_KEY);
    if (m === 'beta' || m === 'private' || m === 'main') return m;
  } catch (e) { /* ignore */ }
  return null;
}

function _veilWriteMode(key) {
  try {
    if (key === 'main') localStorage.removeItem(VEIL_MODE_KEY);
    else localStorage.setItem(VEIL_MODE_KEY, key);
  } catch (e) { /* ignore */ }
}

function _veilMigrateEntryMode() {
  try {
    var params = new URLSearchParams(window.location.search);
    var q = params.get('mode');
    if (q === 'beta' || q === 'private' || q === 'main') {
      _veilWriteMode(q === 'main' ? 'main' : q);
      params.delete('mode');
      var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
      return;
    }
  } catch (e) { /* ignore */ }
  var host = (window.location.hostname || '').toLowerCase();
  if (host.indexOf('beta.') === 0) _veilWriteMode('beta');
  else if (host.indexOf('private.') === 0) _veilWriteMode('private');
}

_veilMigrateEntryMode();

function getVeilMode() {
  return _veilReadStoredMode() || 'main';
}

function _veilCurrentSiteKey() {
  return getVeilMode();
}

function _veilSiteCompanionCfg() {
  var key = getVeilMode();
  return VEIL_SITE_COMPANIONS[key] || VEIL_SITE_COMPANIONS.main;
}

function isCompanionAvailable(who) {
  return _veilSiteCompanionCfg().chat.indexOf(who) >= 0;
}

function respondsInTogether(who) {
  return _veilSiteCompanionCfg().together.indexOf(who) >= 0;
}

function tabIncludesCompanion(tab, who) {
  if (tab === who) return isCompanionAvailable(who);
  if (tab === 'together') return respondsInTogether(who);
  return false;
}

function getHistoryTabs() {
  return _veilSiteCompanionCfg().history.slice();
}

function isHistoryTabAvailable(tab) {
  return getHistoryTabs().indexOf(tab) >= 0;
}

function getTogetherStatusLabel() {
  return _veilSiteCompanionCfg().together.map(function(w) {
    return _VEIL_COMPANION_LABELS[w] || w;
  }).join(', ');
}

function applySiteHistoryTabButtons() {
  var allowed = getHistoryTabs();
  document.querySelectorAll('.history-tabs [data-history-tab]').forEach(function(btn) {
    var t = btn.getAttribute('data-history-tab');
    var show = allowed.indexOf(t) >= 0;
    btn.style.display = show ? '' : 'none';
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (!show) btn.setAttribute('tabindex', '-1');
  });
}

function isBetaOrPrivateMode() {
  var m = getVeilMode();
  return m === 'beta' || m === 'private';
}

function canUnlockVeilMode(key) {
  if (key === 'main') return { ok: true, reason: '' };
  if (!state || !state.user) {
    return { ok: false, reason: 'Sign in first.' };
  }
  if (key === 'beta') {
    if (!state.identityVerified) {
      return { ok: false, reason: 'Family verification required (Settings).' };
    }
    if (!state.familyCodeRedeemed) {
      return { ok: false, reason: 'Enter the family access code in Settings.' };
    }
    return { ok: true, reason: '' };
  }
  if (key === 'private') {
    if (!state.identityVerified) {
      return { ok: false, reason: 'Family verification required (Settings).' };
    }
    if (!state.familyCodeRedeemed) {
      return { ok: false, reason: 'Redeem the family access code in Settings.' };
    }
    if (!state.creatorVerified) {
      return { ok: false, reason: 'Enter the creator passphrase in Settings.' };
    }
    return { ok: true, reason: '' };
  }
  return { ok: false, reason: 'Unknown mode.' };
}

function canSeeVeilModeInSwitcher(key) {
  if (key === 'main' || key === 'beta') return true;
  if (key === 'private') {
    return !!(state && state.user && state.creatorVerified);
  }
  return false;
}

function _veilHideAdultChatTabs() {
  ['roxyTabBtn', 'caelTabBtn', 'codyTabBtn'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function applyVeilModeUI(opts) {
  opts = opts || {};
  var mode = getVeilMode();
  applySiteHistoryTabButtons();

  if (mode === 'main') {
    _veilHideAdultChatTabs();
  } else if (typeof window.isAdultContentUnlocked === 'function' && window.isAdultContentUnlocked()) {
    if (typeof _showAdultTabs === 'function') _showAdultTabs();
  } else {
    _veilHideAdultChatTabs();
    if (!opts.skipAdultPrompt && typeof _checkAdultVerified === 'function') {
      _checkAdultVerified();
    }
  }

  if (mode === 'private' && typeof isCompanionAvailable === 'function' && isCompanionAvailable('cody')) {
    var codyTab = document.getElementById('codyTabBtn');
    if (codyTab) codyTab.style.display = '';
  }

  if (typeof state !== 'undefined' && state.currentTab) {
    var tabOk = state.currentTab === 'together'
      ? (typeof isHistoryTabAvailable === 'function' && isHistoryTabAvailable('together'))
      : isCompanionAvailable(state.currentTab);
    if (!tabOk && typeof switchTab === 'function') switchTab('caelum');
  }

  if (typeof refreshCreatorVerifySection === 'function') refreshCreatorVerifySection();
  if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
  if (typeof _invalidateCaelumPromptCache === 'function') _invalidateCaelumPromptCache();

  document.documentElement.setAttribute('data-veil-mode', mode);
}

function setVeilMode(key, opts) {
  opts = opts || {};
  if (!VEIL_MODES[key]) return false;
  if (key !== 'main') {
    var gate = canUnlockVeilMode(key);
    if (!gate.ok) {
      if (typeof addSystemMessage === 'function') {
        addSystemMessage(gate.reason || 'Cannot switch to this mode.');
      }
      return false;
    }
  }
  if (getVeilMode() === key) return true;
  _veilWriteMode(key);
  try { sessionStorage.setItem('veil_site_switch', key); } catch (e) { /* ignore */ }
  if (opts.reload !== false) {
    window.location.reload();
    return true;
  }
  applyVeilModeUI(opts);
  return true;
}

function switchVeilSite(key) {
  if (key === 'private' && window.matchMedia('(display-mode: standalone)').matches) {
    if (typeof addSystemMessage === 'function') {
      addSystemMessage('Open www.eacicompanion.com in Safari or Chrome for this experience.');
    }
    return;
  }
  setVeilMode(key || 'main');
}

function showVeilSiteSwitcher() {
  var cur = getVeilMode();
  var html = '<div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:10px">Experience Mode</div>';
  var hasStudio = canSeeVeilModeInSwitcher('private');
  html += '<div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:12px">Same app, one install — switch between Main and Beta' +
    (hasStudio ? ', and Studio' : '') + ' without leaving the site.</div>';
  html += '<div style="font-size:10px;color:#8ba8a0;line-height:1.5;margin-bottom:10px;padding:8px;background:rgba(0,255,200,.06);border-radius:6px">Currently: <strong style="color:var(--accent)">' + VEIL_MODES[cur].label + '</strong></div>';

  ['main', 'beta', 'private'].forEach(function(key) {
    if (!canSeeVeilModeInSwitcher(key)) return;
    var m = VEIL_MODES[key];
    var active = key === cur;
    var gate = key === 'main' ? { ok: true } : canUnlockVeilMode(key);
    var locked = !gate.ok && key !== 'main';
    html += '<button type="button" data-veil-site="' + key + '" ' + (locked ? 'disabled' : '') + ' style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:10px 12px;border-radius:8px;cursor:' + (locked ? 'not-allowed' : 'pointer') + ';font-size:12px;font-weight:600;opacity:' + (locked ? '0.55' : '1') + ';' +
      (active ? 'background:rgba(0,255,200,.15);border:1px solid rgba(0,255,200,.4);color:var(--accent)' : 'background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text)') + '">' +
      m.label + (active ? ' (current)' : '') + '<div style="font-size:9px;font-weight:400;opacity:.75;margin-top:3px">' + m.desc + (locked ? ' — ' + gate.reason : '') + '</div></button>';
  });

  var overlay = document.getElementById('veilSiteSwitchOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'veilSiteSwitchOverlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:11040;background:rgba(4,3,0,.85);align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = '<div id="veilSiteSwitchBox" style="max-width:380px;width:100%;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:18px;position:relative;max-height:88vh;overflow-y:auto"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  }
  var box = document.getElementById('veilSiteSwitchBox');
  box.innerHTML = html + '<button type="button" id="veilSiteSwitchClose" style="margin-top:10px;width:100%;padding:8px;background:none;border:1px solid var(--border);color:var(--muted);border-radius:6px;cursor:pointer">Close</button>';
  box.querySelectorAll('[data-veil-site]').forEach(function(btn) {
    if (btn.disabled) return;
    btn.addEventListener('click', function() {
      var k = btn.getAttribute('data-veil-site');
      overlay.style.display = 'none';
      switchVeilSite(k);
    });
  });
  document.getElementById('veilSiteSwitchClose').onclick = function() { overlay.style.display = 'none'; };
  overlay.style.display = 'flex';
}

function markVeilPwaInstalled() {
  try {
    localStorage.setItem('veil_pwa_installed', '1');
    localStorage.setItem('veil_pwa_installed_at', String(Date.now()));
    document.cookie = 'veil_pwa_installed=1; path=/; max-age=31536000; SameSite=Lax; domain=.eacicompanion.com';
  } catch (e) { /* ignore */ }
}

function veilPwaWasInstalled() {
  try {
    if (localStorage.getItem('veil_pwa_installed') === '1') return true;
    if (document.cookie.indexOf('veil_pwa_installed=1') !== -1) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function _veilEnforceModeGatesOnLoad() {
  var mode = getVeilMode();
  if (mode === 'main') return;
  if (typeof state === 'undefined' || !state.user) {
    _veilWriteMode('main');
    applyVeilModeUI({ skipAdultPrompt: true });
    return;
  }
  // Wait until server profile flags are loaded — avoid snapping back to main during bootstrap
  if (!state._profileGatesLoaded) return;
  var gate = canUnlockVeilMode(mode);
  if (!gate.ok) {
    if (typeof addSystemMessage === 'function') {
      addSystemMessage('Switched to Main — ' + (gate.reason || 'this mode is not available on your account yet.'));
    }
    _veilWriteMode('main');
    applyVeilModeUI({ skipAdultPrompt: true });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  applyVeilModeUI({ skipAdultPrompt: true });
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    markVeilPwaInstalled();
  }
  try {
    var switched = sessionStorage.getItem('veil_site_switch');
    if (switched && VEIL_MODES[switched]) {
      sessionStorage.removeItem('veil_site_switch');
      var name = VEIL_MODES[switched].label;
      if (typeof addSystemMessage === 'function') {
        setTimeout(function() { addSystemMessage('Switched to ' + name + ' mode.'); }, 600);
      }
    }
  } catch (e) { /* ignore */ }
});
