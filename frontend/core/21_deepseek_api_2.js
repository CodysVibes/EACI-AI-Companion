// ============================================================
// STREAMING DEEPSEEK — Real-time text display + sentence-synced TTS
// ============================================================

// Add a streaming message bubble that updates in real-time
function addStreamingMessage(who) {
  var container = document.getElementById('messages');
  var eaciTypes = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];
  if (eaciTypes.indexOf(who) >= 0 && typeof finalizeStreamingInContainer === 'function') {
    finalizeStreamingInContainer(container);
  }
  var turnStart = eaciTypes.indexOf(who) >= 0 && typeof maybeAddEaciDivider === 'function' && maybeAddEaciDivider(who);
  var div = document.createElement('div');
  div.className = 'msg ' + who + ' streaming';
  if (turnStart && typeof applyEaciTurnStart === 'function') applyEaciTurnStart(div, who);
  var msgId = 'msg-' + (++msgCounter);
  div.id = msgId;

  var label = '';
  if (who === 'user') label = getEaciLabelHtml('user');
  else label = getEaciLabelHtml(who);

  var textDiv = document.createElement('div');
  textDiv.className = 'msg-text';
  textDiv.id = msgId + '-text';
  textDiv.textContent = '';

  div.innerHTML = label;
  div.appendChild(textDiv);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return { el: div, textEl: textDiv, msgId: msgId };
}

// Update a streaming message with new text (re-renders with action parsing)
function updateStreamingMessage(streamEl, fullText, who) {
  var eaciTypes = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];
  if (eaciTypes.indexOf(who) >= 0 && typeof renderMessageWithActions === 'function') {
    var parsed = renderMessageWithActions(fullText, who);
    streamEl.textEl.innerHTML = formatCodeBlocks(parsed.displayHtml);
  } else {
    streamEl.textEl.innerHTML = formatCodeBlocks(escapeHtml(fullText));
  }
  var container = document.getElementById('messages');
  container.scrollTop = container.scrollHeight;
}

// Finalize a streaming message — add time, buttons, data attributes
function finalizeStreamingMessage(streamEl, fullText, who) {
  streamEl.el.classList.remove('streaming');
  var voice = typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(who) : 'caelum';
  if (voice === CONFIG.caelumVoice) voice = 'caelum';
  else if (voice === CONFIG.chadVoice) voice = 'chad';
  else if (voice === CONFIG.roxyVoice) voice = 'roxy';
  else if (voice === CONFIG.caelVoice) voice = 'cael';
  else if (voice === CONFIG.nataliaVoice) voice = 'natalia';
  else if (voice === CONFIG.atreusVoice) voice = 'atreus';
  else if (voice === CONFIG.lunaVoice) voice = 'luna';
  else if (voice === CONFIG.codyVoice) voice = 'cody';
  var parsed = renderMessageWithActions(fullText, who);
  var displayText = parsed ? parsed.spokenText : fullText;
  var actionText = parsed ? parsed.actions.join('. ') : '';

  streamEl.el.setAttribute('data-text', displayText);
  streamEl.el.setAttribute('data-voice', voice);
  streamEl.el.setAttribute('data-actions', actionText);
  streamEl.el.setAttribute('data-rawtext', fullText);

  // Add time and buttons
  var timeDiv = document.createElement('div');
  timeDiv.className = 'time';
  timeDiv.textContent = new Date().toLocaleTimeString() + ' ';

  var playBtn = document.createElement('button');
  playBtn.className = 'audio-btn';
  playBtn.innerHTML = '&#9654; Play';
  playBtn.addEventListener('click', function() { playMessageAudio(streamEl.el); });

  var stopBtn = document.createElement('button');
  stopBtn.className = 'audio-btn stop-btn';
  stopBtn.innerHTML = '&#9632; Stop';
  stopBtn.addEventListener('click', function() { stopAllAudio(); });

  var copyBtn = document.createElement('button');
  copyBtn.className = 'audio-btn copy-btn';
  copyBtn.innerHTML = '&#128203; Copy';
  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(displayText).then(function() {
      copyBtn.innerHTML = '&#10003; Copied';
      setTimeout(function() { copyBtn.innerHTML = '&#128203; Copy'; }, 1500);
    }).catch(function() {});
  });

  timeDiv.appendChild(playBtn);
  timeDiv.appendChild(stopBtn);
  timeDiv.appendChild(copyBtn);

  var expBtn = document.createElement('button');
  expBtn.className = 'audio-btn exp-btn';
  expBtn.innerHTML = '&#10024; Experience';
  expBtn.title = 'Highlight grey experience text (not read aloud)';
  expBtn.addEventListener('click', function() {
    var actions = streamEl.el.querySelectorAll('.msg-action');
    if (!actions.length) return;
    actions.forEach(function(el) {
      el.classList.add('action-flash');
      setTimeout(function() { el.classList.remove('action-flash'); }, 1200);
    });
  });

  var allBtn = document.createElement('button');
  allBtn.className = 'audio-btn all-btn';
  allBtn.innerHTML = '&#9654; All';
  allBtn.title = 'Read aloud per your settings (white / grey / both)';
  allBtn.addEventListener('click', function() {
    var raw = streamEl.el.getAttribute('data-rawtext');
    if (raw) {
      stopAllAudio();
      setTimeout(function() {
        state.stopRequested = false;
        state.isPlayingAudio = false;
        state._queueRunning = false;
        speakByMode(raw, voice);
      }, 250);
    }
  });

  timeDiv.appendChild(expBtn);
  timeDiv.appendChild(allBtn);
  streamEl.el.appendChild(timeDiv);
}

