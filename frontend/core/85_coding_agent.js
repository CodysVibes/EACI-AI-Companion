// ============================================================
// VEIL CODING AGENT — local verify/fix first; cloud last resort
// ============================================================
(function () {
  'use strict';

  function playbook() {
    return typeof VEIL_CODING_PLAYBOOK !== 'undefined' ? VEIL_CODING_PLAYBOOK : '';
  }

  function dna() {
    return typeof CLAUDE_CODING_DNA !== 'undefined' ? CLAUDE_CODING_DNA : '';
  }

  function buildSystemPrompt(whoName, soul, opts) {
    opts = opts || {};
    var parts = [];
    if (soul) parts.push(soul);
    parts.push('You are ' + whoName + ', an expert coding agent in The Veil IDE.');
    parts.push('DEFAULT: solve using built-in coding knowledge and local memory — no external LLM. DeepSeek only when online and you reply CLOUD_ESCALATE.');
    parts.push(dna());
    parts.push(playbook());
    if (opts.tier === 'local' && typeof LOCAL_CODING_BOOST !== 'undefined') {
      parts.push(LOCAL_CODING_BOOST);
    } else if (typeof DEEPSEEK_CODING_BOOST !== 'undefined') {
      parts.push(DEEPSEEK_CODING_BOOST);
    }
    if (opts.mode === 'review') {
      parts.push('\n## REVIEW MODE\nReturn REVIEW NOTES (numbered) then FIXED CODE — complete file, tested mentally.');
    }
    if (opts.mode === 'diff') {
      parts.push('\n## DIFF MODE\nReturn ONLY a JSON array of changes for the active file, OR full FILENAME blocks if multiple files change.');
    }
    if (opts.mode === 'multifile') {
      parts.push('\n## MULTI-FILE MODE\nReturn complete files only. One block per path:\nFILENAME: relative/path.ext\n```lang\n<full file>\n```\nOrder: dependencies first, index.html last if adding scripts.');
    }
    if (opts.mode === 'fix') {
      parts.push('\n## FIX MODE\nFix every listed error. Return FILENAME + complete fixed file + VERIFY line. Finish before responding.');
    }
    if (opts.codeContext) parts.push('\n## Code context\n' + opts.codeContext);
    if (opts.projectContext) parts.push('\n## Open project\n' + opts.projectContext);
    if (opts.lintReport) parts.push('\n## Errors you MUST fix before returning\n' + opts.lintReport);
    if (opts.recentChat) parts.push('\n## Recent chat\n' + opts.recentChat);
    return parts.join('\n\n');
  }

  function extractCodeFromReply(reply, fallbackLang) {
    var text = String(reply || '');
    var fnMatch = text.match(/FILENAME:\s*(\S+)/i);
    var filename = fnMatch ? fnMatch[1] : null;
    var codeMatch = text.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[2]) {
      return { filename: filename, lang: codeMatch[1] || fallbackLang || '', code: codeMatch[2].trim() };
    }
    var stripped = text.replace(/FILENAME:\s*\S+/gi, '').replace(/VERIFY:.*$/gim, '').replace(/ASSUMPTIONS:.*$/gim, '').trim();
    return { filename: filename, lang: fallbackLang || '', code: stripped };
  }

  function extractFilesFromReply(reply) {
    if (typeof VeilCodingMultifile !== 'undefined' && VeilCodingMultifile.extractFilesFromReply) {
      return VeilCodingMultifile.extractFilesFromReply(reply);
    }
    var one = extractCodeFromReply(reply, '');
    return one.code ? [{ path: one.filename || 'code.txt', lang: one.lang, code: one.code }] : [];
  }

  async function postProcessBundle(files, userText, whoName, soul, opts) {
    opts = opts || {};
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var pp = await postProcess(f.code, f.path, userText, whoName, soul, opts);
      out.push({ path: f.path, lang: f.lang, code: pp.code, ready: pp.ready, issues: pp.issues });
    }
    return out;
  }

  function lintReport(code, filename) {
    if (typeof VeilCodingRouter === 'undefined' || !VeilCodingRouter.localLint) return [];
    return VeilCodingRouter.localLint(code, filename).filter(function (i) { return i.severity !== 'warn'; });
  }

  function formatLintReport(issues) {
    if (!issues || !issues.length) return '';
    return issues.map(function (i) { return 'Line ' + i.line + ': ' + i.msg; }).join('\n');
  }

  function isStructurallyComplete(code) {
    if (!code || code.length < 20) return false;
    var t = code.trim();
    var ob = (t.match(/\{/g) || []).length;
    var cb = (t.match(/\}/g) || []).length;
    if (ob > cb) return false;
    var op = (t.match(/\(/g) || []).length;
    var cp = (t.match(/\)/g) || []).length;
    if (op > cp + 1) return false;
  if (/```|\/\/ \.\.\.|TODO: implement|rest of code/i.test(t)) return false;
    return true;
  }

  async function autoFixPass(code, filename, userText, whoName, soul, opts) {
    opts = opts || {};
    if (typeof _codeChat !== 'function') return code;
    var issues = lintReport(code, filename);
    if (!issues.length && isStructurallyComplete(code)) return code;

    var fixUser = (userText || 'Fix all errors') +
      '\n\nReturn the COMPLETE corrected file with FILENAME line and code fence. Must pass lint before you respond.';
    var sys = buildSystemPrompt(whoName, soul, {
      tier: opts.useCloud ? 'cloud' : 'local',
      mode: 'fix',
      codeContext: '```\n' + code + '\n```',
      lintReport: formatLintReport(issues),
      projectContext: opts.projectContext || ''
    });

    var chatOpts = {
      task: 'fix',
      userText: fixUser,
      code: code,
      filename: filename,
      temperature: 0.08,
      max_tokens: 4500,
      // Prefer Caelum for fixes; only force cloud when explicitly requested
      forceLocal: !opts.useCloud
    };

    try {
      var reply = await _codeChat(
        [{ role: 'system', content: sys }, { role: 'user', content: fixUser }],
        chatOpts
      );
      var extracted = extractCodeFromReply(reply, opts.lang);
      if (extracted.code && extracted.code.length > 20) {
        var after = lintReport(extracted.code, filename);
        if (!after.length || after.length < issues.length) return extracted.code;
      }
    } catch (e) { /* keep original */ }
    return code;
  }

  async function postProcess(code, filename, userText, whoName, soul, opts) {
    opts = opts || {};
    var out = code;
    var issues = lintReport(out, filename);
    // Prefer many local Caelum fix passes; only use DeepSeek if companion is off
    var companionOff = typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.engineMode &&
      VeilCodingRouter.engineMode() === 'off';
    var passes = opts.maxPasses || (companionOff ? 3 : 6);

    for (var i = 0; i < passes; i++) {
      issues = lintReport(out, filename);
      var incomplete = !isStructurallyComplete(out);
      if (!issues.length && !incomplete) break;

      // Keep fixes on Caelum unless companion engine is disabled
      var useCloud = companionOff && i >= passes - 1;

      out = await autoFixPass(out, filename, userText, whoName, soul, {
        lang: opts.lang,
        projectContext: opts.projectContext,
        useCloud: useCloud
      });
    }

    issues = lintReport(out, filename);
    var ready = !issues.length && isStructurallyComplete(out);

    if (ready && typeof VeilCodingKnowledge !== 'undefined') {
      VeilCodingKnowledge.remember(userText, out, filename);
    }
    if (ready && typeof trainLocalLLMSingle === 'function') {
      trainLocalLLMSingle(userText, out, whoName === 'Chad' ? 'chad' : 'caelum', 'coding_success');
    }

    return { code: out, issues: issues, ready: ready, lintText: formatLintReport(issues) };
  }

  function enhanceMessagesForTier(messages, tier) {
    if (!messages || !messages.length) return messages;
    var out = messages.slice();
    var boost = tier === 'local'
      ? (typeof LOCAL_CODING_BOOST !== 'undefined' ? LOCAL_CODING_BOOST : '')
      : (typeof DEEPSEEK_CODING_BOOST !== 'undefined' ? DEEPSEEK_CODING_BOOST : '');
    if (!boost) return out;
    if (out[0] && out[0].role === 'system') {
      out[0] = { role: 'system', content: out[0].content + '\n\n' + boost };
    } else {
      out.unshift({ role: 'system', content: boost });
    }
    return out;
  }

  window.VeilCodingAgent = {
    buildSystemPrompt: buildSystemPrompt,
    extractCodeFromReply: extractCodeFromReply,
    extractFilesFromReply: extractFilesFromReply,
    lintReport: lintReport,
    formatLintReport: formatLintReport,
    isStructurallyComplete: isStructurallyComplete,
    autoFixPass: autoFixPass,
    postProcess: postProcess,
    postProcessBundle: postProcessBundle,
    enhanceMessagesForTier: enhanceMessagesForTier
  };
})();
