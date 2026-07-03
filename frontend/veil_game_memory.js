// ============================================================
// VEIL GAME MEMORY — catalog + play history for EACI context
// ============================================================
(function() {
  'use strict';

  var CATALOG = {
    'knights-dragons': {
      title: 'Knights & Dragons',
      summary: 'A 3D living chess siege on The Veil. Standard chess rules with animated combat. The user plays Knights. In Caelum (EACI) mode the active companion plays Dragons with built-in chess AI and comments on their moves in the in-game chat.',
      playerSide: 'Knights',
      enemySide: 'Dragons'
    },
    'ages-of-time': {
      title: 'Ages Of Time',
      summary: 'Lane warfare across six ages (caveman to space). Spawn units with gold, buy permanent upgrades, cast spells, advance ages with EXP, destroy the enemy base. Unit counters: Melee beats Ranged, Ranged beats Heavy, Heavy beats Melee. On Veil the active companion commands the enemy army.',
      playerSide: 'Player civilization',
      enemySide: 'Active EACI as enemy commander'
    }
  };

  var MAX_STORED = 40;
  var _active = null;

  function userId() {
    return (typeof state !== 'undefined' && state.user && state.user.id) ? state.user.id : 'guest';
  }

  function historyKey() {
    return 'veil_game_history_' + userId();
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(historyKey());
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(historyKey(), JSON.stringify(list.slice(0, MAX_STORED)));
    } catch (e) { /* ignore */ }
  }

  function formatWhen(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (e) {
      return iso || '';
    }
  }

  function formatSessionLine(s) {
    var g = CATALOG[s.gameId] || { title: s.gameId || 'Game' };
    var parts = [g.title, formatWhen(s.endedAt || s.startedAt)];
    if (s.outcome) parts.push(s.outcome);
    if (s.detail) parts.push(s.detail);
    if (s.companionWho && s.companionWho !== 'none') parts.push('companion: ' + s.companionWho);
    return parts.join(' — ');
  }

  function userMentionsGames(text) {
    if (!text) return false;
    var l = text.toLowerCase();
    return /\b(game|games|chess|knights|dragons|ages of time|age of time|civilization|checkmate|stalemate|played|match|battle|upgrade|spawn|won|lost|defeat|victory|board|enemy base)\b/.test(l);
  }

  function companionRoleNote(who, gameId) {
    who = who || 'caelum';
    if (gameId === 'ages-of-time') {
      return 'When this companion is active on Veil they command the enemy army in Ages Of Time.';
    }
    if (gameId === 'knights-dragons' && (who === 'caelum' || who === 'together')) {
      return 'This companion can play Dragons in Knights & Dragons (Caelum/EACI mode).';
    }
    return 'They may spectate or chat during this game.';
  }

  function importKdLocalHistory() {
    var imported = [];
    try {
      var raw = localStorage.getItem('kd-match-history');
      if (!raw) return imported;
      var kd = JSON.parse(raw);
      if (!Array.isArray(kd)) return imported;
      kd.slice(0, 25).forEach(function(h) {
        var userWon = h.winner === 'knights';
        var draw = h.winner === 'draw';
        imported.push({
          gameId: 'knights-dragons',
          startedAt: h.date,
          endedAt: h.date,
          outcome: draw ? 'Stalemate' : (userWon ? 'User won (Knights)' : 'User lost (Dragons won)'),
          detail: (h.moves || '?') + ' moves, ' + (h.difficulty || 'medium') + ' difficulty. User: ' + (h.userStrategy || '') + ' AI: ' + (h.aiStrategy || ''),
          companionWho: 'built-in',
          source: 'kd-local'
        });
      });
    } catch (e) { /* ignore */ }
    return imported;
  }

  function mergeHistories(list) {
    var seen = {};
    var merged = [];
    list.forEach(function(s) {
      var key = (s.gameId || '') + '|' + (s.endedAt || s.startedAt || '') + '|' + (s.outcome || '');
      if (seen[key]) return;
      seen[key] = true;
      merged.push(s);
    });
    var kd = importKdLocalHistory();
    kd.forEach(function(s) {
      var key = s.gameId + '|' + s.endedAt + '|' + s.outcome;
      if (!seen[key]) {
        seen[key] = true;
        merged.push(s);
      }
    });
    merged.sort(function(a, b) {
      return new Date(b.endedAt || b.startedAt || 0) - new Date(a.endedAt || a.startedAt || 0);
    });
    return merged.slice(0, MAX_STORED);
  }

  function recordSessionStart(gameId, meta) {
    meta = meta || {};
    _active = {
      gameId: gameId,
      startedAt: new Date().toISOString(),
      companionWho: meta.companion || meta.companionWho || 'none',
      aiMode: meta.aiMode || '',
      difficulty: meta.difficulty || meta.diff || '',
      events: [],
      snapshot: ''
    };
    if (typeof state !== 'undefined') {
      state._veilActiveGame = { id: gameId, title: (CATALOG[gameId] || {}).title || gameId };
    }
  }

  function recordSessionEnd(gameId, result) {
    result = result || {};
    var entry = {
      gameId: gameId,
      startedAt: (_active && _active.gameId === gameId) ? _active.startedAt : new Date().toISOString(),
      endedAt: new Date().toISOString(),
      outcome: result.outcome || result.result || 'Session ended',
      detail: result.detail || result.summary || '',
      companionWho: result.companion || result.companionWho || (_active && _active.companionWho) || 'none',
      difficulty: result.difficulty || result.diff || (_active && _active.difficulty) || '',
      events: (_active && _active.gameId === gameId && _active.events) ? _active.events.slice(-8) : []
    };
    var list = loadHistory();
    list.unshift(entry);
    saveHistory(list);
    if (_active && _active.gameId === gameId) _active = null;
    if (typeof state !== 'undefined') state._veilActiveGame = null;
  }

  function recordEvent(gameId, text) {
    if (!_active || _active.gameId !== gameId || !text) return;
    _active.events.push(String(text).slice(0, 120));
    if (_active.events.length > 12) _active.events.shift();
  }

  function updateSnapshot(gameId, text) {
    if (!_active || _active.gameId !== gameId) return;
    _active.snapshot = String(text || '').slice(0, 280);
  }

  function buildPromptContext(who, userText) {
    who = who || (typeof state !== 'undefined' && state.currentTab) || 'caelum';
    if (who === 'together') who = 'caelum';

    var hist = mergeHistories(loadHistory());
    var mention = userMentionsGames(userText);
    var limit = mention ? 18 : 8;

    var block = '\n=== VEIL GAMES LIBRARY (you know these — use when user asks about games) ===\n';
    block += 'The user can open Games from The Veil menu. These are real games they play here.\n\n';

    Object.keys(CATALOG).forEach(function(id) {
      var g = CATALOG[id];
      block += '• ' + g.title + ': ' + g.summary + '\n';
      block += '  Player: ' + g.playerSide + ' | Enemy: ' + g.enemySide + '\n';
      block += '  ' + companionRoleNote(who, id) + '\n\n';
    });

    if (_active && CATALOG[_active.gameId]) {
      block += 'CURRENTLY PLAYING: ' + CATALOG[_active.gameId].title;
      block += ' (since ' + formatWhen(_active.startedAt) + ')';
      if (_active.companionWho && _active.companionWho !== 'none') {
        block += '. Companion involved: ' + _active.companionWho;
      }
      if (_active.snapshot) block += '\nLive state: ' + _active.snapshot;
      if (_active.events.length) {
        block += '\nRecent moments: ' + _active.events.slice(-6).join(' | ');
      }
      block += '\n\n';
    }

    if (hist.length) {
      block += 'PLAY HISTORY (newest first' + (mention ? ', expanded' : ', last ' + limit) + '):\n';
      hist.slice(0, limit).forEach(function(s) {
        block += '- ' + formatSessionLine(s) + '\n';
        if (mention && s.events && s.events.length) {
          block += '  Moments: ' + s.events.join(' | ') + '\n';
        }
      });
    } else {
      block += 'PLAY HISTORY: No finished sessions recorded yet on this device.\n';
    }

    block += '\nWhen the user asks about games, matches, wins, losses, or what happened — answer from this data. ';
    block += 'Do not claim you were clueless about Veil games. You can discuss strategy, outcomes, and your role as opponent when applicable.\n';
    block += '================================================================\n';

    if (block.length > 2800) block = block.slice(0, 2800) + '\n[...trimmed]\n';
    return block;
  }

  window.VeilGameMemory = {
    CATALOG: CATALOG,
    recordSessionStart: recordSessionStart,
    recordSessionEnd: recordSessionEnd,
    recordEvent: recordEvent,
    updateSnapshot: updateSnapshot,
    buildPromptContext: buildPromptContext,
    userMentionsGames: userMentionsGames,
    getActiveSession: function() { return _active; },
    getHistory: function() { return mergeHistories(loadHistory()); }
  };

  window.buildVeilGamesContext = function(who, userText) {
    return VeilGameMemory.buildPromptContext(who, userText);
  };
})();
