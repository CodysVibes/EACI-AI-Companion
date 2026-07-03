// ============================================================
// VISITOR FUNNEL TRACKER v2 — lands, messages, signups, paid
// Dashboard: the-veil-analytics-console-v14
// ============================================================
var FunnelTracker = (function() {
  var VISITOR_KEY = 'veil_visitor_id';
  var SESSION_KEY = 'veil_funnel_session_id';
  var _queue = [];
  var _flushTimer = null;
  var _sessionStart = Date.now();
  var _lastStep = 'page_load';
  var _lastEvent = 'page_load';
  var _hadError = false;
  var _lastErrorType = '';
  var _human = false;
  var _guestMessages = 0;
  var _userMessages = 0;
  var _interactions = 0;
  var _signupStarted = false;
  var _signupStep = '';
  var _loadMs = null;
  var _landing = {};
  var _botUa = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|bytespider|gptbot|claudebot/i;
  var _sessionRowCreated = false;
  var _initDone = false;

  function _visitorId() {
    var id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function _sessionId() {
    var id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function _deviceType() {
    var w = window.innerWidth || 0;
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return w < 768 ? 'mobile' : 'tablet';
    return 'desktop';
  }

  function _isBotUa() {
    return _botUa.test(navigator.userAgent || '');
  }

  function _attribution() {
    var params = new URLSearchParams(location.search);
    var ref = document.referrer || '';
    var refHost = '';
    try { refHost = ref ? new URL(ref).hostname : ''; } catch (e) { /* ignore */ }
    var utmSource = params.get('utm_source') || '';
    var source = utmSource || refHost || '(direct)';
    return {
      utm_source: utmSource,
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      referrer: ref.substring(0, 500),
      referrer_host: refHost,
      landing_path: (location.pathname || '/') + (location.search || ''),
      traffic_source: source
    };
  }

  function _markHuman() {
    if (_human) return;
    _human = true;
    track('human_interaction', { funnel_step: _lastStep, source: 'interaction' });
  }

  function track(eventName, opts) {
    if (_isBotUa()) return;
    opts = opts || {};
    var step = opts.funnel_step || eventName;
    _lastStep = step;
    _lastEvent = eventName;
    try { window._veilLastFunnelStep = step; } catch (e) { /* ignore */ }
    if (opts.guest_messages != null) _guestMessages = opts.guest_messages;
    if (opts.user_messages != null) _userMessages = opts.user_messages;
    if (opts.signup_started) _signupStarted = true;
    if (opts.signup_step) _signupStep = opts.signup_step;

    var now = Date.now();
    var meta = Object.assign({}, opts.metadata || {});
    if (_landing.traffic_source) meta.traffic_source = _landing.traffic_source;

    var entry = {
      visitor_id: _visitorId(),
      session_id: _sessionId(),
      event_name: eventName,
      funnel_step: step,
      page_path: location.pathname || '/',
      duration_ms: now - _sessionStart,
      metadata: meta,
      user_agent: (navigator.userAgent || '').substring(0, 500),
      referrer: (_landing.referrer || document.referrer || '').substring(0, 500),
      viewport_w: window.innerWidth || null,
      viewport_h: window.innerHeight || null,
      is_authenticated: !!(typeof state !== 'undefined' && state && state.user),
      is_human_signal: _human,
      had_error: _hadError
    };
    if (opts.metadata && opts.metadata.error_type) {
      entry.metadata.error_type = opts.metadata.error_type;
    }
    _queue.push(entry);
    if (_queue.length >= 6) _flush();
    else if (!_flushTimer) _flushTimer = setTimeout(_flush, 1500);
    if (eventName === 'page_load' || eventName === 'landing' || eventName === 'session_end') {
      setTimeout(_flush, 400);
    }
  }

  function noteError(errorType, message) {
    var msg = String(message || '').trim();
    if (!msg && !errorType) return;
    _hadError = true;
    _lastErrorType = errorType || 'unknown';
    track('client_error', {
      funnel_step: _lastStep,
      metadata: { error_type: _lastErrorType, message: String(message || '').substring(0, 300) }
    });
  }

  function _inferDropReason() {
    if (_hadError) return 'error_before_exit';
    if (!_human && _guestMessages === 0 && _userMessages === 0) {
      if (_loadMs != null && _loadMs > 6000) return 'slow_load_no_interaction';
      return 'silent_bounce';
    }
    if (_guestMessages === 0 && _userMessages === 0 && _lastStep.indexOf('guest') !== -1) return 'guest_no_message';
    if (typeof guestState !== 'undefined' && guestState.awaitingConsent) return 'abandoned_at_signup_invite';
    if (_signupStarted && !(_lastStep === 'signup_complete' || _lastStep === 'login_success')) {
      return 'abandoned_signup_' + (_signupStep || 'unknown');
    }
    if (_lastStep === 'auth_login_shown') return 'left_at_login';
    return 'left_at_' + _lastStep;
  }

  function _sessionPayload(dropReason) {
    return {
      session_id: _sessionId(),
      visitor_id: _visitorId(),
      updated_at: new Date().toISOString(),
      ended_at: dropReason ? new Date().toISOString() : null,
      last_funnel_step: _lastStep,
      last_event_name: _lastEvent,
      drop_reason: dropReason || null,
      total_duration_ms: Date.now() - _sessionStart,
      guest_messages: _guestMessages,
      user_interactions: _interactions,
      signup_started: _signupStarted,
      signup_step: _signupStep || null,
      converted_signup: _lastStep === 'signup_complete',
      converted_login: _lastStep === 'login_success',
      load_ms: _loadMs,
      device_type: _deviceType(),
      referrer: (_landing.referrer || document.referrer || '').substring(0, 500),
      entry_path: _landing.landing_path || location.pathname || '/',
      user_agent: (navigator.userAgent || '').substring(0, 500),
      is_human_signal: _human,
      had_error: _hadError,
      metadata: {
        last_error_type: _lastErrorType || null,
        user_messages: _userMessages,
        converted_paid: _lastStep === 'subscription_complete',
        traffic_source: _landing.traffic_source || null,
        utm_source: _landing.utm_source || null,
        utm_medium: _landing.utm_medium || null,
        referrer_host: _landing.referrer_host || null
      }
    };
  }

  async function _restHeaders(extra) {
    var token = SUPABASE_ANON_KEY;
    try {
      if (typeof supabase !== 'undefined' && supabase.auth && supabase.auth.getSession) {
        var sess = await supabase.auth.getSession();
        if (sess.data && sess.data.session && sess.data.session.access_token) {
          token = sess.data.session.access_token;
        }
      }
    } catch (e) { /* ignore */ }
    var h = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json; charset=utf-8'
    };
    if (extra) { for (var k in extra) h[k] = extra[k]; }
    return h;
  }

  async function _syncSession(dropReason) {
    var payload = _sessionPayload(dropReason);
    var sid = encodeURIComponent(payload.session_id);
    var headers = await _restHeaders({ 'Prefer': 'return=minimal' });

    if (!_sessionRowCreated) {
      var postRes = await fetch(SUPABASE_URL + '/rest/v1/visitor_sessions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      if (postRes.ok) {
        _sessionRowCreated = true;
        return null;
      }
      if (postRes.status !== 409 && postRes.status !== 400) {
        return await postRes.text().catch(function() { return ''; });
      }
      _sessionRowCreated = true;
    }

    var patchRes = await fetch(SUPABASE_URL + '/rest/v1/visitor_sessions?session_id=eq.' + sid, {
      method: 'PATCH',
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (patchRes.ok) return null;
    return await patchRes.text().catch(function() { return ''; });
  }

  async function _flush() {
    _flushTimer = null;
    if (_queue.length === 0 || typeof SUPABASE_URL === 'undefined') return;
    var batch = _queue.splice(0, _queue.length);
    try {
      var evHeaders = await _restHeaders({ 'Prefer': 'return=minimal' });
      var evRes = await fetch(SUPABASE_URL + '/rest/v1/visitor_events', {
        method: 'POST',
        headers: evHeaders,
        body: JSON.stringify(batch)
      });
      if (!evRes.ok) {
        var errBody = await evRes.text().catch(function() { return ''; });
        console.warn('[FunnelTracker] events HTTP ' + evRes.status, errBody);
      }
      var sessErr = await _syncSession(null);
      if (sessErr) console.warn('[FunnelTracker] session HTTP error', sessErr);
    } catch (e) {
      console.warn('[FunnelTracker] flush failed', e);
      if (_queue.length < 40) _queue = batch.concat(_queue);
    }
  }

  function _finalizeSession() {
    if (_isBotUa()) return;
    var reason = _inferDropReason();
    track('session_end', { funnel_step: _lastStep, metadata: { drop_reason: reason } });
    _syncSession(reason).catch(function() {});
    _flush();
  }

  function guestMessageSent() {
    _guestMessages++;
    _markHuman();
    if (_guestMessages === 1) {
      track('guest_first_message', { funnel_step: 'guest_first_message', guest_messages: 1 });
      track('message_sent', { funnel_step: 'message_sent', guest_messages: 1, metadata: { kind: 'guest' } });
    } else {
      track('guest_message', { funnel_step: 'guest_message', guest_messages: _guestMessages });
      track('message_sent', { funnel_step: 'message_sent', guest_messages: _guestMessages, metadata: { kind: 'guest' } });
    }
  }

  function userMessageSent() {
    _userMessages++;
    _markHuman();
    if (_userMessages === 1) {
      track('user_first_message', { funnel_step: 'user_first_message', user_messages: 1 });
      track('message_sent', { funnel_step: 'message_sent', user_messages: 1, metadata: { kind: 'user' } });
    } else {
      track('user_message', { funnel_step: 'user_message', user_messages: _userMessages });
      track('message_sent', { funnel_step: 'message_sent', user_messages: _userMessages, metadata: { kind: 'user' } });
    }
  }

  function _hookSendMessage() {
    var tries = 0;
    var timer = setInterval(function() {
      tries++;
      if (tries > 240) { clearInterval(timer); return; }
      if (typeof window.sendMessage !== 'function' || window._funnelSendHook) return;
      window._funnelSendHook = true;
      clearInterval(timer);
      var orig = window.sendMessage;
      window.sendMessage = function() {
        var result = orig.apply(this, arguments);
        if (typeof state !== 'undefined' && state.user) userMessageSent();
        return result;
      };
    }, 250);
  }

  function _checkSubscriptionReturn() {
    try {
      var params = new URLSearchParams(location.search);
      if (params.get('subscription') === 'success') {
        var dedupeKey = 'veil_subscription_complete_tracked';
        if (!sessionStorage.getItem(dedupeKey)) {
          sessionStorage.setItem(dedupeKey, '1');
          track('subscription_complete', {
            funnel_step: 'subscription_complete',
            metadata: { tier: params.get('tier') || 'unknown' }
          });
        }
        params.delete('subscription');
        params.delete('tier');
        var qs = params.toString();
        history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
      }
    } catch (e) { /* ignore */ }
  }

  function init() {
    if (_initDone) return;
    _initDone = true;
    if (_isBotUa()) return;

    _landing = _attribution();

    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) _loadMs = Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd || 0);
    } catch (e) { /* ignore */ }

    track('page_load', {
      funnel_step: 'page_load',
      metadata: Object.assign({ load_ms: _loadMs, viewport: _deviceType() }, _landing)
    });
    track('landing', {
      funnel_step: 'landing',
      metadata: _landing
    });

    _checkSubscriptionReturn();
    _hookSendMessage();

    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function(ev) {
      document.addEventListener(ev, function once() {
        _interactions++;
        _markHuman();
      }, { once: true, passive: true });
    });

    window.addEventListener('pagehide', _finalizeSession);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') _finalizeSession();
    });

    if (typeof logError === 'function') {
      var _origLogError = logError;
      window.logError = function(type, msg, stack, endpoint, meta) {
        noteError(type, msg);
        return _origLogError(type, msg, stack, endpoint, meta);
      };
    }
  }

  return {
    init: init,
    track: track,
    noteError: noteError,
    guestMessageSent: guestMessageSent,
    userMessageSent: userMessageSent,
    markHuman: _markHuman
  };
})();

window.trackFunnel = function(name, opts) { FunnelTracker.track(name, opts || {}); };

document.addEventListener('DOMContentLoaded', function() { FunnelTracker.init(); });
if (document.readyState !== 'loading') FunnelTracker.init();
