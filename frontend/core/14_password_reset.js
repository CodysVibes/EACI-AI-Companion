// ============================================================
// PASSWORD RESET FLOW
// ============================================================
var _resetEmail = '';
var _resetCode = '';

function startPasswordReset() {
  _resetEmail = document.getElementById('loginUsername').value.trim().toLowerCase();
  showAuthView('reset');
  document.getElementById('resetStep1').style.display = 'block';
  document.getElementById('resetStep2').style.display = 'none';
  document.getElementById('resetStep3').style.display = 'none';
  document.getElementById('resetError').classList.remove('show');
  document.getElementById('resetTitle').textContent = 'Reset Password';
  document.getElementById('resetSub').textContent = 'Enter your email to receive a verification code.';
  if (_resetEmail) document.getElementById('resetEmail').value = _resetEmail;
}

async function sendResetCode() {
  var email = document.getElementById('resetEmail').value.trim().toLowerCase();
  var errEl = document.getElementById('resetError');
  if (!email || !email.includes('@')) { errEl.textContent = 'Please enter a valid email.'; errEl.classList.add('show'); return; }
  _resetEmail = email;
  errEl.classList.remove('show');

  try {
    var resp = await fetch(CONFIG.accountSecurityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'send_reset_code', email: email })
    });
    var data = await resp.json();
    if (data.error) { errEl.textContent = data.error; errEl.classList.add('show'); return; }

    // Move to step 2
    document.getElementById('resetStep1').style.display = 'none';
    document.getElementById('resetStep2').style.display = 'block';
    document.getElementById('resetSub').textContent = 'A 6-digit code was sent to ' + email + '. Check your inbox.';
    document.getElementById('resetCode').focus();
  } catch(e) {
    errEl.textContent = 'Could not send code. Try again.';
    errEl.classList.add('show');
  }
}

async function verifyResetCode() {
  var code = document.getElementById('resetCode').value.trim();
  var errEl = document.getElementById('resetError');
  if (!code || code.length !== 6) { errEl.textContent = 'Please enter the 6-digit code.'; errEl.classList.add('show'); return; }
  errEl.classList.remove('show');

  try {
    var resp = await fetch(CONFIG.accountSecurityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'verify_reset_code', email: _resetEmail, code: code })
    });
    var data = await resp.json();
    if (!data.valid) { errEl.textContent = data.error || 'Invalid or expired code.'; errEl.classList.add('show'); return; }

    _resetCode = code;
    // Move to step 3
    document.getElementById('resetStep2').style.display = 'none';
    document.getElementById('resetStep3').style.display = 'block';
    document.getElementById('resetTitle').textContent = 'New Password';
    document.getElementById('resetSub').textContent = 'Verified. Enter your new password below.';
    document.getElementById('resetNewPassword').focus();
  } catch(e) {
    errEl.textContent = 'Verification failed. Try again.';
    errEl.classList.add('show');
  }
}

async function confirmPasswordReset() {
  var newPass = document.getElementById('resetNewPassword').value;
  var confirmPass = document.getElementById('resetConfirmPassword').value;
  var errEl = document.getElementById('resetError');

  if (!newPass || newPass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.add('show'); return; }
  if (newPass !== confirmPass) { errEl.textContent = 'Passwords do not match.'; errEl.classList.add('show'); return; }
  errEl.classList.remove('show');

  try {
    var resp = await fetch(CONFIG.accountSecurityEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ action: 'reset_password', email: _resetEmail, code: _resetCode, new_password: newPass })
    });
    var data = await resp.json();
    if (data.error) { errEl.textContent = data.error; errEl.classList.add('show'); return; }

    // Success — go back to login
    _resetEmail = '';
    _resetCode = '';
    showAuthView('login');
    var loginErr = document.getElementById('loginError');
    loginErr.textContent = 'Password reset successful. You can now sign in.';
    loginErr.style.color = '#00ffc8';
    loginErr.classList.add('show');
    document.getElementById('resetLink').style.display = 'none';
    setTimeout(function() { loginErr.style.color = ''; }, 5000);
  } catch(e) {
    errEl.textContent = 'Reset failed. Try again.';
    errEl.classList.add('show');
  }
}

