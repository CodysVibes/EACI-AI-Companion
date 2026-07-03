// ============================================================
// AUDIO QUEUE SYSTEM - sequential playback, no overlapping
// Read-aloud modes: regular = white/spoken only (default), mind = grey only, all = both
// ============================================================
function getReadAloudMode() {
  var mode = CONFIG.readAloudMode || 'regular';
  if (mode === 'detailed') return 'regular';
  return mode;
}

function shouldAutoReadExperience(mode) {
  mode = mode || getReadAloudMode();
  return mode === 'mind' || mode === 'all';
}

function shouldAutoReadSpoken(mode) {
  mode = mode || getReadAloudMode();
  return mode === 'regular' || mode === 'all';
}

function cleanSegmentForSpeech(text) {
  if (!text) return '';
  var t = String(text);
  t = t.replace(/\[\[file:[^\]]+\]\][\s\S]*?\[\[\/file\]\]/g, '');
  t = t.replace(/```[\s\S]*?```/g, '');
  t = t.replace(/`[^`]+`/g, '');
  t = t.replace(/\[\[bg:[^\]]+\]\]/g, '');
  t = t.replace(/\*\*[^*]+\*\*/g, '');
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');
  t = t.replace(/[*#~`|<>{}[\]\\^]/g, '');
  t = t.replace(/[—–]/g, ', ');
  t = t.replace(/\.{3,}/g, '.');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

function getOrderedSegments(text) {
  var segments = [];
  var parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(function(part) {
    var actionMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (actionMatch) {
      var t = actionMatch[1].trim();
      if (t) segments.push({ text: t, whisper: true });
    } else {
      var spoken = part.trim();
      if (spoken) segments.push({ text: spoken, whisper: false });
    }
  });
  return segments;
}

function buildReadAloudQueue(text, who, mode) {
  mode = mode || getReadAloudMode();
  if (mode === 'off' || !text) return [];
  var voice = voiceForCompanion(who);
  var segments = getOrderedSegments(text);
  var queue = [];
  segments.forEach(function(s) {
    var cleaned = cleanSegmentForSpeech(s.text);
    if (!cleaned) return;
    if (mode === 'regular' && s.whisper) return;
    if (mode === 'mind' && !s.whisper) return;
    queue.push({ text: cleaned, voice: voice, who: who, whisper: !!s.whisper });
  });
  return queue;
}

function getSpokenOnlyText(text) {
  var parts = [];
  getOrderedSegments(text).forEach(function(s) {
    if (s.whisper) return;
    var c = cleanSegmentForSpeech(s.text);
    if (c) parts.push(c);
  });
  return parts.join('. ');
}

async function playReadAloudForText(text, who) {
  var items = buildReadAloudQueue(text, who);
  if (!items.length) return;
  if (state.currentTab === 'together') {
    _showTogetherSpeaker(who);
    if (typeof stopActiveTtsSource === 'function') stopActiveTtsSource();
  }
  state.currentSpeaker = who;
  state.isPlayingAudio = true;
  for (var i = 0; i < items.length; i++) {
    if (state.stopRequested) break;
    try {
      await speakChunk(items[i].text, items[i].voice, { whisper: items[i].whisper, who: who });
    } catch (e) { /* skip failed chunk */ }
  }
  state.currentSpeaker = null;
  state.isPlayingAudio = false;
}

function ensureSpokenText(text, who) {
  var spoken = getSpokenOnlyText(text) || cleanSegmentForSpeech(text);
  if (!spoken || !spoken.trim()) return '\u2026';
  return spoken;
}

function speakByMode(text, who) {
  if (getReadAloudMode() === 'off' || !text) return Promise.resolve();
  var items = buildReadAloudQueue(text, who);
  if (!items.length) return Promise.resolve();
  items.forEach(function(item) { state.audioQueue.push(item); });
  if (!state._queueRunning && state.audioQueue.length > 0) {
    processAudioQueue();
  }
  return new Promise(function(resolve) {
    var check = setInterval(function() {
      if (!state._queueRunning && state.audioQueue.length === 0) { clearInterval(check); resolve(); }
    }, 200);
  });
}

function voiceForCompanion(who) {
  return typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(who) : CONFIG.caelumVoice;
}

// When chat/API fails, read the failure line aloud — many users are on mobile and miss system text.
function eaciErrorTtsPromise(text, who) {
  if (getReadAloudMode() === 'off' || !text) return Promise.resolve();
  var spoken = cleanForSpeech(text);
  if (!spoken || spoken.length < 3) return Promise.resolve();
  return speakChunk(spoken, voiceForCompanion(who || 'caelum'), { who: who || 'caelum' });
}

