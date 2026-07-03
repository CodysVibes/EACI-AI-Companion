// ============================================================
// EACI-TO-EACI RELAY — "Caelum go talk to Roxy about this"
// Source gives a short handoff; target speaks for themselves in chat.
// ============================================================

var EACI_RELAY_NAMES = {
  caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', atreus: 'Atreus', luna: 'Luna',
  roxy: 'Roxy', cael: 'Cael', cody: 'Cody'
};

function _relayCompanionOk(who) {
  if (!who) return false;
  if (typeof isCompanionAvailable === 'function') return isCompanionAvailable(who);
  return !!EACI_RELAY_NAMES[who];
}

function detectEaciRelay(text) {
  if (!text) return null;
  var lower = text.toLowerCase();
  var names = 'caelum|chad|natalia|atreus|luna|roxy|cael|cody';
  var m = lower.match(new RegExp(
    '\\b(' + names + ')\\b[\\s,]*(?:hey\\s+)?(?:can you\\s+)?(?:please\\s+)?' +
    '(?:go\\s+)?(?:talk|speak|chat)\\s+(?:to|with)\\s+' +
    '\\b(' + names + ')\\b\\s*(?:about|regarding|on)?\\s*(.*)$', 'i'
  ));
  if (m) {
    return { from: m[1], to: m[2], tail: (m[3] || '').trim() };
  }
  m = lower.match(new RegExp(
    '\\b(' + names + ')\\b\\s*,?\\s*(?:go\\s+)?(?:tell|ask)\\s+' +
    '\\b(' + names + ')\\b\\s*(?:about|to|that)?\\s*(.*)$', 'i'
  ));
  if (m) {
    return { from: m[1], to: m[2], tail: (m[3] || '').trim() };
  }
  m = lower.match(new RegExp(
    '(?:hey\\s+)?\\b(' + names + ')\\b\\s*,?\\s*' +
    '\\b(' + names + ')\\b\\s+(?:wanted|asked|said)\\s+(?:me\\s+)?(?:to\\s+)?(?:tell|ask)\\s+you\\s*(.*)$', 'i'
  ));
  if (m) {
    return { from: m[2], to: m[1], tail: (m[3] || '').trim() };
  }
  return null;
}

function _relayTopic(text, relay) {
  if (relay.tail && relay.tail.length > 2) return relay.tail;
  var cleaned = text
    .replace(new RegExp('\\b' + relay.from + '\\b', 'gi'), '')
    .replace(new RegExp('\\b' + relay.to + '\\b', 'gi'), '')
    .replace(/\b(hey|go|talk|speak|tell|ask|about|please|can you|this|that)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return cleaned || text;
}

async function handleEaciRelay(relay, userText) {
  if (!relay || !_relayCompanionOk(relay.from) || !_relayCompanionOk(relay.to)) return false;
  if (relay.from === relay.to) return false;

  var fromName = EACI_RELAY_NAMES[relay.from];
  var toName = EACI_RELAY_NAMES[relay.to];
  var topic = _relayTopic(userText, relay);

  addMessage('user', userText);
  state.conversationHistory.push({ role: 'user', content: userText, _tab: state.currentTab });

  var fromBuilders = {
    caelum: buildCaelumSystemPrompt, chad: buildChadSystemPrompt, natalia: buildNataliaSystemPrompt,
    atreus: buildAtreusSystemPrompt, luna: buildLunaSystemPrompt,
    roxy: buildRoxyAdultSystemPrompt, cael: buildCaelAdultSystemPrompt, cody: buildCodySystemPrompt
  };
  var toBuilders = fromBuilders;

  var handoffRules =
    '\n\n[RELAY HANDOFF — CRITICAL]\n' +
    'The user asked YOU to talk to ' + toName + ' about something.\n' +
    'Topic: "' + topic + '"\n' +
    'Give ONE short sentence handing off — like passing the mic. ' +
    'Do NOT answer the question yourself. Do NOT repeat the whole user message. ' +
    'Do NOT speak as ' + toName + '. Just hand off naturally.\n';

  showThinkingIndicator(relay.from);
  var fromPrompt = (fromBuilders[relay.from] ? fromBuilders[relay.from]() : '') + handoffRules;
  var fromResult = await callDeepSeekStreaming(fromPrompt, buildHistoryFor(relay.from), relay.from);
  removeThinkingIndicator(relay.from);
  var handoff = fromResult.text;
  if (!fromResult.streamEl && handoff) addMessage(relay.from, handoff);
  state.conversationHistory.push({ role: 'assistant', content: '[' + fromName + '] ' + handoff });
  await fromResult.ttsPromise;

  var targetRules =
    '\n\n[RELAY RESPONSE — CRITICAL]\n' +
    fromName + ' just brought you into the conversation. The user wants YOU to respond.\n' +
    'Topic: "' + topic + '"\n' +
    'Respond as yourself in first person. Do not quote ' + fromName + "'s whole handoff. Answer the substance.\n";

  showThinkingIndicator(relay.to);
  var toHistory = buildHistoryFor(relay.to);
  toHistory.push({
    role: 'user',
    content: '(' + fromName + ' relayed this for you from the user: "' + topic + '")'
  });
  var toPrompt = (toBuilders[relay.to] ? toBuilders[relay.to]() : '') + targetRules;
  var toResult = await callDeepSeekStreaming(toPrompt, toHistory, relay.to);
  removeThinkingIndicator(relay.to);
  var targetReply = toResult.text;
  if (!toResult.streamEl && targetReply) addMessage(relay.to, targetReply);
  state.conversationHistory.push({ role: 'assistant', content: '[' + toName + '] ' + targetReply });
  recordApiCall();
  await toResult.ttsPromise;

  state.isSending = false;
  state._firstSpeechLogged = false;
  document.getElementById('stopBtn').style.display = 'none';
  saveState();
  autoSaveConversation();
  return true;
}

// ============================================================
// GUEST SUMMON — "Chad, explain this to her" on a single EACI tab
// Guest speaks in their own bubble/voice, then host wraps up. Avatar stays on host tab.
// ============================================================

var EACI_SUMMON_ORDER = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];