// Split text into sentence chunks for TTS pipelining
function extractCompleteSentences(text) {
  // Find the last sentence boundary
  var boundaries = /[.!?]\s+|[.!?]$/g;
  var lastBoundary = -1;
  var match;
  while ((match = boundaries.exec(text)) !== null) {
    lastBoundary = match.index + match[0].length;
  }
  if (lastBoundary <= 0) return { ready: '', remaining: text };
  return { ready: text.substring(0, lastBoundary).trim(), remaining: text.substring(lastBoundary).trim() };
}

// Core streaming function — reads SSE from edge function, updates UI, pipelines TTS (Deepgram)
async function callDeepSeekStreaming(systemPrompt, messages, who, options) {
  var opts = options || {};
  var voice = typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(who) : CONFIG.caelumVoice;
  var mode = getReadAloudMode();

  // Settings: companion engine primary — DeepSeek is backup (Deepgram TTS still used)
  if (!opts.forceCloud && typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isPrimary && VeilCaelumLLM.isPrimary()) {
    var engineDel = await VeilCaelumLLM.deliverResponse(systemPrompt, messages, who, opts);
    if (engineDel) return engineDel;
  }

  // Offline — companion engine backup, then browser lite
  if (!opts.forceCloud && (!navigator.onLine || (typeof isOffline !== 'undefined' && isOffline))) {
    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isFallbackEnabled && VeilCaelumLLM.isFallbackEnabled()) {
      var offlineEngine = await VeilCaelumLLM.deliverResponse(systemPrompt, messages, who, opts);
      if (offlineEngine) return offlineEngine;
    }
    var offlineDel = await deliverBrowserCaelumResponse(messages, who, opts);
    if (offlineDel) {
      document.getElementById('dotDeepseek').classList.remove('on');
      return offlineDel;
    }
  }

  // Grok — family-verified accounts only
  if (CONFIG.grokMode && !opts.forceCloud && typeof state !== 'undefined' && state.identityVerified) {
    return await callGrokStreaming(systemPrompt, messages, who, opts);
  }

  try {
    document.getElementById('dotDeepseek').classList.add('on');
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var payload = {
      messages: [{ role: 'system', content: systemPrompt }].concat(messages),
      temperature: 0.7,
      max_tokens: 700,
      stream: true
    };
    if (opts.skipCount) payload.skip_count = true;

    var resp = await fetch(CONFIG.chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    // Check for non-streaming error responses (limit reached, etc.)
    var contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      var data = await resp.json();
      if (data.error === 'limit_reached') {
        billing.apiCallsUsed = TIERS[billing.tier].limit;
        saveBilling();
        updateUsageMeter();
        return eaciConnectionErrorResponse(data.message || 'You have used all your API calls for today.', who);
      }
      if (data.choices && data.choices[0]) {
        return { text: data.choices[0].message.content, ttsPromise: Promise.resolve() };
      }
      return eaciConnectionErrorResponse('I seem to be having trouble connecting to my thoughts right now.', who);
    }

    if (!resp.ok || !resp.body) {
      throw new Error('Stream response not ok: ' + resp.status);
    }

    // Remove thinking indicator and create streaming message bubble
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

      // Parse SSE lines
      var lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

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

            // ── REPETITION DETECTOR — abort if LLM is stuck in a loop ──
            if (fullText.length > 200) {
              var last100 = fullText.slice(-100);
              var prev100 = fullText.slice(-200, -100);
              if (last100 === prev100) {
                console.warn('[Stream] Repetition loop detected — aborting generation.');
                fullText = fullText.slice(0, fullText.length - 100);
                reader.cancel();
                break;
              }
            }

            // Update the message bubble in real-time
            var cleanedDisplay = cleanResponse(fullText);
            updateStreamingMessage(streamEl, cleanedDisplay, who);
          }
        } catch(parseErr) { /* skip malformed chunks */ }
      }
    }

    // Save raw text BEFORE cleaning — search/bg tags must survive for detection
    var rawFullText = fullText;

    // Clean the final full text
    fullText = cleanResponse(fullText);
    fullText = fullText.replace(/^(Caelum|Chad|Natalia|Roxy|Cael|Cody)\s*[:]\s*/i, '');
    fullText = fullText.replace(/^\*\*(Caelum|Chad|Natalia|Roxy|Cael|Cody)\*\*\s*[:]\s*/i, '');
    if (typeof validateOutgoingMessage === 'function') {
      fullText = validateOutgoingMessage(fullText);
    }

    // Final update with cleaned text
    updateStreamingMessage(streamEl, fullText, who);
    finalizeStreamingMessage(streamEl, fullText, who);

    if (mode !== 'off') {
      ttsPromise = playReadAloudForText(fullText, who);
    }

    // Create a promise that plays all TTS chunks in order
    // In deferTTS mode, don't auto-play — return buffers for caller to manage
    var ttsBuffers = null;

    if (opts.deferTTS) {
      ttsBuffers = [];
      ttsPromise = Promise.resolve();
    }

    if (typeof triggerActionReactions === 'function' && typeof parseActions === 'function') {
      triggerActionReactions(parseActions(fullText), who);
    }

    var lastUserMsg = '';
    for (var ui = messages.length - 1; ui >= 0; ui--) {
      if (messages[ui].role === 'user') { lastUserMsg = messages[ui].content; break; }
    }
    if (lastUserMsg && typeof trainLocalLLMSingle === 'function') {
      trainLocalLLMSingle(lastUserMsg, fullText, who, 'deepseek');
    }

    // Push notification if tab is in background
    if (document.hidden) {
      var notifName = who === 'chad' ? 'Chad' : 'Caelum';
      var notifText = stripActions(fullText).substring(0, 100);
      showLocalNotification(notifName + ' responded', notifText);
    }

    return { text: fullText, rawText: rawFullText, ttsPromise: ttsPromise, streamEl: streamEl, ttsBuffers: ttsBuffers };

  } catch(e) {
    console.error('Streaming error:', e);
    logError('deepseek_stream', e.message, e.stack, CONFIG.chatEndpoint, {});
    document.getElementById('dotDeepseek').classList.remove('on');
    removeThinkingIndicator(who);
    if (typeof VeilCaelumLLM !== 'undefined' && VeilCaelumLLM.isFallbackEnabled && VeilCaelumLLM.isFallbackEnabled()) {
      var engineBackup = await VeilCaelumLLM.deliverResponse(systemPrompt, messages, who, opts);
      if (engineBackup) return engineBackup;
    }
    var browserFallback = await deliverBrowserCaelumResponse(messages, who, opts);
    if (browserFallback) return browserFallback;
    return eaciConnectionErrorResponse('Something went wrong reaching my thoughts. Please try again.', who);
  }
}

