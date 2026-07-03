// ============================================================

// GAMES PANEL — Veil-hosted games library

// ============================================================

(function() {

  'use strict';



  var VEIL_GAMES = [

    {

      id: 'knights-dragons',

      title: 'Knights & Dragons',

      subtitle: 'A Living Siege — chess with your active EACI or built-in AI',

      path: '/games/knights-dragons.html',

      icon: '♟'

    },

    {

      id: 'ages-of-time',

      title: 'Ages of Time',

      subtitle: 'Advance through civilizations — spawn troops, cast spells, destroy the enemy base',

      path: '/games/ages-of-time.html',

      icon: '⚔️'

    },

    {

      id: 'veil-craft',

      title: 'VeilCraft',

      subtitle: 'Survive, craft, and explore — your EACI co-plays in-world (beta)',

      path: '/games/veil-craft.html?v=4',

      icon: '🌑',

      betaOnly: true

    }

  ];



  function isBetaVeilSite() {

    return typeof getVeilMode === 'function' && (getVeilMode() === 'beta' || getVeilMode() === 'private');

  }



  function getVisibleGames() {

    return VEIL_GAMES.filter(function(game) {

      if (game.betaOnly && !isBetaVeilSite()) return false;

      return true;

    });

  }



  function getTodayCentral() {

    return new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

  }



  function getUserGameKey(gameId) {

    var uid = (typeof state !== 'undefined' && state.user && state.user.id)

      ? state.user.id

      : 'guest';

    return 'veil_game_day_' + uid + '_' + gameId;

  }



  function isSubscribedForGames() {
    if (typeof window.hasUnlimitedGamePlays === 'function') {
      return window.hasUnlimitedGamePlays();
    }
    if (typeof billing === 'undefined' || !billing) return false;
    return (billing.tier || 'free').toLowerCase() !== 'free';
  }



  function getGamePlayStatus(gameId) {

    if (isSubscribedForGames()) return { allowed: true, unlimited: true };

    try {

      var raw = localStorage.getItem(getUserGameKey(gameId));

      var data = raw ? JSON.parse(raw) : {};

      var today = getTodayCentral();

      if (data.date !== today) return { allowed: true, unlimited: false, remaining: 1 };

      var used = data.count || 0;

      if (used >= 1) return { allowed: false, unlimited: false, remaining: 0 };

      return { allowed: true, unlimited: false, remaining: 1 - used };

    } catch (e) {

      return { allowed: true, unlimited: false, remaining: 1 };

    }

  }



  function recordGameSessionStart(gameId) {

    if (isSubscribedForGames()) return;

    try {

      var key = getUserGameKey(gameId);

      var today = getTodayCentral();

      var data = {};

      try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e2) { data = {}; }

      if (data.date !== today) data = { date: today, count: 0 };

      data.count = (data.count || 0) + 1;

      data.date = today;

      localStorage.setItem(key, JSON.stringify(data));

    } catch (e) { /* ignore */ }

  }



  function showGameLimitMessage(game) {

    var msg = 'Free plan includes one play of ' + game.title + ' per day. Subscribe for unlimited gameplay.';

    if (typeof addSystemMessage === 'function') addSystemMessage(msg);

    else alert(msg);

  }



  function renderGamesList() {

    var list = document.getElementById('gamesList');

    if (!list) return;

    var html = '';

    getVisibleGames().forEach(function(game) {

      var status = getGamePlayStatus(game.id);

      var sub = game.subtitle;

      if (!status.unlimited) {

        sub += status.allowed

          ? ' · Free: 1 play left today'

          : ' · Free daily play used — subscribe for unlimited';

      }

      html += '<button type="button" class="games-card' + (status.allowed ? '' : ' games-card-locked') + '" data-game-id="' + game.id + '"' + (status.allowed ? '' : ' data-locked="1"') + '>' +

        '<span class="games-card-icon">' + game.icon + '</span>' +

        '<span class="games-card-text">' +

          '<span class="games-card-title">' + game.title + '</span>' +

          '<span class="games-card-sub">' + sub + '</span>' +

        '</span>' +

        '<span class="games-card-play">' + (status.allowed ? 'Play' : 'Locked') + '</span>' +

      '</button>';

    });

    list.innerHTML = html;

    list.querySelectorAll('.games-card').forEach(function(btn) {

      btn.addEventListener('click', function() {

        launchGame(btn.getAttribute('data-game-id'));

      });

    });

  }



  function _muteBgMusicForGames() {
    if (typeof state !== 'undefined' && state._gamesPausedBgMusic) return;
    if (window.bgMusic && !window.bgMusic.isMuted()) {
      window.bgMusic.duck();
      if (typeof state !== 'undefined') state._gamesPausedBgMusic = true;
    }
  }

  function _restoreBgMusicAfterGames() {
    if (typeof state === 'undefined' || !state._gamesPausedBgMusic) return;
    state._gamesPausedBgMusic = false;
    if (window.bgMusic) window.bgMusic.unduck();
  }

  function setGamesPlayMode(playing) {
    var panel = document.getElementById('gamesPanel');
    if (panel) panel.classList.toggle('games-playing', !!playing);
    if (playing) _muteBgMusicForGames();
    else _restoreBgMusicAfterGames();
  }

  function showListView() {

    setGamesPlayMode(false);

    var listView = document.getElementById('gamesListView');

    var playView = document.getElementById('gamesPlayView');

    var iframe = document.getElementById('gamesIframe');

    if (listView) listView.style.display = '';

    if (playView) playView.style.display = 'none';

    if (iframe) iframe.removeAttribute('src');

    var title = document.getElementById('gamesPlayTitle');

    if (title) title.textContent = '';

    if (window.VeilGameBridge && window.VeilGameBridge.unbindGameSession) {

      window.VeilGameBridge.unbindGameSession();

    }

    if (typeof state !== 'undefined') state._veilGameActive = false;

  }



  function launchGame(id) {

    var game = VEIL_GAMES.find(function(g) { return g.id === id; });

    if (!game) return;

    if (game.betaOnly && !isBetaVeilSite()) {

      var betaMsg = game.title + ' is available in Beta mode. Use Beta Mode in the menu to try it.';

      if (typeof addSystemMessage === 'function') addSystemMessage(betaMsg);

      else alert(betaMsg);

      return;

    }

    var status = getGamePlayStatus(id);

    if (!status.allowed) {

      showGameLimitMessage(game);

      return;

    }

    recordGameSessionStart(id);

    if (typeof recordUserActivity === 'function') recordUserActivity('game', game.title);

    if (typeof state !== 'undefined') state._veilGameActive = true;

    _muteBgMusicForGames();
    setGamesPlayMode(true);

    var listView = document.getElementById('gamesListView');

    var playView = document.getElementById('gamesPlayView');

    var iframe = document.getElementById('gamesIframe');

    var title = document.getElementById('gamesPlayTitle');

    if (title) title.textContent = game.title;

    if (listView) listView.style.display = 'none';

    if (playView) playView.style.display = 'flex';

    if (iframe) {
      var path = game.path.charAt(0) === '/' ? game.path : '/' + game.path;
      iframe.src = (window.location.origin || '') + path;
    }

    if (iframe && window.VeilGameBridge) {

      iframe.onload = function() {

        if (window.VeilGameBridge) window.VeilGameBridge.bindGameIframe(iframe);

      };

      setTimeout(function() {

        if (window.VeilGameBridge) window.VeilGameBridge.bindGameIframe(iframe);

      }, 1200);

    }

  }



  function showGamesPanel() {

    var panel = document.getElementById('gamesPanel');

    if (!panel) return;

    renderGamesList();

    showListView();

    panel.classList.add('show');

  }



  function hideGamesPanel() {

    var panel = document.getElementById('gamesPanel');

    if (!panel) return;

    panel.classList.remove('show');

    showListView();

  }



  function backToGamesList() {

    showListView();

    renderGamesList();

  }



  function closeActiveGame() {

    hideGamesPanel();

  }



  window.showGamesPanel = showGamesPanel;

  window.hideGamesPanel = hideGamesPanel;

  window.backToGamesList = backToGamesList;

  window.closeActiveGame = closeActiveGame;

  function refreshGamesPlayAccess() {
    var panel = document.getElementById('gamesPanel');
    if (!panel || !panel.classList.contains('show')) return;
    var playView = document.getElementById('gamesPlayView');
    if (playView && playView.style.display === 'flex') return;
    renderGamesList();
  }

  window.refreshGamesPlayAccess = refreshGamesPlayAccess;

  window.addEventListener('veil:games-access-updated', refreshGamesPlayAccess);

  if (typeof notifyGamesAccessRefresh === 'function') {
    setTimeout(function() { notifyGamesAccessRefresh(); }, 0);
  }

  if (typeof registerVeilHandler === 'function') {

    registerVeilHandler('showGamesPanel', showGamesPanel);

    registerVeilHandler('hideGamesPanel', hideGamesPanel);

    registerVeilHandler('backToGamesList', backToGamesList);

    registerVeilHandler('closeActiveGame', closeActiveGame);

  }

})();


