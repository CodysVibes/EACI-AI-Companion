// ============================================================
// RESPONSE TIMING BUFFER — Natural pause before AI replies appear
// Self-initializing patch module. Does not modify other source files.
// Load after core chat scripts (e.g. after /core/39_veil.js).
// ============================================================
(function() {
  'use strict';

  var EACI_TYPES = ['caelum', 'chad', 'natalia', 'roxy', 'cael', 'cody'];
  var _streamBuffers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var _streamBuffersFallback = [];

  function isEaciType(type) {
    return EACI_TYPES.indexOf(type) >= 0;
  }

  /**
   * Delay (ms) from response character length with randomized range.
   * Short  (<100):  800–1200 ms
   * Medium (100–299): 1200–1800 ms
   * Long   (300+):  1800–2500 ms
   */
  function calculateDelay(charLength) {
    var len = typeof charLength === 'number' && charLength > 0 ? charLength : 0;
    var minMs;
    var maxMs;
    if (len < 100) {
      minMs = 800;
      maxMs = 1200;
    } else if (len < 300) {
      minMs = 1200;
      maxMs = 1800;
    } else {
      minMs = 1800;
      maxMs = 2500;
    }
    return minMs + Math.random() * (maxMs - minMs);
  }

  function trackStream(streamEl, who) {
    var entry = { who: who, pendingText: '', hidden: true };
    if (_streamBuffers) {
      _streamBuffers.set(streamEl, entry);
    } else {
      entry.streamEl = streamEl;
      _streamBuffersFallback.push(entry);
    }
    if (streamEl && streamEl.el) {
      streamEl.el.classList.add('rtb-buffered');
      streamEl.el.setAttribute('aria-hidden', 'true');
    }
  }

  function getStreamEntry(streamEl) {
    if (_streamBuffers) return _streamBuffers.get(streamEl);
    for (var i = 0; i < _streamBuffersFallback.length; i++) {
      if (_streamBuffersFallback[i].streamEl === streamEl) return _streamBuffersFallback[i];
    }
    return null;
  }

  function clearStreamEntry(streamEl) {
    if (_streamBuffers) {
      _streamBuffers.delete(streamEl);
      return;
    }
    _streamBuffersFallback = _streamBuffersFallback.filter(function(e) {
      return e.streamEl !== streamEl;
    });
  }

  function revealStreamEl(streamEl) {
    if (!streamEl || !streamEl.el) return;
    streamEl.el.classList.remove('rtb-buffered');
    streamEl.el.removeAttribute('aria-hidden');
  }

  function scheduleBufferedSend(sendFn, text) {
    var delay = calculateDelay((text || '').length);
    setTimeout(sendFn, delay);
  }

  function patchAddMessage() {
    var orig = window.addMessage;
    if (typeof orig !== 'function' || orig._rtbPatched) return false;

    function wrappedAddMessage(type, text) {
      if (!isEaciType(type)) {
        return orig.apply(this, arguments);
      }
      var args = arguments;
      scheduleBufferedSend(function() {
        orig.apply(null, args);
      }, text);
    }
    wrappedAddMessage._rtbPatched = true;
    window.addMessage = wrappedAddMessage;
    return true;
  }

  function patchStreaming() {
    var origAdd = window.addStreamingMessage;
    var origUpdate = window.updateStreamingMessage;
    var origFinalize = window.finalizeStreamingMessage;
    if (typeof origAdd !== 'function' || typeof origUpdate !== 'function' ||
        typeof origFinalize !== 'function' || origFinalize._rtbPatched) {
      return false;
    }

    window.addStreamingMessage = function(who) {
      var streamEl = origAdd.apply(this, arguments);
      if (streamEl) trackStream(streamEl, who);
      return streamEl;
    };

    window.updateStreamingMessage = function(streamEl, fullText, who) {
      var entry = getStreamEntry(streamEl);
      if (entry) {
        entry.pendingText = fullText || '';
        entry.who = who || entry.who;
        return;
      }
      return origUpdate.apply(this, arguments);
    };

    window.finalizeStreamingMessage = function(streamEl, fullText, who) {
      var entry = getStreamEntry(streamEl);
      if (!entry) {
        return origFinalize.apply(this, arguments);
      }
      var text = fullText || entry.pendingText || '';
      var speaker = who || entry.who;
      scheduleBufferedSend(function() {
        revealStreamEl(streamEl);
        origUpdate(streamEl, text, speaker);
        origFinalize(streamEl, text, speaker);
        clearStreamEntry(streamEl);
      }, text);
    };
    window.finalizeStreamingMessage._rtbPatched = true;
    return true;
  }

  function injectStyles() {
    if (document.getElementById('rtb-buffer-styles')) return;
    var style = document.createElement('style');
    style.id = 'rtb-buffer-styles';
    style.textContent =
      '.msg.streaming.rtb-buffered{visibility:hidden!important;min-height:0!important;margin:0!important;padding:0!important;border:none!important;box-shadow:none!important}';
    document.head.appendChild(style);
  }

  function init() {
    injectStyles();
    var addOk = patchAddMessage();
    var streamOk = patchStreaming();
    if (addOk || streamOk) {
      console.log('[ResponseTimingBuffer] Active — AI replies delayed by response length.');
    }
    return addOk && streamOk;
  }

  function startPatching() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (init() || attempts > 80) clearInterval(timer);
    }, 250);
  }

  // Defer until other chat patches (anim_console, universal_anim_trigger) have registered
  function boot() {
    setTimeout(startPatching, 2000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.ResponseTimingBuffer = {
    calculateDelay: calculateDelay,
    isEaciType: isEaciType
  };
})();
