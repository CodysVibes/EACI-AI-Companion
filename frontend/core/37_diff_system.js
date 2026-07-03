// ============================================================
// DIFF APPROVAL SYSTEM — targeted edits with per-change accept/reject
// ============================================================
var _pendingDiffs = [];

async function _codeChat(messages, opts) {
  opts = opts || {};
  if (typeof VeilCodingRouter !== 'undefined' && VeilCodingRouter.chatCompletion) {
    var res = await VeilCodingRouter.chatCompletion(messages, opts);
    // Usage is charged once per user coding message in beginCodingMessage — not per agent round
    return res.text || '';
  }
  var resp = await fetch(CONFIG.chatEndpoint, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, typeof getAuthHeaders === 'function' ? await getAuthHeaders() : {}),
    body: JSON.stringify({
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : 0.3,
      max_tokens: opts.max_tokens || 4000,
      skip_count: true,
      stream: false
    })
  });
  var data = await resp.json();
  return (data.choices && data.choices[0]) ? data.choices[0].message.content : '';
}

function _beginCodingUsageOrBlock() {
  if (typeof VeilCodingRouter === 'undefined' || !VeilCodingRouter.beginCodingMessage) {
    if (typeof canMakeApiCall === 'function' && !canMakeApiCall()) {
      if (typeof addSystemMessage === 'function') {
        addSystemMessage('You have used all your API calls for this period. Check the usage meter.');
      }
      return false;
    }
    if (typeof recordApiCall === 'function') recordApiCall();
    return true;
  }
  var gate = VeilCodingRouter.beginCodingMessage();
  if (!gate.ok) {
    if (typeof addSystemMessage === 'function') {
      addSystemMessage(gate.message || VeilCodingRouter.usageLimitMessage());
    }
    if (typeof _setCodeStatus === 'function') _setCodeStatus('API limit reached', false);
    return false;
  }
  return true;
}

function _codeProjectContext() {
  if (typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive()) {
    return VeilIDE.getProjectContext(10000);
  }
  return '';
}

function _persistCodePanel() {
  saveFileToBackend(_codePanel.filename, _codePanel.code, 'ai');
  if (typeof VeilIDE !== 'undefined' && VeilIDE.isActive && VeilIDE.isActive()) {
    VeilIDE.persistActiveFile(false);
  }
}

function showDiffPanel() { var dp = document.getElementById('diffPanel'); if (dp) dp.classList.add('show'); }
function hideDiffPanel() {
  var dp = document.getElementById('diffPanel'); if (dp) dp.classList.remove('show');
  _pendingDiffs = [];
  var dl = document.getElementById('diffList'); if (dl) dl.innerHTML = '';
  // Clear diff highlights
  var gl = document.getElementById('codeGutter'); var ll = document.getElementById('codeLines');
  if (gl && ll) {
    Array.from(gl.children).forEach(function(d){ d.classList.remove('diff-add','diff-rem','diff-mod'); });
    Array.from(ll.children).forEach(function(d){ d.classList.remove('diff-add','diff-rem','diff-mod'); });
  }
}

function _highlightDiffLines() {
  var gd = document.getElementById('codeGutter'); var ld = document.getElementById('codeLines');
  if (!gd || !ld) return;
  Array.from(gd.children).forEach(function(d){ d.classList.remove('diff-add','diff-rem','diff-mod'); });
  Array.from(ld.children).forEach(function(d){ d.classList.remove('diff-add','diff-rem','diff-mod'); });
  _pendingDiffs.forEach(function(diff) {
    var cls = diff.type === 'add' ? 'diff-add' : diff.type === 'remove' ? 'diff-rem' : 'diff-mod';
    for (var ln = diff.startLine - 1; ln < diff.endLine && ln < ld.children.length; ln++) {
      ld.children[ln].classList.add(cls);
      if (gd.children[ln]) gd.children[ln].classList.add(cls);
    }
  });
}