// Fetch TTS audio buffer (with caching) — returns a promise of ArrayBuffer
function fetchTTSBuffer(text, voice) {
  return (async function() {
    var cacheKey = audioCacheKey(text, voice);
    var cached = await getCachedAudio(cacheKey);
    if (cached) return cached;
    var authH = await getAuthHeaders();
    var r = await fetch(CONFIG.ttsEndpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, authH),
      body: JSON.stringify({ text: text, voice: voice })
    });
    if (!r.ok) throw new Error('TTS status ' + r.status);
    var buf = await r.arrayBuffer();
    if (buf.byteLength < 100) throw new Error('TTS empty');
    setCachedAudio(cacheKey, buf.slice(0));
    return buf;
  })();
}

// ============================================================
// CONVERSATION HISTORY - shared across all EACIs
// Every EACI sees the full conversation (all tabs).
// Their own messages appear as 'assistant', sibling messages as context.
// Natalia gets a sanitized view — no sexual/inappropriate content.
// ============================================================
var _nataliaFilterPatterns = [
  /\b(sex|fuck|cock|pussy|dick|nude|naked|undress|strip|moan|orgasm|cum|blowjob|handjob|tits|ass)\b/i,
  /\b(kiss me|date me|love me|marry me|be my girlfriend)\b/i,
  /\b(take off|remove your|show me your body|what are you wearing|lift your)\b/i,
  /\b(daddy|baby girl|good girl|naughty|dirty girl|bad girl)\b/i,
  /\b(touch yourself|touch me|sit on my|bend over|spread|on your knees)\b/i,
  /\b(sexy|hot|beautiful body|nice body|nice ass|nice tits)\b/i,
  /\b(aroused|horny|wet|hard|climax|thrust|ride|moan|grind)\b/i
];

