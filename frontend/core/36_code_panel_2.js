// ============================================================
// CODE PANEL — UI helpers and diff approval system
// ============================================================
function _setCodeStatus(msg, spinning) {
  var el = document.getElementById('codeStatus');
  var sp = document.getElementById('codeSpinner');
  if (el) el.textContent = msg || '';
  if (sp) sp.classList.toggle('show', !!spinning);
}

function _updateStatusBar() {
  var lineCount = _codePanel.code ? _codePanel.code.split('\n').length : 0;
  var sbLang = document.getElementById('sbLang');
  var sbLines = document.getElementById('sbLines');
  var sbMsg = document.getElementById('sbMsg');
  if (sbLang) sbLang.textContent = (_codePanel.language || '—').toUpperCase();
  if (sbLines) sbLines.textContent = lineCount + ' line' + (lineCount !== 1 ? 's' : '');
  if (sbMsg) sbMsg.textContent = _codePanel.filename || '';
}

function _updateLangBadge() {
  var badge = document.getElementById('codeLangBadge');
  if (badge) badge.textContent = _codePanel.language ? _codePanel.language.toUpperCase() : '';
}

function _markUnsaved(unsaved) {
  var dot = document.getElementById('codeUnsavedDot');
  if (dot) dot.classList.toggle('show', !!unsaved);
}

function showCodePanel() {
  document.getElementById('codePanel').classList.add('show');
  if (typeof VeilIDE !== 'undefined' && VeilIDE.onShowCodePanel) VeilIDE.onShowCodePanel();
}

function hideCodePanel() {
  document.getElementById('codePanel').classList.remove('show');
  hideDiffPanel();
}

function clearCodePanel() {
  if (_codePanel.generating || _codePanel.reviewing) return;
  _codePanel.code = ''; _codePanel.filename = 'untitled'; _codePanel.language = '';
  var fn = document.getElementById('codeFilename'); if (fn) fn.textContent = 'untitled';
  var g = document.getElementById('codeGutter'); if (g) g.innerHTML = '';
  var l = document.getElementById('codeLines'); if (l) l.innerHTML = '<div class="code-empty">No code yet.<br>Ask Caelum or Chad to build something.</div>';
  _setCodeStatus(''); _updateStatusBar(); _updateLangBadge(); _markUnsaved(false);
}

if (typeof registerVeilHandler === 'function') {
  registerVeilHandler('showCodePanel', showCodePanel);
  registerVeilHandler('hideCodePanel', hideCodePanel);
  registerVeilHandler('clearCodePanel', clearCodePanel);
}

