// ============================================================
// AUTH SYSTEM — local user profiles
// ============================================================
function getUsers() { return []; }
function saveUsers(users) { }

var _authOverlayMounted = false;
function mountAuthOverlay() {
  if (_authOverlayMounted) return true;
  // Beta/private: auth forms already live inside #authOverlay (no template)
  if (document.getElementById('loginBox')) {
    _authOverlayMounted = true;
    return true;
  }
  var tpl = document.getElementById('authOverlayTemplate');
  var host = document.getElementById('authOverlay');
  if (!tpl || !host || !tpl.content) return false;
  host.appendChild(tpl.content.cloneNode(true));
  _authOverlayMounted = true;
  return true;
}
window.mountAuthOverlay = mountAuthOverlay;

function showAuthView(view) {
  mountAuthOverlay();
  var loginBox = document.getElementById('loginBox');
  if (!loginBox) return;
  if (typeof trackFunnel === 'function') {
    if (view === 'signup') trackFunnel('auth_signup_form', { funnel_step: 'auth_signup_form' });
    else if (view === 'login') trackFunnel('auth_login_view', { funnel_step: 'auth_login_shown' });
  }
  loginBox.style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('signupBox').style.display = view === 'signup' ? 'block' : 'none';
  document.getElementById('banBox').style.display = 'none';
  var resetBox = document.getElementById('resetBox');
  if (resetBox) resetBox.style.display = view === 'reset' ? 'block' : 'none';
  var lockedBox = document.getElementById('lockedBox');
  if (lockedBox) lockedBox.style.display = view === 'locked' ? 'block' : 'none';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('signupError').classList.remove('show');
}

function clearAuthFormFields() {
  var emailEl = document.getElementById('loginUsername');
  var passEl = document.getElementById('loginPassword');
  var errEl = document.getElementById('loginError');
  if (emailEl) {
    emailEl.value = '';
    emailEl.readOnly = false;
    emailEl.removeAttribute('readonly');
  }
  if (passEl) passEl.value = '';
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('show');
    errEl.style.color = '';
  }
}

function prepareAuthFormForEntry() {
  clearAuthFormFields();
  var emailEl = document.getElementById('loginUsername');
  if (!emailEl) return;
  emailEl.setAttribute('autocomplete', 'email');
  emailEl.readOnly = true;
  setTimeout(function() {
    emailEl.readOnly = false;
    emailEl.removeAttribute('readonly');
  }, 400);
}

async function applySessionToState(session) {
  if (!session || !session.user) return false;
  var profile = null;
  try {
    var result = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    profile = result.data || null;
    if (result.error && result.error.code !== 'PGRST116') {
      console.log('Profile lookup:', result.error.message);
    }
  } catch (e) {
    console.log('Profile lookup failed; using session metadata.', e);
  }
  var meta = session.user.user_metadata || {};
  var birthday = profile && profile.birthday
    ? String(profile.birthday).substring(0, 10)
    : (typeof _normalizeBirthdayIso === 'function' ? _normalizeBirthdayIso(meta.birthday) : null);
  state.user = {
    id: session.user.id,
    firstName: profile?.first_name || meta.first_name || meta.firstName || '',
    lastName: profile?.last_name || meta.last_name || meta.lastName || '',
    email: session.user.email || '',
    username: profile?.username || meta.username || (session.user.email ? session.user.email.split('@')[0] : ''),
    birthday: birthday || ''
  };
  return true;
}

function showAuthOverlay() {
  if (typeof trackFunnel === 'function') trackFunnel('auth_overlay', { funnel_step: 'auth_login_shown' });
  mountAuthOverlay();
  var el = document.getElementById('authOverlay');
  if (!el) return;
  el.removeAttribute('hidden');
  el.setAttribute('aria-hidden', 'false');
  el.classList.add('show');
  prepareAuthFormForEntry();
  if (!checkBanStatus()) {
    showAuthView('login');
  }
}