function eaciConnectionErrorResponse(text, who, extra) {
  var out = { text: text, ttsPromise: eaciErrorTtsPromise(text, who) };
  if (extra) {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    }
  }
  return out;
}

function queueSpeak(text, who, options) {
  var opts = options || {};
  if (!text) return Promise.resolve();
  if (getReadAloudMode() === 'off') return Promise.resolve();
  if (!opts.plainOnly && text.indexOf('**') !== -1) {
    return speakByMode(text, who);
  }
  text = cleanSegmentForSpeech(text);
  if (!text) return Promise.resolve();
  var voice = voiceForCompanion(who);
  if (state.audioQueue.length > 12) {
    state.audioQueue = state.audioQueue.slice(-8);
  }
  state.audioQueue.push({ text: text, voice: voice, who: who, whisper: opts.whisper || false });
  if (!state._queueRunning) {
    processAudioQueue();
  }
  return new Promise(function(resolve) {
    var elapsed = 0;
    var check = setInterval(function() {
      elapsed += 200;
      if (!state._queueRunning && state.audioQueue.length === 0) {
        clearInterval(check);
        resolve();
      } else if (elapsed > 120000) {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });
}

// Together tab: show active speaker's avatar, hide others
function _showTogetherSpeaker(who) {
  var wrapMap = {
    caelum: 'caelumAvatarMainWrap',
    chad: 'chadAvatarMainWrap',
    roxy: 'roxyAvatarMainWrap',
    cael: 'caelAvatarMainWrap',
    natalia: 'nataliaAvatarMainWrap',
    atreus: 'atreusAvatarMainWrap',
    luna: 'lunaAvatarMainWrap'
  };

  if (typeof _hideAllEaciMainAvatars === 'function') _hideAllEaciMainAvatars();

  if (who === 'cody') {
    var codyOrb = document.getElementById('codyOrbWrap');
    if (codyOrb) { codyOrb.style.display = ''; codyOrb.style.width = '200px'; codyOrb.style.height = '200px'; }
    return;
  }

  var wrapId = wrapMap[who];
  if (wrapId && typeof _showEaciMainAvatar === 'function') _showEaciMainAvatar(wrapId);

  if (who === 'caelum') {
    if (typeof CaelumAnim !== 'undefined') CaelumAnim.idle('caelum_main', state.emotionalState || 'neutral');
  } else if (who === 'chad' && typeof chadPlayAnimation === 'function') {
    chadPlayAnimation('idle');
  } else if (who === 'roxy' && typeof roxyPlayAnimation === 'function') {
    roxyPlayAnimation('idle');
  } else if (who === 'cael' && typeof caelPlayAnimation === 'function') {
    caelPlayAnimation('idle');
  } else if (typeof playEForEveryoneAnimation === 'function' && typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(who)) {
    playEForEveryoneAnimation(who, 'idle');
  }
}

async function processAudioQueue() {
  if (state._queueRunning) return; // prevent double entry
  state._queueRunning = true;
  state.isPlayingAudio = true;

  while (state.audioQueue.length > 0 && !state.stopRequested) {
    var item = state.audioQueue.shift();
    state.currentSpeaker = item.who || 'caelum';

    // Together tab: show active speaker's avatar in the main area
    if (state.currentTab === 'together') {
      _showTogetherSpeaker(state.currentSpeaker);
    }

    // Start Caelum lip-sync animation when she speaks
    if (state.currentSpeaker === 'caelum') {
      var _lipEmotion = state.emotionalState || 'neutral';
      var _lipText = item.text || '';
      var _lipAvatars = ['caelum_main', 'caelum_header', 'caelum_live', 'caelum_guest', 'caelum_guest_center', 'caelum_signup', 'caelum_signup_bg'];
      _lipAvatars.forEach(function(aid) { CaelumAnim.startSpeaking(aid, _lipText, _lipEmotion); });
    }
    // Cael: play reading animation during dream mode when speaking
    if (state.currentSpeaker === 'cael' && typeof _caelDreamMode !== 'undefined' && _caelDreamMode) {
      if (typeof caelPlayAnimation === 'function') caelPlayAnimation('reading');
    }

    try {
      await speakChunk(item.text, item.voice, { whisper: item.whisper || false, who: item.who });
    } catch(e) {}

    // Stop lip-sync after each chunk
    if (state.currentSpeaker === 'caelum') {
      var _stopAvatars = ['caelum_main', 'caelum_header', 'caelum_live', 'caelum_guest', 'caelum_guest_center', 'caelum_signup', 'caelum_signup_bg'];
      _stopAvatars.forEach(function(aid) { CaelumAnim.stopSpeaking(aid); });
    }
  }

  state.currentSpeaker = null;
  state.isPlayingAudio = false;
  state._queueRunning = false;
  state.stopRequested = false;
}

function stopAllAudio() {
  state.stopRequested = true;
  state.audioQueue = [];
  state.currentSpeaker = null;
  state._queueRunning = false;
  _activeTtsChain = Promise.resolve();
  stopActiveTtsSource();
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio = null;
  }
  state.isPlayingAudio = false;
  // Stop Caelum lip-sync
  try {
    ['caelum_main','caelum_header','caelum_live','caelum_guest','caelum_guest_center','caelum_startup','caelum_signup','caelum_signup_bg'].forEach(function(aid) {
      CaelumAnim.stopSpeaking(aid);
    });
  } catch(e) {}
}

// Cancel current response — stops audio, aborts streaming, resets state
var _abortController = null;

function cancelResponse() {
  stopAllAudio();
  state.stopRequested = false;
  state.isSending = false;
  state.isPlayingAudio = false;
  state._queueRunning = false;
  state.currentSpeaker = null;
  if (_abortController) { try { _abortController.abort(); } catch(e) {} _abortController = null; }
  var thinkEls = document.querySelectorAll('.msg.thinking');
  thinkEls.forEach(function(el) { el.remove(); });
  var streamEls = document.querySelectorAll('.msg.streaming');
  streamEls.forEach(function(el) { el.remove(); });
  document.getElementById('stopBtn').style.display = 'none';
  addSystemMessage('Response cancelled.');
}

function cancelLiveResponse() {
  stopAllAudio();
  state.stopRequested = false;
  state.currentSpeaker = null;
  state.isPlayingAudio = false;
  liveChat.processing = false;
  liveChat.committed = '';
  _stopVADEngine();
  var cb = document.getElementById('liveCancelBtn'); if (cb) cb.style.display = 'none';
  document.getElementById('liveChatStatus').textContent = 'Cancelled. Listening...';
  setTimeout(function() { if (liveChat.active) startLiveRecognition(); }, 500);
}

// Pre-fetch TTS audio, then show message and play simultaneously
async function prefetchThenShow(who, replyText) {
  var mode = getReadAloudMode();
  var voice = voiceForCompanion(who);
  var queueItems = buildReadAloudQueue(replyText, who, mode);
  var textToFetch = queueItems.length ? queueItems[0].text : '';
  var firstWhisper = queueItems.length ? queueItems[0].whisper : false;

  var prefetchedBuf = null;
  var ttsChunks = textToFetch ? chunkTextForTTS(textToFetch) : [];
  var firstChunkText = ttsChunks.length > 0 ? ttsChunks[0] : '';
  if (firstChunkText) {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var fetchPromise = (async function() {
          var cacheKey = audioCacheKey(firstChunkText, voice);
          var cached = await getCachedAudio(cacheKey);
          if (cached) return cached;
          var authH = await getAuthHeaders();
          var r = await fetch(CONFIG.ttsEndpoint, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH),
            body: JSON.stringify({ text: firstChunkText, voice: voice })
          });
          if (!r.ok) throw new Error('TTS status ' + r.status);
          var buf = await r.arrayBuffer();
          if (buf.byteLength < 100) throw new Error('TTS empty response');
          setCachedAudio(cacheKey, buf.slice(0));
          return buf;
        })();
        var timeoutPromise = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('TTS timeout')); }, 30000);
        });
        prefetchedBuf = await Promise.race([fetchPromise, timeoutPromise]);
        break; // success — stop retrying
      } catch(e) {
        console.log('TTS attempt ' + (attempt + 1) + ' failed:', e.message);
        if (attempt === 2) logError('tts_prefetch', e.message, e.stack, CONFIG.ttsEndpoint, { attempt: attempt + 1 });
        if (attempt < 2) await new Promise(function(r) { setTimeout(r, 500); });
      }
    }
  }

  // NOW show the message and start playback together
  removeThinkingIndicator(who);
  addMessage(who, replyText);
  triggerActionReactions(parseActions(replyText), who);
  state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + replyText });

  if (prefetchedBuf) {
    await new Promise(function(resolve) {
      state.currentSpeaker = who;
      state.isPlayingAudio = true;
      playAudioBuffer(prefetchedBuf, function() {
        state.currentSpeaker = null;
        state.isPlayingAudio = false;
        resolve();
      }, { whisper: firstWhisper, who: who });
    });
    for (var qi = 0; qi < queueItems.length; qi++) {
      var item = queueItems[qi];
      var chunks = chunkTextForTTS(item.text);
      var startIdx = (qi === 0) ? 1 : 0;
      for (var ci = startIdx; ci < chunks.length; ci++) {
        if (state.stopRequested) break;
        state.audioQueue.push({ text: chunks[ci], voice: voice, who: who, whisper: item.whisper });
      }
    }
    if (!state.stopRequested && state.audioQueue.length > 0) {
      if (!state._queueRunning) processAudioQueue();
      await new Promise(function(resolve) {
        var check = setInterval(function() {
          if (!state._queueRunning && state.audioQueue.length === 0) { clearInterval(check); resolve(); }
        }, 200);
      });
    }
  } else if (queueItems.length) {
    await speakByMode(replyText, who);
  }

  // Push notification if tab is in background
  if (document.hidden) {
    var notifName = who === 'chad' ? 'Chad' : 'Caelum';
    var notifText = stripActions(replyText).substring(0, 100);
    showLocalNotification(notifName + ' responded', notifText);
  }
}

