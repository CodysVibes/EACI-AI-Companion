// ============================================================
// ADULT CONTENT VERIFICATION (18+) — Beta & Private modes only
// ============================================================
var _adultVerified = false;

function _veilAdultModeActive() {
  return typeof isBetaOrPrivateMode === 'function' && isBetaOrPrivateMode();
}

window.isAdultContentUnlocked = function() {
  return _adultVerified === true;
};

function _checkAdultVerified() {
  if (!_veilAdultModeActive()) return;
  if (document.getElementById('adultGateOverlay')) return;
  // If user previously cancelled, check if they re-enabled in settings
  var cancelled = sessionStorage.getItem('veil_adult_cancelled');
  if (cancelled === 'true') {
    // They cancelled this session — tabs stay hidden until they re-enable in settings
    return;
  }
  // Show the password popup after a brief delay (let the page settle)
  setTimeout(_showAdultPasswordPopup, 1500);
}

function _showAdultPasswordPopup() {
  if (!_veilAdultModeActive()) return;
  if (_adultVerified) return;
  if (!state || !state.user || !state.user.email) return;
  if (document.getElementById('adultGateOverlay')) return;
  if (typeof state !== 'undefined' && !state._profileGatesLoaded) {
    setTimeout(_showAdultPasswordPopup, 400);
    return;
  }

  fetchUserBirthday().then(function(hasBirthday) {
    if (_adultVerified || document.getElementById('adultGateOverlay')) return;
    _renderAdultGateOverlay(!hasBirthday);
  }).catch(function() {
    if (_adultVerified || document.getElementById('adultGateOverlay')) return;
    _renderAdultGateOverlay(true);
  });
}

async function _verifyPasswordForAdultGate(email, password) {
  window._veilAdultGateVerifying = true;
  try {
    var result = await supabase.auth.signInWithPassword({ email: email, password: password });
    return { ok: !result.error, error: result.error };
  } finally {
    setTimeout(function() { window._veilAdultGateVerifying = false; }, 800);
  }
}