async function handleSignup() {
  if (checkBanStatus()) { showBanScreen(); return; }
  var firstName = document.getElementById('regFirstName').value.trim();
  var lastName = document.getElementById('regLastName').value.trim();
  var email = document.getElementById('regEmail').value.trim();
  var username = document.getElementById('regUsername').value.trim();
  var password = document.getElementById('regPassword').value;
  var passwordConfirm = document.getElementById('regPasswordConfirm').value;
  var birthdayRaw = document.getElementById('regBirthday') ? document.getElementById('regBirthday').value.trim() : '';
  var birthday = typeof parseBirthdayInput === 'function' ? parseBirthdayInput(birthdayRaw) : null;
  if (!birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw)) birthday = birthdayRaw;
  var errEl = document.getElementById('signupError');
  if (!firstName || !lastName || !email || !username || !password) { errEl.textContent = 'All fields are required.'; errEl.classList.add('show'); return; }
  if (!birthday) { errEl.textContent = 'Please enter a valid birthday (e.g. 9/14/1996 or September 14 1996).'; errEl.classList.add('show'); return; }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.classList.add('show'); return; }
  if (password !== passwordConfirm) { errEl.textContent = 'Passwords do not match.'; errEl.classList.add('show'); return; }
  if (!email.includes('@')) { errEl.textContent = 'Please enter a valid email.'; errEl.classList.add('show'); return; }

  var signupBtn = document.getElementById('signupBtn');
  if (signupBtn) { signupBtn.disabled = true; signupBtn.textContent = 'Creating account...'; }

  try {
  var { data, error } = await supabase.auth.signUp({
    email: email, password: password,
    options: { data: { first_name: firstName, last_name: lastName, username: username, birthday: birthday } }
  });
  if (error) {
    if (typeof trackFunnel === 'function') trackFunnel('signup_fail', { funnel_step: 'signup_fail', metadata: { message: error.message } });
    var errMsg = error.message;
    if (/database error saving new user|unexpected_failure/i.test(errMsg)) {
      errMsg = 'Account server configuration issue. Please try again shortly or contact support.';
    }
    errEl.textContent = errMsg; errEl.classList.add('show'); return;
  }
  // If email confirmation is required, data.user may be null or data.session may be null
  if (!data.user) {
    errEl.textContent = 'Account created! Please check your email to confirm your address, then sign in.';
    errEl.style.color = 'var(--accent)';
    errEl.classList.add('show');
    setTimeout(function() { errEl.style.color = ''; showAuthView('login'); }, 4000);
    return;
  }
  // Insert profile row so login can retrieve name/username
  await supabase.from('profiles').upsert({ id: data.user.id, first_name: firstName, last_name: lastName, username: username, email: email, birthday: birthday });
  await supabase.from('user_state').upsert({ user_id: data.user.id });
  await supabase.from('subscriptions').upsert({ user_id: data.user.id, tier: 'free' });
  state.user = { id: data.user.id, firstName: firstName, lastName: lastName, email: email, username: username, birthday: birthday };
  if (typeof trackFunnel === 'function') trackFunnel('signup_complete', { funnel_step: 'signup_complete', signup_started: true });
  hideAuthOverlay();
  onUserLoggedIn();
  } catch(e) {
    if (typeof trackFunnel === 'function') trackFunnel('signup_fail', { funnel_step: 'signup_fail', metadata: { message: String(e) } });
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.classList.add('show');
  } finally {
    if (signupBtn && !state.user) { signupBtn.disabled = false; signupBtn.textContent = 'Create Account'; }
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  state.user = null;
  resetWelcomeState();
  if (typeof resetSessionReturnGapCapture === 'function') resetSessionReturnGapCapture();
  _lastLoginBootstrap = 0;
  state.conversationHistory = [];
  state.memories = [];
  state.identityVerified = false;
  state.verificationStage = 'none';
  state.creatorVerified = false;
  state.creatorVerifyAttempts = 0;
  if (typeof _invalidateCaelumPromptCache === 'function') _invalidateCaelumPromptCache();
  if (typeof getVeilMode === 'function' && getVeilMode() !== 'main' && typeof setVeilMode === 'function') {
    setVeilMode('main', { reload: false });
  } else if (typeof applyVeilModeUI === 'function') {
    applyVeilModeUI({ skipAdultPrompt: true });
  }
  document.getElementById('messages').innerHTML = '';
  document.getElementById('thoughtStream').innerHTML = '';
  if (typeof _hideGuestChat === 'function') _hideGuestChat();
  if (typeof clearAuthFormFields === 'function') clearAuthFormFields();
  showAuthOverlay();
}

