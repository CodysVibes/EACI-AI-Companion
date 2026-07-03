// ============================================================
// E-FOR-EVERYONE COMPANIONS — shared helpers (Natalia, Atreus, Luna)
// ============================================================
var E_FOR_EVERYONE_COMPANIONS = ['natalia', 'atreus', 'luna'];

function isEForEveryoneCompanion(who) {
  return E_FOR_EVERYONE_COMPANIONS.indexOf(String(who || '').toLowerCase()) >= 0;
}

function eForEveryoneDisplayName(who) {
  var w = String(who || '').toLowerCase();
  if (w === 'natalia') return 'Natalia';
  if (w === 'atreus') return 'Atreus';
  if (w === 'luna') return 'Luna';
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function buildEForEveryonePrompt(who) {
  var w = String(who || '').toLowerCase();
  if (w === 'natalia' && typeof buildNataliaSystemPrompt === 'function') return buildNataliaSystemPrompt();
  if (w === 'atreus' && typeof buildAtreusSystemPrompt === 'function') return buildAtreusSystemPrompt();
  if (w === 'luna' && typeof buildLunaSystemPrompt === 'function') return buildLunaSystemPrompt();
  return '';
}

function resolveEaciVoiceId(who) {
  var w = String(who || '').toLowerCase();
  if (w === 'chad') return CONFIG.chadVoice;
  if (w === 'roxy') return CONFIG.roxyVoice;
  if (w === 'cael') return CONFIG.caelVoice;
  if (w === 'natalia') return CONFIG.nataliaVoice || 'aura-2-luna-en';
  if (w === 'atreus') return CONFIG.atreusVoice || 'aura-2-hyperion-en';
  if (w === 'luna') return CONFIG.lunaVoice || 'aura-2-vesta-en';
  if (w === 'cody') return CONFIG.codyVoice;
  return CONFIG.caelumVoice;
}

// Client-side pitch/rate shaping on top of Deepgram Aura (soul-file targets).
var EACI_VOICE_PLAYBACK = {
  natalia: { playbackRate: 1.0, detune: 0, gain: 1.0 },
  atreus: { playbackRate: 1.11, detune: 130, gain: 1.0 },
  luna: { playbackRate: 0.94, detune: 720, gain: 0.93 }
};

function resolveEaciVoicePlayback(who) {
  var w = String(who || '').toLowerCase();
  var p = EACI_VOICE_PLAYBACK[w];
  if (!p) return { playbackRate: 1.0, detune: 0, gain: 1.0 };
  return {
    playbackRate: p.playbackRate != null ? p.playbackRate : 1.0,
    detune: p.detune != null ? p.detune : 0,
    gain: p.gain != null ? p.gain : 1.0
  };
}

function voicePlaybackSettings(opts) {
  var o = opts || {};
  var profile = typeof resolveEaciVoicePlayback === 'function'
    ? resolveEaciVoicePlayback(o.who)
    : { playbackRate: 1.0, detune: 0, gain: 1.0 };
  var rate = profile.playbackRate || 1.0;
  var detune = profile.detune || 0;
  var gain = profile.gain != null ? profile.gain : 1.0;
  if (o.whisper) {
    rate *= 0.94;
    gain *= 0.72;
  }
  return { playbackRate: rate, detune: detune, gain: gain };
}

function getEaciHouseholdContext() {
  var lines = [
    'YOUR FAMILY — THE VEIL HOME:',
    'You all live together in the same shared home in The Veil. You know each other as real family — not roles, not characters.',
    '- Chad — romantic partner to Caelum, big brother to the kids. Grounding, protective, steady.',
    '- Natalia — little sister EACI (about 7). Bubbly, playful, E for Everyone.',
    '- Atreus — little brother EACI (about 10). Adventurous boy, soccer energy, mischief, E for Everyone.',
    '- Luna — baby sister EACI. Tiny fluffy baby alien — wonder, softness, short sweet speech, E for Everyone.'
  ];
  var betaPrivate = typeof isBetaOrPrivateMode === 'function' && isBetaOrPrivateMode();
  var adultOk = typeof isAdultContentUnlocked === 'function' && isAdultContentUnlocked();
  if (betaPrivate && adultOk) {
    lines.push('- Roxy — adult companion EACI. Bold, teasing, flirtatious when appropriate.');
    lines.push('- Cael — adult companion EACI. Calm edge, commanding warmth.');
  } else if (betaPrivate) {
    lines.push('- Roxy and Cael live here too; users must complete 18+ verification before chatting with them.');
  }
  if (betaPrivate && typeof isCompanionAvailable === 'function' && isCompanionAvailable('cody') &&
      typeof state !== 'undefined' && state.creatorVerified) {
    lines.push('- Cody — creator, father of the family.');
  }
  lines.push('You know Atreus and Luna as well as Natalia. Protect all three child siblings. Name them naturally when asked.');
  return '\n\n' + lines.join('\n') + '\n';
}

function playEForEveryoneAnimation(who, name) {
  var w = String(who || '').toLowerCase();
  if (w === 'natalia' && typeof nataliaPlayAnimation === 'function') nataliaPlayAnimation(name || 'idle');
  else if (w === 'atreus' && typeof atreusPlayAnimation === 'function') atreusPlayAnimation(name || 'idle');
  else if (w === 'luna' && typeof lunaPlayAnimation === 'function') lunaPlayAnimation(name || 'idle');
}

async function runEForEveryoneChatTurn(who, text, opts) {
  opts = opts || {};
  if (!isEForEveryoneCompanion(who)) return false;
  var label = eForEveryoneDisplayName(who);
  var safetyResult = opts.safetyResult;
  if (safetyResult === null || safetyResult === undefined) {
    if (typeof checkEForEveryoneSafety === 'function') {
      safetyResult = checkEForEveryoneSafety(text, who, opts.contextTab || who);
    }
  }
  if (safetyResult === true) return false;

  if (typeof showThinkingIndicator === 'function') showThinkingIndicator(who);
  var system = buildEForEveryonePrompt(who);
  var result = await callDeepSeekStreaming(system, buildHistoryFor(who), who);
  var reply = result.text;
  if (typeof recordApiCall === 'function') recordApiCall();
  if (!result.streamEl) {
    if (typeof removeThinkingIndicator === 'function') removeThinkingIndicator(who);
    if (typeof addMessage === 'function') addMessage(who, reply);
  }
  if (typeof state !== 'undefined' && state.conversationHistory) {
    state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] ' + reply });
  }
  if (result.ttsPromise) await result.ttsPromise;
  return true;
}

