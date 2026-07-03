// ============================================================
// CROSS-SITE PROFILE SYNC — billing, tier, family code via Supabase
// Same account on main / beta / private shares server state (not localStorage alone)
// ============================================================
async function syncProfileFromServer() {
  if (!state || !state.user || !state.user.id) return;
  if (typeof loadVerificationFromServer === 'function') {
    await loadVerificationFromServer();
  }
  if (typeof updateUsageMeter === 'function') updateUsageMeter();
  if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
  if (typeof notifyGamesAccessRefresh === 'function') notifyGamesAccessRefresh();
}

supabase.auth.onAuthStateChange(async function(event, session) {
  if (event === 'SIGNED_OUT') {
    state.user = null;
    if (typeof resetWelcomeState === 'function') resetWelcomeState();
    return;
  }
  if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    var needsLogin = !state.user || state.user.id !== session.user.id;
    if (needsLogin && !window._veilAdultGateVerifying && typeof applySessionToState === 'function') {
      await applySessionToState(session);
      if (typeof onUserLoggedIn === 'function') onUserLoggedIn();
    }
    setTimeout(syncProfileFromServer, window._veilAdultGateVerifying ? 900 : 400);
  } else if (session && event === 'TOKEN_REFRESHED') {
    if (!window._veilAdultGateVerifying) {
      setTimeout(syncProfileFromServer, 400);
    }
  }
});

document.addEventListener('DOMContentLoaded', function() {
  supabase.auth.getSession().then(function(r) {
    if (r.data.session) {
      setTimeout(syncProfileFromServer, 800);
    } else {
      if (typeof _veilEnforceModeGatesOnLoad === 'function') _veilEnforceModeGatesOnLoad();
      if (typeof applyVeilModeUI === 'function') applyVeilModeUI({ skipAdultPrompt: true });
    }
  });
});
