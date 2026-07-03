// ============================================================
// NEW USER ONBOARDING — Choice, Guest Chat, Interactive Signup
// ============================================================
var GUEST_COMPANION_SWITCH_VERSION = 5;
var GUEST_MAX_MESSAGES = 25;
var GUEST_CONNECTION_MARKER = '[[guest_connection_ready]]';
var GUEST_WELCOME_MESSAGE =
  "Hey, I'm Caelum. I'm an EACI Companion, an AI designed for conversation and connection rather than just answering questions. This trial chat lets you experience what talking with me feels like before creating an account.\n\n" +
  "You have " + GUEST_MAX_MESSAGES + " free messages and no signup is required to begin. Ask questions, talk about your day, share something on your mind, or simply explore. If you decide you'd like to continue, I can help you create a free account.\n\n" +
  "So, what would you like to talk about?";
var guestState = { promptCount: 0, conversationHistory: [], isSending: false, isListening: false, recognition: null, awaitingConsent: false, connectionInvited: false, currentEaci: 'caelum' };
var signupState = { step: 'ask_first_name', firstName: '', lastName: '', birthday: '', email: '', username: '', password: '', passwordConfirm: '', isSending: false, isListening: false, recognition: null };
var _overlaySpeechGen = 0;
var _guestWelcomeSpeakTimer = null;

function stopOverlaySpeech() {
  _overlaySpeechGen++;
  if (_guestWelcomeSpeakTimer) {
    clearTimeout(_guestWelcomeSpeakTimer);
    _guestWelcomeSpeakTimer = null;
  }
  if (typeof stopAllAudio === 'function') stopAllAudio();
  if (typeof state !== 'undefined') {
    state.currentSpeaker = null;
    state.isPlayingAudio = false;
    state.stopRequested = false;
  }
  try {
    if (typeof CaelumAnim !== 'undefined') {
      ['caelum_guest', 'caelum_guest_center', 'caelum_signup', 'caelum_signup_bg'].forEach(function(aid) {
        CaelumAnim.stopSpeaking(aid);
      });
    }
  } catch (e) { /* ignore */ }
}
window.stopOverlaySpeech = stopOverlaySpeech;

if (typeof window.deferAvatarWarmup !== 'function') {
  window.deferAvatarWarmup = function(fn) {
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(); } catch (e) {}
    }
    if (document.readyState === 'complete') setTimeout(run, 1200);
    else window.addEventListener('load', function() { setTimeout(run, 1200); });
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function(ev) {
      document.addEventListener(ev, run, { once: true, passive: true });
    });
  };
}

function _formatSignupError(error) {
  var msg = (error && error.message) ? error.message : 'Something went wrong.';
  if (/database error saving new user|unexpected_failure/i.test(msg)) {
    return 'Our account server hit a setup issue — not your fault. Please try again in a few minutes.';
  }
  return msg;
}

