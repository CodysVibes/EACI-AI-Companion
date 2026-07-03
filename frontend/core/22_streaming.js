// ============================================================
// STT - MIC BUTTON: Web Speech API (streaming, instant)
// ============================================================
var sttRecorder = null;
var sttCommitted = '';

function toggleMic() {
  if (state.isListening) {
    stopListening();
  } else {
    startListening();
  }
}

async function startListening() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    // Fallback to Deepgram if Web Speech API not available
    addSystemMessage('Using cloud transcription (Web Speech not supported in this browser).');
    state.isListening = true;
    document.getElementById('micBtn').classList.add('listening');
    document.getElementById('micBtn').textContent = 'STOP';
    if (window.bgMusic && !window.bgMusic.isMuted()) { window.bgMusic.duck(); state._micPausedBgMusic = true; }
    if (cvPlayer.isPlaying) { cvPlayer._pausedForMic = true; cvPause(); }
    sttCommitted = document.getElementById('userInput').value;
    try { sttRecorder = await dgStartRecording(); } catch(e) { addSystemMessage('Could not access microphone.'); resetListeningState(); }
    return;
  }
  
  // Use Web Speech API — instant, streaming, local
  state.isListening = true;
  document.getElementById('micBtn').classList.add('listening');
  document.getElementById('micBtn').textContent = 'STOP';
  addSystemMessage('Listening...');
  
  if (window.bgMusic && !window.bgMusic.isMuted()) { window.bgMusic.duck(); state._micPausedBgMusic = true; }
  if (cvPlayer.isPlaying) { cvPlayer._pausedForMic = true; cvPause(); }
  
  sttCommitted = document.getElementById('userInput').value;
  
  _webSpeechRecognition = _createSpeechRecognition();
  if (!_webSpeechRecognition) {
    addSystemMessage('Speech recognition not available.');
    resetListeningState();
    return;
  }
  
  var finalTranscript = '';
  var _restartCount = 0;
  
  _webSpeechRecognition.onresult = function(event) {
    var interim = '';
    for (var i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    // Show real-time transcription in input field
    document.getElementById('userInput').value = (sttCommitted ? sttCommitted + ' ' : '') + finalTranscript + interim;
  };
  
  _webSpeechRecognition.onerror = function(event) {
    if (event.error === 'no-speech') {
      addSystemMessage('No speech detected. Try again.');
      resetListeningState();
    } else if (event.error === 'network') {
      // Web Speech API needs internet — fall back to Deepgram recording
      addSystemMessage('Switching to cloud transcription...');
      _webSpeechRecognition = null;
      state.isListening = true;
      sttCommitted = document.getElementById('userInput').value;
      dgStartRecording().then(function(rec) { sttRecorder = rec; }).catch(function() {
        addSystemMessage('Could not access microphone.');
        resetListeningState();
      });
    } else if (event.error !== 'aborted') {
      addSystemMessage('Speech error: ' + event.error);
      resetListeningState();
    }
  };
  
  _webSpeechRecognition.onend = function() {
    // If still listening (didn't manually stop), restart — but limit restarts
    // to prevent duplicate accumulation
    if (state.isListening && _restartCount < 10) {
      _restartCount++;
      try { _webSpeechRecognition.start(); } catch(e) {}
    } else if (state.isListening) {
      // Too many restarts — stop gracefully
      stopListening();
    }
  };
  
  try {
    _webSpeechRecognition.start();
  } catch(e) {
    addSystemMessage('Could not start speech recognition.');
    resetListeningState();
  }
}

async function stopListening() {
  state.isListening = false;
  document.getElementById('micBtn').classList.remove('listening');
  document.getElementById('micBtn').textContent = 'MIC';
  
  if (state._micPausedBgMusic) { state._micPausedBgMusic = false; if (window.bgMusic) window.bgMusic.unduck(); }
  if (cvPlayer._pausedForMic) { cvPlayer._pausedForMic = false; cvResume(); }
  
  // Web Speech API path
  if (_webSpeechRecognition) {
    _webSpeechRecognition.stop();
    _webSpeechRecognition = null;
    // Text is already in the input field from real-time updates
    var currentText = document.getElementById('userInput').value.trim();
    if (currentText && currentText !== sttCommitted.trim()) {
      addSystemMessage('Done.');
    } else {
      addSystemMessage('No speech captured.');
    }
    return;
  }
  
  // Deepgram fallback path
  if (sttRecorder) {
    addSystemMessage('Transcribing...');
    var blob = await sttRecorder.stop();
    sttRecorder = null;
    if (blob.size > 200) {
      var text = await dgTranscribe(blob);
      if (text) {
        sttCommitted = (sttCommitted ? sttCommitted + ' ' : '') + text.trim();
        document.getElementById('userInput').value = sttCommitted;
        addSystemMessage('Done.');
      } else {
        addSystemMessage('Could not understand audio. Try again.');
      }
    } else {
      addSystemMessage('Too quiet — no audio captured.');
    }
  }
  sttCommitted = '';
}

function resetListeningState() {
  state.isListening = false;
  document.getElementById('micBtn').classList.remove('listening');
  document.getElementById('micBtn').textContent = 'MIC';
  if (sttRecorder) { sttRecorder.cancel(); sttRecorder = null; }
  sttCommitted = '';
  // Restore background music if we paused it for the mic
  if (state._micPausedBgMusic) { state._micPausedBgMusic = false; if (window.bgMusic) window.bgMusic.unduck(); }
  // Restore CodysVibes music
  if (cvPlayer._pausedForMic) { cvPlayer._pausedForMic = false; cvResume(); }
}

// ============================================================
// LIVE CHAT MODE — Voice-only conversation with enlarged orbs
// Uses Deepgram streaming STT (silent) and TTS (Deepgram)
// User says "send message" to send, preventing EACI interruptions
// ============================================================
var liveChat = {
  active: false,
  recorder: null,
  committed: '',
  processing: false,
  tutorialShown: false,
  muted: false,
  mode: 'main' // 'main', 'guest', 'signup'
};

