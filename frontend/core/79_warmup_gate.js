// ============================================================
// STARTUP WARMUP GATE — keep first ~60s light (intro → chat)
// Background systems load after warmup or first user message.
// ============================================================
(function() {
  'use strict';

  var WARMUP_MS = 60000;
  var engaged = false;
  var until = Date.now() + WARMUP_MS;
  var queue = [];

  function flush() {
    var pending = queue.slice();
    queue = [];
    pending.forEach(function(fn) {
      try { fn(); } catch (e) { console.warn('[WarmupGate]', e); }
    });
  }

  window._veilWarmupActive = function() {
    return !engaged && Date.now() < until;
  };

  window._veilMarkChatEngaged = function() {
    if (engaged) return;
    engaged = true;
    flush();
  };

  window._veilAfterWarmup = function(fn) {
    if (!fn) return;
    if (!window._veilWarmupActive()) {
      try { fn(); } catch (e) { console.warn('[WarmupGate]', e); }
      return;
    }
    queue.push(fn);
  };

  setTimeout(function() {
    if (!engaged) engaged = true;
    flush();
  }, WARMUP_MS);

  function hookChatEngagement() {
    var tries = 0;
    var timer = setInterval(function() {
      tries++;
      if (tries > 240) { clearInterval(timer); return; }

      if (typeof window.sendMessage === 'function' && !window._veilWarmupSendHook) {
        window._veilWarmupSendHook = true;
        var origSend = window.sendMessage;
        window.sendMessage = function() {
          var result = origSend.apply(this, arguments);
          if (typeof state !== 'undefined' && state.user) window._veilMarkChatEngaged();
          return result;
        };
      }

      if (typeof window.sendGuestMessage === 'function' && !window._veilWarmupGuestHook) {
        window._veilWarmupGuestHook = true;
        var origGuest = window.sendGuestMessage;
        window.sendGuestMessage = function() {
          var result = origGuest.apply(this, arguments);
          window._veilMarkChatEngaged();
          return result;
        };
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookChatEngagement);
  } else {
    hookChatEngagement();
  }

  console.log('[WarmupGate] First-minute path protected for', WARMUP_MS / 1000, 'seconds');
})();
