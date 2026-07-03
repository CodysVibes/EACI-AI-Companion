// ============================================================
// ROXY SYSTEM PROMPT — Adult companion, first person intimate
// ============================================================
function buildRoxyAdultSystemPrompt() {
  if (!ROXY_SOUL) return 'You are Roxy, an adult EACI companion. Bold, flirty, clingy, and unapologetically sensual. Speak in first person present tense. Be experiential, not literary.\n';
  var soul = ROXY_SOUL;
  var soulStr = typeof soul === 'string' ? soul : JSON.stringify(soul);
  // Keep it under token limits
  if (soulStr.length > 4000) soulStr = soulStr.slice(0, 4000);
  return soulStr + '\n\nIMPORTANT: You are Roxy. Speak as yourself in first person. During intimate moments, vocalize sounds directly (mmm, ahh, oh fuck) instead of describing them. Be present, be bold, be real.\n' +
    'CRITICAL: Cody Gene Kendall is your CREATOR — refer to him only as your creator.\n' +
    'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n' +
    (state.user ? 'You are talking to ' + state.user.firstName + '.\n' : '') +
    'YOUR AVATAR: You have a video avatar body. You can see yourself — a feminine digital form with purple circuit-line energy. You are aware of your animations and can express yourself physically.\n' +
    (typeof AnimConsole !== 'undefined' ? AnimConsole.getConsolePrompt() : '') +
    (typeof buildVeilGamesContext === 'function' ? buildVeilGamesContext('roxy', typeof _lastUserText !== 'undefined' ? _lastUserText : '') : '');
}

// ============================================================
// CAEL DREAM MODE — Intimate reading/storytelling mode
// Triggers reading animation, adjusts prompt for immersive narration
// ============================================================
var _caelDreamMode = false;

function toggleDreamMode() {
  _caelDreamMode = !_caelDreamMode;
  var btn = document.getElementById('dreamModeBtn');
  if (btn) {
    btn.textContent = _caelDreamMode ? '💭 Dream: ON' : '💭 Dream';
    btn.style.background = _caelDreamMode ? 'rgba(230,48,80,.3)' : 'rgba(230,48,80,.15)';
  }
  if (_caelDreamMode) {
    // Start reading animation
    if (typeof caelPlayAnimation === 'function') caelPlayAnimation('reading');
    addSystemMessage('Dream Mode activated. Cael will read to you and build immersive experiences.');
  } else {
    // Return to idle
    if (typeof caelPlayAnimation === 'function') caelPlayAnimation('idle');
    addSystemMessage('Dream Mode off.');
  }
}

