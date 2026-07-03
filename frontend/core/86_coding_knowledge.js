// ============================================================
// VEIL CODING KNOWLEDGE — local-first brain (recipes + learned pairs)
// DeepSeek only when confidence is low or local escalates
// ============================================================
(function () {
  'use strict';

  var K_STORE = 'veil_coding_knowledge_v1';
  var K_MAX = 96;
  var CLOUD_THRESHOLD = 38;
  var SEED_MATCH = 0.28;
  var LEARNED_MATCH = 0.36;

  function builtinRecipes() {
    var pack = (typeof VEIL_CODING_STARTER_PACK !== 'undefined' && VEIL_CODING_STARTER_PACK.recipes) || [];
    var veil = (typeof VEIL_CODING_VEIL_PACK !== 'undefined' && VEIL_CODING_VEIL_PACK.recipes) || [];
    return pack.concat(veil);
  }

  function builtinSeeds() {
    return (typeof VEIL_CODING_STARTER_PACK !== 'undefined' && VEIL_CODING_STARTER_PACK.seeds) || [];
  }

  var RECIPES = builtinRecipes();

  var CLOUD_TRIGGERS = [
    /\b(kubernetes|k8s|terraform|ansible|cuda|opengl|solidity|smart contract|microservice architecture)\b/i,
    /\b(entire backend|full stack app|dozen files|monorepo|rewrite whole project)\b/i,
    /\b(rust async|tokio|actix|django orm migration|spring boot)\b/i,
    /\b(machine learning model|train neural|pytorch|tensorflow)\b/i
  ];

  function readStore() {
    try {
      var raw = localStorage.getItem(K_STORE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function writeStore(rows) {
    try { localStorage.setItem(K_STORE, JSON.stringify(rows.slice(-K_MAX))); } catch (e) { /* ignore */ }
  }

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 2;
    });
  }

  function scoreSimilarity(a, b) {
    var ta = tokenize(a);
    var tb = tokenize(b);
    if (!ta.length || !tb.length) return 0;
    var hit = 0;
    ta.forEach(function (w) { if (tb.indexOf(w) >= 0) hit++; });
    return hit / Math.max(ta.length, tb.length);
  }

  function findLearnedExamples(userText, limit) {
    limit = limit || 2;
    var out = [];
    var q = userText || '';

    builtinSeeds().forEach(function (seed) {
      var s = scoreSimilarity(q, seed.prompt);
      if (s > SEED_MATCH) {
        out.push({
          score: s + 0.08,
          prompt: seed.prompt,
          code: '```\n' + seed.code + '\n```',
          file: seed.file || '',
          builtin: true
        });
      }
    });

    readStore().forEach(function (row) {
      var s = scoreSimilarity(q, row.prompt);
      if (s > 0.25) out.push({ score: s, prompt: row.prompt, code: row.code, file: row.file });
    });

    try {
      var corpus = JSON.parse(localStorage.getItem('veil_llm_corpus_queue') || '[]');
      corpus.forEach(function (row) {
        if (!row || !row.user_sanitized) return;
        if (!/\b(code|function|html|css|js|bug|fix|script|api)\b/i.test(row.user_sanitized + (row.response_sanitized || ''))) return;
        var s = scoreSimilarity(q, row.user_sanitized);
        if (s > 0.3) out.push({ score: s, prompt: row.user_sanitized, code: row.response_sanitized, file: '' });
      });
    } catch (e) { /* ignore */ }

    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit);
  }

  function confidence(userText, code, opts) {
    opts = opts || {};
    var score = 78;
    var text = String(userText || '');
    var len = (code || '').length;

    CLOUD_TRIGGERS.forEach(function (re) {
      if (re.test(text)) score -= 28;
    });

    if (len > 14000) score -= 25;
    else if (len > 8000) score -= 12;
    if (/\b(multiple files|from scratch|entire app|full project)\b/i.test(text)) score -= 18;
    if (opts.task === 'continue') score -= 22;

    RECIPES.forEach(function (r) {
      if (r.re.test(text)) score += 15;
    });

    if (findLearnedExamples(text, 1).length) score += 14;
    if (builtinRecipes().length >= 20) score += 6;

    if (typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive()) {
      score += 12;
      if (findLearnedExamples(text, 1).length) score += 10;
    }

    if (typeof VeilCodingWorkspace !== 'undefined') score += 5;

    return Math.max(0, Math.min(100, score));
  }

  function needsCloud(userText, code, opts) {
    // Shared subscription pool with chat (billing.apiCallsUsed)
    if (typeof canMakeApiCall === 'function' && !canMakeApiCall()) return false;
    if (opts && opts.forceCloud) return true;
    if (opts && opts.forceLocal) return false;
    return confidence(userText, code, opts) < CLOUD_THRESHOLD;
  }

  function extractUserFromMessages(messages) {
    var user = '';
    (messages || []).forEach(function (m) {
      if (m && m.role === 'user' && m.content) user += ' ' + m.content;
    });
    return user.trim();
  }

  function isCompleteEnough(code) {
    if (!code || code.length < 12) return false;
    var t = code.trim();
    var ob = (t.match(/\{/g) || []).length;
    var cb = (t.match(/\}/g) || []).length;
    if (ob !== cb) return false;
    if (/\/\/ \.\.\.|TODO: implement|rest of code/i.test(t)) return false;
    return true;
  }

  function formatCodeResponse(filename, code, lang, verifyLine) {
    lang = lang || '';
    var ext = (filename || '').split('.').pop();
    if (!lang && ext) lang = ext;
    return 'FILENAME: ' + (filename || 'code.txt') + '\n```' + lang + '\n' + code.trim() + '\n```\nVERIFY: ' + (verifyLine || 'Run Preview to confirm.');
  }

  function tryLearnedDirect(userText, opts) {
    opts = opts || {};
    var examples = findLearnedExamples(userText, opts.limit || 2);
    var minScore = opts.relaxed ? SEED_MATCH - 0.06 : ((examples[0] && examples[0].builtin) ? SEED_MATCH : LEARNED_MATCH);
    if (!examples.length || examples[0].score < minScore) return '';
    var ex = examples[0];
    var raw = String(ex.code || '');
    if (!raw) return '';
    var codeMatch = raw.match(/```(\w*)\n([\s\S]*?)```/);
    var body = codeMatch ? codeMatch[2].trim() : raw;
    var lang = codeMatch ? codeMatch[1] : '';
    if (!isCompleteEnough(body)) return '';
    var fn = ex.file || 'code.txt';
    if (typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.localLint) {
      var issues = VeilCodingRouter.localLint(body, fn).filter(function (i) { return i.severity !== 'warn'; });
      if (issues.length) return '';
    }
    return formatCodeResponse(fn, body, lang, 'From local coding memory — Preview to confirm.');
  }

  async function tryLocalGenerate(messages, opts) {
    opts = opts || {};
    var userText = opts.userText || extractUserFromMessages(messages);

    var recipe = tryRecipeFromMessages(messages);
    if (recipe && !/CLOUD_ESCALATE/i.test(recipe)) return recipe;

    var learned = tryLearnedDirect(userText, { relaxed: true });
    if (learned) return learned;

    if (opts.code && opts.filename && /\b(fix|error|lint|bracket|syntax)\b/i.test(userText)) {
      var issues = typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.localLint
        ? VeilCodingRouter.localLint(opts.code, opts.filename).filter(function (i) { return i.severity !== 'warn'; })
        : [];
      if (!issues.length && isCompleteEnough(opts.code)) {
        return formatCodeResponse(opts.filename, opts.code, opts.lang || '', 'Existing code passes lint — no change needed.');
      }
    }

    if (typeof VeilCaelumBrowserEngine !== 'undefined' && VeilCaelumBrowserEngine.generate) {
      try {
        var browser = await VeilCaelumBrowserEngine.generate(messages, 'caelum');
        if (browser && (/```/.test(browser) || /FILENAME:/i.test(browser)) && !/CLOUD_ESCALATE/i.test(browser)) {
          return browser;
        }
      } catch (e) { /* ignore */ }
    }

    return '';
  }

  function tryRecipeFromMessages(messages) {
    var user = '';
    (messages || []).forEach(function (m) {
      if (m && m.role === 'user' && m.content) user += ' ' + m.content;
    });
    user = user.trim();
    if (!user) return '';
    for (var i = 0; i < RECIPES.length; i++) {
      if (RECIPES[i].re.test(user)) return RECIPES[i].body(user);
    }
    return '';
  }

  function enrichMessages(messages, opts) {
    opts = opts || {};
    if (!messages || !messages.length) return messages;
    var userText = opts.userText || '';
    messages.forEach(function (m) {
      if (m.role === 'user') userText += ' ' + (m.content || '');
    });

    var extras = [];
    var examples = findLearnedExamples(userText, 2);
    if (examples.length) {
      extras.push('## Similar solved tasks from local memory (use as style reference)');
      examples.forEach(function (ex, idx) {
        extras.push('### Example ' + (idx + 1) + ' (prompt: ' + ex.prompt.slice(0, 120) + ')');
        if (ex.code) extras.push(String(ex.code).slice(0, 1200));
      });
    }

    for (var r = 0; r < RECIPES.length; r++) {
      if (RECIPES[r].re.test(userText)) {
        extras.push('## Local recipe available: ' + RECIPES[r].id + ' — prefer adapting this pattern.');
        break;
      }
    }

    extras.push('## LOCAL FINISH RULE\nDo not return until code is complete and passes the verify checklist. If you truly lack knowledge, reply exactly: CLOUD_ESCALATE: <short reason>');

    var out = messages.slice();
    var inject = extras.join('\n');
    if (out[0] && out[0].role === 'system') {
      out[0] = { role: 'system', content: out[0].content + '\n\n' + inject };
    } else {
      out.unshift({ role: 'system', content: inject });
    }
    return out;
  }

  function remember(prompt, code, filename) {
    if (!prompt || !code || code.length < 20) return;
    var rows = readStore();
    rows.push({
      at: Date.now(),
      prompt: String(prompt).slice(0, 400),
      code: String(code).slice(0, 8000),
      file: filename || ''
    });
    writeStore(rows);
  }

  function isEscalation(text) {
    return /CLOUD_ESCALATE\s*:/i.test(String(text || ''));
  }

  function getStats() {
    return {
      recipes: RECIPES.length,
      builtinSeeds: builtinSeeds().length,
      userMemory: readStore().length,
      cloudThreshold: CLOUD_THRESHOLD,
      sharedApiUsage: typeof VeilCodingBudget !== 'undefined' ? VeilCodingBudget.stats() : null,
      starterPack: (typeof VEIL_CODING_STARTER_PACK !== 'undefined' && VEIL_CODING_STARTER_PACK.version) || 0
    };
  }

  window.VeilCodingKnowledge = {
    confidence: confidence,
    needsCloud: needsCloud,
    enrichMessages: enrichMessages,
    tryRecipeFromMessages: tryRecipeFromMessages,
    tryLocalGenerate: tryLocalGenerate,
    findLearnedExamples: findLearnedExamples,
    remember: remember,
    isEscalation: isEscalation,
    getStats: getStats,
    CLOUD_THRESHOLD: CLOUD_THRESHOLD
  };
})();