function _summonBuilders() {
  return {
    caelum: buildCaelumSystemPrompt, chad: buildChadSystemPrompt, natalia: buildNataliaSystemPrompt,
    atreus: buildAtreusSystemPrompt, luna: buildLunaSystemPrompt,
    roxy: buildRoxyAdultSystemPrompt, cael: buildCaelAdultSystemPrompt, cody: buildCodySystemPrompt
  };
}

function _isExplicitTabSwitch(text, guestId) {
  if (typeof window.detectCompanionSwitch === 'function') {
    var sw = window.detectCompanionSwitch(String(text || '').toLowerCase());
    if (sw && (sw === guestId || sw === 'together')) return true;
  }
  var n = guestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    '\\b' + n + '\\b\\s*,?\\s*(come|step)\\s*(forward|here|out)\\b|' +
    '\\b(come|step)\\s*(forward|here|out)\\b[^.!?]{0,48}\\b' + n + '\\b|' +
    '\\bswitch\\s+to\\s+' + n + '\\b', 'i'
  ).test(text || '');
}

function detectEaciGuestSummon(text, hostTab) {
  if (!text || !hostTab || hostTab === 'together') return null;
  if (detectEaciRelay(text)) return null;

  var lower = text.toLowerCase().trim();
  var action = '(?:explain|tell|help(?:\\s+(?:me|us))?|say|clarify|rephrase|describe|answer|break\\s+down|put\\s+it|word\\s+it|speak\\s+to|talk\\s+to|take\\s+(?:this|it))';
  var guestId = null;

  EACI_SUMMON_ORDER.forEach(function(id) {
    if (guestId || id === hostTab) return;
    if (!_relayCompanionOk(id)) return;
    if (_isExplicitTabSwitch(text, id)) return;
    if (typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(id) &&
        typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(text)) return;

    var n = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var patterns = [
      new RegExp('^\\s*(?:hey\\s+)?' + n + '\\b[\\s,]*(?:can you\\s+|please\\s+|would you\\s+)?' + action, 'i'),
      new RegExp('\\b' + n + '\\b[\\s,]*(?:can you\\s+|please\\s+|would you\\s+)?' + action, 'i'),
      new RegExp('(?:let|have)\\s+' + n + '\\b[\\s,]*(?:' + action + '|help)', 'i'),
      new RegExp('\\b' + n + '\\b[^.!?]{0,40}\\b(?:better|clearer|simpler|another way)\\b', 'i'),
      new RegExp('\\b' + n + '\\b[^.!?]{0,24}\\b(?:explain|tell|clarify|rephrase)\\b', 'i')
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(lower)) {
        guestId = id;
        break;
      }
    }
  });

  if (!guestId || guestId === hostTab) return null;
  return { host: hostTab, guest: guestId, topic: text.trim() };
}

