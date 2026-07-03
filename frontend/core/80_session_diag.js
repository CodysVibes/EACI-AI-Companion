// ============================================================
// SESSION DIAGNOSTICS — console ring buffer + error log table
// No PII: anonymous session/visitor ids, sanitized messages only
// ============================================================
(function() {
  'use strict';

  var CONSOLE_RING_MAX = 100;
  var _ring = [];
  var _lastPostKey = '';
  var _lastPostAt = 0;

  function _sanitizeText(s) {
    var t = String(s || '');
    t = t.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]');
    t = t.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[jwt]');
    t = t.replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer [token]');
    t = t.replace(/\b(api[_-]?key|password|secret|token)\s*[:=]\s*\S+/gi, '$1=[redacted]');
    return t.substring(0, 4000);
  }

  function _sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return {};
    var out = {};
    var block = { email: 1, user: 1, name: 1, password: 1, token: 1, message: 1, text: 1, content: 1, query: 1 };
    Object.keys(meta).forEach(function(k) {
      if (block[k.toLowerCase()]) return;
      var v = meta[k];
      if (typeof v === 'string') out[k] = _sanitizeText(v).substring(0, 500);
      else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    });
    return out;
  }

  function _sessionId() {
    try {
      return sessionStorage.getItem('veil_funnel_session_id') || ('s_diag_' + Date.now());
    } catch (e) {
      return 's_diag_' + Date.now();
    }
  }

  function _visitorId() {
    try {
      return localStorage.getItem('veil_visitor_id') || 'v_unknown';
    } catch (e) {
      return 'v_unknown';
    }
  }

  function _deviceType() {
    var w = window.innerWidth || 0;
    if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) return w < 768 ? 'mobile' : 'tablet';
    return 'desktop';
  }

  function _browserFamily() {
    var ua = navigator.userAgent || '';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
    return 'Other';
  }

  function _platform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Win/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function _pushConsole(level, args) {
    var message = args.map(function(a) {
      if (a == null) return '';
      if (a instanceof Error) return a.message + (a.stack ? '\n' + a.stack : '');
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).join(' ');
    _ring.push({
      level: level,
      ts: new Date().toISOString(),
      message: _sanitizeText(message).substring(0, 1500)
    });
    if (_ring.length > CONSOLE_RING_MAX) _ring.shift();
  }

  ['warn', 'error'].forEach(function(level) {
    var orig = console[level];
    if (typeof orig !== 'function') return;
    console[level] = function() {
      var args = Array.prototype.slice.call(arguments);
      try { _pushConsole(level, args); } catch (e) { /* ignore */ }
      return orig.apply(console, args);
    };
  });

  async function _restHeaders() {
    var token = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
    try {
      if (typeof supabase !== 'undefined' && supabase.auth && supabase.auth.getSession) {
        var sess = await supabase.auth.getSession();
        if (sess.data && sess.data.session && sess.data.session.access_token) {
          token = sess.data.session.access_token;
        }
      }
    } catch (e) { /* ignore */ }
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json; charset=utf-8',
      'Prefer': 'return=minimal'
    };
  }

  function _supabaseRestUrl() {
    if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) return SUPABASE_URL;
    if (typeof CONFIG !== 'undefined' && CONFIG.supabaseUrl) return CONFIG.supabaseUrl;
    return '';
  }

  async function postSessionErrorLog(errorType, errorMessage, errorStack, endpoint, metadata) {
    var base = _supabaseRestUrl();
    if (!base) return;
    var type = String(errorType || 'unknown').substring(0, 120);
    var msg = _sanitizeText(errorMessage).substring(0, 2000);
    var key = type + '|' + msg.substring(0, 120);
    var now = Date.now();
    if (key === _lastPostKey && now - _lastPostAt < 5000) return;
    _lastPostKey = key;
    _lastPostAt = now;

    var row = {
      session_id: _sessionId(),
      visitor_id: _visitorId(),
      expires_at: new Date(now + 30 * 86400000).toISOString(),
      error_type: type,
      error_message: msg,
      error_stack: _sanitizeText(errorStack).substring(0, 8000),
      endpoint: _sanitizeText(endpoint).substring(0, 500),
      page_path: (location.pathname || '/') + (location.search || ''),
      funnel_step: typeof window._veilLastFunnelStep === 'string' ? window._veilLastFunnelStep : null,
      device_type: _deviceType(),
      viewport_w: window.innerWidth || null,
      viewport_h: window.innerHeight || null,
      platform: _platform(),
      browser_family: _browserFamily(),
      user_agent: _sanitizeText(navigator.userAgent).substring(0, 500),
      console_logs: _ring.slice(-80),
      metadata: _sanitizeMeta(metadata)
    };

    try {
      var headers = await _restHeaders();
      var resp = await fetch(base + '/rest/v1/session_error_logs', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(row)
      });
      if (!resp.ok && typeof console !== 'undefined' && console.debug) {
        console.debug('[session_diag] post failed', resp.status);
      }
    } catch (e) {
      /* never break the app */
    }
  }

  function hookLogError() {
    if (typeof window.logError !== 'function' || window.logError._sessionDiagHook) return;
    var orig = window.logError;
    window.logError = function(errorType, errorMessage, errorStack, endpoint, metadata) {
      postSessionErrorLog(errorType, errorMessage, errorStack, endpoint, metadata);
      return orig.apply(this, arguments);
    };
    window.logError._sessionDiagHook = true;
  }

  hookLogError();
  var _hookTimer = setInterval(function() {
    hookLogError();
    if (window.logError && window.logError._sessionDiagHook) clearInterval(_hookTimer);
  }, 200);

  window._veilPostSessionError = postSessionErrorLog;
})();