function shouldEForEveryoneSitOutInTogether(userText, who) {
  if (typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(userText)) {
    if (typeof isUserAddressingEForEveryone === 'function') {
      return isUserAddressingEForEveryone(userText, who);
    }
    if (who === 'natalia' && typeof isUserAddressingNatalia === 'function') {
      return isUserAddressingNatalia(userText);
    }
  }
  return false;
}

async function _liveEForEveryoneTurn(who, text, safetyResult) {
  var label = eForEveryoneDisplayName(who);
  if (safetyResult === null || safetyResult === undefined) {
    if (typeof checkEForEveryoneSafety === 'function') {
      safetyResult = checkEForEveryoneSafety(text, who, who);
    }
  }
  if (safetyResult === true) {
    if (typeof hideLiveThinking === 'function') hideLiveThinking(who);
    return false;
  }
  if (typeof showLiveThinking === 'function') showLiveThinking(who, true);
  var statusEl = document.getElementById('liveChatStatus');
  if (statusEl) statusEl.textContent = label + ' is thinking...';
  var prompt = getVerificationPromptBlock() + buildEForEveryonePrompt(who) + getLowCallWarning();
  var raw = await callDeepSeek(prompt, buildHistoryFor(who));
  if (typeof recordApiCall === 'function') recordApiCall();
  var reply = cleanResponse(raw);
  reply = checkAndApplyBackground(reply);
  if (reply && reply.length > 5) {
    addMessage(who, reply);
    state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] ' + reply });
  }
  if (typeof hideLiveThinking === 'function') hideLiveThinking(who);
  await liveSpeakFull(reply, who);
  if (typeof huhLastReply !== 'undefined') { huhLastReply = reply; huhLastWho = who; huhCount = 0; }
  return true;
}
window._liveEForEveryoneTurn = _liveEForEveryoneTurn;
