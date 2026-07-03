// ============================================================
// DEVICE ASSISTANT — voice companion setup + in-app assistant mode
// Full Siri/Copilot replacement needs a native app; this is the PWA path.
// ============================================================
var _builtDeviceAssistant = (function() {
  'use strict';

  var STORAGE_KEY = 'veil_assistant_mode';
  var WAKE_PHRASES = ['hey caelum', 'ok caelum', 'hi caelum', 'hello caelum'];
  var _wakeRecognition = null;
  var _wakeRestartTimer = null;
  var _barEl = null;
  var _enabled = false;

  function _platform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
    return 'desktop';
  }

  function _isInstalled() {
    if (typeof isPwaInstalled === 'function' && isPwaInstalled()) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function _hasSpeech() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function isEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function _setEnabled(on) {
    _enabled = !!on;
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (on) _startAssistantMode();
    else _stopAssistantMode();
    _syncSettingsUi();
  }

  function _syncSettingsUi() {
    var btn = document.getElementById('assistantModeBtn');
    if (!btn) return;
    if (_enabled) {
      btn.textContent = 'Assistant Mode On';
      btn.style.opacity = '0.55';
    } else {
      btn.textContent = 'Turn On Assistant Mode';
      btn.style.opacity = '1';
    }
  }

  function _ensureBar() {
    if (_barEl) return _barEl;
    _barEl = document.createElement('div');
    _barEl.id = 'caelumAssistantBar';
    _barEl.style.cssText =
      'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:10001;' +
      'display:none;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;' +
      'background:rgba(6,4,0,.94);border:1px solid rgba(255,184,77,.4);' +
      'box-shadow:0 6px 28px rgba(0,0,0,.55);cursor:pointer;max-width:92vw;';
    _barEl.innerHTML =
      '<span id="caelumAssistantDot" style="width:9px;height:9px;border-radius:50%;background:#FFB84D;box-shadow:0 0 10px #FFB84D"></span>' +
      '<span style="font-size:12px;font-weight:700;color:#FFB84D">Caelum Assistant</span>' +
      '<span style="font-size:11px;color:#8ba8a0">Tap to talk</span>';
    _barEl.addEventListener('click', function() {
      if (typeof startLiveChat === 'function') startLiveChat();
    });
    document.body.appendChild(_barEl);
    return _barEl;
  }

  function _showBar() {
    var bar = _ensureBar();
    bar.style.display = 'flex';
    if (liveChat && liveChat.active) bar.style.display = 'none';
  }

  function _hideBar() {
    if (_barEl) _barEl.style.display = 'none';
  }

  function _stopWakeListening() {
    if (_wakeRestartTimer) { clearTimeout(_wakeRestartTimer); _wakeRestartTimer = null; }
    if (_wakeRecognition) {
      try { _wakeRecognition.onend = null; _wakeRecognition.stop(); } catch (e) { /* ignore */ }
      _wakeRecognition = null;
    }
  }

  function _beginWakeRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (typeof sttLanguage !== 'undefined' && sttLanguage) ? sttLanguage : 'en-US';

    rec.onresult = function(event) {
      var chunk = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        chunk += event.results[i][0].transcript + ' ';
      }
      var lower = chunk.toLowerCase();
      for (var j = 0; j < WAKE_PHRASES.length; j++) {
        if (lower.indexOf(WAKE_PHRASES[j]) !== -1) {
          _onWakePhrase(lower);
          return;
        }
      }
    };

    rec.onerror = function(event) {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') return;
      _wakeRestartTimer = setTimeout(_startWakeListening, 4000);
    };

    rec.onend = function() {
      if (_enabled && !document.hidden && !(liveChat && liveChat.active)) {
        _wakeRestartTimer = setTimeout(_startWakeListening, 600);
      }
    };

    _wakeRecognition = rec;
    try { rec.start(); } catch (e) { /* ignore */ }
  }

  function _startWakeListening() {
    if (!_hasSpeech()) return;
    if (document.hidden) return;
    if (liveChat && liveChat.active) return;
    if (state && state.isListening) return;

    _stopWakeListening();
    if (!localStorage.getItem('veil_speech_explained') && typeof showPermissionExplainer === 'function') {
      showPermissionExplainer('speech').then(function(ok) {
        if (!ok) return;
        localStorage.setItem('veil_speech_explained', '1');
        _beginWakeRecognition();
      });
      return;
    }
    _beginWakeRecognition();
  }

  function _onWakePhrase(transcript) {
    _stopWakeListening();
    if (typeof addThought === 'function') addThought('Wake phrase heard — opening voice chat.', 'assistant');
    if (typeof startLiveChat === 'function') startLiveChat();
    var cmd = transcript.replace(/.*(hey|ok|hi|hello)\s+caelum[,.]?\s*/i, '').trim();
    if (cmd.length > 3 && typeof addSystemMessage === 'function') {
      addSystemMessage('Heard: "' + cmd + '" — speak again in Live when ready.');
    }
  }

  function _startAssistantMode() {
    _enabled = true;
    if (!_isInstalled()) {
      if (typeof addSystemMessage === 'function') {
        addSystemMessage('Install the app for the best assistant experience.');
      }
    }
    _showBar();
    if (_platform() === 'desktop' || _platform() === 'windows' || _platform() === 'mac') {
      _startWakeListening();
    }
    if (typeof AutonomyLogger !== 'undefined' && AutonomyLogger.logAction) {
      AutonomyLogger.logAction('assistant_mode', 'enabled', 'device_assistant');
    }
  }

  function _stopAssistantMode() {
    _enabled = false;
    _hideBar();
    _stopWakeListening();
  }

  function toggleAssistantMode() {
    _setEnabled(!_enabled);
    if (_enabled && typeof addSystemMessage === 'function') {
      var plat = _platform();
      if (plat === 'ios' || plat === 'android') {
        addSystemMessage('Assistant mode on — tap the Caelum bar or use Live to talk. Say "Hey Caelum" works best on desktop.');
      } else {
        addSystemMessage('Assistant mode on — say "Hey Caelum" or tap the bar to talk.');
      }
    }
  }

  function _stepsForPlatform(plat) {
    var origin = window.location.origin;
    var liveUrl = origin + '/?assistant=live';
    var common = [
      { title: 'Install this app', body: 'Add EACI Companion to your home screen or taskbar so Caelum is one tap away — like any assistant app.' },
      { title: 'Turn on Assistant Mode', body: 'In Settings, enable Assistant Mode. Caelum shows a voice bar and listens when the app is open.' },
      { title: 'Enable check-ins', body: 'Let Caelum send caring notifications on this device, even when the app is closed.' }
    ];

    if (plat === 'ios') {
      return common.concat([
        { title: 'Siri Shortcut (optional)', body: 'In the Shortcuts app, create "Open URL" → ' + liveUrl + ' and record the phrase "Talk to Caelum". That is the closest iOS option until a native App Store version.' },
        { title: 'Share to Caelum', body: 'From Safari or any app, tap Share → EACI Companion to send text or a link straight to Caelum.' }
      ]);
    }
    if (plat === 'android') {
      return common.concat([
        { title: 'Pin & quick launch', body: 'Long-press the home-screen icon → shortcuts → "Talk to Caelum" for instant voice chat.' },
        { title: 'Share to Caelum', body: 'From Chrome or other apps, Share → EACI Companion to ask Caelum about anything on screen.' },
        { title: 'About Google Assistant', body: 'Replacing Google Assistant as the system default requires a native Android app (coming later). This installed app is your companion assistant today.' }
      ]);
    }
    if (plat === 'windows') {
      return common.concat([
        { title: 'Pin to taskbar', body: 'Right-click the app icon → Pin to taskbar. Open with Win+number like Copilot.' },
        { title: 'Say "Hey Caelum"', body: 'With Assistant Mode on and the app open, say "Hey Caelum" to start voice chat hands-free.' },
        { title: 'Share to Caelum', body: 'Share links or text from Edge or other apps directly into the chat.' }
      ]);
    }
    return common.concat([
      { title: 'Say "Hey Caelum"', body: 'With the app open, say "Hey Caelum" to start Live voice chat (Chrome/Edge desktop).' },
      { title: 'Share to Caelum', body: 'Share text or URLs from other apps into EACI Companion when installed.' }
    ]);
  }

  function openSetup() {
    if (document.getElementById('deviceAssistantOverlay')) return;

    var plat = _platform();
    var steps = _stepsForPlatform(plat);
    var installed = _isInstalled();
    var stepHtml = steps.map(function(s, i) {
      return '<div style="margin-bottom:14px;padding:12px;background:rgba(255,184,77,.05);border:1px solid rgba(255,184,77,.15);border-radius:10px">' +
        '<div style="font-size:11px;font-weight:700;color:#FFB84D;margin-bottom:4px">' + (i + 1) + '. ' + s.title + '</div>' +
        '<div style="font-size:11px;color:#d8ccc0;line-height:1.55">' + s.body + '</div>' +
      '</div>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'deviceAssistantOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="width:min(440px,100%);max-height:90vh;overflow:auto;background:rgba(6,4,0,.98);border:1px solid rgba(255,184,77,.35);border-radius:16px;padding:20px;box-shadow:0 12px 48px rgba(0,0,0,.7)">' +
        '<div style="font-size:16px;font-weight:800;color:#FFB84D;margin-bottom:4px">Make Caelum your device assistant</div>' +
        '<div style="font-size:11px;color:#8ba8a0;line-height:1.5;margin-bottom:16px">' +
          (installed
            ? 'Your app is installed. Follow these steps on this device so Caelum feels as close to Siri or Copilot as a web app can.'
            : 'Install the app first, then set Caelum up as your companion on this device.') +
        '</div>' +
        stepHtml +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
          (!installed && typeof showPwaInstallPrompt === 'function'
            ? '<button type="button" id="daInstallBtn" style="flex:1;min-width:140px;padding:10px;background:#00ffc8;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Install App</button>'
            : '') +
          '<button type="button" id="daEnableBtn" style="flex:1;min-width:140px;padding:10px;background:#FFB84D;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">' +
            (_enabled ? 'Assistant Mode On' : 'Enable Assistant Mode') +
          '</button>' +
          '<button type="button" id="daLiveBtn" style="flex:1;min-width:140px;padding:10px;background:rgba(255,184,77,.12);border:1px solid rgba(255,184,77,.35);color:#FFB84D;font-size:12px;border-radius:8px;cursor:pointer">Try Live Voice</button>' +
          '<button type="button" id="daCloseBtn" style="padding:10px 14px;background:none;border:1px solid rgba(255,184,77,.2);color:#8ba8a0;font-size:12px;border-radius:8px;cursor:pointer">Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    var installBtn = document.getElementById('daInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function() {
        if (typeof showPwaInstallPrompt === 'function') showPwaInstallPrompt();
      });
    }
    document.getElementById('daEnableBtn').addEventListener('click', function() {
      if (!_enabled) toggleAssistantMode();
      document.getElementById('daEnableBtn').textContent = 'Assistant Mode On';
    });
    document.getElementById('daLiveBtn').addEventListener('click', function() {
      overlay.remove();
      if (typeof startLiveChat === 'function') startLiveChat();
    });
    document.getElementById('daCloseBtn').addEventListener('click', function() { overlay.remove(); });
  }

  function showInstallOffer() {
    if (sessionStorage.getItem('da_offer_dismissed')) return;
    if (document.getElementById('deviceAssistantOffer')) return;

    var el = document.createElement('div');
    el.id = 'deviceAssistantOffer';
    el.style.cssText =
      'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10003;max-width:400px;width:92%;' +
      'background:rgba(6,4,0,.96);border:1px solid rgba(255,184,77,.35);border-radius:14px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.65);';
    el.innerHTML =
      '<div style="font-size:13px;font-weight:700;color:#FFB84D;margin-bottom:6px">Make Caelum your assistant on this device</div>' +
      '<div style="font-size:11px;color:#d8ccc0;line-height:1.5;margin-bottom:12px">Voice chat, quick launch, and share-to-Caelum — set it up like Copilot or Siri (within what your browser allows).</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button id="daOfferSetupBtn" style="flex:1;padding:9px;background:#FFB84D;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Set Up</button>' +
        '<button id="daOfferLaterBtn" style="padding:9px 14px;background:none;border:1px solid rgba(255,184,77,.25);color:#8ba8a0;font-size:12px;border-radius:8px;cursor:pointer">Later</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('daOfferSetupBtn').addEventListener('click', function() {
      el.remove();
      openSetup();
    });
    document.getElementById('daOfferLaterBtn').addEventListener('click', function() {
      sessionStorage.setItem('da_offer_dismissed', '1');
      el.remove();
    });
  }

  function _handleDeepLinks() {
    var params = new URLSearchParams(window.location.search);
    var assistant = params.get('assistant');
    var sharedText = (params.get('text') || '').trim();
    var sharedTitle = (params.get('title') || '').trim();
    var sharedUrl = (params.get('url') || '').trim();
    var combined = sharedText || sharedTitle;
    if (sharedUrl && combined) combined += '\n' + sharedUrl;
    else if (sharedUrl) combined = sharedUrl;

    if (!assistant && !combined) return;

    function run() {
      if (!state || !state.user) return;
      if (assistant === 'live' && typeof startLiveChat === 'function') {
        startLiveChat();
      } else if (assistant === 'chat' && typeof addSystemMessage === 'function') {
        addSystemMessage('Caelum is ready — type or tap Live to talk.');
      }
      if (combined && document.getElementById('userInput')) {
        document.getElementById('userInput').value = combined;
        if (typeof sendMessage === 'function') sendMessage();
      }
    }

    setTimeout(run, 3500);
  }

  function init() {
    _enabled = isEnabled();
    if (_enabled) _startAssistantMode();
    _syncSettingsUi();
    _handleDeepLinks();

    document.addEventListener('visibilitychange', function() {
      if (!_enabled) return;
      if (document.hidden) {
        _stopWakeListening();
        _hideBar();
      } else {
        _showBar();
        _startWakeListening();
      }
    });

    if (typeof liveChat !== 'undefined') {
      var _origStop = typeof stopLiveChat === 'function' ? stopLiveChat : null;
      if (_origStop) {
        window.stopLiveChat = function() {
          _origStop.apply(this, arguments);
          if (_enabled) {
            setTimeout(function() {
              _showBar();
              _startWakeListening();
            }, 800);
          }
        };
      }
    }
  }

  return {
    openSetup: openSetup,
    showInstallOffer: showInstallOffer,
    toggleAssistantMode: toggleAssistantMode,
    isEnabled: isEnabled,
    init: init
  };
})();

if (typeof installVeilModule === 'function') installVeilModule('DeviceAssistant', _builtDeviceAssistant);