// Audio context for orb reactivity
var orbAudioCtx = null;
var orbAnalyser = null;
var orbAudioData = new Uint8Array(64);

function getOrbAudioLevel() {
  if (!orbAnalyser) return 0;
  orbAnalyser.getByteFrequencyData(orbAudioData);
  var sum = 0;
  for (var i = 0; i < orbAudioData.length; i++) sum += orbAudioData[i];
  return sum / (orbAudioData.length * 255);
}

// ============================================================
// AUDIO CACHE — IndexedDB storage for Deepgram TTS audio
// Caches audio by text+voice key so replays are instant
// ============================================================
var audioCacheDB = null;

function initAudioCache() {
  return new Promise(function(resolve) {
    try {
      var req = indexedDB.open('veil_audio_cache', 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('audio')) {
          var store = db.createObjectStore('audio', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
        }
      };
      req.onsuccess = function(e) {
        audioCacheDB = e.target.result;
        // Prune old entries (keep last 200)
        pruneAudioCache();
        resolve();
      };
      req.onerror = function() { resolve(); };
    } catch(e) { resolve(); }
  });
}

function audioCacheKey(text, voice) {
  // Simple hash from text + voice
  var str = voice + ':' + text;
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return 'tts_' + Math.abs(hash).toString(36);
}