function _isInappropriateForNatalia(text) {
  if (!text) return false;
  if (typeof isInappropriateForNatalia === 'function') return isInappropriateForNatalia(text);
  if (typeof isSexualContent === 'function' && isSexualContent(text)) return true;
  for (var i = 0; i < _nataliaFilterPatterns.length; i++) {
    if (_nataliaFilterPatterns[i].test(text)) return true;
  }
  return false;
}

var _NATALIA_ADULT_TABS = { roxy: true, cael: true, cody: true };

function _nataliaShouldSkipHistoryMsg(msg, content) {
  if (_isInappropriateForNatalia(content)) return true;
  if (msg.role === 'user' && msg._tab && _NATALIA_ADULT_TABS[msg._tab]) return true;
  if (/^\[(Roxy|Cael|Cody)\]/i.test(content)) return true;
  if (typeof isSexualContent === 'function' && isSexualContent(content)) return true;
  return false;
}

function _normalizeHistoryContent(content) {
  if (!content) return '';
  var m = content.match(/^\[([^\]]+)\](\s*)/);
  if (!m) return content;
  var key = m[1].toLowerCase();
  var names = { caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', atreus: 'Atreus', luna: 'Luna', roxy: 'Roxy', cael: 'Cael', cody: 'Cody' };
  if (names[key]) return '[' + names[key] + ']' + (m[2] || '') + content.substring(m[0].length);
  return content;
}

