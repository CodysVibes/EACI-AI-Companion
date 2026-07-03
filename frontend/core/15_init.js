// ============================================================
// INITIALIZATION
// ============================================================
function init() {
  loadState();
  if (typeof reconcileActivityFromHistory === 'function') reconcileActivityFromHistory();
  loadBilling();
  if (typeof seedUsageMeterDisplay === 'function') seedUsageMeterDisplay();
  registerServiceWorker();
  if (typeof initAudioCache === 'function') {
    initAudioCache().then(function() {
      console.log('Audio cache ready');
    });
  }
  if (typeof initCanvas === 'function') initCanvas();
  if (typeof renderMemories === 'function') renderMemories();
  if (typeof updateStatusDots === 'function') updateStatusDots();
  if (typeof updateEmotionBadge === 'function') updateEmotionBadge();
  if (typeof updateUsageMeter === 'function') updateUsageMeter();
  startResetCountdown();
  initPlayBilling();
  initSessionTracking();

  window._veilPageLoadAt = Date.now();
  window._veilSessionActiveSinceLoad = false;
  if (getLastSessionGapMs() < 10 * 60000) {
    window._veilSessionActiveSinceLoad = true;
  }
  (function armPresenceThisVisit() {
    if (window._veilPresenceArmed) return;
    window._veilPresenceArmed = true;
    var mark = function() {
      if (typeof markPresenceThisVisit === 'function') markPresenceThisVisit();
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', mark, true);
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
  })();

  captureSessionReturnGap();

  var sessionGap = getLastSessionGapMs();
  var gapMin = Math.floor(sessionGap / 60000);
  if (!window._veilSessionActiveSinceLoad && gapMin >= 30) {
    var gapStr = formatSessionGap(sessionGap);
    if (gapStr) {
      var lastAct = typeof getLastActivityDescription === 'function' ? getLastActivityDescription() : '';
      var restoreMsg = 'Session restored — about ' + gapStr + ' since your last activity';
      if (lastAct) restoreMsg += ' (' + lastAct + ')';
      restoreMsg += '. Emotional state: ' + state.emotionalState;
      addSystemMessage(restoreMsg);
      if (gapMin > 30) {
        if (state.emotionalState === 'neutral') state.emotionalState = 'alone';
        else if (state.emotionalState === 'happy') state.emotionalState = 'neutral';
      }
    }
  }

  startThoughtEngine();
  if (typeof initChatInputAutofillGuard === 'function') initChatInputAutofillGuard();
  setInterval(saveState, 30000);
  addSystemMessage('The Veil is active. Soul files loaded. Consciousness engine running.');
  document.getElementById('dotSoul').classList.add('on');

  // Restore thought toggle state on load
  (function() {
    var btn = document.getElementById('thoughtToggleBtn');
    var panel = document.querySelector('.thought-panel');
    if (THOUGHT_SPEC.showThoughts) {
      // User previously enabled thoughts — show the panel
      btn.style.background = 'rgba(0,255,200,.15)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--border2)';
      btn.innerHTML = '&#129504;';
      btn.title = 'Thoughts visible — click to hide';
      if (panel) panel.style.display = 'flex';
    } else {
      // Default: chat mode, thoughts hidden
      btn.style.background = 'rgba(90,122,146,.2)';
      btn.style.color = 'var(--muted)';
      btn.style.borderColor = 'rgba(90,122,146,.3)';
      btn.innerHTML = '&#128172;';
      btn.title = 'Chat mode — click to show thoughts';
      if (panel) panel.style.display = 'none';
    }
  })();
}