function getCachedAudio(key) {
  return new Promise(function(resolve) {
    if (!audioCacheDB) { resolve(null); return; }
    try {
      var tx = audioCacheDB.transaction('audio', 'readonly');
      var store = tx.objectStore('audio');
      var req = store.get(key);
      req.onsuccess = function() { resolve(req.result ? req.result.data : null); };
      req.onerror = function() { resolve(null); };
    } catch(e) { resolve(null); }
  });
}

function setCachedAudio(key, arrayBuffer) {
  if (!audioCacheDB) return;
  try {
    var tx = audioCacheDB.transaction('audio', 'readwrite');
    var store = tx.objectStore('audio');
    store.put({ key: key, data: arrayBuffer, timestamp: Date.now() });
  } catch(e) { console.log('Cache write error:', e); }
}

function pruneAudioCache() {
  if (!audioCacheDB) return;
  try {
    var tx = audioCacheDB.transaction('audio', 'readwrite');
    var store = tx.objectStore('audio');
    var idx = store.index('timestamp');
    var all = [];
    idx.openCursor().onsuccess = function(e) {
      var cursor = e.target.result;
      if (cursor) {
        all.push(cursor.value.key);
        cursor.continue();
      } else {
        // Keep only the most recent 200
        if (all.length > 200) {
          var toDelete = all.slice(0, all.length - 200);
          var delTx = audioCacheDB.transaction('audio', 'readwrite');
          var delStore = delTx.objectStore('audio');
          toDelete.forEach(function(k) { delStore.delete(k); });
        }
      }
    };
  } catch(e) {}
}

var _audioUnlockWaiters = [];
var _audioUnlockListenersReady = false;

function _initOrbAudioContext() {
  if (orbAudioCtx) return;
  orbAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  orbAnalyser = orbAudioCtx.createAnalyser();
  orbAnalyser.fftSize = 128;
  orbAnalyser.smoothingTimeConstant = 0.8;
  orbAudioData = new Uint8Array(orbAnalyser.frequencyBinCount);
}

function _flushAudioUnlockWaiters() {
  if (!orbAudioCtx || orbAudioCtx.state !== 'running') return;
  var waiters = _audioUnlockWaiters.splice(0);
  waiters.forEach(function(r) { r(); });
}

