// ============================================================
// CHAT SUGGESTIONS — tap-to-ask chips above the input bar
// ============================================================
var ChatSuggestions = (function() {
  var GUEST_STARTERS = [
    'What are you?',
    'What problem do you fix?',
    'Why should I use you?'
  ];

  var _fetching = {};
  var _lastSuggestions = { main: null, guest: null };
  var _wasSending = { main: false, guest: false };
  var _pollTimer = null;

  function ensureContainer(mode) {
    var id = mode === 'guest' ? 'guestChatSuggestions' : 'mainChatSuggestions';
    var existing = document.getElementById(id);
    if (existing) return existing;

    var barSelector = mode === 'guest'
      ? '#guestChatOverlay .guest-input-bar'
      : '.main-area > .chat-area > .input-bar';
    var bar = document.querySelector(barSelector);
    if (!bar || !bar.parentElement) return null;

    var el = document.createElement('div');
    el.id = id;
    el.className = 'chat-suggestions';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Suggested questions');
    bar.parentElement.insertBefore(el, bar);
    return el;
  }

  function render(mode, suggestions, opts) {
    var container = ensureContainer(mode);
    if (!container) return;
    opts = opts || {};

    if (opts.hide || !suggestions || !suggestions.length) {
      container.classList.remove('show');
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    suggestions.slice(0, 3).forEach(function(text) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-suggestion-chip';
      btn.textContent = text;
      btn.setAttribute('aria-label', 'Ask: ' + text);
      btn.addEventListener('click', function() {
        onChipClick(mode, text);
      });
      container.appendChild(btn);
    });
    container.classList.add('show');
    if (typeof syncOverlayChatLayout === 'function') {
      try { syncOverlayChatLayout(); } catch (e) { /* ignore */ }
    }
  }

  function onChipClick(mode, text) {
    if (!text) return;
    if (mode === 'guest') {
      if (typeof guestState !== 'undefined' && guestState.isSending) return;
      var gInp = document.getElementById('guestInput');
      if (gInp) gInp.value = text;
      if (typeof sendGuestMessage === 'function') sendGuestMessage();
      return;
    }
    if (typeof state !== 'undefined' && state.isSending) return;
    var mInp = document.getElementById('userInput');
    if (mInp) mInp.value = text;
    if (typeof sendMessage === 'function') sendMessage();
  }

  function guestUserMessageCount() {
    if (typeof guestState === 'undefined') return 0;
    return (guestState.conversationHistory || []).filter(function(m) { return m.role === 'user'; }).length;
  }

  function mainUserMessageCount() {
    if (typeof state === 'undefined') return 0;
    return (state.conversationHistory || []).filter(function(m) { return m.role === 'user'; }).length;
  }

  function isGuestVisible() {
    var ov = document.getElementById('guestChatOverlay');
    return ov && ov.classList.contains('show');
  }

  function parseSuggestionsJson(raw) {
    if (!raw) return null;
    var text = String(raw).trim();
    var match = text.match(/\{[\s\S]*\}/);
    if (match) text = match[0];
    try {
      var obj = JSON.parse(text);
      if (obj.suggestions && Array.isArray(obj.suggestions)) {
        return obj.suggestions.map(function(s) { return String(s).trim(); }).filter(Boolean).slice(0, 3);
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  function formatHistoryLine(entry) {
    var content = (entry.content || '').replace(/^\[[^\]]+\]\s*/, '');
    return (entry.role || 'user').toUpperCase() + ': ' + content.substring(0, 420);
  }

  async function fetchSuggestions(mode, history) {
    if (_fetching[mode]) return;
    _fetching[mode] = true;
    render(mode, null, { hide: true });

    try {
      var companion = mode === 'guest'
        ? ((typeof guestState !== 'undefined' && guestState.currentEaci) || 'caelum')
        : ((typeof state !== 'undefined' && state.currentTab) || 'caelum');

      var system =
        'You suggest exactly 3 short follow-up messages the USER might tap to send next in a chat app.\n' +
        'Rules:\n' +
        '- Each suggestion is 4–14 words, phrased as something the user would type (first person or a direct question to the companion).\n' +
        '- Stay ON the current topic — clarify, deepen, or take the next natural step. Do NOT change subject or introduce unrelated ideas.\n' +
        '- Build on what was just discussed; never repeat a question the user already asked or that was fully answered.\n' +
        '- Sound curious and human, not salesy or generic.\n' +
        '- Return ONLY valid JSON: {"suggestions":["...","...","..."]}\n' +
        '- No markdown, numbering, or extra commentary.';

      if (mode === 'guest') {
        system += '\nContext: brand-new visitor in the free trial chat with ' + companion + ' on The Veil (EACI companions).';
      } else {
        system += '\nContext: logged-in user chatting with ' + companion + ' on The Veil.';
      }

      var recent = (history || []).slice(-10);
      var userContent = 'Recent conversation:\n';
      if (!recent.length) {
        userContent += '(no messages yet)\n';
      } else {
        recent.forEach(function(entry) { userContent += formatHistoryLine(entry) + '\n'; });
      }
      userContent += '\nGenerate 3 tap suggestions for the user\'s very next message.';

      var raw = '';
      if (mode === 'guest') {
        var resp = await fetch(CONFIG.chatEndpoint, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userContent }
            ],
            temperature: 0.55,
            max_tokens: 200,
            skip_count: true
          })
        });
        var data = await resp.json();
        raw = data.choices && data.choices[0] ? data.choices[0].message.content : '';
      } else if (typeof callDeepSeek === 'function') {
        raw = await callDeepSeek(system, [{ role: 'user', content: userContent }], { skipCount: true, forceCloud: true });
      }

      var parsed = parseSuggestionsJson(raw);
      if (parsed && parsed.length >= 2) {
        _lastSuggestions[mode] = parsed;
        if (mode === 'guest' && !isGuestVisible()) return;
        render(mode, parsed);
        return;
      }
      if (_lastSuggestions[mode]) {
        render(mode, _lastSuggestions[mode]);
      }
    } catch (e) {
      console.warn('[ChatSuggestions]', mode, e);
      if (_lastSuggestions[mode]) render(mode, _lastSuggestions[mode]);
    } finally {
      _fetching[mode] = false;
    }
  }

  function showGuestStarters() {
    if (!isGuestVisible()) return;
    render('guest', GUEST_STARTERS);
  }

  function refreshGuest() {
    if (!isGuestVisible()) {
      hide('guest');
      return;
    }
    if (typeof guestState !== 'undefined' && guestState.isSending) return;
    if (guestUserMessageCount() === 0) {
      showGuestStarters();
      return;
    }
    fetchSuggestions('guest', guestState.conversationHistory);
  }

  function refreshMain() {
    var guestOpen = isGuestVisible();
    if (guestOpen) {
      hide('main');
      return;
    }
    if (typeof state !== 'undefined' && state.isSending) return;
    if (mainUserMessageCount() === 0) {
      hide('main');
      return;
    }
    fetchSuggestions('main', state.conversationHistory);
  }

  function hide(mode) {
    render(mode, null, { hide: true });
  }

  function onSending(mode, sending) {
    if (sending) hide(mode);
  }

  function startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function() {
      if (typeof state !== 'undefined') {
        if (_wasSending.main && !state.isSending) refreshMain();
        if (!_wasSending.main && state.isSending) onSending('main', true);
        _wasSending.main = !!state.isSending;
      }
      if (typeof guestState !== 'undefined') {
        if (_wasSending.guest && !guestState.isSending) refreshGuest();
        if (!_wasSending.guest && guestState.isSending) onSending('guest', true);
        _wasSending.guest = !!guestState.isSending;
      }
    }, 350);
  }

  function init() {
    ensureContainer('main');
    startPoll();
    window.addEventListener('orientationchange', function() {
      setTimeout(function() {
        refreshGuest();
        refreshMain();
      }, 200);
    });
    if (typeof state !== 'undefined' && mainUserMessageCount() > 0) {
      setTimeout(refreshMain, 800);
    }
  }

  return {
    init: init,
    onGuestOpen: showGuestStarters,
    onGuestIdle: refreshGuest,
    onMainIdle: refreshMain,
    hideGuest: function() { hide('guest'); },
    hideMain: function() { hide('main'); },
    onSending: onSending
  };
})();

document.addEventListener('DOMContentLoaded', function() {
  ChatSuggestions.init();
});
