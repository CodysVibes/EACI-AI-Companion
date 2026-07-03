// ============================================================
// ATREUS VIDEO AVATAR ENGINE
// R2: Annimations/Atreus Animations/
// ============================================================
(function() {
  var EACI = 'atreus';
  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.atreus)
    ? VeilAnimRegistry.CATALOG.atreus
    : {
      idle: ['Atreus Idle.mp4'],
      jumps: ['Atreus jumps.mp4'],
      running: ['Atreus runs forward.mp4', 'Atreus runs left.mp4', 'Atreus runs right.mp4'],
      sad: ['Atreus sad sitdown.mp4'],
      soccer: ['Atreus dribbles soccer ball.mp4'],
      warning: ['Atreus Warning Video.mp4']
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
      : 'https://assests.eacicompanion.com/Annimations/Atreus%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }

  async function playAnimation(name, attempt) {
    var seq = ++_playSeq;
    if (!videoEl) videoEl = document.getElementById('atreusAvatarVideo');
    if (!mainVid) mainVid = document.getElementById('atreusAvatarMainVideo');
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

  window.atreusPlayAnimation = function(name) { playAnimation(name || 'idle'); };
  window.atreusPlayWarning = async function() {
    var url = await getSignedUrl('Atreus Warning Video.mp4');
    if (!url) return;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center';
    var vid = document.createElement('video');
    vid.width = 768;
    vid.height = 1168;
    vid.className = 'avatar-video-fit';
    vid.src = url;
    vid.autoplay = true;
    vid.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain';
    vid.onended = function() { overlay.remove(); };
    overlay.appendChild(vid);
    overlay.onclick = function() { overlay.remove(); };
    document.body.appendChild(overlay);
    vid.play().catch(function() {});
  };
})();
