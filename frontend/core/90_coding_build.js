// ============================================================
// VEIL CODING BUILD — cargo/npm run + error parsing for fix loop
// ============================================================
(function () {
  'use strict';

  function isTauri() {
    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  }

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }

  function detectProjectType() {
    var v = typeof VeilIDE !== 'undefined' ? VeilIDE : null;
    if (!v || !v.isActive || !v.isActive()) return null;
    var paths = v.getFileEntries ? v.getFileEntries().map(function (e) { return e.path; }) : [];
    var hasCargo = paths.some(function (p) { return /src-tauri\/Cargo\.toml$/i.test(p) || /(^|\/)Cargo\.toml$/i.test(p); });
    var hasNpm = paths.some(function (p) { return /(^|\/)package\.json$/i.test(p); });
    if (hasCargo) return 'cargo';
    if (hasNpm) return 'npm';
    return null;
  }

  function parseBuildErrors(stdout, stderr) {
    var text = (stdout || '') + '\n' + (stderr || '');
    var errors = [];
    var lines = text.split('\n');
    var reRust = /-->\s*([^:\n]+):(\d+)(?::\d+)?/g;
    var reSimple = /^error(?:\[[^\]]+\])?:\s*(.+)$/i;

    lines.forEach(function (line, idx) {
      var m = line.match(reSimple);
      if (m) {
        errors.push({ line: 0, path: '', msg: m[1].trim() });
      }
      var rm = /-->\s*([^:\n]+):(\d+)/.exec(line);
      if (rm) {
        var ctx = lines[idx + 1] || lines[idx] || '';
        errors.push({
          path: rm[1].replace(/\\/g, '/').trim(),
          line: parseInt(rm[2], 10) || 0,
          msg: (m && m[1]) || ctx.trim() || 'compile error'
        });
      }
    });

    if (!errors.length && /error/i.test(text)) {
      errors.push({ path: '', line: 0, msg: text.slice(-1200) });
    }

    var seen = {};
    return errors.filter(function (e) {
      var k = e.path + ':' + e.line + ':' + e.msg.slice(0, 40);
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    }).slice(0, 40);
  }

  function formatBuildErrors(errors) {
    if (!errors.length) return '';
    return errors.map(function (e) {
      if (e.path) return e.path + (e.line ? ':' + e.line : '') + ' — ' + e.msg;
      return e.msg;
    }).join('\n');
  }

  async function run(opts) {
    opts = opts || {};
    if (!isTauri()) {
      return { ok: true, skipped: true, reason: 'Build requires the desktop app', command: '', errors: [] };
    }
    try {
      var kind = opts.kind || 'auto';
      var result = await invoke('ide_run_build', { kind: kind });
      var combined = (result.stdout || '') + '\n' + (result.stderr || '');
      var errors = result.ok ? [] : parseBuildErrors(result.stdout, result.stderr);
      return {
        ok: !!result.ok,
        skipped: false,
        command: result.command || '',
        cwd: result.cwd || '',
        output: combined.slice(-8000),
        exitCode: result.exit_code,
        errors: errors
      };
    } catch (e) {
      return {
        ok: false,
        skipped: false,
        command: '',
        output: String(e.message || e),
        errors: [{ path: '', line: 0, msg: String(e.message || e) }]
      };
    }
  }

  window.VeilCodingBuild = {
    detectProjectType: detectProjectType,
    run: run,
    parseBuildErrors: parseBuildErrors,
    formatBuildErrors: formatBuildErrors,
    kinds: {
      check: 'cargo',
      build: 'cargo-full',
      test: 'cargo-test',
      lint: 'cargo-clippy',
      npmBuild: 'npm',
      npmTest: 'npm-test',
      npmLint: 'npm-lint'
    }
  };
})();