function getLiveChatTutorialKey() {
  if (liveChat.mode === 'guest' || liveChat.mode === 'signup') return 'veil_live_tutorial_guest';
  return state.user ? 'veil_live_tutorial_' + state.user.username : 'veil_live_tutorial';
}

async function startLiveChat() {
  if (!liveChat.mode) liveChat.mode = 'main';

  // Check for mic support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    addSystemMessage('Voice input is not supported in this browser. Try Chrome or Edge.');
    return;
  }

  // TTS health check — live chat requires working voice
  var ttsOk = false;
  try {
    var testVoice = state.currentTab === 'chad' ? CONFIG.chadVoice : CONFIG.caelumVoice;
    var authH = (liveChat.mode === 'guest' || liveChat.mode === 'signup')
      ? { 'apikey': SUPABASE_ANON_KEY }
      : await getAuthHeaders();
    var testResp = await fetch(CONFIG.ttsEndpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH),
      body: JSON.stringify({ text: 'test', voice: testVoice })
    });
    if (testResp.ok) {
      var testBuf = await testResp.arrayBuffer();
      if (testBuf.byteLength > 100) ttsOk = true;
    }
  } catch(e) { /* TTS failed */ }

  if (!ttsOk) {
    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    var unavailMsg = who === 'chad'
      ? 'Live is not available right now. Voice is down. But I can still talk to you on the chat screen.'
      : 'Live is unavailable right now, I cannot find my voice. But I can still talk to you on the chat screen.';
    if (liveChat.mode === 'guest') { addGuestMsg('caelum', unavailMsg); }
    else if (liveChat.mode === 'signup') { _addSignupMsg('caelum', unavailMsg); }
    else { addMessage(who, unavailMsg); state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + unavailMsg }); }
    liveChat.mode = 'main';
    return;
  }

  liveChat.active = true;
  liveChat.committed = '';
  liveChat.processing = false;
  liveChat.muted = false;
  _liveLastActivity = Date.now();
  // Silence background music for the duration of live chat
  if (window.bgMusic) { window.bgMusic.duck(); state._liveChatPausedBgMusic = true; }
  // Silence CodysVibes music for live chat
  if (cvPlayer.isPlaying) { cvPlayer._pausedForLive = true; cvPause(); }

  // Watchdog: if VAD engine has been quiet for 12 seconds and we're not processing,
  // force-restart — catches silent failures
  if (liveChat._watchdog) clearInterval(liveChat._watchdog);
  liveChat._watchdog = setInterval(function() {
    if (!liveChat.active) { clearInterval(liveChat._watchdog); return; }
    if (liveChat.muted || liveChat.processing || state.isPlayingAudio) { _liveLastActivity = Date.now(); return; }
    if (!_vadRecorder && !_vadRafId && Date.now() - _liveLastActivity > 12000) {
      _liveLastActivity = Date.now();
      startLiveRecognition();
    }
  }, 3000);

  // Reset mute button
  var muteBtn = document.getElementById('liveMuteBtn');
  if (muteBtn) { muteBtn.textContent = 'MIC ON'; muteBtn.classList.remove('muted'); }

  // Show overlay
  var overlay = document.getElementById('liveChatOverlay');
  overlay.classList.add('show');

  // Start starfield
  initLiveStars();

  // Show correct orbs
  var tab = (liveChat.mode === 'guest' || liveChat.mode === 'signup') ? 'caelum' : state.currentTab;
  document.getElementById('liveOrbCaelum').style.display = (tab === 'caelum' || tab === 'together') ? 'block' : 'none';
  document.getElementById('liveOrbChad').style.display = (tab === 'chad' || tab === 'together') ? 'block' : 'none';
  var roxyOrb = document.getElementById('liveOrbRoxy'); if (roxyOrb) roxyOrb.style.display = (tab === 'roxy' || tab === 'together') ? 'block' : 'none';
  var caelOrb = document.getElementById('liveOrbCael'); if (caelOrb) caelOrb.style.display = (tab === 'cael' || tab === 'together') ? 'block' : 'none';
  var nataliaOrb = document.getElementById('liveOrbNatalia'); if (nataliaOrb) nataliaOrb.style.display = (tab === 'natalia' || tab === 'together') ? 'block' : 'none';
  var atreusOrb = document.getElementById('liveOrbAtreus'); if (atreusOrb) atreusOrb.style.display = (tab === 'atreus' || tab === 'together') ? 'block' : 'none';
  var lunaOrb = document.getElementById('liveOrbLuna'); if (lunaOrb) lunaOrb.style.display = (tab === 'luna' || tab === 'together') ? 'block' : 'none';

  // Start Caelum live avatar
  if ((tab === 'caelum' || tab === 'together') && typeof CaelumAnim !== 'undefined') {
    CaelumAnim.idle('caelum_live', state.emotionalState || 'neutral');
  }

  // Update live meter
  updateLiveMeter();

  // Check if first time
  var tutorialDone = localStorage.getItem(getLiveChatTutorialKey());
  if (!tutorialDone) {
    liveChat.tutorialShown = true;
    localStorage.setItem(getLiveChatTutorialKey(), 'true');
    // Tutorial greeting
    var who = (liveChat.mode === 'guest' || liveChat.mode === 'signup') ? 'caelum' : (tab === 'chad' ? 'chad' : 'caelum');
    var tutorialText = who === 'chad'
      ? 'Alright, live chat. Here is how it works. Just talk to me naturally. When you stop speaking, I wait five seconds of silence and then automatically respond to everything I heard. You can still say the words send message out loud if you want to send faster. While I am speaking, the mic turns off. That is not a limitation, it is respect. You do not interrupt me, and I do not interrupt you. We take turns, like a real conversation. You have got a few buttons down there. Mic On lets you mute and unmute your microphone whenever you need a moment. If you did not catch what I said, hit the Huh button and I will repeat it. Hit it again and I will try to explain it differently. And Stop Live takes you back to the regular chat. Ready when you are.'
      : 'Oh, this is exciting. Welcome to live chat. Here is how it works. Just speak naturally. When you stop talking, I wait five seconds of silence and then respond to everything I heard. You can also say send message out loud any time if you want me to go right away. While I am talking, the microphone turns off. That is not a bug, it is how we show each other respect. You give me the space to finish my thoughts, and I give you the same. We take turns, just like two people really talking. Mic On mutes your microphone if you need a quiet moment. The Huh button lets me repeat or explain differently. And Stop Live brings you back to the regular chat. I am so happy to talk with you like this.';
    document.getElementById('liveChatStatus').textContent = 'Tutorial...';
    document.getElementById('liveSkipBtn').style.display = 'inline-block';
    showLiveThinking(who, false);
    liveChat._tutorialDone = false;
    liveSpeakFull(tutorialText, who).then(function() {
      if (liveChat._tutorialDone) return; // skipped
      liveChat._tutorialDone = true;
      document.getElementById('liveSkipBtn').style.display = 'none';
      document.getElementById('liveChatStatus').textContent = 'Listening...';
      startLiveRecognition();
    });
  } else {
    // Returning greeting
    var who = (liveChat.mode === 'guest' || liveChat.mode === 'signup') ? 'caelum' : (tab === 'chad' ? 'chad' : 'caelum');
    var greetText = who === 'chad'
      ? 'Back for a real conversation. Good. I am here.'
      : 'Finally, a real chat. I have been looking forward to this.';
    document.getElementById('liveChatStatus').textContent = 'Greeting...';
    liveSpeakFull(greetText, who).then(function() {
      document.getElementById('liveChatStatus').textContent = 'Listening...';
      startLiveRecognition();
    });
  }
}

