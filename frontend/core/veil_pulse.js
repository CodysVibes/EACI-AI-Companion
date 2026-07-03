// ============================================================
// VEIL PULSE — Central lifecycle scheduler for EACI background work
// Tiers: active (recent interaction), warm (foreground idle), frozen (hidden)
// ============================================================
var VeilPulse = (function() {
  'use strict';

  var TIER = { FROZEN: 'frozen', WARM: 'warm', ACTIVE: 'active' };
  var _tier = TIER.WARM;
  var _lastUserActivity = Date.now();
  var _jobs = {};
  var _jobId = 0;
  var _heartbeat = null;
  var HEARTBEAT_MS = 2000;
  var ACTIVE_MS = 3 * 60 * 1000;
  var WARM_MULT = 2;

  function _isForeground() {
    return !document.hidden && document.visibilityState === 'visible';
  }

  function _recomputeTier() {
    if (!_isForeground()) {
      _tier = TIER.FROZEN;
      return;
    }
    if (Date.now() - _lastUserActivity < ACTIVE_MS) {
      _tier = TIER.ACTIVE;
      return;
    }
    _tier = TIER.WARM;
  }

  function getTier() {
    _recomputeTier();
    return _tier;
  }

  function bumpActivity(reason) {
    _lastUserActivity = Date.now();
    _tier = TIER.ACTIVE;
    if (typeof window.veilOnUserActivity === 'function') {
      try { window.veilOnUserActivity(reason || 'activity'); } catch (e) {}
    }
  }

  function isForeground() {
    return _isForeground();
  }

  function isFrozen() {
    return getTier() === TIER.FROZEN;
  }

  function shouldRunBackground() {
    return _isForeground();
  }

  function scale(ms, opts) {
    opts = opts || {};
    if (!_isForeground()) return opts.hidden || 300000;
    var t = getTier();
    if (t === TIER.WARM) return Math.round(ms * (opts.warmMult || WARM_MULT));
    return ms;
  }

  function register(name, fn, intervalMs, opts) {
    opts = opts || {};
    var id = ++_jobId;
    _jobs[id] = {
      name: name || ('job_' + id),
      fn: fn,
      interval: intervalMs,
      opts: opts,
      lastRun: 0
    };
    _ensureHeartbeat();
    return id;
  }

  function unregister(id) {
    if (!id) return;
    delete _jobs[id];
    if (!_heartbeat) return;
    if (Object.keys(_jobs).length === 0) {
      clearInterval(_heartbeat);
      _heartbeat = null;
    }
  }

  function _ensureHeartbeat() {
    if (_heartbeat) return;
    _heartbeat = setInterval(_tick, HEARTBEAT_MS);
  }

  function _tick() {
    _recomputeTier();
    if (_tier === TIER.FROZEN) return;
    var now = Date.now();
    Object.keys(_jobs).forEach(function(id) {
      var job = _jobs[id];
      if (job.opts.when && !job.opts.when()) return;
      if (job.opts.tier === 'active' && _tier !== TIER.ACTIVE) return;
      var eff = scale(job.interval, job.opts);
      if (now - job.lastRun >= eff) {
        job.lastRun = now;
        try { job.fn(); } catch (e) {
          console.warn('[VeilPulse]', job.name, e);
        }
      }
    });
  }

  document.addEventListener('visibilitychange', function() {
    if (!_isForeground()) return;
    bumpActivity('visibility');
    if (typeof generateThought === 'function' && typeof THOUGHT_SPEC !== 'undefined' && THOUGHT_SPEC.showThoughts) {
      setTimeout(function() {
        if (typeof state !== 'undefined' && (state.currentTab === 'caelum' || state.currentTab === 'together')) {
          generateThought();
        }
      }, 900);
    }
  });

  ['pointerdown', 'keydown', 'touchstart'].forEach(function(ev) {
    document.addEventListener(ev, function() { bumpActivity(ev); }, { passive: true, capture: true });
  });

  return {
    TIER: TIER,
    register: register,
    unregister: unregister,
    bumpActivity: bumpActivity,
    getTier: getTier,
    isForeground: isForeground,
    isFrozen: isFrozen,
    shouldRunBackground: shouldRunBackground,
    scale: scale,
    WARM_MULT: WARM_MULT,
    ACTIVE_MS: ACTIVE_MS
  };
})();
