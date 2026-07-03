// Shared OS-specific module tunings — registered once, applied per platform patch.
(function() {
  'use strict';
  if (typeof VeilCompat === 'undefined') return;

  var CRITICAL = [
    '00_preamble', '06_service_worker', '22_streaming', '38_permission_prompts',
    '43_audio_queue', '11_pwa_install', '17_low_power', '65_mobile_panels', '67_startup_intro'
  ];

  function tuneIOSAudio() {
    VeilCompat.util.unlockAudioOnGesture();
    if (typeof _initOrbAudioContext === 'function' && !_initOrbAudioContext._veilIOS) {
      var origInit = _initOrbAudioContext;
      window._initOrbAudioContext = function() {
        origInit();
        if (window.orbAudioCtx && orbAudioCtx.state === 'suspended') {
          orbAudioCtx.resume().catch(function() {});
        }
      };
      _initOrbAudioContext._veilIOS = true;
    }
  }

  function tuneIOSVideo() {
    VeilCompat.util.ensureVideosPlaysInline();
    if (typeof window.veilAssignVideoSrc === 'function' && !window.veilAssignVideoSrc._veilIOS) {
      var origV = window.veilAssignVideoSrc;
      window.veilAssignVideoSrc = async function(el, url, mode) {
        if (el) {
          el.playsInline = true;
          el.setAttribute('playsinline', '');
          el.setAttribute('webkit-playsinline', '');
        }
        return origV(el, url, mode);
      };
      window.veilAssignVideoSrc._veilIOS = true;
    }
  }

  function tuneIOSMic() {
    if (typeof startListening === 'function' && !startListening._veilIOS) {
      var origStart = startListening;
      window.startListening = async function() {
        VeilCompat.util.unlockAudioOnGesture();
        return origStart.apply(this, arguments);
      };
      startListening._veilIOS = true;
    }
  }

  function tuneAndroidFetch() {
    VeilCompat.util.wrapFetchWithTimeout(45000);
  }

  function tuneAndroidSW() {
    if (typeof registerServiceWorker === 'function' && !registerServiceWorker._veilAndroid) {
      var origSW = registerServiceWorker;
      window.registerServiceWorker = async function() {
        try { return await origSW(); } catch (e) { console.log('SW skipped (compat):', e); }
      };
      registerServiceWorker._veilAndroid = true;
    }
  }

  function tuneHarmonyFetch() {
    VeilCompat.util.wrapFetchWithTimeout(60000);
  }

  function tuneDesktopSafariAudio() {
    VeilCompat.util.unlockAudioOnGesture();
  }

  VeilCompat.registerTuning('ios-webkit', '43_audio_queue', tuneIOSAudio);
  VeilCompat.registerTuning('ios-webkit', '00_preamble', tuneIOSVideo);
  VeilCompat.registerTuning('ios-webkit', '22_streaming', tuneIOSMic);
  VeilCompat.registerTuning('ios-webkit', '38_permission_prompts', tuneIOSMic);
  VeilCompat.registerTuning('ios-webkit', '67_startup_intro', tuneIOSVideo);

  VeilCompat.registerTuning('android-chrome', '43_audio_queue', tuneAndroidFetch);
  VeilCompat.registerTuning('android-chrome', '22_streaming', tuneAndroidFetch);
  VeilCompat.registerTuning('android-chrome', '06_service_worker', tuneAndroidSW);
  VeilCompat.registerTuning('android-chrome', '29_send_message', tuneAndroidFetch);

  ['android-samsung', 'android-xiaomi', 'android-vivo', 'android-oppo', 'android-transsion', 'android-motorola', 'android-realme'].forEach(function(p) {
    VeilCompat.registerTuning(p, '43_audio_queue', tuneAndroidFetch);
    VeilCompat.registerTuning(p, '22_streaming', tuneAndroidFetch);
    VeilCompat.registerTuning(p, '06_service_worker', tuneAndroidSW);
  });

  VeilCompat.registerTuning('harmonyos', '43_audio_queue', tuneHarmonyFetch);
  VeilCompat.registerTuning('harmonyos', '22_streaming', tuneHarmonyFetch);

  VeilCompat.registerTuning('desktop-safari', '43_audio_queue', tuneDesktopSafariAudio);
  VeilCompat.registerTuning('desktop-safari', '00_preamble', tuneIOSVideo);

  VeilCompat.registerTuning('desktop-firefox', '43_audio_queue', function() {
    VeilCompat.util.unlockAudioOnGesture();
  });

  VeilCompat.registerTuning('desktop-edge', '43_audio_queue', tuneDesktopSafariAudio);
  VeilCompat.registerTuning('desktop-chrome', '43_audio_queue', function() {});

  function tuneAutomationLowPower() {
    if (!window.VeilPlatform || !window.VeilPlatform.isAutomation) return;
    if (typeof window._lowPowerMode !== 'undefined') window._lowPowerMode = false;
    try { localStorage.setItem('veil_power_mode', 'full'); } catch (e) {}
    var bg = document.getElementById('bg');
    if (bg && bg.style.display === 'none') {
      bg.style.display = '';
      if (typeof initCanvas === 'function' && typeof particles !== 'undefined' && particles.length === 0) {
        try { initCanvas(); } catch (e2) {}
      }
    }
  }

  VeilCompat.registerTuning('desktop-chrome', '17_low_power', tuneAutomationLowPower);
  VeilCompat.registerTuning('desktop-edge', '17_low_power', tuneAutomationLowPower);

  VeilCompat._CRITICAL_MODULES = CRITICAL;
})();
