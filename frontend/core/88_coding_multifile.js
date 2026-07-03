// ============================================================
// VEIL CODING MULTIFILE — parse, apply, verify bundles
// ============================================================
(function () {
  'use strict';

  function normalizePath(p) {
    return String(p || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  }

  function extractFilesFromReply(reply) {
    var text = String(reply || '');
    var files = [];
    var re = /FILENAME:\s*([^\n`]+)\s*\n```(\w*)\n([\s\S]*?)```/gi;
    var m;
    while ((m = re.exec(text)) !== null) {
      var path = normalizePath(m[1]);
      var code = m[3].trim();
      if (path && code.length > 4) {
        files.push({ path: path, lang: m[2] || '', code: code });
      }
    }
    if (!files.length && typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.extractCodeFromReply) {
      var single = VeilCodingAgent.extractCodeFromReply(text, '');
      if (single.code && single.code.length > 4) {
        files.push({
          path: normalizePath(single.filename || 'code.txt'),
          lang: single.lang || '',
          code: single.code
        });
      }
    }
    var seen = {};
    return files.filter(function (f) {
      if (seen[f.path]) return false;
      seen[f.path] = 1;
      return true;
    });
  }

  async function applyFiles(files, opts) {
    opts = opts || {};
    var bundle = files.slice();
    if (opts.mirror !== false && typeof VeilCodingWorkspace !== 'undefined' && VeilCodingWorkspace.expandWithMirrors) {
      bundle = VeilCodingWorkspace.expandWithMirrors(bundle);
    }

    var v = typeof VeilIDE !== 'undefined' ? VeilIDE : null;
    if (!v || !v.isActive || !v.isActive()) return { applied: [], skipped: bundle };

    var applied = [];
    if (v.writeWorkspaceFiles) {
      await v.writeWorkspaceFiles(bundle);
      applied = bundle.map(function (f) { return f.path; });
    } else {
      for (var i = 0; i < bundle.length; i++) {
        if (v.syncGeneratedFile) await v.syncGeneratedFile(bundle[i].path, bundle[i].code);
        applied.push(bundle[i].path);
      }
    }

    if (typeof VeilCodingWorkspace !== 'undefined' && VeilCodingWorkspace.invalidate) {
      VeilCodingWorkspace.invalidate();
    }

    var primary = opts.primaryPath || (files[0] && files[0].path);
    if (primary && v.openWorkspaceFile) {
      await v.openWorkspaceFile(primary, bundle.find(function (f) { return f.path === primary; }) || files[0]);
    }
    return { applied: applied, skipped: [], mirrored: bundle.length - files.length };
  }

  function lintBundle(files) {
    var issues = [];
    if (typeof VeilCodingRouter === 'undefined' || !VeilCodingRouter.localLint) return issues;
    files.forEach(function (f) {
      VeilCodingRouter.localLint(f.code, f.path).forEach(function (i) {
        if (i.severity === 'warn') return;
        issues.push({ path: f.path, line: i.line, msg: i.msg });
      });
    });
    return issues;
  }

  function formatBundleLint(issues) {
    if (!issues.length) return '';
    return issues.map(function (i) {
      return i.path + ' line ' + i.line + ': ' + i.msg;
    }).join('\n');
  }

  function summarize(files, issues) {
    var names = files.map(function (f) { return f.path; }).join(', ');
    if (!issues.length) return names + ' — all files pass syntax check.';
    return names + ' — ' + issues.length + ' issue(s) remain.';
  }

  window.VeilCodingMultifile = {
    extractFilesFromReply: extractFilesFromReply,
    applyFiles: applyFiles,
    lintBundle: lintBundle,
    formatBundleLint: formatBundleLint,
    summarize: summarize,
    normalizePath: normalizePath
  };
})();
