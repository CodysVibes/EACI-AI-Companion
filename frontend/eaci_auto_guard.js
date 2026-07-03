// ============================================================
// EACI AUTO MESSAGE GUARD — rate limit, dedupe, loop prevention
// All EACI-initiated chat lines should pass through recordEaciOutbound,
// which consults this module. Auto messages never call recordApiCall().
// ============================================================
var EaciAutoGuard = (function() {
  'use strict';

  var MIN_GAP_MS = 3 * 60000;           // 3 min between any auto line in chat
  var MIN_INITIATIVE_GAP_MS = 12 * 60000; // 12 min between reach-out / check-in
  var MAX_PER_HOUR = 8;
  var SIMILAR_THRESHOLD = 0.65;

  var _lastAnyAt = 0;
  var _lastInitiativeAt = 0;
  var _inFlight = false;
  var _recentNorms = [];
  var _hourTimestamps = [];

  var INITIATIVE_SOURCES = {
    initiative_felt_hollow: 1,
    initiative_wanted_love: 1,
    initiative_idle_presence: 1,
    initiative_follow_up: 1,
    idle_checkin: 1,
    notification_checkin: 1,
    session_return: 1
  };

  function _norm(text) {
    return String(text || '').toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _wordOverlap(a, b) {
    if (!a || !b) return 0;
    var wa = a.split(' ').filter(Boolean);
    var wb = b.split(' ').filter(Boolean);
    if (!wa.length || !wb.length) return 0;
    var set = {};
    wa.forEach(function(w) { set[w] = 1; });
    var inter = 0;
    wb.forEach(function(w) { if (set[w]) inter++; });
    return inter / Math.max(wa.length, wb.length, 1);
  }

  function isInitiativeSource(source) {
    if (!source) return false;
    if (INITIATIVE_SOURCES[source]) return true;
    return source.indexOf('initiative_') === 0;
  }

  function canSend(opts) {
    opts = opts || {};
    var now = Date.now();
    var source = opts.source || '';

    if (typeof state !== 'undefined') {
      if (state.isSending || state.isPlayingAudio || state._veilGameActive) {
        return { ok: false, reason: 'busy' };
      }
    }
    if (_inFlight && !opts.force) return { ok: false, reason: 'in_flight' };

    var gap = isInitiativeSource(source) ? MIN_INITIATIVE_GAP_MS : MIN_GAP_MS;
    var since = isInitiativeSource(source)
      ? (now - _lastInitiativeAt)
      : (now - _lastAnyAt);
    if (since < gap && !opts.force) return { ok: false, reason: 'cooldown' };

    _hourTimestamps = _hourTimestamps.filter(function(t) { return now - t < 3600000; });
    if (_hourTimestamps.length >= MAX_PER_HOUR && !opts.force) {
      return { ok: false, reason: 'hourly_cap' };
    }

    return { ok: true };
  }

  function isTooSimilar(text) {
    var n = _norm(text);
    if (n.length < 10) return false;
    for (var i = 0; i < _recentNorms.length; i++) {
      var prev = _recentNorms[i];
      if (_wordOverlap(n, prev) >= SIMILAR_THRESHOLD) return true;
      if (n.length > 24 && prev.length > 24) {
        if (n.indexOf(prev.substring(0, 28)) >= 0 || prev.indexOf(n.substring(0, 28)) >= 0) {
          return true;
        }
      }
    }
    return false;
  }

  function register(text, opts) {
    opts = opts || {};
    var now = Date.now();
    _lastAnyAt = now;
    if (isInitiativeSource(opts.source)) _lastInitiativeAt = now;
    _hourTimestamps.push(now);
    var n = _norm(text);
    if (n) {
      _recentNorms.unshift(n);
      if (_recentNorms.length > 24) _recentNorms.pop();
    }
  }

  function begin() { _inFlight = true; }
  function end() { _inFlight = false; }

  function noteUserActivity() {
    _lastAnyAt = Date.now();
  }

  return {
    canSend: canSend,
    isTooSimilar: isTooSimilar,
    register: register,
    begin: begin,
    end: end,
    noteUserActivity: noteUserActivity,
    isInitiativeSource: isInitiativeSource,
    MIN_INITIATIVE_GAP_MS: MIN_INITIATIVE_GAP_MS
  };
})();