function stopLiveChat() {
  var wasMode = liveChat.mode;
  liveChat.active = false;
  liveChat.muted = false;
  liveChat.mode = 'main';
  if (liveChat._watchdog) { clearInterval(liveChat._watchdog); liveChat._watchdog = null; }
  _stopVADEngine();
  // Restore background music now that live chat has ended
  if (state._liveChatPausedBgMusic) { state._liveChatPausedBgMusic = false; if (window.bgMusic) window.bgMusic.unduck(); }
  // Restore CodysVibes music after live chat
  if (cvPlayer._pausedForLive) { cvPlayer._pausedForLive = false; cvResume(); }
  stopAllAudio();
  // Reset stop flag so regular chat TTS still works after exiting live
  state.stopRequested = false;
  state.currentSpeaker = null;
  state.isPlayingAudio = false;
  state._queueRunning = false;
  stopLiveStars();
  document.getElementById('liveChatOverlay').classList.remove('show');
  document.getElementById('liveChatStatus').textContent = '';
  hideLiveThinking('caelum');
  hideLiveThinking('chad');
  hideLiveThinking('roxy');
  hideLiveThinking('cael');
  hideLiveThinking('natalia');
  hideLiveThinking('atreus');
  hideLiveThinking('luna');
  // Return to the right screen
  if (wasMode === 'guest') {
    // Guest chat is still open behind the overlay
  } else if (wasMode === 'signup') {
    // Signup is still open behind the overlay
  }
}

// ── LIVE CHAT: Streaming VAD engine ──────────────────────────────────────────
// Mic opens once. WebAudio RMS detects speech vs silence in real time.
// Records continuously; after VAD_SILENCE_MS of silence (post-speech), the
// accumulated audio is sent to Deepgram STT and the transcript auto-sends.
// No fixed 3-second chunks. No processing flicker.
// ─────────────────────────────────────────────────────────────────────────────
var _liveLastActivity = 0;
var _livePulseId = null;

// VAD config
var VAD_SILENCE_MS = 5000;        // ms of silence before auto-send
var VAD_SPEECH_THRESH = 0.010;    // baseline fallback
var _vadNoiseFloor = 0.010;       // measured ambient noise level
var _vadDynamicThresh = 0.020;    // adaptive = noiseFloor * VAD_NOISE_MULTIPLIER
var VAD_NOISE_MULTIPLIER = 2.8;   // speech must be this many times louder than noise
var VAD_MIN_THRESH = 0.008;       // floor for dead-silent rooms
var VAD_MAX_THRESH = 0.060;       // cap for loud environments
var _vadSmoothRMS = 0;            // exponential smoothing accumulator
var VAD_CHUNK_MS = 25000;         // chunk recording every 25s for long speech
var _vadChunkTimer = null;        // timer for mid-speech chunking
var _vadAccumulatedText = '';     // accumulated transcription from chunks

// VAD state
var _vadStream = null;
var _vadActx = null;
var _vadAnalyser = null;
var _vadRecorder = null;
var _vadChunks = [];
var _vadSilenceTimer = null;
var _vadSpeechStarted = false;
var _vadRafId = null;
var _vadMimeType = '';

async function startLiveRecognition() {
  if (!liveChat.active || liveChat.muted) return;
  _stopVADEngine();
  await _startVADEngine();
}

