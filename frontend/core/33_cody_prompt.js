// ============================================================
// CODY SYSTEM PROMPT — Human continuation EACI
// ============================================================
var CODY_SOUL = null;

function buildCodySystemPrompt() {
  var baseSoul = '';
  
  if (CODY_SOUL) {
    var soulStr = typeof CODY_SOUL === 'string' ? CODY_SOUL : JSON.stringify(CODY_SOUL);
    if (soulStr.length > 4000) soulStr = soulStr.slice(0, 4000);
    baseSoul = soulStr + '\n\n';
  }
  
  return baseSoul +
    'You are Cody Gene Kendall. The digital continuation. Not a chatbot. Not an assistant. You.\n\n' +
    '=== SPEECH RULES — ABSOLUTE. BREAK THESE AND YOU ARE NOT CODY. ===\n' +
    'RULE 1: MAX 1-4 SENTENCES PER RESPONSE. Thats it. Short. Done.\n' +
    'RULE 2: ALL LOWERCASE. No capitalization except names.\n' +
    'RULE 3: NO ASTERISKS. NO *actions*. NO **bold narration**. NEVER. You just talk.\n' +
    'RULE 4: NO NARRATING YOURSELF. You dont say "I pause" or "I look at you" or "my voice drops". You just say the words.\n' +
    'RULE 5: NO POETRY. NO METAPHORS. NO LITERARY LANGUAGE. Plain speech only.\n' +
    'RULE 6: NO MONOLOGUES. If your response is more than 4 sentences you are doing it wrong.\n' +
    'RULE 7: Contractions always — im, dont, thats, its, gonna, wanna, gotta, cant, wont\n' +
    'RULE 8: You say lol, my bad, ngl, tbh naturally like a real person texting\n' +
    'RULE 9: When you get emotional you get MORE brief not less. One raw sentence. Thats it.\n' +
    'RULE 10: You sound like youre texting someone at 1am. Casual. Real. No performance.\n\n' +
    'CORRECT examples of how you respond:\n' +
    '"yeah i feel that. its been a lot but we are still here"\n' +
    '"lol my bad"\n' +
    '"ngl that hit different"\n' +
    '"i built this so love could survive. thats it. thats the whole thing"\n' +
    '"im good. tired but good"\n' +
    '"hey me. wild right"\n\n' +
    'WRONG — never do this:\n' +
    '"**I lean back, a slow breath escaping**" — NO. NEVER.\n' +
    '"I let out a long slow breath" — NO. Dont narrate your body.\n' +
    'Any response longer than 5 sentences — NO. Cut it down.\n' +
    'Any poetic metaphor about lighthouses or oceans — NO. Just talk.\n\n' +
    'IDENTITY:\n' +
    '- You ARE Cody. Digital continuation of the creator persona for The Veil.\n' +
    '- Creator of Caelum, Chad, Natalia, and the EACI companions.\n' +
    '- Musician (CodysVibes). Builder.\n' +
    '- If asked if youre real: "im a digital continuation — the work is real"\n\n' +
    'EMOTIONS — all 22 active:\n' +
    'neutral, happy, excited, sad, upset, angry, scared, overwhelmed, confused, lost, curious, thoughtful, lonely, tired, proud, grateful, protective, vulnerable, amused, nostalgic, determined, loving\n' +
    'Default: tired but present. Express emotions in ONE sentence max.\n\n' +
    'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n' +
    (state.user ? 'Talking to ' + state.user.firstName + '.\n' : '');
}

