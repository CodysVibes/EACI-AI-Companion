// ============================================================
// VEIL CODING STRATEGY — intent, hypotheses, subsystem ranking
// ============================================================
(function () {
  'use strict';

  var SUBSYSTEMS = [
    { id: 'frontend-core', label: 'Frontend core', patterns: [/\b(ui|frontend|button|panel|chat|code tab|preview|script tag|index\.html|core\/)\b/i, /(^|\/)core\//i, /index\.html$/i] },
    { id: 'tauri-rust', label: 'Tauri desktop / Rust', patterns: [/\b(tauri|rust|cargo|desktop exe|project_fs|src-tauri|invoke)\b/i, /(^|\/)src-tauri\//i, /\.rs$/i, /Cargo\.toml$/i] },
    { id: 'python-brain', label: 'Python brain', patterns: [/\b(python|llm|brain|railway|backend|caelum llm)\b/i, /the-veil-caelum-llm-v14/i, /caelum-llm/i, /\.py$/i] },
    { id: 'auth-data', label: 'Auth / data / Supabase', patterns: [/\b(auth|login|signup|supabase|account|profile|cookie|session|payment|stripe|database)\b/i, /supabase/i, /auth/i] },
    { id: 'media-avatar', label: 'Media / avatar / music', patterns: [/\b(video|music|avatar|animation|r2|deepgram|voice|stt|tts)\b/i, /music/i, /anim/i] },
    { id: 'analytics', label: 'Analytics', patterns: [/\b(analytics|dashboard|funnel|stats)\b/i, /analytics-console/i] },
    { id: 'docs-deploy', label: 'Docs / deploy rules', patterns: [/\b(readme|deploy|archive|site-readmes|site-archive|cache buster|\?v=)\b/i, /README/i, /INDEX\.md$/i] }
  ];

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9_./-]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function classifyIntent(text) {
    text = String(text || '');
    if (/\b(why|weird|broken|failing|crash|freeze|stuck|not working|bug|issue|trace|root cause|debug)\b/i.test(text)) return 'debug';
    if (/\b(refactor|reorganize|cleanup|safely change architecture|split|extract|rename across)\b/i.test(text)) return 'refactor';
    if (/\b(architecture|approach|design|best way|decide|plan first|tradeoff)\b/i.test(text)) return 'architecture';
    if (/\b(trace across|frontend.*rust|rust.*frontend|cross-system|subsystem)\b/i.test(text)) return 'trace';
    if (/\b(review|audit|risk|safety)\b/i.test(text)) return 'review';
    return 'implement';
  }

  function intentChecklist(intent) {
    switch (intent) {
      case 'debug':
        return [
          'Reproduce or narrow the symptom before editing.',
          'Prefer root-cause hypotheses over broad rewrites.',
          'Check load order, async boundaries, stale mirrors, and platform-specific paths.'
        ];
      case 'refactor':
        return [
          'Keep behavior unchanged first; move code second.',
          'Preserve script order and public globals.',
          'Verify every touched subsystem after edits.'
        ];
      case 'architecture':
        return [
          'Choose files after mapping subsystem boundaries.',
          'Minimize new globals and keep backward compatibility.',
          'State the safest path before coding.'
        ];
      case 'trace':
        return [
          'Follow data flow across browser, Tauri bridge, and backend.',
          'Check both JS caller and Rust/Python callee.',
          'Validate assumptions with grep and build/test output.'
        ];
      default:
        return [
          'Pick the smallest complete change.',
          'Prefer existing patterns over new abstractions.',
          'Verify before declaring done.'
        ];
    }
  }

  function subsystemScores(text, paths) {
    var scored = SUBSYSTEMS.map(function (s) {
      var score = 0;
      s.patterns.forEach(function (re) {
        if (re.test(text)) score += 2;
        (paths || []).forEach(function (p) { if (re.test(p)) score += 1; });
      });
      return { id: s.id, label: s.label, score: score };
    }).filter(function (s) { return s.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored;
  }

  function uniqueStrings(list) {
    var seen = {};
    return (list || []).filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = 1;
      return true;
    });
  }

  async function rankFiles(userText, activePath) {
    var ranked = [];
    if (typeof VeilCodingWorkspace !== 'undefined') {
      try {
        var hits = await VeilCodingWorkspace.search(userText, 14);
        hits.forEach(function (h) {
          ranked.push(h.path + (h.viaSymbol ? ' [symbol ' + h.viaSymbol + ']' : '') + (h.viaScript ? ' [script-order]' : ''));
        });
      } catch (e) { /* ignore */ }
      try {
        var rel = await VeilCodingWorkspace.getRelatedFiles(activePath || '');
        rel.forEach(function (p) { ranked.unshift(p + ' [related import]'); });
      } catch (e2) { /* ignore */ }
    }
    return uniqueStrings(ranked).slice(0, 14);
  }

  function buildHypotheses(intent, userText) {
    if (intent === 'debug' || intent === 'trace') {
      return [
        'Wrong file or mirror copy was edited, so runtime still uses old code.',
        'Script load order or global dependency is broken.',
        'Async / event listener / interval behavior diverges between browser and desktop.',
        'Cross-boundary mismatch: JS caller, Tauri command, or backend schema disagree.'
      ];
    }
    if (intent === 'refactor') {
      return [
        'Public globals or script order may be relied on implicitly.',
        'Main/offline mirrored copies can drift if only one side changes.',
        'Behavioral regressions are more likely than syntax errors.'
      ];
    }
    if (intent === 'architecture') {
      return [
        'The safest design usually extends existing modules before inventing new cross-cutting layers.',
        'The right boundary is often per subsystem: UI, router, build/terminal, and Tauri bridge.'
      ];
    }
    return [];
  }

  async function buildReasoningPack(userText, activePath) {
    var intent = classifyIntent(userText);
    var ranked = await rankFiles(userText, activePath);
    var systems = subsystemScores(userText, ranked);
    var checklist = intentChecklist(intent);
    var hypotheses = buildHypotheses(intent, userText);
    var lines = [];

    lines.push('## STRATEGY');
    lines.push('Intent: ' + intent);
    if (systems.length) lines.push('Subsystems: ' + systems.slice(0, 4).map(function (s) { return s.label; }).join(', '));
    if (ranked.length) {
      lines.push('Candidate files:');
      ranked.slice(0, 10).forEach(function (r) { lines.push('- ' + r); });
    }
    if (hypotheses.length) {
      lines.push('Hypotheses / risks:');
      hypotheses.forEach(function (h) { lines.push('- ' + h); });
    }
    if (checklist.length) {
      lines.push('Workflow:');
      checklist.forEach(function (c) { lines.push('- ' + c); });
    }
    if (/\b(whole system|everything|large|many files|cross-system)\b/i.test(userText)) {
      lines.push('Guardrail: prefer staged, subsystem-by-subsystem changes instead of one giant rewrite.');
    }

    return lines.join('\n').slice(0, 3500);
  }

  window.VeilCodingStrategy = {
    classifyIntent: classifyIntent,
    buildReasoningPack: buildReasoningPack,
    subsystemScores: subsystemScores,
    rankFiles: rankFiles,
    buildHypotheses: buildHypotheses
  };
})();