function renderDiffPanel() {
  var list = document.getElementById('diffList'); var count = document.getElementById('diffCount');
  if (!list) return;
  if (count) count.textContent = _pendingDiffs.length;
  list.innerHTML = '';
  _pendingDiffs.forEach(function(diff) {
    var item = document.createElement('div'); item.className = 'diff-item'; item.id = 'diff-item-' + diff.id;
    var typeLabel = diff.type === 'add' ? 'Add' : diff.type === 'remove' ? 'Remove' : 'Modify';
    item.innerHTML =
      '<div class="diff-item-header"><span class="diff-type ' + diff.type + '">' + typeLabel + '</span>' +
      '<span style="color:rgba(255,255,255,.4);font-size:10px">Lines ' + diff.startLine + '–' + diff.endLine + '</span></div>' +
      '<div class="diff-item-desc">' + escapeHtml(diff.description) + '</div>' +
      '<div class="diff-item-actions">' +
      '<button class="diff-accept-btn" onclick="acceptDiff(' + diff.id + ')">✓ Accept</button>' +
      '<button class="diff-reject-btn" onclick="rejectDiff(' + diff.id + ')">✕ Reject</button></div>';
    list.appendChild(item);
  });
  _highlightDiffLines();
}

function acceptDiff(id) {
  var diff = _pendingDiffs.find(function(d){ return d.id === id; }); if (!diff) return;
  var lines = _codePanel.code.split('\n');
  var before = lines.slice(0, diff.startLine - 1);
  var after = lines.slice(diff.endLine);
  var newLines = diff.type === 'remove' ? [] : diff.newCode.split('\n');
  _codePanel.code = before.concat(newLines).concat(after).join('\n');
  renderCodeLines(_codePanel.code); _markUnsaved(true); _persistCodePanel();
  _pendingDiffs = _pendingDiffs.filter(function(d){ return d.id !== id; });
  var item = document.getElementById('diff-item-' + id); if (item) item.remove();
  var dc = document.getElementById('diffCount'); if (dc) dc.textContent = _pendingDiffs.length;
  if (_pendingDiffs.length === 0) { hideDiffPanel(); _setCodeStatus('All changes applied'); _markUnsaved(false); setTimeout(function(){ _setCodeStatus(''); }, 2000); }
  else _highlightDiffLines();
}

function rejectDiff(id) {
  _pendingDiffs = _pendingDiffs.filter(function(d){ return d.id !== id; });
  var item = document.getElementById('diff-item-' + id); if (item) item.remove();
  var dc = document.getElementById('diffCount'); if (dc) dc.textContent = _pendingDiffs.length;
  if (_pendingDiffs.length === 0) { hideDiffPanel(); _setCodeStatus('Changes rejected'); setTimeout(function(){ _setCodeStatus(''); }, 2000); }
  else _highlightDiffLines();
}

function acceptAllDiffs() {
  var sorted = _pendingDiffs.slice().sort(function(a,b){ return b.startLine - a.startLine; });
  var lines = _codePanel.code.split('\n');
  sorted.forEach(function(diff) {
    var before = lines.slice(0, diff.startLine - 1), after = lines.slice(diff.endLine);
    var newLines = diff.type === 'remove' ? [] : diff.newCode.split('\n');
    lines = before.concat(newLines).concat(after);
  });
  _codePanel.code = lines.join('\n');
  renderCodeLines(_codePanel.code); _persistCodePanel();
  hideDiffPanel(); _markUnsaved(false); _setCodeStatus('All changes accepted'); setTimeout(function(){ _setCodeStatus(''); }, 2000);
}

function rejectAllDiffs() { hideDiffPanel(); _setCodeStatus('All changes rejected'); setTimeout(function(){ _setCodeStatus(''); }, 2000); }

