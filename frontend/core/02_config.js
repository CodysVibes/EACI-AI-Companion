// ============================================================
// CONFIGURATION
// ============================================================
// REDACTED for public proof repo — replace with your own project values to run locally.
// Live site keys are not published here (backend / project identity stays private).
var SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
var SUPABASE_AUTH_STORAGE_KEY = 'sb-YOUR_PROJECT-auth-token';
var _veilAuthClientOpts = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    storage: typeof VeilAuthStorage !== 'undefined' ? VeilAuthStorage : undefined
  }
};
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _veilAuthClientOpts);

// Offline companion engine mode:
//   fallback — DeepSeek primary, Caelum engine backup (default, safe)
//   primary  — Caelum engine primary, DeepSeek backup
//   off      — DeepSeek only
var _offlineLlmMode = (function() {
  var m = localStorage.getItem('veil_offline_llm_mode');
  if (m === 'primary' || m === 'fallback' || m === 'off') return m;
  // Migrate older toggle
  if (localStorage.getItem('veil_offline_caelum_off') === 'true') return 'off';
  if (localStorage.getItem('veil_use_caelum_engine') === 'true') return 'primary';
  return 'fallback';
})();

var CONFIG = {
  supabaseUrl: SUPABASE_URL,
  // DeepSeek (Supabase edge) stays the default chat endpoint so nothing breaks
  chatEndpoint: SUPABASE_URL + '/functions/v1/chat',
  ttsEndpoint: SUPABASE_URL + '/functions/v1/tts',
  soulEndpoint: SUPABASE_URL + '/functions/v1/soul',
  paintEndpoint: SUPABASE_URL + '/functions/v1/canvas',
  verifyEndpoint: SUPABASE_URL + '/functions/v1/verify',
  sttTokenEndpoint: SUPABASE_URL + '/functions/v1/voice-token',
  sttEndpoint: SUPABASE_URL + '/functions/v1/stt',
  searchEndpoint: SUPABASE_URL + '/functions/v1/web-search',
  accountSecurityEndpoint: SUPABASE_URL + '/functions/v1/account-security',
  musicUsageEndpoint: SUPABASE_URL + '/functions/v1/music-usage',
  offlineLlmMode: _offlineLlmMode,
  // Derived flags (kept for older call sites)
  offlineCaelumEnabled: _offlineLlmMode !== 'off',
  autoTrainEnabled: localStorage.getItem('veil_passive_learn_on') !== 'false',
  // In-site browser engine (no separate server / Azure / Railway)
  useCaelumEngine: _offlineLlmMode === 'primary',
  caelumLLMEnabled: _offlineLlmMode === 'primary',
  localLLM: _offlineLlmMode === 'primary',
  localLLMUrl: '',
  // Grok (xAI) direct mode — bypasses Supabase chat endpoint
  grokMode: localStorage.getItem('veil_grok_mode') === 'true',
  grokApiKey: localStorage.getItem('veil_grok_api_key') || '',
  caelumVoice: 'aura-2-delia-en',
  roxyVoice: 'aura-2-thalia-en',
  caelVoice: 'aura-2-orion-en',
  nataliaVoice: 'aura-2-luna-en',
  atreusVoice: 'aura-2-hyperion-en',
  lunaVoice: 'aura-2-vesta-en',
  chadVoice: 'aura-2-draco-en',
  codyVoice: 'aura-2-arcas-en',
  readAloudMode: (function() {
    var m = localStorage.getItem('veil_read_aloud_mode') || 'regular';
    if (m === 'detailed') return 'regular';
    return m;
  })(),
  thoughtInterval: 18000,
  memoryExtractionEvery: 5
};

// Helper to get auth headers for edge function calls
// FIX #2: Cache session token — refresh only when expired or on auth state change
var _cachedSession = null;
var _sessionCacheTime = 0;
var SESSION_CACHE_MS = 4 * 60 * 1000;

supabase.auth.onAuthStateChange(function(event, session) {
  _cachedSession = session;
  _sessionCacheTime = Date.now();
});

async function getAuthHeaders() {
  var now = Date.now();
  if (!_cachedSession || (now - _sessionCacheTime) > SESSION_CACHE_MS) {
    var result = await supabase.auth.getSession();
    _cachedSession = result.data.session;
    _sessionCacheTime = now;
  }
  var headers = { 'apikey': SUPABASE_ANON_KEY, 'x-client-info': 'supabase-js/2.0.0' };
  if (_cachedSession) headers['Authorization'] = 'Bearer ' + _cachedSession.access_token;
  return headers;
}

async function veilAuthReady() {
  try {
    var result = await supabase.auth.getSession();
    var session = result.data && result.data.session;
    if (!session || !session.access_token) return false;
    if (state && state.user && state.user.id && session.user && state.user.id !== session.user.id) {
      if (typeof applySessionToState === 'function') {
        await applySessionToState(session);
      } else {
        state.user.id = session.user.id;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function veilDbUserId() {
  if (!(await veilAuthReady())) return null;
  try {
    var result = await supabase.auth.getSession();
    return result.data.session.user.id;
  } catch (e) {
    return null;
  }
}
