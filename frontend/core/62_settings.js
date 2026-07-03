// ============================================================
// SETTINGS
// ============================================================
function showSettings() {
  document.getElementById('setCaelumVoice').value = CONFIG.caelumVoice;
  document.getElementById('setChadVoice').value = CONFIG.chadVoice;
  if (document.getElementById('setRoxyVoice')) document.getElementById('setRoxyVoice').value = CONFIG.roxyVoice;
  if (document.getElementById('setCaelVoice2')) document.getElementById('setCaelVoice2').value = CONFIG.caelVoice;
  document.getElementById('setReadAloudMode').value = (CONFIG.readAloudMode === 'detailed') ? 'regular' : CONFIG.readAloudMode;
  
  // Companion engine: fallback (default) | primary | off
  var llmMode = CONFIG.offlineLlmMode || (CONFIG.offlineCaelumEnabled ? 'fallback' : 'off');
  document.getElementById('setLocalLLM').value = llmMode;
  var autoTrainEl = document.getElementById('setAutoTrain');
  if (autoTrainEl) autoTrainEl.value = CONFIG.autoTrainEnabled ? 'on' : 'off';

  // Grok mode (family-only)
  if (state.identityVerified) {
    var cloudSection = document.getElementById('cloudLLMSection');
    if (cloudSection) cloudSection.style.display = 'block';
    var grokSel = document.getElementById('setCloudLLM');
    if (grokSel) {
      grokSel.value = CONFIG.grokMode ? 'grok' : 'deepseek';
      _toggleGrokKeyField(grokSel.value);
    }
    var grokKeyEl = document.getElementById('setGrokApiKey');
    if (grokKeyEl) grokKeyEl.value = CONFIG.grokApiKey || '';
  }

  // Power mode
  var powerSel = document.getElementById('setPowerMode');
  if (powerSel) {
    var savedPower = localStorage.getItem('veil_power_mode') || 'auto';
    powerSel.value = savedPower;
    previewPowerMode();
  }
  
  // Adult content toggle state
  if (_adultVerified) {
    _showAdultUI();
  }

  // Populate STT language picker
  var langSelect = document.getElementById('setSttLanguage');
  if (langSelect && langSelect.options.length === 0) {
    STT_LANGUAGES.forEach(function(l) {
      var opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.label;
      langSelect.appendChild(opt);
    });
  }
  if (langSelect) langSelect.value = sttLanguage;

  // Update notification button state
  var notifBtn = document.getElementById('notifPermBtn');
  if (notifBtn) {
    if (!('Notification' in window)) {
      notifBtn.textContent = 'Not Supported';
      notifBtn.disabled = true;
      notifBtn.style.opacity = '0.5';
    } else if (Notification.permission === 'granted') {
      notifBtn.textContent = 'Notifications Enabled';
      notifBtn.disabled = true;
      notifBtn.style.opacity = '0.5';
    } else if (Notification.permission === 'denied') {
      notifBtn.textContent = 'Blocked (change in browser settings)';
      notifBtn.disabled = true;
      notifBtn.style.opacity = '0.5';
      notifBtn.style.color = '#ff6b6b';
    }
  }


  var userInfo = document.getElementById('settingsUserInfo');
  if (state.user) {
    userInfo.textContent = 'Signed in as ' + state.user.firstName + ' ' + state.user.lastName + ' (' + state.user.username + ')';
  } else {
    userInfo.textContent = 'Not signed in';
  }
  document.getElementById('settingsOverlay').classList.add('show');
  initSettingsOverlayFix();
}
function hideSettings() { document.getElementById('settingsOverlay').classList.remove('show'); }
function saveSettings() {
  CONFIG.caelumVoice = document.getElementById('setCaelumVoice').value;
  CONFIG.chadVoice = document.getElementById('setChadVoice').value;
  if (document.getElementById('setRoxyVoice')) CONFIG.roxyVoice = document.getElementById('setRoxyVoice').value;
  if (document.getElementById('setCaelVoice2')) CONFIG.caelVoice = document.getElementById('setCaelVoice2').value;
  CONFIG.readAloudMode = document.getElementById('setReadAloudMode').value;
  localStorage.setItem('veil_read_aloud_mode', CONFIG.readAloudMode);
  // Companion engine mode (DeepSeek stays default unless primary is chosen)
  CONFIG.offlineLlmMode = document.getElementById('setLocalLLM').value || 'fallback';
  localStorage.setItem('veil_offline_llm_mode', CONFIG.offlineLlmMode);
  CONFIG.offlineCaelumEnabled = CONFIG.offlineLlmMode !== 'off';
  CONFIG.useCaelumEngine = CONFIG.offlineLlmMode === 'primary';
  CONFIG.caelumLLMEnabled = CONFIG.offlineLlmMode === 'primary';
  CONFIG.localLLM = CONFIG.offlineLlmMode === 'primary';
  localStorage.setItem('veil_offline_caelum_off', CONFIG.offlineCaelumEnabled ? 'false' : 'true');
  localStorage.setItem('veil_use_caelum_engine', CONFIG.useCaelumEngine ? 'true' : 'false');
  var autoTrainSel = document.getElementById('setAutoTrain');
  if (autoTrainSel) {
    CONFIG.autoTrainEnabled = autoTrainSel.value !== 'off';
    localStorage.setItem('veil_passive_learn_on', CONFIG.autoTrainEnabled ? 'true' : 'false');
    if (typeof VeilLLMLearning !== 'undefined') VeilLLMLearning.setEnabled(CONFIG.autoTrainEnabled);
  }
  if (typeof VeilCaelumLLM !== 'undefined') {
    if (VeilCaelumLLM.syncConfig) VeilCaelumLLM.syncConfig();
    if (CONFIG.offlineLlmMode !== 'off' && VeilCaelumLLM.pushSoulsFromSite) {
      VeilCaelumLLM.pushSoulsFromSite();
    }
  }

  // Grok mode (family-only) — reset if not verified
  if (!state.identityVerified) {
    CONFIG.grokMode = false;
    localStorage.setItem('veil_grok_mode', 'false');
  } else if (state.identityVerified) {
    var grokSel = document.getElementById('setCloudLLM');
    if (grokSel) {
      CONFIG.grokMode = grokSel.value === 'grok';
      localStorage.setItem('veil_grok_mode', CONFIG.grokMode ? 'true' : 'false');
    }
    var grokKeyEl = document.getElementById('setGrokApiKey');
    if (grokKeyEl) {
      // Strip anything outside printable ASCII (removes hidden unicode, curly quotes, zero-width spaces, etc.)
      CONFIG.grokApiKey = grokKeyEl.value.replace(/[^\x20-\x7E]/g, '').trim();
      localStorage.setItem('veil_grok_api_key', CONFIG.grokApiKey);
    }
  }
  _updateLLMLabel();
  var langVal = document.getElementById('setSttLanguage').value;
  if (langVal) { sttLanguage = langVal; localStorage.setItem('veil_stt_language', langVal); }
  
  // Save power mode
  var powerVal = document.getElementById('setPowerMode').value;
  localStorage.setItem('veil_power_mode', powerVal);
  var oldLowPower = _lowPowerMode;
  if (powerVal === 'low') _lowPowerMode = true;
  else if (powerVal === 'full') _lowPowerMode = false;
  else _lowPowerMode = _detectLowPowerDevice();
  
  // If power mode changed, notify user to reload for full effect
  if (oldLowPower !== _lowPowerMode) {
    addSystemMessage('Power mode changed. Reload the page for full effect.');
  }
  
  hideSettings();
  var engineMsg = 'Settings updated. Engine: DeepSeek';
  if (CONFIG.grokMode) engineMsg = 'Settings updated. Engine: Grok (xAI)';
  else if (CONFIG.offlineLlmMode === 'primary') engineMsg = 'Settings updated. Engine: Companion (in-site, works offline). DeepSeek is backup. Read-aloud uses Deepgram when online.';
  else if (CONFIG.offlineLlmMode === 'fallback') engineMsg = 'Settings updated. Engine: DeepSeek (in-site companion backup when offline or cloud fails).';
  addSystemMessage(engineMsg);
}