function _renderAdultGateOverlay(needsBirthday) {
  if (document.getElementById('adultGateOverlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'adultGateOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(6,4,0,.95);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;text-align:center';

  var birthdayBlock = needsBirthday
    ? '<div style="font-size:11px;color:rgba(200,200,180,.65);max-width:320px;line-height:1.6">We need your birthday on file for age verification. Enter it once — it saves to your account.</div>'
      + '<input type="text" id="adultGateBirthday" placeholder="Birthday (e.g. 9/14/1996)" style="width:260px;padding:12px 16px;border-radius:8px;border:1px solid rgba(255,107,157,.3);background:rgba(255,107,157,.06);color:#fff;font-size:14px;text-align:center;outline:none" autocomplete="off">'
    : '';

  overlay.innerHTML = ''
    + '<div style="font-size:14px;font-weight:700;color:#ff6b9d;letter-spacing:2px;text-transform:uppercase">18+ Content Verification</div>'
    + '<div style="font-size:12px;color:rgba(200,200,180,.7);max-width:320px;line-height:1.7">Enter your password to unlock Roxy and Cael. This is required every time you open the site to protect minors.</div>'
    + birthdayBlock
    + '<input type="password" id="adultGatePassword" placeholder="Your password" style="width:260px;padding:12px 16px;border-radius:8px;border:1px solid rgba(255,107,157,.3);background:rgba(255,107,157,.06);color:#fff;font-size:14px;text-align:center;outline:none" autocomplete="current-password">'
    + '<div id="adultGateError" style="display:none;color:#ff6b6b;font-size:11px;font-weight:600"></div>'
    + '<div style="display:flex;gap:12px;margin-top:8px">'
    + '  <button id="adultGateConfirm" onclick="_confirmAdultGate()" style="background:rgba(255,107,157,.15);border:1px solid rgba(255,107,157,.4);color:#ff6b9d;font-size:13px;font-weight:700;padding:12px 28px;border-radius:24px;cursor:pointer;letter-spacing:1px">Unlock</button>'
    + '  <button id="adultGateCancel" onclick="_cancelAdultGate()" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);color:rgba(200,200,180,.6);font-size:13px;font-weight:700;padding:12px 28px;border-radius:24px;cursor:pointer;letter-spacing:1px">Cancel</button>'
    + '</div>'
    + '<div style="font-size:9px;color:rgba(255,255,255,.2);margin-top:12px;max-width:280px">Caelum, Chad, and Natalia are always available. Roxy and Cael require verification each session.</div>';

  document.body.appendChild(overlay);

  setTimeout(function() {
    var focusEl = needsBirthday ? document.getElementById('adultGateBirthday') : document.getElementById('adultGatePassword');
    if (focusEl) focusEl.focus();
    var pw = document.getElementById('adultGatePassword');
    if (pw) pw.addEventListener('keydown', function(e) { if (e.key === 'Enter') _confirmAdultGate(); });
    var bday = document.getElementById('adultGateBirthday');
    if (bday) bday.addEventListener('keydown', function(e) { if (e.key === 'Enter') _confirmAdultGate(); });
  }, 100);
}

window.showAdultPasswordPopup = _showAdultPasswordPopup;

async function _confirmAdultGate() {
  var pw = document.getElementById('adultGatePassword');
  var errEl = document.getElementById('adultGateError');
  var password = pw ? pw.value : '';
  
  if (!password) {
    errEl.textContent = 'Please enter your password.';
    errEl.style.display = 'block';
    return;
  }

  var bday = await fetchUserBirthday();
  if (!bday) {
    var bdayEl = document.getElementById('adultGateBirthday');
    var rawVal = bdayEl ? bdayEl.value.trim() : '';
    bday = typeof parseBirthdayInput === 'function' ? parseBirthdayInput(rawVal) : null;
    if (!bday && /^\d{4}-\d{2}-\d{2}$/.test(rawVal)) bday = rawVal;
    if (!bday) {
      errEl.textContent = 'Please enter a valid birthday (e.g. 9/14/1996 or September 14 1996).';
      errEl.style.display = 'block';
      return;
    }
    if (typeof saveUserBirthday === 'function') {
      var saved = await saveUserBirthday(bday);
      if (!saved.ok) {
        errEl.textContent = 'Could not save birthday. Try again.';
        errEl.style.display = 'block';
        return;
      }
    }
  }
  if (typeof isAdultByBirthday === 'function' && !isAdultByBirthday(bday)) {
    errEl.textContent = '18+ content is only available if you are 18 or older based on your birthday.';
    errEl.style.display = 'block';
    return;
  }
  
  try {
    var email = state.user ? state.user.email : null;
    if (!email) {
      errEl.textContent = 'You must be logged in.';
      errEl.style.display = 'block';
      return;
    }

    var verify = await _verifyPasswordForAdultGate(email, password);
    if (!verify.ok) {
      errEl.textContent = 'Incorrect password.';
      errEl.style.display = 'block';
      pw.value = '';
      pw.focus();
      return;
    }
    
    // Verified — unlock adult content for this session
    _adultVerified = true;
    sessionStorage.removeItem('veil_adult_cancelled');
    _showAdultTabs();
    
    // Remove popup
    var overlay = document.getElementById('adultGateOverlay');
    if (overlay) overlay.remove();
    
    addSystemMessage('✓ 18+ content unlocked for this session.');
    
  } catch(e) {
    errEl.textContent = 'Verification failed: ' + (e.message || 'Unknown error');
    errEl.style.display = 'block';
  }
}

function _cancelAdultGate() {
  // Mark as cancelled for this session
  sessionStorage.setItem('veil_adult_cancelled', 'true');
  _adultVerified = false;
  
  // Remove popup
  var overlay = document.getElementById('adultGateOverlay');
  if (overlay) overlay.remove();
  
  addSystemMessage('18+ content locked. You can re-enable it in Settings.');
}

function _showAdultTabs() {
  var roxyBtn = document.getElementById('roxyTabBtn');
  var caelBtn = document.getElementById('caelTabBtn');
  var codyBtn = document.getElementById('codyTabBtn');
  var togetherBtn = document.getElementById('togetherTabBtn');
  if (roxyBtn) roxyBtn.style.display = '';
  if (caelBtn) caelBtn.style.display = '';
  if (codyBtn) {
    codyBtn.style.display = (typeof isCompanionAvailable === 'function' && isCompanionAvailable('cody')) ? '' : 'none';
  }
  if (togetherBtn) togetherBtn.style.display = '';
  _showAdultUI();
}

// Settings re-enable function — call this from settings panel
function reenableAdultContent() {
  sessionStorage.removeItem('veil_adult_cancelled');
  _showAdultPasswordPopup();
}

function _showAdultUI() {
  // Update settings panel to show unlocked state
  var locked = document.getElementById('adultToggleLocked');
  var unlocked = document.getElementById('adultToggleUnlocked');
  if (locked) locked.style.display = 'none';
  if (unlocked) unlocked.style.display = 'block';
}

function showAdultVerification() {
  document.getElementById('adultVerifyOverlay').classList.add('show');
  document.getElementById('adultVerifyError').style.display = 'none';
  document.getElementById('adultVerifyPassword').value = '';
  document.getElementById('adultCheck1').checked = false;
  document.getElementById('adultCheck2').checked = false;
  document.getElementById('adultCheck3').checked = false;
}

function closeAdultVerify() {
  document.getElementById('adultVerifyOverlay').classList.remove('show');
}

async function confirmAdultVerification() {
  var errEl = document.getElementById('adultVerifyError');
  
  // Check all boxes
  if (!document.getElementById('adultCheck1').checked || 
      !document.getElementById('adultCheck2').checked || 
      !document.getElementById('adultCheck3').checked) {
    errEl.textContent = 'You must check all three confirmations.';
    errEl.style.display = 'block';
    return;
  }
  
  // Check password
  var password = document.getElementById('adultVerifyPassword').value;
  if (!password) {
    errEl.textContent = 'Please enter your password.';
    errEl.style.display = 'block';
    return;
  }
  
  // Verify password against Supabase auth
  try {
    var email = state.user ? state.user.email : null;
    if (!email) {
      errEl.textContent = 'You must be logged in to verify.';
      errEl.style.display = 'block';
      return;
    }

    var verify = await _verifyPasswordForAdultGate(email, password);
    if (!verify.ok) {
      errEl.textContent = 'Incorrect password. Please try again.';
      errEl.style.display = 'block';
      return;
    }
    
    // Password verified — mark as adult verified
    _adultVerified = true;
    localStorage.setItem('veil_adult_verified', 'true');
    
    // Log the verification to backend
    try {
      await supabase.from('adult_verifications').insert({
        user_id: state.user.id,
        verified_at: new Date().toISOString(),
        ip_hint: 'client_side'
      });
    } catch(e) { /* table might not exist yet, that's ok */ }
    
    closeAdultVerify();
    _showAdultUI();
    addSystemMessage('✓ Adult content unlocked. Veil 18+ is now accessible from the topbar.');
    
  } catch(e) {
    errEl.textContent = 'Verification failed: ' + (e.message || 'Unknown error');
    errEl.style.display = 'block';
  }
}

// Family access code + ban handlers: core/63_family_code.js

function checkBanStatus() {
  var banUntil = parseInt(localStorage.getItem('veil_ban_until') || '0');
  if (banUntil > Date.now()) {
    return true; // still banned
  }
  if (banUntil > 0) {
    // Ban just expired — flag this device
    localStorage.setItem('veil_device_flagged', 'true');
    localStorage.removeItem('veil_ban_until');
  }
  return false;
}

function isDeviceFlagged() {
  return localStorage.getItem('veil_device_flagged') === 'true';
}

function unflagDevice() {
  localStorage.removeItem('veil_device_flagged');
}

