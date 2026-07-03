// ============================================================
// ADVANCED ERROR DETECTION — Silent failure monitoring
// ============================================================
var _diagLog = { sttAttempts: 0, sttSuccess: 0, ttsAttempts: 0, ttsSuccess: 0, wsFailures: 0, micDenied: false, lastSttError: '', lastTtsError: '' };

// Wrap dgTranscribe with diagnostics
var _origDgTranscribe = typeof dgTranscribe === 'function' ? dgTranscribe : null;
// We'll monkey-patch after functions are defined — see bottom of file

function initDiagnostics() {
  // Monitor STT
  var origTranscribe = window.dgTranscribe;
  if (origTranscribe) {
    window.dgTranscribe = async function(blob) {
      _diagLog.sttAttempts++;
      try {
        var result = await origTranscribe(blob);
        if (result && result.trim()) { _diagLog.sttSuccess++; }
        else {
          _diagLog.lastSttError = 'Empty transcript (blob size: ' + blob.size + ', type: ' + blob.type + ')';
          logError('stt_silent_fail', 'STT returned empty transcript', '', CONFIG.sttEndpoint, { blobSize: blob.size, blobType: blob.type, attempts: _diagLog.sttAttempts, successes: _diagLog.sttSuccess });
        }
        return result;
      } catch(e) {
        _diagLog.lastSttError = e.message;
        logError('stt_exception', e.message, e.stack || '', CONFIG.sttEndpoint, { blobSize: blob.size, attempts: _diagLog.sttAttempts });
        return '';
      }
    };
  }

  // Monitor API calls via fetch interception — timing + error tracking
  var origFetch = window.fetch;
  window.fetch = function() {
    var url = arguments[0];
    var args = arguments;
    // Track TTS (Deepgram) calls
    if (typeof url === 'string' && url.indexOf('/functions/v1/tts') !== -1) {
      _diagLog.ttsAttempts++;
      var t0 = Date.now();
      return origFetch.apply(this, args).then(function(resp) {
        var ms = Date.now() - t0;
        if (!resp.ok) {
          _diagLog.lastTtsError = 'TTS HTTP ' + resp.status;
          logError('tts_http_fail', 'TTS returned HTTP ' + resp.status, '', url, { status: resp.status, ms: ms });
          _logMetric('deepgram_tts', ms, false);
        } else {
          _diagLog.ttsSuccess++;
          _logMetric('deepgram_tts', ms, true);
        }
        return resp;
      }).catch(function(e) {
        var ms = Date.now() - t0;
        _diagLog.lastTtsError = e.message;
        logError('tts_network_fail', 'TTS fetch failed: ' + e.message, e.stack || '', url, { ms: ms });
        _logMetric('deepgram_tts', ms, false);
        throw e;
      });
    }
    // Track STT (Deepgram) calls
    if (typeof url === 'string' && url.indexOf('/functions/v1/stt') !== -1) {
      var t0 = Date.now();
      return origFetch.apply(this, args).then(function(resp) {
        var ms = Date.now() - t0;
        if (!resp.ok) {
          logError('stt_http_fail', 'STT returned HTTP ' + resp.status, '', url, { status: resp.status, ms: ms });
          _logMetric('deepgram_stt', ms, false);
        } else {
          _logMetric('deepgram_stt', ms, true);
        }
        return resp;
      }).catch(function(e) {
        var ms = Date.now() - t0;
        logError('stt_network_fail', 'STT fetch failed: ' + e.message, e.stack || '', url, { ms: ms });
        _logMetric('deepgram_stt', ms, false);
        throw e;
      });
    }
    // Track chat (DeepSeek) calls
    if (typeof url === 'string' && url.indexOf('/functions/v1/chat') !== -1) {
      var t0 = Date.now();
      return origFetch.apply(this, args).then(function(resp) {
        var ms = Date.now() - t0;
        if (!resp.ok) {
          logError('chat_http_fail', 'Chat API returned HTTP ' + resp.status, '', url, { status: resp.status, ms: ms });
          _logMetric('deepseek', ms, false);
        } else {
          _logMetric('deepseek', ms, true);
        }
        return resp;
      }).catch(function(e) {
        var ms = Date.now() - t0;
        logError('chat_network_fail', 'Chat fetch failed: ' + e.message, e.stack || '', url, { ms: ms });
        _logMetric('deepseek', ms, false);
        throw e;
      });
    }
    return origFetch.apply(this, args);
  };

  function _logMetric(service, ms, success) {
    // Fire and forget — don't block anything
    try {
      origFetch(CONFIG.supabaseUrl + '/rest/v1/api_metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ service: service, response_ms: ms, success: success })
      }).catch(function() {});
    } catch(e) {}
  }

  // Monitor mic access
  var origGetUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (origGetUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return origGetUserMedia.call(navigator.mediaDevices, constraints).catch(function(e) {
        _diagLog.micDenied = true;
        logError('mic_denied', 'Microphone access denied: ' + e.message, e.stack || '', '', { constraints: JSON.stringify(constraints) });
        throw e;
      });
    };
  }

  // Monitor MediaRecorder failures
  var origMediaRecorder = window.MediaRecorder;
  if (origMediaRecorder) {
    window.MediaRecorder = function(stream, opts) {
      var rec = new origMediaRecorder(stream, opts);
      rec.addEventListener('error', function(e) {
        logError('mediarecorder_error', 'MediaRecorder error: ' + (e.error ? e.error.message : 'unknown'), '', '', { state: rec.state, mimeType: rec.mimeType });
      });
      return rec;
    };
    window.MediaRecorder.isTypeSupported = origMediaRecorder.isTypeSupported;
  }

  // Monitor AudioContext failures
  var origAudioCtx = window.AudioContext || window.webkitAudioContext;
  if (origAudioCtx) {
    var WrappedAudioCtx = function(opts) {
      try { return new origAudioCtx(opts); }
      catch(e) { logError('audiocontext_fail', 'AudioContext creation failed: ' + e.message, e.stack || '', '', {}); throw e; }
    };
    WrappedAudioCtx.prototype = origAudioCtx.prototype;
    window.AudioContext = WrappedAudioCtx;
    window.webkitAudioContext = WrappedAudioCtx;
  }

  // Periodic health check — detect silent STT failures
  setInterval(function() {
    if (_diagLog.sttAttempts > 3 && _diagLog.sttSuccess === 0) {
      logError('stt_all_failing', 'All STT attempts failing (' + _diagLog.sttAttempts + ' attempts, 0 successes)', _diagLog.lastSttError, CONFIG.sttEndpoint, { attempts: _diagLog.sttAttempts });
      _diagLog.sttAttempts = 0; // reset to avoid spam
    }
    if (_diagLog.ttsAttempts > 3 && _diagLog.ttsSuccess === 0) {
      logError('tts_all_failing', 'All TTS attempts failing (' + _diagLog.ttsAttempts + ' attempts, 0 successes)', _diagLog.lastTtsError, CONFIG.ttsEndpoint, { attempts: _diagLog.ttsAttempts });
      _diagLog.ttsAttempts = 0;
    }
  }, 60000);
}

// Initialize diagnostics after all functions are defined
setTimeout(initDiagnostics, 100);

