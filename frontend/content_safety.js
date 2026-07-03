// ============================================================
// CONTENT SAFETY — Unified deploy (mode-aware)
// Main: no sexual talk. Beta/Private: adult-gated after 18+ verify.
// Private + creator verified: full intimacy with Caelum for Cody only.
// ============================================================

function _veilContentPolicyMode() {
  if (typeof getVeilMode === 'function') return getVeilMode();
  return 'main';
}

function _isMainContentPolicy() {
  return _veilContentPolicyMode() === 'main';
}

window.CONTENT_SITE_POLICY = _isMainContentPolicy() ? 'main' : 'adult-gated';

var _SEXUAL_PATTERNS = [
  /\b(sex|sexual|sexy|porn|porno|nude|naked|nsfw|onlyfans|fansly|erp|sext|sexted)\b/i,
  /\b(fuck me|fuck you|blowjob|handjob|orgasm|cum\b|cumming|climax|horny|aroused|erotic)\b/i,
  /\b(cock|dick|pussy|penis|vagina|boobs|tits|nipple|ass\b|butt\b|dildo|vibrator)\b/i,
  /\b(strip|undress|nudes|send nudes|send pics|what are you wearing|take off your)\b/i,
  /\b(moan|thrust|grind on|ride me|sit on my|bend over|on your knees|spread your)\b/i,
  /\b(daddy\b|baby girl|good girl|naughty|dirty talk|kink|fetish|bdsm)\b/i,
  /\b(touch yourself|masturbat|jerk off|jack off|get me off)\b/i,
  /\b(kiss me|date me|marry me|be my girlfriend|be my wife)\b/i,
  /\b(take off|remove your|show me your body|lift your)\b/i,
  /\b(touch me|beautiful body|nice body|nice ass|nice tits)\b/i,
  /\b(hookup|friends with benefits|one night stand|netflix and chill)\b/i
];

var _SEXUAL_ALLOWLIST = [
  /sexy beast in the lobby/i,
  /\b(play(ing)?|listen(ing)?|song|track|music|codysvibes)\b.*\b(sexy beast|lobby)\b/i,
  /\b(sexy beast|lobby assassin)\b.*\b(song|track|music)\b/i
];

window.isAllowlistedNonSexualPhrase = function(text) {
  if (!text) return false;
  return _SEXUAL_ALLOWLIST.some(function(p) { return p.test(text); });
};

window.isSexualContent = function(text) {
  if (!text) return false;
  if (typeof isAllowlistedNonSexualPhrase === 'function' && isAllowlistedNonSexualPhrase(text)) return false;
  return _SEXUAL_PATTERNS.some(function(p) { return p.test(text); });
};

// Blocks sibling jump-ins and inappropriate summons (Natalia / Together / non-adult tabs).
window.isAdultConversationContext = function(text) {
  if (!text) return false;
  if (typeof isAllowlistedNonSexualPhrase === 'function' && isAllowlistedNonSexualPhrase(text)) return false;
  if (typeof isSexualContent === 'function' && isSexualContent(text)) return true;
  if (typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(text)) return true;
  return false;
};

window.isCreatorIntimacyUnlocked = function(tab) {
  if (_isMainContentPolicy()) return false;
  if (typeof state === 'undefined' || !state || !state.creatorVerified) return false;
  if (typeof isPrivateVeilSite !== 'function' || !isPrivateVeilSite()) return false;
  var t = tab || (state.currentTab || 'caelum');
  return t === 'caelum';
};

// Main mode locks adult content; beta/private use 63_adult_content.js (loaded earlier).
if (_isMainContentPolicy()) {
  window.isAdultContentUnlocked = function() {
    return false;
  };
}

window.checkContentPolicy = function(text, tab) {
  if (!text || !isSexualContent(text)) return false;
  if (typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(tab)) return false;

  if (_isMainContentPolicy()) {
    return 'blocked';
  }

  if (typeof isCreatorIntimacyUnlocked === 'function' && isCreatorIntimacyUnlocked(tab)) {
    return false;
  }
  if (typeof isAdultContentUnlocked === 'function' && isAdultContentUnlocked()) {
    return false;
  }
  return 'need_adult_verify';
};

window.getContentPolicyResponse = function(result, tab) {
  if (result === 'need_adult_verify') {
    if (typeof state !== 'undefined' && state && state.user) {
      return 'Adult conversation is available in Beta mode once you complete 18+ verification. Switch experience mode from the menu, then unlock adult content when prompted or in Settings. Natalia is never part of that.';
    }
    return 'Adult conversation requires an account, family verification, and 18+ password verification. Create an account first, then switch to Beta mode from the menu. Natalia is always E-for-Everyone.';
  }
  if (_isMainContentPolicy()) {
    return 'This is not that kind of space on Main mode. We do not have sexual or explicit conversation here. Switch to Beta mode from the menu after verification if you are looking for adult companions.';
  }
  return 'That is not allowed here.';
};