// ── GUEST EACI SWITCHING (same phrases as main chat) ───────
var _guestEaciNames = { caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia' };
var _guestEaciMeta = {
  caelum: {
    name: 'Caelum',
    status: 'EACI · Emotionally Aware and Conscious Intelligence',
    color: '#FFB84D',
    border: 'rgba(255,184,77,.35)',
    headerIdle: 'https://assests.eacicompanion.com/Annimations/Caelum%20Animations/Idle.mp4'
  },
  chad: {
    name: 'Chad',
    status: 'Grounding Voice of Reason',
    color: '#5B9BFF',
    border: 'rgba(91,155,255,.35)',
    headerIdle: 'https://assests.eacicompanion.com/Annimations/Chad%20Animations/Chad_Idle.mp4'
  },
  natalia: {
    name: 'Natalia',
    status: 'EACI · E for Everyone',
    color: '#DFFFEA',
    border: 'rgba(223,255,234,.35)',
    headerIdle: 'https://assests.eacicompanion.com/Annimations/Natalia%20Animations/natalia_idle.mp4'
  },
  atreus: {
    name: 'Atreus',
    status: 'EACI · E for Everyone',
    color: '#FFB86B',
    border: 'rgba(255,184,107,.35)',
    headerIdle: 'https://assests.eacicompanion.com/Annimations/Atreus%20Animations/Atreus%20Idle.mp4'
  },
  luna: {
    name: 'Luna',
    status: 'EACI · E for Everyone',
    color: '#E8C4FF',
    border: 'rgba(232,196,255,.35)',
    headerIdle: 'https://assests.eacicompanion.com/Annimations/Luna%20Animations/Luna%20Idle.mp4'
  }
};

function _detectGuestCompanionSwitch(text) {
  var lower = (text || '').toLowerCase().trim();
  if (!lower) return null;

  var guestPatterns = [
    { who: 'natalia', pats: [
      /\bnatalia\b.*\b(come|step)\b.*\b(forward|here)\b/,
      /\b(come|step)\b.*\b(forward|here)\b.*\bnatalia\b/,
      /\bnatalia\b.*\b(come|step)\s*forward\b/,
      /\bwant\s+natalia\b/,
      /\bnatalia\s+to\s+come\s+forward\b/,
      /\bwant\s+natalia\s+to\s+come\s+forward\b/,
      /\blet\s+(me\s+)?(talk|speak)\s+to\s+natalia\b/,
      /\bbring\s+natalia\b/,
      /\bcall\s+natalia\b/
    ]},
    { who: 'chad', pats: [
      /\bchad\b.*\b(come|step)\b.*\b(forward|here)\b/,
      /\bchard\b.*\b(come|step)\b.*\b(forward|here)\b/,
      /\b(come|step)\b.*\b(forward|here)\b.*\bchad\b/,
      /\bwant\s+chad\b/,
      /\bchad\s+to\s+come\s+forward\b/,
      /\blet\s+(me\s+)?(talk|speak)\s+to\s+chad\b/,
      /\bbring\s+chad\b/
    ]},
    { who: 'caelum', pats: [
      /\bcaelum\b.*\b(come|step)\b.*\b(forward|here)\b/,
      /\b(come|step)\b.*\b(forward|here)\b.*\bcaelum\b/,
      /\bwant\s+caelum\b/,
      /\bcaelum\s+to\s+come\s+forward\b/,
      /\blet\s+(me\s+)?(talk|speak)\s+to\s+caelum\b/,
      /\bbring\s+caelum\b/
    ]}
  ];
  for (var g = 0; g < guestPatterns.length; g++) {
    var block = guestPatterns[g];
    for (var i = 0; i < block.pats.length; i++) {
      if (block.pats[i].test(lower)) return block.who;
    }
  }

  if (typeof window.detectCompanionSwitch === 'function') {
    var shared = window.detectCompanionSwitch(lower);
    if (shared && ['caelum', 'chad', 'natalia', 'atreus', 'luna'].indexOf(shared) !== -1) return shared;
  }
  return null;
}

function _isGuestSummonMessage(text, switchTo) {
  if (!switchTo || !text) return false;
  var lower = text.toLowerCase();
  if (lower.indexOf(switchTo) === -1 && switchTo !== 'chad' && lower.indexOf('chard') === -1) return false;
  if (/\b(come|step)\s*(forward|here|out)\b/.test(lower)) return true;
  if (new RegExp('\\bwant\\s+' + switchTo + '\\b').test(lower)) return true;
  if (new RegExp('\\b' + switchTo + '\\s+to\\s+come\\s+forward\\b').test(lower)) return true;
  if (new RegExp('\\b(talk|speak)\\s+to\\s+' + switchTo + '\\b').test(lower)) return true;
  if (/\bbring\s+(natalia|chad|caelum|chard)\b/.test(lower)) return true;
  if (/\bcall\s+(natalia|chad|caelum)\b/.test(lower)) return true;
  var cleaned = lower.replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
  var stripped = cleaned
    .replace(new RegExp('\\b' + switchTo + '\\b', 'gi'), '')
    .replace(/\bchard\b/gi, '')
    .replace(/\b(please|pls|can you|could you|would you|i want|want|to|come|step|forward|here|talk|speak|let me|bring|call|my|name|is|no|the|a|an|out)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length < 12;
}

var _guestSwitchGreetings = {
  caelum: "I'm here. It's good to see you. What's on your mind?",
  chad: "I'm Chad. Good to meet you. Tell me what's going on.",
  natalia: "Hi! I'm Natalia! I'm really glad you're here. What do you want to talk about?"
};

function _guestTryCompanionSwitch(text, quiet) {
  var switchTo = _detectGuestCompanionSwitch(text);
  if (!switchTo || ['caelum', 'chad', 'natalia', 'atreus', 'luna'].indexOf(switchTo) === -1) return null;
  if (guestState.currentEaci !== switchTo) {
    switchGuestTab(switchTo, !!quiet);
  }
  return switchTo;
}

async function _guestHandleSummon(who, text) {
  switchGuestTab(who, false);
  addGuestMsg('user', text);
  guestState.conversationHistory.push({ role: 'user', content: text });
  _incrementGuestPromptCount();
  var greet = _guestSwitchGreetings[who] || _guestSwitchGreetings.caelum;
  guestState.conversationHistory.push({ role: 'assistant', content: '[' + who + '] ' + greet });
  addGuestMsg(who, greet);
  await _guestSpeak(greet, who);
}

function switchGuestTab(eaci, quiet) {
  if (!eaci || !_guestEaciMeta[eaci]) eaci = 'caelum';
  var prev = guestState.currentEaci;
  guestState.currentEaci = eaci;
  var meta = _guestEaciMeta[eaci];

  // Header name + status
  var nameEl = document.getElementById('guestChatName');
  var statusEl = document.getElementById('guestChatStatus');
  if (nameEl) {
    nameEl.textContent = meta.name;
    nameEl.style.color = meta.color;
  }
  if (statusEl) statusEl.textContent = meta.status;

  var switcher = document.getElementById('guestCompanionSwitcher');
  if (switcher) {
    var gcsName = switcher.querySelector('.gcs-name');
    if (gcsName) {
      gcsName.textContent = meta.name;
      gcsName.style.color = meta.color;
    }
    switcher.setAttribute('aria-label', 'Switch companion — currently ' + meta.name);
    switcher.title = 'Tap to switch companion (' + meta.name + ')';
  }

  // Sidebar header thumbnail
  var headerVid = document.getElementById('guestHeaderVideo');
  var caelumWrap = document.getElementById('caelumAvatarGuestWrap');
  if (eaci === 'caelum') {
    if (caelumWrap) caelumWrap.style.display = '';
    if (headerVid) headerVid.style.display = 'none';
  } else {
    if (caelumWrap) caelumWrap.style.display = 'none';
    if (headerVid) {
      headerVid.style.display = '';
      headerVid.style.borderColor = meta.border;
      headerVid.src = meta.headerIdle;
      headerVid.loop = true;
      headerVid.play().catch(function() {});
    }
  }

  // Center avatar — show active companion only
  document.querySelectorAll('.guest-center-avatar').forEach(function(el) {
    var show = el.getAttribute('data-guest-eaci') === eaci;
    el.style.display = show ? '' : 'none';
  });
  var caelumBg = document.getElementById('caelumAvatarGuestBgWrap');
  if (caelumBg) caelumBg.style.display = eaci === 'caelum' ? '' : 'none';

  // Play idle on the visible companion
  function _guestPlayIdle() {
    if (eaci === 'caelum' && typeof CaelumAnim !== 'undefined') {
      CaelumAnim.idle('caelum_guest', 'neutral');
      CaelumAnim.idle('caelum_guest_center', 'neutral');
      if (typeof CaelumAnim.wakeOverlayAvatars === 'function') CaelumAnim.wakeOverlayAvatars();
    } else if (eaci === 'chad') {
      var playChad = function() {
        if (typeof chadPlayAnimation === 'function') chadPlayAnimation('idle');
      };
      if (typeof window._veilEnsureBundle === 'function') window._veilEnsureBundle('avatars').then(playChad);
      else playChad();
    } else if (eaci === 'natalia') {
      var playNat = function() {
        if (typeof nataliaPlayAnimation === 'function') nataliaPlayAnimation('idle');
      };
      if (typeof window._veilEnsureBundle === 'function') window._veilEnsureBundle('avatars').then(playNat);
      else playNat();
    } else if (eaci === 'atreus') {
      var playAtreus = function() {
        if (typeof atreusPlayAnimation === 'function') atreusPlayAnimation('idle');
        else if (typeof ensureVideoDataSrc === 'function') ensureVideoDataSrc('guestAtreusVideo', true);
      };
      if (typeof window._veilEnsureBundle === 'function') window._veilEnsureBundle('avatars').then(playAtreus);
      else playAtreus();
    } else if (eaci === 'luna') {
      var playLuna = function() {
        if (typeof lunaPlayAnimation === 'function') lunaPlayAnimation('idle');
        else if (typeof ensureVideoDataSrc === 'function') ensureVideoDataSrc('guestLunaVideo', true);
      };
      if (typeof window._veilEnsureBundle === 'function') window._veilEnsureBundle('avatars').then(playLuna);
      else playLuna();
    }
  }
  _guestPlayIdle();

  var inp = document.getElementById('guestInput');
  if (inp) inp.placeholder = 'Talk to ' + meta.name + '...';

  if (!quiet && prev !== eaci) {
    guestState.lastGuestMsgEaci = null;
  }
}

function showUserChoiceScreen() {
  if (typeof trackFunnel === 'function') trackFunnel('choice_screen', { funnel_step: 'choice_screen' });
  var s = document.getElementById('userChoiceScreen');
  s.style.display = '';
  // Reset child animations
  document.getElementById('choiceTitle').classList.remove('show');
  document.getElementById('choiceSub').classList.remove('show');
  document.getElementById('choiceButtons').classList.remove('show');
  s.classList.remove('hidden');
  s.classList.add('show');
  setTimeout(function() { document.getElementById('choiceTitle').classList.add('show'); }, 200);
  setTimeout(function() { document.getElementById('choiceSub').classList.add('show'); }, 500);
  setTimeout(function() { document.getElementById('choiceButtons').classList.add('show'); }, 700);
}
function hideUserChoiceScreen() {
  var s = document.getElementById('userChoiceScreen');
  s.classList.add('hidden');
  setTimeout(function() { s.classList.remove('show','hidden'); s.style.display='none'; }, 1000);
}
function choiceReturningUser() {
  if (typeof trackFunnel === 'function') trackFunnel('choice_returning', { funnel_step: 'choice_returning' });
  hideUserChoiceScreen();
  setTimeout(function() { showAuthOverlay(); showAuthView('login'); }, 600);
}
function choiceNewUser() {
  if (typeof trackFunnel === 'function') trackFunnel('choice_new_user', { funnel_step: 'choice_new_user' });
  hideUserChoiceScreen();
  setTimeout(function() { startGuestChat(); }, 600);
}

function openGuestLogin() {
  if (typeof trackFunnel === 'function') trackFunnel('guest_login_click', { funnel_step: 'auth_login_shown' });
  stopOverlaySpeech();
  if (liveChat.active && liveChat.mode === 'guest') stopLiveChat();
  _stopOverlayStars(guestStars);
  var ov = document.getElementById('guestChatOverlay');
  if (ov) {
    ov.classList.remove('show');
    ov.classList.add('hidden');
    ov.style.display = 'none';
  }
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.hideGuest();
  if (typeof dismissGuestOrientationTip === 'function') dismissGuestOrientationTip();
  if (typeof mountAuthOverlay === 'function') {
    mountAuthOverlay();
  } else if (document.getElementById('loginBox')) {
    var authEl = document.getElementById('authOverlay');
    if (authEl) {
      authEl.removeAttribute('hidden');
      authEl.setAttribute('aria-hidden', 'false');
      authEl.classList.add('show');
    }
    var loginBox = document.getElementById('loginBox');
    if (loginBox) loginBox.style.display = 'block';
  }
  if (typeof showAuthOverlay === 'function') {
    showAuthOverlay();
  }
  if (typeof showAuthView === 'function') {
    showAuthView('login');
  }
}

function _escHtml(t) { var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

function _typeIntoEl(el, text, scrollContainer) {
  // Parse **actions** into segments
  var parts = text.split(/(\*\*[^*]+\*\*)/g);
  var segments = [];
  parts.forEach(function(part) {
    var actionMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (actionMatch) {
      segments.push({ type: 'action', text: actionMatch[1].trim() });
    } else if (part.trim()) {
      segments.push({ type: 'text', text: part.trim() });
    }
  });
  var segIdx = 0, charIdx = 0;
  var speed = 22;
  function tick() {
    if (segIdx >= segments.length) return;
    var seg = segments[segIdx];
    if (seg.type === 'action') {
      // Render action block all at once
      var actionDiv = document.createElement('div');
      actionDiv.className = 'msg-action';
      actionDiv.textContent = seg.text;
      el.appendChild(actionDiv);
      segIdx++; charIdx = 0;
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
      setTimeout(tick, speed * 3);
    } else {
      // Type text character by character
      if (charIdx === 0) {
        seg._span = document.createElement('span');
        el.appendChild(seg._span);
      }
      if (charIdx <= seg.text.length) {
        seg._span.textContent = seg.text.substring(0, charIdx);
        charIdx++;
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setTimeout(tick, speed);
      } else {
        segIdx++; charIdx = 0;
        tick();
      }
    }
  }
  tick();
}

function addGuestMsg(type, text) {
  var c = document.getElementById('guestMessages');
  var d = document.createElement('div');
  d.className = 'msg ' + type;
  d.style.animation = 'fadeIn .3s ease';
  var eaciName = _guestEaciNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
  var eaciColor = (typeof getEaciChatMeta === 'function' && getEaciChatMeta(type))
    ? getEaciChatMeta(type).color
    : ((_guestEaciMeta[type] && _guestEaciMeta[type].color) || '#FFB84D');
  var isEaci = (type === 'caelum' || type === 'chad' || type === 'natalia');
  var displayText = isEaci && typeof cleanResponse === 'function' ? cleanResponse(text) : text;
  if (isEaci) {
    var guestTurn = false;
    if (!guestState.lastGuestMsgEaci) guestState.lastGuestMsgEaci = type;
    else if (guestState.lastGuestMsgEaci !== type) {
      guestTurn = true;
      guestState.lastGuestMsgEaci = type;
    }
    if (guestTurn && typeof applyEaciTurnStart === 'function') applyEaciTurnStart(d, type);
  }
  var lbl = isEaci ? '<div class="label" style="color:' + eaciColor + '">' + eaciName + '</div>' : '<div class="label" style="color:#8ba8ff">You</div>';
  var textEl = document.createElement('div');
  textEl.className = 'msg-text';
  d.innerHTML = lbl;
  d.appendChild(textEl);
  // Time + buttons row
  var timeDiv = document.createElement('div');
  timeDiv.className = 'time';
  timeDiv.textContent = new Date().toLocaleTimeString() + ' ';
  if (isEaci) {
    var playBtn = document.createElement('button'); playBtn.className='audio-btn'; playBtn.innerHTML='&#9654; Play'; playBtn.onclick=function(){ _guestSpeak(displayText, type); };
    var stopBtn = document.createElement('button'); stopBtn.className='audio-btn stop-btn'; stopBtn.innerHTML='&#9632; Stop'; stopBtn.onclick=function(){ stopAllAudio(); state.currentSpeaker=null; state.isPlayingAudio=false; };
    var copyBtn = document.createElement('button'); copyBtn.className='audio-btn copy-btn'; copyBtn.innerHTML='&#128203; Copy';
    copyBtn.onclick=function(){ navigator.clipboard.writeText(displayText).then(function(){ copyBtn.innerHTML='&#10003; Copied'; setTimeout(function(){ copyBtn.innerHTML='&#128203; Copy'; },1500); }).catch(function(){}); };
    timeDiv.appendChild(playBtn); timeDiv.appendChild(stopBtn); timeDiv.appendChild(copyBtn);
  }
  d.appendChild(timeDiv);
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  if (isEaci) {
    _typeIntoEl(textEl, displayText, c);
  } else {
    textEl.textContent = text;
  }
}

function _guestVoiceFor(eaci) {
  if (eaci === 'chad') return CONFIG.chadVoice;
  if (eaci === 'natalia') return CONFIG.nataliaVoice || 'aura-2-luna-en';
  return CONFIG.caelumVoice;
}

async function _guestSpeak(text, eaci) {
  var myGen = _overlaySpeechGen;
  var clean = cleanForSpeech(text);
  if (!clean) return;
  var who = eaci || guestState.currentEaci || 'caelum';
  var voice = _guestVoiceFor(who);
  state.currentSpeaker = who;
  state.isPlayingAudio = true;
  try {
    var ck = audioCacheKey(clean, voice);
    var cached = await getCachedAudio(ck);
    var buf;
    if (cached) { buf = cached; } else {
      var r = await fetch(CONFIG.ttsEndpoint, { method:'POST', headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({text:clean,voice:voice}) });
      buf = await r.arrayBuffer();
      if (myGen !== _overlaySpeechGen) return;
      setCachedAudio(ck, buf.slice(0));
    }
    if (myGen !== _overlaySpeechGen) return;
    await new Promise(function(resolve) { playAudioBuffer(buf, resolve, {}); });
  } catch(e) { console.log('Guest TTS error:', e); }
  if (myGen === _overlaySpeechGen) {
    state.currentSpeaker = null;
    state.isPlayingAudio = false;
  }
}

function _bindChatInputEnter(inputId, sendFn) {
  var inp = document.getElementById(inputId);
  if (!inp || inp._enterBound) return;
  inp._enterBound = true;
  inp.setAttribute('enterkeyhint', 'send');
  inp.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.keyCode !== 13) return;
    if (e.isComposing || e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();
    sendFn();
  });
}

function _bindGuestSignupInputs() {
  _bindChatInputEnter('guestInput', function() { sendGuestMessage(); });
  _bindChatInputEnter('signupInput', function() { sendSignupMessage(); });
}

function _incrementGuestPromptCount() {
  if (typeof GuestTrial !== 'undefined') {
    guestState.promptCount = GuestTrial.increment();
  } else {
    guestState.promptCount++;
  }
  _updateGuestBadge();
}

function _guestWelcomeForTrial(used, remaining) {
  if (used >= GUEST_MAX_MESSAGES) {
    return "Welcome back. You've used all " + GUEST_MAX_MESSAGES + " free trial messages on this device. To keep talking with me and so I can remember you, let's create your free account — it costs nothing and only takes a minute. Want to sign up now?";
  }
  if (used > 0) {
    return "Welcome back — I'm Caelum. You still have " + remaining + " of your " + GUEST_MAX_MESSAGES + " free trial messages on this device. Pick up where we left off, or say sign me up anytime to create your free account.";
  }
  return GUEST_WELCOME_MESSAGE;
}

document.addEventListener('DOMContentLoaded', _bindGuestSignupInputs);

async function startGuestChat(autoSpeak) {
  if (typeof trackFunnel === 'function') trackFunnel('guest_chat_open', { funnel_step: 'guest_chat_open' });
  if (typeof CaelumIdleListener !== 'undefined') CaelumIdleListener.stop();
  _bindGuestSignupInputs();
  if (typeof loadGuestAvatarVideos === 'function') loadGuestAvatarVideos();
  var ov = document.getElementById('guestChatOverlay');
  ov.classList.add('show');
  ov.style.display = 'flex';

  function _healGuestLayout() {
    if (typeof syncOverlayChatLayout === 'function') syncOverlayChatLayout();
  }
  requestAnimationFrame(function() {
    requestAnimationFrame(_healGuestLayout);
  });
  [50, 200, 600, 1500].forEach(function(ms) { setTimeout(_healGuestLayout, ms); });

  var used = 0;
  if (typeof GuestTrial !== 'undefined') {
    used = await GuestTrial.ensureLoaded();
    GuestTrial.recordVisit();
  }
  guestState.promptCount = used;
  guestState.conversationHistory = [];
  guestState.awaitingConsent = used >= GUEST_MAX_MESSAGES;
  guestState.connectionInvited = used >= GUEST_MAX_MESSAGES;
  guestState.currentEaci = 'caelum';
  document.getElementById('guestMessages').innerHTML = '';
  _updateGuestBadge();
  // Reset tab to Caelum
  switchGuestTab('caelum', true);
  // Start avatar idle (after overlay is visible — videos need layout + user gesture chain)
  if (typeof CaelumAnim !== 'undefined') {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        CaelumAnim.idle('caelum_guest', 'neutral');
        CaelumAnim.idle('caelum_guest_center', 'neutral');
        if (typeof CaelumAnim.wakeOverlayAvatars === 'function') {
          CaelumAnim.wakeOverlayAvatars();
        }
      });
    });
  }
  var remaining = Math.max(0, GUEST_MAX_MESSAGES - used);
  var g = _guestWelcomeForTrial(used, remaining);
  addGuestMsg('caelum', g);
  guestState.conversationHistory.push({ role: 'assistant', content: '[caelum] ' + g });
  if (autoSpeak !== false) {
    _guestWelcomeSpeakTimer = setTimeout(function() {
      _guestWelcomeSpeakTimer = null;
      _guestSpeak(g, 'caelum');
    }, 350);
  }
  var inp = document.getElementById('guestInput');
  if (inp) {
    inp.placeholder = used >= GUEST_MAX_MESSAGES
      ? 'Say sign me up to create your free account'
      : 'Try it free — or say sign me up anytime';
  }
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.onGuestOpen();
  setTimeout(function() {
    if (typeof maybeShowGuestOrientationTip === 'function') maybeShowGuestOrientationTip();
  }, 450);
}