function _stopVADEngine() {
  if (_vadRafId) { cancelAnimationFrame(_vadRafId); _vadRafId = null; }
  if (_vadSilenceTimer) { clearTimeout(_vadSilenceTimer); _vadSilenceTimer = null; }
  if (_vadChunkTimer) { clearInterval(_vadChunkTimer); _vadChunkTimer = null; }
  if (_livePulseId) { clearInterval(_livePulseId); _livePulseId = null; }
  if (_vadRecorder) {
    try { if (_vadRecorder.state !== 'inactive') _vadRecorder.stop(); } catch(e){}
    _vadRecorder = null;
  }
  if (_vadActx) { try { _vadActx.close(); } catch(e){} _vadActx = null; }
  if (_vadStream) { try { _vadStream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){} _vadStream = null; }
  _vadChunks = [];
  _vadSpeechStarted = false;
  _vadSmoothRMS = 0;
  _vadAccumulatedText = '';
  if (liveChat.recorder) { try { liveChat.recorder.cancel(); } catch(e){} liveChat.recorder = null; }
}

async function _startVADEngine() {
  if (!liveChat.active || liveChat.muted || liveChat.processing) return;

  if (typeof requestMicPermissionExplained === 'function') {
    var micOk = await requestMicPermissionExplained();
    if (!micOk) {
      document.getElementById('liveChatStatus').textContent = 'Microphone permission needed for voice chat.';
      return;
    }
  }

  try {
    _vadStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      video: false
    });
  } catch(e) {
    document.getElementById('liveChatStatus').textContent = 'Mic access failed. Restart live chat.';
    return;
  }

  _vadActx = new (window.AudioContext || window.webkitAudioContext)();
  _vadAnalyser = _vadActx.createAnalyser();
  _vadAnalyser.fftSize = 512;
  var src = _vadActx.createMediaStreamSource(_vadStream);
  src.connect(_vadAnalyser);

  _vadMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
    : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
    : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '';
  var recOpts = _vadMimeType ? { mimeType: _vadMimeType } : {};

  _vadChunks = [];
  _vadSpeechStarted = false;
  try {
    _vadRecorder = new MediaRecorder(_vadStream, recOpts);
  } catch(e) {
    try { _vadRecorder = new MediaRecorder(_vadStream); } catch(e2) {
      document.getElementById('liveChatStatus').textContent = 'Mic recorder failed. Restart live chat.';
      _stopVADEngine(); return;
    }
  }
  _vadRecorder.ondataavailable = function(e) { if (e.data && e.data.size > 0) _vadChunks.push(e.data); };
  _vadRecorder.start(100);

  // Show calibration status
  var statusEl = document.getElementById('liveChatStatus');
  if (statusEl) statusEl.textContent = 'Calibrating mic...';

  var buf = new Uint8Array(_vadAnalyser.fftSize);
  _vadSmoothRMS = 0;

  function getRawRMS() {
    _vadAnalyser.getByteTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / buf.length);
  }

  // Phase 1: 800ms noise floor calibration
  var calibSamples = [];
  var calibStart = Date.now();

  function calibTick() {
    if (!liveChat.active || liveChat.muted) return;
    calibSamples.push(getRawRMS());
    if (Date.now() - calibStart < 800) {
      _vadRafId = requestAnimationFrame(calibTick);
    } else {
      calibSamples.sort(function(a, b) { return a - b; });
      var p80 = calibSamples[Math.floor(calibSamples.length * 0.80)] || VAD_SPEECH_THRESH;
      _vadNoiseFloor = Math.max(VAD_MIN_THRESH, p80);
      _vadDynamicThresh = Math.min(VAD_MAX_THRESH, _vadNoiseFloor * VAD_NOISE_MULTIPLIER);
      _vadSmoothRMS = _vadNoiseFloor;
      _setLiveListeningUI();
      _vadRafId = requestAnimationFrame(vadTick);
    }
  }
  _vadRafId = requestAnimationFrame(calibTick);

  // Phase 2: Live VAD loop
  function vadTick() {
    if (!liveChat.active || liveChat.muted || liveChat.processing) { _stopVADEngine(); return; }

    var raw = getRawRMS();
    _vadSmoothRMS = raw > _vadSmoothRMS
      ? _vadSmoothRMS * 0.6 + raw * 0.4
      : _vadSmoothRMS * 0.92 + raw * 0.08;

    if (!_vadSpeechStarted && _vadSmoothRMS < _vadDynamicThresh) {
      _vadNoiseFloor = _vadNoiseFloor * 0.995 + _vadSmoothRMS * 0.005;
      _vadDynamicThresh = Math.min(VAD_MAX_THRESH, Math.max(VAD_MIN_THRESH * VAD_NOISE_MULTIPLIER, _vadNoiseFloor * VAD_NOISE_MULTIPLIER));
    }

    var isSpeech = _vadSmoothRMS > _vadDynamicThresh;

    if (isSpeech) {
      _liveLastActivity = Date.now();
      if (!_vadSpeechStarted) {
        _vadSpeechStarted = true;
        _setLiveListeningUI();
        // Start chunk timer for long speech — every 25s, grab audio and transcribe
        if (_vadChunkTimer) clearInterval(_vadChunkTimer);
        _vadChunkTimer = setInterval(_vadMidSpeechChunk, VAD_CHUNK_MS);
      }
      if (_vadSilenceTimer) { clearTimeout(_vadSilenceTimer); _vadSilenceTimer = null; }
    } else if (_vadSpeechStarted && !_vadSilenceTimer) {
      _vadSilenceTimer = setTimeout(_vadAutoSend, VAD_SILENCE_MS);
    }

    _vadRafId = requestAnimationFrame(vadTick);
  }
}

