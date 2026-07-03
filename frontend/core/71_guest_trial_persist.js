// ============================================================
// GUEST TRIAL PERSISTENCE — 25 free messages per device until signup
// Requires: supabase/migrations/20260620_guest_trial_devices.sql
// ============================================================
var GuestTrial = (function() {
  var STORAGE_KEY = 'veil_guest_trial_v1';
  var VISITOR_KEY = 'veil_visitor_id';
  var MAX_MESSAGES = typeof GUEST_MAX_MESSAGES !== 'undefined' ? GUEST_MAX_MESSAGES : 25;
  var _loaded = false;
  var _messagesUsed = 0;
  var _visitCount = 0;
  var _syncTimer = null;

  function visitorId() {
    var id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function _readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || d.visitorId !== visitorId()) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  function _writeLocal(patch) {
    var d = _readLocal() || { visitorId: visitorId(), messagesUsed: 0, visitCount: 0 };
    for (var k in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) d[k] = patch[k];
    }
    d.visitorId = visitorId();
    d.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    return d;
  }

  async function _restHeaders() {
    var token = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
    try {
      if (typeof supabase !== 'undefined' && supabase.auth && supabase.auth.getSession) {
        var sess = await supabase.auth.getSession();
        if (sess.data && sess.data.session && sess.data.session.access_token) {
          token = sess.data.session.access_token;
        }
      }
    } catch (e) {}
    return {
      'apikey': typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : token,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json; charset=utf-8'
    };
  }

  async function _fetchServerRow() {
    if (typeof SUPABASE_URL === 'undefined') return null;
    try {
      var vid = encodeURIComponent(visitorId());
      var headers = await _restHeaders();
      var res = await fetch(SUPABASE_URL + '/rest/v1/guest_trial_devices?visitor_id=eq.' + vid + '&select=messages_used,visit_count,trial_exhausted,converted_signup', {
        method: 'GET',
        headers: headers
      });
      if (!res.ok) return null;
      var rows = await res.json();
      return rows && rows[0] ? rows[0] : null;
    } catch (e) {
      return null;
    }
  }

  function _deviceType() {
    var w = window.innerWidth || 0;
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return w < 768 ? 'mobile' : 'tablet';
    return 'desktop';
  }

  async function _syncServer(force) {
    if (typeof SUPABASE_URL === 'undefined') return;
    var payload = {
      visitor_id: visitorId(),
      messages_used: _messagesUsed,
      visit_count: _visitCount,
      trial_exhausted: _messagesUsed >= MAX_MESSAGES,
      last_seen_at: new Date().toISOString(),
      last_device_type: _deviceType(),
      metadata: { last_sync: new Date().toISOString() }
    };
    try {
      var headers = await _restHeaders();
      headers['Prefer'] = 'resolution=merge-duplicates,return=minimal';
      await fetch(SUPABASE_URL + '/rest/v1/guest_trial_devices', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
    } catch (e) {
      if (typeof console !== 'undefined') console.warn('[GuestTrial] sync failed', e);
    }
  }

  function _scheduleSync() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function() {
      _syncTimer = null;
      _syncServer(false);
    }, 800);
  }

  async function ensureLoaded() {
    if (_loaded) return _messagesUsed;
    var local = _readLocal();
    var localUsed = local ? (local.messagesUsed || 0) : 0;
    var localVisits = local ? (local.visitCount || 0) : 0;
    var server = await _fetchServerRow();
    if (server && server.converted_signup) {
      _messagesUsed = MAX_MESSAGES;
      _visitCount = localVisits;
      _loaded = true;
      return _messagesUsed;
    }
    var serverUsed = server ? (server.messages_used || 0) : 0;
    _messagesUsed = Math.max(localUsed, serverUsed);
    _visitCount = Math.max(localVisits, server ? (server.visit_count || 0) : 0);
    _writeLocal({ messagesUsed: _messagesUsed, visitCount: _visitCount });
    _loaded = true;
    return _messagesUsed;
  }

  function getMessagesUsed() {
    return _messagesUsed;
  }

  function getRemaining() {
    return Math.max(0, MAX_MESSAGES - _messagesUsed);
  }

  function isExhausted() {
    return _messagesUsed >= MAX_MESSAGES;
  }

  function recordVisit() {
    _visitCount = (_visitCount || 0) + 1;
    _writeLocal({ messagesUsed: _messagesUsed, visitCount: _visitCount });
    _scheduleSync();
    if (typeof trackFunnel === 'function') {
      trackFunnel('guest_trial_return', {
        funnel_step: 'guest_trial_return',
        metadata: { messages_used: _messagesUsed, visit_count: _visitCount, returning: _visitCount > 1 }
      });
    }
  }

  function increment() {
    _messagesUsed = Math.min(MAX_MESSAGES, _messagesUsed + 1);
    _writeLocal({ messagesUsed: _messagesUsed, visitCount: _visitCount });
    _scheduleSync();
    if (typeof trackFunnel === 'function') {
      trackFunnel('guest_trial_message', {
        funnel_step: 'guest_trial_message',
        guest_messages: _messagesUsed,
        metadata: { cumulative_device_messages: _messagesUsed, remaining: getRemaining() }
      });
    }
    return _messagesUsed;
  }

  async function markConverted() {
    _messagesUsed = MAX_MESSAGES;
    _writeLocal({ messagesUsed: _messagesUsed, visitCount: _visitCount, converted: true });
    if (typeof SUPABASE_URL === 'undefined') return;
    try {
      var headers = await _restHeaders();
      headers['Prefer'] = 'return=minimal';
      await fetch(SUPABASE_URL + '/rest/v1/guest_trial_devices?visitor_id=eq.' + encodeURIComponent(visitorId()), {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          converted_signup: true,
          trial_exhausted: true,
          messages_used: MAX_MESSAGES,
          last_seen_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }

  function clearLocal() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    _messagesUsed = 0;
    _visitCount = 0;
    _loaded = false;
  }

  return {
    ensureLoaded: ensureLoaded,
    recordVisit: recordVisit,
    increment: increment,
    markConverted: markConverted,
    clearLocal: clearLocal,
    getMessagesUsed: getMessagesUsed,
    getRemaining: getRemaining,
    isExhausted: isExhausted,
    visitorId: visitorId,
    maxMessages: function() { return MAX_MESSAGES; }
  };
})();