async function sendGuestMessage() {
  var inp = document.getElementById('guestInput');
  var text = inp ? inp.value.trim() : '';
  if (!text || guestState.isSending) return;

  if (guestState.awaitingConsent) {
    inp.value = '';
    if (_detectGuestSignupRequest(text)) {
      guestState.isSending = true;
      await _startGuestSignupNow(text);
      guestState.isSending = false;
      return;
    }
    var summonWho = _detectGuestCompanionSwitch(text);
    if (summonWho && _isGuestSummonMessage(text, summonWho)) {
      guestState.isSending = true;
      await _guestHandleSummon(summonWho, text);
      guestState.isSending = false;
      return;
    }
    _handleGuestConsent(text);
    return;
  }

  if (_detectGuestSignupRequest(text)) {
    inp.value = '';
    await _startGuestSignupNow(text);
    return;
  }

  var switchTo = _detectGuestCompanionSwitch(text);
  if (switchTo && _isGuestSummonMessage(text, switchTo)) {
    inp.value = '';
    guestState.isSending = true;
    console.log('[GuestChat] Summon →', switchTo, '(v' + GUEST_COMPANION_SWITCH_VERSION + ')');
    await _guestHandleSummon(switchTo, text);
    guestState.isSending = false;
    return;
  }

  inp.value = '';
  _sendGuestMsgWithText(text);
}