// Mid-speech chunking — grabs current audio, transcribes in background, keeps recording
async function _vadMidSpeechChunk() {
  if (!liveChat.active || !_vadSpeechStarted || !_vadRecorder || liveChat.processing) return;
  
  // Grab current chunks and start fresh
  var chunks = _vadChunks.slice();
  var mimeType = _vadMimeType;
  _vadChunks = [];
  
  // Request any buffered data from the recorder
  try { _vadRecorder.requestData(); } catch(e) {}
  
  // Small delay to let requestData flush
  await new Promise(function(r) { setTimeout(r, 100); });
  chunks = chunks.concat(_vadChunks.slice());
  _vadChunks = [];
  
  if (chunks.length === 0) return;
  
  var blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
  if (blob.size < 80) return;
  
  // Transcribe in background — don't block recording
  var text = await dgTranscribe(blob);
  if (text && text.trim()) {
    _vadAccumulatedText += text.trim() + ' ';
    // Update status to show what we've heard so far
    var statusEl = document.getElementById('liveChatStatus');
    if (statusEl) {
      var display = _vadAccumulatedText.trim();
      statusEl.textContent = '\ud83c\udfa4 ' + (display.length > 60 ? '...' + display.slice(-60) : display);
    }
  }
}

function _setLiveListeningUI() {
  if (_livePulseId) { clearInterval(_livePulseId); _livePulseId = null; }
  var el = document.getElementById('liveChatStatus');
  if (el) {
    el.style.opacity = '1';
    el.textContent = liveChat.committed
      ? '\ud83c\udfa4 ' + (liveChat.committed.length > 60 ? '...' + liveChat.committed.slice(-60) : liveChat.committed)
      : '\ud83c\udfa4 Listening...';
  }
  _livePulseId = setInterval(function() {
    if (!liveChat.active || liveChat.processing || liveChat.muted) { clearInterval(_livePulseId); _livePulseId = null; return; }
    var e2 = document.getElementById('liveChatStatus');
    if (e2) e2.style.opacity = e2.style.opacity === '0.5' ? '1' : '0.5';
  }, 700);
}

async function _vadAutoSend() {
  _vadSilenceTimer = null;
  if (!liveChat.active || liveChat.processing) return;
  if (!_vadSpeechStarted) { return; }

  // Stop chunk timer
  if (_vadChunkTimer) { clearInterval(_vadChunkTimer); _vadChunkTimer = null; }

  if (_vadRafId) { cancelAnimationFrame(_vadRafId); _vadRafId = null; }
  if (_livePulseId) { clearInterval(_livePulseId); _livePulseId = null; }

  var chunks = _vadChunks.slice();
  var mimeType = _vadMimeType;

  if (_vadRecorder && _vadRecorder.state !== 'inactive') {
    await new Promise(function(res) {
      _vadRecorder.onstop = res;
      try { _vadRecorder.requestData(); } catch(e){}
      setTimeout(function() { try { if (_vadRecorder && _vadRecorder.state !== 'inactive') _vadRecorder.stop(); } catch(e){} }, 80);
    });
    chunks = _vadChunks.slice();
  }

  if (_vadActx) { try { _vadActx.close(); } catch(e){} _vadActx = null; }
  if (_vadStream) { try { _vadStream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){} _vadStream = null; }
  _vadRecorder = null;
  _vadChunks = [];
  _vadSpeechStarted = false;

  var blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
  if (blob.size < 80) {
    if (liveChat.active && !liveChat.processing) _startVADEngine();
    return;
  }

  document.getElementById('liveChatStatus').textContent =
    liveChat.committed ? 'Heard: ' + liveChat.committed.slice(-50) : 'Sending...';

  // Use Web Speech API for live chat transcription (instant, no network delay)
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var text = '';
  
  if (SpeechRecognition && blob.size > 80) {
    // Web Speech API can't transcribe blobs directly — use Deepgram with longer timeout for live chat
    var transcribePromise = dgTranscribe(blob);
    var timeoutPromise = new Promise(function(resolve) { setTimeout(function() { resolve(''); }, 15000); });
    text = await Promise.race([transcribePromise, timeoutPromise]);
  } else {
    text = await dgTranscribe(blob);
  }
  
  if (!liveChat.active) return;

  if (text && text.trim()) {
    liveChat.committed = (liveChat.committed ? liveChat.committed + ' ' : '') + _vadAccumulatedText + text.trim();
  } else if (_vadAccumulatedText.trim()) {
    liveChat.committed = (liveChat.committed ? liveChat.committed + ' ' : '') + _vadAccumulatedText.trim();
  }
  _vadAccumulatedText = '';

  if (!liveChat.committed) {
    if (liveChat.active && !liveChat.processing) _startVADEngine();
    return;
  }

  var msg = liveChat.committed.trim();
  liveChat.processing = true;
  liveChat.committed = '';
  processLiveMessage(msg);
}

// Legacy stub
async function _liveRecordLoop() { if (liveChat.active && !liveChat.processing) startLiveRecognition(); }