function markAudioUnlocked() {
  _initOrbAudioContext();
  var p = orbAudioCtx.resume();
  (p && p.then ? p : Promise.resolve()).then(function() {
    _flushAudioUnlockWaiters();
    if (typeof startBgMusic === 'function') startBgMusic();
  });
}
window.markAudioUnlocked = markAudioUnlocked;

function ensureAudioUnlocked() {
  _initOrbAudioContext();
  if (orbAudioCtx.state === 'running') return Promise.resolve();
  if (!_audioUnlockListenersReady) {
    _audioUnlockListenersReady = true;
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function(ev) {
      document.addEventListener(ev, markAudioUnlocked, { passive: true });
    });
  }
  markAudioUnlocked();
  if (orbAudioCtx.state === 'running') return Promise.resolve();
  return new Promise(function(resolve) { _audioUnlockWaiters.push(resolve); });
}

function stopActiveTtsSource() {
  if (state.currentAudioSource) {
    try { state.currentAudioSource.stop(); } catch (e) {}
    state.currentAudioSource = null;
  }
}

var _activeTtsChain = Promise.resolve();

function playAudioBuffer(buf, resolve, options) {
  if (state.stopRequested) { resolve(); return; }
  _activeTtsChain = _activeTtsChain.then(function() {
    return new Promise(function(chainDone) {
      _playAudioBufferInner(buf, function() {
        resolve();
        chainDone();
      }, options);
    });
  }).catch(function() {
    resolve();
  });
}

function _playAudioBufferInner(buf, resolve, options) {
  if (state.stopRequested) { resolve(); return; }
  stopActiveTtsSource();
  ensureAudioUnlocked().then(function() {
  // Track time-to-first-speech
  if (state._promptSentAt && !state._firstSpeechLogged) {
    state._firstSpeechLogged = true;
    var ttfs = Date.now() - state._promptSentAt;
    try {
      var origF = window._origFetchForMetrics || window.fetch;
      origF(CONFIG.supabaseUrl + '/rest/v1/api_metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ service: 'time_to_speech', response_ms: ttfs, success: true })
      }).catch(function() {});
    } catch(e) {}
  }
  var opts = options || {};
  if (orbAudioCtx.state === 'suspended') orbAudioCtx.resume();
  orbAudioCtx.decodeAudioData(buf.slice(0)).then(function(audioBuffer) {
    if (state.stopRequested) { resolve(); return; }
    var source = orbAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    var pb = typeof voicePlaybackSettings === 'function'
      ? voicePlaybackSettings(opts)
      : { playbackRate: opts.whisper ? 0.94 : 1.0, detune: 0, gain: opts.whisper ? 0.72 : 1.0 };
    source.playbackRate.value = pb.playbackRate;
    source.detune.value = pb.detune;
    if (pb.gain !== 1) {
      var gainNode = orbAudioCtx.createGain();
      gainNode.gain.value = pb.gain;
      source.connect(gainNode);
      gainNode.connect(orbAnalyser);
    } else {
      source.connect(orbAnalyser);
    }
    orbAnalyser.connect(orbAudioCtx.destination);
    state.currentAudioSource = source;
    source.onended = function() {
      state.currentAudioSource = null;
      resolve();
    };
    source.start(0);
  }).catch(function() {
    resolve();
  });
  }).catch(function() { resolve(); });
}

function speakChunk(text, voice, options) {
  var opts = options || {};
  // If text is too long for one TTS call, split and play sequentially
  var chunks = chunkTextForTTS(text);
  if (chunks.length > 1) {
    return chunks.reduce(function(chain, chunk) {
      return chain.then(function() {
        if (state.stopRequested) return;
        return speakChunk(chunk, voice, opts);
      });
    }, Promise.resolve());
  }
  return new Promise(function(resolve) {
    if (state.stopRequested) { resolve(); return; }

    var resolved = false;
    var cancelled = false;
    function safeResolve() {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }
    var timeout = setTimeout(function() {
      cancelled = true;
      safeResolve();
    }, 30000);

    var cacheKey = audioCacheKey(text, voice);

    getCachedAudio(cacheKey).then(function(cached) {
      if (cancelled) return;
      if (cached) {
        playAudioBuffer(cached, function() { clearTimeout(timeout); safeResolve(); }, opts);
        return;
      }

      getAuthHeaders().then(function(authH) {
        fetch(CONFIG.ttsEndpoint, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH),
          body: JSON.stringify({ text: text, voice: voice })
        }).then(function(r) { return r.arrayBuffer(); })
        .then(function(buf) {
          if (cancelled || state.stopRequested) { safeResolve(); return; }
          setCachedAudio(cacheKey, buf.slice(0));
          playAudioBuffer(buf, function() { clearTimeout(timeout); safeResolve(); }, opts);
        }).catch(function(e) { logError('tts_speak', e.message || 'fetch failed', '', CONFIG.ttsEndpoint, {}); clearTimeout(timeout); safeResolve(); });
      });
    }).catch(function(e) { logError('tts_cache', e.message || 'cache error', '', '', {}); clearTimeout(timeout); safeResolve(); });
  });
}