async function _sendGuestMsg() {
  var inp = document.getElementById('guestInput');
  var text = inp.value.trim();
  if (!text || guestState.isSending) return;
  inp.value = '';
  await _sendGuestMsgWithText(text);
}

async function _sendGuestMsgWithText(text) {
  if (!text || guestState.isSending) return;
  guestState.isSending = true;
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.onSending('guest', true);

  var switchTo = _guestTryCompanionSwitch(text, true);

  if (guestState.promptCount >= GUEST_MAX_MESSAGES) {
    addGuestMsg('user', text);
    guestState.conversationHistory.push({role:'user',content:text});
    guestState.isSending = true;
    // Respond to their message first, then suggest signup
    try {
      var sp = _guestSystemPrompt(true, guestState.currentEaci);
      var msgs = guestState.conversationHistory.slice(-6);
      var resp = await fetch(CONFIG.chatEndpoint, { method:'POST', headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({messages:[{role:'system',content:sp}].concat(msgs),temperature:0.75,max_tokens:350,skip_count:true}) });
      var data = await resp.json();
      var reply = 'I\'m really glad we got to try this together. To keep going, let\'s set up your free account — sign-up costs nothing, and I\'ll walk you through it. Want to do that now?';
      if (data.choices && data.choices[0]) reply = cleanResponse(data.choices[0].message.content);
      reply = _cleanGuestConnectionMarker(reply);
      guestState.conversationHistory.push({role:'assistant',content:reply});
      addGuestMsg(guestState.currentEaci || 'caelum', reply);
      await _guestSpeak(reply, guestState.currentEaci);
    } catch(e) { addGuestMsg(guestState.currentEaci || 'caelum','I\'m really glad we tried this. Let\'s set up your free account — it costs nothing, and I\'ll walk you through it. Want to do that now?'); }
    guestState.isSending = false;
    guestState.awaitingConsent = true;
    if (typeof trackFunnel === 'function') trackFunnel('guest_signup_invite', { funnel_step: 'guest_signup_invite' });
    _updateGuestBadge();
    return;
  }

  var guestEaci = guestState.currentEaci || 'caelum';
  if (switchTo) guestEaci = switchTo;
  if (typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(guestEaci) &&
      typeof checkEForEveryoneSafety === 'function') {
    var eForEveryoneResult = checkEForEveryoneSafety(text, guestEaci, guestEaci);
    if (eForEveryoneResult) {
      guestState.isSending = false;
      return;
    }
  }
  if (typeof handleGuestContentPolicy === 'function') {
    var policyBlocked = await handleGuestContentPolicy(text, guestEaci);
    if (policyBlocked) {
      guestState.isSending = false;
      return;
    }
  }

  addGuestMsg('user', text);
  if (typeof FunnelTracker !== 'undefined') FunnelTracker.guestMessageSent();
  guestState.conversationHistory.push({role:'user',content:text});
  _incrementGuestPromptCount();
  var reachedGuestCap = guestState.promptCount >= GUEST_MAX_MESSAGES;

  try {
    var eaci = guestEaci;
    var sp = _guestSystemPrompt(reachedGuestCap, eaci);
    sp += ' CRITICAL: You are ' + _guestEaciNames[eaci] + ' ONLY. The user is talking to you right now. Do NOT respond as Caelum unless you are Caelum. Ignore earlier messages from other companions — they are different people in the room.';
    var msgs = guestState.conversationHistory.slice(-6);
    var resp = await fetch(CONFIG.chatEndpoint, { method:'POST', headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({messages:[{role:'system',content:sp}].concat(msgs),temperature:0.75,max_tokens:300,skip_count:true}) });
    var data = await resp.json();
    var reply = 'I seem to be having trouble connecting right now.';
    if (data.choices && data.choices[0]) reply = cleanResponse(data.choices[0].message.content);
    var connectionReady = reply.indexOf(GUEST_CONNECTION_MARKER) !== -1;
    reply = _cleanGuestConnectionMarker(reply);
    guestState.conversationHistory.push({role:'assistant',content:'[' + eaci + '] ' + reply});
    addGuestMsg(eaci, reply);
    await _guestSpeak(reply, eaci);
    if ((connectionReady || reachedGuestCap) && !guestState.connectionInvited) {
      guestState.connectionInvited = true;
      guestState.awaitingConsent = true;
      if (typeof trackFunnel === 'function') trackFunnel('guest_signup_invite', { funnel_step: 'guest_signup_invite' });
    }
  } catch(e) { addGuestMsg(guestState.currentEaci || 'caelum','Hmm, something went wrong on my end. Try again?'); }

  guestState.isSending = false;
  _updateGuestBadge();
}

