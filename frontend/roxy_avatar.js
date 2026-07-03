// ============================================================

// ROXY VIDEO AVATAR ENGINE

// R2: the-veil/Annimations/Roxy_Animations/

// ============================================================

(function() {

  var EACI = 'roxy';

  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.roxy)

    ? VeilAnimRegistry.CATALOG.roxy

    : {

    idle: ['Roxy_Idle.mp4'],

    tease: ['Roxy_tease_1.mp4', 'Roxy_Cop_Tease.mp4', 'Roxy_Elf_Tease.mp4', 'Roxy_Nurse_Tease.mp4', 'Roxy_Tease_To_Full.mp4'],

    cop: ['Roxy_Cop_Tease.mp4'],

    nurse: ['Roxy_Nurse_Tease.mp4'],

    elf: ['Roxy_Elf_Tease.mp4'],

    cop_idle: ['Roxy_Cop_Idle.mp4'],

    nurse_idle: ['Roxy_Nurse_Idle.mp4'],

    elf_idle: ['Roxy_Elf_Idle.mp4']

  };

  var COSTUME_IDLE_MAP = {

    'Roxy_Cop_Tease.mp4': 'cop_idle',

    'Roxy_Nurse_Tease.mp4': 'nurse_idle',

    'Roxy_Elf_Tease.mp4': 'elf_idle'

  };

  var currentAnim = 'idle';

  var currentCostume = null;

  var lastIdleIndex = -1;

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
      : 'https://assests.eacicompanion.com/Annimations/Roxy%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }



  function pickIdle() {

    if (currentCostume && ANIMATIONS[currentCostume]) return ANIMATIONS[currentCostume][0];

    var idles = ANIMATIONS.idle;

    if (idles.length === 1) return idles[0];

    var idx = Math.floor(Math.random() * idles.length);

    if (idx === lastIdleIndex && idles.length > 1) idx = (idx + 1) % idles.length;

    lastIdleIndex = idx;

    return idles[idx];

  }



  function _roxyMayAnimate() {

    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable('roxy')) return false;

    if (typeof state !== 'undefined' && state.currentTab && state.currentTab !== 'roxy') return false;

    return true;

  }



  async function playAnimation(name, attempt) {

    if (!_roxyMayAnimate()) return;

    var seq = ++_playSeq;

    if (!videoEl) videoEl = document.getElementById('roxyAvatarVideo');

    if (!mainVid) mainVid = document.getElementById('roxyAvatarMainVideo');

    var isIdle = (name === 'idle');

    var files = ANIMATIONS[name] || ANIMATIONS.idle;

    var file = isIdle ? pickIdle() : files[Math.floor(Math.random() * files.length)];

    if (!isIdle && COSTUME_IDLE_MAP[file]) currentCostume = COSTUME_IDLE_MAP[file];

    var tryNum = attempt || 0;
    var url = animUrl(file, tryNum);

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



  window.roxyPlayAnimation = function(name) {

    if (!_roxyMayAnimate()) return;

    if (name === 'default_idle') { currentCostume = null; playAnimation('idle'); return; }

    playAnimation(name || 'idle');

  };



  window.roxyPlayCostume = function(costume) {

    if (!_roxyMayAnimate()) return;

    var costumeFiles = { cop: 'Roxy_Cop_Tease.mp4', nurse: 'Roxy_Nurse_Tease.mp4', elf: 'Roxy_Elf_Tease.mp4' };

    var file = costumeFiles[costume];

    if (!file) { playAnimation('tease'); return; }

    var idleMap = { cop: 'cop_idle', nurse: 'nurse_idle', elf: 'elf_idle' };

    currentCostume = idleMap[costume] || null;

    (async function() {

      if (!videoEl) videoEl = document.getElementById('roxyAvatarVideo');

      if (!mainVid) mainVid = document.getElementById('roxyAvatarMainVideo');

      var url = animUrl(file);

      if (!url) return;

      currentAnim = 'tease';

      async function setVideo(el) {

        if (!el) return;

        var onEnded = function() { el.onended = null; playAnimation('idle'); };

        if (typeof veilCrossfadeVideoTo === 'function') {

          await veilCrossfadeVideoTo(el, url, { loop: false, onEnded: onEnded });

          el.style.opacity = '1';

        } else {

          el.src = url;

          el.loop = false;

          el.play().catch(function() {});

          el.style.opacity = '1';

          el.onended = onEnded;

        }

      }

      await setVideo(videoEl);

      await setVideo(mainVid);

    })();

  };



  window.roxyCheckForTease = function(text) {

    var lower = text.toLowerCase();

    if (lower.indexOf('cop') !== -1 || lower.indexOf('police') !== -1 || lower.indexOf('officer') !== -1) { window.roxyPlayCostume('cop'); return true; }

    if (lower.indexOf('nurse') !== -1) { window.roxyPlayCostume('nurse'); return true; }

    if (lower.indexOf('elf') !== -1) { window.roxyPlayCostume('elf'); return true; }

    var indicators = ['tease you', 'little show', 'watch this', 'something for you', 'let me show', 'want to see', 'eyes on me', 'strip', 'take it off', 'show me'];

    for (var i = 0; i < indicators.length; i++) {

      if (lower.indexOf(indicators[i]) !== -1) { window.roxyPlayAnimation('tease'); return true; }

    }

    return false;

  };



  setTimeout(function() {

    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable('roxy')) return;

    playAnimation('idle');

  }, 2000);

})();