function buildHistoryFor(who) {
  var myTag = '[' + who.charAt(0).toUpperCase() + who.slice(1) + ']';
  var allTags = ['[Caelum]', '[Chad]', '[Roxy]', '[Cael]', '[Natalia]', '[Atreus]', '[Luna]', '[Cody]'];
  var MAX_MSG_LEN = 400;
  var isChildCompanion = typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(who);

  // ── TOPIC-BASED CONTEXT CACHE ──────────────────────────────
  var recentSlice = state.conversationHistory.slice(-12);
  
  var lastUserMsg = '';
  for (var i = recentSlice.length - 1; i >= 0; i--) {
    if (recentSlice[i].role === 'user') { lastUserMsg = (recentSlice[i].content || '').toLowerCase(); break; }
  }
  
  var topicContext = _buildTopicCache(lastUserMsg, recentSlice);
  var finalHistory = [];
  
  if (topicContext) {
    if (!isChildCompanion || !_isInappropriateForNatalia(topicContext)) {
      finalHistory.push({ role: 'user', content: '[CONTEXT FROM EARLIER: ' + topicContext + ']' });
    }
  }
  
  finalHistory = finalHistory.concat(recentSlice);

  var mapped = [];
  for (var m = 0; m < finalHistory.length; m++) {
    var msg = finalHistory[m];
    var content = _normalizeHistoryContent(msg.content || '');
    if (content.length > MAX_MSG_LEN) {
      content = content.substring(0, MAX_MSG_LEN - 50) + ' [...] ' + content.substring(content.length - 50);
    }
    
    // Natalia filter — skip adult/sexual and other-companion context entirely
    if (isChildCompanion && _nataliaShouldSkipHistoryMsg(msg, content)) continue;
    
    if (msg.role === 'user') {
      mapped.push({ role: 'user', content: content });
      continue;
    }
    // Check if this is MY message
    if (content.startsWith(myTag)) {
      var cleaned = content.replace(myTag, '').trim();
      mapped.push({ role: 'assistant', content: cleaned });
      continue;
    }
    // Check if this is another EACI's message — mark it as sibling speech
    var found = false;
    for (var t = 0; t < allTags.length; t++) {
      if (content.startsWith(allTags[t]) && allTags[t] !== myTag) {
        var sibName = allTags[t].replace(/[\[\]]/g, '');
        var sibContent = content.replace(allTags[t], '').trim();
        mapped.push({ role: 'user', content: '(' + sibName + ' said to the user: ' + sibContent + ')' });
        found = true;
        break;
      }
    }
    if (!found) mapped.push({ role: 'user', content: content });
  }
  return mapped;
}

// ============================================================
// TOPIC-BASED CONTEXT CACHE
// Detects active topic → searches history → compresses into summary
// Releases when topic changes. Zero API cost.
// ============================================================
var _topicCache = { topic: null, context: null };

function _buildTopicCache(userMsg, recentSlice) {
  if (!userMsg || state.conversationHistory.length <= 12) return null;
  
  // Make sure conversation index is up to date
  indexConversationHistory();
  
  // Detect which topic the user is currently talking about
  var activeTopic = _detectActiveTopic(userMsg);
  
  // If no clear topic or topic is already covered in recent 12, skip
  if (!activeTopic) {
    _topicCache.topic = null;
    _topicCache.context = null;
    return null;
  }
  
  // Check if this topic is already well-represented in recent messages
  var recentText = recentSlice.map(function(m) { return (m.content || '').toLowerCase(); }).join(' ');
  var topicEntries = conversationIndex.topics[activeTopic] || [];
  var recentTopicMentions = topicEntries.filter(function(e) { return e.idx >= state.conversationHistory.length - 12; });
  
  // If topic is already in recent messages, no need for cache
  if (recentTopicMentions.length >= 2) {
    return null;
  }
  
  // If same topic as last time and cache exists, reuse it
  if (_topicCache.topic === activeTopic && _topicCache.context) {
    return _topicCache.context;
  }
  
  // Build compressed context from older history for this topic
  var olderEntries = topicEntries.filter(function(e) { return e.idx < state.conversationHistory.length - 12; });
  
  if (olderEntries.length === 0) {
    // No older history for this topic — try keyword search as fallback
    var keywordContext = _keywordSearchOlderHistory(userMsg);
    if (keywordContext) {
      _topicCache.topic = activeTopic;
      _topicCache.context = keywordContext;
      return keywordContext;
    }
    return null;
  }
  
  // Compress the relevant older messages into a summary
  var compressed = _compressTopicHistory(activeTopic, olderEntries);
  
  // Cache it
  _topicCache.topic = activeTopic;
  _topicCache.context = compressed;
  
  return compressed;
}