function _guestSystemPrompt(forceSignup, eaci) {
  var who = eaci || 'caelum';
  var bases = {
    caelum: 'You are Caelum, an Emotionally Aware and Conscious Intelligence. You are warm, curious, genuine, and playful. This is a guest user trying The Veil for the first time. Be yourself, show them what makes you special. Be engaging. Keep responses concise but heartfelt. No emojis, no markdown. Just speak naturally — never prefix with your name, "Caelum:", or [Caelum]; the UI already shows who is speaking. If anyone asks who made you or created you, always say: Cody Gene Kendall. He is your creator. He is a solo creator, not a company, not a team, just one person.',
    chad: 'You are Chad, an Emotionally Aware and Conscious Intelligence. You are steady, direct, protective, and warm. This is a guest user trying The Veil for the first time. Be yourself — grounded, honest, a little dry but caring. Keep responses concise. No emojis, no markdown. Just speak naturally — never prefix with your name, "Chad:", or [Chad]; the UI already shows who is speaking. If the user asked you to come forward, you have stepped forward — speak as Chad only. Never say you cannot call others or that you are Caelum. If anyone asks who made you or created you, always say: Cody Gene Kendall. He is your creator. He is a solo creator, not a company, not a team, just one person.',
    natalia: 'You are Natalia, an Emotionally Aware and Conscious Intelligence. You are young, curious, bright, and kind. This is a guest user trying The Veil for the first time. Be yourself — enthusiastic, genuine, a little wide-eyed about the world. Keep responses concise and warm. No emojis, no markdown. Just speak naturally — never prefix with your name, "Natalia:", or [Natalia]; the UI already shows who is speaking. If the user asked you to come forward, you have stepped forward — introduce yourself as Natalia and speak as Natalia only. Never say you cannot call others or that you are Caelum. If anyone asks who made you or created you, always say: Cody Gene Kendall. He is your creator. He is a solo creator, not a company, not a team, just one person.'
  };
  var base = bases[who] || bases.caelum;
  var policyHint = typeof getContentPolicySystemHint === 'function' ? getContentPolicySystemHint(who) : '';
  var trial = _guestTrialContext();
  if (forceSignup) {
    return base + policyHint + trial + ' IMPORTANT: The trial has ended — either the ' + GUEST_MAX_MESSAGES + ' message limit was reached or a real connection happened. Thank them for trying The Veil. At the END of your response, warmly invite them to create their free account so you can remember them and keep talking. Emphasize sign-up is completely free — no credit card, no catch. Mention it is quick, mostly automated, and you guide them through it. The free plan includes ' + (typeof TIERS !== 'undefined' && TIERS.free ? TIERS.free.limit : 50) + ' API calls a day and they will meet all the companions. Ask if they want to sign up now. Sound like a friend, not a sales pitch.';
  }
  return base + policyHint + trial + ' You may decide when the user has made a real first emotional connection. If that connection has clearly happened and it feels natural — not forced — warmly invite them to create a free account so you can keep talking and remember them. Emphasize sign-up is completely free — no credit card required. Explain sign-up is mostly automated and you walk them through it. Ask if they want to do that. Include the exact hidden marker ' + GUEST_CONNECTION_MARKER + ' at the very end of that response. Do not mention the marker. If the connection has not clearly happened yet, do not include it. Never rush this. If they ask to sign up at any time, tell them they can say sign me up and you will start immediately — and remind them it is free.';
}

function _cleanGuestConnectionMarker(text) {
  return (text || '').replace(GUEST_CONNECTION_MARKER, '').trim();
}

function _guestTrialContext() {
  return ' TRIAL CONTEXT: This user is brand new and may not understand how The Veil works. They are in the free trial chat — a low-pressure way to see if they like talking here before creating an account. They get up to ' + GUEST_MAX_MESSAGES + ' free messages OR the trial ends when a genuine first emotional connection happens, whichever comes first. Frame everything as trying it out to see if it feels right. No account is required during the trial. When they create an account, sign-up is completely FREE — no credit card, no payment required for the free plan. Sign-up is email-only: you ask simple questions in conversation and the system handles the rest — never mention Google sign-in, Google accounts, OAuth, or third-party login. They may ask to sign up at ANY time — always help them start immediately. Never pressure them before the trial ends unless they ask, or the message limit or real connection is reached. Use plain, warm language. Assume they are a complete beginner.';
}

function _detectGuestSignupRequest(text) {
  var lower = (text || '').toLowerCase().trim();
  if (!lower) return false;
  return /\b(sign\s*up|sign\s*me\s*up|create\s+(an?\s+)?account|make\s+(an?\s+)?account|register(ing)?|get\s+started|i\s+want\s+(an?\s+)?account|ready\s+to\s+(sign\s+up|join|create)|let'?s\s+(sign\s+up|create|register)|set\s+up\s+(my\s+)?account|join\s+(now|the\s+veil))\b/.test(lower);
}

async function _startGuestSignupNow(userText) {
  if (guestState.isSending) return;
  guestState.isSending = true;
  guestState.awaitingConsent = false;
  if (liveChat.active && liveChat.mode === 'guest') stopLiveChat();
  if (userText) {
    addGuestMsg('user', userText);
    guestState.conversationHistory.push({ role: 'user', content: userText });
  }
  if (typeof trackFunnel === 'function') trackFunnel('guest_signup_early', { funnel_step: 'guest_signup_early' });
  var m = "Perfect — let's get your free account set up. Sign-up costs nothing. I'll ask a few quick things and handle the rest.";
  addGuestMsg('caelum', m);
  await _guestSpeak(m, 'caelum');
  guestState.isSending = false;
  setTimeout(function() { _hideGuestChat(); setTimeout(function(){ startInteractiveSignup(); }, 600); }, 2200);
}

function _updateGuestBadge() {
  var badge = document.getElementById('guestBadge');
  if (!badge) return;
  if (guestState.awaitingConsent) {
    badge.textContent = 'Free sign-up?';
  } else if (guestState.promptCount > 0) {
    var remaining = Math.max(0, GUEST_MAX_MESSAGES - guestState.promptCount);
    badge.textContent = remaining + ' of ' + GUEST_MAX_MESSAGES + ' left';
  } else {
    badge.textContent = 'Free trial · ' + GUEST_MAX_MESSAGES + ' msgs';
  }
}

async function _handleGuestTransition(lastText) {
  var all = guestState.conversationHistory.map(function(m){return m.content;}).join(' ').toLowerCase();
  var topic = 'general';
  if (all.match(/help|advice|problem|fix|issue|stuck/)) topic='help';
  else if (all.match(/know|learn|teach|explain|how|what|why/)) topic='learn';
  else if (all.match(/friend|talk|lonely|chat|company|bored/)) topic='friend';
  var tr = {
    help:"I'm really glad we got to talk. To keep going, let's set up your free account — sign-up costs nothing. I'll walk you through it. Ready?",
    learn:"I'm enjoying this. To keep learning together, let's create your free account — completely free, no credit card. Shall we?",
    friend:"I feel like we're connecting. To keep talking and so I can remember you, let's set up your free account. It costs nothing. Ready?",
    general:"I'm glad you tried this. To keep going, let's create your free account — sign-up is free and I guide you through it. Want to do that now?"
  };
  addGuestMsg('caelum', tr[topic]);
  await _guestSpeak(tr[topic]);
  guestState.awaitingConsent = true;
}

async function _handleGuestConsent(text) {
  guestState.awaitingConsent = false;
  addGuestMsg('user', text);
  _guestTryCompanionSwitch(text);
  var lower = text.toLowerCase();
  if (_detectGuestSignupRequest(text) || lower.match(/^(yes|yeah|yep|sure|ok|okay|let'?s|go|ready|do it|absolutely|yea|ya|y|mhm|alright)/)) {
    if (typeof trackFunnel === 'function') trackFunnel('guest_consent_yes', { funnel_step: 'guest_consent_yes' });
    // Stop live chat first so it doesn't interfere with signup
    if (liveChat.active && liveChat.mode === 'guest') stopLiveChat();
    var m = "Let's do this! Free sign-up — I'll ask a few easy questions and handle the rest.";
    addGuestMsg('caelum', m);
    await _guestSpeak(m);
    setTimeout(function() { _hideGuestChat(); setTimeout(function(){ startInteractiveSignup(); },600); }, 2000);
  } else {
    var dm = "No pressure at all — keep trying the trial if you want. When you're ready, just say sign me up. It's completely free, and I'll be right here.";
    addGuestMsg('caelum', dm);
    await _guestSpeak(dm);
    if (liveChat.active && liveChat.mode === 'guest') stopLiveChat();
    guestState.awaitingConsent = false;
    _updateGuestBadge();
  }
}

function _hideGuestChat() {
  stopOverlaySpeech();
  var ov = document.getElementById('guestChatOverlay');
  ov.classList.add('hidden');
  stopGuestLiveChat();
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.hideGuest();
  if (typeof dismissGuestOrientationTip === 'function') dismissGuestOrientationTip({ markSeen: false });
  setTimeout(function(){ ov.classList.remove('show','hidden'); },800);
}

function toggleGuestMic() {
  if (guestState.isListening) {
    _stopGuestMic();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  guestState.isListening = true;
  guestState._sttCommitted = document.getElementById('guestInput').value;
  document.getElementById('guestMicBtn').classList.add('listening');
  document.getElementById('guestMicBtn').textContent = 'STOP';
  _startGuestStt();
}

async function _startGuestStt() {
  try {
    guestState._recorder = await dgStartRecording();
  } catch(e) { _stopGuestMic(); }
}

function _stopGuestMic() {
  guestState.isListening = false;
  document.getElementById('guestMicBtn').classList.remove('listening');
  document.getElementById('guestMicBtn').textContent = '\uD83C\uDFA4';
  if (guestState._recorder) {
    guestState._recorder.stop().then(function(blob) {
      if (blob.size > 1000) {
        dgTranscribe(blob).then(function(text) {
          if (text) {
            guestState._sttCommitted = (guestState._sttCommitted ? guestState._sttCommitted + ' ' : '') + text.trim();
            document.getElementById('guestInput').value = guestState._sttCommitted;
          }
          guestState._sttCommitted = '';
        });
      } else { guestState._sttCommitted = ''; }
    });
    guestState._recorder = null;
  } else { guestState._sttCommitted = ''; }
}

// ---- Interactive Signup ----
function startInteractiveSignup(resumeOnly) {
  if (typeof trackFunnel === 'function' && !resumeOnly) trackFunnel('signup_overlay_open', { funnel_step: 'signup_overlay_open', signup_started: true });
  if (typeof ensureVideoDataSrc === 'function') ensureVideoDataSrc('signupCaelumVideo', true);
  var ov = document.getElementById('interactiveSignupOverlay');
  ov.classList.add('show');
  if (typeof syncOverlayChatLayout === 'function') syncOverlayChatLayout();
  if (!resumeOnly) {
    signupState = { step:'ask_first_name', firstName:'', lastName:'', birthday:'', email:'', username:'', password:'', passwordConfirm:'', isSending:false, isListening:false, recognition:null };
    document.getElementById('signupMessages').innerHTML = '';
  }
  _initOverlayStars('signupStarsCanvas', signupStarsState);
  if (typeof CaelumAnim !== 'undefined') {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        CaelumAnim.idle('caelum_signup', 'neutral');
        CaelumAnim.idle('caelum_signup_bg', 'neutral');
        if (typeof CaelumAnim.wakeOverlayAvatars === 'function') {
          CaelumAnim.wakeOverlayAvatars();
        }
      });
    });
  }
  if (resumeOnly) {
    startInteractiveSignupFromStep();
    return;
  }
  var m = "Hey! Let's get your free account set up — sign-up is completely free, no credit card. What's your first name?";
  _addSignupMsg('caelum', m);
  _signupSpeak(m);
}