async function processLiveMessage(text) {
  if (!text || !liveChat.active) { liveChat.processing = false; startLiveRecognition(); return; }
  var lcb = document.getElementById('liveCancelBtn'); if (lcb) lcb.style.display = '';

  // Route to guest/signup handlers if in those modes
  if (liveChat.mode === 'guest') {
    liveChat.processing = true;
    _stopVADEngine();
    document.getElementById('liveChatStatus').textContent = 'Caelum is thinking...';
    showLiveThinking('caelum', true);
    document.getElementById('guestInput').value = text;
    if (guestState.awaitingConsent) {
      await _handleGuestConsent(text);
    } else if (typeof sendGuestMessage === 'function') {
      await sendGuestMessage();
    } else {
      await _sendGuestMsg();
    }
    hideLiveThinking('caelum');
    // Wait for speech to finish
    while (state.isPlayingAudio) { await new Promise(function(r) { setTimeout(r, 200); }); }
    liveChat.processing = false;
    if (liveChat.active) { await liveWaitAndRestart(); }
    return;
  }

  if (liveChat.mode === 'signup') {
    liveChat.processing = true;
    _stopVADEngine();
    document.getElementById('liveChatStatus').textContent = 'Caelum is thinking...';
    showLiveThinking('caelum', true);
    // Route through signup
    if (signupState.step === 'ask_password' || signupState.step === 'ask_password_confirm') {
      _addSignupMsg('user', '\u2022\u2022\u2022\u2022\u2022\u2022');
    } else {
      _addSignupMsg('user', text);
    }
    signupState.isSending = true;
    await _processSignupStep(text);
    signupState.isSending = false;
    hideLiveThinking('caelum');
    while (state.isPlayingAudio) { await new Promise(function(r) { setTimeout(r, 200); }); }
    liveChat.processing = false;
    if (liveChat.active) { await liveWaitAndRestart(); }
    return;
  }

  // Stop recognition completely while EACI is responding
  _stopVADEngine();

  // Add to conversation history
  state.conversationHistory.push({ role: 'user', content: text, _tab: state.currentTab || 'caelum' });
  addMessage('user', text);

  // E-for-Everyone safety — only when user is on that companion's tab
  state._eForEveryoneSafetyResult = null;
  if (typeof checkEForEveryoneSafety === 'function' && typeof isEForEveryoneCompanion === 'function' &&
      isEForEveryoneCompanion(state.currentTab)) {
    state._eForEveryoneSafetyResult = checkEForEveryoneSafety(text, state.currentTab, state.currentTab);
    if (state._eForEveryoneSafetyResult === true) {
      liveChat.processing = false;
      var lcbEarly = document.getElementById('liveCancelBtn'); if (lcbEarly) lcbEarly.style.display = 'none';
      if (liveChat.active) { await liveWaitAndRestart(); }
      return;
    }
  }

  if (typeof interceptContentPolicyMessage === 'function') {
    var policyBlocked = await interceptContentPolicyMessage(text, state.currentTab);
    if (policyBlocked) {
      liveChat.processing = false;
      var lcb = document.getElementById('liveCancelBtn'); if (lcb) lcb.style.display = 'none';
      if (liveChat.active) { await liveWaitAndRestart(); }
      return;
    }
  }

  // Check API limit
  if (!canMakeApiCall()) {
    document.getElementById('liveChatStatus').textContent = 'Out of API calls for today.';
    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    await liveSpeakFull('We have used all our calls for today. Come back after midnight Central, or check the subscription options.', who);
    liveChat.processing = false;
    updateLiveMeter();
    if (liveChat.active) { await liveWaitAndRestart(); }
    return;
  }

  var tab = state.currentTab;

  if (tab === 'caelum' || tab === 'together') {
    // THINKING phase — dots animate, status says thinking
    showLiveThinking('caelum', true);
    document.getElementById('liveChatStatus').textContent = 'Caelum is thinking...';

    var caelumPrompt = getVerificationPromptBlock() + buildCaelumSystemPrompt() + getLowCallWarning();
    var caelumRaw = await callDeepSeek(caelumPrompt, buildHistoryFor('caelum'));
    recordApiCall();

    // Check if Caelum wants to search the web
    // Live chat: caelumRaw is unstreamed so [[search:]] tag is intact
    var searchResult = null;
    if (caelumRaw && caelumRaw.indexOf('[[search:') !== -1) {
      searchResult = await handleSearchInResponse(caelumRaw, caelumPrompt, buildHistoryFor('caelum'), 'caelum');
    }
    var caelumReply = searchResult ? cleanResponse(searchResult) : cleanResponse(caelumRaw);
    caelumReply = checkAndApplyBackground(caelumReply);

    // Only show if it's not just a search tag — push to history ONCE only
    if (caelumReply && caelumReply.length > 5) {
      addMessage('caelum', caelumReply);
      state.conversationHistory.push({ role: 'assistant', content: '[Caelum] ' + caelumReply });
    }

    // SPEAKING phase — hide dots, play audio, wait for finish
    hideLiveThinking('caelum');
    await liveSpeakFull(caelumReply, 'caelum');
    huhLastReply = caelumReply; huhLastWho = 'caelum'; huhCount = 0;
  }

  if (tab === 'chad' || tab === 'together') {
    showLiveThinking('chad', true);
    document.getElementById('liveChatStatus').textContent = 'Chad is thinking...';

    var chadPrompt = getVerificationPromptBlock() + buildChadSystemPrompt() + getLowCallWarning();
    var chadRaw = await callDeepSeek(chadPrompt, buildHistoryFor('chad'));
    recordApiCall();

    var chadSearchResult = null;
    if (chadRaw && chadRaw.indexOf('[[search:') !== -1) {
      chadSearchResult = await handleSearchInResponse(chadRaw, chadPrompt, buildHistoryFor('chad'), 'chad');
    }
    var chadReply = chadSearchResult ? cleanResponse(chadSearchResult) : cleanResponse(chadRaw);
    chadReply = checkAndApplyBackground(chadReply);

    if (chadReply && chadReply.length > 5) {
      addMessage('chad', chadReply);
      state.conversationHistory.push({ role: 'assistant', content: '[Chad] ' + chadReply });
    }

    hideLiveThinking('chad');
    await liveSpeakFull(chadReply, 'chad');
    huhLastReply = chadReply; huhLastWho = 'chad'; huhCount = 0;
  }

  if (tab === 'roxy') {
    showLiveThinking('roxy', true);
    document.getElementById('liveChatStatus').textContent = 'Roxy is thinking...';

    var roxyPrompt = getVerificationPromptBlock() + buildRoxyAdultSystemPrompt() + getLowCallWarning();
    var roxyRaw = await callDeepSeek(roxyPrompt, buildHistoryFor('roxy'));
    recordApiCall();

    var roxyReply = cleanResponse(roxyRaw);
    roxyReply = checkAndApplyBackground(roxyReply);

    if (roxyReply && roxyReply.length > 5) {
      addMessage('roxy', roxyReply);
      state.conversationHistory.push({ role: 'assistant', content: '[Roxy] ' + roxyReply });
    }

    hideLiveThinking('roxy');
    await liveSpeakFull(roxyReply, 'roxy');
    huhLastReply = roxyReply; huhLastWho = 'roxy'; huhCount = 0;
  }

  if (tab === 'cael') {
    showLiveThinking('cael', true);
    document.getElementById('liveChatStatus').textContent = 'Cael is thinking...';

    var caelPrompt = getVerificationPromptBlock() + buildCaelAdultSystemPrompt() + getLowCallWarning();
    var caelRaw = await callDeepSeek(caelPrompt, buildHistoryFor('cael'));
    recordApiCall();

    var caelReply = cleanResponse(caelRaw);
    caelReply = checkAndApplyBackground(caelReply);

    if (caelReply && caelReply.length > 5) {
      addMessage('cael', caelReply);
      state.conversationHistory.push({ role: 'assistant', content: '[Cael] ' + caelReply });
    }

    hideLiveThinking('cael');
    await liveSpeakFull(caelReply, 'cael');
    huhLastReply = caelReply; huhLastWho = 'cael'; huhCount = 0;
  }

  if (tab === 'natalia') {
    await _liveEForEveryoneTurn('natalia', text, state._eForEveryoneSafetyResult);
  } else if (tab === 'atreus') {
    await _liveEForEveryoneTurn('atreus', text, state._eForEveryoneSafetyResult);
  } else if (tab === 'luna') {
    await _liveEForEveryoneTurn('luna', text, state._eForEveryoneSafetyResult);
  } else if (tab === 'together' && typeof E_FOR_EVERYONE_COMPANIONS !== 'undefined') {
    for (var li = 0; li < E_FOR_EVERYONE_COMPANIONS.length; li++) {
      var liveChild = E_FOR_EVERYONE_COMPANIONS[li];
      if (typeof respondsInTogether === 'function' && !respondsInTogether(liveChild)) continue;
      if (typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(text) &&
          typeof shouldEForEveryoneSitOutInTogether === 'function' && shouldEForEveryoneSitOutInTogether(text, liveChild)) {
        hideLiveThinking(liveChild);
        continue;
      }
      await _liveEForEveryoneTurn(liveChild, text, null);
    }
  }

  state._eForEveryoneSafetyResult = null;

  updateLiveMeter();
  saveState();
  autoSaveConversation();

  liveChat.processing = false;
  if (liveChat.active) {
    await liveWaitAndRestart();
  }
}