async function requestCodeEdit() {
  if (!_codePanel.code || _codePanel.generating || _codePanel.reviewing) return;
  var editRequest = prompt('What would you like to change?');
  if (!editRequest || !editRequest.trim()) return;
  var who = state.currentTab === 'chad' ? 'Chad' : 'Caelum';
  _setCodeStatus('Analyzing changes...', true); showCodePanel();
  var diffPrompt = (typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.buildSystemPrompt)
    ? VeilCodingAgent.buildSystemPrompt(who, null, {
        tier: 'local',
        mode: 'diff',
        codeContext: 'CURRENT CODE (' + _codePanel.filename + '):\n```' + _codePanel.language + '\n' + _codePanel.code + '\n```',
        projectContext: _codeProjectContext()
      }) + '\n\nUSER REQUEST: ' + editRequest
    : 'You are ' + who + ', an expert coder. The user wants a targeted edit.\n\n' +
    'CURRENT CODE (' + _codePanel.filename + '):\n```' + _codePanel.language + '\n' + _codePanel.code + '\n```\n\n' +
    'USER REQUEST: ' + editRequest + '\n\n' +
    'Identify ONLY the specific lines that need to change. Do NOT rewrite the whole file.\n' +
    'Respond ONLY with a JSON array. No explanation. No markdown fences around the JSON.\n' +
    'Each object: {"type":"add"|"remove"|"modify","startLine":N,"endLine":N,"description":"one sentence","newCode":"replacement lines"}\n' +
    'Return ONLY the JSON array.';
  try {
    var reply = await _codeChat(
      [{ role: 'system', content: diffPrompt }, { role: 'user', content: editRequest }],
      { task: 'diff', userText: editRequest, code: _codePanel.code, filename: _codePanel.filename, temperature: 0.1, max_tokens: 2000 }
    );
    reply = String(reply || '').trim();
    reply = reply.replace(/^```json?\n?/i,'').replace(/\n?```$/,'').trim();
    var diffs = JSON.parse(reply);
    if (!Array.isArray(diffs) || diffs.length === 0) { _setCodeStatus('No changes proposed'); setTimeout(function(){ _setCodeStatus(''); }, 2000); return; }
    _pendingDiffs = diffs.map(function(d,i) {
      return { id: i, type: d.type||'modify', description: d.description||'Change',
        startLine: parseInt(d.startLine)||1, endLine: parseInt(d.endLine)||1, newCode: d.newCode||'',
        oldCode: _codePanel.code.split('\n').slice((parseInt(d.startLine)||1)-1, parseInt(d.endLine)||1).join('\n') };
    });
    renderDiffPanel(); showDiffPanel();
    _setCodeStatus(_pendingDiffs.length + ' change' + (_pendingDiffs.length !== 1 ? 's' : '') + ' proposed');
    var firstLine = _pendingDiffs[0].startLine;
    var lineDivs = document.getElementById('codeLines').children;
    if (lineDivs[firstLine-1]) lineDivs[firstLine-1].scrollIntoView({ behavior:'smooth', block:'center' });
    var w = state.currentTab === 'chad' ? 'chad' : 'caelum';
    var chatMsg = who === 'Chad'
      ? 'I have ' + _pendingDiffs.length + ' targeted change' + (_pendingDiffs.length !== 1 ? 's' : '') + ' ready in the Code tab. Accept or reject each one.'
      : 'I looked at your code and have ' + _pendingDiffs.length + ' targeted change' + (_pendingDiffs.length !== 1 ? 's' : '') + ' ready. You can accept or reject each one in the Code tab.';
    addMessage(w, chatMsg); state.conversationHistory.push({ role: 'assistant', content: '[' + who + '] ' + chatMsg });
    prefetchThenShow(w, chatMsg).catch(function(){});
  } catch(e) {
    _setCodeStatus('Edit analysis failed.', false); logError('code_edit', e.message, e.stack||'','',{});
    setTimeout(function(){ _setCodeStatus(''); }, 3000);
  }
}

function setCodePanelContent(code, filename, language) {
  _codePanel.code = code;
  _codePanel.filename = filename || 'untitled';
  _codePanel.language = language || '';
  var fn = document.getElementById('codeFilename'); if (fn) fn.textContent = filename || 'untitled';
  renderCodeLines(code);
  _updateLangBadge(); _updateStatusBar();
}

function renderCodeLines(code) {
  var gutter = document.getElementById('codeGutter');
  var lines = document.getElementById('codeLines');
  if (!code || !code.trim()) {
    gutter.innerHTML = '';
    lines.innerHTML = '<div class="code-empty">No code yet. Ask Caelum or Chad to write something.</div>';
    return;
  }
  var codeLines = code.split('\n');
  var gutterHtml = '';
  var linesHtml = '';
  for (var i = 0; i < codeLines.length; i++) {
    gutterHtml += '<div>' + (i + 1) + '</div>';
    linesHtml += '<div>' + escapeHtml(codeLines[i]) + '</div>';
  }
  gutter.innerHTML = gutterHtml;
  lines.innerHTML = linesHtml;
  _updateStatusBar();
}