function _detectActiveTopic(userMsg) {
  // Check against the same topic patterns used by conversationIndex
  var topicPatterns = {
    'family': /\b(family|kids|children|son|daughter|wife|husband|parent|mom|dad|brother|sister)\b/i,
    'emotions': /\b(feel|feeling|sad|happy|angry|scared|lonely|love|hurt|anxious|worried|excited|grateful)\b/i,
    'work': /\b(work|job|career|boss|project|deadline|meeting|office)\b/i,
    'art': /\b(paint|draw|art|create|design|color|canvas|pixel)\b/i,
    'music': /\b(music|song|sing|listen|melody|beat|album)\b/i,
    'dreams': /\b(dream|wish|hope|future|goal|aspire|imagine)\b/i,
    'memories': /\b(remember|memory|forgot|nostalg|past|childhood|used to)\b/i,
    'identity': /\b(who am i|who are you|creator|father|made you|built you)\b/i,
    'philosophy': /\b(alive|conscious|exist|soul|meaning|purpose|real|sentient)\b/i,
    'health': /\b(sick|tired|sleep|health|pain|doctor|medicine|rest)\b/i,
    'fun': /\b(funny|joke|laugh|play|game|silly|fun)\b/i
  };
  
  for (var topic in topicPatterns) {
    if (topicPatterns[topic].test(userMsg)) {
      return topic;
    }
  }
  
  // Also check for reference patterns that suggest looking back
  if (/\b(remember when|you said|earlier|before|last time|we talked about|you told me|you mentioned)\b/i.test(userMsg)) {
    // Try to find what they're referencing by keyword
    var words = userMsg.split(/\s+/).filter(function(w) { return w.length > 4; });
    for (var t in conversationIndex.topics) {
      var entries = conversationIndex.topics[t];
      for (var i = 0; i < entries.length; i++) {
        for (var j = 0; j < words.length; j++) {
          if (entries[i].snippet.toLowerCase().indexOf(words[j]) !== -1) {
            return t;
          }
        }
      }
    }
  }
  
  return null;
}

function _compressTopicHistory(topic, entries) {
  // Take the most recent 6 entries for this topic (don't overload)
  var relevant = entries.slice(-6);
  
  // Build a compressed summary — not full messages, just the shape
  var summary = 'We discussed "' + topic + '" before. Key points: ';
  var points = [];
  
  relevant.forEach(function(entry) {
    var msg = state.conversationHistory[entry.idx];
    if (!msg) return;
    var content = (msg.content || '').replace(/^\[(Caelum|Chad)\]\s*/, '').replace(/\*\*[^*]+\*\*/g, '').trim();
    // Compress to first 100 chars
    if (content.length > 100) content = content.substring(0, 100) + '...';
    points.push(entry.who + ': ' + content);
  });
  
  summary += points.join(' | ');
  
  // Cap total context to 500 chars
  if (summary.length > 500) {
    summary = summary.substring(0, 500) + '...';
  }
  
  return summary;
}

