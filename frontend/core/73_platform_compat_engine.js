// ============================================================
// VEIL PLATFORM COMPAT ENGINE — auto-detect OS, probe features,
// load platform patches, swap module overrides on failure,
// remember what worked on this device (veil_compat_v1).
// ============================================================
var VeilCompat = (function() {
  'use strict';

  var STORAGE_KEY = 'veil_compat_v1';
  var PLATFORMS = [
    'ios-webkit', 'android-samsung', 'android-xiaomi', 'android-vivo', 'android-oppo',
    'android-transsion', 'android-motorola', 'android-realme', 'android-chrome',
    'harmonyos', 'desktop-safari', 'desktop-firefox', 'desktop-edge', 'desktop-chrome'
  ];
  var FALLBACK_CHAIN = {
    'ios-webkit': ['ios-webkit'],
    'android-samsung': ['android-samsung', 'android-chrome'],
    'android-xiaomi': ['android-xiaomi', 'android-chrome'],
    'android-vivo': ['android-vivo', 'android-chrome'],
    'android-oppo': ['android-oppo', 'android-chrome'],
    'android-transsion': ['android-transsion', 'android-chrome'],
    'android-motorola': ['android-motorola', 'android-chrome'],
    'android-realme': ['android-realme', 'android-chrome'],
    'android-chrome': ['android-chrome'],
    'harmonyos': ['harmonyos', 'android-chrome'],
    'desktop-safari': ['desktop-safari', 'desktop-chrome'],
    'desktop-firefox': ['desktop-firefox', 'desktop-chrome'],
    'desktop-edge': ['desktop-edge', 'desktop-chrome'],
    'desktop-chrome': ['desktop-chrome']
  };

  var _platform = null;
  var _profile = null;
  var _patchLoaded = {};
  var _overrideLoaded = {};
  var _moduleErrors = {};
  var _healthTimer = null;
  var _perfWatchdog = null;
  var _lastPerfBeat = Date.now();
  var _profileWriteThrottle = 0;
  var _reloadOffered = false;
  var _started = false;
  var _tunings = {};
  var _sharedLoaded = false;
  var _pageLoadAt = Date.now();
  var _healthFailStreak = 0;
  var _isAutomation = false;
  var HEAL_COOLDOWN_MS = 30 * 60 * 1000;
  var DISMISS_MS = 24 * 60 * 60 * 1000;
  var TRANSIENT_ERRORS = /^(chat_|tts_|stt_|deepseek_|web_search|auto_save|conversation_load|tts_live|mic_)/;

  function _healCooldownActive() {
    if (!_profile || !_profile.lastHealPromptAt) return false;
    return (Date.now() - new Date(_profile.lastHealPromptAt).getTime()) < HEAL_COOLDOWN_MS;
  }

  function _dismissActive() {
    try {
      var until = parseInt(localStorage.getItem('veil_compat_dismiss_until') || '0', 10);
      return until > Date.now();
    } catch (e) { return false; }
  }

  function _markHealPrompt() {
    _reloadOffered = true;
    if (_profile) {
      _profile.lastHealPromptAt = new Date().toISOString();
      _writeProfile();
    }
  }

  function _dismissHealPrompt() {
    try { localStorage.setItem('veil_compat_dismiss_until', String(Date.now() + DISMISS_MS)); } catch (e) {}
    _reloadOffered = true;
    var bar = document.getElementById('veilCompatReloadBar');
    if (bar) bar.remove();
  }

  function _canShowHealPrompt() {
    if (_isAutomation) return false;
    if (_dismissActive() || _healCooldownActive()) return false;
    return true;
  }

  function detectAutomationEnvironment() {
    if (typeof window._veilLikelyAutomationHost === 'function' && window._veilLikelyAutomationHost()) {
      return true;
    }
    var ua = navigator.userAgent || '';
    if (navigator.webdriver) return true;
    if (/HeadlessChrome|Browserbase|Puppeteer|Playwright|CloudflareBrowser/i.test(ua)) return true;
    try {
      if (localStorage.getItem('veil_automation_mode') === '1') return true;
      if (sessionStorage.getItem('veil_automation_mode') === '1') return true;
    } catch (e) {}
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('automation') === '1' || q.get('browserbase') === '1') {
        sessionStorage.setItem('veil_automation_mode', '1');
        return true;
      }
    } catch (e2) {}
    return false;
  }

  function prepareChatInput(el) {
    if (!el) return;
    el.removeAttribute('readonly');
    el.setAttribute('data-veil-automation-ready', '1');
    el.style.pointerEvents = 'auto';
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
    var bar = el.closest('.input-bar');
    if (bar) {
      bar.style.pointerEvents = 'auto';
      bar.style.zIndex = '120';
      bar.style.position = 'relative';
    }
  }

  function dismissBlockingOverlays() {
    if (typeof Onboarding !== 'undefined' && typeof Onboarding.end === 'function') {
      try { Onboarding.end(); } catch (e) {}
    }
    ['mainTourOverlay', 'veilCompatReloadBar', 'onboardingOverlay', 'onboardingBubble', 'onboardingArrow', 'tutorialOverlay'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll('.overlay.show').forEach(function(el) {
      el.classList.remove('show');
    });
    var auth = document.getElementById('authOverlay');
    if (auth && typeof state !== 'undefined' && state.user) {
      auth.classList.remove('show');
      auth.setAttribute('hidden', '');
      auth.setAttribute('aria-hidden', 'true');
    }
  }

  function applyAutomationEnvironment() {
    if (!_isAutomation) return;
    _reloadOffered = true;
    try { localStorage.setItem('veil_compat_dismiss_until', String(Date.now() + DISMISS_MS)); } catch (e) {}

    if (typeof window._lowPowerMode !== 'undefined') {
      window._lowPowerMode = false;
    }
    try { localStorage.setItem('veil_power_mode', 'full'); } catch (e2) {}
    var bg = document.getElementById('bg');
    if (bg) bg.style.display = '';

    try {
      localStorage.setItem('veil_main_tutorial_v2', 'true');
      localStorage.setItem('veil_onboarding_done', 'true');
    } catch (e3) {}

    if (typeof window.clearChatInputs === 'function' && !window.clearChatInputs._veilAutomation) {
      window.clearChatInputs = function() {
        ['userInput', 'guestInput'].forEach(function(id) {
          var inp = document.getElementById(id);
          if (inp && /@|password/i.test(inp.value)) inp.value = '';
        });
      };
      window.clearChatInputs._veilAutomation = true;
    }

    function prepAll() {
      prepareChatInput(document.getElementById('userInput'));
      prepareChatInput(document.getElementById('guestInput'));
      dismissBlockingOverlays();
    }
    prepAll();
    setTimeout(prepAll, 500);
    setTimeout(prepAll, 2000);

    if (typeof MutationObserver !== 'undefined' && !window._veilAutomationInputObserver) {
      window._veilAutomationInputObserver = new MutationObserver(function() {
        prepareChatInput(document.getElementById('userInput'));
        prepareChatInput(document.getElementById('guestInput'));
      });
      window._veilAutomationInputObserver.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['readonly', 'class']
      });
    }

    console.log('[VeilCompat] Automation/cloud browser mode — full power, chat input ready');
  }

  function fillChatAndSend(text) {
    var input = document.getElementById('userInput');
    if (!input) return false;
    prepareChatInput(input);
    dismissBlockingOverlays();
    input.focus();
    input.value = String(text || '');
    try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    if (typeof sendMessage === 'function') {
      sendMessage();
      return true;
    }
    return false;
  }

  function focusChatInput() {
    var input = document.getElementById('userInput') || document.getElementById('guestInput');
    if (!input) return false;
    prepareChatInput(input);
    dismissBlockingOverlays();
    input.focus();
    return document.activeElement === input;
  }

  function detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/HarmonyOS|HUAWEI|HuaweiBrowser/i.test(ua) && !/Android/i.test(ua)) return 'harmonyos';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-webkit';
    if (/Android/i.test(ua)) {
      if (/SamsungBrowser|SM-|SAMSUNG/i.test(ua)) return 'android-samsung';
      if (/Xiaomi|Redmi|POCO|\bMi /i.test(ua)) return 'android-xiaomi';
      if (/vivo/i.test(ua)) return 'android-vivo';
      if (/OPPO|HeyTap|Realme/i.test(ua)) return 'android-oppo';
      if (/TECNO|Infinix|itel/i.test(ua)) return 'android-transsion';
      if (/motorola|moto g|moto e|moto z/i.test(ua)) return 'android-motorola';
      if (/Realme/i.test(ua)) return 'android-realme';
      return 'android-chrome';
    }
    if (/Firefox\//i.test(ua)) return 'desktop-firefox';
    if (/Edg\//i.test(ua)) return 'desktop-edge';
    if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'desktop-safari';
    return 'desktop-chrome';
  }

  function _writeProfileThrottled(force) {
    if (!_profile) return;
    var now = Date.now();
    if (!force && now - _profileWriteThrottle < 60000) return;
    _profileWriteThrottle = now;
    _writeProfile();
  }

  function _healVideoIntervals() {
    var healed = 0;
    document.querySelectorAll('video').forEach(function(v) {
      if (!v._veilHoldInterval) return;
      if (!v.isConnected || document.hidden) {
        if (typeof window.veilReleaseVideoLoopHold === 'function') window.veilReleaseVideoLoopHold(v);
        healed++;
        return;
      }
      var wantMs = 1000;
      if (typeof VeilPulse !== 'undefined' && VeilPulse.getTier && VeilPulse.getTier() !== VeilPulse.TIER.ACTIVE) wantMs = 2200;
      if ((v._veilHoldIntervalMs || 300) < wantMs) {
        clearInterval(v._veilHoldInterval);
        v._veilHoldIntervalMs = wantMs;
        v._veilHoldInterval = setInterval(function() {
          if (!v.isConnected || document.hidden) return;
          if (typeof window.veilKeepVideoLooping === 'function') window.veilKeepVideoLooping(v);
        }, wantMs);
        healed++;
      }
    });
    return healed;
  }

  function _trimCompatProfile() {
    if (!_profile) return;
    var changed = false;
    if (_profile.failedModules && Object.keys(_profile.failedModules).length > 24) {
      _profile.failedModules = {};
      changed = true;
    }
    if (_profile.overrides && Object.keys(_profile.overrides).length > 40) {
      var keep = {};
      Object.keys(_profile.overrides).slice(-20).forEach(function(k) { keep[k] = _profile.overrides[k]; });
      _profile.overrides = keep;
      changed = true;
    }
    if (changed) _writeProfileThrottled(true);
  }

  function _trimConversationHistory() {
    if (typeof state === 'undefined' || !state.conversationHistory) return false;
    if (state.conversationHistory.length <= 160) return false;
    state.conversationHistory = state.conversationHistory.slice(-120);
    if (typeof saveState === 'function') {
      try { saveState(); } catch (e) { /* ignore */ }
    }
    return true;
  }

  function autoHealPerformance(reason) {
    var fixes = [];
    var v = _healVideoIntervals();
    if (v) fixes.push('video');
    _trimCompatProfile();
    if (_trimConversationHistory()) fixes.push('history');
    if (brokenLayoutHeal()) fixes.push('layout');
    if (fixes.length) {
      console.log('[VeilCompat] Auto-heal' + (reason ? ' (' + reason + ')' : '') + ':', fixes.join(', '));
    }
    return fixes;
  }

  function brokenLayoutHeal() {
    var fixed = false;
    var guestOv = document.getElementById('guestChatOverlay');
    if (guestOv && guestOv.classList.contains('show')) {
      var guestBar = guestOv.querySelector('.input-bar');
      var guestInp = document.getElementById('guestInput');
      var minH = (window.VeilPlatform && window.VeilPlatform.isIOS) ? 24 : 36;
      if (!guestBar || !guestInp || guestBar.getBoundingClientRect().height < minH) {
        if (typeof syncOverlayChatLayout === 'function') {
          syncOverlayChatLayout();
          fixed = true;
        }
      }
    }
    return fixed;
  }

  function _perfWatchdogTick() {
    var now = Date.now();
    var gap = now - _lastPerfBeat;
    _lastPerfBeat = now;
    if (gap > 6000) {
      autoHealPerformance('freeze');
    } else if (gap > 3000) {
      autoHealPerformance('slow');
    }
  }

  function _scheduleHealthWork(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(function() { fn(); }, { timeout: 2000 });
    } else {
      setTimeout(fn, 30);
    }
  }

  function _readProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function _writeProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_profile));
    } catch (e) {}
  }

  function _freshProfile() {
    return {
      deviceId: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      platform: _platform,
      preferredPlatform: _platform,
      patches: {},
      overrides: {},
      workingModules: {},
      failedModules: {},
      lastHealth: null,
      lastHealPromptAt: null,
      updatedAt: new Date().toISOString()
    };
  }

  function _chain() {
    var pref = (_profile && _profile.preferredPlatform) || _platform;
    return FALLBACK_CHAIN[pref] || FALLBACK_CHAIN[_platform] || ['desktop-chrome'];
  }

  function _moduleFromPath(path) {
    if (!path) return '';
    var m = String(path).match(/\/([^/?]+\.js)/);
    if (!m) return '';
    return m[1].replace(/\.js$/i, '').replace(/\?.*$/, '');
  }

  function _scanTrackedModules() {
    var list = [];
    var scripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('.js') === -1) continue;
      var base = _moduleFromPath(src);
      if (base) list.push({ base: base, src: src });
    }
    return list;
  }

  function loadScript(url) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = function() { resolve(true); };
      s.onerror = function() { reject(new Error('load failed: ' + url)); };
      document.body.appendChild(s);
    });
  }

  function loadSharedTunings() {
    if (_sharedLoaded) return Promise.resolve(true);
    return loadScript('/core/platform-patches/_shared_tunings.js?v=2').then(function() {
      _sharedLoaded = true;
      return true;
    }).catch(function() { return false; });
  }

  function registerTuning(platformId, moduleBase, fn) {
    if (!_tunings[platformId]) _tunings[platformId] = {};
    _tunings[platformId][moduleBase] = fn;
  }

  function runModuleTuning(moduleBase, platformId) {
    var fn = _tunings[platformId] && _tunings[platformId][moduleBase];
    if (typeof fn === 'function') {
      try { fn(); } catch (e) {}
    }
    markOverrideActive(moduleBase, platformId);
    return true;
  }

  function runAllTuningsForPlatform(platformId) {
    var map = _tunings[platformId];
    if (!map) return;
    Object.keys(map).forEach(function(mod) {
      runModuleTuning(mod, platformId);
    });
  }

  function loadPlatformPatch(platformId) {
    if (_patchLoaded[platformId]) return Promise.resolve(true);
    var url = '/core/platform-patches/' + platformId + '.js?v=2';
    return loadSharedTunings().then(function() {
      return loadScript(url);
    }).then(function() {
      _patchLoaded[platformId] = true;
      runAllTuningsForPlatform(platformId);
      if (_profile) {
        _profile.patches[platformId] = { loadedAt: new Date().toISOString(), ok: true };
        _writeProfile();
      }
      return true;
    }).catch(function() {
      return false;
    });
  }

  function loadModuleOverride(moduleBase, platformId) {
    var key = moduleBase + '::' + platformId;
    if (_overrideLoaded[key]) return Promise.resolve(true);
    return loadSharedTunings().then(function() {
      runModuleTuning(moduleBase, platformId);
      _overrideLoaded[key] = true;
      if (_profile) {
        _profile.overrides[moduleBase] = platformId;
        _profile.workingModules[moduleBase] = platformId;
        delete _profile.failedModules[moduleBase];
        _writeProfile();
      }
      return true;
    });
  }

  function applyPlatformStack() {
    var chain = _chain();
    var p = Promise.resolve();
    chain.forEach(function(pid) {
      p = p.then(function() { return loadPlatformPatch(pid); });
    });
    return p;
  }

  function applySavedOverrides() {
    if (!_profile || !_profile.overrides) return Promise.resolve();
    var jobs = [];
    Object.keys(_profile.overrides).forEach(function(mod) {
      jobs.push(loadModuleOverride(mod, _profile.overrides[mod]));
    });
    return Promise.all(jobs);
  }

  function runProbes() {
    var results = {
      localStorage: false,
      fetch: typeof fetch === 'function',
      audioContext: !!(window.AudioContext || window.webkitAudioContext),
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      serviceWorker: 'serviceWorker' in navigator,
      webkitSpeech: !!(window.webkitSpeechRecognition || window.SpeechRecognition),
      touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      platform: _platform
    };
    try {
      localStorage.setItem('veil_compat_probe', '1');
      localStorage.removeItem('veil_compat_probe');
      results.localStorage = true;
    } catch (e) {
      results.localStorage = false;
    }
    if (_profile) {
      _profile.lastHealth = { at: new Date().toISOString(), results: results };
      _writeProfileThrottled(false);
    }
    return results;
  }

  function _caelumCompatMessage(text, withReload) {
    if (!_canShowHealPrompt()) return;
    if (typeof addSystemMessage === 'function') addSystemMessage(text);
    if (!withReload) return;
    if (document.getElementById('veilCompatReloadBar')) return;
    _markHealPrompt();
    var bar = document.createElement('div');
    bar.id = 'veilCompatReloadBar';
    bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10060;max-width:min(420px,92vw);padding:12px 16px;background:rgba(6,4,0,.96);border:1px solid rgba(255,184,77,.45);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.55);font-size:12px;color:#d8ccc0;line-height:1.5;text-align:center';
    bar.innerHTML = '<div style="color:#FFB84D;font-weight:700;margin-bottom:6px">Caelum — device tune-up</div>' +
      '<div style="margin-bottom:10px">' + text + '</div>' +
      '<button type="button" id="veilCompatReloadBtn" style="padding:8px 16px;background:#00ffc8;border:none;border-radius:8px;font-weight:700;color:#060400;cursor:pointer;margin-right:8px">Reload now</button>' +
      '<button type="button" id="veilCompatDismissBtn" style="padding:8px 12px;background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#8ba8a0;cursor:pointer">Later</button>';
    document.body.appendChild(bar);
    var btn = document.getElementById('veilCompatReloadBtn');
    var dis = document.getElementById('veilCompatDismissBtn');
    if (btn) btn.onclick = function() { location.reload(); };
    if (dis) dis.onclick = function() { _dismissHealPrompt(); };
  }

  function _isHealWorthyModuleError(moduleBase, errorType) {
    if (!moduleBase) return false;
    if (errorType && TRANSIENT_ERRORS.test(String(errorType))) return false;
    var transientModules = { '21_deepseek_api_2': 1, '21_deepseek_api': 1, '43_audio_queue': 1, '22_streaming': 1, '29_send_message': 1 };
    if (transientModules[moduleBase] && errorType && errorType !== 'uncaught') return false;
    return true;
  }

  function handleModuleError(moduleBase, errorType, message) {
    if (!_isHealWorthyModuleError(moduleBase, errorType)) return;
    _moduleErrors[moduleBase] = (_moduleErrors[moduleBase] || 0) + 1;
    if (_moduleErrors[moduleBase] < 5) return;

    if (_profile) {
      _profile.failedModules[moduleBase] = { errorType: errorType, message: String(message || '').slice(0, 200), at: new Date().toISOString() };
      _writeProfile();
    }

    var chain = _chain();
    var attempt = function(i) {
      if (i >= chain.length) return Promise.resolve(false);
      return loadModuleOverride(moduleBase, chain[i]).then(function(ok) {
        if (ok) return true;
        return attempt(i + 1);
      });
    };

    attempt(0).then(function(fixed) {
      if (fixed) {
        _caelumCompatMessage(
          'I noticed something on your ' + (_platform || 'device') + ' wasn\'t responding right — I switched in a version of <strong>' + moduleBase + '</strong> that works better here. Please reload so the fix fully applies.',
          true
        );
      }
    });
  }

  function hookErrorLogging() {
    if (typeof logError !== 'function' || logError._veilCompatHooked) return;
    var orig = logError;
    window.logError = function(errorType, errorMessage, errorStack, endpoint, metadata) {
      try {
        var meta = metadata || {};
        var mod = meta.module || _moduleFromPath(meta.filename || meta.file || '');
        if (!mod && endpoint) mod = _moduleFromPath(endpoint);
        if (mod && _isHealWorthyModuleError(mod, errorType)) handleModuleError(mod, errorType, errorMessage);
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    window.logError._veilCompatHooked = true;
  }

  function hookGlobalErrors() {
    window.addEventListener('error', function(ev) {
      var mod = _moduleFromPath(ev.filename);
      if (mod) handleModuleError(mod, 'uncaught', ev.message);
    }, true);
  }

  function periodicHealthCheck() {
    if (_isAutomation) return;
    if (Date.now() - _pageLoadAt < 12000) return;

    autoHealPerformance('periodic');
    runProbes();

    var broken = [];
    if (typeof CONFIG === 'undefined' || !CONFIG.chatEndpoint) broken.push('config');
    if (!document.getElementById('messages') && !document.getElementById('guestChatOverlay')) broken.push('ui_messages');
    var guestOv = document.getElementById('guestChatOverlay');
    if (guestOv && guestOv.classList.contains('show')) {
      var guestBar = guestOv.querySelector('.input-bar');
      var guestInp = document.getElementById('guestInput');
      var minH = (window.VeilPlatform && window.VeilPlatform.isIOS) ? 24 : 36;
      if (!guestBar || !guestInp || guestBar.getBoundingClientRect().height < minH) {
        broken.push('guest_input');
      }
    }
    if (broken.indexOf('guest_input') >= 0 && brokenLayoutHeal()) {
      broken = broken.filter(function(b) { return b !== 'guest_input'; });
    }
    if (broken.length) {
      _healthFailStreak++;
      autoHealPerformance('broken_' + broken.join(','));
    } else {
      _healthFailStreak = 0;
    }
    if (_canShowHealPrompt() && _healthFailStreak >= 3 && broken.length) {
      _caelumCompatMessage(
        'I ran a quiet check and something core still looks off after auto-fix attempts. A quick reload usually clears it.',
        true
      );
      _healthFailStreak = 0;
    }
  }

  function start() {
    if (_started) return;
    _started = true;
    _isAutomation = detectAutomationEnvironment();
    _platform = detectPlatform();
    _profile = _readProfile();
    if (!_profile || !_profile.deviceId) {
      _profile = _freshProfile();
      _writeProfile();
    } else {
      _profile.platform = _platform;
      _profile.updatedAt = new Date().toISOString();
      if (_profile.preferredPlatform && PLATFORMS.indexOf(_profile.preferredPlatform) === -1) {
        _profile.preferredPlatform = _platform;
      }
      if (_profile.lastHealPromptAt && _healCooldownActive()) {
        _reloadOffered = true;
      }
      _writeProfile();
    }

    window.VeilPlatform = {
      id: _platform,
      preferred: _profile.preferredPlatform || _platform,
      isMobile: _platform.indexOf('android') === 0 || _platform === 'ios-webkit',
      isIOS: _platform === 'ios-webkit',
      isAndroid: _platform.indexOf('android') === 0,
      isDesktop: _platform.indexOf('desktop') === 0,
      isAutomation: _isAutomation,
      isCloudBrowser: _isAutomation
    };

    applyAutomationEnvironment();
    hookErrorLogging();
    hookGlobalErrors();

    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      util.ensureVideosPlaysInline();
    }

    applyPlatformStack().then(function() {
      return applySavedOverrides();
    }).then(function() {
      runProbes();
      var tracked = _scanTrackedModules();
      if (_profile) {
        _profile.trackedModuleCount = tracked.length;
        _writeProfile();
      }
    });

    _healthTimer = setInterval(function() { _scheduleHealthWork(periodicHealthCheck); }, 120000);
    _perfWatchdog = setInterval(_perfWatchdogTick, 1500);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && Date.now() - _pageLoadAt > 15000) {
        _lastPerfBeat = Date.now();
        setTimeout(function() { _scheduleHealthWork(periodicHealthCheck); }, 1500);
      } else if (document.hidden) {
        autoHealPerformance('hidden');
      }
    });
  }

  function markOverrideActive(moduleBase, platformId) {
    if (!_profile) return;
    _profile.overrides[moduleBase] = platformId;
    _profile.workingModules[moduleBase] = platformId;
    _writeProfile();
  }

  function setPreferredPlatform(platformId) {
    if (PLATFORMS.indexOf(platformId) === -1) return;
    if (!_profile) _profile = _freshProfile();
    _profile.preferredPlatform = platformId;
    _writeProfile();
  }

  function getProfile() {
    return _profile ? JSON.parse(JSON.stringify(_profile)) : null;
  }

  var util = {
    unlockAudioOnGesture: function() {
      if (window._veilAudioUnlockBound) return;
      window._veilAudioUnlockBound = true;
      var unlock = function() {
        try {
          if (typeof _initOrbAudioContext === 'function') _initOrbAudioContext();
          if (window.orbAudioCtx && orbAudioCtx.state === 'suspended') orbAudioCtx.resume();
        } catch (e) {}
        document.removeEventListener('touchstart', unlock, true);
        document.removeEventListener('click', unlock, true);
      };
      document.addEventListener('touchstart', unlock, { capture: true, passive: true });
      document.addEventListener('click', unlock, { capture: true, passive: true });
    },
    ensureVideosPlaysInline: function() {
      var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      function patchVideo(v) {
        if (!v || v.tagName !== 'VIDEO') return;
        if (!isIOS) return;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.playsInline = true;
      }
      document.querySelectorAll('video').forEach(patchVideo);
      if (!window._veilVideoPlaysInlineObserver && typeof MutationObserver !== 'undefined') {
        window._veilVideoPlaysInlineObserver = new MutationObserver(function(muts) {
          muts.forEach(function(m) {
            m.addedNodes.forEach(function(node) {
              if (!node || node.nodeType !== 1) return;
              if (node.tagName === 'VIDEO') patchVideo(node);
              if (node.querySelectorAll) node.querySelectorAll('video').forEach(patchVideo);
            });
          });
        });
        window._veilVideoPlaysInlineObserver.observe(document.documentElement, { childList: true, subtree: true });
      }
    },
    wrapFetchWithTimeout: function(defaultMs) {
      if (window.fetch._veilCompatWrapped) return;
      var orig = window.fetch;
      window.fetch = function(input, init) {
        init = init || {};
        if (!init.signal && defaultMs > 0) {
          var ctrl = new AbortController();
          init.signal = ctrl.signal;
          setTimeout(function() { try { ctrl.abort(); } catch (e) {} }, defaultMs);
        }
        return orig.call(this, input, init);
      };
      window.fetch._veilCompatWrapped = true;
    },
    safeLocalStorage: function(key, val) {
      try {
        if (val === undefined) return localStorage.getItem(key);
        localStorage.setItem(key, val);
        return true;
      } catch (e) { return null; }
    }
  };

  return {
    start: start,
    detectPlatform: detectPlatform,
    detectAutomationEnvironment: detectAutomationEnvironment,
    applyAutomationEnvironment: applyAutomationEnvironment,
    prepareChatInput: prepareChatInput,
    focusChatInput: focusChatInput,
    fillChatAndSend: fillChatAndSend,
    dismissBlockingOverlays: dismissBlockingOverlays,
    runProbes: runProbes,
    autoHealPerformance: autoHealPerformance,
    loadModuleOverride: loadModuleOverride,
    loadPlatformPatch: loadPlatformPatch,
    registerTuning: registerTuning,
    runModuleTuning: runModuleTuning,
    runAllTuningsForPlatform: runAllTuningsForPlatform,
    markOverrideActive: markOverrideActive,
    setPreferredPlatform: setPreferredPlatform,
    getProfile: getProfile,
    util: util,
    PLATFORMS: PLATFORMS
  };
})();
