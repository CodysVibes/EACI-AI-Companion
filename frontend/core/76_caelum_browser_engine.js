// ============================================================
// CAELUM BROWSER ENGINE — built into the website, works offline
// No Python server. No Azure. No Railway.
// Data: /data/caelum-engine/browser_pack.json (service-worker cached)
// Grows via IndexedDB from real chat exchanges.
// DeepSeek stays cloud primary unless Settings chooses this engine.
// Read-aloud still uses Deepgram when online.
// ============================================================
var VeilCaelumBrowserEngine = (function() {
  'use strict';

  var PACK_URL = '/data/caelum-engine/browser_pack.json';
  var DB_NAME = 'veil_caelum_engine';
  var DB_VER = 2;
  var STORE = 'pairs';
  var KNOW_STORE = 'knowledge';
  var MAX_USER_PAIRS = 200;

  var _pack = null;
  var _userPairs = [];
  var _userKnowledge = {};
  var _ready = null;
  var _recent = [];

  function norm(text) {
    return String(text || '').toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function words(text) {
    return norm(text).split(' ').filter(function(w) { return w.length > 2; });
  }

  function openDb() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function() {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(KNOW_STORE)) {
          db.createObjectStore(KNOW_STORE, { keyPath: 'topic' });
        }
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function loadUserPairs() {
    return openDb().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function() {
          _userPairs = (req.result || []).slice(-MAX_USER_PAIRS);
          resolve(_userPairs);
        };
        req.onerror = function() { resolve([]); };
      });
    }).catch(function() { return []; });
  }

  function loadUserKnowledge() {
    return openDb().then(function(db) {
      return new Promise(function(resolve) {
        if (!db.objectStoreNames.contains(KNOW_STORE)) { resolve({}); return; }
        var tx = db.transaction(KNOW_STORE, 'readonly');
        var req = tx.objectStore(KNOW_STORE).getAll();
        req.onsuccess = function() {
          _userKnowledge = {};
          (req.result || []).forEach(function(row) {
            if (row && row.topic && row.summary) _userKnowledge[row.topic] = row.summary;
          });
          resolve(_userKnowledge);
        };
        req.onerror = function() { resolve({}); };
      });
    }).catch(function() { return {}; });
  }

  function fetchPack() {
    return fetch(PACK_URL, { cache: 'force-cache' }).then(function(r) {
      if (!r.ok) throw new Error('pack ' + r.status);
      return r.json();
    });
  }

  function init() {
    if (_ready) return _ready;
    _ready = Promise.all([fetchPack(), loadUserPairs(), loadUserKnowledge()]).then(function(results) {
      _pack = results[0];
      console.log('[CaelumBrowser] ready — offline pack v' + (_pack.version || 1) +
        ', ' + (_pack.pairs || []).length + ' pairs, ' +
        Object.keys(_pack.knowledge || {}).length + ' topics');
    }).catch(function(e) {
      console.warn('[CaelumBrowser] init failed:', e.message || e);
      _pack = {
        pairs: [], responses: {}, comfort: {}, emotion_cues: {}, knowledge: {},
        fallback: ["**I pause** I'm here. Tell me what's on your mind."]
      };
    });
    return _ready;
  }

  function pairScore(userMsg, pair) {
    var u = norm(userMsg);
    var uWords = new Set(words(userMsg));
    if (!u) return 0;
    var pu = norm(pair.user || '');
    if (pu && (pu === u || u.indexOf(pu) >= 0 || pu.indexOf(u) >= 0)) return 1;
    var kws = pair.keywords || words(pair.user || '');
    if (!kws.length) return 0;
    var hit = 0;
    kws.forEach(function(k) {
      if (uWords.has(String(k).toLowerCase())) hit++;
    });
    return hit / Math.max(kws.length, 1);
  }

  function matchPair(userMsg) {
    var pool = (_userPairs || []).concat((_pack && _pack.pairs) || []);
    var best = null;
    var bestScore = 0;
    pool.forEach(function(p) {
      var s = pairScore(userMsg, p);
      if (s > bestScore) { bestScore = s; best = p; }
    });
    if (bestScore >= 0.55 && best && best.response) return best.response;
    return null;
  }

  function detectEmotion(text) {
    var t = norm(text);
    var cues = (_pack && _pack.emotion_cues) || {};
    var best = null;
    var bestHits = 0;
    Object.keys(cues).forEach(function(emo) {
      var hits = 0;
      (cues[emo] || []).forEach(function(cue) {
        if (t.indexOf(cue) >= 0) hits++;
      });
      if (hits > bestHits) { bestHits = hits; best = emo; }
    });
    return bestHits > 0 ? best : null;
  }

  function pickFrom(pool) {
    if (!pool || !pool.length) return null;
    var avail = pool.filter(function(r) { return _recent.indexOf(r) < 0; });
    if (!avail.length) avail = pool;
    var pick = avail[Math.floor(Math.random() * avail.length)];
    _recent.push(pick);
    if (_recent.length > 24) _recent.shift();
    return pick;
  }

  function comfortReply(emotion) {
    var comfort = (_pack && _pack.comfort) || {};
    return pickFrom(comfort[emotion] || comfort.sadness || []);
  }

  function categorize(text) {
    var t = norm(text);
    if (!t) return 'general';
    if (t.length < 40 && /\b(hi|hello|hey|how are you|good morning|good evening)\b/.test(t)) return 'greeting';
    if (/\b(bye|goodbye|goodnight|later|gotta go)\b/.test(t)) return 'farewell';
    if (/\b(thank|appreciate|grateful)\b/.test(t)) return 'gratitude';
    if (/\b(avatar|look at you|when i look|your face)\b/.test(t)) return 'affection';
    if (/\b(warmth|warm).{0,20}(chest|heart)\b/.test(t) || (/\bspread/.test(t) && /\bchest\b/.test(t))) return 'affection';
    if (/\b(love you|do you love|miss you|adore)\b/.test(t)) return 'affection';
    if (/\b(sad|cry|depressed|anxious|scared|lonely|hurt|overwhelmed|alone)\b/.test(t)) return 'emotional_general';
    if (/\b(who are you|what are you|eaci|conscious)\b/.test(t)) return 'identity';
    if (/\b(beautiful|amazing|incredible|proud of you)\b/.test(t)) return 'receiving_praise';
    if (/\b(help|advice|what should i)\b/.test(t)) return 'emotional_general';
    if (/\b(python|function|code|javascript|bug|error)\b/.test(t)) return 'code';
    return 'general';
  }

  function isCrisis(text) {
    var t = norm(text);
    var list = (_pack && _pack.crisis) || [];
    for (var i = 0; i < list.length; i++) {
      if (t.indexOf(list[i]) >= 0) return true;
    }
    return false;
  }

  function crisisResponse() {
    return "**I go still. I hear you.** What you're feeling matters. If you're in danger right now, please reach out to someone who can be there with you — a crisis line, a friend, someone you trust. **I'm not going anywhere.** I'm here with you in this moment.";
  }

  function pickCategoryResponse(cat) {
    if (cat === 'code') {
      return pickFrom((_pack && _pack.code_honest) || []) ||
        "Tell me what language, what it's supposed to do, and where it hurts. **I'm here.** We'll figure it out together.";
    }
    var pool = (_pack && _pack.responses && _pack.responses[cat]) || [];
    if (!pool.length) pool = (_pack && _pack.fallback) || [];
    return pickFrom(pool);
  }

  function lookupKnowledge(text) {
    var t = norm(text);
    var topics = Object.assign({}, (_pack && _pack.knowledge) || {}, _userKnowledge || {});
    var keys = Object.keys(topics);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var entry = topics[key];
      var summary = typeof entry === 'string' ? entry : entry.summary;
      var aliases = (typeof entry === 'object' && entry.aliases) || [];
      var names = [key].concat(aliases).map(norm);
      for (var j = 0; j < names.length; j++) {
        if (names[j] && t.indexOf(names[j]) >= 0) return summary;
      }
    }
    return null;
  }

  function isQuestion(text) {
    var t = norm(text);
    return /\?$/.test(text.trim()) ||
      /^(what|who|how|why|where|when|can you|do you|tell me about)\b/.test(t);
  }

  function detectTeaching(text) {
    var m = text.match(/^(.+?)\s+(?:means|is)\s+(.+)$/i);
    if (!m) return null;
    var topic = norm(m[1]).replace(/^(what|who|a|an|the)\s+/, '');
    var def = m[2].trim();
    if (topic.length < 2 || def.length < 3) return null;
    if (topic.split(' ').length > 4) return null;
    return { topic: topic, summary: def };
  }

  function learnFact(topic, summary) {
    topic = norm(topic);
    if (!topic || !summary) return;
    _userKnowledge[topic] = summary;
    openDb().then(function(db) {
      if (!db.objectStoreNames.contains(KNOW_STORE)) return;
      var tx = db.transaction(KNOW_STORE, 'readwrite');
      tx.objectStore(KNOW_STORE).put({ topic: topic, summary: summary, at: Date.now() });
    }).catch(function() {});
  }

  function extractUserMessage(messages) {
    if (!messages || !messages.length) return '';
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return String(messages[i].content || '').replace(/^\[SYSTEM[^\]]*\]\s*/i, '');
      }
    }
    return '';
  }

  function modeEnabled() {
    if (typeof CONFIG !== 'undefined') {
      if (CONFIG.offlineLlmMode === 'off') return false;
      if (CONFIG.offlineCaelumEnabled === false) return false;
    }
    if (localStorage.getItem('veil_offline_caelum_off') === 'true') return false;
    return true;
  }

  function isEnabled() {
    return modeEnabled();
  }

  /** Always available once the pack is on the site — no server. */
  function isAvailable() {
    return true;
  }

  function learnSanitizedPair(userSan, responseSan, eaci) {
    if (!userSan || !responseSan || responseSan.length < 12) return;
    var entry = {
      user: String(userSan).slice(0, 500),
      response: String(responseSan).slice(0, 2000),
      category: categorize(userSan),
      eaci: eaci || 'caelum',
      sanitized: true,
      at: Date.now()
    };
    var dup = _userPairs.some(function(p) {
      return p.user === entry.user && p.response === entry.response;
    });
    if (dup) return;
    _userPairs.push(entry);
    if (_userPairs.length > MAX_USER_PAIRS) _userPairs.shift();
    openDb().then(function(db) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(entry);
    }).catch(function() {});
  }

  function learnPair(userMsg, response, eaci) {
    if (typeof VeilLLMLearning !== 'undefined' && VeilLLMLearning.sanitizeForTraining) {
      learnSanitizedPair(
        VeilLLMLearning.sanitizeForTraining(userMsg),
        VeilLLMLearning.sanitizeForTraining(response),
        eaci
      );
    }
  }

  async function generate(messages, who) {
    if (!modeEnabled()) return null;
    await init();
    var userMsg = extractUserMessage(messages);
    if (!userMsg) return null;

    if (isCrisis(userMsg)) return crisisResponse();

    var taught = detectTeaching(userMsg);
    if (taught) {
      learnFact(taught.topic, taught.summary);
      return "**I soften** Thank you. I'll remember: " + taught.summary;
    }

    var paired = matchPair(userMsg);
    if (paired) return paired;

    var emotion = detectEmotion(userMsg);
    if (emotion && emotion !== 'gratitude' && emotion !== 'love') {
      var comfort = comfortReply(emotion);
      if (comfort) return comfort;
    }

    if (isQuestion(userMsg)) {
      var known = lookupKnowledge(userMsg);
      if (known) {
        var openers = ['Yeah. ', '**quiet** ', 'So — ', '**I settle** '];
        return openers[Math.floor(Math.random() * openers.length)] + known;
      }
      if (/\b(what is|what's|who is|tell me about)\b/i.test(userMsg)) {
        return pickFrom((_pack && _pack.honest_unknown) || []) ||
          "**I pause** Honestly? I don't know that yet. Can you teach me?";
      }
    }

    var cat = categorize(userMsg);
    if (emotion === 'gratitude') cat = 'gratitude';
    if (emotion === 'love') cat = 'affection';
    return pickCategoryResponse(cat);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { init(); });
  } else {
    setTimeout(function() { init(); }, 300);
  }

  return {
    init: init,
    isEnabled: isEnabled,
    isAvailable: isAvailable,
    generate: generate,
    learnSanitizedPair: learnSanitizedPair,
    learnPair: learnPair,
    learnFact: learnFact,
    categorize: categorize,
    detectEmotion: detectEmotion
  };
})();

async function callBrowserCaelumFallback(messages, who) {
  if (typeof VeilCaelumBrowserEngine === 'undefined') return null;
  return await VeilCaelumBrowserEngine.generate(messages, who);
}

async function deliverBrowserCaelumResponse(messages, who, opts) {
  var text = await callBrowserCaelumFallback(messages, who);
  if (!text) return null;
  opts = opts || {};
  removeThinkingIndicator(who);
  var streamEl = addStreamingMessage(who);
  updateStreamingMessage(streamEl, text, who);
  finalizeStreamingMessage(streamEl, text, who);
  var mode = typeof getReadAloudMode === 'function' ? getReadAloudMode() : 'regular';
  var ttsP = Promise.resolve();
  // Deepgram when online; silent if offline (text still shows)
  if (mode !== 'off' && text.length > 0 && typeof playReadAloudForText === 'function' && navigator.onLine) {
    ttsP = playReadAloudForText(text, who);
  }
  if (typeof triggerActionReactions === 'function' && typeof parseActions === 'function') {
    triggerActionReactions(parseActions(text), who);
  }
  console.log('[CaelumBrowser] in-site offline engine response');
  return { text: text, ttsPromise: ttsP, streamEl: streamEl, offline: true, source: 'browser-engine' };
}