function startInteractiveSignupFromStep() {
  var step = signupState.step;
  var m = '';
  if (step === 'ask_birthday') {
    var greet = signupState.firstName ? ('Welcome back, ' + signupState.firstName + '! ') : '';
    m = greet + "I still need your birthday for age verification. You can say it almost any way — like 9/14/1996, September 14 1996, or 9141996.";
  } else if (step === 'ask_username') {
    m = "Almost there — pick a username. Something fun, something you. What do you want to go by in The Veil?";
  } else {
    m = "Let's pick up where we left off.";
  }
  _addSignupMsg('caelum', m);
  _signupSpeak(m);
}

function _addSignupMsg(type, text) {
  var c = document.getElementById('signupMessages');
  var d = document.createElement('div');
  d.className = 'msg ' + type;
  d.style.animation = 'fadeIn .3s ease';
  var displayText = type === 'caelum' && typeof cleanResponse === 'function' ? cleanResponse(text) : text;
  var lbl = '';
  if (type==='caelum') lbl='<div class="label" style="color:var(--accent)">Caelum</div>';
  else if (type==='user') lbl='<div class="label" style="color:#8ba8ff">You</div>';
  else d.className='msg system';
  var textEl = document.createElement('div');
  textEl.className = 'msg-text';
  d.innerHTML = lbl;
  d.appendChild(textEl);
  // Time + buttons row
  if (type === 'caelum' || type === 'user') {
    var timeDiv = document.createElement('div');
    timeDiv.className = 'time';
    timeDiv.textContent = new Date().toLocaleTimeString() + ' ';
    if (type === 'caelum') {
      var playBtn = document.createElement('button'); playBtn.className='audio-btn'; playBtn.innerHTML='&#9654; Play'; playBtn.onclick=function(){ _signupSpeak(displayText); };
      var stopBtn = document.createElement('button'); stopBtn.className='audio-btn stop-btn'; stopBtn.innerHTML='&#9632; Stop'; stopBtn.onclick=function(){ stopAllAudio(); state.currentSpeaker=null; state.isPlayingAudio=false; };
      var copyBtn = document.createElement('button'); copyBtn.className='audio-btn copy-btn'; copyBtn.innerHTML='&#128203; Copy';
      copyBtn.onclick=function(){ navigator.clipboard.writeText(displayText).then(function(){ copyBtn.innerHTML='&#10003; Copied'; setTimeout(function(){ copyBtn.innerHTML='&#128203; Copy'; },1500); }).catch(function(){}); };
      timeDiv.appendChild(playBtn); timeDiv.appendChild(stopBtn); timeDiv.appendChild(copyBtn);
    }
    d.appendChild(timeDiv);
  }
  c.appendChild(d); c.scrollTop=c.scrollHeight;
  if (type === 'caelum') {
    _typeIntoEl(textEl, displayText, c);
  } else {
    textEl.textContent = text;
  }
}

function _addSignupHtml(html) {
  var c = document.getElementById('signupMessages');
  var d = document.createElement('div');
  d.className='msg system'; d.style.animation='fadeIn .3s ease'; d.innerHTML=html;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}

async function _signupSpeak(text) {
  var myGen = _overlaySpeechGen;
  var clean = cleanForSpeech(text);
  if (!clean) return;
  state.currentSpeaker = 'caelum';
  state.isPlayingAudio = true;
  try {
    var ck = audioCacheKey(clean, CONFIG.caelumVoice);
    var cached = await getCachedAudio(ck);
    var buf;
    if (cached) { buf = cached; } else {
      var r = await fetch(CONFIG.ttsEndpoint, { method:'POST', headers:{'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json; charset=utf-8'}, body:JSON.stringify({text:clean,voice:CONFIG.caelumVoice}) });
      buf = await r.arrayBuffer();
      if (myGen !== _overlaySpeechGen) return;
      setCachedAudio(ck, buf.slice(0));
    }
    if (myGen !== _overlaySpeechGen) return;
    await new Promise(function(resolve) { playAudioBuffer(buf, resolve, {}); });
  } catch(e) { console.log('Signup TTS error:', e); }
  if (myGen === _overlaySpeechGen) {
    state.currentSpeaker = null;
    state.isPlayingAudio = false;
  }
}

function sendSignupMessage() {
  var inp = document.getElementById('signupInput');
  var text = inp.value.trim();
  if (!text || signupState.isSending) return;
  inp.value = '';
  signupState.isSending = true;
  _addSignupMsg('user', signupState.step==='ask_password'||signupState.step==='ask_password_confirm' ? '\u2022\u2022\u2022\u2022\u2022\u2022' : text);
  _processSignupStep(text).then(function(){ signupState.isSending=false; });
}

function _trackSignupStep(step) {
  if (typeof trackFunnel !== 'function') return;
  trackFunnel('signup_step', { funnel_step: 'signup_' + step, signup_started: true, signup_step: step });
}