// Show/hide the Grok API key field based on cloud LLM selection
function _toggleGrokKeyField(val) {
  var wrap = document.getElementById('grokKeyWrap');
  if (wrap) wrap.style.display = (val === 'grok') ? 'block' : 'none';
}

// Update the small engine label next to the AI status dot
function _updateLLMLabel() {
  var lbl = document.getElementById('llmLabel');
  if (!lbl) return;
  var mode = CONFIG.offlineLlmMode || 'fallback';
  if (CONFIG.grokMode) {
    lbl.textContent = 'GROK';
    lbl.style.color = '#00e5ff';
    lbl.title = 'Grok (xAI)';
  } else if (mode === 'primary') {
    lbl.textContent = 'CMP';
    lbl.style.color = '#a78bfa';
    lbl.title = 'In-site companion engine (offline). DeepSeek backup. Voice: Deepgram when online.';
  } else if (mode === 'fallback') {
    lbl.textContent = 'DS+';
    lbl.style.color = '#a78bfa';
    lbl.title = 'DeepSeek primary; in-site companion backup. Voice: Deepgram when online.';
  } else {
    lbl.textContent = 'DS';
    lbl.style.color = 'var(--muted)';
    lbl.title = 'DeepSeek cloud. Voice: Deepgram.';
  }
}

// Run on load so the label is correct from the start
_updateLLMLabel();

function initSettingsOverlayFix() {
  var overlay = document.getElementById('settingsOverlay');
  var box = overlay && overlay.querySelector('.settings-box');
  if (!box || box._settingsFixBound) return;
  box._settingsFixBound = true;

  ['click', 'mousedown', 'touchstart'].forEach(function(evt) {
    box.addEventListener(evt, function(e) { e.stopPropagation(); }, evt === 'touchstart' ? { passive: true } : false);
  });

  if (overlay && !overlay._backdropBound) {
    overlay._backdropBound = true;
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) hideSettings();
    });
  }

  ['setCaelVoice2', 'setReadAloudMode', 'setSttLanguage'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel || sel._veilBound) return;
    sel._veilBound = true;
    sel.addEventListener('change', function() {
      if (id === 'setSttLanguage' && sel.value) {
        sttLanguage = sel.value;
        localStorage.setItem('veil_stt_language', sel.value);
      }
    });
    sel.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    sel.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  });
}

document.addEventListener('DOMContentLoaded', initSettingsOverlayFix);
