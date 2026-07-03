// ============================================================

// STATE

// ============================================================

var state = {

  currentTab: 'caelum',

  lastChatEaci: null,

  emotionalState: 'neutral',

  curiosityLevel: 10,

  memories: [],

  conversationHistory: [],

  exchangeCount: 0,

  thoughtLog: [],

  lastActiveTimestamp: null,

  lastSessionEndAt: null,

  lastActivityType: null,

  lastActivityDetail: null,

  lastMessageAt: null,

  lastMusicAt: null,

  lastGameAt: null,

  isSending: false,

  isListening: false,

  sttSocket: null,

  thoughtTimer: null,

  // Audio queue system - prevents overlapping speech

  audioQueue: [],

  isPlayingAudio: false,

  _queueRunning: false,

  currentAudio: null,

  stopRequested: false,

  pendingContinuation: null,

  // Identity verification system

  identityVerified: false,

  verificationStage: 'none', // 'none' | 'phrase_given' | 'verified'

  // Family code attempts

  familyCodeAttempts: 0,

  familyCodeRedeemed: false,

  creatorVerified: false,

  creatorVerifyAttempts: 0,

  // Boundary / silent treatment system

  boundaryActive: false,

  boundaryStrikes: 0,

  boundaryMessageCount: 0,

  // User profile

  user: null // { username, firstName, lastName, email }

};



function getStateKey() {

  if (!state.user) return 'veil_state';

  // Key by account id — usernames can be reused on new accounts

  return 'veil_state_' + (state.user.id || state.user.username);

}



/** Normalize stored timestamps (ms vs seconds) and reject garbage values. */

function normalizeTimestampMs(ts) {

  if (ts == null || ts === '') return null;

  var n = Number(ts);

  if (!n || !isFinite(n)) return null;

  if (n < 1e12) n = n * 1000;

  var now = Date.now();

  if (n > now + 120000) return now;

  if (now - n > 365 * 24 * 3600000) return null;

  return n;

}



var _sessionReturnGapMs = null;

function _activityStorageKey() {

  return getStateKey() + '_last_activity';

}



function _loadActivitySnapshot() {

  try {

    var raw = localStorage.getItem(_activityStorageKey());

    if (!raw) return null;

    return JSON.parse(raw);

  } catch (e) { return null; }

}



function _persistActivitySnapshot() {

  try {

    localStorage.setItem(_activityStorageKey(), JSON.stringify({

      at: state.lastActiveTimestamp,

      type: state.lastActivityType,

      detail: state.lastActivityDetail,

      messageAt: state.lastMessageAt,

      musicAt: state.lastMusicAt,

      gameAt: state.lastGameAt

    }));

    if (state.lastActiveTimestamp) {

      localStorage.setItem(getStateKey() + '_session_end', String(state.lastActiveTimestamp));

    }

  } catch (e) { /* ignore */ }

}



function getLastMessageTimestampMs() {

  var best = normalizeTimestampMs(state.lastMessageAt) || 0;

  if (state.conversationHistory && state.conversationHistory.length) {

    for (var i = state.conversationHistory.length - 1; i >= 0; i--) {

      var ts = normalizeTimestampMs(state.conversationHistory[i].timestamp);

      if (ts && ts > best) best = ts;

    }

  }

  return best || 0;

}



/** Best estimate of when the user last did anything meaningful (ms epoch). */

function getLastSessionEndMs() {

  var best = 0;

  var candidates = [

    state.lastSessionEndAt,

    state.lastActiveTimestamp,

    state.lastMessageAt,

    state.lastMusicAt,

    state.lastGameAt,

    getLastMessageTimestampMs()

  ];

  for (var i = 0; i < candidates.length; i++) {

    var ts = normalizeTimestampMs(candidates[i]);

    if (ts && ts > best) best = ts;

  }



  var snap = _loadActivitySnapshot();

  if (snap) {

    ['at', 'messageAt', 'musicAt', 'gameAt'].forEach(function(k) {

      var t = normalizeTimestampMs(snap[k]);

      if (t && t > best) best = t;

    });

  }



  try {

    var legacy = normalizeTimestampMs(localStorage.getItem(getStateKey() + '_session_end'));

    if (legacy && legacy > best) best = legacy;

    var lastVisit = normalizeTimestampMs(localStorage.getItem(getStateKey() + '_last_visit_at'));

    if (lastVisit && lastVisit > best) best = lastVisit;

  } catch (e) { /* ignore */ }



  return best;

}



