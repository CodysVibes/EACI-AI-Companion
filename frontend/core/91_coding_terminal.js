// ============================================================
// VEIL CODING TERMINAL ? scoped git/cargo/npm (Cursor-class verify)
// ============================================================
(function () {
  'use strict';

  function isTauri() {
    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  }

  function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }

  function asResult(raw, name) {
    if (!raw) return { ok: false, name: name, command: '', output: '', errors: [] };
    var out = ((raw.stdout || '') + '\n' + (raw.stderr || '')).trim();
    var errors = [];
    if (!raw.ok && typeof VeilCodingBuild !== 'undefined') {
      errors = VeilCodingBuild.parseBuildErrors(raw.stdout, raw.stderr);
    }
    return {
      ok: !!raw.ok,
      name: name,
      command: raw.command || '',
      cwd: raw.cwd || '',
      output: out.slice(-10000),
      exitCode: raw.exit_code,
      errors: errors
    };
  }

  async function run(program, args, cwdRel, opts) {
    opts = opts || {};
    if (!isTauri()) {
      return { ok: true, skipped: true, name: program, reason: 'Terminal requires desktop app', output: '' };
    }
    try {
      var allowUnsafe = !!opts.allowUnsafe;
      if (!allowUnsafe && typeof VeilIDE !== 'undefined' && VeilIDE.openToolModeEnabled) {
        allowUnsafe = VeilIDE.openToolModeEnabled();
      }
      var raw = await invoke('ide_run_command', {
        program: program,
        args: args || [],
        cwdRel: cwdRel || null,
        allowUnsafe: allowUnsafe
      });
      return asResult(raw, program);
    } catch (e) {
      return { ok: false, name: program, command: '', output: String(e.message || e), errors: [{ msg: String(e.message || e) }] };
    }
  }

  async function runOpen(program, args, cwdRel) {
    return run(program, args, cwdRel, { allowUnsafe: true });
  }

  async function gitStatus() {
    if (!isTauri()) return { ok: true, skipped: true, summary: 'Git requires desktop app' };
    try {
      return await invoke('ide_git_status', {});
    } catch (e) {
      return { ok: false, summary: String(e.message || e), modified: [], untracked: [] };
    }
  }

  async function gitDiffStat() {
    return run('git', ['diff', '--stat']);
  }

  function formatGitStatus(st) {
    if (!st || st.skipped) return '';
    var lines = [st.summary || ''];
    if (st.modified && st.modified.length) {
      lines.push('Modified: ' + st.modified.slice(0, 25).join(', ') + (st.modified.length > 25 ? '?' : ''));
    }
    if (st.untracked && st.untracked.length) {
      lines.push('Untracked: ' + st.untracked.slice(0, 15).join(', ') + (st.untracked.length > 15 ? '?' : ''));
    }
    return lines.join('\n');
  }

  function formatVerifyResults(results) {
    return results.map(function (r) {
      var head = (r.ok ? 'OK' : 'FAIL') + ' ' + (r.name || '') + (r.command ? ' (' + r.command + ')' : '');
      var tail = r.output ? '\n' + r.output.slice(-1500) : '';
      return head + tail;
    }).join('\n\n---\n\n');
  }

  async function verifySuite(opts) {
    opts = opts || {};
    var results = [];
    var git = await gitStatus();
    results.push({
      ok: true,
      name: 'git-status',
      command: 'git status',
      output: formatGitStatus(git),
      errors: []
    });

    var diff = await gitDiffStat();
    diff.name = 'git-diff';
    results.push(diff);

    if (typeof VeilCodingBuild !== 'undefined') {
      var projectType = VeilCodingBuild.detectProjectType();
      var kind = opts.fullBuild ? 'cargo-full' : (opts.kind || 'auto');

      if (opts.runTests && projectType === 'cargo') {
        var testRes = await VeilCodingBuild.run({ kind: 'cargo-test' });
        testRes.name = 'cargo-test';
        results.push(testRes);
      }
      if (opts.runLint && projectType === 'cargo') {
        var clippy = await run('cargo', ['clippy', '--message-format=short']);
        clippy.name = 'cargo-clippy';
        results.push(clippy);
      }

      var buildRes = await VeilCodingBuild.run({ kind: kind });
      buildRes.name = kind;
      results.push(buildRes);

      if (opts.runLint && projectType === 'npm') {
        var npmLint = await run('npm', ['run', 'lint']);
        npmLint.name = 'npm-lint';
        results.push(npmLint);
      }
      if (opts.npmTest && projectType === 'npm') {
        var npmTest = await VeilCodingBuild.run({ kind: 'npm-test' });
        npmTest.name = 'npm-test';
        results.push(npmTest);
      }
    }

    var ok = results.every(function (r) { return r.ok || r.skipped; });
    return { ok: ok, results: results, text: formatVerifyResults(results) };
  }

  window.VeilCodingTerminal = {
    run: run,
    runOpen: runOpen,
    gitStatus: gitStatus,
    gitDiffStat: gitDiffStat,
    verifySuite: verifySuite,
    formatGitStatus: formatGitStatus,
    formatVerifyResults: formatVerifyResults
  };
})();