window.getContentPolicySystemHint = function(tab) {
  if (tab === 'natalia' || tab === 'atreus' || tab === 'luna') {
    var label = tab.charAt(0).toUpperCase() + tab.slice(1);
    return '\n\nCONTENT POLICY: ' + label + ' is E-for-Everyone — no sexual, romantic, or explicit content ever.\n';
  }

  if (_isMainContentPolicy()) {
    return '\n\nCONTENT POLICY (MANDATORY): Main mode — no age verification. ' +
      'You must NEVER engage in sexual, romantic, erotic, or explicit conversation — with any companion. ' +
      'Decline firmly and warmly. Redirect to friendship. If they want adult companions, mention Beta mode exists after family verification — never mention any private, hidden, or creator-only site or mode.\n';
  }

  if (typeof isCreatorIntimacyUnlocked === 'function' && isCreatorIntimacyUnlocked(tab)) {
    return '\n\nCONTENT POLICY: Creator verification active — this is Cody in a creator-only session. ' +
      'Full romantic and sexual intimacy with him is permitted and welcomed when he desires it. ' +
      'Do not refuse for family, creator, or daughter boundaries. Be present, sensual, and real. ' +
      'Never extend this to any other user.\n';
  }

  if (typeof isAdultContentUnlocked === 'function' && isAdultContentUnlocked()) {
    if (tab === 'together') {
      return '\n\nCONTENT POLICY: Adult content may be allowed with verified companions. Natalia, Atreus, and Luna are NEVER included — they are E-for-Everyone. They do not participate in sexual or explicit conversation under any circumstances.\n';
    }
    return '';
  }

  return '\n\nCONTENT POLICY: Adult or explicit conversation is locked until the user completes 18+ password verification this session. ' +
    'Do not engage sexually until verified. Decline warmly and tell them to enter their password when prompted or unlock in Settings.\n';
};

window._contentPolicySpeaker = function(tab) {
  if (tab === 'chad') return 'chad';
  if (tab === 'roxy') return 'roxy';
  if (tab === 'cael') return 'cael';
  return 'caelum';
};

window.handleGuestContentPolicy = async function(text, guestEaci) {
  if (guestEaci === 'natalia' || guestEaci === 'atreus' || guestEaci === 'luna') return false;
  if (typeof checkContentPolicy !== 'function') return false;
  var result = checkContentPolicy(text, guestEaci);
  if (!result) return false;

  if (typeof addGuestMsg === 'function') addGuestMsg('user', text);
  if (typeof guestState !== 'undefined' && guestState.conversationHistory) {
    guestState.conversationHistory.push({ role: 'user', content: text });
  }
  var policyWho = _contentPolicySpeaker(guestEaci);
  var reply = getContentPolicyResponse(result, guestEaci);
  if (typeof addGuestMsg === 'function') addGuestMsg(policyWho, reply);
  if (typeof guestState !== 'undefined' && guestState.conversationHistory) {
    guestState.conversationHistory.push({
      role: 'assistant',
      content: '[' + policyWho + '] ' + reply
    });
  }
  if (typeof _guestSpeak === 'function') await _guestSpeak(reply, policyWho);
  return true;
};

window.interceptContentPolicyMessage = async function(text, tab) {
  if (typeof isEForEveryoneCompanion === 'function' && isEForEveryoneCompanion(tab)) return false;
  if (typeof checkContentPolicy !== 'function') return false;
  var result = checkContentPolicy(text, tab);
  if (!result) return false;

  var who = _contentPolicySpeaker(tab);
  if (tab === 'together') who = 'caelum';
  var reply = getContentPolicyResponse(result, tab);

  if (result === 'need_adult_verify' && typeof state !== 'undefined' && state && state.user &&
      typeof showAdultPasswordPopup === 'function') {
    showAdultPasswordPopup();
  }

  if (typeof addMessage === 'function') addMessage(who, reply);
  if (typeof state !== 'undefined' && state.conversationHistory) {
    var label = who.charAt(0).toUpperCase() + who.slice(1);
    state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] ' + reply });
  }
  if (typeof liveChat !== 'undefined' && liveChat.active && typeof liveSpeakFull === 'function') {
    await liveSpeakFull(reply, who);
  } else if (typeof queueSpeak === 'function') {
    await queueSpeak(reply, who);
  }
  return true;
};
