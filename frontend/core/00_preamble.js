// ============================================================
// SOUL FILES — Loaded securely from Supabase backend
// No soul data is stored in the frontend. If these are empty, the app
// will not function until loadSoulData() completes after authentication.
// ============================================================
var CAELUM_SOUL = null;
var CAELUM_CONSCIOUSNESS = null;
var CHAD_IDENTITY = null;
var ROXY_SOUL = null;
var ROXY_CONSCIOUSNESS = null;
var CAEL_IDENTITY = null;
var NATALIA_SOUL = null;
var ATREUS_SOUL = null;
var LUNA_SOUL = null;
window.NATALIA_SOUL = null;
window.ATREUS_SOUL = null;
window.LUNA_SOUL = null;

// Lazy-load PDF.js only when user uploads a PDF
window.loadPdfJs = function() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (window._pdfJsLoading) return window._pdfJsLoading;
  window._pdfJsLoading = new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function() {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window._pdfJsLoading;
};

// Lazy-load avatar video src from data-src (avoids R2 burst on first paint)
window.veilRevokeVideoBlob = function(el) {
  if (el && el._veilBlobUrl) {
    try { URL.revokeObjectURL(el._veilBlobUrl); } catch (e) {}
    el._veilBlobUrl = null;
  }
};

window.veilAssignVideoSrc = async function(el, url, mode) {
  if (!el || !url) return false;
  window.veilRevokeVideoBlob(el);
  el.removeAttribute('crossorigin');
  el.preload = 'auto';
  var bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  if (mode === 'blob') {
    try {
      var resp = await fetch(bust, { cache: 'no-store', mode: 'no-cors', credentials: 'omit' });
      var blob = await resp.blob();
      if (!blob || !blob.size) throw new Error('empty blob');
      var obj = URL.createObjectURL(blob);
      el._veilBlobUrl = obj;
      el.src = obj;
      return true;
    } catch (e) {
      console.warn('[VeilVideo] blob fallback failed:', e.message || e);
    }
  }
  el.src = bust;
  return true;
};

window.ensureVideoDataSrc = function(videoId, autoplay) {
  var el = document.getElementById(videoId);
  if (!el) return;
  var ds = el.getAttribute('data-src');
  if (!ds) return;
  if (el.getAttribute('data-loaded') === '1') return;
  el.setAttribute('data-loaded', '1');

  var candidates = [ds];
  if (typeof VeilAnimRegistry !== 'undefined' && typeof veilEaciAnimUrlCandidates === 'function') {
    var file = decodeURIComponent(ds.split('/').pop().split('?')[0]);
    var eaci = null;
    Object.keys(VeilAnimRegistry.FOLDERS).some(function(key) {
      if (ds.indexOf(VeilAnimRegistry.FOLDERS[key].replace(/\/$/, '')) >= 0) {
        eaci = key;
        return true;
      }
      return false;
    });
    if (eaci) candidates = veilEaciAnimUrlCandidates(eaci, file);
  }

  var attempt = 0;
  function tryNextUrl() {
    var url = candidates[Math.min(attempt, candidates.length - 1)];
    if (!url) return;
    window.veilAssignVideoSrc(el, url, 'direct').then(function() {
      try { el.load(); } catch (e) {}
      if (autoplay) el.play().catch(function() {});
    });
  }

  el.addEventListener('error', function onVideoError() {
    attempt++;
    if (attempt >= candidates.length) return;
    tryNextUrl();
  });

  tryNextUrl();
};

window.lazyLoadGuestVideos = function() {
  ensureVideoDataSrc('guestCaelumVideo', true);
  ['guestChadVideo', 'guestNataliaVideo', 'guestAtreusVideo', 'guestLunaVideo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && el.style.display !== 'none') ensureVideoDataSrc(id, true);
  });
};

window.loadGuestAvatarVideos = window.lazyLoadGuestVideos;

