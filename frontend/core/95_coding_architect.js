// ============================================================
// VEIL CODING ARCHITECT — novel architecture and refactor guidance
// ============================================================
(function () {
  'use strict';

  var PROJECT_RULES = [
    'The main website is a no-build-step HTML/CSS/JS app loaded by ordered script tags in index.html.',
    'For shared IDE or core modules, main and offline mirrors often both need updates.',
    'Script order and ?v cache-busters matter when adding or replacing core modules.',
    'Rust/Tauri changes usually require JS invoke callers plus cargo verification.',
    'Safer changes extend existing modules before inventing new global cross-cutting abstractions.'
  ];

  function intent(text) {
    if (typeof VeilCodingStrategy !== 'undefined' && VeilCodingStrategy.classifyIntent) {
      return VeilCodingStrategy.classifyIntent(text);
    }
    return 'implement';
  }

  function shouldUse(text) {
    return /\b(architecture|refactor|novel|cross-system|whole system|safely|design|approach|trace across|many subsystems)\b/i.test(String(text || '')) ||
      /^(why|how)\b/i.test(String(text || '').trim());
  }

  function likelyShape(text) {
    text = String(text || '');
    if (/\b(tauri|rust|desktop|project_fs|invoke)\b/i.test(text) && /\b(frontend|ui|browser|index\.html|core\/)\b/i.test(text)) {
      return 'frontend + Tauri bridge';
    }
    if (/\b(supabase|auth|login|profile|database|stripe)\b/i.test(text)) {
      return 'frontend + backend/data boundary';
    }
    if (/\b(avatar|voice|music|video|animation|deepgram)\b/i.test(text)) {
      return 'media pipeline';
    }
    return 'frontend core';
  }

  function buildOptions(intentName, shape) {
    if (intentName === 'refactor') {
      return [
        'Option A (safer): keep current public globals and extract internals behind helper functions.',
        'Option B (bigger): introduce a new adapter module, then migrate callers in phases.'
      ];
    }
    if (intentName === 'architecture') {
      return [
        'Option A (safer): extend the closest existing subsystem and keep the current wiring model.',
        'Option B (cleaner): create a dedicated boundary layer for ' + shape + ', then route calls through it.'
      ];
    }
    if (intentName === 'trace' || intentName === 'debug') {
      return [
        'Trace path first: caller -> shared state -> bridge/API -> callee -> verification.',
        'Edit only after the failing boundary is identified.'
      ];
    }
    return [
      'Prefer the smallest complete change in the existing subsystem.',
      'Escalate to a new module only if the current file boundary is clearly wrong.'
    ];
  }

  function buildPhases(shape) {
    var phases = [
      'Phase 1: map boundaries and choose the smallest safe edit surface.',
      'Phase 2: implement the narrowest compatible change.',
      'Phase 3: mirror related copies and update load order or invoke wiring if needed.',
      'Phase 4: run lint/build/test and only then consider cleanup.'
    ];
    if (shape === 'frontend + Tauri bridge') {
      phases[2] = 'Phase 3: update JS caller, Rust command/invoke_handler, and desktop mirror together.';
    }
    return phases;
  }

  async function buildMemo(userText, strategyCtx, exploreCtx, projCtx) {
    if (!shouldUse(userText)) return '';
    var kind = intent(userText);
    var shape = likelyShape(userText + '\n' + exploreCtx + '\n' + projCtx);
    var lines = [];

    lines.push('## ARCHITECTURE MODE');
    lines.push('Task type: ' + kind);
    lines.push('Likely shape: ' + shape);
    lines.push('Project constraints:');
    PROJECT_RULES.forEach(function (r) { lines.push('- ' + r); });

    var options = buildOptions(kind, shape);
    lines.push('Options:');
    options.forEach(function (o) { lines.push('- ' + o); });

    lines.push('Execution phases:');
    buildPhases(shape).forEach(function (p) { lines.push('- ' + p); });

    if (strategyCtx) {
      lines.push('Strategy context:');
      lines.push(strategyCtx.slice(0, 1200));
    }

    return lines.join('\n').slice(0, 3200);
  }

  window.VeilCodingArchitect = {
    shouldUse: shouldUse,
    buildMemo: buildMemo
  };
})();
