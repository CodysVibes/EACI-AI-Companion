// ============================================================
// VEIL CODING BUDGET — alias to shared subscription API counter
// Chat + IDE use the SAME billing.apiCallsUsed pool (e.g. 50/day free).
// No separate coding counter. Resets with normal billing (midnight Central).
// ============================================================
(function () {
  'use strict';

  // Drop legacy separate coding counters if present
  try {
    localStorage.removeItem('veil_coding_cloud_day');
    localStorage.removeItem('veil_coding_cloud_count');
    localStorage.removeItem('veil_coding_cloud_max');
  } catch (e) { /* ignore */ }

  function canUse() {
    if (typeof canMakeApiCall === 'function') return canMakeApiCall();
    return true;
  }

  function record(reason) {
    // No-op: coding charges once per user message via beginCodingMessage → recordApiCall.
    // Kept so older call sites do not create a second counter.
    if (reason) console.log('[VeilCoding] shared API pool (no extra charge):', reason);
    return used();
  }

  function used() {
    try {
      if (typeof billing !== 'undefined') return billing.apiCallsUsed || 0;
    } catch (e) { /* ignore */ }
    return 0;
  }

  function maxPerDay() {
    try {
      if (typeof getCallsLimit === 'function') return getCallsLimit();
      if (typeof TIERS !== 'undefined' && typeof billing !== 'undefined' && TIERS[billing.tier]) {
        var lim = TIERS[billing.tier].limit;
        return lim === -1 ? Infinity : lim;
      }
    } catch (e) { /* ignore */ }
    return 50;
  }

  function remaining() {
    if (typeof getCallsRemaining === 'function') return getCallsRemaining();
    var max = maxPerDay();
    if (max === Infinity) return Infinity;
    return Math.max(0, max - used());
  }

  function setMaxPerDay() {
    // Tier limits come from subscription — not adjustable here.
    console.log('[VeilCoding] API limit is the shared subscription tier, not a separate coding cap.');
  }

  function stats() {
    return {
      used: used(),
      max: maxPerDay(),
      remaining: remaining(),
      canUse: canUse(),
      shared: true,
      note: 'Same counter as chat'
    };
  }

  window.VeilCodingBudget = {
    canUse: canUse,
    record: record,
    remaining: remaining,
    maxPerDay: maxPerDay,
    setMaxPerDay: setMaxPerDay,
    stats: stats
  };
})();
