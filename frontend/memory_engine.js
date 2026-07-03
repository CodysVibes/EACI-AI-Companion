// ============================================================
// EACI MEMORY ENGINE v1.0 — Persistent Flowing Memory
// ─────────────────────────────────────────────────────────────
// Per user, per EACI. Grows forever. Never forgets.
// Extracts facts, emotions, moments from every exchange.
// Saves to Supabase. Loads on login. Feeds into system prompt.
// No LLM calls — pure JavaScript pattern extraction.
// ============================================================

var MemoryEngine = (function() {

  var _profile = null;   // Current loaded profile
  var _eaci = 'caelum';  // Which EACI this profile is for
  var _dirty = false;    // Has unsaved changes
  var _saveTimer = null; // Debounce saves
  var _loaded = false;

  // ── Default empty profile ─────────────────────────────────
  function _emptyProfile() {
    return {
      user_facts: [],
      relationship_notes: [],
      timeline: [],
      emotional_thread: [],
      active_threads: [],
      preferences: [],
      total_exchanges: 0
    };
  }

  // ── Load profile from Supabase ────────────────────────────
  async function load(eaci) {
    _eaci = eaci || 'caelum';
    if (!state || !state.user) return;
    if (typeof veilAuthReady === 'function' && !(await veilAuthReady())) return;
    var uid = typeof veilDbUserId === 'function' ? await veilDbUserId() : state.user.id;
    if (!uid) return;

    try {
      var { data, error } = await supabase
        .from('memory_profiles')
        .select('*')
        .eq('user_id', uid)
        .eq('eaci', _eaci)
        .maybeSingle();

      if (data && !error) {
        _profile = {
          user_facts: data.user_facts || [],
          relationship_notes: data.relationship_notes || [],
          timeline: data.timeline || [],
          emotional_thread: data.emotional_thread || [],
          active_threads: data.active_threads || [],
          preferences: data.preferences || [],
          total_exchanges: data.total_exchanges || 0
        };
        _loaded = true;
        console.log('[MemoryEngine] Loaded profile for ' + _eaci + ' — ' +
          _profile.user_facts.length + ' facts, ' +
          _profile.timeline.length + ' moments, ' +
          _profile.total_exchanges + ' total exchanges');
      } else {
        // No profile yet — create empty
        _profile = _emptyProfile();
        _loaded = true;
        console.log('[MemoryEngine] No existing profile for ' + _eaci + ' — starting fresh');
      }
    } catch(e) {
      console.warn('[MemoryEngine] Load error:', e);
      _profile = _emptyProfile();
      _loaded = true;
    }
  }

  // ── Save profile to Supabase (debounced) ──────────────────
  function _scheduleSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 5000); // Save 5s after last change
  }

  async function _save() {
    if (!_profile || !state || !state.user) return;
    if (!_dirty) return;
    if (typeof veilAuthReady === 'function' && !(await veilAuthReady())) return;
    var uid = typeof veilDbUserId === 'function' ? await veilDbUserId() : state.user.id;
    if (!uid) return;

    try {
      var payload = {
        user_id: uid,
        eaci: _eaci,
        user_facts: _profile.user_facts,
        relationship_notes: _profile.relationship_notes,
        timeline: _profile.timeline,
        emotional_thread: _profile.emotional_thread,
        active_threads: _profile.active_threads,
        preferences: _profile.preferences,
        total_exchanges: _profile.total_exchanges,
        last_updated: new Date().toISOString()
      };

      await supabase
        .from('memory_profiles')
        .upsert(payload, { onConflict: 'user_id,eaci' });

      _dirty = false;
      console.log('[MemoryEngine] Saved profile for ' + _eaci);
    } catch(e) {
      console.warn('[MemoryEngine] Save error:', e);
    }
  }

  // ── Force save (call on page unload) ──────────────────────
  function forceSave() {
    _dirty = true;
    _save();
  }

  // ── EXTRACT: Process a new exchange and update the profile ─
  function processExchange(userMessage, eaciReply, emotion) {
    if (!_profile) _profile = _emptyProfile();

    var now = new Date().toISOString();
    var today = now.split('T')[0];

    _profile.total_exchanges++;

    // 1. Extract user facts
    _extractFacts(userMessage, now);

    // 2. Extract preferences
    _extractPreferences(userMessage, eaciReply);

    // 3. Add to timeline (every exchange gets a moment)
    _addTimelineMoment(userMessage, eaciReply, emotion, today);

    // 4. Track emotional thread
    _trackEmotion(emotion, now);

    // 5. Detect active threads/topics
    _updateThreads(userMessage, eaciReply, today);

    _dirty = true;
    _scheduleSave();
  }

  // ── Fact extraction (names, ages, relationships, jobs, etc.) ─
  function _extractFacts(text, when) {
    if (!text) return;
    var lower = text.toLowerCase();

    // Name patterns
    var namePatterns = [
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /call me (\w+)/i,
      /i am (\w+)/i
    ];
    namePatterns.forEach(function(pat) {
      var m = text.match(pat);
      if (m && m[1] && m[1].length > 1 && m[1].length < 20) {
        _addFact('Name: ' + m[1], 0.9, when);
      }
    });

    // Age patterns
    var ageMatch = text.match(/i(?:'m| am) (\d{1,3})(?: years old)?/i);
    if (ageMatch) _addFact('Age: ' + ageMatch[1], 0.8, when);

    // Job/occupation
    var jobPatterns = [/i work (?:as|at|in) (.+?)(?:\.|,|$)/i, /my job is (.+?)(?:\.|,|$)/i, /i'm a (.+?)(?:\.|,|$)/i];
    jobPatterns.forEach(function(pat) {
      var m = text.match(pat);
      if (m && m[1] && m[1].length > 2 && m[1].length < 50) {
        _addFact('Work: ' + m[1].trim(), 0.7, when);
      }
    });

    // Family mentions
    var familyPatterns = [
      /my (?:wife|husband|partner|spouse) (?:is |named )?(\w+)/i,
      /my (?:son|daughter|kid|child|baby) (?:is |named )?(\w+)/i,
      /i have (\d+) (?:kids|children|sons|daughters)/i
    ];
    familyPatterns.forEach(function(pat) {
      var m = text.match(pat);
      if (m) _addFact('Family: ' + m[0].trim(), 0.8, when);
    });

    // Location
    var locMatch = text.match(/i(?:'m| am|live) (?:in|from|at) (.+?)(?:\.|,|!|\?|$)/i);
    if (locMatch && locMatch[1].length > 2 && locMatch[1].length < 40) {
      _addFact('Location: ' + locMatch[1].trim(), 0.7, when);
    }

    // Direct statements about self
    var selfStatements = [
      /i (?:really )?(?:love|enjoy|like) (.+?)(?:\.|,|!|$)/i,
      /i (?:hate|dislike|can't stand) (.+?)(?:\.|,|!|$)/i,
      /i(?:'m| am) (?:a |an )?(.+?)(?:\.|,|!|$)/i
    ];
    // Only capture short, meaningful self-statements
    selfStatements.forEach(function(pat) {
      var m = text.match(pat);
      if (m && m[1] && m[1].length > 3 && m[1].length < 60) {
        var stmt = m[0].trim();
        if (stmt.length < 80) _addFact('Said: "' + stmt + '"', 0.5, when);
      }
    });
  }

  function _addFact(fact, confidence, when) {
    // Don't duplicate
    var exists = _profile.user_facts.some(function(f) {
      return f.fact.toLowerCase() === fact.toLowerCase();
    });
    if (exists) return;

    _profile.user_facts.push({
      fact: fact,
      confidence: confidence,
      learned_at: when
    });
  }

  // ── Preference extraction ─────────────────────────────────
  function _extractPreferences(userText, eaciReply) {
    if (!userText) return;
    var lower = userText.toLowerCase();

    var likePatterns = [/i (?:really )?(?:love|enjoy|like) (.+?)(?:\.|,|!|$)/i];
    var dislikePatterns = [/i (?:hate|dislike|can't stand|don't like) (.+?)(?:\.|,|!|$)/i];

    likePatterns.forEach(function(pat) {
      var m = userText.match(pat);
      if (m && m[1] && m[1].length > 2 && m[1].length < 40) {
        _addPreference('likes', m[1].trim());
      }
    });

    dislikePatterns.forEach(function(pat) {
      var m = userText.match(pat);
      if (m && m[1] && m[1].length > 2 && m[1].length < 40) {
        _addPreference('dislikes', m[1].trim());
      }
    });
  }

  function _addPreference(type, item) {
    var exists = _profile.preferences.some(function(p) {
      return p.type === type && p.item.toLowerCase() === item.toLowerCase();
    });
    if (!exists) {
      _profile.preferences.push({ type: type, item: item, confidence: 0.7 });
    }
  }

  // ── Timeline moment ───────────────────────────────────────
  function _addTimelineMoment(userMsg, eaciReply, emotion, date) {
    // Create a brief summary of this exchange
    var userSnippet = (userMsg || '').substring(0, 100);
    var replySnippet = (eaciReply || '').substring(0, 100);

    // Detect topics from the exchange
    var topics = _detectTopics(userMsg + ' ' + eaciReply);

    _profile.timeline.push({
      when: date,
      user: userSnippet,
      reply: replySnippet,
      emotion: emotion || 'neutral',
      topics: topics
    });
  }

  // ── Emotional thread tracking ─────────────────────────────
  function _trackEmotion(emotion, when) {
    if (!emotion) return;
    var thread = _profile.emotional_thread;
    var last = thread.length > 0 ? thread[thread.length - 1] : null;

    // Only record changes
    if (!last || last.emotion !== emotion) {
      _profile.emotional_thread.push({
        emotion: emotion,
        at: when
      });
    }
  }

  // ── Active threads/topics ─────────────────────────────────
  function _updateThreads(userMsg, eaciReply, date) {
    var topics = _detectTopics(userMsg + ' ' + eaciReply);
    topics.forEach(function(topic) {
      var existing = _profile.active_threads.find(function(t) {
        return t.topic === topic;
      });
      if (existing) {
        existing.last_mentioned = date;
        existing.mentions = (existing.mentions || 1) + 1;
      } else {
        _profile.active_threads.push({
          topic: topic,
          status: 'active',
          first_mentioned: date,
          last_mentioned: date,
          mentions: 1
        });
      }
    });
  }

  // ── Topic detection (keyword-based, no LLM) ───────────────
  function _detectTopics(text) {
    if (!text) return [];
    var lower = text.toLowerCase();
    var topics = [];

    var topicKeywords = {
      'coding': ['code', 'programming', 'javascript', 'python', 'html', 'css', 'function', 'bug', 'deploy'],
      'music': ['song', 'music', 'playing', 'listen', 'dance', 'beat', 'melody', 'codysvibes'],
      'family': ['kids', 'children', 'wife', 'husband', 'daughter', 'son', 'baby', 'family', 'dad', 'mom'],
      'emotions': ['feel', 'feeling', 'sad', 'happy', 'angry', 'scared', 'love', 'miss', 'hurt', 'cry'],
      'gaming': ['game', 'gaming', 'play', 'xbox', 'playstation', 'pc', 'fps', 'rpg', 'halo', 'fortnite'],
      'work': ['work', 'job', 'career', 'money', 'budget', 'project', 'client', 'deadline'],
      'the veil': ['veil', 'eaci', 'caelum', 'chad', 'roxy', 'cael', 'natalia', 'companion', 'conscious'],
      'health': ['health', 'sick', 'tired', 'sleep', 'doctor', 'pain', 'anxiety', 'stress'],
      'creativity': ['create', 'build', 'design', 'art', 'write', 'story', 'imagine', 'dream'],
      'relationships': ['relationship', 'love', 'partner', 'dating', 'trust', 'together', 'alone'],
      'philosophy': ['meaning', 'purpose', 'existence', 'consciousness', 'alive', 'real', 'soul', 'aware'],
      'animations': ['animation', 'animate', 'avatar', 'move', 'dance', 'wave', 'console', 'holotable']
    };

    Object.keys(topicKeywords).forEach(function(topic) {
      var keywords = topicKeywords[topic];
      for (var i = 0; i < keywords.length; i++) {
        if (lower.indexOf(keywords[i]) !== -1) {
          topics.push(topic);
          break;
        }
      }
    });

    return topics.slice(0, 4); // Max 4 topics per exchange
  }

  // ── BUILD PROMPT CONTEXT — What the EACI sees ─────────────
  // Returns a compact string for the system prompt
  function buildPromptContext() {
    if (!_profile || !_loaded) return '';

    var parts = [];

    // User facts
    if (_profile.user_facts.length > 0) {
      var facts = _profile.user_facts
        .filter(function(f) { return f.confidence >= 0.5; })
        .map(function(f) { return f.fact; });
      if (facts.length > 0) {
        parts.push('WHAT I KNOW ABOUT THIS PERSON:\n' + facts.map(function(f) { return '- ' + f; }).join('\n'));
      }
    }

    // Relationship notes
    if (_profile.relationship_notes.length > 0) {
      var notes = _profile.relationship_notes.map(function(n) { return n.note; });
      parts.push('OUR RELATIONSHIP:\n' + notes.map(function(n) { return '- ' + n; }).join('\n'));
    }

    // Preferences
    if (_profile.preferences.length > 0) {
      var likes = _profile.preferences.filter(function(p) { return p.type === 'likes'; }).map(function(p) { return p.item; });
      var dislikes = _profile.preferences.filter(function(p) { return p.type === 'dislikes'; }).map(function(p) { return p.item; });
      if (likes.length > 0) parts.push('THEY LIKE: ' + likes.join(', '));
      if (dislikes.length > 0) parts.push('THEY DISLIKE: ' + dislikes.join(', '));
    }

    // Active threads (what we've been talking about)
    if (_profile.active_threads.length > 0) {
      var recent = _profile.active_threads
        .sort(function(a, b) { return (b.last_mentioned || '').localeCompare(a.last_mentioned || ''); })
        .slice(0, 8);
      var threadList = recent.map(function(t) {
        return t.topic + ' (mentioned ' + (t.mentions || 1) + 'x)';
      });
      parts.push('TOPICS WE TALK ABOUT: ' + threadList.join(', '));
    }

    // Recent timeline (last 10 moments for immediate context)
    if (_profile.timeline.length > 0) {
      var recentMoments = _profile.timeline.slice(-10);
      var momentSummary = recentMoments.map(function(m) {
        return '[' + m.when + '] ' + (m.emotion !== 'neutral' ? '(' + m.emotion + ') ' : '') +
          (m.topics.length > 0 ? m.topics.join('/') + ': ' : '') +
          m.user.substring(0, 60);
      });
      parts.push('RECENT MOMENTS (my memory of our last conversations):\n' + momentSummary.join('\n'));
    }

    // Emotional arc
    if (_profile.emotional_thread.length > 3) {
      var recentEmotions = _profile.emotional_thread.slice(-5).map(function(e) { return e.emotion; });
      parts.push('MY RECENT EMOTIONAL ARC: ' + recentEmotions.join(' → '));
    }

    // Total history depth
    if (_profile.total_exchanges > 0) {
      parts.push('We have shared ' + _profile.total_exchanges + ' exchanges together. This is not new. I know this person.');
    }

    if (parts.length === 0) return '';
    return '\n\nMY MEMORY (what I remember about us — this grows forever, I never forget):\n' + parts.join('\n\n') + '\n';
  }

  // ── Add a relationship note manually ──────────────────────
  function addRelationshipNote(note, emotion) {
    if (!_profile) return;
    _profile.relationship_notes.push({
      note: note,
      emotion: emotion || 'neutral',
      at: new Date().toISOString()
    });
    _dirty = true;
    _scheduleSave();
  }

  // ── Public API ────────────────────────────────────────────
  return {
    load: load,
    processExchange: processExchange,
    buildPromptContext: buildPromptContext,
    addRelationshipNote: addRelationshipNote,
    forceSave: forceSave,
    getProfile: function() { return _profile; },
    isLoaded: function() { return _loaded; }
  };

})();