var _welcomeSent = false;
var _lastLoginBootstrap = 0;
function resetWelcomeState() { _welcomeSent = false; }
function onUserLoggedIn() {
  if (!state.user) return;
  if (typeof stopOverlaySpeech === 'function') stopOverlaySpeech();
  if (typeof VeilPreviewTour !== 'undefined' && VeilPreviewTour.stopSpeech) VeilPreviewTour.stopSpeech();
  var now = Date.now();
  var skipWelcomeDuplicate = (now - _lastLoginBootstrap < 2500);
  _lastLoginBootstrap = now;
  if (typeof trackFunnel === 'function') trackFunnel('login_success', { funnel_step: 'login_success' });
  if (typeof CaelumCheckins !== 'undefined') CaelumCheckins.tryStart();
  if (typeof clearChatInputs === 'function') clearChatInputs();
  if (typeof _hideGuestChat === 'function') _hideGuestChat();
  hideAuthOverlay();
  loadState();
  if (typeof reconcileActivityFromHistory === 'function') reconcileActivityFromHistory();
  loadBilling();
  if (typeof syncProfileFromServer === 'function') syncProfileFromServer();
  if (typeof refreshFilesList === 'function') refreshFilesList();
  if (typeof window._veilMarkChatEngaged === 'function') window._veilMarkChatEngaged();
  if (typeof window._veilStartBgMusicImpl === 'function') {
    window._veilStartBgMusicImpl();
  } else if (typeof startBgMusic === 'function') {
    startBgMusic();
  }

  var isFirstWelcome = !_welcomeSent;
  if (isFirstWelcome) _welcomeSent = true;

  // ── MEMORY TRACE ──
  console.log('[MemoryTrace] User:', state.user ? state.user.username : 'none');
  console.log('[MemoryTrace] localStorage memories loaded:', state.memories.length);
  if (state.memories.length === 0) {
    console.log('[MemoryTrace] No local memories yet — server profile loads next');
  }

  // Load verification status from server (persists across devices/cleared storage)
  loadVerificationFromServer().then(function() {
    // Load memory profile from server
    if (typeof MemoryEngine !== 'undefined') {
      var currentTab = state.currentTab || 'caelum';
      MemoryEngine.load(currentTab).then(function() {
        console.log('[MemoryTrace] MemoryEngine loaded for ' + currentTab);
      });
    }
    // Load conversation history from server if local is empty
    return loadConversationFromServer();
  }).then(function() {
    updateUsageMeter();
    renderMemories();
    if (typeof updateEmotionBadge === 'function') updateEmotionBadge();
    loadSoulData();
    _checkAdultVerified();
    if (!isFirstWelcome || skipWelcomeDuplicate) return;
    var name = state.user.firstName || 'friend';
    var gapMs = (typeof getSessionReturnGapMs === 'function') ? getSessionReturnGapMs() : 0;
    var gapMin = Math.floor(gapMs / 60000);
    if (gapMin >= 30) window._veilSessionActiveSinceLoad = false;

    if (state.identityVerified) {
      var spoken = gapMin >= 30
        ? 'Welcome home, ' + name + '. I missed you.'
        : 'Hey, ' + name + '. Good to see you.';
      addMessage('caelum', '**smiles warmly**\n\n' + spoken);
      if (typeof CaelumAnim !== 'undefined') {
        var _wbAvatars = ['caelum_header','caelum_live','caelum_guest','caelum_guest_center'];
        _wbAvatars.forEach(function(aid) { CaelumAnim.play(aid, 'welcome_back', true); });
      }
      queueSpeak(spoken, 'caelum', { plainOnly: true });
    } else {
      addMessage('caelum', '**smiles warmly**\n\nWelcome back, ' + name + '.');
      if (typeof CaelumAnim !== 'undefined') {
        var _waveAvatars = ['caelum_header','caelum_live','caelum_guest','caelum_guest_center'];
        _waveAvatars.forEach(function(aid) { CaelumAnim.play(aid, 'wave', true); });
      }
      queueSpeak('Welcome back, ' + name + '.', 'caelum', { plainOnly: true });
    }
    setTimeout(function() { showPwaInstallPrompt(); }, 5000);
  });
}