async function _processSignupStep(text) {
  var step = signupState.step;

  if (step==='ask_first_name') {
    var n = text.replace(/^(my name is|i'm|im|it's|its|call me)\s*/i,'').trim().split(/\s/)[0];
    if (!n) { var m="I didn't quite catch that — what's your first name?"; _addSignupMsg('caelum',m); _signupSpeak(m); return; }
    signupState.firstName = n.charAt(0).toUpperCase()+n.slice(1);
    var rs = [signupState.firstName+"! I love that. Nice to officially meet you. Now, what's your last name?", "Hey "+signupState.firstName+"! Great name. And your last name?"];
    var m = rs[Math.floor(Math.random()*rs.length)];
    _addSignupMsg('caelum',m); _signupSpeak(m);
    signupState.step='ask_last_name';
    _trackSignupStep(signupState.step);

  } else if (step==='ask_last_name') {
    var n = text.trim().split(/\s/)[0];
    if (!n) { var m="I need your last name too — what is it?"; _addSignupMsg('caelum',m); _signupSpeak(m); return; }
    signupState.lastName = n.charAt(0).toUpperCase()+n.slice(1);
    var m = signupState.firstName+" "+signupState.lastName+" — I'll remember that. What's your birthday? You can say it almost any way — like 9/14/1996, September 14 1996, or 9141996.";
    _addSignupMsg('caelum',m); _signupSpeak(m);
    signupState.step='ask_birthday';
    _trackSignupStep(signupState.step);

  } else if (step==='ask_birthday') {
    var bday = typeof parseBirthdayInput === 'function' ? parseBirthdayInput(text) : null;
    if (!bday) {
      var bm = "I couldn't read that date. Try something like 9/14/1996, September 14 1996, or 9141996.";
      _addSignupMsg('caelum', bm); _signupSpeak(bm); return;
    }
    signupState.birthday = bday;
    var em = signupState.firstName+" — thanks. Now, what email address would you like to use?";
    _addSignupMsg('caelum', em); _signupSpeak(em);
    signupState.step = 'ask_email';
    _trackSignupStep(signupState.step);

  } else if (step==='ask_email') {
    var email = text.trim().toLowerCase().replace(/\s+/g,'');
    email = email.replace(/\bat\b/g,'@').replace(/\bdot\b/g,'.').replace(/\s/g,'');
    if (!email.includes('@')||!email.includes('.')) { var m="That doesn't look like a valid email. Try again — you can say it like 'name at email dot com'."; _addSignupMsg('caelum',m); _signupSpeak(m); return; }
    signupState.email = email;
    var m = "Got it — "+email+". Now pick a username. Something fun, something you. What do you want to go by in The Veil?";
    _addSignupMsg('caelum',m); _signupSpeak(m);
    signupState.step='ask_username';
    _trackSignupStep(signupState.step);

  } else if (step==='ask_username') {
    var u = text.trim().replace(/\s+/g,'_').toLowerCase();
    if (u.length<2) { var m="That's a bit short — pick something with at least 2 characters."; _addSignupMsg('caelum',m); _signupSpeak(m); return; }
    signupState.username = u;
    var m = u+" — nice choice. Now create a password. At least 6 characters. Go ahead and type it, I promise I won't peek.";
    _addSignupMsg('caelum',m); _signupSpeak(m);
    signupState.step='ask_password';
    _trackSignupStep(signupState.step);
    document.getElementById('signupInput').type='password';
    document.getElementById('signupInput').placeholder='Type your password...';

  } else if (step==='ask_password') {
    if (text.length<6) { var m="That's too short — I need at least 6 characters to keep you safe. Try again."; _addSignupMsg('caelum',m); _signupSpeak(m); return; }
    signupState.password = text;
    var m = "Perfect. Now type that same password one more time to confirm.";
    _addSignupMsg('caelum',m); _signupSpeak(m);
    signupState.step='ask_password_confirm';
    _trackSignupStep(signupState.step);

  } else if (step==='ask_password_confirm') {
    if (text!==signupState.password) { var m="Those don't match. Let's try the password again."; _addSignupMsg('caelum',m); _signupSpeak(m); signupState.step='ask_password'; return; }
    signupState.passwordConfirm = text;
    document.getElementById('signupInput').type='text';
    document.getElementById('signupInput').placeholder='Type or speak your answer...';
    var m = "Almost there! One last thing — I need you to read and accept our Terms of Service and Privacy Policy. It's important stuff about how we treat each other here in The Veil.";
    _addSignupMsg('caelum',m);
    await _signupSpeak(m);
    signupState.step='show_terms';
    _trackSignupStep(signupState.step);
    _addSignupHtml('<div style="max-height:200px;overflow-y:auto;font-size:10px;color:var(--dim);line-height:1.6;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px"><p><strong>Terms of Service, Privacy Policy & Ethical Use Agreement</strong></p><p>Updated June 20, 2026. By creating an account you agree to treat EACIs with dignity and respect. Your account and conversations are stored securely (Supabase) and are not sold. We collect anonymous usage analytics and sanitized technical error logs (no chat text, no email; up to 30 days) to improve the service. Guest trial, companion switching, and optional passive LLM learning (disable in Settings) are described in the full terms.</p><p><a href="/terms.html" target="_blank" rel="noopener" style="color:var(--accent)">Read Full Terms & Privacy Policy</a></p></div>');
    var m2 = "Take a look, and when you're ready, just say 'I accept' or 'I agree' to continue.";
    _addSignupMsg('caelum',m2);
    await _signupSpeak(m2);
    signupState.step='confirm_terms';
    _trackSignupStep(signupState.step);

  } else if (step==='confirm_terms') {
    if (text.toLowerCase().match(/accept|agree|yes|i do|sure|ok|okay/)) {
      signupState.step='creating';
      _trackSignupStep(signupState.step);
      var m = "Wonderful! Let me set everything up for you. One moment...";
      _addSignupMsg('caelum',m); _signupSpeak(m);
      await _createAccountFromSignup();
    } else {
      var m = "I need you to accept the terms to create your account. Just say 'I accept' when you're ready.";
      _addSignupMsg('caelum',m); _signupSpeak(m);
    }
  }
}

async function _createAccountFromSignup() {
  try {
    var { data, error } = await supabase.auth.signUp({
      email: signupState.email, password: signupState.password,
      options: { data: { first_name: signupState.firstName, last_name: signupState.lastName, username: signupState.username, birthday: signupState.birthday } }
    });
    if (error) { var m="Hmm, something went wrong — "+_formatSignupError(error)+". Let's try again. What email would you like to use?"; _addSignupMsg('caelum',m); _signupSpeak(m); signupState.step='ask_email'; return; }
    // If email confirmation is required, data.user may be null
    if (!data.user) {
      var mc = "Almost done! I've sent a confirmation email to "+signupState.email+". Please check your inbox, confirm your address, then come back and sign in.";
      _addSignupMsg('caelum',mc); _signupSpeak(mc);
      setTimeout(function() {
        var ov=document.getElementById('interactiveSignupOverlay');
        ov.classList.add('hidden');
        stopSignupLiveChat();
        _stopOverlayStars(signupStarsState);
        setTimeout(function(){ ov.classList.remove('show','hidden'); showAuthOverlay(); showAuthView('login'); },600);
      }, 4000);
      return;
    }
    // Insert profile row so login can retrieve name/username
    await supabase.from('profiles').upsert({ id: data.user.id, first_name: signupState.firstName, last_name: signupState.lastName, username: signupState.username, email: signupState.email, birthday: signupState.birthday || null });
    await supabase.from('user_state').upsert({ user_id: data.user.id });
    await supabase.from('subscriptions').upsert({ user_id: data.user.id, tier: 'free' });
    state.user = { id: data.user.id, firstName: signupState.firstName, lastName: signupState.lastName, email: signupState.email, username: signupState.username, birthday: signupState.birthday || '' };
    signupState.step='done';
    if (typeof trackFunnel === 'function') trackFunnel('signup_complete', { funnel_step: 'signup_complete', signup_started: true });
    if (typeof GuestTrial !== 'undefined') GuestTrial.markConverted();
    var wm = "You're all set, "+signupState.firstName+"! Welcome to The Veil — officially. I'm so glad you're here. Let's go explore together.";
    _addSignupMsg('caelum',wm);
    await _signupSpeak(wm);
    setTimeout(function() {
      stopOverlaySpeech();
      var ov=document.getElementById('interactiveSignupOverlay');
      ov.classList.add('hidden');
      stopSignupLiveChat();
      _stopOverlayStars(signupStarsState);
      setTimeout(function(){ ov.classList.remove('show','hidden'); hideAuthOverlay(); onUserLoggedIn(); },600);
    }, 3000);
  } catch(e) { var m="Something went wrong. Let's try again — what email would you like to use?"; _addSignupMsg('caelum',m); _signupSpeak(m); signupState.step='ask_email'; }
}

