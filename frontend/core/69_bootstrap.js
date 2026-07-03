// ============================================================
// START
// ============================================================
window.addEventListener('DOMContentLoaded', function() {
  if (typeof VeilCompat !== 'undefined') VeilCompat.start();
  // Guard against a core script (e.g. 12_state.js / 15_init.js) failing to load
  // on a flaky connection — without this, "init is not defined" / "state is not
  // defined" would abort the entire startup handler.
  if (typeof init === 'function') {
    try { init(); } catch (e) { console.error('init() failed:', e); }
  } else {
    console.error('init() unavailable — a core script failed to load.');
  }

  // ── Orientation banner logic ──────────────────────────────
  // Track which orientations have already been shown this session (portrait / landscape)
  var _orientationSeenThisSession = {};
  var _banner = document.getElementById('orientationBanner');

  function _getOrientationType() {
    return (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape';
  }

  function _checkOrientation() {
    if (!_banner) return;
    // Desktop/laptop: orientation banner is irrelevant — bail out immediately
    var isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 900;
    if (!isMobile) {
      _banner.style.display = 'none';
      return;
    }
    var orientType = _getOrientationType();
    // Only show if we haven't already shown it for this orientation this session
    if (!_orientationSeenThisSession[orientType]) {
      _orientationSeenThisSession[orientType] = true;
      _orientationBannerUpdate(); // set correct text for current orientation
      _banner.style.display = 'flex';
      _orientationCountdownStop();   // reset before starting fresh
      _orientationCountdownStart();  // always 3s auto-close
    }
    // If already seen for this orientation, do nothing (don't re-show)
  }

  window.dismissOrientationBanner = function() {
    if (_banner) {
      _banner.style.display = 'none';
      _orientationCountdownStop();
    }
  };

  // Check on load only — do NOT re-check on every resize (resize fires on every click/scroll/keyboard)
  _checkOrientation();
  window.addEventListener('orientationchange', function() {
    // Allow the new orientation to show its banner once
    setTimeout(_checkOrientation, 350); // small delay for orientation to settle
  });

  // Size the chat header orb canvases
  var co = document.getElementById('caelumOrbCanvas');
  var cho = document.getElementById('chadOrbCanvas');
  if (co) { co.width = 80; co.height = 80; }
  if (cho) { cho.width = 80; cho.height = 80; }

  // Start orb animation loop after warmup (Chad orb — not needed for guest intro)
  if (typeof window._veilAfterWarmup === 'function') {
    window._veilAfterWarmup(function() { orbAnimationLoop(); });
  } else {
    orbAnimationLoop();
  }

  // ── Initialize Caelum avatar containers ────────────────────
  (function initCaelumAvatars() {
    var targets = [
      { wrapId: 'caelumAvatarCenterWrap',   avatarId: 'caelum_main',     fullscreen: true },
      { wrapId: 'caelumAvatarHeaderWrap',    avatarId: 'caelum_header',   fullscreen: false },
      { wrapId: 'caelumAvatarStartupWrap',   avatarId: 'caelum_startup',  fullscreen: true },
      { wrapId: 'caelumAvatarLiveWrap',      avatarId: 'caelum_live',     fullscreen: true },
      { wrapId: 'caelumAvatarGuestWrap',     avatarId: 'caelum_guest',    fullscreen: false },
      { wrapId: 'caelumAvatarSignupWrap',    avatarId: 'caelum_signup',   fullscreen: false },
    ];
    targets.forEach(function(t) {
      var wrap = document.getElementById(t.wrapId);
      if (!wrap) return;
      var container = CaelumAnim.makeContainer(t.avatarId);
      container.style.width = '100%';
      container.style.height = '100%';
      wrap.appendChild(container);
    });

    // Guest/signup center videos are plain <video> tags — bind to the animation engine
    if (typeof CaelumAnim.bindDirectVideo === 'function') {
      deferAvatarWarmup(function() {
        ensureVideoDataSrc('guestCaelumVideo', false);
        ensureVideoDataSrc('signupCaelumVideo', false);
        CaelumAnim.bindDirectVideo('caelum_guest_center', 'guestCaelumVideo');
        CaelumAnim.bindDirectVideo('caelum_signup_bg', 'signupCaelumVideo');
      });
    }
    ['guestCaelumVideo', 'signupCaelumVideo'].forEach(function (vidId) {
      var el = document.getElementById(vidId);
      if (!el) return;
      el.addEventListener('error', function () {
        console.error('[CaelumVideo] Load failed:', vidId, el.currentSrc || el.src, el.error);
      });
    });

    // Preload common clips in background (deferred past first-minute path)
    if (typeof window._veilAfterWarmup === 'function') {
      window._veilAfterWarmup(function() { CaelumAnim.preloadCommon(); });
    } else {
      deferAvatarWarmup(function() { CaelumAnim.preloadCommon(); });
    }
  })();

  // Always play the intro on load
  playStartupIntro();

  // Prefetch live chat tutorial TTS after warmup (not during intro)
  if (typeof window._veilAfterWarmup === 'function') {
    window._veilAfterWarmup(function() { prefetchLiveTutorialAudio(); });
  } else {
    prefetchLiveTutorialAudio();
  }
});