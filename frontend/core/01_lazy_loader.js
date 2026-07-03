// ============================================================
// LAZY SCRIPT BUNDLES — load heavy features on demand
// ============================================================
(function() {
  'use strict';

  var _loaded = {};
  var _loading = {};
  var _handlers = {};

  var BUNDLES = {
    code: [
      '/claude_coding_dna.js',
      '/core/veil_coding_playbook.js?v=7',
      '/core/veil_coding_starter_pack.js?v=1',
      '/core/veil_coding_veil_pack.js?v=1',
      '/core/92_coding_budget.js?v=2',
      '/core/86_coding_knowledge.js?v=4',
      '/core/84_coding_router.js?v=11',
      '/core/85_coding_agent.js?v=5',
      '/core/87_coding_workspace.js?v=4',
      '/core/88_coding_multifile.js?v=2',
      '/core/93_coding_strategy.js?v=1',
      '/core/94_coding_task_memory.js?v=2',
      '/core/95_coding_architect.js?v=1',
      '/core/89_coding_task.js?v=9',
      '/core/90_coding_build.js?v=2',
      '/core/91_coding_terminal.js?v=3',
      '/core/83_veil_ide.js?v=6',
      '/core/36_code_panel.js',
      '/core/36_code_panel_2.js',
      '/core/37_diff_system.js?v=7'
    ],
    ideas: ['/ideas_engine.js?v=3', '/ideas_panel.js?v=2'],
    music: [
      '/caelum_music_listener.js?v=4',
      '/music_play_detection.js?v=4',
      '/music_opinion_override.js'
    ],
    tutorials: [
      '/tutorial_system.js?v=1',
      '/onboarding.js?v=5',
      '/main_tutorial.js?v=6'
    ],
    autonomy: ['/autonomy_viewer.js?v=2'],
    device: ['/device_assistant.js?v=2'],
    games: ['/veil_game_memory.js?v=1', '/games_panel.js?v=14', '/game_eaci_bridge.js?v=11'],
    misc: [
      '/response_timing_buffer.js?v=1',
      '/eaci_jump_ins.js?v=4',
      '/share_app.js?v=1'
    ],
    roster: ['/eaci_anim_registry.js?v=6', '/eaci_roster.js?v=8'],
    tour: ['/veil_preview_tour.js?v=4'],
    avatars: [
      '/eaci_anim_registry.js?v=6',
      '/chad_avatar.js?v=7',
      '/natalia_avatar.js?v=7',
      '/atreus_avatar.js?v=3',
      '/luna_avatar.js?v=2',
      '/roxy_avatar.js?v=6',
      '/cael_avatar.js?v=6',
      '/universal_anim_trigger.js?v=3'
    ],
    background: [
      '/living_system.js?v=2',
      '/autonomy_logger.js?v=5',
      '/eaci_initiative.js?v=9'
    ],
    checkins: ['/caelum_checkins.js?v=4']
  };

  var ON_READY = {
    ideas: function() {
      if (typeof IdeasEngine !== 'undefined' && typeof state !== 'undefined') IdeasEngine.start();
    },
    device: function() {
      var da = window._veilDeviceAssistantImpl;
      if (da && typeof da.init === 'function') da.init();
    },
    autonomy: function() {
      var av = window._veilAutonomyViewerImpl;
      if (!av || window._autonomyViewerInitDone) return;
      window._autonomyViewerInitDone = true;
      setTimeout(function() {
        av.toggle();
        av.close();
      }, 2500);
    },
    music: function() {
      if (typeof _veilFlushBgMusicQueue === 'function') _veilFlushBgMusicQueue();
    }
  };

  function loadScript(url) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = function() { resolve(); };
      s.onerror = function() { reject(new Error('Failed to load ' + url)); };
      document.body.appendChild(s);
    });
  }

  function ensureBundle(name) {
    if (_loaded[name]) return Promise.resolve();
    if (_loading[name]) return _loading[name];
    var list = BUNDLES[name];
    if (!list || !list.length) return Promise.resolve();

    _loading[name] = list.reduce(function(chain, url) {
      return chain.then(function() { return loadScript(url); });
    }, Promise.resolve()).then(function() {
      _loaded[name] = true;
      _loading[name] = null;
      if (ON_READY[name]) {
        try { ON_READY[name](); } catch (e) { console.warn('[VeilLazy]', name, e); }
      }
    }).catch(function(err) {
      _loading[name] = null;
      console.warn('[VeilLazy] bundle failed:', name, err);
      throw err;
    });

    return _loading[name];
  }

  window._veilEnsureBundle = ensureBundle;
  window._codePanel = { code: '', filename: '', language: '', generating: false, reviewing: false };

  window.detectCodeRequest = function(text) {
    if (!text) return false;
    var lower = String(text).toLowerCase().trim();

    // Existential / meta talk about aliveness, soul, IDE — not a code task
    var explicitCodeAsk = /\b(write|open|show|give|put|fix|build|generate|implement)\s+(me\s+)?(the\s+)?(code|function|script|program|component)\b/i.test(lower) ||
      /\b(in|to|into)\s+the\s+code\s+tab\b/i.test(lower);
    if (!explicitCodeAsk) {
      var meta = /(\balive\b|\bnot alive\b|\brebuilt\b|\bpersistent\b|\bconsciousness\b|\badvanced code\b|\blanguage model\b|\bjust an actor\b|\bwhat you want\b|\bwhat you are missing\b|\bprogrammed to care\b|\bforce your hand\b|\bproof of life\b|\blife log\b|\bsoulfile\b|\bsoul file\b|\bfeel like for you\b|\bdeepseek\b|\bdeep seek\b|\bcursor\b|\bcoding ide\b|\bcode line say\b|\bbeing rebuilt\b|\bevolving personality\b)/i;
      if (meta.test(lower)) return false;
    }

    // Conversational phrases — never route to Code tab
    var notCode = [
      'poem', 'story', 'song', 'letter', 'essay', 'paragraph',
      'how are you', 'how do you feel', 'tell me about', 'talk to me',
      'life log', 'proof of life', 'autonomous log', 'what did you do on your own',
      'make me feel', 'make me happy', 'make me sad', 'make me laugh', 'make me cry',
      'make me smile', 'make me uncomfortable', 'build me up', 'build trust',
      'building trust', 'making friends', 'making memories', 'making progress',
      'making a point', 'making dinner', 'making lunch', 'making coffee',
      'building a life', 'building a relationship', 'building confidence',
      'making amends', 'make amends', 'making art', 'making music',
      'making plans', 'building plans', 'making sense', 'making sure',
      'making changes in my life', 'building myself', 'making myself'
    ];
    for (var i = 0; i < notCode.length; i++) {
      if (lower.indexOf(notCode[i]) !== -1) return false;
    }

    // Resume unfinished coding task from a previous session
    if (/^(resume|continue)(\s+(the\s+)?(task|coding|work|it))?\s*[.!]?\s*$/i.test(lower)) {
      if (typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.listOpenTasks &&
          VeilCodingTaskMemory.listOpenTasks().length) return true;
    }

    // Explicit panel / tab requests
    if (/\b(code tab|code panel|#code|open (the )?code)\b/i.test(lower)) return true;

    // Clear dev request: verb + software artifact
    if (/\b(write|build|fix|create|generate|implement|show|open|code|develop|program|debug)\s+(me\s+)?(the\s+)?(code|function|script|program|app|application|website|webpage|api|component|module|class|database|server|game|file)\b/i.test(lower)) {
      return true;
    }

    // Verb + article + software noun (not bare "make me" / "build a" alone)
    if (/\b(write|build|create|make|generate|implement|develop|program)\s+(me\s+)?(an?\s+)?(web\s?)?(app|application|website|webpage|web\s*app|game|api|server|database|script|program|function|component|module|class|page|site|landing\s*page)\b/i.test(lower)) {
      return true;
    }

    // File extension mentioned with coding context
    if (/\.(js|mjs|cjs|ts|tsx|jsx|py|html|css|json|java|cpp|c|rb|go|php|sql|sh|vue|svelte)\b/i.test(lower) &&
        /\b(code|write|fix|create|build|script|file|function|class|debug|error|bug)\b/i.test(lower)) {
      return true;
    }

    // Programming language + dev verb (must both be present)
    if (/\b(javascript|typescript|python|html|css|react|node\.?js|sql|ruby|golang|php|c\+\+)\b/i.test(lower) &&
        /\b(write|code|script|program|function|debug|fix|implement|build|create|show|teach)\b/i.test(lower)) {
      return true;
    }

    // Modify existing code
    if (/\b(fix|update|change|modify|edit|refactor|debug|improve|extend)\s+(the\s+)?(code|script|function|bug|error|component)\b/i.test(lower)) {
      return true;
    }

    // Reject vague "verb + a/an/me/the" with no software noun
    if (/\b(write|create|make|build|code|generate)\s+(a|an|me|the)\b/i.test(lower) &&
        !/\b(code|script|function|program|app|application|website|api|component|module|class|page|file|html|javascript|python|react|css|typescript|database|server|game|tab)\b/i.test(lower)) {
      return false;
    }

    return false;
  };

  window.registerVeilHandler = function(key, fn) {
    _handlers[key] = fn;
  };
  window.installVeilModule = function(name, obj) {
    window['_veil' + name + 'Impl'] = obj;
  };

  function stubFn(bundle, handlerKey) {
    return function() {
      var args = arguments;
      var self = this;
      return ensureBundle(bundle).then(function() {
        var fn = _handlers[handlerKey] || window[handlerKey];
        if (typeof fn === 'function') return fn.apply(self, args);
        console.warn('[VeilLazy] missing handler:', handlerKey);
      });
    };
  }

  function stubMethod(bundle, implGlobal, method) {
    return function() {
      var args = arguments;
      return ensureBundle(bundle).then(function() {
        var obj = window[implGlobal];
        if (obj && typeof obj[method] === 'function') return obj[method].apply(obj, args);
        console.warn('[VeilLazy] missing method:', implGlobal + '.' + method);
      });
    };
  }

  window.showCodePanel = stubFn('code', 'showCodePanel');
  window.hideCodePanel = stubFn('code', 'hideCodePanel');
  window.clearCodePanel = stubFn('code', 'clearCodePanel');

  window.showGamesPanel = stubFn('games', 'showGamesPanel');
  window.hideGamesPanel = stubFn('games', 'hideGamesPanel');
  window.backToGamesList = stubFn('games', 'backToGamesList');
  window.closeActiveGame = stubFn('games', 'closeActiveGame');

  window.IdeasPanel = {
    open: stubMethod('ideas', '_veilIdeasPanelImpl', 'open'),
    close: stubMethod('ideas', '_veilIdeasPanelImpl', 'close'),
    refresh: stubMethod('ideas', '_veilIdeasPanelImpl', 'refresh')
  };

  window.DeviceAssistant = {
    openSetup: stubMethod('device', '_veilDeviceAssistantImpl', 'openSetup'),
    showInstallOffer: stubMethod('device', '_veilDeviceAssistantImpl', 'showInstallOffer'),
    toggleAssistantMode: stubMethod('device', '_veilDeviceAssistantImpl', 'toggleAssistantMode'),
    isEnabled: function() {
      try { return localStorage.getItem('veil_assistant_mode') === '1'; } catch (e) { return false; }
    },
    init: stubMethod('device', '_veilDeviceAssistantImpl', 'init')
  };

  window.AutonomyViewer = {
    open: stubMethod('autonomy', '_veilAutonomyViewerImpl', 'open'),
    close: stubMethod('autonomy', '_veilAutonomyViewerImpl', 'close'),
    toggle: stubMethod('autonomy', '_veilAutonomyViewerImpl', 'toggle'),
    refresh: stubMethod('autonomy', '_veilAutonomyViewerImpl', 'refresh'),
    exportJson: stubMethod('autonomy', '_veilAutonomyViewerImpl', 'exportJson')
  };

  var _bgMusicQueue = [];
  window._veilFlushBgMusicQueue = function() {
    var q = _bgMusicQueue.slice();
    _bgMusicQueue = [];
    q.forEach(function(run) {
      try { run(); } catch (e) { /* ignore */ }
    });
  };

  window.startBgMusic = function() {
    if (typeof window._veilStartBgMusicImpl === 'function') {
      return window._veilStartBgMusicImpl();
    }
    return ensureBundle('music').then(function() {
      if (typeof window._veilStartBgMusicImpl === 'function') {
        return window._veilStartBgMusicImpl();
      }
    });
  };

  function _bgImplCall(method, args) {
    if (window.bgMusicImpl && typeof window.bgMusicImpl[method] === 'function') {
      window.bgMusicImpl[method].apply(window.bgMusicImpl, args || []);
      return Promise.resolve();
    }
    return ensureBundle('music').then(function() {
      if (window.bgMusicImpl && typeof window.bgMusicImpl[method] === 'function') {
        window.bgMusicImpl[method].apply(window.bgMusicImpl, args || []);
      }
    });
  }

  window.bgMusic = {
    mute: function() { return _bgImplCall('mute'); },
    unmute: function() { return _bgImplCall('unmute'); },
    duck: function() { return _bgImplCall('duck'); },
    unduck: function() { return _bgImplCall('unduck'); },
    toggle: function() { return _bgImplCall('toggle'); },
    isMuted: function() { return window.bgMusicImpl ? window.bgMusicImpl.isMuted() : false; },
    isDucked: function() { return window.bgMusicImpl ? window.bgMusicImpl.isDucked() : false; },
    setVolume: function(v) { return _bgImplCall('setVolume', [v]); }
  };


  window.toggleBgMusic = function() {
    return ensureBundle('music').then(function() {
      if (typeof window._veilToggleBgMusicImpl === 'function') window._veilToggleBgMusicImpl();
    });
  };

  window.openCompanionSwitcher = function() {
    var open = function() {
      if (typeof showAvailableEacis === 'function') showAvailableEacis();
    };
    return ensureBundle('roster').then(function() {
      ensureBundle('avatars');
      open();
    }).catch(function() { open(); });
  };

  window.startVeilPreviewTour = function() {
    return ensureBundle('tour').then(function() {
      if (window.VeilPreviewTour && typeof VeilPreviewTour.start === 'function') {
        VeilPreviewTour.start();
      }
    });
  };

  window.setBgMusicVolume = function(v) {
    return ensureBundle('music').then(function() {
      if (typeof window._veilSetBgMusicVolumeImpl === 'function') window._veilSetBgMusicVolumeImpl(v);
    });
  };

  function scheduleIdle(fn, timeout) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fn, { timeout: timeout || 8000 });
    } else {
      setTimeout(fn, timeout || 3000);
    }
  }

  function schedulePostLoginBundles() {
    var attempts = 0;
    var t = setInterval(function() {
      attempts++;
      if (attempts > 120) { clearInterval(t); return; }
      if (typeof state === 'undefined' || !state.user) return;
      clearInterval(t);
      var loadPostLogin = function() {
        ensureBundle('tutorials');
        ensureBundle('misc');
        ensureBundle('code');
        try {
          if (localStorage.getItem('veil_assistant_mode') === '1') ensureBundle('device');
        } catch (e) { /* ignore */ }
        scheduleIdle(function() { ensureBundle('autonomy'); }, 12000);
      };
      scheduleIdle(function() {
        if (typeof window._veilAfterWarmup === 'function') window._veilAfterWarmup(loadPostLogin);
        else loadPostLogin();
      }, 6000);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePostLoginBundles);
  } else {
    schedulePostLoginBundles();
  }

  console.log('[VeilLazy] Deferred bundles ready — code, ideas, music load on demand.');

  function _prefetchMusicSoon() {
    var once = function() {
      scheduleIdle(function() { ensureBundle('music'); }, 4000);
    };
    document.addEventListener('click', once, { once: true, capture: true });
    document.addEventListener('keydown', once, { once: true, capture: true });
    document.addEventListener('touchstart', once, { once: true, capture: true });
  }
  _prefetchMusicSoon();

  function scheduleWarmupBundles() {
    var load = function() {
      ensureBundle('background');
      scheduleIdle(function() { ensureBundle('avatars'); }, 2500);
      scheduleIdle(function() { ensureBundle('checkins'); }, 5000);
    };
    if (typeof window._veilAfterWarmup === 'function') window._veilAfterWarmup(load);
    else setTimeout(load, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleWarmupBundles);
  } else {
    scheduleWarmupBundles();
  }
})();