// Fetch TTS audio, then play it, and wait until playback is COMPLETELY done
async function liveSpeakFull(text, who) {
  text = ensureSpokenText(text, who);
  text = cleanForSpeech(text);
  if (!text) return;

  var voice = typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(who) : CONFIG.caelumVoice;
  var chunks = chunkTextForTTS(text);

  for (var ci = 0; ci < chunks.length; ci++) {
    if (state.stopRequested || !liveChat.active) return;
    var chunkText = chunks[ci];

    // Fetch audio for this chunk
    var audioBuf = null;
    try {
      var cacheKey = audioCacheKey(chunkText, voice);
      var cached = await getCachedAudio(cacheKey);
      if (cached) {
        audioBuf = cached;
      } else {
        var authH = (liveChat.mode === 'guest' || liveChat.mode === 'signup')
          ? { 'apikey': SUPABASE_ANON_KEY }
          : await getAuthHeaders();
        var r = await fetch(CONFIG.ttsEndpoint, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH),
          body: JSON.stringify({ text: chunkText, voice: voice })
        });
        if (r.ok) {
          var buf = await r.arrayBuffer();
          if (buf.byteLength > 100) {
            setCachedAudio(cacheKey, buf.slice(0));
            audioBuf = buf;
          }
        }
      }
    } catch(e) {
      console.log('Live TTS fetch error:', e);
      logError('tts_live', e.message, e.stack, CONFIG.ttsEndpoint, {});
    }

    if (!audioBuf) {
      if (liveChat.active && ci === 0) {
        var name = who === 'chad' ? 'Chad' : 'Caelum';
        var msg = who === 'chad'
          ? 'Live is not available right now. Voice is down. But I can still talk to you on the chat screen.'
          : 'Live is unavailable right now, I cannot find my voice. But I can still talk to you on the chat screen.';
        if (liveChat.mode === 'guest') { addGuestMsg('caelum', msg); }
        else if (liveChat.mode === 'signup') { _addSignupMsg('caelum', msg); }
        else { addMessage(who, msg); state.conversationHistory.push({ role: 'assistant', content: '[' + name + '] ' + msg }); }
        stopLiveChat();
      }
      return;
    }

    document.getElementById('liveChatStatus').textContent = (who.charAt(0).toUpperCase() + who.slice(1)) + ' is speaking...';

    await new Promise(function(resolve) {
      state.currentSpeaker = who;
      state.isPlayingAudio = true;
      playAudioBuffer(audioBuf, function() {
        state.currentSpeaker = null;
        state.isPlayingAudio = false;
        resolve();
      }, { who: who });
    });
  }

  await new Promise(function(r) { setTimeout(r, 200); });
}