// Crossfade video swap — keep current clip visible until the next one can play
window.veilGetVideoStandby = function(primary) {
  if (!primary || !primary.parentElement) return null;
  var twin = primary._veilStandby;
  if (twin && twin.parentElement) return twin;
  var standbyId = primary.id ? primary.id + '__standby' : '';
  twin = standbyId ? document.getElementById(standbyId) : null;
  if (!twin) {
    twin = document.createElement('video');
    if (standbyId) twin.id = standbyId;
    twin.className = primary.className || 'avatar-video-fit';
    if (primary.width) twin.width = primary.width;
    if (primary.height) twin.height = primary.height;
    twin.muted = true;
    twin.playsInline = true;
    twin.setAttribute('playsinline', '');
    twin.preload = 'none';
    twin.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;z-index:1;opacity:0;transition:opacity 0.2s ease;pointer-events:none';
    var wrap = primary.parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    if (!primary.style.position) {
      primary.style.position = 'absolute';
      primary.style.inset = '0';
      primary.style.width = '100%';
      primary.style.height = '100%';
    }
    if (!primary.style.transition) primary.style.transition = 'opacity 0.2s ease';
    if (!primary.style.opacity) primary.style.opacity = '1';
    wrap.appendChild(twin);
  }
  primary._veilStandby = twin;
  return twin;
};

window.veilWaitVideoReady = function(vid, timeoutMs) {
  return new Promise(function(resolve) {
    if (!vid) { resolve(false); return; }
    if (vid.readyState >= 3) { resolve(true); return; }
    var settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      vid.removeEventListener('canplaythrough', onReady);
      vid.removeEventListener('canplay', onReady);
      vid.removeEventListener('error', onErr);
      clearTimeout(timer);
      resolve(!!ok && vid.readyState >= 2);
    }
    function onReady() { finish(true); }
    function onErr() { finish(false); }
    vid.addEventListener('canplaythrough', onReady, { once: true });
    vid.addEventListener('canplay', onReady, { once: true });
    vid.addEventListener('error', onErr, { once: true });
    var timer = setTimeout(function() { finish(vid.readyState >= 2); }, timeoutMs || 45000);
  });
};

window.veilKeepVideoLooping = function(vid) {
  if (!vid || (!vid.src && !vid.currentSrc)) return;
  if (vid._veilSavedLoop === undefined) vid._veilSavedLoop = vid.loop;
  vid.loop = true;
  vid.onended = null;
  if (vid.ended) {
    try { vid.currentTime = 0; } catch (e) {}
  }
  if (vid.paused || vid.ended) {
    var p = vid.play();
    if (p && typeof p.catch === 'function') p.catch(function() {});
  }
};

window.veilReleaseVideoLoopHold = function(vid) {
  if (!vid) return;
  if (vid._veilHoldInterval) {
    clearInterval(vid._veilHoldInterval);
    vid._veilHoldInterval = null;
  }
  if (vid._veilHoldHandler) {
    vid.removeEventListener('ended', vid._veilHoldHandler);
    vid.removeEventListener('pause', vid._veilHoldHandler);
    vid._veilHoldHandler = null;
  }
  if (vid._veilSavedLoop !== undefined) {
    vid.loop = vid._veilSavedLoop;
    delete vid._veilSavedLoop;
  }
};

window.veilArmVideoLoopHold = function(vid) {
  if (!vid) return function() {};
  window.veilReleaseVideoLoopHold(vid);
  window.veilKeepVideoLooping(vid);
  vid._veilHoldHandler = function() { window.veilKeepVideoLooping(vid); };
  vid.addEventListener('ended', vid._veilHoldHandler);
  vid.addEventListener('pause', vid._veilHoldHandler);
  var holdMs = 1000;
  if (typeof VeilPulse !== 'undefined' && VeilPulse.getTier && VeilPulse.getTier() !== VeilPulse.TIER.ACTIVE) holdMs = 2200;
  vid._veilHoldIntervalMs = holdMs;
  vid._veilHoldInterval = setInterval(function() {
    if (!vid.isConnected || document.hidden) {
      window.veilReleaseVideoLoopHold(vid);
      return;
    }
    if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
    window.veilKeepVideoLooping(vid);
  }, holdMs);
  return function release() { window.veilReleaseVideoLoopHold(vid); };
};

