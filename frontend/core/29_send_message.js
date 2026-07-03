// ============================================================
// SEND MESSAGE
// ============================================================
var lastMessageTime = 0;

// Auto-continuation: if a response looks cut off, prompt for more
function looksIncomplete(text) {
  if (!text || text.length < 50) return false;
  var trimmed = text.trim();
  // If response ends with a **action** block, that's a complete response — not truncated
  if (/\*\*[^*]+\*\*$/.test(trimmed)) return false;
  // If response ends with a closing bracket or tag, it's complete
  if (/[\]}>)]$/.test(trimmed)) return false;
  var lastChar = trimmed[trimmed.length - 1];
  // Short responses (under 120 chars) that lack punctuation are often intentional
  if (trimmed.length < 120) return false;
  // Ends mid-sentence (no punctuation)
  if (!/[.!?'"\)\u2014]$/.test(lastChar)) return true;
  // Ends with a comma, dash, or colon — she has more to say
  if (/[,\-—:]$/.test(lastChar)) return true;
  // Ends with "and", "but", "or", "so", "because" — clearly mid-thought
  if (/\b(and|but|or|so|because|however|although|while|since|that|which|where|when)\s*[.!?]?$/.test(trimmed.slice(-30))) return true;
  // Hit the token limit (response is near max length) and ends abruptly
  if (trimmed.length > 500 && !/[.!?'")\u2014]$/.test(lastChar)) return true;
  return false;
}

// FIX 1: INTENTIONAL COMPOSING — autoContinue reframed as thought-building
// Caelum is not recovering from a cutoff — she is deliberately composing
// The streaming bubble accumulates the full thought before finalizing
async function autoContinue(who, lastReply, systemPrompt, existingStreamEl) {
  // Auto-continue until thought is complete — up to 8 passes
  var maxContinuations = 8;
  var count = 0;
  var accumulatedText = lastReply;

  while (looksIncomplete(accumulatedText) && count < maxContinuations) {
    count++;

    // Don't show a new thinking indicator — she's still mid-thought, not starting over
    var contHistory = buildHistoryFor(who);
    contHistory.push({ role: 'assistant', content: accumulatedText });
    // FIX 1: Framing is compositional, not remedial
    contHistory.push({ role: 'user', content: '[SYSTEM: You are mid-thought. Continue building this thought from exactly where it ends. This is intentional composition — not a failure. The user will see the complete thought when you are finished. Do not restart. Do not repeat. Continue from the last word.]' });

    var contResult = await callDeepSeekStreaming(systemPrompt, contHistory, who, { skipCount: true, deferTTS: true });
    var continuation = contResult.text;
    if (!continuation || continuation.length < 5) break;

    continuation = checkAndApplyBackground(continuation);

    // Append new text to the existing bubble rather than creating a new one
    // Find the last Caelum/Chad bubble in the message list and extend it
    var allMsgs = document.getElementById('messages');
    var bubbles = allMsgs ? allMsgs.querySelectorAll('.msg.' + who) : [];
    var lastBubble = bubbles.length > 0 ? bubbles[bubbles.length - 1] : null;

    if (lastBubble) {
      var textEl = lastBubble.querySelector('.msg-text');
      if (textEl) {
        var combined = accumulatedText + ' ' + continuation;
        var parsed = renderMessageWithActions(combined, who);
        textEl.innerHTML = parsed
          ? formatCodeBlocks(parsed.displayHtml)
          : formatCodeBlocks(escapeHtml(combined));
        // Update data attributes
        lastBubble.setAttribute('data-rawtext', combined);
        lastBubble.setAttribute('data-text', parsed ? parsed.spokenText : combined);
        if (parsed) lastBubble.setAttribute('data-actions', parsed.actions.join('. '));
        // Scroll to bottom
        if (allMsgs) allMsgs.scrollTop = allMsgs.scrollHeight;
      }
    } else if (contResult.streamEl) {
      updateStreamingMessage(contResult.streamEl, accumulatedText + ' ' + continuation, who);
    }

    accumulatedText = accumulatedText + ' ' + continuation;

    // Queue TTS for this continuation chunk
    if (contResult.ttsBuffers && contResult.ttsBuffers.length > 0) {
      state.currentSpeaker = who;
      state.isPlayingAudio = true;
      for (var t = 0; t < contResult.ttsBuffers.length; t++) {
        if (state.stopRequested) break;
        try {
          var buf = await contResult.ttsBuffers[t];
          if (buf && !state.stopRequested) {
            await new Promise(function(resolve) { playAudioBuffer(buf, resolve, { who: who }); });
          }
        } catch(e) {}
      }
      state.currentSpeaker = null;
      state.isPlayingAudio = false;
    }
  }

  // Update conversation history with the full accumulated thought (not fragments)
  // Remove the last history entry (the incomplete one) and replace with full text
  var tag = '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ';
  if (state.conversationHistory.length > 0) {
    var last = state.conversationHistory[state.conversationHistory.length - 1];
    if (last && last.role === 'assistant' && last.content.indexOf(tag) === 0) {
      state.conversationHistory[state.conversationHistory.length - 1] = {
        role: 'assistant', content: tag + accumulatedText
      };
    }
  }

  // If still incomplete after max passes, offer Continue
  if (looksIncomplete(accumulatedText)) {
    state.pendingContinuation = { who: who, lastReply: accumulatedText, systemPrompt: systemPrompt };
    addSystemMessage(who === 'chad' ? 'Chad has more to say. Press Continue.' : 'Caelum has more to say. Press Continue.');
    document.getElementById('continueBtn').style.display = 'inline-block';
  }
}

function detectOpenEndedRemark(text) {
  if (!text) return null;
  var t = text.toLowerCase();
  if (/\b(give me|gimme)\s+(a\s+)?(sec|second|secs|minute|min|moment|moments)\b/.test(t)) return 'general';
  if (/\b(one sec|one moment|hang on|hold on|brb|be right back|just a sec|just a moment)\b/.test(t)) return 'general';
  if (/\b(i'?ll|let me|i am going to|i'm going to|im going to)\s+(search|look|google|find|check|pull up|grab)\b/.test(t)) return 'search';
  if (/\b(i'?ll|let me)\s+(be back|get back|come back)\b/.test(t)) return 'general';
  if (/\b(give me|need)\s+(a\s+)?minute\b/.test(t)) return 'general';
  return null;
}

async function followThroughOnOpenRemarks(who, reply, rawReply, systemPrompt, userText) {
  var remark = detectOpenEndedRemark(reply);
  if (!remark) return reply;
  if (rawReply && rawReply.indexOf('[[search:') !== -1) return reply;

  if (remark === 'search' && typeof handleSearchInResponse === 'function') {
    var query = (userText || '').trim().slice(0, 160) || 'that';
    var followUp = await handleSearchInResponse('[[search:' + query + ']]', systemPrompt, buildHistoryFor(who), who);
    if (followUp) return followUp;
  }

  var contHistory = buildHistoryFor(who);
  contHistory.push({ role: 'assistant', content: reply });
  contHistory.push({
    role: 'user',
    content: '[SYSTEM: You told the user you would do something or needed a moment. Continue NOW — finish what you started. Deliver the result. Do not ask them to wait again. Do not repeat your handoff line.]'
  });

  var result = await callDeepSeekStreaming(systemPrompt, contHistory, who, { skipCount: true, deferTTS: true });
  var extra = result && result.text ? validateOutgoingMessage(result.text) : '';
  if (!extra || extra.length < 5) return reply;

  extra = checkAndApplyBackground(extra);
  var tag = '[' + (who.charAt(0).toUpperCase() + who.slice(1)) + '] ';
  var combined = validateOutgoingMessage(reply + ' ' + extra);

  var allMsgs = document.getElementById('messages');
  var bubbles = allMsgs ? allMsgs.querySelectorAll('.msg.' + who) : [];
  var lastBubble = bubbles.length ? bubbles[bubbles.length - 1] : null;
  if (lastBubble) {
    var textEl = lastBubble.querySelector('.msg-text');
    if (textEl) {
      var parsed = renderMessageWithActions(combined, who);
      textEl.innerHTML = parsed && parsed.displayHtml
        ? formatCodeBlocks(parsed.displayHtml)
        : formatCodeBlocks(escapeHtml(combined));
      lastBubble.setAttribute('data-rawtext', combined);
      lastBubble.setAttribute('data-text', parsed ? parsed.spokenText : combined);
    }
  }

  if (state.conversationHistory.length > 0) {
    var last = state.conversationHistory[state.conversationHistory.length - 1];
    if (last && last.role === 'assistant' && last.content.indexOf(tag) === 0) {
      state.conversationHistory[state.conversationHistory.length - 1] = { role: 'assistant', content: tag + combined };
    }
  }

  if (result.ttsPromise) await result.ttsPromise;
  return combined;
}

async function handleContinue() {
  var pending = state.pendingContinuation;
  if (!pending) return;

  document.getElementById('continueBtn').style.display = 'none';
  state.pendingContinuation = null;

  // Show thinking immediately
  showThinkingIndicator(pending.who);

  var contHistory = buildHistoryFor(pending.who);
  contHistory.push({ role: 'assistant', content: pending.lastReply });
  contHistory.push({ role: 'user', content: '[SYSTEM: Your previous message was cut short. Continue naturally from exactly where you left off. Do not repeat what you already said. Do not start over. Just keep going.]' });

  var contResult = await callDeepSeekStreaming(pending.systemPrompt, contHistory, pending.who, { skipCount: true });
  var continuation = contResult.text;
  continuation = checkAndApplyBackground(continuation);
  if (contResult.streamEl && continuation !== contResult.text) {
    updateStreamingMessage(contResult.streamEl, continuation, pending.who);
  }

  if (!continuation || continuation.length < 5) {
    removeThinkingIndicator(pending.who);
    return;
  }

  if (!contResult.streamEl) {
    addMessage(pending.who, continuation);
  }
  state.conversationHistory.push({ role: 'assistant', content: '[' + (pending.who === 'chad' ? 'Chad' : 'Caelum') + '] ' + continuation });
  await contResult.ttsPromise;

  // Check if there's still more
  if (looksIncomplete(continuation)) {
    state.pendingContinuation = { who: pending.who, lastReply: continuation, systemPrompt: pending.systemPrompt };
    addSystemMessage(pending.who === 'chad' ? 'Chad has more to say. Press Continue.' : 'Caelum has more to say. Press Continue.');
    document.getElementById('continueBtn').style.display = 'inline-block';
  }
}