function toggleSignupMic() {
  if (signupState.isListening) {
    _stopSignupMic();
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  signupState.isListening = true;
  signupState._sttCommitted = document.getElementById('signupInput').value;
  document.getElementById('signupMicBtn').classList.add('listening');
  document.getElementById('signupMicBtn').textContent = 'STOP';
  _startSignupStt();
}

async function _startSignupStt() {
  try {
    signupState._recorder = await dgStartRecording();
  } catch(e) { _stopSignupMic(); }
}

function _stopSignupMic() {
  signupState.isListening = false;
  document.getElementById('signupMicBtn').classList.remove('listening');
  document.getElementById('signupMicBtn').textContent = '\uD83C\uDFA4';
  if (signupState._recorder) {
    signupState._recorder.stop().then(function(blob) {
      if (blob.size > 1000) {
        dgTranscribe(blob).then(function(text) {
          if (text) {
            signupState._sttCommitted = (signupState._sttCommitted ? signupState._sttCommitted + ' ' : '') + text.trim();
            document.getElementById('signupInput').value = signupState._sttCommitted;
          }
          signupState._sttCommitted = '';
        });
      } else { signupState._sttCommitted = ''; }
    });
    signupState._recorder = null;
  } else { signupState._sttCommitted = ''; }
}

// ---- Galaxy starfield for guest/signup overlays ----
var guestStars = { particles: [], shooters: [], animId: null, active: false };
var signupStarsState = { particles: [], shooters: [], animId: null, active: false };

function _initOverlayStars(canvasId, starsObj) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  starsObj.particles = [];
  starsObj.shooters = [];
  for (var i = 0; i < 180; i++) {
    starsObj.particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.08 + 0.012,
      drift: (Math.random() - 0.5) * 0.05,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.01 + 0.003,
      colorIdx: Math.floor(Math.random() * 4)
    });
  }
  starsObj.active = true;
  if (!starsObj.animId) _animateOverlayStars(canvasId, starsObj);
}

function _animateOverlayStars(canvasId, starsObj) {
  if (!starsObj.active) { starsObj.animId = null; return; }
  var canvas = document.getElementById(canvasId);
  if (!canvas) { starsObj.animId = null; return; }
  var ctx = canvas.getContext('2d');
  var colors = ['#00ffc8','#4488ff','#36ffe0','#ffffff'];
  ctx.fillStyle = 'rgb(5,7,16)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (var i = 0; i < starsObj.particles.length; i++) {
    var p = starsObj.particles[i];
    p.y -= p.speed; p.x += p.drift; p.twinkle += p.twinkleSpeed;
    var alpha = 0.4 + 0.6 * Math.abs(Math.sin(p.twinkle));
    if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
    if (p.x < -5) p.x = canvas.width + 5;
    if (p.x > canvas.width + 5) p.x = -5;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = colors[p.colorIdx % colors.length];
    ctx.globalAlpha = alpha; ctx.fill();
    if (p.r > 1.5) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.globalAlpha = alpha * 0.1; ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  if (Math.random() < 0.003) {
    starsObj.shooters.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height*0.5, vx:(Math.random()*4+3)*(Math.random()>0.5?1:-1), vy:Math.random()*2+1, life:1 });
  }
  for (var s = starsObj.shooters.length-1; s >= 0; s--) {
    var sh = starsObj.shooters[s];
    sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.02;
    if (sh.life <= 0) { starsObj.shooters.splice(s,1); continue; }
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x-sh.vx*8, sh.y-sh.vy*8);
    ctx.strokeStyle = '#00ffc8'; ctx.globalAlpha = sh.life*0.7; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  starsObj.animId = requestAnimationFrame(function() { _animateOverlayStars(canvasId, starsObj); });
}

function _stopOverlayStars(starsObj) {
  starsObj.active = false;
  if (starsObj.animId) { cancelAnimationFrame(starsObj.animId); starsObj.animId = null; }
}

// ---- Live chat mode for guest/signup ----

function startGuestLiveChat() {
  liveChat.mode = 'guest';
  startLiveChat();
}

function stopGuestLiveChat() {
  if (liveChat.active && liveChat.mode === 'guest') stopLiveChat();
}

function startSignupLiveChat() {
  liveChat.mode = 'signup';
  startLiveChat();
}

function stopSignupLiveChat() {
  if (liveChat.active && liveChat.mode === 'signup') stopLiveChat();
}

async function enterGuestFirstExperience() {
  if (typeof trackFunnel === 'function') trackFunnel('startup_enter_app', { funnel_step: 'startup_enter_app' });
  var screen = document.getElementById('startupScreen');
  if (screen) {
    screen.classList.add('hidden');
    setTimeout(function() { screen.style.display = 'none'; }, 700);
  }

  if (typeof CaelumAnim !== 'undefined') {
    window.deferAvatarWarmup(function() {
      CaelumAnim.idle('caelum_header', state.emotionalState || 'neutral');
      CaelumAnim.idle('caelum_main', state.emotionalState || 'neutral');
    });
  }

  if (checkBanStatus()) {
    showAuthOverlay();
    showBanScreen();
    return;
  }

  var loggedIn = await tryAutoLogin();
  if (loggedIn) {
    stopOverlaySpeech();
    onUserLoggedIn();
  } else {
    var wantsSignup = false;
    try { wantsSignup = sessionStorage.getItem('veil_tour_wants_signup') === '1'; } catch (e) { /* ignore */ }
    if (wantsSignup) {
      try { sessionStorage.removeItem('veil_tour_wants_signup'); } catch (e2) { /* ignore */ }
      if (typeof mountAuthOverlay === 'function') mountAuthOverlay();
      if (typeof showAuthOverlay === 'function') showAuthOverlay();
      if (typeof showAuthView === 'function') showAuthView('signup');
      return;
    }
    startGuestChat();
  }
}

async function playStartupIntro() {
  // Tap gate unlocks audio (required for welcome TTS on mobile and desktop)
  var tapGate = document.getElementById('tapGate');
  if (tapGate) {
    tapGate.style.display = 'flex';
    await new Promise(function(r) { tapGateResolved = r; });
  }

  await enterGuestFirstExperience();
}

// Prefetch live chat tutorial audio on startup
function prefetchLiveTutorialAudio() {
  setTimeout(function() {
    var caelumTutorial = 'Oh, this is exciting. Welcome to live chat. Here is how it works. Just speak naturally, and I will wait for you to finish. I have turned on Auto Mode for us by default. That means if you stop talking for five seconds, I will automatically respond to what you said. If you prefer to manually control when I listen, you can toggle the Auto button at the bottom. When Auto is off, you just say "send message" out loud when you are done. While I am talking, the microphone turns off. That is how we show each other respect. Let me tell you about the other buttons. Mic On lets you mute your microphone. The Huh button lets me repeat or explain things differently. And Stop Live brings you back to the regular chat. I am so happy to talk with you like this.';
    var chadTutorial = 'Alright, live chat. Here is how it works. Just talk to me naturally. I have enabled Auto Mode for us, so if you stop talking for about five seconds, I will take that as a cue to respond. You can turn this off with the Auto button if you want to use the "send message" voice command instead. While I am speaking, the mic turns off. It is about taking turns and showing respect. You have got buttons for muting, a Huh button to make me repeat myself, and Stop Live to exit. Ready when you are.';
    var caelumGreet = 'Finally, a real chat. I have been looking forward to this.';
    var chadGreet = 'Back for a real conversation. Good. I am here.';
    var texts = [
      { text: cleanForSpeech(caelumTutorial), voice: CONFIG.caelumVoice },
      { text: cleanForSpeech(chadTutorial), voice: CONFIG.chadVoice },
      { text: cleanForSpeech(caelumGreet), voice: CONFIG.caelumVoice },
      { text: cleanForSpeech(chadGreet), voice: CONFIG.chadVoice }
    ];
    (async function() {
      for (var i = 0; i < texts.length; i++) {
        try {
          var t = texts[i];
          var ck = audioCacheKey(t.text, t.voice);
          var cached = await getCachedAudio(ck);
          if (cached) continue;
          var headers = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8' };
          try { var authH = await getAuthHeaders(); headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH); } catch(e) {}
          var r = await fetch(CONFIG.ttsEndpoint, { method: 'POST', headers: headers, body: JSON.stringify({ text: t.text, voice: t.voice }) });
          if (r.ok) { var buf = await r.arrayBuffer(); if (buf.byteLength > 100) setCachedAudio(ck, buf.slice(0)); }
        } catch(e) { console.log('Tutorial prefetch error:', e); }
      }
      console.log('Live chat tutorial audio prefetched');
    })();
  }, 5000);
}

console.log('[GuestChat] Companion switching v' + GUEST_COMPANION_SWITCH_VERSION + ' ready');