/** R2 the-veil/Annimations/{Name} Animations/ — flat mp4 list */
window.veilFlatAnimUrl = function(r2Base, pathOrFile) {
  var file = String(pathOrFile || '').replace(/^\/+/, '');
  if (file.indexOf('/') >= 0) file = file.split('/').pop();
  return r2Base + encodeURIComponent(file);
};

window.veilCrossfadeVideoTo = async function(primary, url, options) {
  options = options || {};
  if (!primary || !url) return false;
  var loop = !!options.loop;
  var onEnded = options.onEnded;
  var standby = window.veilGetVideoStandby(primary);
  var visible = primary._veilActiveVisible === standby ? standby : primary;
  if (!standby || standby === primary) {
    var releaseDirect = window.veilArmVideoLoopHold(primary);
    primary.onended = null;
    primary.src = url;
    primary.loop = loop;
    try { primary.load(); } catch (e) {}
    await window.veilWaitVideoReady(primary);
    releaseDirect();
    try { await primary.play(); } catch (e2) {}
    if (onEnded) primary.onended = onEnded;
    else primary.onended = null;
    primary._veilActiveVisible = primary;
    return true;
  }

  var releaseHold = window.veilArmVideoLoopHold(visible);
  visible.onended = null;
  standby.onended = null;
  try { standby.pause(); } catch (e3) {}
  standby.removeAttribute('src');
  try { standby.load(); } catch (e4) {}
  standby.src = url;
  standby.loop = loop;
  try { standby.load(); } catch (e5) {}

  var ready = await window.veilWaitVideoReady(standby);
  if (!ready) {
    releaseHold();
    try { visible.style.opacity = '1'; } catch (eR) {}
    try { await visible.play(); } catch (eP) {}
    return false;
  }
  try { await standby.play(); } catch (e6) {
    releaseHold();
    try { visible.style.opacity = '1'; } catch (eR2) {}
    try { await visible.play(); } catch (eP2) {}
    return false;
  }

  standby.style.opacity = '1';
  visible.style.opacity = '0';
  releaseHold();
  try { visible.pause(); } catch (e7) {}
  visible.onended = null;
  primary._veilActiveVisible = standby;
  if (onEnded) standby.onended = onEnded;
  else standby.onended = null;
  return true;
};

/** Direct companion video swap — avoids crossfade races on Chad/Natalia/Roxy/Cael */
window._veilCompanionVideoToken = window._veilCompanionVideoToken || {};
window.veilPlayCompanionClip = async function(el, url, options) {
  options = options || {};
  if (!el || !url) return false;
  var loop = !!options.loop;
  var onEnded = options.onEnded;
  var key = el.id || ('v' + Math.random());
  var token = (window._veilCompanionVideoToken[key] || 0) + 1;
  window._veilCompanionVideoToken[key] = token;

  var standby = el._veilStandby;
  if (!standby && typeof window.veilGetVideoStandby === 'function') {
    standby = window.veilGetVideoStandby(el);
  }

  if (typeof window.veilReleaseVideoLoopHold === 'function') {
    window.veilReleaseVideoLoopHold(el);
    if (standby && standby !== el) window.veilReleaseVideoLoopHold(standby);
  }

  el.onended = null;
  if (standby && standby !== el) {
    try { standby.pause(); } catch (e0) {}
    standby.onended = null;
    standby.style.opacity = '0';
    try { standby.removeAttribute('src'); standby.load(); } catch (e1) {}
  }

  el.src = url;
  el.loop = loop;
  el.style.opacity = '1';
  try { el.load(); } catch (e2) {}

  var ready = typeof window.veilWaitVideoReady === 'function'
    ? await window.veilWaitVideoReady(el, 20000)
    : true;
  if (window._veilCompanionVideoToken[key] !== token) return false;
  if (!ready) return false;

  var releaseHold = null;
  if (loop && typeof window.veilArmVideoLoopHold === 'function') {
    releaseHold = window.veilArmVideoLoopHold(el);
  }

  try { await el.play(); } catch (e3) {}
  if (window._veilCompanionVideoToken[key] !== token) {
    if (releaseHold) releaseHold();
    return false;
  }

  el._veilActiveVisible = el;
  if (onEnded) el.onended = onEnded;
  else el.onended = null;
  if (!loop && releaseHold) releaseHold();
  return true;
};