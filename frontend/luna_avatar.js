// ============================================================
// LUNA VIDEO AVATAR ENGINE
// R2: Annimations/Luna Animations/
// ============================================================
(function() {
  var EACI = 'luna';
  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.luna)
    ? VeilAnimRegistry.CATALOG.luna
    : {
      idle: ['Luna Idle.mp4'],
      eats: ['Luna eats.mp4'],
      flies: ['Luna Flies.mp4'],
      sleeps: ['Luna sleeps in lap.mp4'],
      spin: ['Luna spin and i see you.mp4']
    };
  var currentAnim = 'idle';
  var videoEl = null;
  var mainVid = null;
  var _playSeq = 0;

  async function getSignedUrl(file, attempt) {
    if (typeof veilEaciAnimUrlCandidates === 'function') {
      var list = veilEaciAnimUrlCandidates(EACI, file);
      var idx = Math.min(attempt || 0, list.length - 1);
      return list[idx] || list[0];
    }
    if (typeof veilEaciAnimUrl === 'function') return veilEaciAnimUrl(EACI, file);
    var base = (typeof VeilAnimRegistry !== 'undefined')
      ? VeilAnimRegistry.folderBase(EACI, true)
      : 'https://assests.eacicompanion.com/Annimations/Luna%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }

  async function playAnimation(name, attempt) {
    var seq = ++_playSeq;
    if (!videoEl) videoEl = document.getElementById('lunaAvatarVideo');
    if (!mainVid) mainVid = document.getElementById('lunaAvatarMainVideo');
    var isIdle = (name === 'idle');
    var files = ANIMATIONS[name] || ANIMATIONS.idle;
    var file = files[Math.floor(Math.random() * files.length)];
    var tryNum = attempt || 0;
    var url = await getSignedUrl(file, tryNum);
    if (!url) return;
    currentAnim = name;

    async function setVideo(el) {
      if (!el || seq !== _playSeq) return;
      el.onerror = function() {
        if (tryNum < 2) {
          setTimeout(function() { playAnimation(name, tryNum + 1); }, 1000 * (tryNum + 1));
        }
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

  window.lunaPlayAnimation = function(name) { playAnimation(name || 'idle'); };
})();
