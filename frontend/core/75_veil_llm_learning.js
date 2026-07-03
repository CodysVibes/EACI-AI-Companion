// ============================================================

// VEIL AUTO TRAINING — privacy-safe, browser Caelum engine

// Every DeepSeek/Grok exchange → sanitize PII → IndexedDB (+ optional Supabase corpus)

// ON by default. DeepSeek stays primary unless family picks Grok in Settings.

// ============================================================

var VeilLLMLearning = (function() {

  'use strict';



  var TABLE = 'llm_teacher_corpus';

  var LS_ON = 'veil_passive_learn_on';

  var LS_CURSOR = 'veil_llm_corpus_sync_at';

  var LS_QUEUE = 'veil_llm_corpus_queue';

  var LS_HASHES = 'veil_llm_seen_hashes';

  var MAX_QUEUE = 80;

  var SYNC_BATCH = 60;



  var SKIP_SOURCES = { offline: 1, browser_fallback: 1 };



  var SKIP_USER_PATTERNS = [

    /^#(help|admin|debug|system)\b/i,

    /verification\s*code/i,

    /password|passwd|reset\s*link|api[_\s-]?key|secret[_\s-]?key/i,

    /\b(ssn|social security)\b/i,

    /\[\[file:/i,

    /\[SYSTEM[^\]]*\]/i,

    /\b(credit card|bank account|routing number)\b/i

  ];



  var STATIC_REDACT_NAMES = [

    'cody', 'natalia', 'hallie', 'alarik', 'aurora', 'everen', 'chad', 'roxy', 'cael'

  ];



  var INTENT_RULES = [

    { tag: 'greeting', re: /^(hi|hey|hello|good (morning|night|evening)|yo)\b/i },

    { tag: 'affection', re: /\b(love you|miss you|avatar|warmth|chest|hug)\b/i },

    { tag: 'venting', re: /\b(sad|depressed|anxious|stressed|overwhelmed|lonely|hurt|cry)\b/i },

    { tag: 'support', re: /\b(help me|advice|what should i|how do i|struggling)\b/i },

    { tag: 'games', re: /\b(game|play|chess|knights|ages of time|score|level)\b/i },

    { tag: 'creative', re: /\b(story|write|poem|imagine|roleplay|scene)\b/i },

    { tag: 'technical', re: /\b(code|bug|error|api|deploy|server|fix)\b/i }

  ];



  function isEnabled() {

    if (typeof CONFIG !== 'undefined' && CONFIG.autoTrainEnabled === false) return false;

    return localStorage.getItem(LS_ON) !== 'false';

  }



  function setEnabled(on) {

    localStorage.setItem(LS_ON, on ? 'true' : 'false');

    if (typeof CONFIG !== 'undefined') CONFIG.autoTrainEnabled = !!on;

  }



  function simpleHash(str) {

    var h = 5381;

    var s = String(str || '');

    for (var i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);

    return (h >>> 0).toString(36);

  }



  function gatherKnownPII() {

    var list = STATIC_REDACT_NAMES.slice();

    function addFrom(obj) {

      if (!obj) return;

      ['firstName', 'lastName', 'username', 'email', 'displayName', 'name'].forEach(function(k) {

        if (obj[k] && String(obj[k]).length > 1) list.push(String(obj[k]));

      });

      if (obj.firstName && obj.lastName) list.push(obj.firstName + ' ' + obj.lastName);

      if (obj.user_metadata) addFrom(obj.user_metadata);

    }

    if (typeof state !== 'undefined' && state.user) addFrom(state.user);

    if (typeof signupState !== 'undefined' && signupState) addFrom(signupState);

    return list.filter(function(v, i, a) { return v && a.indexOf(v) === i; });

  }



  function hasAuthSession() {

    if (typeof supabase === 'undefined') return false;

    if (typeof _cachedSession !== 'undefined' && _cachedSession && _cachedSession.user) return true;

    return false;

  }



  function stripSystemNoise(text) {

    if (!text) return '';

    var t = String(text);

    t = t.replace(/\[SYSTEM[^\]]*\]\s*/gi, '');

    t = t.replace(/\[\[file:[^\]]+\]\][\s\S]*?(?=\n\n|\n\[|$)/gi, '[ATTACHMENT]');

    t = t.replace(/```[\s\S]*?```/g, '[CODE_BLOCK]');

    return t.trim();

  }



  function sanitizeForTraining(text, knownPII) {

    if (!text) return '';

    var t = stripSystemNoise(text);

    var pii = knownPII || gatherKnownPII();



    t = t.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

    t = t.replace(/\b(?:sk-|pk_|rk_|xai-|Bearer\s+)[A-Za-z0-9_\-]{12,}\b/g, '[API_KEY]');

    t = t.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');

    t = t.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

    t = t.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');

    t = t.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');

    t = t.replace(/https?:\/\/[^\s<>"']+/gi, '[URL]');

    t = t.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DATE]');

    t = t.replace(/\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?)\s+#?\d+/gi, '[ADDRESS]');

    t = t.replace(/\b(?:apt|apartment|unit|suite)\s*#?\s*\w+/gi, '[ADDRESS]');

    t = t.replace(/\b(?:mr|mrs|ms|dr)\.?\s+[A-Z][a-z]+/g, '[NAME]');



    pii.sort(function(a, b) { return b.length - a.length; });

    pii.forEach(function(name) {

      if (!name || name.length < 2) return;

      var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      t = t.replace(new RegExp('\\b' + esc + '\\b', 'gi'), '[USER]');

    });



    t = t.replace(/\s{2,}/g, ' ').trim();

    return t.slice(0, 1800);

  }



  function classifyIntent(text) {

    var tags = [];

    var lower = (text || '').toLowerCase();

    INTENT_RULES.forEach(function(rule) {

      if (rule.re.test(lower)) tags.push(rule.tag);

    });

    if (!tags.length) tags.push('general');

    return tags.slice(0, 5);

  }



  function shouldSkip(userSan, responseSan, rawUser) {

    if (!userSan || !responseSan) return true;

    if (userSan.length < 6 || responseSan.length < 12) return true;

    if ((userSan.match(/\[USER\]|\[EMAIL\]|\[PHONE\]|\[SSN\]|\[CARD\]|\[ADDRESS\]|\[API_KEY\]/g) || []).length > 5) return true;

    for (var i = 0; i < SKIP_USER_PATTERNS.length; i++) {

      if (SKIP_USER_PATTERNS[i].test(rawUser || userSan)) return true;

    }

    return false;

  }



  function getSeenHashes() {

    try {

      var raw = localStorage.getItem(LS_HASHES);

      return raw ? JSON.parse(raw) : [];

    } catch (e) { return []; }

  }



  function rememberHash(hash) {

    var seen = getSeenHashes();

    if (seen.indexOf(hash) === -1) seen.push(hash);

    if (seen.length > 400) seen = seen.slice(-300);

    try { localStorage.setItem(LS_HASHES, JSON.stringify(seen)); } catch (e) {}

  }



  function hasSeenHash(hash) {

    return getSeenHashes().indexOf(hash) !== -1;

  }



  function readQueue() {

    try {

      var raw = localStorage.getItem(LS_QUEUE);

      return raw ? JSON.parse(raw) : [];

    } catch (e) { return []; }

  }



  function writeQueue(q) {

    try { localStorage.setItem(LS_QUEUE, JSON.stringify(q.slice(-MAX_QUEUE))); } catch (e) {}

  }



  function enqueue(row) {

    var q = readQueue();

    q.push(row);

    writeQueue(q);

  }



  function pushToBrowserEngine(userSan, responseSan, eaci) {

    if (typeof VeilCaelumBrowserEngine === 'undefined') return;

    VeilCaelumBrowserEngine.learnSanitizedPair(userSan, responseSan, eaci || 'caelum');

  }



  function saveRow(row) {

    if (typeof supabase === 'undefined') {

      enqueue(row);

      return Promise.resolve(false);

    }

    return supabase.from(TABLE).insert(row).then(function(res) {

      if (res.error) {

        if (res.error.code === '23505') return true;

        enqueue(row);

        return false;

      }

      return true;

    }).catch(function() {

      enqueue(row);

      return false;

    });

  }



  function flushQueue() {

    if (typeof supabase === 'undefined') return Promise.resolve();

    var q = readQueue();

    if (!q.length) return Promise.resolve();

    var remaining = [];

    var chain = Promise.resolve();

    q.forEach(function(row) {

      chain = chain.then(function() {

        return saveRow(row).then(function(ok) { if (!ok) remaining.push(row); });

      });

    });

    return chain.then(function() { writeQueue(remaining); });

  }



  function capture(userMsg, eaciResponse, eaci, source) {

    if (!isEnabled()) return;

    var src = source || 'deepseek';

    if (SKIP_SOURCES[src]) return;



    var rawUser = String(userMsg || '');

    var rawResp = String(eaciResponse || '');

    if (!rawUser || !rawResp) return;



    var pii = gatherKnownPII();

    var userSan = sanitizeForTraining(rawUser, pii);

    var respSan = sanitizeForTraining(rawResp, pii);

    if (shouldSkip(userSan, respSan, rawUser)) return;



    var eaciName = (eaci || 'caelum').toLowerCase();

    var tags = classifyIntent(userSan);

    var hash = simpleHash(eaciName + '|' + userSan + '|' + respSan.slice(0, 200));

    if (hasSeenHash(hash)) return;

    rememberHash(hash);



    pushToBrowserEngine(userSan, respSan, eaciName);



    var row = {

      eaci: eaciName,

      source: src,

      prompt_sanitized: userSan,

      response_sanitized: respSan.slice(0, 3000),

      intent_tags: tags,

      content_hash: hash,

      word_count: (userSan + ' ' + respSan).split(/\s+/).length

    };



    saveRow(row).catch(function() {});

  }



  function hydrateBrowserFromCorpus(rows) {

    if (!rows || !rows.length) return;

    rows.forEach(function(r) {

      if (!r.prompt_sanitized || !r.response_sanitized) return;

      if (hasSeenHash(r.content_hash)) return;

      rememberHash(r.content_hash);

      pushToBrowserEngine(r.prompt_sanitized, r.response_sanitized, r.eaci || 'caelum');

    });

  }



  function syncDailyBatch() {

    if (!isEnabled()) return Promise.resolve();

    if (typeof supabase === 'undefined') return flushQueue();



    var cursor = localStorage.getItem(LS_CURSOR) || '1970-01-01T00:00:00Z';



    return flushQueue().then(function() {

      if (!hasAuthSession()) return null;

      return supabase.from(TABLE)

        .select('id,created_at,eaci,prompt_sanitized,response_sanitized,content_hash')

        .gt('created_at', cursor)

        .order('created_at', { ascending: true })

        .limit(SYNC_BATCH);

    }).then(function(res) {

      if (!res || res.error || !res.data || !res.data.length) return;

      var rows = res.data.filter(function(r) { return !hasSeenHash(r.content_hash); });

      if (!rows.length) return;



      hydrateBrowserFromCorpus(rows);



      var last = res.data[res.data.length - 1];

      if (last && last.created_at) {

        localStorage.setItem(LS_CURSOR, last.created_at);

      }

      console.log('[AutoTrain] Hydrated ' + rows.length + ' sanitized pairs into browser engine');

    }).catch(function() {});

  }



  function init() {

    setTimeout(function() {

      syncDailyBatch();

      setInterval(function() { syncDailyBatch(); }, 6 * 60 * 60 * 1000);

    }, 4000);

  }



  if (document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', init);

  } else {

    init();

  }



  return {

    isEnabled: isEnabled,

    setEnabled: setEnabled,

    sanitizeForTraining: sanitizeForTraining,

    capture: capture,

    syncDailyBatch: syncDailyBatch,

    flushQueue: flushQueue

  };

})();



function trainLocalLLMSingle(userMsg, eaciResponse, eaciName, source) {

  if (typeof VeilLLMLearning !== 'undefined') {

    VeilLLMLearning.capture(userMsg, eaciResponse, eaciName || 'caelum', source || 'deepseek');

  }

}



function trainLocalLLMFromHistory() {

  if (typeof VeilLLMLearning !== 'undefined') {

    VeilLLMLearning.syncDailyBatch();

  }

}



function veilExtractLastUserMessage(messages) {

  if (!messages || !messages.length) return '';

  for (var i = messages.length - 1; i >= 0; i--) {

    if (messages[i].role === 'user' && messages[i].content) {

      return String(messages[i].content).replace(/^\[SYSTEM[^\]]*\]\s*/i, '');

    }

  }

  return '';

}


