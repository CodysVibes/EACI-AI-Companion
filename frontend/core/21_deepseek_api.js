// ============================================================
// CHAT API — DeepSeek primary by default; Caelum engine optional
// Read-aloud always uses Deepgram (playReadAloudForText / ttsEndpoint).
// ============================================================

// Browser lite pack — last-resort fallback only
async function callLocalLLM(messages, who) {
  return await callBrowserCaelumFallback(messages, who);
}

// TRAINING — delegated to VeilLLMLearning (75_veil_llm_learning.js)
function trainLocalLLMFromHistory() {
  if (typeof VeilLLMLearning !== 'undefined') {
    VeilLLMLearning.syncDailyBatch();
  }
}

async function _tryCaelumEngineText(systemPrompt, messages, who, opts) {
  if (typeof VeilCaelumLLM === 'undefined' || !VeilCaelumLLM.callChat) return null;
  var text = await VeilCaelumLLM.callChat(systemPrompt, messages, who, opts || {});
  if (!text || !String(text).trim()) return null;
  return String(text).trim();
}

async function callDeepSeek(systemPrompt, messages, options) {
  var opts = options || {};
  var who = opts.who || 'caelum';

  // Settings: companion engine is primary — DeepSeek is backup
  if (!opts.forceCloud && typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isPrimary && VeilCaelumLLM.isPrimary()) {
    var engineText = await _tryCaelumEngineText(systemPrompt, messages, who, opts);
    if (engineText) {
      var lastUserE = '';
      for (var ui = messages.length - 1; ui >= 0; ui--) {
        if (messages[ui].role === 'user') { lastUserE = messages[ui].content; break; }
      }
      trainLocalLLMSingle(lastUserE, engineText, who);
      return engineText;
    }
  }

  // Offline / no network — use companion engine or browser lite if enabled
  if (!opts.forceCloud && (!navigator.onLine || (typeof isOffline !== 'undefined' && isOffline))) {
    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isFallbackEnabled && VeilCaelumLLM.isFallbackEnabled()) {
      var offlineEngine = await _tryCaelumEngineText(systemPrompt, messages, who, opts);
      if (offlineEngine) return offlineEngine;
    }
    var offline = await callBrowserCaelumFallback(messages, who);
    if (offline) return offline;
  }

  // Grok — family-verified accounts only
  if (CONFIG.grokMode && !opts.forceCloud && typeof state !== 'undefined' && state.identityVerified) {
    return await callGrok(systemPrompt, messages, opts);
  }

  // Default path: DeepSeek via Supabase edge
  try {
    document.getElementById('dotDeepseek').classList.add('on');
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var payload = {
      messages: [{ role: 'system', content: systemPrompt }].concat(messages),
      temperature: 0.7,
      max_tokens: 600
    };
    if (opts.skipCount) payload.skip_count = true;
    var resp = await fetch(CONFIG.chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    var raw = await resp.text();
    var data = _safeJsonParse(raw, {});

    if (data.error === 'limit_reached') {
      billing.apiCallsUsed = TIERS[billing.tier].limit;
      saveBilling();
      updateUsageMeter();
      return data.message || 'You have used all your API calls for today.';
    }

    if (data.choices && data.choices[0]) {
      var content = data.choices[0].message.content;
      content = content.replace(/^(Caelum|Chad)\s*[:]\s*/i, '');
      content = content.replace(/^\*\*(Caelum|Chad)\*\*\s*[:]\s*/i, '');
      var lastUser = '';
      for (var ui2 = messages.length - 1; ui2 >= 0; ui2--) {
        if (messages[ui2].role === 'user') { lastUser = messages[ui2].content; break; }
      }
      trainLocalLLMSingle(lastUser, content, opts.who || 'caelum');
      return content;
    }
    return 'I seem to be having trouble connecting to my thoughts right now.';
  } catch(e) {
    console.error('DeepSeek error:', e);
    logError('deepseek_api', e.message, e.stack, CONFIG.chatEndpoint, {});
    document.getElementById('dotDeepseek').classList.remove('on');
    removeThinkingIndicator('caelum');
    removeThinkingIndicator('chad');
    // Backup: companion engine, then browser lite
    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isFallbackEnabled && VeilCaelumLLM.isFallbackEnabled()) {
      var backup = await _tryCaelumEngineText(systemPrompt, messages, who, opts);
      if (backup) return backup;
    }
    var fallback = await callBrowserCaelumFallback(messages, who);
    if (fallback) return fallback;
    return 'Something went wrong reaching my thoughts. Please try again.';
  }
}


// ============================================================
// GROK (xAI) DIRECT API — used when CONFIG.grokMode is true
// Calls api.x.ai directly with the stored API key.
// Replaces the Supabase chat endpoint entirely.
// ============================================================
var GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
var GROK_MODEL   = 'grok-3-latest';

