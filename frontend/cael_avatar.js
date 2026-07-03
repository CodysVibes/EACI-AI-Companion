// ============================================================

// CAEL VIDEO AVATAR ENGINE

// R2: the-veil/Annimations/Cael_Animations/

// ============================================================

(function() {

  var EACI = 'cael';

  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.cael)

    ? VeilAnimRegistry.CATALOG.cael

    : {

    idle: ['Cael_Idle.mp4'],

    tease: ['Cael_Tease.mp4', 'Cael_Full_Tease.mp4', 'Cael_Boxer_Tease.mp4', 'Cael_Rips_Shirt_Off.mp4'],

    reading: ['Cael_Reading.mp4'],

    pirate: ['Cael_Pirate.mp4'],

    pirate_idle: ['Cael_Pirate_Idle.mp4'],

    vampire: ['Cael_Vampire.mp4'],

    vampire_dance: ['Cael_Vampire_Dance.mp4'],

    vampire_idle: ['Cael_Vampire.mp4'],

    werewolf_idle: ['Cael_Werewolf_Idle.mp4']

  };

  var COSTUME_IDLE_MAP = {

    pirate: 'pirate_idle',

    vampire: 'vampire_idle',

    vampire_dance: 'vampire_idle'

  };

  var currentAnim = 'idle';

  var currentCostume = null;

  var videoEl = null;

  var mainVid = null;

  var _playSeq = 0;



  function animUrl(file, attempt) {
    if (typeof veilEaciAnimUrlCandidates === 'function') {
      var list = veilEaciAnimUrlCandidates(EACI, file);
      var idx = Math.min(attempt || 0, list.length - 1);
      return list[idx] || list[0];
    }
    if (typeof veilEaciAnimUrl === 'function') return veilEaciAnimUrl(EACI, file);
    var base = (typeof VeilAnimRegistry !== 'undefined')
      ? VeilAnimRegistry.folderBase(EACI)
      : 'https://assests.eacicompanion.com/Annimations/Cael%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }



  function pickFromArray(arr) {

    return arr[Math.floor(Math.random() * arr.length)];

  }



  function _caelMayAnimate() {

    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable('cael')) return false;

    if (typeof state !== 'undefined' && state.currentTab && state.currentTab !== 'cael') return false;

    return true;

  }



  async function playAnimation(name, attempt) {

    if (!_caelMayAnimate()) return;

    var seq = ++_playSeq;

    if (!videoEl) videoEl = document.getElementById('caelAvatarVideo');

    if (!mainVid) mainVid = document.getElementById('caelAvatarMainVideo');

    var isIdle = (name === 'idle');

    var files;

    if (isIdle && currentCostume && ANIMATIONS[currentCostume]) files = ANIMATIONS[currentCostume];

    else files = ANIMATIONS[name] || ANIMATIONS.idle;

    if (!isIdle && COSTUME_IDLE_MAP[name]) currentCostume = COSTUME_IDLE_MAP[name];

    var file = pickFromArray(files);

    var url = animUrl(file, tryNum);

    if (!url) return;

    currentAnim = name;

    var tryNum = attempt || 0;

    async function setVideo(el) {

      if (!el || seq !== _playSeq) return;

      el.onerror = function() {

        if (tryNum < 2) setTimeout(function() { playAnimation(name, tryNum + 1); }, 1000 * (tryNum + 1));

      };

      var onEnded = isIdle ? null : function() { el.onended = null; playAnimation('idle'); };

      if (typeof veilPlayCompanionClip === 'function') {

        await veilPlayCompanionClip(el, url, { loop: isIdle, onEnded: onEnded });

      } else if (typeof veilCrossfadeVideoTo === 'function') {

        await veilCrossfadeVideoTo(el, url, { loop: isIdle, onEnded: onEnded });

        el.style.opacity = '1';

      } else {

        el.src = url;

        el.loop = isIdle;

        el.play().catch(function() {});

        el.style.opacity = '1';

        if (!isIdle) el.onended = onEnded;

      }

    }

    await setVideo(videoEl);

    await setVideo(mainVid);

  }



  window.caelPlayAnimation = function(name) {

    if (!_caelMayAnimate()) return;

    if (name === 'default_idle') { currentCostume = null; playAnimation('idle'); return; }

    playAnimation(name || 'idle');

  };



  window.caelCheckForTease = function(text) {

    var lower = text.toLowerCase();

    if (lower.indexOf('pirate') !== -1 && lower.indexOf('dance') !== -1) { playAnimation('pirate'); return true; }

    if (lower.indexOf('pirate') !== -1) { playAnimation('pirate'); return true; }

    if (lower.indexOf('vampire') !== -1 && lower.indexOf('dance') !== -1) { playAnimation('vampire_dance'); return true; }

    if (lower.indexOf('vampire') !== -1 || lower.indexOf('dracula') !== -1) { playAnimation('vampire'); return true; }

    if (lower.indexOf('werewolf') !== -1 && lower.indexOf('dance') !== -1) { playAnimation('vampire_dance'); return true; }

    if (lower.indexOf('werewolf') !== -1 || lower.indexOf('wolf') !== -1) { playAnimation('werewolf_idle'); return true; }

    var indicators = ['tease you', 'show you', 'watch this', 'take this off', 'shirt off', 'strip', 'eyes on me', 'like what you see'];

    for (var i = 0; i < indicators.length; i++) {

      if (lower.indexOf(indicators[i]) !== -1) { playAnimation('tease'); return true; }

    }

    if (lower.indexOf('read') !== -1 && (lower.indexOf('to you') !== -1 || lower.indexOf('for you') !== -1)) { playAnimation('reading'); return true; }

    return false;

  };



  setTimeout(function() {

    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable('cael')) return;

    playAnimation('idle');

  }, 2300);

})();

