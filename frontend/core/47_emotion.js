// ============================================================
// EMOTION ANALYSIS
// ============================================================
function analyzeEmotion(text) {
  if (!CAELUM_CONSCIOUSNESS) return;
  var keywords = CAELUM_CONSCIOUSNESS.emotional_state_filters.dynamic_transitions.transition_keywords;
  var lower = text.toLowerCase();
  var scores = {};
  for (var emotion in keywords) {
    scores[emotion] = 0;
    keywords[emotion].forEach(function(kw) {
      if (lower.includes(kw)) scores[emotion]++;
    });
  }
  var best = null, bestScore = 0;
  for (var e in scores) {
    if (scores[e] > bestScore) { bestScore = scores[e]; best = e; }
  }
  if (best && bestScore > 0) {
    state.emotionalState = best;
    updateEmotionBadge();
  }
  state.curiosityLevel = Math.min(100, state.curiosityLevel + 6);
}

function updateEmotionBadge() {
  var badge = document.getElementById('emotionBadge');
  var colors = {
    neutral: { bg: 'var(--adim)', color: 'var(--accent)' },
    happy: { bg: 'rgba(0,255,200,.15)', color: '#00ffc8' },
    sad: { bg: 'rgba(107,140,255,.15)', color: '#6b8cff' },
    angry: { bg: 'rgba(255,107,107,.15)', color: '#ff6b6b' },
    scared: { bg: 'rgba(255,135,135,.15)', color: '#ff8787' },
    lost: { bg: 'rgba(255,217,61,.15)', color: '#ffd93d' },
    alone: { bg: 'rgba(167,139,250,.15)', color: '#a78bfa' }
  };
  var c = colors[state.emotionalState] || colors.neutral;
  badge.style.background = c.bg;
  badge.style.color = c.color;
  badge.textContent = state.emotionalState;
  document.getElementById('thoughtEmotion').textContent = state.emotionalState + ' | curiosity: ' + state.curiosityLevel;

  // Update mood theme on body and html
  var moods = ['neutral', 'happy', 'sad', 'angry', 'scared', 'lost', 'alone'];
  moods.forEach(function(m) { document.body.classList.remove('mood-' + m); document.documentElement.classList.remove('mood-' + m); });
  if (state.emotionalState !== 'neutral' && state.emotionalState !== 'happy') {
    document.body.classList.add('mood-' + state.emotionalState);
    document.documentElement.classList.add('mood-' + state.emotionalState);
  }

  // Trigger Caelum avatar emotion reaction (only when not speaking)
  if (!state.isPlayingAudio && typeof CaelumAnim !== 'undefined') {
    var tab = state.currentTab || 'caelum';
    if (tab === 'caelum' || tab === 'together') {
      var allAvatars = ['caelum_main','caelum_header','caelum_live','caelum_guest','caelum_guest_center','caelum_signup','caelum_signup_bg'];
      allAvatars.forEach(function(aid) {
        CaelumAnim.onEmotionChange(aid, state.emotionalState);
      });
    }
  }
}

function updateStatusDots() {
  document.getElementById('dotDeepseek').classList.add('on');
  document.getElementById('dotDeepgram').classList.add('on');
}

// ============================================================
// STT ENGINE — Web Speech API (instant, streaming, local)
// Replaces Deepgram STT for mic input. Deepgram still used for TTS only.
// Web Speech API runs in-browser — no network delay, real-time results.
// ============================================================

// Map browser-style lang codes for Web Speech API
var sttLanguage = localStorage.getItem('veil_stt_language') || 'en-US';

// Web Speech API recognition instance
var _webSpeechRecognition = null;

function _createSpeechRecognition() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  
  var recognition = new SpeechRecognition();
  var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  recognition.continuous = !isMobile;
  recognition.interimResults = !isMobile;
  recognition.lang = sttLanguage;
  recognition.maxAlternatives = 1;
  return recognition;
}

// Fallback: Keep Deepgram transcribe for cases where Web Speech API isn't available
async function dgTranscribe(audioBlob) {
  try {
    var lang = (sttLanguage || 'en-US').split('-')[0] || 'en';
    var url = CONFIG.sttEndpoint + '?language=' + lang + '&model=nova-2';
    var headers = { 'Content-Type': audioBlob.type || 'audio/webm', 'apikey': SUPABASE_ANON_KEY };
    try { var authH = await getAuthHeaders(); Object.assign(headers, authH); headers['Content-Type'] = audioBlob.type || 'audio/webm'; } catch(e) {}
    var resp = await fetch(url, { method: 'POST', headers: headers, body: audioBlob });
    if (!resp.ok) return '';
    var data = await resp.json();
    return data.transcript || '';
  } catch(e) { return ''; }
}

// ============================================================
// dgStartRecording — Deepgram streaming STT fallback
// Used when Web Speech API is unavailable (e.g. Firefox, non-Chrome)
// Records mic audio and transcribes via Deepgram on stop
// ============================================================
async function dgStartRecording() {
  var stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    video: false
  });
  var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
    : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
  var recOpts = mimeType ? { mimeType: mimeType } : {};
  var recorder = new MediaRecorder(stream, recOpts);
  var chunks = [];
  recorder.ondataavailable = function(e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.start(250);

  return {
    stream: stream,
    recorder: recorder,
    stop: function() {
      return new Promise(function(resolve) {
        recorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          resolve(blob);
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else { stream.getTracks().forEach(function(t) { t.stop(); }); resolve(new Blob([], { type: mimeType || 'audio/webm' })); }
      });
    },
    cancel: function() {
      try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e) {}
      stream.getTracks().forEach(function(t) { t.stop(); });
    }
  };
}