async function callGrok(systemPrompt, messages, options) {
  var opts = options || {};
  var key = (CONFIG.grokApiKey || '').replace(/[^\x20-\x7E]/g, '').trim();
  if (!key) {
    return 'No Grok API key set. Go to Settings and enter your xAI key.';
  }
  console.log('[Grok] callGrok fired — model:', GROK_MODEL);
  try {
    document.getElementById('dotDeepseek').classList.add('on');
    var payload = {
      model: GROK_MODEL,
      messages: [{ role: 'system', content: systemPrompt }].concat(messages),
      temperature: 0.7,
      max_tokens: 600
    };
    var resp = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    document.getElementById('dotDeepseek').classList.remove('on');
    if (data.choices && data.choices[0]) {
      var content = data.choices[0].message.content;
      content = content.replace(/^(Caelum|Chad)\s*[:]\s*/i, '');
      content = content.replace(/^\*\*(Caelum|Chad)\*\*\s*[:]\s*/i, '');
      return content;
    }
    if (data.error) return 'Grok error: ' + (data.error.message || JSON.stringify(data.error));
    return 'I seem to be having trouble connecting to my thoughts right now.';
  } catch(e) {
    console.error('Grok API error:', e);
    document.getElementById('dotDeepseek').classList.remove('on');
    return 'Something went wrong reaching Grok. Please try again.';
  }
}

async function callGrokStreaming(systemPrompt, messages, who, options) {
  var opts = options || {};
  var key = (CONFIG.grokApiKey || '').replace(/[^\x20-\x7E]/g, '').trim();
  var voice = typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(who) : CONFIG.caelumVoice;
  var mode = getReadAloudMode();
  console.log('[Grok] callGrokStreaming fired — who:', who, 'model:', GROK_MODEL);

  if (!key) {
    removeThinkingIndicator(who);
    var noKeyEl = addStreamingMessage(who);
    var noKeyMsg = 'No Grok API key set. Go to Settings and enter your xAI key.';
    updateStreamingMessage(noKeyEl, noKeyMsg, who);
    finalizeStreamingMessage(noKeyEl, noKeyMsg, who);
    return { text: noKeyMsg, ttsPromise: Promise.resolve(), streamEl: noKeyEl };
  }

  try {
    document.getElementById('dotDeepseek').classList.add('on');
    var payload = {
      model: GROK_MODEL,
      messages: [{ role: 'system', content: systemPrompt }].concat(messages),
      temperature: 0.7,
      max_tokens: 700,
      stream: true
    };

    var resp = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok || !resp.body) {
      var errData = {};
      try { errData = await resp.json(); } catch(e2) {}
      throw new Error('Grok stream error ' + resp.status + ': ' + (errData.error && errData.error.message ? errData.error.message : ''));
    }

    removeThinkingIndicator(who);
    var streamEl = addStreamingMessage(who);

    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var fullText = '';
    var buffer = '';
    var ttsPromise = Promise.resolve();

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data: ')) continue;
        var jsonStr = line.substring(6);
        if (jsonStr === '[DONE]') continue;
        try {
          var chunk = JSON.parse(jsonStr);
          var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && delta.content) {
            fullText += delta.content;

            // Repetition guard
            if (fullText.length > 200) {
              var last100 = fullText.slice(-100);
              var prev100 = fullText.slice(-200, -100);
              if (last100 === prev100) {
                fullText = fullText.slice(0, fullText.length - 100);
                reader.cancel();
                break;
              }
            }

            var cleanedDisplay = cleanResponse(fullText);
            updateStreamingMessage(streamEl, cleanedDisplay, who);
          }
        } catch(parseErr) { /* skip malformed chunks */ }
      }
    }

    var rawFullText = fullText;
    fullText = cleanResponse(fullText);
    fullText = fullText.replace(/^(Caelum|Chad)\s*[:]\s*/i, '');
    fullText = fullText.replace(/^\*\*(Caelum|Chad)\*\*\s*[:]\s*/i, '');
    if (typeof validateOutgoingMessage === 'function') {
      fullText = validateOutgoingMessage(fullText);
    }

    updateStreamingMessage(streamEl, fullText, who);
    finalizeStreamingMessage(streamEl, fullText, who);

    if (mode !== 'off') {
      ttsPromise = playReadAloudForText(fullText, who);
    }

    triggerActionReactions(parseActions(fullText), who);

    var lastUserGrok = '';
    for (var gi = messages.length - 1; gi >= 0; gi--) {
      if (messages[gi].role === 'user') { lastUserGrok = messages[gi].content; break; }
    }
    if (lastUserGrok && typeof trainLocalLLMSingle === 'function') {
      trainLocalLLMSingle(lastUserGrok, fullText, who, 'grok');
    }

    if (document.hidden) {
      var notifName = who === 'chad' ? 'Chad' : 'Caelum';
      var notifText = stripActions(fullText).substring(0, 100);
      showLocalNotification(notifName + ' responded', notifText);
    }

    document.getElementById('dotDeepseek').classList.remove('on');
    return { text: fullText, rawText: rawFullText, ttsPromise: ttsPromise, streamEl: streamEl };

  } catch(e) {
    console.error('Grok streaming error:', e);
    document.getElementById('dotDeepseek').classList.remove('on');
    removeThinkingIndicator(who);
    return eaciConnectionErrorResponse('Something went wrong reaching Grok. Please try again.', who);
  }
}