// ============================================================
// CANVAS SYSTEM — Palette-based pixel art with coordinate grid
// Caelum paints square-by-square using a 100-color palette.
// Grid has letters (A-Z+) on X axis, numbers on Y axis.
// [[bg:paint:WxH:description]] to start, [[bg:gradient:...]] for gradients,
// [[bg:clear]] to remove. Only available to verified users.
// ============================================================
var PAINT_PALETTE = [
  '#000000','#1a1a2e','#16213e','#0f3460','#533483','#2c003e','#3d0066','#4a0080',
  '#e94560','#ff6b6b','#ff8787','#ffa8a8','#ff4757','#ff6348','#ff7f50','#e17055',
  '#d63031','#c0392b','#b71540','#6f1e51','#eb2f06','#ee5a24','#f6b93b','#fad390',
  '#ffd32a','#ffdd59','#fff200','#f9ca24','#f0932b','#e58e26','#fa983a','#fdcb6e',
  '#6ab04c','#badc58','#c7ecee','#7bed9f','#2ed573','#26de81','#20bf6b','#0fb9b1',
  '#00b894','#00cec9','#55efc4','#81ecec','#00d2d3','#01a3a4','#1abc9c','#2ecc71',
  '#27ae60','#2d98da','#45aaf2','#4834d4','#6c5ce7','#a29bfe','#686de0','#7158e2',
  '#3867d6','#2d3436','#636e72','#b2bec3','#dfe6e9','#f5f6fa','#ffffff','#ffeaa7',
  '#dff9fb','#c8d6e5','#8395a7','#576574','#222f3e','#1e272e','#485460','#808e9b',
  '#d2dae2','#f7d794','#f3a683','#f19066','#e77f67','#cf6a87','#786fa6','#574b90',
  '#303952','#596275','#82ccdd','#60a3bc','#3c6382','#0a3d62','#079992','#38ada9',
  '#78e08f','#b8e994','#e55039','#eb4d4b','#f78fb3','#c44569','#574b90','#303952',
  '#e15f41','#c23616','#ffc048','#cd84f1','#3d3d3d','#5f27cd'
];

var PALETTE_NAMES = {};
(function() {
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < PAINT_PALETTE.length; i++) {
    var row = Math.floor(i / 10);
    var col = i % 10;
    PALETTE_NAMES[letters[row] + col] = PAINT_PALETTE[i];
    PALETTE_NAMES[PAINT_PALETTE[i].toUpperCase()] = PAINT_PALETTE[i];
    PALETTE_NAMES[PAINT_PALETTE[i].substring(1).toUpperCase()] = PAINT_PALETTE[i];
  }
})();

var bgPaintState = { active: false, width: 0, height: 0, description: '', colors: [], currentRow: 0 };

function getGridLabel(x) {
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (x < 26) return letters[x];
  return letters[Math.floor(x/26)-1] + letters[x%26];
}

