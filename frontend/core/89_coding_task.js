// ============================================================
// VEIL CODING TASK — Cursor-class agent (explore → plan → code → verify → fix)
// Persistent notebook + architecture mode + up to 24 rounds
// ============================================================
(function () {
  'use strict';

  var MAX_ROUNDS = 24;

  function shouldUse() {
    return typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive();
  }

  function _isModification(text) {
    if (typeof _isCodeModification === 'function') return _isCodeModification(text);
    return typeof _codePanel !== 'undefined' && _codePanel.code && _codePanel.code.length > 50;
  }

  async function postProcessAll(files, userText, whoName, soul, projCtx) {
    var processed = [];
    for (var i = 0; i < files.length; i++) {
      var pp = await VeilCodingAgent.postProcess(files[i].code, files[i].path, userText, whoName, soul, {
        lang: files[i].lang,
        projectContext: projCtx,
        maxPasses: 4
      });
      processed.push({
        path: files[i].path,
        lang: files[i].lang,
        code: pp.code,
        ready: pp.ready,
        issues: pp.issues || []
      });
    }
    return processed;
  }

  async function planTask(userText, projCtx, exploreCtx, whoName, soul) {
    var localPlan = planTaskLocal(userText, exploreCtx, projCtx);
    if (typeof _codeChat !== 'function') return localPlan;
    var sys = VeilCodingAgent.buildSystemPrompt(whoName, soul, {
      mode: 'generate',
      projectContext: (exploreCtx + '\n\n' + projCtx).slice(0, 10000)
    });
    sys += '\n\n## PLAN ONLY (local)\n3–6 bullets: exact file paths, order, how to verify. No code.';
    try {
      // Uses Settings brain order (DeepSeek main / Caelum main / DeepSeek only)
      var reply = await _codeChat(
        [{ role: 'system', content: sys }, { role: 'user', content: userText }],
        { task: 'plan', userText: userText, temperature: 0.15, max_tokens: 700 }
      );
      if (reply && !/CLOUD_ESCALATE/i.test(reply) && reply.length > 40) {
        return String(reply).slice(0, 1600);
      }
    } catch (e) { /* local plan fallback */ }
    return localPlan;
  }

  function planTaskLocal(userText, exploreCtx, projCtx) {
    var lines = ['LOCAL PLAN (no API):'];
    var files = String(userText + ' ' + (exploreCtx || '')).match(/[\w ./-]+\.(js|jsx|ts|tsx|rs|html|css|json|toml)/gi) || [];
    var uniq = [];
    files.forEach(function (f) {
      f = f.trim().replace(/\\/g, '/');
      if (uniq.indexOf(f) < 0) uniq.push(f);
    });
    if (uniq.length) lines.push('Files to touch: ' + uniq.slice(0, 10).join(', '));
    if (exploreCtx) lines.push(exploreCtx.slice(0, 2000));
    lines.push('Verify: lint → preview → cargo check if Rust changed.');
    return lines.join('\n').slice(0, 1600);
  }

  function shouldEscalateToCloud(round, lintAll, verifyResult, noFiles, stalled) {
    // Shared subscription pool — no separate coding cap
    if (typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.codingMessageAllowed &&
        !VeilCodingRouter.codingMessageAllowed()) return false;
    if (stalled && round >= 2) return true;
    if (round < 4) return false;
    if (noFiles) return true;
    if (lintAll && lintAll.length) return true;
    if (verifyResult && !verifyResult.ok) return true;
    return false;
  }

  function buildFixPrompt(userText, lintAll, verifyResult, processed, gitSt) {
    var parts = [userText, '\n\nFix ALL remaining issues. Return COMPLETE files for every path you change using FILENAME blocks.'];
    if (lintAll.length) {
      parts.push('\n\nSYNTAX/LINT ERRORS:\n' + VeilCodingMultifile.formatBundleLint(lintAll));
    }
    if (verifyResult && !verifyResult.ok) {
      parts.push('\n\nVERIFY / BUILD / TEST FAILED:\n' + verifyResult.text);
    }
    if (gitSt && !gitSt.skipped && gitSt.modified && gitSt.modified.length) {
      parts.push('\n\nGIT MODIFIED:\n' + gitSt.modified.slice(0, 20).join('\n'));
    }
    if (processed.length) {
      parts.push('\n\nFILES IN PLAY:\n' + processed.map(function (f) { return f.path; }).join('\n'));
    }
    return parts.join('');
  }

  function needsVerify(processed, round) {
    if (!processed.length) return false;
    if (typeof VeilCodingBuild === 'undefined' || !VeilCodingBuild.detectProjectType()) {
      return processed.some(function (f) { return /\.(html|js|jsx|ts|tsx)$/i.test(f.path); });
    }
    return true;
  }

  async function runVerify(processed, round) {
    if (typeof VeilCodingTerminal === 'undefined') {
      if (typeof VeilCodingBuild !== 'undefined') {
        var kind = round >= 3 ? 'cargo-full' : 'auto';
        var br = await VeilCodingBuild.run({ kind: kind });
        if (VeilIDE.logBuildOutput) VeilIDE.logBuildOutput(br);
        return { ok: br.ok || br.skipped, text: br.output || '', results: [br] };
      }
      return { ok: true, text: '', results: [] };
    }

    var fullBuild = round >= 4;
    var suite = await VeilCodingTerminal.verifySuite({
      kind: fullBuild ? 'cargo-full' : 'auto',
      runTests: round >= 2,
      runLint: round >= 1,
      npmTest: round >= 2,
      fullBuild: fullBuild
    });

    if (VeilIDE.logBuildOutput && suite.results) {
      suite.results.forEach(function (r) {
        if (r.command) VeilIDE.logBuildOutput(r);
      });
    }
    return suite;
  }

  function taskComplete(lintAll, verifyResult) {
    if (lintAll.length) return false;
    if (!verifyResult) return true;
    return verifyResult.ok;
  }

  async function resume(taskIdOrOpts, maybeOpts) {
    var opts = {};
    var taskId = '';
    if (taskIdOrOpts && typeof taskIdOrOpts === 'object') {
      opts = taskIdOrOpts;
      taskId = opts.taskId || '';
    } else {
      taskId = taskIdOrOpts || '';
      opts = maybeOpts || {};
    }
    if (typeof VeilCodingTaskMemory === 'undefined') throw new Error('Task memory not loaded');
    var task = taskId
      ? VeilCodingTaskMemory.getTask(taskId)
      : VeilCodingTaskMemory.getActiveTask();
    if (!task) throw new Error('No unfinished task to resume');
    VeilCodingTaskMemory.setActiveTaskId(task.id);
    if (task.activePath && typeof VeilIDE !== 'undefined' && VeilIDE.openFile) {
      try { await VeilIDE.openFile(task.activePath); } catch (e) { /* ignore */ }
    }
    var prompt = VeilCodingTaskMemory.resumePrompt(task);
    return run(prompt, {
      taskId: task.id,
      resume: true,
      originalGoal: task.goal,
      skipUsage: !!opts.skipUsage
    });
  }

  async function run(userText, opts) {
    opts = opts || {};
    if (!_codePanel) throw new Error('Code panel not ready');

    // One subscription API charge per user coding message (online and offline)
    if (!opts.skipUsage && typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.beginCodingMessage) {
      var gate = VeilCodingRouter.beginCodingMessage();
      if (!gate.ok) {
        if (typeof addSystemMessage === 'function') {
          addSystemMessage(gate.message || VeilCodingRouter.usageLimitMessage());
        }
        if (typeof _setCodeStatus === 'function') _setCodeStatus('API limit reached', false);
        return { ok: false, reason: 'limit' };
      }
    }

    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    var whoName = who === 'chad' ? 'Chad' : 'Caelum';
    var soul = who === 'chad' ? (typeof CHAD_IDENTITY !== 'undefined' ? CHAD_IDENTITY : '') : (typeof CAELUM_SOUL !== 'undefined' ? CAELUM_SOUL : '');
    var activePath = (typeof VeilIDE !== 'undefined' && VeilIDE.getActivePath) ? VeilIDE.getActivePath() : '';
    var taskState = null;
    if (typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.startTask) {
      taskState = VeilCodingTaskMemory.startTask(opts.originalGoal || userText, {
        taskId: opts.taskId || '',
        activePath: activePath,
        intent: typeof VeilCodingStrategy !== 'undefined' && VeilCodingStrategy.classifyIntent
          ? VeilCodingStrategy.classifyIntent(opts.originalGoal || userText)
          : ''
      });
      if (opts.resume && taskState) {
        VeilCodingTaskMemory.addDecision(taskState.id, 'Resumed unfinished task from previous session.');
      }
    }

    _setCodeStatus('Exploring repo...', true);
    var exploreCtx = '';
    if (typeof VeilCodingWorkspace !== 'undefined' && VeilCodingWorkspace.deepExplore) {
      try { exploreCtx = await VeilCodingWorkspace.deepExplore(userText); } catch (e) { /* ignore */ }
    }

    _setCodeStatus('Indexing project...', true);
    var maxCtx = (typeof VeilCodingWorkspace !== 'undefined' && VeilCodingWorkspace.CONTEXT_DEFAULT) || 56000;
    var projCtx = '';
    if (typeof VeilCodingWorkspace !== 'undefined') {
      try {
        projCtx = await VeilCodingWorkspace.buildContext(userText, maxCtx);
      } catch (e) { projCtx = VeilIDE.getProjectContext(14000); }
    } else {
      projCtx = VeilIDE.getProjectContext(14000);
    }

    var strategyCtx = '';
    if (typeof VeilCodingStrategy !== 'undefined' && VeilCodingStrategy.buildReasoningPack) {
      try {
        strategyCtx = await VeilCodingStrategy.buildReasoningPack(
          userText,
          (typeof VeilIDE !== 'undefined' && VeilIDE.getActivePath) ? VeilIDE.getActivePath() : ''
        );
      } catch (e) { /* ignore */ }
    }
    if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.setStrategy) {
      VeilCodingTaskMemory.setStrategy(taskState.id, strategyCtx);
    }

    var architectureCtx = '';
    if (typeof VeilCodingArchitect !== 'undefined' && VeilCodingArchitect.shouldUse && VeilCodingArchitect.shouldUse(userText)) {
      try {
        architectureCtx = await VeilCodingArchitect.buildMemo(userText, strategyCtx, exploreCtx, projCtx);
      } catch (e3) { /* ignore */ }
    }
    if (taskState && architectureCtx && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.setArchitecture) {
      VeilCodingTaskMemory.setArchitecture(taskState.id, architectureCtx);
    }

    var notebookCtx = '';
    if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.summarizeForPrompt) {
      notebookCtx = VeilCodingTaskMemory.summarizeForPrompt(taskState.id, 2600);
    }

    _setCodeStatus('Planning...', true);
    var plan = await planTask(
      userText,
      projCtx,
      (exploreCtx + '\n\n' + strategyCtx + '\n\n' + architectureCtx + '\n\n' + notebookCtx).trim(),
      whoName,
      soul
    );
    if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.setPlan) {
      VeilCodingTaskMemory.setPlan(taskState.id, plan);
    }

    var isModification = _isModification(userText);
    var multi = typeof VeilCodingWorkspace !== 'undefined' && VeilCodingWorkspace.needsMultiFile(userText);
    var recentHistory = state.conversationHistory.slice(-12).map(function (m) {
      return (m.role === 'user' ? 'User: ' : whoName + ': ') + (m.content || '').replace(/\[Caelum\]\s*/gi, '').replace(/\[Chad\]\s*/gi, '').substring(0, 280);
    }).join('\n');

    var existingCtx = '';
    if (isModification && _codePanel.code) {
      existingCtx = '\n\nEXISTING CODE (' + _codePanel.filename + '):\n```' + _codePanel.language + '\n' + _codePanel.code + '\n```\nReturn COMPLETE updated file(s).';
    }

    var mode = isModification ? 'diff' : (multi ? 'multifile' : 'generate');
    var sysPrompt = VeilCodingAgent.buildSystemPrompt(whoName, soul, {
      tier: null,
      mode: mode,
      codeContext: existingCtx,
      projectContext: (exploreCtx + '\n\n' + strategyCtx + '\n\n' + architectureCtx + '\n\n' + notebookCtx + '\n\n' + projCtx).slice(0, maxCtx),
      recentChat: recentHistory
    });

    if (plan) sysPrompt += '\n\n## AGENT PLAN (follow exactly)\n' + plan;
    if (strategyCtx) sysPrompt += '\n\n' + strategyCtx;
    if (architectureCtx) sysPrompt += '\n\n' + architectureCtx;
    if (notebookCtx) sysPrompt += '\n\n' + notebookCtx;
    if (multi) {
      sysPrompt += '\n\n## MULTI-FILE\nOne FILENAME block per changed file. Mirrors sync automatically.';
    }

    var processed = [];
    var lintAll = [];
    var verifyResult = null;
    var gitSt = null;
    var roundsUsed = 0;
    var stalled = false;

    for (var round = 0; round < MAX_ROUNDS; round++) {
      roundsUsed = round + 1;
      var userPrompt = round === 0 ? userText : buildFixPrompt(userText, lintAll, verifyResult, processed, gitSt);
      var taskKind = round === 0
        ? (multi ? 'multifile' : (isModification ? 'diff' : 'generate'))
        : 'fix';

      _setCodeStatus(round === 0 ? 'Generating...' : ('Agent round ' + (round + 1) + '/' + MAX_ROUNDS + '...'), true);

      var lastReply = await _codeChat(
        [{ role: 'system', content: sysPrompt }, { role: 'user', content: userPrompt }],
        {
          task: taskKind,
          userText: userPrompt,
          code: _codePanel.code,
          filename: _codePanel.filename,
          temperature: round === 0 ? 0.22 : 0.1,
          max_tokens: 7500
        }
      );

      var files = VeilCodingMultifile.extractFilesFromReply(lastReply);
      if (!files.length) {
        if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.logRound) {
          VeilCodingTaskMemory.logRound(taskState.id, {
            round: round + 1,
            mode: taskKind,
            usedCloud: shouldEscalateToCloud(round, lintAll, verifyResult, true, stalled),
            lintCount: lintAll.length,
            verifyOk: verifyResult ? verifyResult.ok : null,
            verifySummary: verifyResult ? verifyResult.text : 'no files returned',
            files: [],
            summary: 'No files returned'
          });
          stalled = VeilCodingTaskMemory.detectStall(taskState.id);
        }
        if (round < MAX_ROUNDS - 1) continue;
        _setCodeStatus('No code in response.', false);
        if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.markTask) {
          VeilCodingTaskMemory.markTask(taskState.id, 'blocked', 'No code in response');
        }
        return { ok: false, reason: 'empty' };
      }

      _setCodeStatus('Verifying ' + files.length + ' file(s)...', true);
      processed = await postProcessAll(files, userText, whoName, soul, projCtx);
      lintAll = VeilCodingMultifile.lintBundle(processed);

      var primary = processed[0].path;
      if (isModification && _codePanel.filename) {
        var hit = processed.find(function (p) {
          return p.path === _codePanel.filename || p.path.endsWith('/' + _codePanel.filename);
        });
        if (hit) primary = hit.path;
      }

      _setCodeStatus('Writing to disk...', true);
      await VeilCodingMultifile.applyFiles(processed, { primaryPath: primary, mirror: true });

      if (typeof VeilCodingTerminal !== 'undefined') {
        gitSt = await VeilCodingTerminal.gitStatus();
      }

      if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.logRound) {
        VeilCodingTaskMemory.logRound(taskState.id, {
          round: round + 1,
          mode: taskKind,
          usedCloud: shouldEscalateToCloud(round, lintAll, verifyResult, false, stalled),
          lintCount: lintAll.length,
          verifyOk: verifyResult ? verifyResult.ok : null,
          verifySummary: verifyResult ? verifyResult.text : '',
          files: processed.map(function (p) { return p.path; }),
          summary: processed.map(function (p) { return p.path; }).join(', ')
        });
        stalled = VeilCodingTaskMemory.detectStall(taskState.id);
        if (stalled && typeof VeilCodingTaskMemory.addDecision === 'function') {
          VeilCodingTaskMemory.addDecision(taskState.id, 'Detected repeated round output; change approach and escalate if budget allows.');
        }
      }

      if (lintAll.length) {
        verifyResult = null;
        continue;
      }

      if (needsVerify(processed, round)) {
        _setCodeStatus('Running verify suite...', true);
        verifyResult = await runVerify(processed, round);
        if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.logVerify) {
          VeilCodingTaskMemory.logVerify(taskState.id, {
            ok: verifyResult.ok,
            text: verifyResult.text || ''
          });
        }
        if (!verifyResult.ok) continue;
      } else {
        verifyResult = { ok: true, text: '' };
      }

      break;
    }

    var primaryFile = processed[0];
    if (_codePanel && _codePanel.filename && processed.length) {
      primaryFile = processed.find(function (p) {
        return p.path.endsWith('/' + _codePanel.filename) || p.path === _codePanel.filename;
      }) || processed[0];
    }

    _markUnsaved(false);
    if (typeof _updateStatusBar === 'function') _updateStatusBar();

    if (VeilIDE.runLocalLint) VeilIDE.runLocalLint();
    if (primaryFile && /\.html?$/i.test(primaryFile.path) && VeilIDE.runPreview) VeilIDE.runPreview();

    var summary = VeilCodingMultifile.summarize(processed, lintAll);
    if (typeof VeilCodingBudget !== 'undefined') {
      var b = VeilCodingBudget.stats();
      var maxLabel = b.max === Infinity ? '∞' : b.max;
      summary += ' (API ' + b.used + '/' + maxLabel + ' today, shared with chat)';
    }
    if (verifyResult && !verifyResult.ok) {
      summary += ' Verify failed after ' + roundsUsed + ' rounds — see console.';
    } else if (verifyResult && verifyResult.ok) {
      summary += ' Verified (lint + build/test).';
    }

    _setCodeStatus('Done — ' + processed.length + ' file(s), ' + roundsUsed + ' round(s)', false);

    var ok = taskComplete(lintAll, verifyResult);
    var doneMsg = who === 'chad'
      ? (ok ? 'Project task done. ' : 'Paused — progress saved. ') + summary
      : (ok ? 'I finished across your project — ' : 'I saved progress on this task — ') + summary;
    if (!ok) {
      doneMsg += ' Reopen the Code tab later and tap Continue, or ask me to resume.';
    } else if (opts.resume) {
      doneMsg += ' Resumed from a previous session.';
    }
    addMessage(who, doneMsg);
    state.conversationHistory.push({ role: 'assistant', content: '[' + whoName + '] ' + doneMsg });
    prefetchThenShow(who, doneMsg).catch(function () {});

    if (taskState && typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.markTask) {
      VeilCodingTaskMemory.markTask(taskState.id, ok ? 'done' : 'active', summary);
    }
    if (typeof VeilIDE !== 'undefined' && VeilIDE.refreshResumeBanner) {
      VeilIDE.refreshResumeBanner();
    }

    return {
      ok: ok,
      files: processed,
      issues: lintAll,
      verify: verifyResult,
      plan: plan,
      explore: exploreCtx,
      strategy: strategyCtx,
      architecture: architectureCtx,
      notebook: notebookCtx,
      summary: summary,
      roundsUsed: roundsUsed,
      taskId: taskState ? taskState.id : '',
      resumed: !!opts.resume
    };
  }

  window.VeilCodingTask = {
    shouldUse: shouldUse,
    run: run,
    resume: resume,
    hasOpenTasks: function () {
      return typeof VeilCodingTaskMemory !== 'undefined' &&
        VeilCodingTaskMemory.listOpenTasks &&
        VeilCodingTaskMemory.listOpenTasks().length > 0;
    },
    MAX_ROUNDS: MAX_ROUNDS
  };
})();