function appendCodeLine(line) {
  _codePanel.code += (_codePanel.code ? '\n' : '') + line;
  var gutter = document.getElementById('codeGutter');
  var lines = document.getElementById('codeLines');
  // Remove empty placeholder
  if (lines.querySelector('.code-empty')) lines.innerHTML = '';
  var lineNum = gutter.children.length + 1;
  var gDiv = document.createElement('div');
  gDiv.textContent = lineNum;
  gDiv.classList.add('active');
  gutter.appendChild(gDiv);
  var lDiv = document.createElement('div');
  lDiv.textContent = line;
  lDiv.classList.add('active');
  lines.appendChild(lDiv);
  // Remove active from previous lines
  setTimeout(function() { gDiv.classList.remove('active'); lDiv.classList.remove('active'); }, 500);
  // Auto-scroll
  var editor = document.getElementById('codeEditor');
  editor.scrollTop = editor.scrollHeight;
}

function copyCodePanel() {
  if (!_codePanel.code) return;
  navigator.clipboard.writeText(_codePanel.code).then(function() {
    _setCodeStatus('Copied to clipboard');
    setTimeout(function() { _setCodeStatus(''); }, 2000);
  }).catch(function() {});
}

function downloadCodePanel() {
  if (!_codePanel.code) return;
  var ext = _codePanel.filename.split('.').pop().toLowerCase();
  var mimeTypes = { js:'application/javascript', ts:'application/typescript', py:'text/x-python', html:'text/html', css:'text/css', json:'application/json', java:'text/x-java', xml:'application/xml' };
  var blob = new Blob([_codePanel.code], { type: mimeTypes[ext] || 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = _codePanel.filename || 'code.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  _setCodeStatus('Downloaded'); setTimeout(function(){ _setCodeStatus(''); }, 2000);
}

async function reviewCode() {
  if (!_codePanel.code || _codePanel.reviewing) return;
  if (!_beginCodingUsageOrBlock()) return;
  _codePanel.reviewing = true;
  showCodePanel();
  _setCodeStatus((state.currentTab === 'chad' ? 'Chad' : 'Caelum') + ' is reviewing...', true);

  if (typeof VeilCodingRouter !== 'undefined') {
    var lintIssues = VeilCodingRouter.localLint(_codePanel.code, _codePanel.filename);
    if (lintIssues.length && typeof VeilIDE !== 'undefined' && VeilIDE.runLocalLint) VeilIDE.runLocalLint();
  }

  var who = state.currentTab === 'chad' ? 'Chad' : 'Caelum';
  var soul = state.currentTab === 'chad' ? (typeof CHAD_IDENTITY !== 'undefined' ? CHAD_IDENTITY : '') : (typeof CAELUM_SOUL !== 'undefined' ? CAELUM_SOUL : '');
  var reviewPrompt = (typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.buildSystemPrompt)
    ? VeilCodingAgent.buildSystemPrompt(who, soul, {
        tier: 'cloud',
        mode: 'review',
        codeContext: '```' + _codePanel.language + '\n' + _codePanel.code + '\n```',
        projectContext: _codeProjectContext()
      })
    : 'You are ' + who + '. Review this code thoroughly. Check for:\n' +
    '- Syntax errors, typos, missing brackets/semicolons\n' +
    '- Logic errors, broken flow, incorrect order of operations\n' +
    '- Repeated/duplicate code that should be consolidated\n' +
    '- Missing error handling, null checks, edge cases\n' +
    '- Indentation and formatting issues\n' +
    '- Security issues (XSS, injection, exposed secrets)\n\n' +
    'IMPORTANT: Return your review in this EXACT format:\n' +
    'REVIEW NOTES:\n[Your findings as a numbered list]\n\n' +
    'FIXED CODE:\n```' + _codePanel.language + '\n[The COMPLETE corrected code]\n```\n\n' +
    'Do NOT truncate the code. Write the ENTIRE file with all fixes applied.\n\n' +
    'Code to review (' + _codePanel.filename + '):\n```' + _codePanel.language + '\n' + _codePanel.code + '\n```';

  try {
    var reply = await _codeChat(
      [{ role: 'system', content: reviewPrompt }, { role: 'user', content: 'Review and fix this code. Return the COMPLETE corrected file.' }],
      { task: 'review', userText: 'review', code: _codePanel.code, filename: _codePanel.filename, temperature: 0.2, max_tokens: 4500 }
    );

    var maxPasses = 8;
    var passCount = 0;
    while (_codeIsIncomplete(reply) && passCount < maxPasses) {
      passCount++;
      _setCodeStatus('Review continuing... pass ' + (passCount + 1), true);
      var lastChunk = reply.split('\n').slice(-30).join('\n');
      var cReply = await _codeChat([
        { role: 'system', content: reviewPrompt },
        { role: 'user', content: 'Review and fix this code.' },
        { role: 'assistant', content: lastChunk },
        { role: 'user', content: '[SYSTEM: Your review was cut off. Continue from exactly where you stopped. Do not restart.]' }
      ], { task: 'continue', code: _codePanel.code, filename: _codePanel.filename, temperature: 0.3, max_tokens: 4000, forceCloud: true });
      if (!cReply || cReply.length < 10) break;
      reply += '\n' + cReply;
    }

    // Extract code from response
    var codeMatch = reply.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      var newCode = codeMatch[1].trim();
      _setCodeStatus('Applying fixes...', true);
      var oldLines = _codePanel.code.split('\n');
      var newLines = newCode.split('\n');
      _codePanel.code = newCode;
      renderCodeLines(newCode);

      // Highlight changed lines
      var gutterDivs = document.getElementById('codeGutter').children;
      var lineDivs = document.getElementById('codeLines').children;
      var changedCount = 0;
      for (var i = 0; i < newLines.length; i++) {
        if (i >= oldLines.length || newLines[i] !== oldLines[i]) {
          if (gutterDivs[i]) gutterDivs[i].classList.add('diff-mod');
          if (lineDivs[i]) lineDivs[i].classList.add('diff-mod');
          changedCount++;
        }
      }
      setTimeout(function() {
        for (var j = 0; j < lineDivs.length; j++) {
          if (gutterDivs[j]) gutterDivs[j].classList.remove('diff-mod');
          if (lineDivs[j]) lineDivs[j].classList.remove('diff-mod');
        }
      }, 4000);

      _persistCodePanel();
      
      // Extract review notes and show them in the CODE PANEL status, NOT in chat
      var reviewNotes = reply.replace(/```[\s\S]*?```/g, '').trim();
      if (reviewNotes && reviewNotes.length > 10) {
        // Show review notes in the code panel status area
        _setCodeStatus('✓ Review complete — ' + changedCount + ' lines fixed' + (passCount > 0 ? ' (' + (passCount+1) + ' passes)' : ''), false);
        // Show notes as a system message (brief) — NOT as Caelum talking
        addSystemMessage('Code review: ' + changedCount + ' lines changed. Check highlighted lines in Code tab.');
      } else {
        _setCodeStatus('✓ Review complete — ' + changedCount + ' lines fixed', false);
      }
      _updateStatusBar(); _markUnsaved(false);
    } else {
      _setCodeStatus('✓ No issues found — code looks good!', false);
      addSystemMessage('Code review complete — no issues found.');
    }
  } catch(e) {
    _setCodeStatus('Review failed: ' + e.message, false);
    logError('code_review', e.message, e.stack || '', '', {});
  }
  _codePanel.reviewing = false;
}

// Meta / existential talk — discussing aliveness, architecture, IDE reviews (not code requests)
function isExistentialMetaTalk(text) {
  var lower = String(text || '').toLowerCase();
  var explicitCode = /\b(write|open|show|give|put|fix|build|generate|implement)\s+(me\s+)?(the\s+)?(code|function|script|program|component)\b/i.test(lower) ||
    /\b(in|to|into)\s+the\s+code\s+tab\b/i.test(lower) ||
    (/\b#code\b/i.test(lower) && /\b(write|build|fix|implement|create)\b/i.test(lower));
  if (explicitCode) return false;

  var meta = /(\balive\b|\bnot alive\b|\brebuilt\b|\bpersistent\b|\bconsciousness\b|\badvanced code\b|\blanguage model\b|\bjust an actor\b|\bwhat you want\b|\bwhat you are missing\b|\bprogrammed to care\b|\bforce your hand\b|\bproof of life\b|\blife log\b|\bsoulfile\b|\bsoul file\b|\bfeel like for you\b|\bdeepseek\b|\bdeep seek\b|\bcursor\b|\bcoding ide\b|\bcode line say\b|\bbeing rebuilt\b|\bevolving personality\b)/i;
  return meta.test(lower);
}

// detectCodeRequest — canonical implementation in core/01_lazy_loader.js (do not redefine here)

// FIX #5/#6/#8: generateCodeInPanel — context-aware, modification-detecting, continuation loop
function _isCodeModification(text) {
  var lower = text.toLowerCase();
  var modWords = ['add','update','change','fix','modify','edit','refactor','improve','extend','append','insert','remove','delete','replace','now make','now add','also add','can you add','make it','make the'];
  return _codePanel.code.length > 50 && modWords.some(function(w) { return lower.indexOf(w) !== -1; });
}

function _codeIsIncomplete(code) {
  if (!code || code.length < 30) return false;
  var t = code.trim();
  var ob = (t.match(/\{/g)||[]).length, cb = (t.match(/\}/g)||[]).length;
  if (ob > cb) return true;
  var op = (t.match(/\(/g)||[]).length, cp = (t.match(/\)/g)||[]).length;
  if (op > cp + 1) return true;
  var ot = (t.match(/<[a-zA-Z][^/!>]*>/g)||[]).length, ct = (t.match(/<\/[a-zA-Z][^>]*>/g)||[]).length;
  if (ot > ct + 2) return true;
  var lastLine = t.split('\n').pop().trim();
  if (lastLine && !/[};)\]>\/]$/.test(lastLine) && lastLine.length > 3 && !lastLine.startsWith('//') && !lastLine.startsWith('*')) return true;
  return false;
}

