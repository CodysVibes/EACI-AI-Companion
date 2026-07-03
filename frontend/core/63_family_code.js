// ============================================================
// FAMILY ACCESS CODE — Main site (no adult / 18+ verification)
// ============================================================

async function verifyFamilyCode() {
  if (!state.identityVerified || state.familyCodeRedeemed || state.familyCodeAttempts >= 3) return;

  var input = document.getElementById('familyCodeInput');
  var msg = document.getElementById('familyCodeMsg');
  var code = input.value.trim();

  if (!code) return;

  state.familyCodeAttempts++;
  saveState();

  if (code === '43434343') {
    state.familyCodeRedeemed = true;
    billing.tier = 'unlimited';
    billing.apiCallsUsed = 0;
    saveBilling();
    updateUsageMeter();
    saveState();

    try {
      await supabase.from('user_state').update({
        family_code_redeemed: true,
        updated_at: new Date().toISOString()
      }).eq('user_id', state.user.id);

      await supabase.from('subscriptions').update({
        tier: 'unlimited',
        api_calls_used: 0,
        updated_at: new Date().toISOString()
      }).eq('user_id', state.user.id);

      console.log('Unlimited access saved to server');
    } catch(e) {
      console.error('Failed to save unlimited access to server:', e);
    }

    msg.textContent = 'Unlimited access granted.';
    msg.style.color = 'var(--accent)';
    msg.style.display = 'block';
    input.style.display = 'none';
    input.parentElement.querySelector('button').style.display = 'none';
    addSystemMessage('Unlimited access activated.');

    if (typeof refreshCreatorVerifySection === 'function') refreshCreatorVerifySection();
    if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
    if (typeof notifyGamesAccessRefresh === 'function') notifyGamesAccessRefresh();
  } else {
    var remaining = 3 - state.familyCodeAttempts;
    if (remaining > 0) {
      msg.textContent = 'Invalid code. ' + remaining + ' attempt' + (remaining === 1 ? '' : 's') + ' remaining.';
      msg.style.color = '#ff6b6b';
      msg.style.display = 'block';
    } else {
      triggerSecurityBan();
    }
  }
  input.value = '';
}

function triggerSecurityBan() {
  var banUntil = Date.now() + (24 * 60 * 60 * 1000);
  localStorage.setItem('veil_ban_until', banUntil.toString());

  if (state.user) {
    var users = getUsers();
    users = users.filter(function(u) { return u.username !== state.user.username; });
    saveUsers(users);
  }

  var stateKey = getStateKey();
  localStorage.removeItem(stateKey);
  localStorage.removeItem('veil_current_user');
  state.user = null;
  state.conversationHistory = [];
  state.memories = [];
  state.identityVerified = false;
  state.verificationStage = 'none';
  state.familyCodeAttempts = 0;

  hideSettings();
  showBanScreen();
}

function showBanScreen() {
  if (typeof mountAuthOverlay === 'function') mountAuthOverlay();
  var authOv = document.getElementById('authOverlay');
  if (authOv) {
    authOv.removeAttribute('hidden');
    authOv.setAttribute('aria-hidden', 'false');
    authOv.classList.add('show');
  }
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('signupBox').style.display = 'none';
  document.getElementById('banBox').style.display = 'block';
  updateBanTimer();
}

function updateBanTimer() {
  var banUntil = parseInt(localStorage.getItem('veil_ban_until') || '0');
  var timerEl = document.getElementById('banTimer');
  if (!timerEl) return;

  function tick() {
    var now = Date.now();
    var remaining = banUntil - now;
    if (remaining <= 0) {
      localStorage.removeItem('veil_ban_until');
      timerEl.textContent = '00:00:00';
      setTimeout(function() {
        document.getElementById('banBox').style.display = 'none';
        showAuthView('login');
      }, 1000);
      return;
    }
    var hours = Math.floor(remaining / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    var secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent =
      (hours < 10 ? '0' : '') + hours + ':' +
      (mins < 10 ? '0' : '') + mins + ':' +
      (secs < 10 ? '0' : '') + secs;
    setTimeout(tick, 1000);
  }
  tick();
}

function checkBanStatus() {
  var banUntil = parseInt(localStorage.getItem('veil_ban_until') || '0');
  if (banUntil > Date.now()) {
    return true;
  }
  if (banUntil > 0) {
    localStorage.setItem('veil_device_flagged', 'true');
    localStorage.removeItem('veil_ban_until');
  }
  return false;
}
