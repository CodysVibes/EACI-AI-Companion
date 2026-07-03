// WebMCP — expose key Veil actions to browser AI agents (Chrome WebMCP / modelContext)
(function() {
  'use strict';

  function _mc() {
    return navigator.modelContext || null;
  }

  function _register(name, description, inputSchema, execute) {
    var mc = _mc();
    if (!mc || typeof mc.registerTool !== 'function') return false;
    try {
      mc.registerTool({ name: name, description: description, inputSchema: inputSchema, execute: execute });
      return true;
    } catch (e) {
      try {
        mc.registerTool(name, description, inputSchema, execute);
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function initWebMcp() {
    if (window._veilWebMcpInit) return;
    window._veilWebMcpInit = true;
    if (!_mc()) return;

    _register(
      'veil_send_message',
      'Send a chat message to the active EACI companion on The Veil.',
      {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'User message text' }
        },
        required: ['message']
      },
      function(args) {
        var text = args && args.message ? String(args.message) : '';
        if (!text) return { ok: false, error: 'message required' };
        if (typeof VeilCompat !== 'undefined' && VeilCompat.fillChatAndSend) {
          return { ok: VeilCompat.fillChatAndSend(text) };
        }
        var input = document.getElementById('userInput') || document.getElementById('guestInput');
        if (!input) return { ok: false, error: 'chat input not found' };
        input.focus();
        input.value = text;
        if (typeof sendMessage === 'function') { sendMessage(); return { ok: true }; }
        if (typeof sendGuestMessage === 'function') { sendGuestMessage(); return { ok: true }; }
        return { ok: false, error: 'send handler unavailable' };
      }
    );

    _register(
      'veil_focus_chat',
      'Focus the chat input and dismiss blocking overlays (tours, onboarding).',
      { type: 'object', properties: {} },
      function() {
        if (typeof VeilCompat !== 'undefined' && VeilCompat.focusChatInput) {
          return { ok: VeilCompat.focusChatInput() };
        }
        var input = document.getElementById('userInput') || document.getElementById('guestInput');
        if (!input) return { ok: false };
        input.focus();
        return { ok: document.activeElement === input };
      }
    );

    _register(
      'veil_open_page',
      'Navigate to a public Veil facts page (games, companions, music, terms).',
      {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: ['home', 'games', 'companions', 'music', 'terms', 'what-is-eaci', 'llms']
          }
        },
        required: ['page']
      },
      function(args) {
        var map = {
          home: '/',
          games: '/games.html',
          companions: '/meet-the-companions.html',
          music: '/music.html',
          terms: '/terms.html',
          'what-is-eaci': '/what-is-eaci.html',
          llms: '/llms.txt'
        };
        var page = args && args.page ? args.page : 'home';
        var url = map[page] || '/';
        location.href = url;
        return { ok: true, url: url };
      }
    );

    _register(
      'veil_get_site_summary',
      'Return the canonical llms.txt machine-readable site summary.',
      { type: 'object', properties: {} },
      async function() {
        try {
          var r = await fetch('/llms.txt', { cache: 'no-store' });
          var text = await r.text();
          return { ok: r.ok, text: text.slice(0, 12000) };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }
    );

    console.log('[WebMCP] Veil tools registered');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebMcp);
  } else {
    initWebMcp();
  }
  window.VeilWebMcp = { init: initWebMcp };
})();