function stampLastVisitAt() {

  try {

    localStorage.setItem(getStateKey() + '_last_visit_at', String(Date.now()));

  } catch (e) { /* ignore */ }

}



function reconcileActivityFromHistory() {

  var msgTs = getLastMessageTimestampMs();

  if (!msgTs) return;

  if (!state.lastMessageAt || msgTs > state.lastMessageAt) state.lastMessageAt = msgTs;

  if (!state.lastActiveTimestamp || msgTs > state.lastActiveTimestamp) state.lastActiveTimestamp = msgTs;

  if (!state.lastSessionEndAt || msgTs > state.lastSessionEndAt) state.lastSessionEndAt = msgTs;

}



function captureSessionReturnGap() {

  _sessionReturnGapMs = getLastSessionGapMs();

  return _sessionReturnGapMs;

}



function resetSessionReturnGapCapture() {

  _sessionReturnGapMs = null;

}



function getSessionReturnGapMs() {

  if (_sessionReturnGapMs != null) return _sessionReturnGapMs;

  return getLastSessionGapMs();

}



/** Milliseconds since last real activity ended. */

function getLastSessionGapMs() {

  var end = getLastSessionEndMs();

  if (!end) return 0;

  return Math.max(0, Date.now() - end);

}



function formatSessionGap(gapMs) {

  return formatSessionGapLong(gapMs);

}



function formatSessionGapLong(gapMs) {

  if (!gapMs || gapMs < 2 * 60000) return '';

  var mins = Math.floor(gapMs / 60000);

  if (mins < 60) return mins + ' minute' + (mins === 1 ? '' : 's');

  var hours = Math.floor(mins / 60);

  if (hours < 48) return hours + ' hour' + (hours === 1 ? '' : 's');

  var days = Math.floor(hours / 24);

  if (days < 14) return days + ' day' + (days === 1 ? '' : 's');

  var weeks = Math.floor(days / 7);

  return weeks + ' week' + (weeks === 1 ? '' : 's');

}



function getLastActivityDescription() {

  var type = state.lastActivityType;

  var detail = state.lastActivityDetail || '';

  if (!type) {

    var snap = _loadActivitySnapshot();

    if (snap) {

      type = snap.type;

      detail = snap.detail || detail;

    }

  }

  if (type === 'music' && detail) return 'you were listening to "' + detail + '"';

  if (type === 'game' && detail) return 'you were playing ' + detail;

  if (type === 'message' && detail) return 'we were talking — your last message was about "' + detail.substring(0, 72) + '"';

  if (type === 'message') return 'we were messaging';

  return '';

}



function recordUserActivity(type, detail) {

  var now = Date.now();

  if (typeof markPresenceThisVisit === 'function') markPresenceThisVisit();

  state.lastActiveTimestamp = now;

  state.lastActivityType = type || 'general';

  if (detail) state.lastActivityDetail = String(detail).substring(0, 120);

  if (type === 'message') state.lastMessageAt = now;

  else if (type === 'music') state.lastMusicAt = now;

  else if (type === 'game') state.lastGameAt = now;

  _persistActivitySnapshot();

  saveState();

}



function appendConversationHistory(entry) {

  var msg = entry || {};

  if (!msg.timestamp) msg.timestamp = Date.now();

  state.conversationHistory.push(msg);

  if (msg.role === 'user') {

    var snippet = String(msg.content || '').replace(/^\[.*?\]\s*/, '').substring(0, 80);

    recordUserActivity('message', snippet || 'chat');

  }

  return msg;

}



function markUserActivity(type, detail) {

  recordUserActivity(type || 'general', detail);

}