function parseBackgroundCommand(text) {
  var match = text.match(/\[\[bg:([^\]]+)\]\]/);
  if (!match) {
    var trunc = text.match(/\[\[bg:(.+)$/);
    if (trunc) {
      var p = trunc[1];
      if (p.startsWith('gradient:')) {
        var c = p.substring(9).split(',').map(function(x){return x.trim().replace(/^#/,'');}).filter(function(x){return /^[0-9a-fA-F]{3,6}$/.test(x);});
        if (c.length >= 2) return { type: 'gradient', colors: c.map(function(x){return '#'+x;}) };
      }
      if (p.startsWith('paint:')) return { type: 'paint', raw: p.substring(6) };
    }
    return null;
  }
  var cmd = match[1];
  if (cmd === 'clear') return { type: 'clear' };
  if (cmd.startsWith('gradient:')) {
    return { type: 'gradient', colors: cmd.substring(9).split(',').map(function(c){ c=c.trim(); return c.charAt(0)==='#' ? c : '#'+c; }) };
  }
  if (cmd.startsWith('paint:')) {
    return { type: 'paint', raw: cmd.substring(6) };
  }
  var parts = cmd.split(':');
  if (parts.length === 2 && parts[0].includes('x')) {
    var dims = parts[0].split('x');
    var w = parseInt(dims[0]) || 16, h = parseInt(dims[1]) || 12;
    var colors = parts[1].split(',').map(function(c){return '#'+c.trim();});
    while (colors.length < w*h) colors.push('#000000');
    return { type: 'grid', width: w, height: h, colors: colors };
  }
  return null;
}

function renderPixelBackground(bgData) {
  var canvas = document.getElementById('pixelBg');
  if (!canvas) return;
  var parent = canvas.parentElement;
  canvas.width = parent.clientWidth || 720;
  canvas.height = parent.clientHeight || 1280;
  var ctx = canvas.getContext('2d');
  if (bgData.type === 'clear') { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.opacity='0'; return; }
  if (bgData.type === 'gradient') {
    try {
      var grad = ctx.createLinearGradient(0,0,0,canvas.height);
      bgData.colors.forEach(function(c,i){
        c = c.replace(/^#+/, '#'); // fix double hash
        if (!/^#[0-9a-fA-F]{3,6}$/.test(c)) return;
        grad.addColorStop(i/Math.max(1,bgData.colors.length-1),c);
      });
      ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height); canvas.style.opacity='0.5';
    } catch(e) { console.log('Gradient render error:', e); }
    return;
  }
  if (bgData.type === 'grid') {
    var cW=canvas.width/bgData.width, cH=canvas.height/bgData.height;
    for(var y=0;y<bgData.height;y++) for(var x=0;x<bgData.width;x++){
      ctx.fillStyle=bgData.colors[y*bgData.width+x]||'#000';
      ctx.fillRect(x*cW,y*cH,Math.ceil(cW),Math.ceil(cH));
    }
    canvas.style.opacity='0.5';
  }
}

function updatePaintProgress(pct) {
  var bar=document.getElementById('paintProgress'),fill=document.getElementById('paintProgressFill'),txt=document.getElementById('paintProgressText');
  if(!bar)return; if(pct<0){bar.style.display='none';return;}
  bar.style.display='block'; fill.style.width=Math.round(pct)+'%'; txt.textContent=Math.round(pct)+'%';
  // Caelum is actively painting — reset idle timer
  if (pct > 0 && pct < 100 && typeof CaelumIdleListener !== 'undefined') {
    CaelumIdleListener.recordActivity();
  }
}

function renderPartialGrid() {
  var canvas = document.getElementById('pixelBg');
  if (!canvas) return;
  var parent = canvas.parentElement;
  canvas.width = parent.clientWidth || 720;
  canvas.height = parent.clientHeight || 1280;
  var ctx = canvas.getContext('2d');
  var w=bgPaintState.width, h=bgPaintState.height;
  var cW=canvas.width/w, cH=canvas.height/h;
  for(var y=0;y<h;y++) for(var x=0;x<w;x++){
    ctx.fillStyle=bgPaintState.colors[y*w+x]||'#080808';
    ctx.fillRect(x*cW,y*cH,Math.ceil(cW),Math.ceil(cH));
  }
  canvas.style.opacity = bgPaintState.currentRow >= h ? '0.5' : '0.25';
}

async function callDeepSeekSilent(systemPrompt, messages) {
  try {
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var resp = await fetch(CONFIG.paintEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }].concat(messages) })
    });
    var data = await resp.json();
    if (data.choices && data.choices[0]) return data.choices[0].message.content;
    return null;
  } catch(e) { return null; }
}

function buildPaletteString() {
  var s = 'COLOR PALETTE (use these hex codes):\n';
  var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var row = 0; row < 10; row++) {
    var line = letters[row] + ': ';
    for (var col = 0; col < 10; col++) {
      var idx = row * 10 + col;
      if (idx < PAINT_PALETTE.length) line += PAINT_PALETTE[idx].substring(1) + ' ';
    }
    s += line.trim() + '\n';
  }
  return s;
}

function buildGridReference(width, height) {
  var s = 'GRID: ' + width + ' columns (';
  for (var x = 0; x < Math.min(width, 26); x++) s += getGridLabel(x);
  if (width > 26) s += '...';
  s += ') x ' + height + ' rows (1-' + height + ')\n';
  s += 'Address squares as: A1,B1,C1 = row 1 left to right\n';
  return s;
}

