// ============================================================
// SIDE PANEL TOGGLES — Memory + Thought stream on the RIGHT
// ============================================================

function toggleRightPanel(mode) {
  var panel = document.querySelector('.thought-panel');
  var backdrop = document.getElementById('mobileBackdrop');
  var memBtn = document.getElementById('toggleMemBtn');
  var thinkBtn = document.getElementById('toggleThoughtBtn');
  if (!panel) return;

  var isOpen = panel.classList.contains('panel-overlay-show') || panel.classList.contains('mobile-show');
  var sameMode = panel.getAttribute('data-panel-mode') === mode;

  if (isOpen && sameMode) {
    closeMobilePanels();
    return;
  }

  closeMobilePanels();

  panel.classList.add('panel-overlay-show');
  panel.classList.remove('panel-mode-memory', 'panel-mode-thought');
  panel.classList.add(mode === 'memory' ? 'panel-mode-memory' : 'panel-mode-thought');
  panel.setAttribute('data-panel-mode', mode);
  panel.style.display = 'flex';
  if (backdrop) backdrop.classList.add('show');

  if (mode === 'memory') {
    if (memBtn) memBtn.classList.add('active');
    if (thinkBtn) thinkBtn.classList.remove('active');
    if (typeof renderMemories === 'function') renderMemories();
    setTimeout(function() {
      var memList = document.getElementById('memList');
      if (memList) memList.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
  } else {
    if (thinkBtn) thinkBtn.classList.add('active');
    if (memBtn) memBtn.classList.remove('active');
    if (typeof THOUGHT_SPEC !== 'undefined') {
      THOUGHT_SPEC.showThoughts = true;
      localStorage.setItem('veil_show_thoughts', 'true');
      if (!state.thoughtTimer && !state.thoughtPulseId && typeof veilStartThoughtLoop === 'function') {
        veilStartThoughtLoop();
        setTimeout(generateThought, 400);
      } else if (!state.thoughtTimer && !state.thoughtPulseId && typeof generateThought === 'function') {
        state.thoughtTimer = setInterval(generateThought, CONFIG.thoughtInterval);
        setTimeout(generateThought, 400);
      }
    }
    setTimeout(function() {
      var stream = document.getElementById('thoughtStream');
      if (stream) stream.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
  }
}

function toggleMobilePanel(panel) {
  toggleRightPanel(panel === 'memory' ? 'memory' : 'thought');
}

function closeMobilePanels() {
  var panel = document.querySelector('.thought-panel');
  if (panel) {
    panel.classList.remove('mobile-show', 'panel-overlay-show', 'panel-mode-memory', 'panel-mode-thought');
    panel.removeAttribute('data-panel-mode');
    if (window.innerWidth > 768 && typeof THOUGHT_SPEC !== 'undefined' && THOUGHT_SPEC.showThoughts) {
      panel.style.display = 'flex';
    } else {
      panel.style.display = 'none';
    }
  }
  var backdrop = document.getElementById('mobileBackdrop');
  if (backdrop) backdrop.classList.remove('show');
  var memBtn = document.getElementById('toggleMemBtn');
  var thinkBtn = document.getElementById('toggleThoughtBtn');
  if (memBtn) memBtn.classList.remove('active');
  if (thinkBtn) thinkBtn.classList.remove('active');
}
