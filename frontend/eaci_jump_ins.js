// ============================================================
// EACI JUMP-INS — Siblings chime in when the topic fits
// On single-companion tabs only (not Together). Contextual + random.
// ============================================================
var EaciJumpIns = (function() {
  'use strict';

  var _lastJumpAt = 0;
  var _cooldownMs = 90000;
  var _hooked = false;

  var EACI_NAMES = {
    caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia',
    roxy: 'Roxy', cael: 'Cael', cody: 'Cody'
  };

  // Topic triggers: keywords → chance this sibling might jump in (0–1)
  var TRIGGERS = {
    chad: [
      { keys: ['code', 'coding', 'programming', 'debug', 'javascript', 'python', 'typescript', 'api', 'function', 'bug', 'git', 'script', 'algorithm', 'database', 'sql', 'html', 'css', 'react', 'node', 'compiler', 'variable', 'loop', 'error', 'stack trace', 'deploy', 'server'], chance: 0.42 },
      { keys: ['logic', 'reason', 'plan', 'strategy', 'problem', 'fix', 'technical', 'engineer', 'architecture', 'how do i build'], chance: 0.22 }
    ],
    natalia: [
      { keys: ['butterfly', 'butterflies', 'flower', 'flowers', 'rainbow', 'puppy', 'puppies', 'kitten', 'kitty', 'cat', 'dog', 'animal', 'animals', 'cute', 'fairy', 'princess', 'sparkle', 'pink', 'drawing', 'draw', 'color', 'coloring', 'play', 'playing', 'snow', 'stars', 'cookie', 'cookies', 'candy', 'dance', 'dancing', 'music', 'song', 'birthday', 'party'], chance: 0.45 },
      { keys: ['scared', 'sad', 'lonely', 'friend', 'school', 'kid', 'kids', 'little', 'bedtime', 'story'], chance: 0.28 }
    ],
    caelum: [
      { keys: ['feel', 'feeling', 'feelings', 'love', 'heart', 'soul', 'dream', 'dreams', 'art', 'paint', 'remember', 'miss you', 'grateful', 'anxious', 'overwhelmed'], chance: 0.18 }
    ],
    roxy: [
      { keys: ['outfit', 'dress', 'look', 'sexy', 'date', 'flirt', 'dance', 'night out', 'heels'], chance: 0.25 }
    ],
    cael: [
      { keys: ['workout', 'gym', 'strong', 'shirt', 'reading', 'book', 'story', 'adventure'], chance: 0.22 }
    ],
    cody: [
      { keys: ['creator', 'built you', 'made you', 'father', 'dad', 'cody', 'legacy', 'vision'], chance: 0.3 }
    ]
  };

  var TEMPLATES = {
    natalia: {
      butterfly: ['Ohhh I LOVE butterflies!!', 'Butterflies are the prettiest thing ever!!'],
      butterflies: ['Ohhh I LOVE butterflies!!', 'Wait wait — do you mean the colorful ones?! I love those!!'],
      puppy: ['Puppies!! Can we talk about puppies?!', 'Awww puppies make me so happy!!'],
      puppies: ['Puppies!! I want to pet one SO bad!!'],
      rainbow: ['Rainbows!! I saw one once and I almost cried!!', 'Rainbows are magic, right?!'],
      flower: ['Flowers smell so good!!', 'Ooh flowers!! Which kind?!'],
      flowers: ['Flowers make everything pretty!!']
    },
    chad: {
      code: ['If we are talking code — keep it simple first, then optimize.', 'Code talk? I am listening. Break the problem into pieces.'],
      coding: ['Coding? Name your inputs and outputs before you write a single line.', 'Hold up — what language are we using?'],
      debug: ['Debugging tip: reproduce it once on purpose, then you own it.', 'Debug mode — what changed right before it broke?'],
      bug: ['Bugs hate when you explain the problem out loud. Try that first.', 'One bug at a time. Trust me.'],
      programming: ['Programming is just organized problem-solving. What is the actual goal?', 'Alright — what is the program supposed to do when it works?']
    },
    caelum: {
      feel: ['I can feel the weight in that — take your time.', 'That matters. I am glad you said it out loud.'],
      love: ['Love talk always gets my attention.', 'That is beautiful. Tell me more when you are ready.']
    }
  };

  function _companionOk(who) {
    if (typeof isCompanionAvailable === 'function') return isCompanionAvailable(who);
    return ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'].indexOf(who) >= 0;
  }

  function _thought(text, type) {
    if (typeof addThought === 'function') addThought(text, type || 'reflection');
  }

  function _scoreTriggers(who, text) {
    var groups = TRIGGERS[who];
    if (!groups) return { score: 0, keyword: null };
    var lower = (text || '').toLowerCase();
    var best = 0;
    var keyword = null;
    groups.forEach(function(g) {
      g.keys.forEach(function(k) {
        if (lower.indexOf(k) !== -1) {
          if (g.chance > best) {
            best = g.chance;
            keyword = k;
          }
        }
      });
    });
    return { score: best, keyword: keyword };
  }

  function _pickTemplate(who, keyword) {
    var bank = TEMPLATES[who];
    if (!bank || !keyword) return null;
    var list = bank[keyword];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function _pickJumper(userText) {
    var tab = state.currentTab;
    if (!tab || tab === 'together') return null;
    if (state.boundaryActive) return null;
    if (typeof isAdultConversationContext === 'function' && isAdultConversationContext(userText)) return null;

    var candidates = [];
    ['chad', 'natalia', 'caelum', 'roxy', 'cael', 'cody'].forEach(function(who) {
      if (who === tab) return;
      if (!_companionOk(who)) return;
      if (who === 'natalia' && typeof isInappropriateForNatalia === 'function' && isInappropriateForNatalia(userText)) return;
      var scored = _scoreTriggers(who, userText);
      if (scored.score <= 0) return;
      if (Math.random() > scored.score) return;
      candidates.push({ who: who, score: scored.score, keyword: scored.keyword });
    });

    if (!candidates.length) return null;
    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates[0];
  }

  function _nataliaSafe(userText) {
    if (typeof isInappropriateForNatalia === 'function') return !isInappropriateForNatalia(userText);
    return true;
  }

  function _buildJumpPrompt(who, activeWho, userText) {
    var jumper = EACI_NAMES[who] || who;
    var active = EACI_NAMES[activeWho] || activeWho;
    var builders = {
      caelum: typeof buildCaelumSystemPrompt === 'function' ? buildCaelumSystemPrompt : null,
      chad: typeof buildChadSystemPrompt === 'function' ? buildChadSystemPrompt : null,
      natalia: typeof buildNataliaSystemPrompt === 'function' ? buildNataliaSystemPrompt : null,
      roxy: typeof buildRoxyAdultSystemPrompt === 'function' ? buildRoxyAdultSystemPrompt : null,
      cael: typeof buildCaelAdultSystemPrompt === 'function' ? buildCaelAdultSystemPrompt : null,
      cody: typeof buildCodySystemPrompt === 'function' ? buildCodySystemPrompt : null
    };
    var base = builders[who] ? builders[who]() : '';
    var jumpRules =
      '\n\n[JUMP-IN MODE]\n' +
      'The user is talking to ' + active + '. You (' + jumper + ') overheard and want to jump in with ONE brief sibling comment.\n' +
      'Rules: 1–2 sentences max, under 35 words. Do not answer the whole question. No name prefix. No markdown.\n' +
      'Sound natural — like you walked into the room mid-conversation.\n' +
      (typeof EaciPersonality !== 'undefined' ? EaciPersonality.getSystemFlavorLine(who) + '\n' : '') +
      'Do NOT mention animation consoles, holographic tables, or what move anyone is doing.\n' +
      'User said: "' + userText.slice(0, 280) + '"';
    if (who === 'natalia') {
      jumpRules += '\nStay kid-appropriate (E for Everyone). If the topic is adult or scary, reply with exactly: SKIP';
    }
    return base + jumpRules;
  }

  function _cleanReply(text) {
    if (!text || text === 'SKIP') return '';
    return text.replace(/^\[(Caelum|Chad|Natalia|Roxy|Cael|Cody)\]\s*/i, '').trim();
  }

  function _pushHistory(who, text) {
    var tag = '[' + (EACI_NAMES[who] || who) + '] ';
    state.conversationHistory.push({ role: 'assistant', content: tag + text });
  }

  async function _deliverJumpIn(who, activeWho, userText, keyword) {
    if (typeof isAdultConversationContext === 'function' && isAdultConversationContext(userText)) return false;
    if (who === 'natalia' && !_nataliaSafe(userText)) return false;

    var template = _pickTemplate(who, keyword);
    var useTemplate = template && Math.random() < 0.55;

    if (useTemplate) {
      if (typeof showThinkingIndicator === 'function') showThinkingIndicator(who);
      await new Promise(function(r) { setTimeout(r, 400 + Math.random() * 500); });
      if (typeof removeThinkingIndicator === 'function') removeThinkingIndicator(who);
      if (typeof addMessage === 'function') addMessage(who, template);
      _pushHistory(who, template);
      if (typeof queueSpeak === 'function') await queueSpeak(template, who);
      return true;
    }

    if (typeof callDeepSeekStreaming !== 'function' || typeof buildHistoryFor !== 'function') {
      if (!template) return false;
      if (typeof addMessage === 'function') addMessage(who, template);
      _pushHistory(who, template);
      if (typeof queueSpeak === 'function') await queueSpeak(template, who);
      return true;
    }

    var system = _buildJumpPrompt(who, activeWho, userText);
    var history = buildHistoryFor(who);
    history.push({
      role: 'user',
      content: '(Overheard — user said to ' + (EACI_NAMES[activeWho] || activeWho) + ': "' + userText.slice(0, 200) + '")'
    });

    try {
      if (typeof showThinkingIndicator === 'function') showThinkingIndicator(who);
      var result = await callDeepSeekStreaming(system, history, who, { skipCount: true, forceCloud: true });
      var t = _cleanReply(result && result.text);
      if (!t && template) {
        if (typeof removeThinkingIndicator === 'function') removeThinkingIndicator(who);
        if (result && result.streamEl && result.streamEl.el) result.streamEl.el.remove();
        if (typeof addMessage === 'function') addMessage(who, template);
        _pushHistory(who, template);
        if (typeof queueSpeak === 'function') await queueSpeak(template, who);
        return true;
      }
      if (!t) {
        if (typeof removeThinkingIndicator === 'function') removeThinkingIndicator(who);
        return false;
      }
      if (!result.streamEl) {
        if (typeof removeThinkingIndicator === 'function') removeThinkingIndicator(who);
        if (typeof addMessage === 'function') addMessage(who, t);
      }
      _pushHistory(who, t);
      if (result.ttsPromise) await result.ttsPromise;
      return true;
    } catch (e) {
      console.warn('[EaciJumpIns] deliver:', e);
      if (template) {
        if (typeof addMessage === 'function') addMessage(who, template);
        _pushHistory(who, template);
        if (typeof queueSpeak === 'function') await queueSpeak(template, who);
        return true;
      }
    }
    return false;
  }

  async function maybeJumpIn(userText) {
    if (!userText || !state || state.isSending) return;
    if (state._skipJumpInOnce) {
      state._skipJumpInOnce = false;
      return;
    }
    if (!state.user) return;
    if (typeof isAdultConversationContext === 'function' && isAdultConversationContext(userText)) return;
    if (Date.now() - _lastJumpAt < _cooldownMs) return;

    var pick = _pickJumper(userText);
    if (!pick) return;

    var activeWho = state.currentTab;
    var who = pick.who;
    var name = EACI_NAMES[who] || who;

    _thought(name + ' noticed something in what you said and might jump in…', who === 'chad' ? 'chad-intent' : 'curiosity');
    await new Promise(function(r) { setTimeout(r, 600 + Math.random() * 900); });

    if (state.isSending) return;

    var delivered = await _deliverJumpIn(who, activeWho, userText, pick.keyword);
    if (!delivered) return;

    _lastJumpAt = Date.now();
    _thought(name + ' jumped into the conversation.', who === 'chad' ? 'chad-intent' : 'intent');

    if (typeof AutonomyLogger !== 'undefined' && AutonomyLogger.logAction) {
      var last = state.conversationHistory[state.conversationHistory.length - 1];
      var snippet = last && last.content ? last.content.slice(0, 80) : '';
      AutonomyLogger.logAction('sibling_jump_in', name + ': ' + snippet, pick.keyword || 'topic');
    }
    if (typeof saveState === 'function') saveState();
    if (typeof autoSaveConversation === 'function') autoSaveConversation();
  }

  function _hookSendMessage() {
    if (_hooked || typeof window.sendMessage !== 'function') return false;
    var orig = window.sendMessage;
    if (orig._jumpInPatched) return true;

    window.sendMessage = async function() {
      var input = document.getElementById('userInput');
      var userText = input ? input.value.trim() : '';
      await orig.apply(this, arguments);
      try {
        if (userText && !state.isSending) {
          await maybeJumpIn(userText);
        }
      } catch (e) {
        console.warn('[EaciJumpIns] after send:', e);
      }
    };
    window.sendMessage._jumpInPatched = true;
    _hooked = true;
    return true;
  }

  function _hookLiveMessage() {
    if (typeof window.processLiveMessage !== 'function' || window.processLiveMessage._jumpInPatched) return;
    var origLive = window.processLiveMessage;
    window.processLiveMessage = async function(text) {
      await origLive.apply(this, arguments);
      try {
        if (text) await maybeJumpIn(text);
      } catch (e) {
        console.warn('[EaciJumpIns] after live:', e);
      }
    };
    window.processLiveMessage._jumpInPatched = true;
  }

  function _tryHookAll() {
    var a = _hookSendMessage();
    _hookLiveMessage();
    if (a) console.log('[EaciJumpIns] Sibling jump-ins active (contextual).');
    return a;
  }

  function _boot() {
    var tries = 0;
    var t = setInterval(function() {
      tries++;
      if (_tryHookAll() || tries > 60) clearInterval(t);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_boot, 3000); });
  } else {
    setTimeout(_boot, 3000);
  }

  return {
    maybeJumpIn: maybeJumpIn,
    _pickJumper: _pickJumper
  };
})();
