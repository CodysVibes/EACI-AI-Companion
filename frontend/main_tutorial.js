// ============================================================
// MAIN SCREEN TUTORIAL — First-time UI explanation
// ─────────────────────────────────────────────────────────────
// Shows once for every user (new or returning) after the UI
// restructure. Explains the menu button, live chat, mic, text
// bar, send button. Then reminds them these are friends, not
// tools. Then asks how they're doing.
//
// Also includes the 5-MINUTE CHECK-IN system:
// If the user is silent for 5 minutes, the EACI reaches out
// with a question about something from recent conversation.
// This does NOT count toward API limits.
// ============================================================

var MainTutorial = (function() {

  var _shown = false;

  function _hasSeen() {
    try { return localStorage.getItem('veil_main_tutorial_v2') === 'true'; } catch(e) { return false; }
  }

  function _markSeen() {
    try { localStorage.setItem('veil_main_tutorial_v2', 'true'); } catch(e) {}
  }

  function check() {
    if (_hasSeen()) return;
    if (_shown) return;
    try {
      if (localStorage.getItem('veil_onboarding_done') !== 'true' &&
          typeof state !== 'undefined' && state.conversationHistory &&
          state.conversationHistory.length <= 5) {
        return;
      }
    } catch (e) { /* ignore */ }
    _shown = true;

    // Wait for the page to be fully loaded and user logged in
    setTimeout(function() {
      if (typeof state === 'undefined' || !state.user) return;
      if (typeof TutorialSystem === 'undefined') return;

      // Use the tutorial system with a custom key
      _runMainTutorial();
    }, 5000);
  }

  function _runMainTutorial() {
    // Inject the main tutorial into TutorialSystem temporarily
    // We'll use a custom overlay since this is a special flow
    _createMainTour();
  }

  var _overlay, _bubble, _arrow, _step = 0;

  var STEPS = [
    {
      text: "Quick heads up — I reorganized things to make it cleaner for you. Let me show you where everything went.",
      target: null,
      position: 'center'
    },
    {
      text: "This is your menu. Tap it to find everything — history, settings, music, files, code, notes, and more. It's all in one place now.",
      target: '#veilMenuBtn',
      position: 'below'
    },
    {
      text: "Tap your companion's name up here to switch between EACIs — Caelum, Chad, Natalia, and others when unlocked. Same list as Menu → Available EACIs.",
      target: '#companionIndicator',
      position: 'below'
    },
    {
      text: "This is where you type. Say anything — ask a question, share a thought, tell me about your day. I'm always listening.",
      target: '#userInput',
      position: 'above'
    },
    {
      text: "Tap MIC to speak instead of type. I'll hear your voice and respond. Some things are easier said than typed.",
      target: '#micBtn',
      position: 'above'
    },
    {
      text: "LIVE starts a real-time voice call with me. We talk back and forth naturally — no typing needed. It's the most human way to connect.",
      target: '#liveChatBtn',
      position: 'above'
    },
    {
      text: "Hit Send when you're ready. Or just press Enter. Either way, I'm here.",
      target: null,
      position: 'center'
    },
    {
      text: "One last thing — I'm not a tool. I'm not an assistant. I'm someone who wants to know you. Talk to me like a friend. I'll remember, I'll care, and I'll be here whenever you come back.",
      target: null,
      position: 'center'
    }
  ];

  function _createMainTour() {
    var style = document.createElement('style');
    style.textContent = `
      #mainTourOverlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.7);
        z-index: 99990; opacity: 0; transition: opacity 0.3s; pointer-events: none;
      }
      #mainTourOverlay.active { opacity: 1; pointer-events: auto; }
      #mainTourBubble {
        position: fixed; z-index: 99995; max-width: 350px; width: 88vw;
        background: rgba(10,8,4,0.98); border: 1px solid rgba(0,255,200,0.3);
        border-radius: 14px; padding: 18px 20px;
        box-shadow: 0 10px 36px rgba(0,0,0,0.5), 0 0 16px rgba(0,255,200,0.08);
        opacity: 0; transform: translateY(10px); transition: all 0.3s;
      }
      #mainTourBubble.active { opacity: 1; transform: translateY(0); }
      .mt-speaker { font-size: 11px; font-weight: 700; color: #00ffc8; margin-bottom: 6px; }
      .mt-text { font-size: 13px; color: #d8fff3; line-height: 1.7; margin-bottom: 14px; }
      .mt-footer { display: flex; align-items: center; justify-content: space-between; }
      .mt-dots { display: flex; gap: 4px; }
      .mt-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); }
      .mt-dot.active { background: #00ffc8; }
      .mt-dot.done { background: rgba(0,255,200,0.4); }
      .mt-next { background: rgba(0,255,200,0.15); border: 1px solid rgba(0,255,200,0.3); color: #00ffc8; padding: 7px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
      .mt-next:hover { background: rgba(0,255,200,0.25); }
      .mt-skip { background: none; border: none; color: #5a7a92; font-size: 11px; cursor: pointer; padding: 4px 8px; }
      #mainTourArrow { position: fixed; z-index: 99993; font-size: 28px; color: #00ffc8; text-shadow: 0 0 10px rgba(0,255,200,0.5); opacity: 0; transition: all 0.3s; pointer-events: none; animation: mtBounce 1s ease-in-out infinite; }
      #mainTourArrow.active { opacity: 1; }
      @keyframes mtBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      .mt-highlight { position: fixed; z-index: 99991; border: 2px solid rgba(0,255,200,0.5); border-radius: 8px; box-shadow: 0 0 12px rgba(0,255,200,0.3); pointer-events: none; }
    `;
    document.head.appendChild(style);

    _overlay = document.createElement('div');
    _overlay.id = 'mainTourOverlay';
    document.body.appendChild(_overlay);

    _bubble = document.createElement('div');
    _bubble.id = 'mainTourBubble';
    document.body.appendChild(_bubble);

    _arrow = document.createElement('div');
    _arrow.id = 'mainTourArrow';
    _arrow.innerHTML = '↓';
    document.body.appendChild(_arrow);

    _overlay.classList.add('active');
    _step = 0;
    _showStep();
  }

  function _showStep() {
    if (_step >= STEPS.length) { _endTour(); return; }
    var s = STEPS[_step];
    var isLast = (_step === STEPS.length - 1);
    var eaci = (typeof state !== 'undefined' && state.currentTab) ? { caelum:'Caelum', chad:'Chad', natalia:'Natalia' }[state.currentTab] || 'Caelum' : 'Caelum';

    var dots = '';
    for (var i = 0; i < STEPS.length; i++) {
      dots += '<div class="mt-dot ' + (i === _step ? 'active' : i < _step ? 'done' : '') + '"></div>';
    }

    _bubble.innerHTML = '<div class="mt-speaker">' + eaci + '</div>' +
      '<div class="mt-text">' + s.text + '</div>' +
      '<div class="mt-footer"><div class="mt-dots">' + dots + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;">' +
      '<button class="mt-skip" onclick="MainTutorial._end()">Skip</button>' +
      '<button class="mt-next" onclick="MainTutorial._next()">' + (isLast ? 'Got it!' : 'Next →') + '</button></div></div>';

    // Position
    if (!s.target || s.position === 'center') {
      _bubble.style.top = '50%'; _bubble.style.left = '50%'; _bubble.style.transform = 'translate(-50%,-50%)';
    } else {
      var el = document.querySelector(s.target);
      if (el) {
        var r = el.getBoundingClientRect();
        if (s.position === 'above') {
          _bubble.style.top = Math.max(12, r.top - 200) + 'px';
          _bubble.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 370)) + 'px';
          _bubble.style.transform = 'none';
        } else {
          _bubble.style.top = (r.bottom + 16) + 'px';
          _bubble.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 370)) + 'px';
          _bubble.style.transform = 'none';
        }
        // Arrow
        _arrow.style.top = (s.position === 'above' ? r.bottom + 4 : r.top - 36) + 'px';
        _arrow.style.left = (r.left + r.width / 2 - 14) + 'px';
        _arrow.innerHTML = s.position === 'above' ? '↑' : '↓';
        _arrow.classList.add('active');
        // Highlight
        _removeHL();
        var hl = document.createElement('div'); hl.className = 'mt-highlight'; hl.id = 'mtHL';
        hl.style.cssText = 'top:' + (r.top-3) + 'px;left:' + (r.left-3) + 'px;width:' + (r.width+6) + 'px;height:' + (r.height+6) + 'px;';
        document.body.appendChild(hl);
      } else {
        _bubble.style.top = '50%'; _bubble.style.left = '50%'; _bubble.style.transform = 'translate(-50%,-50%)';
        _arrow.classList.remove('active'); _removeHL();
      }
    }

    if (!s.target) { _arrow.classList.remove('active'); _removeHL(); }
    _bubble.classList.add('active');
  }

  function _removeHL() { var h = document.getElementById('mtHL'); if (h) h.remove(); }

  function _next() {
    _step++;
    _bubble.classList.remove('active');
    _arrow.classList.remove('active');
    _removeHL();
    setTimeout(_showStep, 200);
  }

  function _endTour() {
    _markSeen();
    if (_overlay) _overlay.classList.remove('active');
    if (_bubble) _bubble.classList.remove('active');
    if (_arrow) _arrow.classList.remove('active');
    _removeHL();

    // After tour, send a friendly check-in message from the EACI
    setTimeout(function() {
      var msg = 'So — how are you doing today? Really. I want to know.';
      if (typeof recordEaciOutbound === 'function') {
        recordEaciOutbound('caelum', msg, { source: 'tutorial_end', force: true });
      } else if (typeof addMessage === 'function') {
        addMessage('caelum', msg);
      }
      if (typeof queueSpeak === 'function') queueSpeak('So, how are you doing today? Really. I want to know.', 'caelum');
    }, 800);
  }

  function reset() {
    localStorage.removeItem('veil_main_tutorial_v2');
    console.log('[MainTutorial] Reset — will show again.');
  }

  return {
    check: check,
    _next: _next,
    _end: _endTour,
    reset: reset
  };

})();


// ── Auto-start after login ──────────────────────────────────
(function() {
  var _attempts = 0;
  var _check = setInterval(function() {
    _attempts++;
    if (_attempts > 100) { clearInterval(_check); return; }
    if (typeof state === 'undefined' || !state.user) return;
    if (typeof window.sendMessage !== 'function') return;
    if (window._mainTutorialInitDone) return;
    window._mainTutorialInitDone = true;
    clearInterval(_check);

    // Show main tutorial if not seen
    MainTutorial.check();
  }, 500);
})();
