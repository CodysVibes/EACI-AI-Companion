// ============================================================
// NATALIA VIDEO AVATAR ENGINE
// R2: the-veil/Annimations/Natalia_Animations/
// ============================================================
(function() {
  var EACI = 'natalia';
  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.natalia)
    ? VeilAnimRegistry.CATALOG.natalia
    : {
    idle: ['natalia_idle.mp4', 'Natalia_Coloring.mp4'],
    catch: ['Natalia_Catch.mp4'],
    crying: ['Natalia_Crying.mp4'],
    spins: ['Natalia_Spins.mp4'],
    warning: ['Natalia_Warning.mp4']
  };
  var currentAnim = 'idle';
  var lastIdleIndex = -1;
  var videoEl = null;
  var mainVid = null;
  var guestVid = null;
  var signedUrls = {};
  var _playSeq = 0;

  async function getSignedUrl(file, attempt) {
    if (typeof veilEaciAnimUrlCandidates === 'function') {
      var list = veilEaciAnimUrlCandidates(EACI, file);
      var idx = Math.min(attempt || 0, list.length - 1);
      return list[idx] || list[0];
    }
    if (typeof veilEaciAnimUrl === 'function') return veilEaciAnimUrl(EACI, file);
    var base = (typeof VeilAnimRegistry !== 'undefined')
      ? VeilAnimRegistry.folderBase(EACI)
      : 'https://assests.eacicompanion.com/Annimations/Natalia%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }

  function pickIdle() {
    var idles = ANIMATIONS.idle;
    if (idles.length === 1) return idles[0];
    var idx = Math.floor(Math.random() * idles.length);
    if (idx === lastIdleIndex && idles.length > 1) idx = (idx + 1) % idles.length;
    lastIdleIndex = idx;
    return idles[idx];
  }

  async function playAnimation(name, attempt) {
    var seq = ++_playSeq;
    if (!videoEl) videoEl = document.getElementById('nataliaAvatarVideo');
    if (!mainVid) mainVid = document.getElementById('nataliaAvatarMainVideo');
    if (!guestVid) guestVid = document.getElementById('guestNataliaVideo');
    var isIdle = (name === 'idle');
    var files = ANIMATIONS[name] || ANIMATIONS.idle;
    var file = isIdle ? pickIdle() : files[Math.floor(Math.random() * files.length)];
    var url = await getSignedUrl(file, tryNum);
    if (!url) return;
    currentAnim = name;
    var tryNum = attempt || 0;
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
        if (!isIdle) { el.onended = onEnded; }
      }
    }
    await setVideo(videoEl);
    await setVideo(mainVid);
    await setVideo(guestVid);
  }

  window.nataliaPlayAnimation = function(name) { playAnimation(name || 'idle'); };
  window.nataliaPlayWarning = async function() {
    var url = await getSignedUrl('Natalia_Warning.mp4');
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

  setInterval(function() { signedUrls = {}; }, 50 * 60 * 1000);
})();
