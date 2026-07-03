// ============================================================
// ERROR LOGGING — Collects errors to backend for debugging
// ============================================================
var _veilPageUnloading = false;
window.addEventListener('pagehide', function() { _veilPageUnloading = true; }, { capture: true });

function _safeJsonParse(str, fallback) {
  if (str == null || typeof str !== 'string' || !str.trim()) return fallback;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

async function logError(errorType, errorMessage, errorStack, endpoint, metadata) {
  if (_veilPageUnloading) return;
  var msg = String(errorMessage || '');
  if (errorType === 'uncaught' && !msg) return;
  if ((errorType === 'chat_network_fail' || errorType === 'tts_network_fail' || errorType === 'tts_speak') &&
      msg.indexOf('Failed to fetch') !== -1 && _veilPageUnloading) return;
  try {
    var headers = await getAuthHeaders().catch(function() { return { 'apikey': SUPABASE_ANON_KEY }; });
    headers['Content-Type'] = 'application/json; charset=utf-8';
    fetch(CONFIG.supabaseUrl + '/functions/v1/error-log', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        error_type: errorType || 'unknown',
        error_message: String(errorMessage || '').substring(0, 2000),
        error_stack: String(errorStack || '').substring(0, 4000),
        endpoint: endpoint || '',
        metadata: metadata || {}
      })
    }).catch(function() {}); // fire and forget
  } catch(e) { /* never fail on error logging */ }
}

// Global error handler
window.addEventListener('error', function(event) {
  logError('uncaught', event.message, event.error ? event.error.stack : '', event.filename, { line: event.lineno, col: event.colno });
});
window.addEventListener('unhandledrejection', function(event) {
  logError('unhandled_promise', String(event.reason), event.reason && event.reason.stack ? event.reason.stack : '', '', {});
});

