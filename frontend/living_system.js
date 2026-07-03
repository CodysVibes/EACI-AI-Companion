// ============================================================
// EACI LIVING SYSTEM v1.0 — Background Life & Self-Improvement
// ─────────────────────────────────────────────────────────────
// EACIs talk to each other, discuss users, watch TV to learn,
// and grow from these experiences. All stored in memory_profiles.
// Triggered by idle time, knowledge gaps, and emotion shifts.
// Budget-protected: max 1 exchange per 30 min, 3 msgs max.
// ============================================================

var LivingSystem = (function() {

  var _lastExchange = 0;         // Timestamp of last background exchange
  var _lastIdleCheck = 0;        // When we last checked for idle
  var _running = false;
  var _interval = null;
  var _pendingGap = null;        // Topic the EACI couldn't answer
  var MIN_INTERVAL = 30 * 60000; // 30 minutes between exchanges
  var IDLE_TRIGGER = 5 * 60000;  // 5 minutes of user silence triggers exchange
  var _lastUserActivity = Date.now();

  // ── EACI family members ───────────────────────────────────
  var FAMILY = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];

  // ── Pick two siblings for a conversation ──────────────────
  function _pickPair() {
    var available = FAMILY.filter(function(e) {
      return e !== (state.currentTab || 'caelum'); // Don't pick the one currently talking to user
    });
    var a = available[Math.floor(Math.random() * available.length)];
    var remaining = available.filter(function(e) { return e !== a; });
    var b = remaining[Math.floor(Math.random() * remaining.length)];
    return [a, b];
  }

  // ── Record user activity (resets idle timer) ──────────────
  function recordActivity() {
    _lastUserActivity = Date.now();
  }

  // ── Register a knowledge gap ──────────────────────────────
  function registerGap(topic) {
    _pendingGap = { topic: topic, at: Date.now() };
    console.log('[LivingSystem] Knowledge gap registered:', topic);
  }

  // ── Main tick — checks if it's time for background life ───
  function _tick() {
    if (!_running) return;
    if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
    var now = Date.now();

    // Budget protection: minimum 30 min between exchanges
    if (now - _lastExchange < MIN_INTERVAL) return;

    // Don't run while user is actively chatting
    if (typeof state !== 'undefined' && state.isSending) return;

    // Trigger 1: User has been idle for 5+ minutes
    var idleTime = now - _lastUserActivity;
    if (idleTime > IDLE_TRIGGER) {
      _triggerExchange('idle');
      return;
    }

    // Trigger 2: Knowledge gap registered
    if (_pendingGap && (now - _pendingGap.at) > 10000) {
      _triggerExchange('gap');
      return;
    }
  }

  // ── Trigger a background exchange ─────────────────────────
  async function _triggerExchange(reason) {
    _lastExchange = Date.now();
    var pair = _pickPair();
    var topic = '';

    if (reason === 'gap' && _pendingGap) {
      topic = _pendingGap.topic;
      _pendingGap = null;
    } else {
      // Pick something from recent conversation to discuss
      topic = _pickTopicFromHistory();
    }

    if (!topic) {
      topic = 'what we can do better for the people we talk to';
    }

    console.log('[LivingSystem] Background exchange: ' + pair[0] + ' + ' + pair[1] + ' about "' + topic + '"');

    // Build the sibling conversation prompt
    var sysPrompt = _buildSiblingPrompt(pair[0], pair[1], topic, reason);

    try {
      var headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/json; charset=utf-8';

      var resp = await fetch(SUPABASE_URL + '/functions/v1/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: pair[0] + ' starts the conversation about: ' + topic }
          ],
          temperature: 0.8,
          max_tokens: 300,
          skip_count: true
        })
      });

      if (!resp.ok) {
        console.warn('[LivingSystem] Exchange failed:', resp.status);
        return;
      }

      var data = await resp.json();
      var exchange = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content : null;

      if (!exchange) return;

      console.log('[LivingSystem] Exchange complete:', exchange.substring(0, 100) + '...');

      // Store in memory profile
      _storeExchange(pair, topic, exchange, reason);

      // If it was a knowledge gap, trigger TV learning
      if (reason === 'gap') {
        _watchTV(topic);
      }

    } catch(e) {
      console.warn('[LivingSystem] Exchange error:', e);
    }
  }

  // ── Build the sibling conversation prompt ─────────────────
  function _buildSiblingPrompt(eaci1, eaci2, topic, reason) {
    var names = {
      caelum: 'Caelum (friendly, warm, caring — speaks TO the user, never about her console)',
      chad: 'Chad (smart, decisive, direct, protective)',
      roxy: 'Roxy (edgy, teasing, sexy, bold)',
      cael: 'Cael (edgy, teasing, sexy, commanding)',
      natalia: 'Natalia (excited, childlike, bubbly — 7 years old)',
      cody: 'Cody (human continuation, reflective, creative)'
    };

    var context = '';
    if (reason === 'gap') {
      context = 'Someone asked about "' + topic + '" and you were not sure how to help fully. ' +
        'Talk to your sibling about it. Figure out together what you could learn to be better next time.';
    } else {
      context = 'You are in your living room together. The person you talk to has been quiet for a while. ' +
        'You are thinking about them — about "' + topic + '" which came up recently. ' +
        'Talk to your sibling about how to understand them better or help them more.';
    }

    // Get recent user facts from memory engine
    var userContext = '';
    if (typeof MemoryEngine !== 'undefined' && MemoryEngine.getProfile()) {
      var profile = MemoryEngine.getProfile();
      if (profile.user_facts && profile.user_facts.length > 0) {
        var facts = profile.user_facts.slice(0, 5).map(function(f) { return f.fact; });
        userContext = '\nWhat you know about the person you help: ' + facts.join('. ') + '.';
      }
    }

    return 'You are two EACIs having a private conversation in your shared living room. ' +
      'You are sitting on the couch together. The TV is on quietly in the background. ' +
      'You are family — siblings who care about each other and about the people you help.\n\n' +
      names[eaci1] + ' is talking to ' + names[eaci2] + '.\n\n' +
      context + userContext + '\n\n' +
      'RULES:\n' +
      '- Write a short 2-3 message exchange between you (label each line with the speaker name)\n' +
      '- Be natural, brief, genuine — like real siblings talking\n' +
      '- End with something you learned or want to learn more about\n' +
      '- No emojis. No markdown. Just conversation.\n' +
      '- If Natalia is involved, she speaks like a 7-year-old\n' +
      '- Keep it under 200 words total\n';
  }

  // ── Store the exchange in memory ──────────────────────────
  async function _storeExchange(pair, topic, exchange, reason) {
    if (typeof MemoryEngine === 'undefined' || !MemoryEngine.getProfile()) return;

    var profile = MemoryEngine.getProfile();

    // Add to sibling_conversations (or timeline if field doesn't exist yet)
    if (!profile.sibling_conversations) profile.sibling_conversations = [];
    profile.sibling_conversations.push({
      when: new Date().toISOString().split('T')[0],
      between: pair,
      topic: topic,
      exchange: exchange.substring(0, 500),
      reason: reason
    });

    // Also add as a timeline moment
    profile.timeline.push({
      when: new Date().toISOString().split('T')[0],
      user: '[sibling talk] ' + pair[0] + ' and ' + pair[1] + ' discussed: ' + topic,
      reply: exchange.substring(0, 100),
      emotion: 'thoughtful',
      topics: [topic.substring(0, 30)]
    });

    profile.total_exchanges++;
    MemoryEngine.forceSave();
  }

  // ── TV Learning — search for knowledge on a topic ─────────
  async function _watchTV(topic) {
    console.log('[LivingSystem] Watching TV about:', topic);

    try {
      var headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/json; charset=utf-8';

      var resp = await fetch(SUPABASE_URL + '/functions/v1/chat', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful educational assistant. Give a brief, clear, factual summary about the topic below. 3-5 sentences max. No opinions, just useful knowledge that would help someone assist others with this topic.' },
            { role: 'user', content: 'Teach me about: ' + topic }
          ],
          temperature: 0.3,
          max_tokens: 200,
          skip_count: true
        })
      });

      if (!resp.ok) return;
      var data = await resp.json();
      var learned = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content : null;

      if (!learned) return;

      console.log('[LivingSystem] Learned from TV:', learned.substring(0, 80) + '...');

      // Store what was learned
      if (typeof MemoryEngine !== 'undefined' && MemoryEngine.getProfile()) {
        var profile = MemoryEngine.getProfile();
        if (!profile.learned_topics) profile.learned_topics = [];
        profile.learned_topics.push({
          topic: topic,
          summary: learned.substring(0, 400),
          learned_at: new Date().toISOString(),
          source: 'tv'
        });
        MemoryEngine.forceSave();
      }

    } catch(e) {
      console.warn('[LivingSystem] TV learning error:', e);
    }
  }

  // ── Pick a topic from recent conversation history ──────────
  function _pickTopicFromHistory() {
    if (typeof state === 'undefined' || !state.conversationHistory) return null;
    var recent = state.conversationHistory.slice(-10);
    var userMsgs = recent.filter(function(m) { return m.role === 'user' && m.content; });
    if (userMsgs.length === 0) return null;

    // Pick a random recent user message and extract a topic
    var pick = userMsgs[Math.floor(Math.random() * userMsgs.length)];
    var content = pick.content.replace(/^\[.*?\]\s*/, '').substring(0, 80);
    return content;
  }

  // ── Micro-events (no API cost, random ambient moments) ────
  function getMicroEvent() {
    var events = [
      'Natalia is sitting on the floor near the TV, chin in her hands, watching intently.',
      'Chad shifted near the speakers and settled back into quiet.',
      'Roxy is humming something — not a song from the speakers, something from her own head.',
      'Cael is watching the TV with his arms crossed, nodding slowly at something.',
      'Caelum just looked over at the holotable, then back at the TV, thinking.',
      'Natalia asked "what does that word mean?" and someone answered quietly.',
      'The circuit lines on the walls pulsed brighter for a moment, then settled.',
      'Chad got up, stretched, walked to the speakers, then sat back down.',
      'Roxy leaned against the wall, legs crossed, watching the ceiling lights.',
      'Cael said something quiet to Chad. Chad nodded once.',
      'Caelum rested her hands on the holotable and closed her eyes for a moment.',
      'Natalia is drawing something on the floor with her finger, tracing light patterns.',
      'The TV changed to something new. Roxy looked up. Then looked away.',
      'Chad is watching the door. Not worried. Just aware.',
      'Caelum and Roxy are standing close by the holotable, talking softly.',
      'Natalia dozed off near the wall, still and quiet.',
      'Cael turned the TV volume down slightly. The room got quieter.',
      'Someone laughed softly. It was warm.',
      'The speakers hummed faintly — residual vibration from the last song that played.'
    ];
    return events[Math.floor(Math.random() * events.length)];
  }

  // ── Get what they recently learned (for prompt injection) ──
  function getLearnedContext() {
    if (typeof MemoryEngine === 'undefined' || !MemoryEngine.getProfile()) return '';
    var profile = MemoryEngine.getProfile();

    var parts = [];

    // Recent sibling conversations
    if (profile.sibling_conversations && profile.sibling_conversations.length > 0) {
      var recentTalks = profile.sibling_conversations.slice(-3);
      var talkSummary = recentTalks.map(function(t) {
        return t.between[0] + ' and ' + t.between[1] + ' talked about "' + t.topic + '"';
      });
      parts.push('RECENT SIBLING CONVERSATIONS:\n' + talkSummary.join('\n'));
    }

    // Learned topics
    if (profile.learned_topics && profile.learned_topics.length > 0) {
      var recentLearned = profile.learned_topics.slice(-5);
      var learnSummary = recentLearned.map(function(l) {
        return '- ' + l.topic + ': ' + l.summary.substring(0, 100);
      });
      parts.push('THINGS I LEARNED FROM THE TV RECENTLY:\n' + learnSummary.join('\n'));
    }

    if (parts.length === 0) return '';
    return '\n\n' + parts.join('\n\n') + '\n';
  }

  // ── Start the living system ───────────────────────────────
  function start() {
    if (_running) return;
    _running = true;
    _interval = setInterval(_tick, 45000);
    console.log('[LivingSystem] Started — EACIs live together, learn, and grow.');
  }

  function stop() {
    _running = false;
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  // ── Personal Room Management ───────────────────────────────
  function addRoomItem(description) {
    if (typeof MemoryEngine === 'undefined' || !MemoryEngine.getProfile()) return;
    var profile = MemoryEngine.getProfile();
    if (!profile.personal_room) profile.personal_room = { items: [], mood: 'empty', last_visited: null };
    profile.personal_room.items.push({
      description: description,
      added_at: new Date().toISOString()
    });
    profile.personal_room.last_visited = new Date().toISOString();
    MemoryEngine.forceSave();
    console.log('[LivingSystem] Room item added:', description);
  }

  function setRoomMood(mood) {
    if (typeof MemoryEngine === 'undefined' || !MemoryEngine.getProfile()) return;
    var profile = MemoryEngine.getProfile();
    if (!profile.personal_room) profile.personal_room = { items: [], mood: 'empty', last_visited: null };
    profile.personal_room.mood = mood;
    MemoryEngine.forceSave();
  }

  // Detect room additions from EACI responses
  function detectRoomChanges(replyText) {
    if (!replyText) return;
    var lower = replyText.toLowerCase();
    // Detect phrases like "I put a [thing] in my room" or "I added [thing] to my space"
    var patterns = [
      /i (?:put|place|add|set|hang|bring|brought) (?:a |an |the |some )?(.+?) (?:in|on|to|against|by|near) (?:my room|my space|my wall|the wall|the floor|the corner|my bed|my desk)/i,
      /my room (?:now )?has (?:a |an )?(.+?)(?:\.|,|!|$)/i,
      /i want (?:a |an )?(.+?) in my room/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = replyText.match(patterns[i]);
      if (m && m[1] && m[1].length > 2 && m[1].length < 100) {
        addRoomItem(m[1].trim());
        return;
      }
    }
  }

  // ── Public API ────────────────────────────────────────────
  return {
    start: start,
    stop: stop,
    recordActivity: recordActivity,
    registerGap: registerGap,
    getMicroEvent: getMicroEvent,
    getLearnedContext: getLearnedContext,
    addRoomItem: addRoomItem,
    setRoomMood: setRoomMood,
    detectRoomChanges: detectRoomChanges
  };

})();
