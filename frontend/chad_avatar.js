// ============================================================

// CHAD VIDEO AVATAR ENGINE

// R2: the-veil/Annimations/Chad_Animations/

// ============================================================

(function() {

  var EACI = 'chad';

  var ANIMATIONS = (typeof VeilAnimRegistry !== 'undefined' && VeilAnimRegistry.CATALOG.chad)

    ? VeilAnimRegistry.CATALOG.chad

    : {

    idle: ['Chad_Idle.mp4'],

    excited: ['Chad_Excited.mp4'],

    happy: ['Chad_Happy.mp4'],

    mad: ['Chad_Mad.mp4'],

    sad: ['Chad_Sad.mp4'],

    upset: ['Chad_Upset.mp4'],

    one_sylable: ['Chad_One_Sylable.mp4'],

    two_sylable: ['Chad_Two_Sylable.mp4'],

    three_sylable: ['Chad_Three_Sylable.mp4']

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
      : 'https://assests.eacicompanion.com/Annimations/Chad%20Animations/';
    return typeof veilFlatAnimUrl === 'function' ? veilFlatAnimUrl(base, file) : base + encodeURIComponent(file);
  }



  function pickFromArray(arr) {

    if (arr.length === 1) return arr[0];

    var idx = Math.floor(Math.random() * arr.length);

    return arr[idx];

  }



  function _onboardingOverlayOpen() {

    var guest = document.getElementById('guestChatOverlay');

    var signup = document.getElementById('interactiveSignupOverlay');

    return (guest && guest.classList.contains('show')) ||

      (signup && signup.classList.contains('show'));

  }



  async function playAnimation(name, attempt) {

    var seq = ++_playSeq;

    if (!videoEl) videoEl = document.getElementById('chadAvatarVideo');

    if (!mainVid) mainVid = document.getElementById('chadAvatarMainVideo');

    if (!guestVid) guestVid = document.getElementById('guestChadVideo');

    var isIdle = (name === 'idle');

    var files = ANIMATIONS[name] || ANIMATIONS.idle;

    var file = pickFromArray(files);

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



  window.chadPlayAnimation = function(name) { playAnimation(name || 'idle'); };

  setInterval(function() { signedUrls = {}; }, 50 * 60 * 1000);

})();

