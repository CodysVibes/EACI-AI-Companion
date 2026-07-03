// ============================================================
// STUBS — Fallback no-ops until mode-specific modules load
// Companion routing lives in 44_veil_sites.js (loads first).
// ============================================================

var _adultVerified = false;

window.isAdultContentUnlocked = function() {
  return _adultVerified === true;
};

function isDeviceFlagged() { return false; }
function unflagDevice() {}
function _showAdultTabs() {}
function _checkAdultVerified() {}
function showAdultVerification() {}
function closeAdultVerify() {}
function confirmAdultVerification() {}
function reenableAdultContent() {}

function buildRoxyPrompt() { return ''; }
function buildCaelPrompt() { return ''; }
function buildRoxyAdultSystemPrompt() { return ''; }
function buildCaelAdultSystemPrompt() { return ''; }