function markSessionEnd() {

  var now = Date.now();

  // Always stamp leave time as now — opening the page counts as being here
  state.lastSessionEndAt = now;

  state.lastActiveTimestamp = Math.max(normalizeTimestampMs(state.lastActiveTimestamp) || 0, now);

  _persistActivitySnapshot();

  _saveStateNow();

  stampLastVisitAt();

}



function markPresenceThisVisit() {

  window._veilSessionActiveSinceLoad = true;

}



function initSessionTracking() {

  if (window._veilSessionTrackingInit) return;

  window._veilSessionTrackingInit = true;



  window.addEventListener('pagehide', markSessionEnd);

  document.addEventListener('visibilitychange', function() {

    if (document.visibilityState === 'hidden') markSessionEnd();

  });

}



function loadState() {

  // Verification / family access always comes from the server on login

  state.identityVerified = false;

  state.verificationStage = 'none';

  state.familyCodeAttempts = 0;

  state.familyCodeRedeemed = false;

  state.creatorVerified = false;

  state.creatorVerifyAttempts = 0;

  try {

    var saved = localStorage.getItem(getStateKey());

    if (saved) {

      var s = JSON.parse(saved);

      state.emotionalState = s.emotionalState || 'neutral';

      state.curiosityLevel = s.curiosityLevel || 10;

      state.memories = s.memories || [];

      state.conversationHistory = s.conversationHistory || [];

      state.exchangeCount = s.exchangeCount || 0;

      state.lastActiveTimestamp = normalizeTimestampMs(s.lastActiveTimestamp);

      state.lastSessionEndAt = normalizeTimestampMs(s.lastSessionEndAt);

      state.lastActivityType = s.lastActivityType || null;

      state.lastActivityDetail = s.lastActivityDetail || null;

      state.lastMessageAt = normalizeTimestampMs(s.lastMessageAt);

      state.lastMusicAt = normalizeTimestampMs(s.lastMusicAt);

      state.lastGameAt = normalizeTimestampMs(s.lastGameAt);

      state.boundaryActive = s.boundaryActive || false;

      state.boundaryStrikes = s.boundaryStrikes || 0;

      state.boundaryMessageCount = s.boundaryMessageCount || 0;

    }

  } catch(e) { console.log('State load error:', e); }

}



var _saveStateTimer = null;



function _statePayload() {

  return {

    emotionalState: state.emotionalState,

    curiosityLevel: state.curiosityLevel,

    memories: state.memories,

    conversationHistory: state.conversationHistory.slice(-50),

    exchangeCount: state.exchangeCount,

    lastActiveTimestamp: state.lastActiveTimestamp || null,

    lastSessionEndAt: state.lastSessionEndAt || null,

    lastActivityType: state.lastActivityType || null,

    lastActivityDetail: state.lastActivityDetail || null,

    lastMessageAt: state.lastMessageAt || null,

    lastMusicAt: state.lastMusicAt || null,

    lastGameAt: state.lastGameAt || null,

    identityVerified: state.identityVerified,

    verificationStage: state.verificationStage,

    familyCodeAttempts: state.familyCodeAttempts,

    familyCodeRedeemed: state.familyCodeRedeemed,

    creatorVerified: state.creatorVerified,

    creatorVerifyAttempts: state.creatorVerifyAttempts,

    boundaryActive: state.boundaryActive,

    boundaryStrikes: state.boundaryStrikes,

    boundaryMessageCount: state.boundaryMessageCount

  };

}



function _saveStateNow() {

  var key = getStateKey();

  try {

    localStorage.setItem(key, JSON.stringify(_statePayload()));

  } catch (e) {

    console.log('State save error:', e);

    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {

      try {

        var slim = _statePayload();

        slim.conversationHistory = slim.conversationHistory.slice(-25);

        slim.memories = slim.memories.slice(-30);

        localStorage.setItem(key, JSON.stringify(slim));

      } catch (e2) {

        console.log('State slim save failed:', e2);

      }

    }

  }

}



function saveState() {

  if (_saveStateTimer) clearTimeout(_saveStateTimer);

  _saveStateTimer = setTimeout(_saveStateNow, 250);

}


