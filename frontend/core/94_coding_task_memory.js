// ============================================================
// VEIL CODING TASK MEMORY — persistent notebook for long tasks
// ============================================================
(function () {
  'use strict';

  var STORE = 'veil_coding_task_memory_v1';
  var ACTIVE_STORE = 'veil_coding_active_task_v1';
  var MAX_TASKS_PER_WORKSPACE = 16;
  var MAX_ROUNDS_STORED = 40;
  var STALL_WINDOW = 4;
  var OPEN_STATUSES = { active: 1, blocked: 1 };

  function workspaceKey() {
    if (typeof VeilIDE !== 'undefined' && VeilIDE.getWorkspaceLabel) {
      return VeilIDE.getWorkspaceLabel() || 'global';
    }
    return 'global';
  }

  function readAll() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }

  function writeAll(all) {
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }

  function readActiveMap() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_STORE) || '{}'); } catch (e) { return {}; }
  }

  function writeActiveMap(map) {
    try { localStorage.setItem(ACTIVE_STORE, JSON.stringify(map)); } catch (e) { /* ignore */ }
  }

  function getActiveTaskId() {
    var map = readActiveMap();
    return map[workspaceKey()] || '';
  }

  function setActiveTaskId(taskId) {
    var map = readActiveMap();
    if (taskId) map[workspaceKey()] = taskId;
    else delete map[workspaceKey()];
    writeActiveMap(map);
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return String(Date.now()); }
  }

  function uid() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function similarity(a, b) {
    var ta = tokenize(a);
    var tb = tokenize(b);
    if (!ta.length || !tb.length) return 0;
    var hit = 0;
    ta.forEach(function (w) { if (tb.indexOf(w) >= 0) hit++; });
    return hit / Math.max(ta.length, tb.length);
  }

  function listTasks() {
    var all = readAll();
    return all[workspaceKey()] || [];
  }

  function saveTasks(tasks) {
    var all = readAll();
    all[workspaceKey()] = tasks.slice(0, MAX_TASKS_PER_WORKSPACE);
    writeAll(all);
  }

  function getTask(taskId) {
    var tasks = listTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) return tasks[i];
    }
    return null;
  }

  function putTask(task) {
    var tasks = listTasks();
    var found = false;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === task.id) {
        tasks[i] = task;
        found = true;
        break;
      }
    }
    if (!found) tasks.unshift(task);
    saveTasks(tasks);
    return task;
  }

  function isOpenStatus(status) {
    return !!OPEN_STATUSES[status];
  }

  function listOpenTasks() {
    return listTasks()
      .filter(function (t) { return t && isOpenStatus(t.status); })
      .sort(function (a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      });
  }

  function getActiveTask() {
    var id = getActiveTaskId();
    if (id) {
      var task = getTask(id);
      if (task && isOpenStatus(task.status)) return task;
    }
    var open = listOpenTasks();
    return open.length ? open[0] : null;
  }

  function startTask(goal, meta) {
    meta = meta || {};
    if (meta.taskId) {
      var byId = getTask(meta.taskId);
      if (byId) {
        byId.status = 'active';
        byId.updatedAt = nowIso();
        if (meta.activePath) byId.activePath = meta.activePath;
        if (meta.intent) byId.intent = meta.intent;
        setActiveTaskId(byId.id);
        return putTask(byId);
      }
    }

    var tasks = listTasks();
    var resume = null;
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (!isOpenStatus(t.status)) continue;
      if (similarity(t.goal, goal) >= 0.72) {
        resume = t;
        break;
      }
    }

    if (resume) {
      resume.status = 'active';
      resume.updatedAt = nowIso();
      if (meta.activePath) resume.activePath = meta.activePath;
      if (meta.intent) resume.intent = meta.intent;
      resume.resumedAt = nowIso();
      resume.resumeCount = (resume.resumeCount || 0) + 1;
      setActiveTaskId(resume.id);
      return putTask(resume);
    }

    var created = putTask({
      id: uid(),
      goal: String(goal || '').slice(0, 800),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      resumedAt: '',
      resumeCount: 0,
      status: 'active',
      activePath: meta.activePath || '',
      intent: meta.intent || '',
      plan: '',
      strategy: '',
      architecture: '',
      notes: [],
      decisions: [],
      files: [],
      rounds: [],
      verify: []
    });
    setActiveTaskId(created.id);
    return created;
  }

  function resumePrompt(taskOrId) {
    var task = typeof taskOrId === 'string' ? getTask(taskOrId) : taskOrId;
    if (!task) return '';
    var lines = [];
    lines.push('RESUME unfinished coding task from previous session.');
    lines.push('Original goal: ' + task.goal);
    lines.push('Do not restart from zero. Continue from the notebook below.');
    lines.push('Fix remaining issues, finish incomplete work, and verify.');
    if (task.activePath) lines.push('Last active file: ' + task.activePath);
    if (task.files && task.files.length) lines.push('Files already touched: ' + task.files.slice(-12).join(', '));
    if (task.verify && task.verify.length) {
      var last = task.verify[task.verify.length - 1];
      lines.push('Last verify: ' + (last.ok ? 'ok' : 'failed') + ' — ' + String(last.summary || '').slice(0, 400));
    }
    lines.push(summarizeForPrompt(task, 2200));
    return lines.join('\n');
  }

  function abandonTask(taskId) {
    var task = markTask(taskId, 'abandoned', 'Abandoned by user');
    if (getActiveTaskId() === taskId) setActiveTaskId('');
    return task;
  }

  function abandonAllOpen() {
    listOpenTasks().forEach(function (t) { abandonTask(t.id); });
    setActiveTaskId('');
  }

  function formatTaskLabel(task) {
    if (!task) return '';
    var goal = String(task.goal || '').replace(/\s+/g, ' ').trim();
    if (goal.length > 72) goal = goal.slice(0, 69) + '…';
    var rounds = (task.rounds && task.rounds.length) || 0;
    var status = task.status || 'active';
    return goal + ' (' + status + ', ' + rounds + ' round' + (rounds === 1 ? '' : 's') + ')';
  }

  function addNote(taskId, note) {
    var task = getTask(taskId);
    if (!task || !note) return null;
    task.notes.unshift(String(note).slice(0, 800));
    task.notes = task.notes.slice(0, 20);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function setPlan(taskId, plan) {
    var task = getTask(taskId);
    if (!task) return null;
    task.plan = String(plan || '').slice(0, 3000);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function setStrategy(taskId, strategy) {
    var task = getTask(taskId);
    if (!task) return null;
    task.strategy = String(strategy || '').slice(0, 4000);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function setArchitecture(taskId, architecture) {
    var task = getTask(taskId);
    if (!task) return null;
    task.architecture = String(architecture || '').slice(0, 4000);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function logRound(taskId, roundInfo) {
    var task = getTask(taskId);
    if (!task || !roundInfo) return null;
    var round = {
      at: nowIso(),
      round: roundInfo.round || 0,
      mode: roundInfo.mode || '',
      usedCloud: !!roundInfo.usedCloud,
      lintCount: roundInfo.lintCount || 0,
      verifyOk: roundInfo.verifyOk == null ? null : !!roundInfo.verifyOk,
      verifySummary: String(roundInfo.verifySummary || '').slice(0, 1200),
      files: (roundInfo.files || []).slice(0, 20),
      summary: String(roundInfo.summary || '').slice(0, 1200),
      signature: JSON.stringify({
        files: (roundInfo.files || []).slice(0, 10),
        lintCount: roundInfo.lintCount || 0,
        verifySummary: String(roundInfo.verifySummary || '').slice(0, 180)
      })
    };
    task.rounds.push(round);
    if (task.rounds.length > MAX_ROUNDS_STORED) task.rounds = task.rounds.slice(-MAX_ROUNDS_STORED);
    task.files = uniqueStrings(task.files.concat(round.files)).slice(-40);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function logVerify(taskId, verifyInfo) {
    var task = getTask(taskId);
    if (!task || !verifyInfo) return null;
    task.verify.push({
      at: nowIso(),
      ok: !!verifyInfo.ok,
      summary: String(verifyInfo.summary || verifyInfo.text || '').slice(0, 1600)
    });
    task.verify = task.verify.slice(-12);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function addDecision(taskId, decision) {
    var task = getTask(taskId);
    if (!task || !decision) return null;
    task.decisions.unshift(String(decision).slice(0, 800));
    task.decisions = task.decisions.slice(0, 20);
    task.updatedAt = nowIso();
    return putTask(task);
  }

  function detectStall(taskId) {
    var task = typeof taskId === 'string' ? getTask(taskId) : taskId;
    if (!task || !task.rounds || task.rounds.length < STALL_WINDOW) return false;
    var recent = task.rounds.slice(-STALL_WINDOW);
    var first = recent[0].signature;
    if (!first) return false;
    for (var i = 1; i < recent.length; i++) {
      if (recent[i].signature !== first) return false;
    }
    return true;
  }

  function summarizeForPrompt(taskId, maxChars) {
    maxChars = maxChars || 2600;
    var task = typeof taskId === 'string' ? getTask(taskId) : taskId;
    if (!task) return '';
    var lines = [];
    lines.push('## TASK NOTEBOOK');
    lines.push('Goal: ' + task.goal);
    if (task.intent) lines.push('Intent: ' + task.intent);
    if (task.files && task.files.length) lines.push('Files touched so far: ' + task.files.slice(-12).join(', '));
    if (task.plan) lines.push('Plan:\n' + task.plan.slice(0, 900));
    if (task.architecture) lines.push('Architecture notes:\n' + task.architecture.slice(0, 900));
    if (task.decisions && task.decisions.length) {
      lines.push('Recent decisions:');
      task.decisions.slice(0, 6).forEach(function (d) { lines.push('- ' + d); });
    }
    if (task.verify && task.verify.length) {
      var lastVerify = task.verify[task.verify.length - 1];
      lines.push('Last verify: ' + (lastVerify.ok ? 'ok' : 'failed') + ' — ' + lastVerify.summary.slice(0, 400));
    }
    if (task.rounds && task.rounds.length) {
      lines.push('Recent rounds:');
      task.rounds.slice(-4).forEach(function (r) {
        lines.push('- round ' + r.round + ': ' + (r.files || []).join(', ') + ' | lint=' + r.lintCount + ' | verify=' + (r.verifyOk == null ? 'n/a' : r.verifyOk));
      });
    }
    if (detectStall(task)) lines.push('Stall detected: last rounds are repeating. Change approach.');
    return lines.join('\n').slice(0, maxChars);
  }

  function markTask(taskId, status, summary) {
    var task = getTask(taskId);
    if (!task) return null;
    task.status = status || task.status;
    if (summary) {
      task.decisions.unshift('Outcome: ' + String(summary).slice(0, 800));
      task.decisions = task.decisions.slice(0, 20);
    }
    task.updatedAt = nowIso();
    putTask(task);
    if (!isOpenStatus(task.status) && getActiveTaskId() === taskId) {
      setActiveTaskId('');
    } else if (isOpenStatus(task.status)) {
      setActiveTaskId(taskId);
    }
    return task;
  }

  function clearWorkspace() {
    var all = readAll();
    delete all[workspaceKey()];
    writeAll(all);
    var map = readActiveMap();
    delete map[workspaceKey()];
    writeActiveMap(map);
  }

  function uniqueStrings(list) {
    var seen = {};
    return (list || []).filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = 1;
      return true;
    });
  }

  window.VeilCodingTaskMemory = {
    startTask: startTask,
    getTask: getTask,
    getActiveTask: getActiveTask,
    getActiveTaskId: getActiveTaskId,
    setActiveTaskId: setActiveTaskId,
    listOpenTasks: listOpenTasks,
    listTasks: listTasks,
    resumePrompt: resumePrompt,
    abandonTask: abandonTask,
    abandonAllOpen: abandonAllOpen,
    formatTaskLabel: formatTaskLabel,
    setPlan: setPlan,
    setStrategy: setStrategy,
    setArchitecture: setArchitecture,
    addNote: addNote,
    addDecision: addDecision,
    logRound: logRound,
    logVerify: logVerify,
    detectStall: detectStall,
    summarizeForPrompt: summarizeForPrompt,
    markTask: markTask,
    clearWorkspace: clearWorkspace
  };
})();