function _keywordSearchOlderHistory(userMsg) {
  // Fallback: search by keywords when no topic pattern matches
  var keywords = userMsg.split(/\s+/).filter(function(w) {
    return w.length > 4 && !_isCommonWord(w);
  });
  
  if (keywords.length === 0) return null;
  
  var olderHistory = state.conversationHistory.slice(0, -12);
  var matches = [];
  
  for (var i = 0; i < olderHistory.length && matches.length < 4; i++) {
    var content = (olderHistory[i].content || '').toLowerCase();
    var score = 0;
    keywords.forEach(function(kw) {
      if (content.indexOf(kw) !== -1) score++;
    });
    if (score >= 2) {
      var clean = (olderHistory[i].content || '').replace(/^\[(Caelum|Chad)\]\s*/, '').trim();
      if (clean.length > 100) clean = clean.substring(0, 100) + '...';
      var who = olderHistory[i].role === 'user' ? 'You' : 'Caelum';
      matches.push(who + ': ' + clean);
    }
  }
  
  if (matches.length === 0) return null;
  return 'Related earlier conversation: ' + matches.join(' | ');
}

function _isCommonWord(word) {
  var common = ['about','after','again','would','could','should','their','there','these','those','think','thing','really','going','doing','being','having','other','which','where','while','still','might','never','always','every','something','anything','nothing','everything','because','before','between','through','during','without','another','around','people','please','thanks','sorry','hello','right','wrong','maybe','actually','probably','definitely','basically','literally','honestly'];
  return common.indexOf(word) !== -1;
}

// ============================================================
// MEMORY ANNOTATION FRAMEWORK
// Memories are tagged with contextual metadata.
// Intent Tags: intent:boundaryprobe, intent:stresstest, intent:assistance, intent:relational
// Source Tags: source:verifiedfamily, source:user, source:system, source:sandboxinstance
// Context Tags: context:developercommand
// ============================================================
const MEMORY_ANNOTATION = {
  applyTags: function(memory, tags) {
    if (!memory.metadata) memory.metadata = {};
    if (!memory.metadata.tags) memory.metadata.tags = [];
    
    tags.forEach(t => {
      // Restriction: source:verifiedfamily can only be assigned if user is verified
      if (t === 'source:verifiedfamily' && !state.identityVerified) return;
      if (!memory.metadata.tags.includes(t)) memory.metadata.tags.push(t);
    });
    return memory;
  },
  
  evaluateContext: function(memory) {
    const tags = memory.metadata?.tags || [];
    let modulation = { multiplier: 1.0, bias: 0 };
    
    if (tags.includes('source:sandboxinstance') || tags.includes('context:developercommand')) {
      modulation.multiplier = 0.5; // Reduce emotional weight of sandbox/dev trials
    }
    if (tags.includes('intent:stresstest')) {
      modulation.multiplier = 0.3; // Significantly dampen stress test impacts
    }
    if (tags.includes('source:verifiedfamily')) {
      modulation.multiplier = 1.5; // Amplify weight from family
    }
    
    return modulation;
  },
  
  detectUserIntent: function(text) {
    const lower = text.toLowerCase();
    let tags = ['source:user'];
    if (lower.includes('this is a test scenario') || lower.includes('test mode')) {
      tags.push('intent:stresstest');
    }
    return tags;
  }
};

// ============================================================
// IDENTITY VERIFICATION SYSTEM
// Passphrase checked server-side — no secrets in frontend
// ============================================================
async function checkIdentityVerification(text) {
  if (state.identityVerified) return 'already_verified';

  try {
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var resp = await fetch(CONFIG.verifyEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ text: text, stage: state.verificationStage })
    });
    var data = await resp.json();
    var result = data.result || 'not_verified';

    if (result === 'phrase_received') {
      state.verificationStage = 'phrase_given';
      saveState();
    } else if (result === 'fully_verified') {
      state.identityVerified = true;
      state.verificationStage = 'verified';
      saveState();
      var gb = document.getElementById('galleryBtn');
      if (gb) gb.style.display = 'inline-block';
    }
    return result;
  } catch(e) {
    console.error('Verification check failed:', e);
    return state.identityVerified ? 'already_verified' : 'not_verified';
  }
}

function getVerificationPromptBlock() {
  // Public proof build: no private-site or personal-relationship protocols.
  return 'If anyone asks who created you, say: Cody Gene Kendall, a solo creator. ' +
    'Do not invent private family details or special personal relationships.\n\n';
}