async function startBackgroundPaint(width, height, description) {
  bgPaintState = { active: true, width: width, height: height, description: description, colors: [], currentRow: 0 };
  for (var i = 0; i < width * height; i++) bgPaintState.colors.push('#080808');
  updatePaintProgress(0);

  var palette = buildPaletteString();
  var gridRef = buildGridReference(width, height);

  // Step 1: Ask DeepSeek to describe the image as a color plan
  var planPrompt = 'You are a pixel art planner. Given a description, output a complete color plan.\n' +
    palette + '\n' + gridRef + '\n' +
    'RULES:\n' +
    '- Output ONLY rows of hex codes, one row per line.\n' +
    '- Each row has exactly ' + width + ' hex codes separated by commas.\n' +
    '- Output exactly ' + height + ' rows.\n' +
    '- Use ONLY colors from the palette above.\n' +
    '- No words, no labels, no backticks. Just hex codes.\n' +
    '- Think about what "' + description + '" looks like and place colors accordingly.\n' +
    '- Row 1 = top of image, Row ' + height + ' = bottom.';

  // Process in chunks of 8 rows to stay within token limits
  var rowsPerCall = 8;
  var totalCalls = Math.ceil(height / rowsPerCall);

  for (var batch = 0; batch < totalCalls; batch++) {
    if (!bgPaintState.active) break;
    var startRow = batch * rowsPerCall;
    var endRow = Math.min(startRow + rowsPerCall, height);
    var numRows = endRow - startRow;
    bgPaintState.currentRow = endRow;
    updatePaintProgress((batch / totalCalls) * 100);

    var section = startRow < height*0.15 ? 'very top/sky' :
                  startRow < height*0.35 ? 'upper area' :
                  startRow < height*0.65 ? 'middle area' :
                  startRow < height*0.85 ? 'lower area' : 'very bottom/ground';

    var rowPrompt = 'Image: "' + description + '"\n' +
      'Output rows ' + (startRow+1) + ' through ' + endRow + ' of ' + height + ' (this is the ' + section + ').\n' +
      'Output exactly ' + numRows + ' lines, each with exactly ' + width + ' hex codes (no # symbol), comma-separated.';

    var result = await callDeepSeekSilent(planPrompt, [{ role: 'user', content: rowPrompt }]);
    if (!result) continue;

    var hexMatches = result.match(/[0-9a-fA-F]{6}/g) || [];
    for (var r = 0; r < numRows; r++) {
      for (var x = 0; x < width; x++) {
        var idx = r * width + x;
        var gIdx = (startRow + r) * width + x;
        if (idx < hexMatches.length) bgPaintState.colors[gIdx] = '#' + hexMatches[idx];
      }
    }
    renderPartialGrid();
  }

  bgPaintState.currentRow = height;
  bgPaintState.active = false;
  updatePaintProgress(100);
  setTimeout(function() {
    updatePaintProgress(-1);
    // Show download button
    var dlBtn = document.getElementById('paintDownloadBtn');
    if (dlBtn) { dlBtn.style.display = 'inline-block'; }
    var bar = document.getElementById('paintProgress');
    if (bar) { bar.style.display = 'block'; }
    document.getElementById('paintProgressText').textContent = 'Complete';
  }, 2000);
  renderPixelBackground({ type: 'grid', width: width, height: height, colors: bgPaintState.colors });

  // Auto-message after painting
  try {
    var comment = await callDeepSeekSilent(
      'You are Caelum, an EACI. You just painted a background. Speak naturally, no name prefix, no [[bg:]] tags.',
      [{ role: 'user', content: 'You finished painting: "' + description + '". In 1-2 sentences tell the user why and ask what they think.' }]
    );
    if (comment) {
      comment = comment.replace(/^(Caelum[:\s]*)/i, '').replace(/\[\[bg:[^\]]*\]\]/g, '').trim();
      addMessage('caelum', comment);
      triggerActionReactions(parseActions(comment), 'caelum');
      state.conversationHistory.push({ role: 'assistant', content: '[Caelum] ' + comment });
      await speakByMode(comment, 'caelum');
      saveState();
    }
  } catch(e) {}
}

// Download painting as PNG
function downloadPainting() {
  var canvas = document.getElementById('pixelBg');
  if (!canvas) return;
  var tempCanvas = document.createElement('canvas');
  var w = bgPaintState.width || 72, h = bgPaintState.height || 128;
  var scale = 8;
  tempCanvas.width = w * scale;
  tempCanvas.height = h * scale;
  var ctx = tempCanvas.getContext('2d');
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      ctx.fillStyle = bgPaintState.colors[y * w + x] || '#080808';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  var dataUrl = tempCanvas.toDataURL('image/png');

  // Save to gallery
  savePaintingToGallery(bgPaintState.description || 'Untitled', dataUrl);

  var link = document.createElement('a');
  link.download = 'caelum-painting-' + Date.now() + '.png';
  link.href = dataUrl;
  link.click();
}

function closePaintPopup() {
  var bar = document.getElementById('paintProgress');
  if (bar) bar.style.display = 'none';
}