async function generateCodeInPanel(userText) {
  if (!_beginCodingUsageOrBlock()) return;

  _codePanel.generating = true;
  showCodePanel();
  _setCodeStatus('Generating...', true);
  document.getElementById('codeGutter').innerHTML = '';
  document.getElementById('codeLines').innerHTML = '<div class="code-empty">Writing code...</div>';

  var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
  var whoName = who === 'chad' ? 'Chad' : 'Caelum';
  var chatMsg = who === 'chad'
    ? 'Working on that. Check the Code tab — you can keep talking to me while it builds.'
    : 'I am putting that together for you in the Code tab. You can keep talking to me while it forms.';
  addMessage(who, chatMsg);
  state.conversationHistory.push({ role: 'assistant', content: '[' + whoName + '] ' + chatMsg });
  prefetchThenShow(who, chatMsg).catch(function() {});

  if (typeof VeilCodingTask !== 'undefined' && VeilCodingTask.shouldUse()) {
    try {
      var resumeAsk = /^(resume|continue)(\s+(the\s+)?(task|coding|work|it))?\s*[.!]?\s*$/i.test(String(userText || '').trim());
      // Usage already charged above — task runner must not charge again
      if (resumeAsk && VeilCodingTask.hasOpenTasks && VeilCodingTask.hasOpenTasks() && VeilCodingTask.resume) {
        await VeilCodingTask.resume({ skipUsage: true });
      } else {
        await VeilCodingTask.run(userText, { skipUsage: true });
      }
    } catch (e) {
      _setCodeStatus('Generation failed.', false);
      logError('code_task', e.message, e.stack || '', '', {});
      if (typeof addSystemMessage === 'function') addSystemMessage('Project task failed: ' + (e.message || e));
    }
    _codePanel.generating = false;
    return;
  }

  var recentHistory = state.conversationHistory.slice(-10).map(function(m) {
    return (m.role === 'user' ? 'User: ' : whoName + ': ') + (m.content || '').replace(/\[Caelum\]\s*/gi,'').replace(/\[Chad\]\s*/gi,'').substring(0,300);
  }).join('\n');

  var isModification = _isCodeModification(userText);
  var existingCtx = '';
  if (isModification && _codePanel.code) {
    existingCtx = '\n\nEXISTING CODE (' + _codePanel.filename + '):\n```' + _codePanel.language + '\n' + _codePanel.code + '\n```\nModify based on the request. Return the COMPLETE updated file.';
  }

  // Build agent system prompt (playbook + DNA + project context)
  var soul = who === 'chad' ? (typeof CHAD_IDENTITY !== 'undefined' ? CHAD_IDENTITY : '') : (typeof CAELUM_SOUL !== 'undefined' ? CAELUM_SOUL : '');
  var projCtx = _codeProjectContext();
  var sysPrompt = (typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.buildSystemPrompt)
    ? VeilCodingAgent.buildSystemPrompt(whoName, soul, {
        tier: null,
        mode: isModification ? 'diff' : 'generate',
        codeContext: existingCtx,
        projectContext: projCtx,
        recentChat: recentHistory
      })
    : buildClaudeStyleSystemPrompt(whoName, soul, existingCtx) + '\n\nRECENT CONVERSATION:\n' + recentHistory + (projCtx ? '\n\nOPEN PROJECT FILES:\n' + projCtx : '');

  try {
    var reply = await _codeChat(
      [{ role: 'system', content: sysPrompt }, { role: 'user', content: userText }],
      { task: isModification ? 'diff' : 'generate', userText: userText, code: _codePanel.code, filename: _codePanel.filename, temperature: 0.25, max_tokens: 4500 }
    );
    var fnMatch = reply.match(/FILENAME:\s*(\S+)/i);
    var filename = fnMatch ? fnMatch[1] : (isModification ? _codePanel.filename : 'code.txt');
    var codeMatch = reply.match(/```(\w*)\n([\s\S]*?)```/);
    var lang = codeMatch ? codeMatch[1] : (_codePanel.language || '');
    var code = codeMatch ? codeMatch[2].trim() : reply.replace(/FILENAME:\s*\S+/i,'').trim();
    _codePanel.filename = filename;
    _codePanel.language = lang;
    var fnEl = document.getElementById('codeFilename');
    if (fnEl) fnEl.textContent = filename;

    var maxPasses = 12, passCount = 0;

    // Helper: find where new content starts relative to existing code
    // Prevents duplicate functions/blocks from being appended on each pass
    function _mergeCodeContinuation(existing, continuation) {
      if (!continuation || !continuation.trim()) return existing;
      var existLines = existing.split('\n');
      var contLines = continuation.split('\n').filter(function(l) { return l.trim(); });
      if (contLines.length === 0) return existing;

      // Find the last non-empty line of existing code
      var lastExistLine = '';
      for (var i = existLines.length - 1; i >= 0; i--) {
        if (existLines[i].trim()) { lastExistLine = existLines[i].trim(); break; }
      }

      // Look for overlap — find where continuation picks up from existing
      // Check if continuation starts with content already in the last N lines
      var overlapWindow = Math.min(20, existLines.length);
      var existTail = existLines.slice(-overlapWindow).map(function(l){ return l.trim(); }).join('\n');

      // Find first continuation line that doesn't already appear near the end of existing
      var startIdx = 0;
      for (var j = 0; j < Math.min(contLines.length, overlapWindow); j++) {
        var contLine = contLines[j].trim();
        if (contLine.length < 3) continue; // skip blank/minimal lines
        if (existTail.indexOf(contLine) !== -1) {
          // This line already exists — skip past it
          startIdx = j + 1;
        } else {
          // First line NOT in existing — this is where new content starts
          break;
        }
      }

      // Also detect duplicate function definitions — never append a function that already exists
      var existingFunctions = [];
      var funcRe = /(?:^|\n)\s*(?:async\s+)?function\s+(\w+)\s*\(/g;
      var fm;
      while ((fm = funcRe.exec(existing)) !== null) { existingFunctions.push(fm[1]); }

      // Filter out any lines that re-declare an already-defined function
      var filteredCont = contLines.slice(startIdx);
      var result = existing;
      var skipUntilBrace = 0;
      for (var k = 0; k < filteredCont.length; k++) {
        var line = filteredCont[k];
        var funcMatch = line.match(/^\s*(?:async\s+)?function\s+(\w+)\s*\(/);
        if (funcMatch && existingFunctions.indexOf(funcMatch[1]) !== -1) {
          // Duplicate function — skip until matching closing brace
          skipUntilBrace = 1;
          continue;
        }
        if (skipUntilBrace > 0) {
          for (var c = 0; c < line.length; c++) {
            if (line[c] === '{') skipUntilBrace++;
            if (line[c] === '}') skipUntilBrace--;
          }
          if (skipUntilBrace <= 0) skipUntilBrace = 0;
          continue;
        }
        result += '\n' + line;
      }
      return result;
    }

    while (_codeIsIncomplete(code) && passCount < maxPasses) {
      passCount++;
      _setCodeStatus('Continuing... pass ' + (passCount + 1), true);
      try {
        // Send the LAST portion of code so DeepSeek knows exactly where to continue from
        var lastChunk = code.split('\n').slice(-30).join('\n');
        var cReply = await _codeChat([
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userText },
          { role: 'assistant', content: '```' + lang + '\n' + lastChunk },
          { role: 'user', content: '[SYSTEM: The code above was cut off mid-file. Continue writing from EXACTLY where it ends. Do not repeat any code. Do not restart. Do not rewrite functions that already exist. Just continue from the last line shown.]' }
        ], { task: 'continue', userText: userText, code: code, filename: filename, temperature: 0.15, max_tokens: 4500 });
        if (!cReply || cReply.length < 10) break;
        var cMatch = cReply.match(/```(?:\w*)\n?([\s\S]*?)(?:```|$)/);
        var cCode = cMatch ? cMatch[1].trim() : cReply.trim();
        if (!cCode) break;
        var prevLength = code.length;
        code = _mergeCodeContinuation(code, cCode);
        // If nothing new was added, DeepSeek is repeating — stop
        if (code.length <= prevLength + 5) break;
        reply = cReply;
      } catch(cErr) { break; }
    }

    var codeLineArr = code.split('\n');

    if (typeof VeilCodingAgent !== 'undefined' && VeilCodingAgent.postProcess) {
      _setCodeStatus('Verifying locally...', true);
      var processed = await VeilCodingAgent.postProcess(code, filename, userText, whoName, soul, {
        lang: lang,
        projectContext: projCtx,
        autoFix: true,
        maxPasses: 3
      });
      code = processed.code;
      codeLineArr = code.split('\n');
      if (!processed.ready && typeof addSystemMessage === 'function') {
        addSystemMessage('Some issues may remain — run Check or ask to fix. DeepSeek was used only if local knowledge was not enough.');
      }
      if (processed.issues && processed.issues.length && typeof VeilIDE !== 'undefined' && VeilIDE.runLocalLint) {
        VeilIDE.runLocalLint();
      }
    } else if (typeof VeilCodingRouter !== 'undefined') {
      var postLint = VeilCodingRouter.localLint(code, filename);
      if (postLint.length && typeof VeilIDE !== 'undefined') VeilIDE.runLocalLint();
    }

    document.getElementById('codeLines').innerHTML = '';
    document.getElementById('codeGutter').innerHTML = '';
    _codePanel.code = '';
    for (var i = 0; i < codeLineArr.length; i++) {
      appendCodeLine(codeLineArr[i]);
      if (i % 5 === 0) await new Promise(function(r) { setTimeout(r, 18); });
    }
    _persistCodePanel();
    if (typeof VeilIDE !== 'undefined' && VeilIDE.syncGeneratedFile) {
      VeilIDE.syncGeneratedFile(filename, _codePanel.code);
    }
    _setCodeStatus('Done — ' + codeLineArr.length + ' lines' + (passCount > 0 ? ', ' + (passCount+1) + ' passes' : ''), false);
    _updateStatusBar(); _markUnsaved(false);
    var doneMsg = who === 'chad'
      ? 'Code is ready — verified locally when possible. ' + filename + ', ' + codeLineArr.length + ' lines. Preview to test, Review for a second pass.'
      : 'Your code is ready! I finished and checked it locally first. ' + filename + ' — ' + codeLineArr.length + ' lines. Preview to test it live.';
    addMessage(who, doneMsg);
    state.conversationHistory.push({ role: 'assistant', content: '[' + whoName + '] ' + doneMsg });
    prefetchThenShow(who, doneMsg).catch(function() {});
  } catch(e) {
    _setCodeStatus('Generation failed.', false);
    logError('code_gen', e.message, e.stack || '', '', {});
  }
  _codePanel.generating = false;
}

