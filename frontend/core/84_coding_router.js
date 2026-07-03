// ============================================================
// VEIL CODING ROUTER — LOCAL FIRST; DeepSeek only without knowledge
// EACIs verify + fix locally before escalating (cost down for everyone)
// ============================================================
(function () {
  'use strict';

  var K_TIER = 'veil_coding_tier'; // save (default) | auto | quality
  // One subscription API charge per user coding message (not per agent round)
  var _messageChargeId = '';

  function tierPref() {
    try { return localStorage.getItem(K_TIER) || 'save'; } catch (e) { return 'save'; }
  }

  function setTierPref(mode) {
    try { localStorage.setItem(K_TIER, mode); } catch (e) { /* ignore */ }
  }

  function usageLimitMessage() {
    var when = 'later';
    try {
      if (typeof TIERS !== 'undefined' && typeof billing !== 'undefined' && TIERS[billing.tier]) {
        when = TIERS[billing.tier].period === 'daily' ? 'at midnight Central' : 'in 30 days';
      }
    } catch (e) { /* ignore */ }
    return 'You have used all your API calls for this period. Resets ' + when + '. Chat and the Code IDE share one daily counter — online or offline. Check the usage meter for subscription options.';
  }

  // Call once at the start of each user coding message (generate / review / resume).
  // Counts as 1 API call total for that message, even if the agent runs many rounds.
  // Enforced online and offline so limits cannot be bypassed.
  function beginCodingMessage(opts) {
    opts = opts || {};
    if (opts.skipUsage) return { ok: true, skipped: true };

    if (typeof canMakeApiCall === 'function' && !canMakeApiCall()) {
      return { ok: false, reason: 'limit', message: usageLimitMessage() };
    }

    var chargeId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    _messageChargeId = chargeId;

    if (typeof recordApiCall === 'function') {
      recordApiCall();
    } else {
      // Offline/stub safety: still count in localStorage billing if present
      try {
        if (typeof billing !== 'undefined' && typeof saveBilling === 'function') {
          if (typeof checkAndResetUsage === 'function') checkAndResetUsage();
          billing.apiCallsUsed = (billing.apiCallsUsed || 0) + 1;
          saveBilling();
          if (typeof updateUsageMeter === 'function') updateUsageMeter();
        }
      } catch (e) { /* ignore */ }
    }

    return { ok: true, chargeId: chargeId };
  }

  function codingMessageAllowed() {
    if (typeof canMakeApiCall === 'function') return canMakeApiCall();
    try {
      if (typeof billing !== 'undefined' && typeof TIERS !== 'undefined') {
        if (typeof checkAndResetUsage === 'function') checkAndResetUsage();
        var tier = TIERS[billing.tier] || TIERS.free;
        if (tier.limit === -1) return true;
        return (billing.apiCallsUsed || 0) < tier.limit;
      }
    } catch (e) { /* ignore */ }
    return true;
  }

  function cloudAllowed(opts) {
    // Same shared subscription pool as chat (billing.apiCallsUsed)
    if (!codingMessageAllowed()) return false;
    if (opts && opts.forceLocal) return false;
    return true;
  }

  function isIdeProject() {
    return typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive();
  }

  function codeSize(code) {
    return (code || '').length;
  }

  function classifyTask(userText, code, opts) {
    opts = opts || {};
    var pref = tierPref();

    if (opts.task === 'lint' || opts.task === 'verify') return 'lint';
    if (opts.task === 'multifile' || opts.task === 'plan') return 'local';

    if (opts.forceCloud || pref === 'quality') {
      if (!cloudAllowed(opts)) return 'local';
      return 'cloud';
    }
    if (opts.forceLocal || pref === 'save') return 'local';

    if (typeof VeilCodingKnowledge !== 'undefined' && VeilCodingKnowledge.needsCloud(userText, code, opts)) {
      return cloudAllowed(opts) ? 'cloud' : 'local';
    }

    return 'local';
  }

  function _scanStringsAndComments(line, ext, inBlockComment) {
    var issues = [];
    var i = 0;
    var inString = null;
    var block = inBlockComment;
    while (i < line.length) {
      var ch = line[i];
      var next = line[i + 1];
      if (block) {
        if (ch === '*' && next === '/') { block = false; i += 2; continue; }
        i++; continue;
      }
      if (inString) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === inString) inString = null;
        i++; continue;
      }
      if (ext !== 'html' && ch === '/' && next === '*') { block = true; i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; i++; continue; }
      i++;
    }
    if (inString) issues.push('Unclosed string ' + inString);
    return { issues: issues, inBlockComment: block };
  }

  function localLint(code, filename) {
    var issues = [];
    var ext = (filename || '').split('.').pop().toLowerCase();
    var lines = String(code || '').split('\n');

    var pairs = { '(': ')', '[': ']', '{': '}' };
    var stack = [];
    var blockComment = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var strScan = _scanStringsAndComments(line, ext, blockComment);
      blockComment = strScan.inBlockComment;
      strScan.issues.forEach(function (msg) {
        issues.push({ line: i + 1, msg: msg });
      });
      for (var c = 0; c < line.length; c++) {
        var ch = line[c];
        if (pairs[ch]) stack.push({ ch: ch, line: i + 1 });
        else if (ch === ')' || ch === ']' || ch === '}') {
          var open = stack.length ? stack.pop() : null;
          if (!open || pairs[open.ch] !== ch) {
            issues.push({ line: i + 1, msg: 'Mismatched bracket ' + ch });
          }
        }
      }
      if (/console\.log\s*\(/.test(line) && !/\/\/.*console\.log/.test(line) && ext !== 'html') {
        issues.push({ line: i + 1, msg: 'Debug console.log left in code', severity: 'warn' });
      }
      if (/\beval\s*\(/.test(line)) {
        issues.push({ line: i + 1, msg: 'eval() is unsafe', severity: 'warn' });
      }
      if (ext === 'js' && /\.innerHTML\s*=/.test(line) && !/escapeHtml|textContent|DOMPurify/.test(line)) {
        issues.push({ line: i + 1, msg: 'innerHTML assignment — ensure input is escaped', severity: 'warn' });
      }
    }
    stack.forEach(function (s) {
      issues.push({ line: s.line, msg: 'Unclosed ' + s.ch });
    });

    if (ext === 'json') {
      try { JSON.parse(code); } catch (e) { issues.push({ line: 1, msg: 'JSON: ' + e.message }); }
    }
    if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
      try { new Function(code); } catch (e2) {
        var m = String(e2.message || '');
        var lm = m.match(/line (\d+)/i);
        issues.push({ line: lm ? parseInt(lm[1], 10) : 1, msg: 'JS syntax: ' + m });
      }
    }
    if (ext === 'html' || ext === 'htm') {
      var opens = (code.match(/<[a-zA-Z][^/!>]*>/g) || []).length;
      var closes = (code.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
      var voids = (code.match(/<(br|hr|img|input|meta|link)[^>]*>/gi) || []).length;
      if (opens > closes + voids + 3) {
        issues.push({ line: 1, msg: 'HTML may have unclosed tags (' + opens + ' open, ' + closes + ' close)' });
      }
    }
    if (ext === 'css') {
      var ob = (code.match(/\{/g) || []).length;
      var cb = (code.match(/\}/g) || []).length;
      if (ob !== cb) issues.push({ line: 1, msg: 'CSS brace mismatch ({ ' + ob + ' vs } ' + cb + ')' });
    }

    return issues.filter(function (x) { return x.severity !== 'warn' || issues.length < 8; });
  }

  function verifyCode(code, filename) {
    var issues = localLint(code, filename);
    var errors = issues.filter(function (i) { return i.severity !== 'warn'; });
    return {
      ok: errors.length === 0,
      issues: issues,
      errors: errors,
      summary: errors.length
        ? errors.length + ' error(s) found'
        : (issues.length ? issues.length + ' warning(s)' : 'No issues found')
    };
  }

  function _enrich(messages, opts) {
    var msgs = messages;
    if (typeof VeilCodingKnowledge !== 'undefined' && VeilCodingKnowledge.enrichMessages) {
      msgs = VeilCodingKnowledge.enrichMessages(msgs, opts);
    }
    var tier = opts._activeTier || 'local';
    if (typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.enhanceMessagesForTier) {
      msgs = VeilCodingAgent.enhanceMessagesForTier(msgs, tier);
    }
    return msgs;
  }

  function extractSystemPrompt(messages) {
    var sys = '';
    (messages || []).forEach(function (m) {
      if (m && m.role === 'system' && m.content) sys += (sys ? '\n\n' : '') + m.content;
    });
    return sys;
  }

  // Settings: primary | fallback | off  (same as Companion Engine in Settings)
  // primary  = Caelum LLM main, DeepSeek backup
  // fallback = DeepSeek main, Caelum LLM backup
  // off      = DeepSeek only (no Caelum engine)
  function engineMode() {
    if (typeof CONFIG !== 'undefined' && CONFIG.offlineLlmMode) return CONFIG.offlineLlmMode;
    try {
      var m = localStorage.getItem('veil_offline_llm_mode');
      if (m === 'primary' || m === 'fallback' || m === 'off') return m;
    } catch (e) { /* ignore */ }
    return 'fallback';
  }

  function caelumEngineAllowed() {
    return engineMode() !== 'off';
  }

  function deepseekAllowed(opts) {
    if (opts && opts.forceLocal) return false;
    return cloudAllowed(opts);
  }

  async function tryKnowledgeOnly(messages, opts) {
    opts = opts || {};
    if (typeof VeilCodingKnowledge !== 'undefined' && VeilCodingKnowledge.tryLocalGenerate) {
      var known = await VeilCodingKnowledge.tryLocalGenerate(messages, opts);
      if (known && String(known).trim().length > 8 && !/CLOUD_ESCALATE\s*:/i.test(known)) {
        return String(known);
      }
    }
    if (typeof VeilCodingKnowledge !== 'undefined' && VeilCodingKnowledge.tryRecipeFromMessages) {
      var recipe = VeilCodingKnowledge.tryRecipeFromMessages(messages);
      if (recipe && String(recipe).trim().length > 8) return String(recipe);
    }
    return '';
  }

  function codingSystemBoost() {
    var parts = [];
    if (typeof VEIL_CODING_PLAYBOOK !== 'undefined') parts.push(VEIL_CODING_PLAYBOOK);
    if (typeof CAELUM_CODING_BOOST !== 'undefined') parts.push(CAELUM_CODING_BOOST);
    else if (typeof LOCAL_CODING_BOOST !== 'undefined') parts.push(LOCAL_CODING_BOOST);
    parts.push('CODING OUTPUT RULES:\n- Return FILENAME: path and a complete fenced code block.\n- No placeholders, no "// ..." omissions.\n- Close all braces/tags. Prefer complete working files.');
    return parts.join('\n\n');
  }

  function fewShotExamples(userText) {
    var blocks = [];
    if (typeof VeilCodingKnowledge === 'undefined') return '';
    try {
      if (VeilCodingKnowledge.findLearnedExamples) {
        var ex = VeilCodingKnowledge.findLearnedExamples(userText || '', 2) || [];
        ex.forEach(function (row, i) {
          if (!row || !row.code) return;
          blocks.push('### Example ' + (i + 1) + '\nPrompt: ' + String(row.prompt || '').slice(0, 160) + '\n' + String(row.code).slice(0, 1400));
        });
      }
      if (VeilCodingKnowledge.tryRecipeFromMessages && userText) {
        var recipe = VeilCodingKnowledge.tryRecipeFromMessages([
          { role: 'user', content: userText }
        ]);
        if (recipe) blocks.push('### Recipe pattern\n' + String(recipe).slice(0, 1400));
      }
    } catch (e) { /* ignore */ }
    if (!blocks.length) return '';
    return '## SIMILAR SOLVED EXAMPLES (match this completeness and style)\n' + blocks.join('\n\n');
  }

  function messagesWithCodingBoost(messages, opts) {
    opts = opts || {};
    var boost = codingSystemBoost();
    var shots = fewShotExamples(opts.userText || extractUserText(messages));
    if (shots) boost += '\n\n' + shots;
    var out = (messages || []).slice();
    if (!out.length) {
      return [{ role: 'system', content: boost }];
    }
    if (out[0] && out[0].role === 'system') {
      out[0] = { role: 'system', content: out[0].content + '\n\n' + boost };
    } else {
      out.unshift({ role: 'system', content: boost });
    }
    return out;
  }

  function extractUserText(messages) {
    var u = '';
    (messages || []).forEach(function (m) {
      if (m && m.role === 'user' && m.content) u += ' ' + m.content;
    });
    return u.trim();
  }

  function extractCodeBody(text) {
    var m = String(text || '').match(/```[\w]*\n([\s\S]*?)```/);
    return m ? m[1] : String(text || '');
  }

  function looksIncompleteCode(text) {
    var body = extractCodeBody(text);
    if (!body || body.length < 20) return true;
    if (/\/\/\s*\.\.\.|TODO: implement|rest of code|implement here/i.test(body)) return true;
    var ob = (body.match(/\{/g) || []).length;
    var cb = (body.match(/\}/g) || []).length;
    if (ob > cb) return true;
    var op = (body.match(/\(/g) || []).length;
    var cp = (body.match(/\)/g) || []).length;
    if (op > cp + 1) return true;
    return false;
  }

  function hasLintErrors(text, filename) {
    var body = extractCodeBody(text);
    var fn = filename || 'code.js';
    var issues = localLint(body, fn).filter(function (i) { return i.severity !== 'warn'; });
    return issues.length > 0;
  }

  // Single-shot call to one local engine (no polish loop)
  async function tryCaelumEngineOnce(messages, opts) {
    opts = opts || {};
    if (!caelumEngineAllowed()) return '';
    var msgs = messages || [];
    var maxTok = opts.max_tokens || 4500;
    var temp = typeof opts.temperature === 'number' ? opts.temperature : 0.1;

    if (typeof window.VeilOfflineCodingEngine !== 'undefined' && window.VeilOfflineCodingEngine.generate) {
      try {
        var native = await window.VeilOfflineCodingEngine.generate(msgs, {
          temperature: temp,
          max_tokens: maxTok
        });
        if (native && String(native).trim().length > 8 && !/CLOUD_ESCALATE\s*:/i.test(native)) {
          return String(native);
        }
      } catch (e) {
        console.log('[VeilCoding] Caelum GGUF failed:', e && e.message);
      }
    }

    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.callChat) {
      try {
        if (VeilCaelumLLM.ensureReady) await VeilCaelumLLM.ensureReady();
        var sys = extractSystemPrompt(msgs);
        var text = await VeilCaelumLLM.callChat(sys, msgs, opts.who || 'caelum', {
          temperature: temp,
          max_tokens: maxTok,
          forceCloud: false
        });
        if (text && String(text).trim().length > 8 && !/CLOUD_ESCALATE\s*:/i.test(text)) {
          return String(text);
        }
      } catch (e3) {
        console.log('[VeilCoding] Caelum LLM engine failed:', e3 && e3.message);
      }
    }

    if (typeof callBrowserCaelumFallback === 'function') {
      try {
        var lite = await callBrowserCaelumFallback(msgs, opts.who || 'caelum');
        if (lite && String(lite).trim().length > 8 && !/CLOUD_ESCALATE\s*:/i.test(lite)) {
          return String(lite);
        }
      } catch (e4) { /* ignore */ }
    }

    return '';
  }

  // Multi-pass local coding: generate → continue if cut off → local lint fix
  // Goal: Caelum quality close to DeepSeek without calling DeepSeek
  async function tryCaelumEngine(messages, opts) {
    opts = opts || {};
    if (!caelumEngineAllowed()) return '';

    var baseMsgs = messagesWithCodingBoost(messages || [], opts);
    var out = await tryCaelumEngineOnce(baseMsgs, opts);
    if (!out) return '';

    // Continue if truncated (local models often stop early)
    var contPasses = 0;
    while (looksIncompleteCode(out) && contPasses < 4) {
      contPasses++;
      var tail = extractCodeBody(out).split('\n').slice(-25).join('\n');
      var contMsgs = baseMsgs.slice();
      contMsgs.push({ role: 'assistant', content: out });
      contMsgs.push({
        role: 'user',
        content: 'CONTINUE from exactly where the code ends. Do not repeat any prior lines.\nLast lines were:\n```\n' +
          tail +
          '\n```\nFinish the complete file. Close all braces/tags. End with a closed code fence.'
      });
      var more = await tryCaelumEngineOnce(contMsgs, Object.assign({}, opts, { max_tokens: opts.max_tokens || 4500 }));
      if (!more || more.length < 8) break;
      var moreBody = extractCodeBody(more);
      var prevBody = extractCodeBody(out);
      // Prefer merge: if continuation is a full file, use it; else append
      if (/FILENAME:/i.test(more) && moreBody.length > prevBody.length * 0.8) {
        out = more;
      } else if (moreBody && prevBody.indexOf(moreBody.slice(0, 40)) === -1) {
        var fn = (out.match(/FILENAME:\s*(\S+)/i) || [])[1] || 'code.txt';
        var lang = (out.match(/```(\w*)/) || [])[1] || '';
        out = 'FILENAME: ' + fn + '\n```' + lang + '\n' + prevBody.replace(/\s*$/, '') + '\n' + moreBody.trim() + '\n```\nVERIFY: Continued locally — run Preview.';
      } else {
        break;
      }
    }

    // Local lint-fix pass (still no DeepSeek)
    var fnHint = (out.match(/FILENAME:\s*(\S+)/i) || [])[1] || opts.filename || 'code.js';
    var fixPasses = 0;
    while (hasLintErrors(out, fnHint) && fixPasses < 3) {
      fixPasses++;
      var body = extractCodeBody(out);
      var issues = localLint(body, fnHint).filter(function (i) { return i.severity !== 'warn'; });
      var fixMsgs = baseMsgs.slice();
      fixMsgs.push({ role: 'assistant', content: out });
      fixMsgs.push({
        role: 'user',
        content: 'Fix ALL syntax errors and return the COMPLETE corrected file with FILENAME and code fence.\n\nERRORS:\n' +
          issues.map(function (i) { return 'Line ' + i.line + ': ' + i.msg; }).join('\n')
      });
      var fixed = await tryCaelumEngineOnce(fixMsgs, Object.assign({}, opts, { temperature: 0.08 }));
      if (!fixed || fixed.length < 20) break;
      var fixedBody = extractCodeBody(fixed);
      var afterIssues = localLint(fixedBody, fnHint).filter(function (i) { return i.severity !== 'warn'; });
      if (afterIssues.length < issues.length || !hasLintErrors(fixed, fnHint)) {
        out = fixed;
      } else {
        break;
      }
    }

    return out;
  }

  // DeepSeek only — no Caelum fallback inside this helper
  async function tryDeepSeekOnly(messages, opts) {
    opts = opts || {};
    if (!deepseekAllowed(opts)) return '';

    var msgs = _enrich(messages, Object.assign({}, opts, { _activeTier: 'cloud' }));
    var body = {
      messages: msgs,
      temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.22,
      max_tokens: opts.max_tokens || 4500,
      stream: false
    };

    // Desktop EXE cloud path (DeepSeek direct, no local mix-in)
    if (typeof window.VeilLocalCodingChat === 'function') {
      try {
        var bridged = await window.VeilLocalCodingChat(body, 'cloud-only');
        if (bridged && String(bridged).trim().length > 8 && !/CLOUD_ESCALATE\s*:/i.test(bridged)) {
          return String(bridged);
        }
      } catch (eBridge) {
        console.log('[VeilCoding] DeepSeek bridge failed:', eBridge && eBridge.message);
      }
    }

    try {
      var resp = await fetch((typeof CONFIG !== 'undefined' && CONFIG.chatEndpoint) ? CONFIG.chatEndpoint : '/functions/v1/chat', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {}),
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var data = await resp.json();
      var cloudText = (data.choices && data.choices[0]) ? data.choices[0].message.content : '';
      if (cloudText && String(cloudText).trim()) return String(cloudText);
    } catch (eFetch) {
      console.log('[VeilCoding] DeepSeek fetch failed:', eFetch && eFetch.message);
    }

    return '';
  }

  // Back-compat alias used by older call sites
  async function tryOfflineEngine(messages, opts) {
    return tryCaelumEngine(messages, opts);
  }

  async function attemptLocal(messages, opts) {
    opts = Object.assign({}, opts, { _activeTier: 'local' });
    var msgs = _enrich(messages, opts);
    var known = await tryKnowledgeOnly(msgs, opts);
    if (known) return { ok: true, text: known, tier: 'local', source: 'knowledge' };
    if (!caelumEngineAllowed()) {
      return { ok: false, escalate: true, reason: 'companion engine off in Settings' };
    }
    var caelum = await tryCaelumEngine(msgs, {
      temperature: opts.temperature,
      max_tokens: opts.max_tokens || 2800,
      who: opts.who
    });
    if (caelum) return { ok: true, text: caelum, tier: 'local', source: 'caelum' };
    return { ok: false, escalate: true, reason: 'empty caelum response' };
  }

  async function attemptCloud(messages, opts) {
    // Coding always prefers Caelum when companion is enabled; DeepSeek is last resort
    opts = Object.assign({}, opts, { _activeTier: 'cloud' });
    var msgs = _enrich(messages, opts);
    if (caelumEngineAllowed()) {
      var caelum = await tryCaelumEngine(msgs, {
        temperature: opts.temperature,
        max_tokens: opts.max_tokens || 4500,
        who: opts.who
      });
      if (caelum) return { ok: true, text: caelum, tier: 'local', source: 'caelum' };
    }
    var ds = await tryDeepSeekOnly(msgs, opts);
    if (ds) return { ok: true, text: ds, tier: 'cloud', source: 'deepseek', escalated: true };
    return { ok: false, text: '', tier: 'cloud' };
  }

  async function chatCompletion(messages, opts) {
    opts = opts || {};

    if (opts.task === 'lint' || opts.task === 'verify' ||
        (opts.tier === 'lint') || (opts.tier === 'verify')) {
      var lint = localLint(opts.code || '', opts.filename || '');
      var errors = lint.filter(function (x) { return x.severity !== 'warn'; });
      var summary = lint.length
        ? 'VERIFY (' + errors.length + ' error' + (errors.length === 1 ? '' : 's') + ', ' + lint.length + ' total):\n' +
          lint.map(function (x) { return 'Line ' + x.line + ': ' + x.msg; }).join('\n')
        : 'VERIFY: No syntax issues detected. Run Preview to test runtime behavior.';
      return { text: summary, tier: 'lint', lint: lint, verify: verifyCode(opts.code || '', opts.filename || '') };
    }

    var mode = engineMode();
    var msgs = _enrich(messages, opts);

    // 1) Free recipes / coding memory
    var known = await tryKnowledgeOnly(msgs, opts);
    if (known) {
      return { text: known, tier: 'local', source: 'knowledge', engineMode: mode };
    }

    // 2) CODING ALWAYS uses Caelum when companion is enabled (primary OR fallback).
    //    Chat settings still control whether Caelum is allowed (off = no Caelum).
    //    DeepSeek is only a last-resort backup for coding — not the main brain.
    if (opts.forceLocal || mode === 'primary' || mode === 'fallback') {
      if (caelumEngineAllowed()) {
        var caelumText = await tryCaelumEngine(msgs, {
          temperature: opts.temperature,
          max_tokens: opts.max_tokens || 4500,
          who: opts.who
        });
        if (caelumText) {
          return { text: caelumText, tier: 'local', source: 'caelum', engineMode: mode };
        }
      }
      if (opts.forceLocal) {
        return { text: '', tier: 'local', source: 'none', engineMode: mode };
      }
    }

    // 3) DeepSeek only if Caelum is off, or Caelum failed and backup is allowed
    if (mode === 'off' || mode === 'primary' || mode === 'fallback') {
      // When companion is off: DeepSeek is the only generative brain.
      // When companion is on: DeepSeek runs only after Caelum returned nothing.
      var deepseekText = await tryDeepSeekOnly(msgs, opts);
      if (deepseekText) {
        return {
          text: deepseekText,
          tier: 'cloud',
          source: 'deepseek',
          escalated: mode !== 'off',
          engineMode: mode
        };
      }
    }

    return {
      text: '',
      tier: mode === 'off' ? 'cloud' : 'local',
      source: 'none',
      engineMode: mode
    };
  }

  window.VeilCodingRouter = {
    tierPref: tierPref,
    setTierPref: setTierPref,
    classifyTask: classifyTask,
    engineMode: engineMode,
    beginCodingMessage: beginCodingMessage,
    codingMessageAllowed: codingMessageAllowed,
    usageLimitMessage: usageLimitMessage,
    localLint: localLint,
    verifyCode: verifyCode,
    chatCompletion: chatCompletion,
    attemptLocal: attemptLocal,
    attemptCloud: attemptCloud,
    tryOfflineEngine: tryOfflineEngine,
    tryCaelumEngine: tryCaelumEngine,
    tryDeepSeekOnly: tryDeepSeekOnly
  };
})();