/** Stop login email/password leaking into chat inputs (browser autofill). */
function clearChatInputs() {
  ['userInput', 'guestInput'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = '';
      el.setAttribute('readonly', 'readonly');
      setTimeout(function() { el.removeAttribute('readonly'); }, 120);
    }
  });
}

function initChatInputAutofillGuard() {
  var input = document.getElementById('userInput');
  if (!input || input._autofillGuard) return;
  input._autofillGuard = true;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'on');
  input.setAttribute('data-form-type', 'other');
  input.setAttribute('data-lpignore', 'true');
  input.setAttribute('data-1p-ignore', '');
  input.addEventListener('focus', function onFocus() {
    if (input.value && /@|password/i.test(input.value)) clearChatInputs();
  });
  input.addEventListener('input', function onInput() {
    if (input.value.length > 0 && input.value.length < 80 && /@/.test(input.value) && !/\s/.test(input.value)) {
      clearChatInputs();
    }
  });
}

function hideAuthOverlay() {
  var el = document.getElementById('authOverlay');
  if (!el) return;
  el.classList.remove('show');
  el.setAttribute('hidden', '');
  el.setAttribute('aria-hidden', 'true');
  var login = document.getElementById('loginBox');
  if (login) login.style.display = 'none';
  clearChatInputs();
  // Autofill often runs after overlay hides — clear again on next ticks
  setTimeout(clearChatInputs, 0);
  setTimeout(clearChatInputs, 150);
  setTimeout(clearChatInputs, 500);
}

function updateSignupButton() {
  document.getElementById('signupBtn').disabled = !document.getElementById('termsAgree').checked;
}

var _loginAttempts = {}; // { email: count } — client-side tracker

async function handleLogin() {
  if (checkBanStatus()) { showBanScreen(); return; }
  var email = document.getElementById('loginUsername').value.trim().toLowerCase();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; errEl.classList.add('show'); return; }

  var loginBtn = document.getElementById('loginBtn');
  if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Signing in...'; }

  try {
  // Check if already locked
  try {
    var lockResp = await fetch(CONFIG.accountSecurityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'check_lock', email: email })
    });
    var lockData = await lockResp.json();
    if (lockData.locked) {
      showAuthView('locked');
      return;
    }
  } catch(e) {}

  var { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
  if (error) {
    // Record failed attempt on backend
    try {
      var resp = await fetch(CONFIG.accountSecurityEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'record_failed_attempt', email: email })
      });
      var result = await resp.json();

      if (result.locked) {
        showAuthView('locked');
        return;
      }

      if (result.offer_reset) {
        errEl.textContent = 'Incorrect password. Attempt ' + result.attempts + ' of 5.';
        errEl.classList.add('show');
        document.getElementById('resetLink').style.display = 'block';
        document.getElementById('resetLink').querySelector('span').style.animation = 'fadeIn .4s ease';
        return;
      }

      errEl.textContent = 'Incorrect password. Attempt ' + result.attempts + ' of 5.';
      errEl.classList.add('show');
    } catch(e) {
      errEl.textContent = error.message;
      errEl.classList.add('show');
    }
    return;
  }

  // Success — clear attempts
  try {
    await fetch(CONFIG.accountSecurityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'clear_attempts', email: email })
    });
  } catch(e) {}

  document.getElementById('resetLink').style.display = 'none';
  if (!data.user) {
    errEl.textContent = 'Please check your email and confirm your account before signing in.';
    errEl.classList.add('show');
    return;
  }
  await applySessionToState(data.session || { user: data.user });
  if (!state.user) {
    state.user = { id: data.user.id, firstName: '', lastName: '', email: email, username: '' };
  }
  state.user.email = email;
  clearChatInputs();
  hideAuthOverlay();
  onUserLoggedIn();
  } catch(e) {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.classList.add('show');
  } finally {
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Sign In'; }
  }
}

