// ============================================================
// VEIL IDE — Desktop project mode
// Tauri EXE: native folder access | Website/PWA desktop: File System Access API
// Mobile keeps the lightweight single-buffer code panel.
// ============================================================
(function () {
  'use strict';

  var SKIP_EXT = { exe: 1, dll: 1, bin: 1, png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, mp4: 1, mp3: 1, zip: 1, apk: 1, gguf: 1, woff: 1, woff2: 1, ico: 1, pdf: 1 };
  var SKIP_DIRS = { node_modules: 1, '.git': 1, target: 1, dist: 1, build: 1, '.gradle': 1, __pycache__: 1, '.venv': 1, venv: 1, '.cargo': 1 };
  var TOOL_MODE_KEY = 'veil_agent_open_tools_v1';

  var state = {
    backend: null,
    workspace: null,
    workspaceLabel: '',
    entries: [],
    openFiles: {},
    activePath: null,
    testVisible: false,
    initialized: false,
    webDirHandle: null
  };

  function isMobileUa() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  function isTauriDesktop() {
    return !!(window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') && !isMobileUa();
  }

  function isTauriDesktopIde() {
    return isTauriDesktop();
  }

  function formatVersionTime(id) {
    var ms = parseInt(id, 10);
    if (!ms || isNaN(ms)) return id || '';
    try { return new Date(ms).toLocaleString(); } catch (e) { return id; }
  }

  function formatVersionLabel(v) {
    if (v && v.is_legacy) return 'Legacy build (original)';
    return formatVersionTime(v.id);
  }

  function formatBytes(n) {
    n = n || 0;
    if (n < 1024) return n + ' B';
    return (n / 1024).toFixed(1) + ' KB';
  }

  async function seedLegacyBuild() {
    if (!isTauriDesktopIde()) return null;
    try {
      return await tauriInvoke('ide_seed_legacy_build');
    } catch (e) {
      console.log('[VeilIDE] seedLegacyBuild', e);
      return null;
    }
  }

  function hasWebFolderApi() {
    return typeof window.showDirectoryPicker === 'function';
  }

  function isDesktopIdeEligible() {
    return !isMobileUa();
  }

  function isIdeCapable() {
    if (!isDesktopIdeEligible()) return false;
    return isTauriDesktop() || hasWebFolderApi();
  }

  function isActive() {
    return !!state.workspace;
  }

  function tauriInvoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args || {});
  }

  function langFromName(name) {
    var ext = (name || '').split('.').pop().toLowerCase();
    var map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', html: 'html', css: 'css', json: 'json', rs: 'rust', md: 'markdown', sql: 'sql', sh: 'shell' };
    return map[ext] || ext || '';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function openToolModeEnabled() {
    try { return localStorage.getItem(TOOL_MODE_KEY) === '1'; } catch (e) { return false; }
  }

  function updateToolModeButton() {
    var btn = document.getElementById('ideOpenToolsBtn');
    if (!btn) return;
    var on = openToolModeEnabled();
    btn.textContent = on ? '∞ Tools On' : '∞ Tools';
    btn.title = on
      ? 'Open tool mode is ON — the agent may run broader workspace commands.'
      : 'Enable open tool mode for broader workspace commands.';
    btn.classList.toggle('amber', on);
  }

  function setOpenToolMode(on) {
    try { localStorage.setItem(TOOL_MODE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    updateToolModeButton();
    if (typeof addSystemMessage === 'function') {
      addSystemMessage(on
        ? 'Open tool mode enabled — agent commands are less restricted for this browser session.'
        : 'Open tool mode disabled — agent commands are back to the safer allowlist.');
    }
  }

  // ---- IndexedDB: remember PWA folder across sessions --------------------
  function openIdeDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open('veil-ide-v1', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function idbSet(key, val) {
    var db = await openIdeDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(val, key);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  async function idbGet(key) {
    var db = await openIdeDb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('kv', 'readonly');
      var req = tx.objectStore('kv').get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // ---- Web File System Access API ----------------------------------------
  async function webWalkDir(dirHandle, prefix, out, limit) {
    if (limit.count <= 0) return;
    for await (var entry of dirHandle.values()) {
      if (limit.count <= 0) break;
      var name = entry.name;
      if (name.startsWith('.') && name !== '.env') continue;
      var path = prefix ? prefix + '/' + name : name;
      if (entry.kind === 'directory') {
        if (SKIP_DIRS[name]) continue;
        await webWalkDir(entry, path, out, limit);
      } else if (entry.kind === 'file') {
        try {
          var file = await entry.getFile();
          if (file.size > 2000000) continue;
          out.push({ path: path, name: name, is_dir: false, size: file.size, _handle: entry });
          limit.count--;
        } catch (e) { /* skip */ }
      }
    }
  }

  async function webResolveFileHandle(relPath, create) {
    var parts = relPath.split('/').filter(Boolean);
    var dir = state.webDirHandle;
    if (!dir) throw new Error('No folder open');
    var i = 0;
    for (; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]);
    }
    return dir.getFileHandle(parts[i], create ? { create: true } : undefined);
  }

  async function webPickFolder() {
    var dir = await window.showDirectoryPicker({ mode: 'readwrite' });
    state.webDirHandle = dir;
    state.workspace = dir.name;
    state.workspaceLabel = dir.name;
    state.backend = 'web';
    try { await idbSet('workspaceDir', dir); } catch (e) { /* ignore */ }
    await refreshTree();
  }

  async function webRestoreFolder() {
    if (!hasWebFolderApi()) return;
    try {
      var handle = await idbGet('workspaceDir');
      if (!handle) return;
      var perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        perm = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (perm === 'granted') {
        state.webDirHandle = handle;
        state.workspace = handle.name;
        state.workspaceLabel = handle.name;
        state.backend = 'web';
        await refreshTree();
      }
    } catch (e) { /* ignore */ }
  }

  async function webListDir() {
    var out = [];
    await webWalkDir(state.webDirHandle, '', out, { count: 1200 });
    out.sort(function (a, b) { return a.path.localeCompare(b.path); });
    return out;
  }

  async function webReadFile(path) {
    var handle = await webResolveFileHandle(path, false);
    var file = await handle.getFile();
    if (file.size > 2000000) throw new Error('File too large');
    return file.text();
  }

  async function webWriteFile(path, content) {
    var handle = await webResolveFileHandle(path, true);
    var writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  // ---- Storage facade ----------------------------------------------------
  async function pickFolder() {
    if (!isIdeCapable()) {
      if (typeof addSystemMessage === 'function') {
        addSystemMessage('Project folders work on desktop — install the app or use Chrome/Edge on a computer.');
      }
      return;
    }
    _ensureDom();
    try {
      if (isTauriDesktop()) {
        var path = await tauriInvoke('ide_pick_folder');
        if (!path) return;
        state.backend = 'tauri';
        state.workspace = path;
        state.workspaceLabel = path.split(/[\\/]/).pop() || path;
      } else {
        await webPickFolder();
      }
      _updateWorkspaceLabel();
      _resumeBannerDismissed = false;
      refreshResumeBanner();
      if (typeof addSystemMessage === 'function') {
        addSystemMessage('Project opened: ' + state.workspaceLabel);
      }
      var openTask = typeof VeilCodingTaskMemory !== 'undefined' && VeilCodingTaskMemory.getActiveTask
        ? VeilCodingTaskMemory.getActiveTask()
        : null;
      if (openTask && typeof addSystemMessage === 'function') {
        addSystemMessage('Unfinished coding task found — use Continue in the Code tab sidebar to resume.');
      }
      if (isTauriDesktopIde()) {
        seedLegacyBuild().then(function (r) {
          if (r && r.seeded > 0 && typeof addSystemMessage === 'function') {
            addSystemMessage('Legacy build saved for ' + r.seeded + ' original file(s) — kept forever, never overwritten.');
          }
        });
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (typeof addSystemMessage === 'function') addSystemMessage('Could not open folder: ' + (e.message || e));
    }
  }

  async function refreshTree() {
    if (!state.workspace) return;
    try {
      if (state.backend === 'tauri') {
        state.entries = await tauriInvoke('ide_list_dir') || [];
      } else {
        state.entries = await webListDir();
      }
      _renderTree();
    } catch (e) {
      console.log('[VeilIDE] refreshTree', e);
    }
  }

  async function readFile(relPath) {
    if (state.backend === 'tauri') return tauriInvoke('ide_read_file', { path: relPath });
    return webReadFile(relPath);
  }

  async function writeFile(relPath, content) {
    if (state.backend === 'tauri') return tauriInvoke('ide_write_file', { path: relPath, content: content });
    return webWriteFile(relPath, content);
  }

  function _ensureDom() {
    if (state.initialized) return;
    state.initialized = true;
    if (!isIdeCapable()) return;

    var panel = document.getElementById('codePanel');
    if (!panel) return;
    panel.classList.add('veil-ide-capable');

    var body = panel.querySelector('.code-body');
    if (!body || document.getElementById('ideSidebar')) return;

    var sidebar = document.createElement('div');
    sidebar.className = 'ide-sidebar';
    sidebar.id = 'ideSidebar';
    sidebar.innerHTML =
      '<div class="ide-sidebar-head">' +
      '  <button type="button" class="ide-btn" id="ideOpenFolderBtn">📁 Open Folder</button>' +
      '  <span class="ide-workspace-label" id="ideWorkspaceLabel" title=""></span>' +
      '</div>' +
      '<div class="ide-resume-banner" id="ideResumeBanner" style="display:none;margin:8px;padding:10px;border:1px solid rgba(0,255,200,.25);border-radius:8px;background:rgba(0,255,200,.06);font-size:12px;line-height:1.4">' +
      '  <div style="font-weight:700;margin-bottom:4px;color:#00ffc8">Unfinished task</div>' +
      '  <div id="ideResumeLabel" style="opacity:.9;margin-bottom:8px"></div>' +
      '  <div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '    <button type="button" class="ide-btn ide-btn-sm" id="ideResumeContinueBtn">Continue</button>' +
      '    <button type="button" class="ide-btn ide-btn-sm" id="ideResumeLaterBtn">Later</button>' +
      '    <button type="button" class="ide-btn ide-btn-sm" id="ideResumeAbandonBtn">Abandon</button>' +
      '  </div>' +
      '</div>' +
      '<div class="ide-file-tree" id="ideFileTree"></div>';

    var testPanel = document.createElement('div');
    testPanel.className = 'ide-test-panel';
    testPanel.id = 'ideTestPanel';
    testPanel.innerHTML =
      '<div class="ide-test-head">' +
      '  <span>Preview &amp; Test</span>' +
      '  <button type="button" class="ide-btn ide-btn-sm" id="ideTestCloseBtn">✕</button>' +
      '</div>' +
      '<iframe id="ideTestFrame" class="ide-test-frame" title="Code preview" sandbox="allow-scripts allow-forms allow-modals"></iframe>' +
      '<div class="ide-test-console" id="ideTestConsole"></div>';

    body.insertBefore(sidebar, body.firstChild);
    body.appendChild(testPanel);

    document.getElementById('ideOpenFolderBtn').addEventListener('click', function () { pickFolder(); });
    document.getElementById('ideTestCloseBtn').addEventListener('click', function () { toggleTestPanel(false); });
    var resumeContinue = document.getElementById('ideResumeContinueBtn');
    var resumeLater = document.getElementById('ideResumeLaterBtn');
    var resumeAbandon = document.getElementById('ideResumeAbandonBtn');
    if (resumeContinue) resumeContinue.addEventListener('click', function () { continueActiveTask(); });
    if (resumeLater) resumeLater.addEventListener('click', function () { hideResumeBanner(true); });
    if (resumeAbandon) resumeAbandon.addEventListener('click', function () { abandonActiveTask(); });

    var toolbar = panel.querySelector('.code-toolbar');
    if (toolbar && !document.getElementById('ideSaveDiskBtn')) {
      var sep = document.createElement('div');
      sep.className = 'code-toolbar-sep';
      var grp = document.createElement('div');
      grp.className = 'code-toolbar-group';
      grp.innerHTML =
        '<button type="button" class="code-tool-btn primary" id="ideSaveDiskBtn" title="Write the editor contents to your project folder on disk">💾 Save File</button>' +
        '<button type="button" class="code-tool-btn amber" id="ideTestRunBtn" title="Sandbox preview only — does not save or apply to disk">▶ Run / Preview</button>' +
        '<button type="button" class="code-tool-btn" id="ideLintBtn">⌁ Check</button>' +
        '<button type="button" class="code-tool-btn" id="ideBuildBtn" title="Run cargo check or npm build">⚙ Build</button>' +
        (isTauriDesktopIde() ? '<button type="button" class="code-tool-btn" id="ideOpenToolsBtn" title="Enable broader agent command use">∞ Tools</button>' : '') +
        (isTauriDesktopIde() ? '<button type="button" class="code-tool-btn" id="ideHistoryBtn" title="Restore a previous version (desktop app — last 10 saves per file)">🕐 History</button>' : '');
      toolbar.insertBefore(grp, toolbar.querySelector('.code-status-pill'));
      toolbar.insertBefore(sep, grp);
      document.getElementById('ideSaveDiskBtn').addEventListener('click', function () { persistActiveFile(true); });
      document.getElementById('ideTestRunBtn').addEventListener('click', function () { runPreview(); });
      document.getElementById('ideLintBtn').addEventListener('click', function () { runLocalLint(); });
      var buildBtn = document.getElementById('ideBuildBtn');
      if (buildBtn) buildBtn.addEventListener('click', function () { runProjectBuild(); });
      var openToolsBtn = document.getElementById('ideOpenToolsBtn');
      if (openToolsBtn) {
        updateToolModeButton();
        openToolsBtn.addEventListener('click', function () { setOpenToolMode(!openToolModeEnabled()); });
      }
      var histBtn = document.getElementById('ideHistoryBtn');
      if (histBtn) histBtn.addEventListener('click', function () { showHistoryPanel(); });
    }

    if (!document.getElementById('ideHistoryPanel') && isTauriDesktopIde()) {
      var histPanel = document.createElement('div');
      histPanel.className = 'ide-history-panel';
      histPanel.id = 'ideHistoryPanel';
      histPanel.innerHTML =
        '<div class="ide-history-head">' +
        '  <span>File history <small>(last 10 + Legacy build)</small></span>' +
        '  <button type="button" class="ide-btn ide-btn-sm" id="ideHistoryCloseBtn">✕</button>' +
        '</div>' +
        '<div class="ide-history-list" id="ideHistoryList"></div>';
      panel.appendChild(histPanel);
      document.getElementById('ideHistoryCloseBtn').addEventListener('click', function () { hideHistoryPanel(); });
    }

    if (isTauriDesktop()) {
      state.backend = 'tauri';
      tauriInvoke('ide_get_workspace').then(function (ws) {
        if (ws) {
          state.workspace = ws;
          state.workspaceLabel = ws.split(/[\\/]/).pop() || ws;
          _updateWorkspaceLabel();
          refreshTree();
          seedLegacyBuild();
          setTimeout(refreshResumeBanner, 300);
        }
      }).catch(function () {});
    } else {
      webRestoreFolder().then(function () {
        _updateWorkspaceLabel();
        setTimeout(refreshResumeBanner, 300);
      });
    }
  }

  function _updateWorkspaceLabel() {
    var el = document.getElementById('ideWorkspaceLabel');
    if (el) {
      el.textContent = state.workspaceLabel || '';
      el.title = state.workspace || '';
    }
    var panel = document.getElementById('codePanel');
    if (panel) panel.classList.toggle('veil-ide-active', !!state.workspace);
  }

  function _renderTree() {
    var tree = document.getElementById('ideFileTree');
    if (!tree) return;
    if (!state.entries.length) {
      tree.innerHTML = '<div class="ide-tree-empty">Open a folder to browse your project.</div>';
      return;
    }
    var html = '';
    state.entries.forEach(function (e) {
      if (e.is_dir) return;
      var ext = e.name.split('.').pop().toLowerCase();
      if (SKIP_EXT[ext]) return;
      var active = state.activePath === e.path ? ' active' : '';
      html += '<button type="button" class="ide-tree-file' + active + '" data-path="' + escapeAttr(e.path) + '">' + escapeHtml(e.name) + '</button>';
    });
    tree.innerHTML = html || '<div class="ide-tree-empty">No editable files found.</div>';
    tree.querySelectorAll('.ide-tree-file').forEach(function (btn) {
      btn.addEventListener('click', function () { openFile(btn.getAttribute('data-path')); });
    });
  }

  async function openFile(relPath) {
    if (!relPath) return;
    _ensureDom();
    try {
      var content = await readFile(relPath);
      state.openFiles[relPath] = content;
      state.activePath = relPath;
      var baseName = relPath.split('/').pop();
      if (typeof setCodePanelContent === 'function') {
        setCodePanelContent(content, baseName, langFromName(relPath));
      } else if (typeof _codePanel !== 'undefined') {
        _codePanel.code = content;
        _codePanel.filename = baseName;
        _codePanel.language = langFromName(relPath);
        if (typeof renderCodeLines === 'function') renderCodeLines(content);
      }
      var fn = document.getElementById('codeFilename');
      if (fn) fn.textContent = baseName;
      if (typeof showCodePanel === 'function') showCodePanel();
      if (typeof _markUnsaved === 'function') _markUnsaved(false);
      _renderTree();
    } catch (e) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Could not open file: ' + (e.message || e));
    }
  }

  async function persistActiveFile(showStatus) {
    if (!state.activePath || typeof _codePanel === 'undefined') return false;
    try {
      await writeFile(state.activePath, _codePanel.code);
      state.openFiles[state.activePath] = _codePanel.code;
      if (typeof _markUnsaved === 'function') _markUnsaved(false);
      if (showStatus && typeof _setCodeStatus === 'function') {
        _setCodeStatus('Saved to disk');
        setTimeout(function () { _setCodeStatus(''); }, 2000);
      }
      return true;
    } catch (e) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Save failed: ' + (e.message || e));
      return false;
    }
  }

  async function syncGeneratedFile(filename, code) {
    if (!isActive() || !filename || filename === 'untitled' || filename === 'code.txt') return;
    _ensureDom();
    try {
      await writeFile(filename, code);
      state.openFiles[filename] = code;
      state.activePath = filename;
      await refreshTree();
    } catch (e) { console.log('[VeilIDE] syncGeneratedFile', e); }
  }

  function getFileEntries() {
    return (state.entries || []).filter(function (e) { return !e.is_dir; });
  }

  function getWorkspaceLabel() {
    return state.workspaceLabel || state.workspace || '';
  }

  async function readWorkspaceFile(relPath) {
    if (state.openFiles[relPath] != null) return state.openFiles[relPath];
    var content = await readFile(relPath);
    state.openFiles[relPath] = content;
    return content;
  }

  async function writeWorkspaceFiles(fileList) {
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (!f || !f.path) continue;
      await writeFile(f.path, f.code);
      state.openFiles[f.path] = f.code;
    }
    await refreshTree();
  }

  async function openWorkspaceFile(relPath, fileObj) {
    var content = fileObj && fileObj.code != null ? fileObj.code : await readWorkspaceFile(relPath);
    state.activePath = relPath;
    state.openFiles[relPath] = content;
    var baseName = relPath.split('/').pop();
    if (typeof _codePanel !== 'undefined') {
      _codePanel.code = content;
      _codePanel.filename = baseName;
      _codePanel.language = langFromName(relPath);
      if (typeof renderCodeLines === 'function') renderCodeLines(content);
    }
    var fn = document.getElementById('codeFilename');
    if (fn) fn.textContent = baseName;
    if (typeof showCodePanel === 'function') showCodePanel();
    if (typeof _markUnsaved === 'function') _markUnsaved(false);
    _renderTree();
  }

  function getProjectContext(maxChars) {
    maxChars = maxChars || 8000;
    if (!isActive()) return '';
    var parts = [];
    var budget = maxChars;
    var paths = Object.keys(state.openFiles);
    if (state.activePath && state.openFiles[state.activePath]) {
      paths = [state.activePath].concat(paths.filter(function (p) { return p !== state.activePath; }));
    }
    paths.forEach(function (p) {
      var chunk = 'FILE: ' + p + '\n```\n' + (state.openFiles[p] || '') + '\n```\n';
      if (chunk.length > budget) return;
      parts.push(chunk);
      budget -= chunk.length;
    });
    if (state.activePath && typeof _codePanel !== 'undefined' && _codePanel.code && paths.indexOf(state.activePath) === -1) {
      var cur = 'FILE: ' + state.activePath + '\n```\n' + _codePanel.code + '\n```\n';
      if (cur.length <= budget) parts.unshift(cur);
    }
    return parts.join('\n');
  }

  var _lastPreviewError = '';

  function _logTest(msg, isErr) {
    var con = document.getElementById('ideTestConsole');
    if (!con) return;
    var line = document.createElement('div');
    line.className = 'ide-test-line' + (isErr ? ' err' : '');
    line.textContent = msg;
    con.appendChild(line);
    con.scrollTop = con.scrollHeight;
    if (isErr) {
      _lastPreviewError = msg;
      _showPreviewFixBtn();
    }
  }

  function _companionName() {
    if (typeof state !== 'undefined' && state.currentTab === 'chad') return 'Chad';
    return 'Caelum';
  }

  function _showPreviewFixBtn() {
    var con = document.getElementById('ideTestConsole');
    if (!con || !document.getElementById('ideTestPanel') || !document.getElementById('ideTestPanel').classList.contains('show')) return;
    if (document.getElementById('idePreviewFixBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'idePreviewFixBtn';
    btn.className = 'ide-btn ide-preview-fix-btn';
    btn.textContent = 'Ask ' + _companionName() + ' to fix this';
    btn.addEventListener('click', function () { offerPreviewFix(); });
    con.appendChild(btn);
  }

  async function offerPreviewFix() {
    var err = _lastPreviewError || 'Preview failed';
    if (typeof reviewCode === 'function' && typeof _codePanel !== 'undefined' && _codePanel.code) {
      if (typeof addSystemMessage === 'function') {
        addSystemMessage(_companionName() + ' is reviewing your code after the preview error…');
      }
      reviewCode();
      return;
    }
    if (typeof generateCodeInPanel === 'function') {
      generateCodeInPanel('The preview failed with this error. Fix the code and return the complete corrected file.\n\nError:\n' + err);
    }
  }

  async function listFileVersions(relPath) {
    if (!isTauriDesktopIde() || !relPath) return [];
    try {
      return await tauriInvoke('ide_list_file_versions', { path: relPath }) || [];
    } catch (e) {
      console.log('[VeilIDE] listFileVersions', e);
      return [];
    }
  }

  async function restoreFileVersion(relPath, versionId) {
    if (!isTauriDesktopIde() || !relPath || !versionId) return false;
    try {
      await tauriInvoke('ide_restore_file_version', { path: relPath, versionId: versionId });
      return true;
    } catch (e) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Restore failed: ' + (e.message || e));
      return false;
    }
  }

  async function showHistoryPanel() {
    if (!isTauriDesktopIde()) {
      if (typeof addSystemMessage === 'function') addSystemMessage('File history is available in the desktop app only.');
      return;
    }
    _ensureDom();
    if (!state.activePath) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Open a file first to see its history.');
      return;
    }
    var panel = document.getElementById('ideHistoryPanel');
    var list = document.getElementById('ideHistoryList');
    if (!panel || !list) return;
    panel.classList.add('show');
    list.innerHTML = '<div class="ide-tree-empty">Loading versions…</div>';
    var versions = await listFileVersions(state.activePath);
    var regular = versions.filter(function (v) { return !v.is_legacy; });
    var legacy = versions.filter(function (v) { return v.is_legacy; });
    if (!regular.length && !legacy.length) {
      list.innerHTML = '<div class="ide-tree-empty">No backups yet. Open a project to capture Legacy build originals; each save keeps the last 10 versions.</div>';
      return;
    }
    var html = '';
    regular.forEach(function (v) {
      html += '<div class="ide-history-row">' +
        '<div class="ide-history-meta"><strong>' + escapeHtml(formatVersionLabel(v)) + '</strong><span>' + escapeHtml(formatBytes(v.size)) + '</span></div>' +
        '<button type="button" class="ide-btn ide-btn-sm ide-history-restore" data-vid="' + escapeAttr(v.id) + '">Restore</button>' +
        '</div>';
    });
    legacy.forEach(function (v) {
      html += '<div class="ide-history-row ide-history-legacy">' +
        '<div class="ide-history-meta"><strong>' + escapeHtml(formatVersionLabel(v)) + '</strong><span>Original — never deleted</span></div>' +
        '<button type="button" class="ide-btn ide-btn-sm ide-history-restore" data-vid="' + escapeAttr(v.id) + '" data-legacy="1">Restore</button>' +
        '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.ide-history-restore').forEach(function (btn) {
      btn.addEventListener('click', function () {
        restoreVersionConfirm(btn.getAttribute('data-vid'), btn.getAttribute('data-legacy') === '1');
      });
    });
  }

  function hideHistoryPanel() {
    var panel = document.getElementById('ideHistoryPanel');
    if (panel) panel.classList.remove('show');
  }

  async function restoreVersionConfirm(versionId, isLegacy) {
    if (!state.activePath || !versionId) return;
    var when = isLegacy ? 'Legacy build (your original file)' : formatVersionTime(versionId);
    var msg = isLegacy
      ? 'Restore this file to your Legacy build — the untouched original from when you opened the project?\n\nYour current file will be backed up first. The Legacy build itself is never changed.'
      : 'Restore this file to the version from ' + when + '?\n\nYour current file will be backed up first.';
    if (!window.confirm(msg)) return;
    var ok = await restoreFileVersion(state.activePath, versionId);
    if (!ok) return;
    await openFile(state.activePath);
    hideHistoryPanel();
    if (typeof addSystemMessage === 'function') addSystemMessage('Restored ' + (state.activePath.split('/').pop() || 'file') + ' from ' + when);
    if (typeof _setCodeStatus === 'function') {
      _setCodeStatus('Restored from history');
      setTimeout(function () { _setCodeStatus(''); }, 2500);
    }
  }

  function toggleTestPanel(on) {
    _ensureDom();
    state.testVisible = on !== false;
    var p = document.getElementById('ideTestPanel');
    if (p) p.classList.toggle('show', state.testVisible);
  }

  function runPreview() {
    if (!isIdeCapable()) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Preview runs in the desktop Code tab.');
      return;
    }
    _ensureDom();
    toggleTestPanel(true);
    var con = document.getElementById('ideTestConsole');
    if (con) {
      con.innerHTML = '';
      _lastPreviewError = '';
    }
    var frame = document.getElementById('ideTestFrame');
    if (!frame || typeof _codePanel === 'undefined') return;

    var name = (_codePanel.filename || '').toLowerCase();
    var code = _codePanel.code || '';

    if (/\.html?$/.test(name) || code.indexOf('<html') >= 0) {
      var doc = code;
      if (doc.indexOf('<html') < 0) {
        doc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + code + '</body></html>';
      }
      if (doc.indexOf('veil-test-catch') < 0) {
        doc = doc.replace('</body>', '<script>window.onerror=function(m,u,l){parent.postMessage({veilTest:1,err:m+" @"+l},"*");};<\/script></body>');
      }
      frame.srcdoc = doc;
      _logTest('Loaded HTML preview.');
      return;
    }

    if (/\.(js|jsx|ts|tsx)$/.test(name)) {
      frame.srcdoc =
        '<!DOCTYPE html><html><body><pre id="out"></pre><script>' +
        'window.onerror=function(m,u,l){parent.postMessage({veilTest:1,err:m+" @"+l},"*");};' +
        'try{' + code + ';document.getElementById("out").textContent="Script ran with no errors.";}' +
        'catch(e){document.getElementById("out").textContent="Error: "+e.message;parent.postMessage({veilTest:1,err:e.message},"*");}' +
        '<\/script></body></html>';
      _logTest('Ran JS in sandbox.');
      return;
    }

    if (/\.css$/.test(name)) {
      frame.srcdoc = '<!DOCTYPE html><html><head><style>' + code + '</style></head><body><p>CSS preview — sample text</p></body></html>';
      _logTest('Loaded CSS preview.');
      return;
    }

    _logTest('Preview supports HTML, JS, and CSS files.', true);
  }

  function runLocalLint() {
    if (typeof VeilCodingRouter === 'undefined' || typeof _codePanel === 'undefined') return;
    var issues = VeilCodingRouter.localLint(_codePanel.code, _codePanel.filename);
    toggleTestPanel(true);
    var con = document.getElementById('ideTestConsole');
    if (con) con.innerHTML = '';
    if (!issues.length) {
      _logTest('No syntax issues found.');
      if (typeof _setCodeStatus === 'function') _setCodeStatus('No syntax issues');
      return;
    }
    issues.forEach(function (i) { _logTest('Line ' + i.line + ': ' + i.msg, true); });
    if (typeof _setCodeStatus === 'function') _setCodeStatus(issues.length + ' issue(s) found');
  }

  async function grepWorkspace(query, maxHits) {
    if (!isActive()) return [];
    if (isTauriDesktop()) {
      try {
        return await tauriInvoke('ide_grep', { query: query, maxHits: maxHits || 120 });
      } catch (e) {
        console.log('[VeilIDE] grep', e);
      }
    }
    return [];
  }

  async function gitStatus() {
    if (!isActive() || !isTauriDesktop()) return { ok: true, skipped: true };
    try {
      return await tauriInvoke('ide_git_status', {});
    } catch (e) {
      return { ok: false, summary: String(e.message || e) };
    }
  }

  async function runTerminalCommand(program, args, cwdRel, unsafeMode) {
    if (!isActive() || !isTauriDesktop()) {
      return { ok: true, skipped: true, reason: 'Desktop app required' };
    }
    try {
      return await tauriInvoke('ide_run_command', {
        program: program,
        args: args || [],
        cwdRel: cwdRel || null,
        allowUnsafe: unsafeMode == null ? openToolModeEnabled() : !!unsafeMode
      });
    } catch (e) {
      return { ok: false, stderr: String(e.message || e) };
    }
  }

  function logBuildOutput(result) {
    toggleTestPanel(true);
    var con = document.getElementById('ideTestConsole');
    if (!con) return;
    if (result.skipped) {
      _logTest(result.reason || 'Build skipped');
      return;
    }
    _logTest((result.ok ? 'Build OK: ' : 'Build FAILED: ') + (result.command || ''));
    if (result.output) {
      result.output.split('\n').slice(-30).forEach(function (line) {
        if (line.trim()) _logTest(line, !result.ok && /error/i.test(line));
      });
    }
    if (!result.ok && result.errors && result.errors.length && typeof offerPreviewFix === 'function') {
      _lastPreviewError = 'Build failed:\n' + (typeof VeilCodingBuild !== 'undefined' ? VeilCodingBuild.formatBuildErrors(result.errors) : '');
      _showPreviewFixBtn();
    }
  }

  async function runProjectBuild() {
    if (!isActive()) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Open a project folder first.');
      return;
    }
    if (typeof VeilCodingBuild === 'undefined') {
      if (typeof addSystemMessage === 'function') addSystemMessage('Build module not loaded.');
      return;
    }
    if (typeof _setCodeStatus === 'function') _setCodeStatus('Building...', true);
    var result = await VeilCodingBuild.run({ kind: 'auto' });
    logBuildOutput(result);
    if (typeof _setCodeStatus === 'function') {
      _setCodeStatus(result.ok ? 'Build passed' : 'Build failed', false);
    }
    return result;
  }

  window.addEventListener('message', function (ev) {
    if (ev.data && ev.data.veilTest && ev.data.err) _logTest('Runtime: ' + ev.data.err, true);
  });

  var _resumeBannerDismissed = false;

  function hideResumeBanner(rememberLater) {
    var banner = document.getElementById('ideResumeBanner');
    if (banner) banner.style.display = 'none';
    if (rememberLater) _resumeBannerDismissed = true;
  }

  function refreshResumeBanner() {
    _ensureDom();
    var banner = document.getElementById('ideResumeBanner');
    var label = document.getElementById('ideResumeLabel');
    if (!banner || !label) return;
    if (!isActive() || _resumeBannerDismissed) {
      banner.style.display = 'none';
      return;
    }
    if (typeof VeilCodingTaskMemory === 'undefined' || !VeilCodingTaskMemory.getActiveTask) {
      banner.style.display = 'none';
      return;
    }
    var task = VeilCodingTaskMemory.getActiveTask();
    if (!task) {
      banner.style.display = 'none';
      return;
    }
    label.textContent = VeilCodingTaskMemory.formatTaskLabel
      ? VeilCodingTaskMemory.formatTaskLabel(task)
      : (task.goal || 'Unfinished coding task');
    banner.style.display = 'block';
  }

  async function continueActiveTask() {
    if (typeof VeilCodingTask === 'undefined' || !VeilCodingTask.resume) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Resume is not available yet — open a project folder and try again.');
      return;
    }
    if (typeof _codePanel !== 'undefined' && _codePanel.generating) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Already working on a coding task.');
      return;
    }
    hideResumeBanner(false);
    if (typeof showCodePanel === 'function') showCodePanel();
    if (typeof _codePanel !== 'undefined') _codePanel.generating = true;
    if (typeof _setCodeStatus === 'function') _setCodeStatus('Resuming unfinished task...', true);
    try {
      var task = typeof VeilCodingTaskMemory !== 'undefined' ? VeilCodingTaskMemory.getActiveTask() : null;
      if (typeof addSystemMessage === 'function') {
        addSystemMessage('Continuing unfinished task' + (task && task.goal ? ': ' + String(task.goal).slice(0, 80) : '') + '…');
      }
      await VeilCodingTask.resume(task ? task.id : '');
    } catch (e) {
      if (typeof addSystemMessage === 'function') addSystemMessage('Could not resume task: ' + (e.message || e));
      if (typeof _setCodeStatus === 'function') _setCodeStatus('Resume failed', false);
    } finally {
      if (typeof _codePanel !== 'undefined') _codePanel.generating = false;
      refreshResumeBanner();
    }
  }

  function abandonActiveTask() {
    if (typeof VeilCodingTaskMemory === 'undefined') return;
    var task = VeilCodingTaskMemory.getActiveTask();
    if (!task) {
      hideResumeBanner(false);
      return;
    }
    if (!window.confirm('Abandon this unfinished task?\n\n' + (task.goal || '').slice(0, 200))) return;
    VeilCodingTaskMemory.abandonTask(task.id);
    hideResumeBanner(false);
    if (typeof addSystemMessage === 'function') addSystemMessage('Abandoned unfinished task.');
    refreshResumeBanner();
  }

  function onShowCodePanel() {
    if (isIdeCapable()) {
      _ensureDom();
      setTimeout(refreshResumeBanner, 200);
    }
  }

  window.VeilIDE = {
    isDesktop: isIdeCapable,
    isCapable: isIdeCapable,
    isDesktopHistory: isTauriDesktopIde,
    isActive: isActive,
    init: _ensureDom,
    pickFolder: pickFolder,
    refreshTree: refreshTree,
    openFile: openFile,
    openWorkspaceFile: openWorkspaceFile,
    persistActiveFile: persistActiveFile,
    syncGeneratedFile: syncGeneratedFile,
    getProjectContext: getProjectContext,
    getFileEntries: getFileEntries,
    getWorkspaceLabel: getWorkspaceLabel,
    readWorkspaceFile: readWorkspaceFile,
    writeWorkspaceFiles: writeWorkspaceFiles,
    grepWorkspace: grepWorkspace,
    gitStatus: gitStatus,
    runTerminalCommand: runTerminalCommand,
    runProjectBuild: runProjectBuild,
    logBuildOutput: logBuildOutput,
    openToolModeEnabled: openToolModeEnabled,
    setOpenToolMode: setOpenToolMode,
    runPreview: runPreview,
    runLocalLint: runLocalLint,
    showHistoryPanel: showHistoryPanel,
    offerPreviewFix: offerPreviewFix,
    toggleTestPanel: toggleTestPanel,
    onShowCodePanel: onShowCodePanel,
    refreshResumeBanner: refreshResumeBanner,
    continueActiveTask: continueActiveTask,
    abandonActiveTask: abandonActiveTask,
    getActivePath: function () { return state.activePath; }
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (isIdeCapable()) setTimeout(_ensureDom, 1500);
  });
})();
