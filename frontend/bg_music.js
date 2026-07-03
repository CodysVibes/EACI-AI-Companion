(function() {

  // ── Background Music via R2 public URL ──────────────

  var BG_FILE   = 'Awake In The Circuit.mp3';

  var BG_R2_URL = 'https://assests.eacicompanion.com/music/Awake%20In%20The%20Circuit.mp3';

  var REFRESH_MS = 55 * 60 * 1000;

  var WATCHDOG_MS = 12000;



  var bgAudio      = null;

  var bgStarted    = false;

  var bgMuted      = false;       // user turned BG off (toggle / slider at 0)

  var bgUserWants  = false;       // user started BG and did not explicitly turn it off

  var _duckDepth   = 0;           // temporary duck (mic, CV player, games) — not user mute

  var _bgUrl       = null;

  var _bgStarting  = null;

  var _pendingBgVolume = 0.12;

  var _eventsBound = false;

  var _watchdogInterval = null;

  var _refreshInterval = null;

  var _prewarmUrl = null;



  async function _getSignedUrl() {

    return BG_R2_URL;

  }



  function _applyVolume() {

    if (!bgAudio) return;

    bgAudio.volume = (bgMuted || _duckDepth > 0) ? 0 : _pendingBgVolume;

  }



  function _shouldKeepPlaying() {

    return bgUserWants && !bgMuted;

  }



  function _bindBgAudioEvents() {

    if (_eventsBound) return;

    bgAudio = bgAudio || document.getElementById('bgMusic');

    if (!bgAudio) return;

    _eventsBound = true;



    bgAudio.addEventListener('error', function() {

      bgStarted = false;

      _prewarmUrl = null;

      if (_shouldKeepPlaying()) setTimeout(_tryResumeBgMusic, 2000);

    });

    bgAudio.addEventListener('stalled', function() {

      if (_shouldKeepPlaying()) setTimeout(_tryResumeBgMusic, 1500);

    });

    bgAudio.addEventListener('ended', function() {

      if (_shouldKeepPlaying()) _tryResumeBgMusic();

    });

    bgAudio.addEventListener('pause', function() {

      if (_shouldKeepPlaying()) setTimeout(_tryResumeBgMusic, 400);

    });

  }



  function _tryResumeBgMusic() {

    if (!_shouldKeepPlaying() || _bgStarting) return;

    bgAudio = bgAudio || document.getElementById('bgMusic');

    if (!bgAudio) return;



    if (!bgAudio.paused && bgAudio.src) {

      bgStarted = true;

      _applyVolume();

      return;

    }



    if (bgAudio.src && _bgUrl) {

      bgAudio.loop = true;

      _applyVolume();

      bgAudio.play().then(function() {

        bgStarted = true;

        console.log('[bgMusic] Resumed playback');

      }).catch(function() {

        bgStarted = false;

        startBgMusic();

      });

      return;

    }



    startBgMusic();

  }



  function _ensureWatchdog() {

    if (_watchdogInterval) return;

    _watchdogInterval = setInterval(function() {

      if (!_shouldKeepPlaying()) return;

      bgAudio = bgAudio || document.getElementById('bgMusic');

      if (!bgAudio || !bgAudio.src) return;

      if (bgAudio.paused || bgAudio.ended) _tryResumeBgMusic();

    }, WATCHDOG_MS);

  }



  function _ensureRefreshTimer() {

    if (_refreshInterval) return;

    _refreshInterval = setInterval(function() {

      if (!bgAudio || bgAudio.paused) return;

    }, REFRESH_MS);

  }



  document.addEventListener('DOMContentLoaded', function() {

    _getSignedUrl().then(function(u) { _prewarmUrl = u; });

    _bindBgAudioEvents();

  });



  document.addEventListener('visibilitychange', function() {

    if (document.visibilityState === 'visible' && _shouldKeepPlaying()) {

      setTimeout(_tryResumeBgMusic, 300);

    }

  });



  function startBgMusic() {

    if (bgStarted && bgAudio && !bgAudio.paused) return Promise.resolve();

    if (_bgStarting) return _bgStarting;



    _bgStarting = (async function() {

      bgAudio = document.getElementById('bgMusic');

      if (!bgAudio) { _bgStarting = null; return; }



      // Paused with same source — resume without reload (avoids ~60s stall glitches)

      if (bgAudio.src && _bgUrl && bgAudio.paused) {

        bgAudio.loop = true;

        _applyVolume();

        try {

          await bgAudio.play();

          bgStarted = true;

          bgUserWants = true;

          _bgStarting = null;

          _bindBgAudioEvents();

          _ensureWatchdog();

          _ensureRefreshTimer();

          return;

        } catch (e) { /* fall through to full start */ }

      }



      var url = _prewarmUrl || await _getSignedUrl();

      if (!url) {

        console.warn('[bgMusic] Could not get signed URL — music will not play.');

        _bgStarting = null;

        return;

      }

      _bgUrl = url;



      var volSlider = document.getElementById('bgMusicVolSlider');

      if (volSlider && volSlider.value) _pendingBgVolume = parseFloat(volSlider.value);



      if (bgAudio.src !== url) {

        bgAudio.src = url;

        bgAudio.load();

      }

      bgAudio.loop = true;

      _applyVolume();



      try {

        await bgAudio.play();

        bgStarted = true;

        bgUserWants = true;

        _bgStarting = null;

        _prewarmUrl = null;

        console.log('[bgMusic] Playing:', BG_FILE);

        _bindBgAudioEvents();

        _ensureWatchdog();

        _ensureRefreshTimer();

      } catch (e) {

        console.warn('[bgMusic] play() blocked:', e);

        _bgStarting = null;

        _getSignedUrl().then(function(u) { _prewarmUrl = u; });

      }

    })();



    return _bgStarting;

  }



  var _evts = ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'];

  function _onInteraction() {

    startBgMusic().then(function() {

      if (bgAudio && !bgAudio.paused) {

        _evts.forEach(function(e) { document.removeEventListener(e, _onInteraction); });

      }

    });

  }

  _evts.forEach(function(evt) { document.addEventListener(evt, _onInteraction); });



  var bgMusicApi = {

    mute: function() {

      bgMuted = true;

      bgUserWants = false;

      _applyVolume();

    },

    unmute: function() {

      var v = _pendingBgVolume;

      var slider = document.getElementById('bgMusicVolSlider');

      if (slider && slider.value) v = parseFloat(slider.value);

      if (!isFinite(v)) v = 0.12;

      _pendingBgVolume = v;

      bgMuted = false;

      if (v > 0) bgUserWants = true;

      _applyVolume();

      _tryResumeBgMusic();

    },

    duck: function() {

      _duckDepth++;

      _applyVolume();

    },

    unduck: function() {

      _duckDepth = Math.max(0, _duckDepth - 1);

      _applyVolume();

      if (_shouldKeepPlaying()) _tryResumeBgMusic();

    },

    toggle: function() { bgMuted ? bgMusicApi.unmute() : bgMusicApi.mute(); },

    isMuted: function() { return bgMuted; },

    isDucked: function() { return _duckDepth > 0; },

    setVolume: function(v) {

      var vol = parseFloat(v);

      if (!isFinite(vol)) return;

      _pendingBgVolume = Math.max(0, Math.min(1, vol));

      if (_pendingBgVolume === 0) {

        bgMuted = true;

        bgUserWants = false;

      } else if (!bgMuted) {

        bgUserWants = true;

      }

      _applyVolume();

    }

  };



  window.bgMusicImpl = bgMusicApi;

  window._veilStartBgMusicImpl = startBgMusic;

  window._veilSetBgMusicVolumeImpl = function(v) {

    bgMusicApi.setVolume(v);

    var slider = document.getElementById('bgMusicVolSlider');

    if (slider && slider.value !== String(v)) slider.value = String(v);

    var btn = document.getElementById('bgMusicToggleBtn');

    if (btn) btn.textContent = (parseFloat(v) === 0) ? 'BG: OFF' : 'BG: ON';

  };



  window._veilToggleBgMusicImpl = function() {

    bgMusicApi.toggle();

    var btn = document.getElementById('bgMusicToggleBtn');

    if (btn) {

      btn.textContent = bgMusicApi.isMuted() ? 'BG: OFF' : 'BG: ON';

      btn.style.background = bgMusicApi.isMuted() ? 'rgba(255,107,107,.15)' : 'rgba(0,255,200,.15)';

      btn.style.color = bgMusicApi.isMuted() ? '#ff6b6b' : 'var(--accent)';

    }

  };

})();