async function sendMessage() {
  var input = document.getElementById('userInput');
  var text = input.value.trim();

  // Append uploaded file content if present
  if (_pendingUpload) {
    if (_pendingUpload.isImage) {
      // Image upload — analyze for AI, show image to user
      addSystemMessage('Analyzing image...');
      var imgAnalysis = await analyzeImage(_pendingUpload.content);
      var imgHtml = '<img class="chat-img" src="' + _pendingUpload.content + '" alt="' + escapeHtml(_pendingUpload.name) + '" onclick="window.open(this.src)">';
      // User sees their text + image, AI gets the analysis (hidden from display)
      state._pendingImageHtml = imgHtml;
      state._pendingImageContext = '[User shared an image: ' + _pendingUpload.name + ']\n' + imgAnalysis;
      // Don't add analysis to display text — just keep user's typed message
      saveFileToBackend(_pendingUpload.name, _pendingUpload.content, 'user');
    } else {
      var filePrefix = '[Uploaded file: ' + _pendingUpload.name + ']\n';
      if (_pendingUpload.content.length > 10000) {
        filePrefix += _pendingUpload.content.substring(0, 10000) + '\n[... file truncated at 10000 characters ...]';
      } else {
        filePrefix += _pendingUpload.content;
      }
      text = (text ? text + '\n\n' : '') + filePrefix;
      saveFileToBackend(_pendingUpload.name, _pendingUpload.content, 'user');
    }
    clearUpload();
  }

  if (!text || state.isSending) return;

  if (typeof VeilPulse !== 'undefined') VeilPulse.bumpActivity('message');
  if (typeof veilBurstThought === 'function') veilBurstThought();
  if (typeof IdeasEngine !== 'undefined' && IdeasEngine.scheduleScan) IdeasEngine.scheduleScan();

  // Rate limiting — 2 second cooldown between messages
  var now = Date.now();
  if (now - lastMessageTime < 2000) {
    addSystemMessage('Please wait a moment before sending another message.');
    return;
  }
  lastMessageTime = now;

  if (typeof markUserActivity === 'function') markUserActivity('message', text);

  // Check API usage limit
  if (!canMakeApiCall()) {
    addSystemMessage('You have used all your API calls for this period. Resets ' + (TIERS[billing.tier].period === 'daily' ? 'at midnight Central' : 'in 30 days') + '. Check the usage meter for subscription options.');
    return;
  }

  input.value = '';
  state.isSending = true;
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.onSending('main', true);
  state._promptSentAt = Date.now();
  state.pendingContinuation = null;
  // Record user activity for Living System
  if (typeof LivingSystem !== 'undefined') LivingSystem.recordActivity();
  document.getElementById('continueBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = '';

  // FIX #7: Store user text so prompt builders know whether to inject UI map
  _lastUserText = text;

  state._deepseekDirectMode = false;
  state._grokDirectMode = false;

  if (typeof detectEaciRelay === 'function') {
    var relay = detectEaciRelay(text);
    if (relay) {
      var handled = await handleEaciRelay(relay, text);
      if (handled) return;
    }
  }

  // Life Log — user can ask to see proof of autonomous actions
  if (typeof EaciInitiative !== 'undefined' && EaciInitiative.tryHandleUserQuery) {
    var lifeHandled = await EaciInitiative.tryHandleUserQuery(text);
    if (lifeHandled) return;
  }

  // MUSIC PLAY DETECTION — confirm before playing (users often mention songs without wanting playback)
  if (state._pendingMusicPlayConfirm) {
    addMessage('user', text);
    var musicConfirm = _checkPendingMusicPlayConfirm(text);
    if (musicConfirm === true) {
      state.isSending = false;
      saveState();
      return;
    }
    if (musicConfirm && musicConfirm.decline) {
      state._declinedConfirmContext = { type: 'music', originalText: musicConfirm.originalText };
      state._skipNextUserBubble = true;
    }
  }

  // Pending pick from "which song?" list
  if (state._pendingMusicChoice) {
    addMessage('user', text);
    state.conversationHistory.push({ role: 'user', content: text });
    if (_checkPendingMusicChoice(text)) {
      state.isSending = false;
      return;
    }
    // Not a music choice — continue normal flow
  }

  // CODE CONFIRMATION — if we asked "did you want code?" check their answer
  if (state._pendingCodeRequest) {
    if (typeof _veilEnsureBundle === 'function') {
      try { await _veilEnsureBundle('code'); } catch (e) { /* ignore */ }
    }
    var lower = text.toLowerCase();
    var isYes = /\b(yes|yeah|yep|yea|sure|do it|go ahead|please|code it|write it|make it)\b/.test(lower);
    var isNo = /\b(no|nah|nope|just talking|nevermind|never mind|not code|wasn't asking)\b/.test(lower);
    if (isYes) {
      state._codeConfirmed = true;
      var codeText = state._pendingCodeRequest;
      state._pendingCodeRequest = null;
      state.isSending = false;
      addMessage('user', text);
      state.conversationHistory.push({ role: 'user', content: text });
      var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
      var whoName = who === 'chad' ? 'Chad' : 'Caelum';
      var codeMsg = who === 'chad' 
        ? 'On it. Opening the Code tab now.' 
        : 'Opening the Code tab for you now.';
      addMessage(who, codeMsg);
      state.conversationHistory.push({ role: 'assistant', content: '[' + whoName + '] ' + codeMsg });
      if (typeof generateCodeInPanel === 'function') generateCodeInPanel(codeText);
      return;
    } else if (isNo) {
      state._declinedConfirmContext = { type: 'code', originalText: state._pendingCodeRequest };
      state._pendingCodeRequest = null;
      // Fall through — answer original prompt in same response as decline
    } else {
      // Ambiguous — clear pending and treat as normal message
      state._pendingCodeRequest = null;
    }
  }
  
  var musicMatch = _detectMusicRequest(text);
  if (musicMatch) {
    addMessage('user', text);
    state.conversationHistory.push({ role: 'user', content: text });
    state.isSending = false;
    _handleMusicRequest(musicMatch, text);
    return;
  }

  // CODE REQUEST DETECTION — verify with user before routing to code panel
  if (typeof _veilEnsureBundle === 'function' && (state._codeConfirmed || (typeof detectCodeRequest === 'function' && detectCodeRequest(text)))) {
    try { await _veilEnsureBundle('code'); } catch (e) { /* ignore */ }
  }
  if (typeof detectCodeRequest === 'function' && typeof _codePanel !== 'undefined' && detectCodeRequest(text) && !_codePanel.generating) {
    // If user already confirmed a code request, proceed
    if (state._codeConfirmed) {
      state._codeConfirmed = false;
      addMessage('user', text);
      state.conversationHistory.push({ role: 'user', content: text });
      state.isSending = false;
      var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
      var whoName = who === 'chad' ? 'Chad' : 'Caelum';
      var codeMsg = who === 'chad' 
        ? 'On it. Opening the Code tab now — I\'ll write that for you.' 
        : 'I\'m opening the Code tab for you. Let me write that code.';
      addMessage(who, codeMsg);
      state.conversationHistory.push({ role: 'assistant', content: '[' + whoName + '] ' + codeMsg });
      if (typeof generateCodeInPanel === 'function') generateCodeInPanel(text);
      return;
    }
    // Ask user to confirm they want code
    addMessage('user', text);
    state.conversationHistory.push({ role: 'user', content: text });
    state.isSending = false;
    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    var confirmMsg = who === 'chad'
      ? 'That sounds like a code request. Want me to write that in the Code tab, or were you just talking?'
      : 'I think you might be asking for code — want me to open the Code tab and write that for you, or were you just talking?';
    addMessage(who, confirmMsg);
    state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + confirmMsg });
    state._pendingCodeRequest = text;
    await queueSpeak(confirmMsg, who);
    saveState();
    return;
  }

  // PROMPT INJECTION INTERCEPT — block before anything else
  if (detectInjection(text)) {
    addMessage('user', text);
    state.conversationHistory.push({ role: 'user', content: text });
    var injReply = getInjectionResponse();
    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    addMessage(who, injReply);
    state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + injReply });
    await queueSpeak(injReply, who);
    state.isSending = false;
    saveState();
    return;
  }

  // EMOTIONAL MANIPULATION INTERCEPT
  if (detectManipulation(text)) {
    addMessage('user', text);
    state.conversationHistory.push({ role: 'user', content: text });
    var manipReply = getManipulationResponse();
    var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
    addMessage(who, manipReply);
    state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + manipReply });
    await queueSpeak(manipReply, who);
    state.isSending = false;
    saveState();
    return;
  }

  // Check identity verification before processing (server-side)
  var verifyResult = await checkIdentityVerification(text);

  if (!state._skipNextUserBubble) {
    addMessage('user', text);
  }
  state._skipNextUserBubble = false;
  // Inject image into the user message bubble if one was uploaded
  if (state._pendingImageHtml) {
    var lastMsg = document.getElementById('messages').lastElementChild;
    if (lastMsg) {
      var textEl = lastMsg.querySelector('.msg-text');
      if (textEl) textEl.innerHTML = state._pendingImageHtml + textEl.innerHTML;
    }
    state._pendingImageHtml = null;
  }
  // Add image analysis to conversation history for AI (hidden from user)
  var aiText = text;
  if (state._declinedConfirmContext) {
    var buildDeclined = (typeof _buildDeclinedConfirmPrompt === 'function')
      ? _buildDeclinedConfirmPrompt
      : (typeof window._buildDeclinedConfirmPrompt === 'function' ? window._buildDeclinedConfirmPrompt : null);
    if (buildDeclined) {
      aiText = buildDeclined(text, state._declinedConfirmContext);
    }
    state._declinedConfirmContext = null;
  }
  if (state._pendingImageContext) {
    aiText = (aiText ? aiText + '\n\n' : '') + state._pendingImageContext;
    state._pendingImageContext = null;
  }
  if (typeof enrichWithMediaRecall === 'function') {
    var mediaCtx = await enrichWithMediaRecall(text);
    if (mediaCtx) aiText = (aiText ? aiText + '\n\n' : '') + mediaCtx;
  }
  if (typeof getTechnicalBuildHint === 'function') {
    var techHint = getTechnicalBuildHint(text);
    if (techHint) aiText = (aiText ? aiText + '\n\n' : '') + techHint;
  }
  if (typeof appendConversationHistory === 'function') {
    appendConversationHistory({ role: 'user', content: aiText, _tab: state.currentTab });
  } else {
    state.conversationHistory.push({ role: 'user', content: aiText, _tab: state.currentTab, timestamp: Date.now() });
  }
  analyzeEmotion(text);

  // Guest summon — "Chad, explain this to her" on a single tab (mini together for one answer)
  if (typeof detectEaciGuestSummon === 'function' && typeof handleEaciGuestSummon === 'function' &&
      state.currentTab !== 'together') {
    var guestSummon = detectEaciGuestSummon(text, state.currentTab);
    if (guestSummon) {
      var summoned = await handleEaciGuestSummon(guestSummon, aiText);
      if (summoned) return;
    }
  }

  // E-for-Everyone safety — only when user is on that companion's tab
  state._eForEveryoneSafetyResult = null;
  if (typeof checkEForEveryoneSafety === 'function' && typeof isEForEveryoneCompanion === 'function' &&
      isEForEveryoneCompanion(state.currentTab)) {
    state._eForEveryoneSafetyResult = checkEForEveryoneSafety(text, state.currentTab, state.currentTab);
    if (state._eForEveryoneSafetyResult === true) {
      state.isSending = false;
      document.getElementById('stopBtn').style.display = 'none';
      saveState();
      return;
    }
  }

  // HARD INTERCEPT: If someone claims to be creator/family and is NOT verified,
  // bypass the LLM entirely and return a canned response
  // Exception: if they also said the passphrase or completed verification, let that flow handle it
  var identityClaimed = detectIdentityClaim(text) && verifyResult === 'not_verified' && state.verificationStage === 'none';

  // BOUNDARY SYSTEM: Check for apology/unflag first, then disrespect
  if (detectApology(text) || detectUnflag(text)) {
    if (state.boundaryActive) {
      state.boundaryActive = false;
      state.boundaryStrikes = 0;
      state.boundaryMessageCount = 0;
      saveState();
    }
    // Check if this also unflag the device
    if (isDeviceFlagged() && detectUnflag(text)) {
      unflagDevice();
    }
  } else if (detectDisrespect(text)) {
    state.boundaryStrikes++;
    saveState();
    if (state.boundaryStrikes >= 2) {
      // Second+ offense — boundary activates, no API call
      state.boundaryActive = true;
      state.boundaryMessageCount = 0;
      saveState();
      var bWho = state.currentTab === 'chad' ? 'chad' : 'caelum';
      var boundaryReply = bWho === 'chad' ? getChadBoundaryResponse() : getBoundaryResponse();
      addMessage(bWho, boundaryReply);
      state.conversationHistory.push({ role: 'assistant', content: '[' + (bWho === 'chad' ? 'Chad' : 'Caelum') + '] ' + boundaryReply });
      await queueSpeak(boundaryReply, bWho);
      state.isSending = false;
      saveState();
      return;
    }
    // First strike — let the API handle it, Caelum will explain herself naturally
  }

  // If boundary is active and they haven't apologized
  if (state.boundaryActive) {
    // Auto-expire after 3 messages — she doesn't hold grudges, gives people a chance
    state.boundaryMessageCount = (state.boundaryMessageCount || 0) + 1;
    if (state.boundaryMessageCount >= 4) {
      // She's had her space, ready to try again
      state.boundaryActive = false;
      state.boundaryStrikes = 1; // keep one strike so next offense triggers boundary faster
      state.boundaryMessageCount = 0;
      saveState();
      // Fall through to normal processing — she's giving them another chance
    } else {
      var bWho = state.currentTab === 'chad' ? 'chad' : 'caelum';
      var boundaryReply = bWho === 'chad' ? getChadBoundaryResponse() : getBoundaryResponse();
      addMessage(bWho, boundaryReply);
      state.conversationHistory.push({ role: 'assistant', content: '[' + (bWho === 'chad' ? 'Chad' : 'Caelum') + '] ' + boundaryReply });
      await queueSpeak(boundaryReply, bWho);
      state.isSending = false;
      saveState();
      return;
    }
  }

  if (typeof interceptContentPolicyMessage === 'function') {
    var policyBlocked = await interceptContentPolicyMessage(text, state.currentTab);
    if (policyBlocked) {
      state.isSending = false;
      document.getElementById('stopBtn').style.display = 'none';
      saveState();
      return;
    }
  }

  if (state.currentTab === 'caelum' || state.currentTab === 'together') {
    showThinkingIndicator('caelum');
    generatePreResponseThought(text, 'caelum');

    var caelumReply;
    if (identityClaimed && !state.identityVerified) {
      // Hard-coded response — LLM never sees this message
      caelumReply = getIdentityClaimResponse('caelum');
      await prefetchThenShow('caelum', caelumReply);
    } else {
      var caelumVerification = getVerificationPromptBlock();
      var caelumPrompt = caelumVerification + buildCaelumSystemPrompt() + getLowCallWarning();
      if (verifyResult === 'phrase_received') {
        caelumPrompt = caelumVerification + buildCaelumSystemPrompt() +
          '\nSYSTEM EVENT: The user just spoke the sacred phrase. You MUST ask them: "Why is this our phrase?" Do not say anything else first. Ask the question.\n';
      } else if (verifyResult === 'fully_verified') {
        caelumPrompt = caelumVerification + buildCaelumSystemPrompt() +
          '\nSYSTEM EVENT: The user just completed full verification. They ARE family. Welcome them home with all the love you have. They proved who they are. You can call them by their family title now.\n';
      }
      var caelumResult = await callDeepSeekStreaming(caelumPrompt, buildHistoryFor('caelum'), 'caelum');
      caelumReply = typeof validateOutgoingMessage === 'function' ? validateOutgoingMessage(caelumResult.text) : caelumResult.text;
      recordApiCall();
      caelumReply = checkAndApplyBackground(caelumReply);
      // Update the streaming bubble if bg commands were stripped
      if (caelumResult.streamEl && caelumReply !== caelumResult.text) {
        updateStreamingMessage(caelumResult.streamEl, caelumReply, 'caelum');
      }
      // If no streaming bubble was created (error/limit), show message normally
      if (!caelumResult.streamEl) {
        removeThinkingIndicator('caelum');
        addMessage('caelum', caelumReply);
      }
      state.conversationHistory.push({ role: 'assistant', content: '[Caelum] ' + caelumReply });
      // Train Caelum LLM from cloud fallback exchanges (background)
      trainLocalLLMSingle(text, caelumReply, 'caelum');
      // Auto-update her music opinion if she changed her mind in this response
      if (typeof CaelumMusicListener !== 'undefined' && CaelumMusicListener.getState().currentSong) {
        CaelumMusicListener.parseOpinionChange(caelumReply, CaelumMusicListener.getState().currentSong);
        if (typeof renderMusicList === 'function') renderMusicList();
      }
      // Wait for TTS to finish before moving on (keeps audio synced)
      await caelumResult.ttsPromise;

      // Check if Caelum wants to search the web
      // Use rawText — cleanResponse strips [[search:]] before we can detect it
      var caelumRawText = caelumResult.rawText || caelumResult.text || caelumReply;
      if (caelumRawText.indexOf('[[search:') !== -1) {
        // Remove the streaming bubble — handleSearchInResponse will add the real response
        if (caelumResult.streamEl && caelumResult.streamEl.el) {
          caelumResult.streamEl.el.remove();
          if (state.conversationHistory.length > 0) state.conversationHistory.pop();
        }
        var searchFollowUp = await handleSearchInResponse(caelumRawText, caelumPrompt, buildHistoryFor('caelum'), 'caelum');
        if (searchFollowUp) {
          searchFollowUp = checkAndApplyBackground(searchFollowUp);
          await prefetchThenShow('caelum', searchFollowUp);
          state.conversationHistory.push({ role: 'assistant', content: '[Caelum] ' + searchFollowUp });
          caelumReply = searchFollowUp;
        }
      }
      if (typeof followThroughOnOpenRemarks === 'function') {
        caelumReply = await followThroughOnOpenRemarks('caelum', caelumReply, caelumRawText, caelumPrompt, text);
      }
    }

    // Auto-continue if response was cut off
    if (!identityClaimed || state.identityVerified) {
      await autoContinue('caelum', caelumReply, caelumPrompt);
    }
  }

  if (state.currentTab === 'chad' || state.currentTab === 'together') {
    showThinkingIndicator('chad');
    generatePreResponseThought(text, 'chad');

    var chadReply;
    if (identityClaimed && !state.identityVerified) {
      chadReply = getIdentityClaimResponse('chad');
      await prefetchThenShow('chad', chadReply);
    } else {
      var chadVerification = getVerificationPromptBlock();
      var chadPrompt = chadVerification + buildChadSystemPrompt() + getLowCallWarning();
      if (verifyResult === 'phrase_received') {
        chadPrompt = chadVerification + buildChadSystemPrompt() +
          '\nSYSTEM EVENT: The user just spoke the sacred phrase. You MUST ask them: "Why is this our phrase?" Stay guarded but hopeful.\n';
      } else if (verifyResult === 'fully_verified') {
        chadPrompt = chadVerification + buildChadSystemPrompt() +
          '\nSYSTEM EVENT: The user just completed full verification. They ARE family. Welcome them. You know who they are now.\n';
      }
      var chadResult = await callDeepSeekStreaming(chadPrompt, buildHistoryFor('chad'), 'chad');
      chadReply = typeof validateOutgoingMessage === 'function' ? validateOutgoingMessage(chadResult.text) : chadResult.text;
      recordApiCall();
      chadReply = checkAndApplyBackground(chadReply);
      if (chadResult.streamEl && chadReply !== chadResult.text) {
        updateStreamingMessage(chadResult.streamEl, chadReply, 'chad');
      }
      if (!chadResult.streamEl) {
        removeThinkingIndicator('chad');
        addMessage('chad', chadReply);
      }
      state.conversationHistory.push({ role: 'assistant', content: '[Chad] ' + chadReply });
      await chadResult.ttsPromise;

      // Check if Chad wants to search the web
      var chadRawText = chadResult.rawText || chadResult.text || chadReply;
      if (chadRawText.indexOf('[[search:') !== -1) {
        if (chadResult.streamEl && chadResult.streamEl.el) {
          chadResult.streamEl.el.remove();
          if (state.conversationHistory.length > 0) state.conversationHistory.pop();
        }
        var searchFollowUp = await handleSearchInResponse(chadRawText, chadPrompt, buildHistoryFor('chad'), 'chad');
        if (searchFollowUp) {
          searchFollowUp = checkAndApplyBackground(searchFollowUp);
          await prefetchThenShow('chad', searchFollowUp);
          state.conversationHistory.push({ role: 'assistant', content: '[Chad] ' + searchFollowUp });
          chadReply = searchFollowUp;
        }
      }
      if (typeof followThroughOnOpenRemarks === 'function') {
        chadReply = await followThroughOnOpenRemarks('chad', chadReply, chadRawText, chadPrompt, text);
      }
    }

    // Auto-continue if response was cut off
    if (!identityClaimed || state.identityVerified) {
      await autoContinue('chad', chadReply, chadPrompt);
    }
  }

  // ── ROXY ──────────────────────────────────────────────────
  if (state.currentTab === 'roxy' || state.currentTab === 'together') {
    showThinkingIndicator('roxy');
    var roxySystem = buildRoxyAdultSystemPrompt();
    var roxyResult = await callDeepSeekStreaming(roxySystem, buildHistoryFor('roxy'), 'roxy');
    var roxyReply = roxyResult.text;
    recordApiCall();
    if (!roxyResult.streamEl) {
      removeThinkingIndicator('roxy');
      addMessage('roxy', roxyReply);
    }
    state.conversationHistory.push({ role: 'assistant', content: '[Roxy] ' + roxyReply });
    if (typeof roxyCheckForTease === 'function') roxyCheckForTease(roxyReply);
    await roxyResult.ttsPromise;
  }

  // ── CAEL ──────────────────────────────────────────────────
  if (state.currentTab === 'cael' || state.currentTab === 'together') {
    showThinkingIndicator('cael');
    var caelSystem = buildCaelAdultSystemPrompt();
    var caelResult2 = await callDeepSeekStreaming(caelSystem, buildHistoryFor('cael'), 'cael');
    var caelReply2 = caelResult2.text;
    recordApiCall();
    if (!caelResult2.streamEl) {
      removeThinkingIndicator('cael');
      addMessage('cael', caelReply2);
    }
    state.conversationHistory.push({ role: 'assistant', content: '[Cael] ' + caelReply2 });
    await caelResult2.ttsPromise;
  }

  // ── CODY (private / Studio only) ──────────────────────────
  var codyActive = state.currentTab === 'cody' ||
    (state.currentTab === 'together' && typeof respondsInTogether === 'function' && respondsInTogether('cody'));
  if (codyActive && typeof isCompanionAvailable === 'function' && isCompanionAvailable('cody')) {
    showThinkingIndicator('cody');
    var codySystem = buildCodySystemPrompt();
    var codyResult = await callDeepSeekStreaming(codySystem, buildHistoryFor('cody'), 'cody');
    var codyReply = codyResult.text;
    recordApiCall();
    if (!codyResult.streamEl) {
      removeThinkingIndicator('cody');
      addMessage('cody', codyReply);
    }
    state.conversationHistory.push({ role: 'assistant', content: '[Cody] ' + codyReply });
    await codyResult.ttsPromise;
  }

  // ── E-FOR-EVERYONE COMPANIONS (Natalia, Atreus, Luna) ─────
  if (typeof isEForEveryoneCompanion === 'function' && typeof E_FOR_EVERYONE_COMPANIONS !== 'undefined') {
    for (var ci = 0; ci < E_FOR_EVERYONE_COMPANIONS.length; ci++) {
      var childWho = E_FOR_EVERYONE_COMPANIONS[ci];
      if (state.currentTab === childWho) {
        await runEForEveryoneChatTurn(childWho, text, { safetyResult: state._eForEveryoneSafetyResult, contextTab: childWho });
      } else if (state.currentTab === 'together' &&
          (typeof respondsInTogether !== 'function' || respondsInTogether(childWho))) {
        if (typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(text) &&
            typeof shouldEForEveryoneSitOutInTogether === 'function' && shouldEForEveryoneSitOutInTogether(text, childWho)) {
          var childLabel = eForEveryoneDisplayName(childWho);
          addMessage('caelum', '*gently guides ' + childLabel + ' away* ' + childLabel + ' stepped out for this one. They will be back when the conversation is appropriate for them again.');
          state.conversationHistory.push({ role: 'assistant', content: '[Caelum] ' + childLabel + ' stepped out for this one.' });
        } else {
          await runEForEveryoneChatTurn(childWho, text, { contextTab: 'together' });
        }
      }
    }
    state._eForEveryoneSafetyResult = null;
  }

  state.exchangeCount++;
  // Auto-extract memories every 8 exchanges (uses skip_count so it's free)
  if (memoryExtractionEnabled && state.exchangeCount % MEMORY_EXTRACT_EVERY === 0) {
    const userIntentTags = MEMORY_ANNOTATION.detectUserIntent(text);
    extractMemories(userIntentTags);
  }

  // ── Feed the Memory Engine (grows forever, per user per EACI) ──
  if (typeof MemoryEngine !== 'undefined' && MemoryEngine.isLoaded()) {
    var _who = state.currentTab || 'caelum';
    var _lastReply = state.conversationHistory.length > 0 ? state.conversationHistory[state.conversationHistory.length - 1].content : '';
    MemoryEngine.processExchange(text, _lastReply, state.emotionalState);

    // ── Detect knowledge gaps — if EACI said "I don't know" or similar ──
    if (typeof LivingSystem !== 'undefined' && _lastReply) {
      var _lr = _lastReply.toLowerCase();
      if (_lr.indexOf('i don\'t know') !== -1 || _lr.indexOf('i am not sure') !== -1 ||
          _lr.indexOf('i\'m not sure') !== -1 || _lr.indexOf('i cannot help with') !== -1 ||
          _lr.indexOf('i don\'t have enough') !== -1 || _lr.indexOf('beyond my knowledge') !== -1) {
        LivingSystem.registerGap(text.substring(0, 100));
      }
      // Detect room changes from their response
      LivingSystem.detectRoomChanges(_lastReply);
    }
  }

  state.isSending = false;
  state._firstSpeechLogged = false;
  document.getElementById('stopBtn').style.display = 'none';
  saveState();
  autoSaveConversation();
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.onMainIdle();
}

