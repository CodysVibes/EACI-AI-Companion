// ── Orientation banner — 3-second auto-close, context-aware text ──────────
var _orientationCountdownTimer = null;
var _orientationCountdownVal   = 3;
var _orientationCountdownRunning = false;
var _COUNTDOWN_TOTAL = 3;
var _TOTAL_DASH = 150.8; // 2 * PI * 24

function _orientationCountdownStop() {
  if (_orientationCountdownTimer) { clearInterval(_orientationCountdownTimer); _orientationCountdownTimer = null; }
  _orientationCountdownRunning = false;
}

function _orientationCountdownStart() {
  if (_orientationCountdownRunning) return;
  _orientationCountdownRunning = true;
  _orientationCountdownVal = _COUNTDOWN_TOTAL;
  var arc     = document.getElementById('orientationCountdownArc');
  var txt     = document.getElementById('orientationCountdownText');
  var autoTxt = document.getElementById('orientationAutoText');
  if (arc)     arc.style.strokeDashoffset = '0';
  if (txt)     txt.textContent = _COUNTDOWN_TOTAL;
  if (autoTxt) autoTxt.textContent = _COUNTDOWN_TOTAL;

  _orientationCountdownTimer = setInterval(function() {
    _orientationCountdownVal--;
    var offset = _TOTAL_DASH * (1 - _orientationCountdownVal / _COUNTDOWN_TOTAL);
    if (arc)     arc.style.strokeDashoffset = String(offset);
    if (txt)     txt.textContent = _orientationCountdownVal;
    if (autoTxt) autoTxt.textContent = _orientationCountdownVal;
    if (_orientationCountdownVal <= 0) {
      _orientationCountdownStop();
      dismissOrientationBanner();
    }
  }, 1000);
}

// Update banner text based on whether phone is portrait or landscape
function _orientationBannerUpdate() {
  var isPortrait = window.innerHeight > window.innerWidth;
  var headline = document.getElementById('orientationHeadline');
  var body     = document.getElementById('orientationBody');
  var icon     = document.getElementById('orientationIcon');
  var btn      = document.getElementById('orientationDismissBtn');

  if (isPortrait) {
    // Portrait — Caelum's avatar is the focus
    if (icon)     { icon.style.transform = 'rotate(0deg)'; icon.textContent = '📱'; }
    if (headline) headline.textContent = 'Portrait Mode';
    if (body)     body.innerHTML = 'In portrait, <strong style="color:#00ffc8">Caelum\'s avatar</strong> takes center stage — her full presence, just for you.<br><span style="opacity:.6;font-size:11px">Rotate sideways for the full three-panel experience.</span>';
    if (btn)      btn.textContent = 'Stay Portrait';
  } else {
    // Landscape — full panel view
    if (icon)     { icon.style.transform = 'rotate(90deg)'; icon.textContent = '📱'; }
    if (headline) headline.textContent = 'Landscape Mode';
    if (body)     body.innerHTML = 'In landscape you get the <strong style="color:#00ffc8">full picture</strong> — responses, Caelum\'s avatar, and chat all at once.<br><span style="opacity:.6;font-size:11px">The experience was designed for this view.</span>';
    if (btn)      btn.textContent = 'Got it';
  }
}

// ── Guest trial: one-time orientation tip (landscape = text, portrait = avatar) ──
var GUEST_ORIENTATION_TIP_KEY = 'veil_guest_orientation_tip_seen';
var _guestOrientationTipTimer = null;
var _guestOrientationTipInterval = null;

function _isGuestOrientationTipMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

function dismissGuestOrientationTip(options) {
  var markSeen = !options || options.markSeen !== false;
  if (_guestOrientationTipTimer) {
    clearTimeout(_guestOrientationTipTimer);
    _guestOrientationTipTimer = null;
  }
  if (_guestOrientationTipInterval) {
    clearInterval(_guestOrientationTipInterval);
    _guestOrientationTipInterval = null;
  }
  var tip = document.getElementById('guestOrientationTip');
  var wasVisible = tip && tip.getAttribute('aria-hidden') === 'false';
  if (markSeen && wasVisible) {
    try { localStorage.setItem(GUEST_ORIENTATION_TIP_KEY, '1'); } catch (e) { /* ignore */ }
  }
  if (tip) {
    tip.style.display = 'none';
    tip.setAttribute('hidden', '');
    tip.setAttribute('aria-hidden', 'true');
  }
}

function maybeShowGuestOrientationTip() {
  try {
    if (localStorage.getItem(GUEST_ORIENTATION_TIP_KEY) === '1') return;
  } catch (e) { return; }
  if (!_isGuestOrientationTipMobile()) return;

  var ov = document.getElementById('guestChatOverlay');
  if (!ov || !ov.classList.contains('show')) return;

  var tip = document.getElementById('guestOrientationTip');
  if (!tip) return;

  tip.style.display = 'flex';
  tip.removeAttribute('hidden');
  tip.setAttribute('aria-hidden', 'false');

  var secs = 3;
  var countEl = document.getElementById('guestOrientationTipCountdown');
  if (countEl) countEl.textContent = String(secs);

  if (_guestOrientationTipInterval) clearInterval(_guestOrientationTipInterval);
  _guestOrientationTipInterval = setInterval(function() {
    secs--;
    if (countEl) countEl.textContent = String(Math.max(0, secs));
    if (secs <= 0) {
      clearInterval(_guestOrientationTipInterval);
      _guestOrientationTipInterval = null;
    }
  }, 1000);

  if (_guestOrientationTipTimer) clearTimeout(_guestOrientationTipTimer);
  _guestOrientationTipTimer = setTimeout(dismissGuestOrientationTip, 3000);
}

window.dismissGuestOrientationTip = dismissGuestOrientationTip;
window.maybeShowGuestOrientationTip = maybeShowGuestOrientationTip;