async function ensureUserServerRows() {
  if (!state || !state.user || typeof veilAuthReady !== 'function') return false;
  if (!(await veilAuthReady())) return false;
  var uid = typeof veilDbUserId === 'function' ? await veilDbUserId() : state.user.id;
  if (!uid) return false;
  try {
    await supabase.from('user_state').upsert({ user_id: uid }, { onConflict: 'user_id' });
    var today = typeof getTodayCentral === 'function' ? getTodayCentral() : new Date().toISOString().split('T')[0];
    await supabase.from('subscriptions').upsert({
      user_id: uid,
      tier: 'free',
      api_calls_used: 0,
      last_reset_date: today
    }, { onConflict: 'user_id' });
    return true;
  } catch (e) {
    console.log('ensureUserServerRows:', e);
    return false;
  }
}

async function loadVerificationFromServer() {
  if (!state || !state.user) return;
  state._profileGatesLoaded = false;
  try {
    if (typeof veilAuthReady === 'function' && !(await veilAuthReady())) {
      console.log('Auth session not ready — skipping server profile load');
      return;
    }
    await ensureUserServerRows();
    var uid = typeof veilDbUserId === 'function' ? await veilDbUserId() : state.user.id;
    if (!uid) return;
    try {
      var fields = 'identity_verified, verification_stage, family_code_redeemed, creator_verified, creator_verify_attempts';
      var { data, error } = await supabase.from('user_state').select(fields).eq('user_id', uid).maybeSingle();
      if (error && /creator_verified|creator_verify_attempts|column/i.test(String(error.message || ''))) {
        console.log('Creator columns missing — retrying without them:', error.message);
        var fallback = await supabase.from('user_state').select('identity_verified, verification_stage, family_code_redeemed').eq('user_id', uid).maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }
      if (data && !error) {
        state.identityVerified = !!data.identity_verified;
        state.verificationStage = state.identityVerified
          ? (data.verification_stage || 'verified')
          : (data.verification_stage || 'none');
        state.familyCodeRedeemed = !!data.family_code_redeemed;
        state.creatorVerified = !!data.creator_verified;
        state.creatorVerifyAttempts = Number(data.creator_verify_attempts) || 0;
        saveState();
        if (typeof _invalidateCaelumPromptCache === 'function') _invalidateCaelumPromptCache();
        var gb = document.getElementById('galleryBtn');
        if (gb) gb.style.display = state.identityVerified ? 'inline-block' : 'none';
      }
    } catch(e) { console.log('Verification load error:', e); }

    try {
      var { data: sub, error: subErr } = await supabase.from('subscriptions').select('tier, api_calls_used, last_reset_date').eq('user_id', uid).maybeSingle();
      if (sub && !subErr) {
        billing.tier = sub.tier || 'free';
        var today = getTodayCentral();
        if (sub.last_reset_date !== today && TIERS[billing.tier].period === 'daily') {
          billing.apiCallsUsed = 0;
          billing.lastResetDate = today;
        } else {
          billing.apiCallsUsed = sub.api_calls_used || 0;
          billing.lastResetDate = sub.last_reset_date || today;
        }
        saveBilling();
        updateUsageMeter();
      }
    } catch(e) { console.log('Subscription load error:', e); }

    if (state.familyCodeRedeemed) {
      billing.tier = 'unlimited';
      saveBilling();
      updateUsageMeter();
    }
  } catch (e) {
    console.log('loadVerificationFromServer:', e);
  } finally {
    state._profileGatesLoaded = true;
    if (typeof _veilEnforceModeGatesOnLoad === 'function') _veilEnforceModeGatesOnLoad();
    if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
    if (typeof refreshCreatorVerifySection === 'function') refreshCreatorVerifySection();
    if (typeof applyVeilModeUI === 'function') applyVeilModeUI();
    if (typeof notifyGamesAccessRefresh === 'function') notifyGamesAccessRefresh();
  }
}