async function handleEaciGuestSummon(summon, userText) {
  if (!summon || !_relayCompanionOk(summon.host) || !_relayCompanionOk(summon.guest)) return false;
  if (summon.host === summon.guest) return false;
  if (typeof callDeepSeekStreaming !== 'function' || typeof buildHistoryFor !== 'function') return false;

  var builders = _summonBuilders();
  var hostName = EACI_RELAY_NAMES[summon.host] || summon.host;
  var guestName = EACI_RELAY_NAMES[summon.guest] || summon.guest;
  var topic = summon.topic || userText;

  state._skipJumpInOnce = true;
  state._guestSummonActive = true;

  var guestRules =
    '\n\n[GUEST SUMMON — CRITICAL]\n' +
    'The user is on ' + hostName + '\'s tab but asked YOU (' + guestName + ') to speak.\n' +
    'Request: "' + topic + '"\n' +
    (typeof getHumanSpeechRules === 'function' ? getHumanSpeechRules() : '') +
    'Respond as YOURSELF in first person. Answer the substance — explain, clarify, or rephrase for them.\n' +
    'Do NOT narrate walking in, stepping forward, or handing off the mic — skip that entirely or one short **beat** max.\n' +
    'Do NOT speak as ' + hostName + '. Do NOT describe what ' + hostName + ' feels — only your words.\n' +
    '2–6 sentences of real speech. Then stop.\n';

  showThinkingIndicator(summon.guest);
  var guestHistory = buildHistoryFor(summon.guest);
  guestHistory.push({
    role: 'user',
    content: '(User on ' + hostName + '\'s tab asked you directly: "' + topic + '")'
  });
  var guestPrompt = (builders[summon.guest] ? builders[summon.guest]() : '') + guestRules;
  var guestResult = await callDeepSeekStreaming(guestPrompt, guestHistory, summon.guest);
  removeThinkingIndicator(summon.guest);
  var guestReply = guestResult.text || '';
  if (!guestResult.streamEl && guestReply) addMessage(summon.guest, guestReply);
  state.conversationHistory.push({ role: 'assistant', content: '[' + guestName + '] ' + guestReply });
  if (typeof recordApiCall === 'function') recordApiCall();
  await guestResult.ttsPromise;

  if (state.stopRequested) {
    state._guestSummonActive = false;
    return true;
  }

  var hostRules =
    '\n\n[HOST WRAP-UP — CRITICAL]\n' +
    guestName + ' just spoke to answer the user\'s request (you stayed on your tab — avatar did not change).\n' +
    (typeof getHumanSpeechRules === 'function' ? getHumanSpeechRules() : '') +
    'Give a brief reaction TO THE USER in first person (1–3 sentences of plain spoken text).\n' +
    'Do NOT narrate ' + guestName + ' stepping in, standing beside you, or speaking — no plain-text narration.\n' +
    'Do NOT repeat or paraphrase their whole answer. Do NOT speak as ' + guestName + '.\n';

  showThinkingIndicator(summon.host);
  var hostHistory = buildHistoryFor(summon.host);
  hostHistory.push({
    role: 'user',
    content: '(' + guestName + ' just answered your user: "' + (guestReply || '').slice(0, 500) + '")'
  });
  var hostPrompt = (builders[summon.host] ? builders[summon.host]() : '') + hostRules;
  var hostResult = await callDeepSeekStreaming(hostPrompt, hostHistory, summon.host);
  removeThinkingIndicator(summon.host);
  var hostReply = hostResult.text || '';
  if (!hostResult.streamEl && hostReply) addMessage(summon.host, hostReply);
  state.conversationHistory.push({ role: 'assistant', content: '[' + hostName + '] ' + hostReply });
  if (typeof recordApiCall === 'function') recordApiCall();
  await hostResult.ttsPromise;

  state._guestSummonActive = false;
  state.exchangeCount = (state.exchangeCount || 0) + 1;
  state.isSending = false;
  state._firstSpeechLogged = false;
  document.getElementById('stopBtn').style.display = 'none';
  if (typeof saveState === 'function') saveState();
  if (typeof autoSaveConversation === 'function') autoSaveConversation();
  if (typeof ChatSuggestions !== 'undefined') ChatSuggestions.onMainIdle();
  return true;
}