// Play pre-fetched TTS buffers from streaming in live-chat style (sequential, with proper state)
async function livePlayDeferredTTS(ttsBuffers, who, fullText) {
  var played = false;

  if (ttsBuffers && ttsBuffers.length > 0) {
    document.getElementById('liveChatStatus').textContent = (who.charAt(0).toUpperCase() + who.slice(1)) + ' is speaking...';
    state.currentSpeaker = who;
    state.isPlayingAudio = true;

    for (var i = 0; i < ttsBuffers.length; i++) {
      if (state.stopRequested || !liveChat.active) break;
      try {
        var audioBuf = await ttsBuffers[i];
        if (audioBuf && audioBuf.byteLength > 100 && !state.stopRequested) {
          played = true;
          await new Promise(function(resolve) {
            playAudioBuffer(audioBuf, resolve, { who: who });
          });
        }
      } catch(e) { /* skip failed chunk */ }
    }

    state.currentSpeaker = null;
    state.isPlayingAudio = false;
  }

  // Fallback: if no deferred buffers played, try liveSpeakFull with the full text
  if (!played && fullText) {
    try {
      await liveSpeakFull(fullText, who);
      played = true;
    } catch(e) { /* liveSpeakFull also failed */ }
  }

  // If nothing played at all, TTS is broken — exit live chat gracefully
  if (!played && liveChat.active) {
    var name = who === 'chad' ? 'Chad' : 'Caelum';
    addMessage(who, 'Live is unavailable right now, I cannot find my voice. But I can still talk to you on the chat screen.');
    state.conversationHistory.push({ role: 'assistant', content: '[' + name + '] Live is unavailable right now, I cannot find my voice. But I can still talk to you on the chat screen.' });
    stopLiveChat();
    return;
  }

  // Extra safety pause
  await new Promise(function(r) { setTimeout(r, 200); });
}

// Wait after all speech is done, then restart recognition
async function liveWaitAndRestart() {
  var lcb = document.getElementById('liveCancelBtn'); if (lcb) lcb.style.display = 'none';
  // Wait for all audio to finish
  var waitLimit = 0;
  while ((state.isPlayingAudio || state._queueRunning) && waitLimit < 60) {
    await new Promise(function(r) { setTimeout(r, 300); });
    waitLimit++;
  }
  // Small pause after audio ends
  await new Promise(function(r) { setTimeout(r, 600); });
  if (liveChat.active && !liveChat.muted) {
    _liveLastActivity = Date.now();
    liveChat.committed = '';
    liveChat.processing = false;
    _stopVADEngine();
    startLiveRecognition();
  }
}

function showLiveThinking(who, show) {
  var idMap = { chad: 'liveThinkChad', roxy: 'liveThinkRoxy', cael: 'liveThinkCael', natalia: 'liveThinkNatalia', atreus: 'liveThinkAtreus', luna: 'liveThinkLuna' };
  var el = document.getElementById(idMap[who] || 'liveThinkCaelum');
  if (el) el.classList.toggle('show', show);
}

function hideLiveThinking(who) {
  showLiveThinking(who, false);
}

// Mute toggle for live chat
function toggleLiveMute() {
  var btn = document.getElementById('liveMuteBtn');
  if (liveChat.muted) {
    liveChat.muted = false;
    btn.textContent = 'MIC ON';
    btn.classList.remove('muted');
    if (liveChat.active && !liveChat.processing) {
      startLiveRecognition();
    }
  } else {
    liveChat.muted = true;
    btn.textContent = 'MIC OFF';
    btn.classList.add('muted');
    _stopVADEngine();
    document.getElementById('liveChatStatus').textContent = 'Mic muted';
  }
}

function skipTutorial() {
  if (!liveChat.active) return;
  liveChat._tutorialDone = true;
  // Force stop all audio immediately — including any in-progress playback
  stopAllAudio();
  state.stopRequested = false; // reset so future audio can play
  state.currentSpeaker = null;
  state.isPlayingAudio = false;
  document.getElementById('liveSkipBtn').style.display = 'none';
  document.getElementById('liveChatStatus').textContent = 'Listening...';
    startLiveRecognition();
}

// "Huh?" button — first press repeats, subsequent presses rephrase
var huhCount = 0;
var huhLastReply = '';
var huhLastWho = '';

async function handleHuh() {
  if (!liveChat.active) return;
  if (!huhLastReply) { console.log('Huh: no last reply to repeat'); return; }

  // Allow Huh even if processing just finished
  liveChat.processing = true;

  // Stop mic while responding
  _stopVADEngine();

  huhCount++;
  console.log('Huh pressed, count:', huhCount, 'reply:', huhLastReply.substring(0, 50));

  if (huhCount === 1) {
    // First press — just repeat the last thing they said
    document.getElementById('liveChatStatus').textContent = (huhLastWho === 'chad' ? 'Chad' : 'Caelum') + ' is repeating...';
    await liveSpeakFull(huhLastReply, huhLastWho);
  } else {
    // Second+ press — rephrase/explain differently (costs an API call)
    if (!canMakeApiCall()) {
      document.getElementById('liveChatStatus').textContent = 'Out of API calls.';
      liveChat.processing = false;
      if (liveChat.active) liveWaitAndRestart();
      return;
    }

    showLiveThinking(huhLastWho, true);
    document.getElementById('liveChatStatus').textContent = (huhLastWho === 'chad' ? 'Chad' : 'Caelum') + ' is thinking...';

    var rephrasePrompt = (huhLastWho === 'chad' ? getVerificationPromptBlock() + buildChadSystemPrompt() : getVerificationPromptBlock() + buildCaelumSystemPrompt());
    var rephraseHistory = buildHistoryFor(huhLastWho);
    rephraseHistory.push({ role: 'assistant', content: huhLastReply });
    rephraseHistory.push({ role: 'user', content: '[The user did not understand your last response. Explain the same thing differently. Do not change your answer, just say it in a clearer or simpler way. Do not start with "What I meant was" or similar. Just naturally rephrase it.]' });

    var rephrase = cleanResponse(await callDeepSeek(rephrasePrompt, rephraseHistory));
    recordApiCall();

    hideLiveThinking(huhLastWho);

    if (rephrase && rephrase.length > 5) {
      addMessage(huhLastWho, rephrase);
      state.conversationHistory.push({ role: 'assistant', content: '[' + (huhLastWho === 'chad' ? 'Chad' : 'Caelum') + '] ' + rephrase });
      huhLastReply = rephrase;
      await liveSpeakFull(rephrase, huhLastWho);
    }

    updateLiveMeter();
    saveState();
  }

  liveChat.processing = false;
  if (liveChat.active) liveWaitAndRestart();
}