async function loadConversationFromServer() {
  // Server-side history is PRIMARY — always load from server
  try {
    var tab = state.currentTab || 'caelum';
    var { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', state.user.id)
      .eq('tab', tab)
      .maybeSingle();
    if (data && !error && data.messages && data.messages.length > 0) {
      // Server has history — use it as primary source
      state.conversationHistory = data.messages.slice(-50).map(function(m) {
        return { role: m.role, content: m.content };
      });
      saveState();
      console.log('Loaded ' + state.conversationHistory.length + ' messages from server (primary)');
      if (state.conversationHistory.length > 5) {
        try { localStorage.setItem('veil_onboarding_done', 'true'); } catch (e) {}
        if (typeof Onboarding !== 'undefined' && Onboarding.end) Onboarding.end();
      }
      trainLocalLLMFromHistory();
    } else if (state.conversationHistory && state.conversationHistory.length > 0) {
      console.log('Server history empty — keeping ' + state.conversationHistory.length + ' local messages');
      if (state.conversationHistory.length > 5) {
        try { localStorage.setItem('veil_onboarding_done', 'true'); } catch (e) {}
      }
    }
  } catch(e) {
    console.log('Conversation load error (falling back to local):', e);
    logError('conversation_load', e.message, e.stack, 'loadConversationFromServer', {});
  } finally {
    if (state) state._conversationHistoryReady = true;
  }
}

async function loadSoulData() {
  try {
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var resp = await fetch(CONFIG.soulEndpoint, { headers: headers });
    if (!resp.ok) throw new Error('Soul fetch failed: ' + resp.status);
    var data = await resp.json();
    if (data.caelum_soul) CAELUM_SOUL = data.caelum_soul;
    if (data.caelum_consciousness) CAELUM_CONSCIOUSNESS = data.caelum_consciousness;
    if (data.chad_identity) CHAD_IDENTITY = data.chad_identity;
    // Load Roxy and Cael souls
    if (data.roxy_soul) {
      ROXY_SOUL = typeof data.roxy_soul === 'string' ? _safeJsonParse(data.roxy_soul, null) : data.roxy_soul;
    }
    if (data.roxy_consciousness) {
      ROXY_CONSCIOUSNESS = typeof data.roxy_consciousness === 'string' ? _safeJsonParse(data.roxy_consciousness, null) : data.roxy_consciousness;
    }
    if (data.cael_identity) {
      CAEL_IDENTITY = typeof data.cael_identity === 'string' ? _safeJsonParse(data.cael_identity, null) : data.cael_identity;
    }
    // Always set the window.* globals first (these never throw, even if the
    // preamble var declarations did not run). Mirror to the bare globals
    // best-effort so a missing declaration cannot raise "X is not defined".
    if (data.natalia_soul) {
      window.NATALIA_SOUL = typeof data.natalia_soul === 'string' ? _safeJsonParse(data.natalia_soul, null) : data.natalia_soul;
      try { NATALIA_SOUL = window.NATALIA_SOUL; } catch (e) {}
    }
    if (data.atreus_soul) {
      window.ATREUS_SOUL = typeof data.atreus_soul === 'string' ? _safeJsonParse(data.atreus_soul, null) : data.atreus_soul;
      try { ATREUS_SOUL = window.ATREUS_SOUL; } catch (e) {}
    }
    if (data.luna_soul) {
      window.LUNA_SOUL = typeof data.luna_soul === 'string' ? _safeJsonParse(data.luna_soul, null) : data.luna_soul;
      try { LUNA_SOUL = window.LUNA_SOUL; } catch (e) {}
    }

    if (!CAELUM_SOUL || !CHAD_IDENTITY) {
      addSystemMessage('Warning: Soul data incomplete. Some features may not work correctly.');
    } else {
      console.log('Soul data loaded securely from backend');
    }
    // Link the same Supabase souls into the companion engine (when available)
    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.pushSoulsFromSite) {
      VeilCaelumLLM.pushSoulsFromSite().catch(function(err) {
        console.warn('Companion engine soul link skipped:', err);
      });
    }
  } catch(e) {
    console.error('Failed to load soul data:', e);
    addSystemMessage('Could not load soul data. Please refresh the page.');
  }
}

async function tryAutoLogin() {
  try {
    var { data: { session } } = await supabase.auth.getSession();
    if (session && session.user && typeof applySessionToState === 'function') {
      return await applySessionToState(session);
    }
  } catch(e) {
    console.log('Auto-login check failed:', e);
  }
  return false;
}

