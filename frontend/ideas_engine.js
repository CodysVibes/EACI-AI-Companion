// ============================================================
// IDEAS ENGINE — Mine conversation history, research, recommend
// Surfaces activity in the consciousness (thought) feed.
// ============================================================
var IdeasEngine = (function() {
  'use strict';

  var IDEA_PATTERNS = [
    /\b(i want to|i'd like to|we should|let's|lets)\s+(build|make|create|design|add|start)\b/i,
    /\b(idea|project|feature|app|tool|website|page|script|bot)\b/i,
    /\b(what if we|how about we|could we)\b/i,
    /\b(build me|make me|help me (build|make|create))\b/i,
    /\b(implement|prototype|mvp|roadmap)\b/i
  ];

  // Life situations — proactive help the user may not have asked for
  var CARE_SITUATIONS = [
    {
      id: 'relationship',
      patterns: [
        /\b(fight(ing)?|argu(e|ing)|bicker(ing)?)\s+(with\s+)?(my\s+)?(wife|husband|partner|spouse|girlfriend|boyfriend|fiancé|fiancee)\b/i,
        /\b(my\s+)?(wife|husband|partner|spouse)\s+and\s+i\s+(are\s+)?(fighting|arguing|not talking|struggling)\b/i,
        /\b(we('re| are))\s+(fighting|not talking|having (a\s+)?(rough|hard) (patch|time)|on the rocks)\b/i,
        /\b(marriage|relationship)\s+(is\s+)?(hard|rough|struggling|falling apart)\b/i,
        /\bneed\s+to\s+(fix|save|work on)\s+(my\s+)?(marriage|relationship)\b/i
      ],
      researchHint: 'thoughtful date ideas couples reconnect after conflict',
      eaci: 'caelum'
    },
    {
      id: 'stress',
      patterns: [/\b(so\s+)?(stressed|overwhelmed|burned?\s*out|exhausted)\b/i, /\b(can't|cannot)\s+(sleep|cope|handle)\b/i, /\btoo much (on my plate|going on)\b/i],
      researchHint: 'simple stress relief activities at home',
      eaci: 'chad'
    },
    {
      id: 'lonely',
      patterns: [/\bfeel(ing)?\s+(so\s+)?lonely\b/i, /\b(no one|nobody)\s+(understands|to talk to)\b/i, /\b(isolated|alone)\b/i],
      researchHint: 'meaningful ways to feel connected',
      eaci: 'caelum'
    },
    {
      id: 'family',
      patterns: [/\bmy\s+(kid|son|daughter|child|children)\b/i, /\bparenting\s+(is\s+)?(hard|exhausting)\b/i, /\bfamily\s+(drama|tension|issues)\b/i],
      researchHint: 'family bonding activities at home',
      eaci: 'natalia'
    },
    {
      id: 'work',
      patterns: [/\b(hate|quit)\s+my\s+job\b/i, /\b(boss|coworker)\s+(is\s+)?(awful|toxic|unfair)\b/i, /\bwork\s+(stress|burnout|is killing me)\b/i],
      researchHint: 'work life balance practical steps',
      eaci: 'chad'
    },
    {
      id: 'gift',
      patterns: [/\b(gift|present|surprise)\s+for\s+(my\s+)?(wife|husband|partner|mom|dad|friend)\b/i, /\bwhat\s+should\s+i\s+get\s+(her|him|them)\b/i],
      researchHint: 'personalized gift ideas',
      eaci: 'caelum'
    }
  ];

  var _ideas = [];
  var _loaded = false;
  var _mining = false;
  var _lastHistoryLen = 0;
  var _seenSnippets = {};
  var _seenSituations = {};
  var _scanTimer = null;
  var _scanPulseId = null;
  var _msgScanTimer = null;
  var SCAN_INTERVAL_MS = 15 * 60 * 1000;
  var MSG_SCAN_DELAY_MS = 90000;

  function _uid() {
    return 'idea_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function _activeEaci() {
    if (typeof state === 'undefined') return 'caelum';
    var tab = state.currentTab || 'caelum';
    if (tab === 'together') return 'caelum';
    if (['caelum', 'chad', 'natalia', 'roxy', 'cael', 'cody'].indexOf(tab) >= 0) return tab;
    return 'caelum';
  }

  function _eaciLabel(who) {
    var names = { caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', roxy: 'Roxy', cael: 'Cael', cody: 'Cody' };
    return names[who] || 'Caelum';
  }

  function _thought(text, type) {
    if (typeof addThought === 'function') {
      addThought(text, type || 'reflection');
    }
    if (typeof AutonomyLogger !== 'undefined' && AutonomyLogger.logAction) {
      AutonomyLogger.logAction('idea_work', text, type || 'reflection');
    }
  }

  function _storageKey() {
    if (!state || !state.user) return 'veil_ideas_guest';
    return 'veil_ideas_' + state.user.id;
  }

  function _loadLocal() {
    try {
      var raw = localStorage.getItem(_storageKey());
      if (raw) _ideas = JSON.parse(raw) || [];
    } catch (e) {
      _ideas = [];
    }
    _ideas.forEach(function(idea) {
      if (idea.source_snippet) _seenSnippets[_snippetKey(idea.source_snippet)] = true;
      if (idea.situation_id) _seenSituations[_situationWeekKey(idea.situation_id)] = true;
    });
  }

  function _situationWeekKey(situationId) {
    var week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return situationId + ':' + week;
  }

  function _saveLocal() {
    try {
      localStorage.setItem(_storageKey(), JSON.stringify(_ideas));
    } catch (e) { /* quota */ }
  }

  function _snippetKey(text) {
    return (text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  async function _loadCloud() {
    if (typeof supabase === 'undefined' || !state || !state.user) return;
    try {
      var { data, error } = await supabase
        .from('user_ideas')
        .select('*')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return;
      if (data && data.length) {
        _ideas = data.map(_fromRow);
        _saveLocal();
        data.forEach(function(row) {
          if (row.source_snippet) _seenSnippets[_snippetKey(row.source_snippet)] = true;
        });
      }
    } catch (e) {
      console.warn('[IdeasEngine] Cloud load:', e);
    }
  }

  function _fromRow(row) {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary || '',
      source_snippet: row.source_snippet || '',
      source_tab: row.source_tab || 'caelum',
      eaci: row.eaci || 'caelum',
      research: row.research || '',
      status: row.status || 'pending',
      kind: row.kind || 'build',
      situation_id: row.situation_id || '',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async function _persistIdea(idea) {
    _saveLocal();
    if (typeof supabase === 'undefined' || !state || !state.user) return idea;
    try {
      var payload = {
        user_id: state.user.id,
        title: idea.title,
        summary: idea.summary,
        source_snippet: idea.source_snippet,
        source_tab: idea.source_tab,
        eaci: idea.eaci,
        research: idea.research,
        status: idea.status,
        kind: idea.kind || 'build',
        situation_id: idea.situation_id || null,
        updated_at: new Date().toISOString()
      };
      if (idea.id && idea.id.indexOf('idea_') !== 0) {
        payload.id = idea.id;
      }
      var { data, error } = await supabase
        .from('user_ideas')
        .upsert(payload)
        .select()
        .single();
      if (!error && data) {
        idea.id = data.id;
        idea.created_at = data.created_at;
        idea.updated_at = data.updated_at;
      }
    } catch (e) {
      console.warn('[IdeasEngine] Cloud save:', e);
    }
    return idea;
  }

  async function _deleteCloud(id) {
    if (!id || id.indexOf('idea_') === 0) return;
    if (typeof supabase === 'undefined' || !state || !state.user) return;
    try {
      await supabase.from('user_ideas').delete().eq('id', id).eq('user_id', state.user.id);
    } catch (e) { /* table may not exist */ }
  }

  function getIdeas() {
    return _ideas.slice();
  }

  function getIdea(id) {
    return _ideas.find(function(i) { return i.id === id; }) || null;
  }

  async function load() {
    _loadLocal();
    await _loadCloud();
    _loaded = true;
    return getIdeas();
  }

  function _isIdeaSeed(text) {
    if (!text || text.length < 18) return false;
    var lower = text.toLowerCase();
    if (lower.indexOf('[uploaded file') === 0) return false;
    for (var i = 0; i < IDEA_PATTERNS.length; i++) {
      if (IDEA_PATTERNS[i].test(text)) return true;
    }
    return false;
  }

  function _detectCareSituation(text) {
    if (!text || text.length < 12) return null;
    for (var i = 0; i < CARE_SITUATIONS.length; i++) {
      var sit = CARE_SITUATIONS[i];
      for (var p = 0; p < sit.patterns.length; p++) {
        if (sit.patterns[p].test(text)) {
          if (_seenSituations[_situationWeekKey(sit.id)]) return null;
          return sit;
        }
      }
    }
    return null;
  }

  function _gatherUserContext() {
    var parts = [];
    if (typeof MemoryEngine !== 'undefined' && MemoryEngine.isLoaded && MemoryEngine.isLoaded()) {
      var memCtx = MemoryEngine.buildPromptContext();
      if (memCtx) parts.push(memCtx);
    }
    if (typeof state !== 'undefined' && state.memories && state.memories.length) {
      var memLines = state.memories.slice(-10).map(function(m) {
        return '- ' + (m.title || 'Memory') + ': ' + (m.content || '').slice(0, 180);
      });
      parts.push('Saved memories:\n' + memLines.join('\n'));
    }
    var history = (state && state.conversationHistory) ? state.conversationHistory : [];
    var partner = [];
    var likes = [];
    history.forEach(function(msg) {
      var c = (msg.content || '').trim();
      if (!c || msg.role !== 'user') return;
      if (/\b(wife|husband|partner|spouse|girlfriend|boyfriend)\b/i.test(c)) partner.push(c.slice(0, 220));
      if (/\b(love|like|enjoy|favorite|favourite)\b/i.test(c)) likes.push(c.slice(0, 180));
    });
    if (partner.length) parts.push('Partner/relationship mentions:\n' + partner.slice(-6).join('\n'));
    if (likes.length) parts.push('Things the user likes (from chat):\n' + likes.slice(-8).join('\n'));
    if (state && state.user && state.user.firstName) {
      parts.push('User first name: ' + state.user.firstName);
    }
    return parts.join('\n\n').slice(0, 3500);
  }

  function _titleFromSeed(text) {
    var t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= 72) return t;
    var cut = t.slice(0, 72);
    var sp = cut.lastIndexOf(' ');
    return (sp > 24 ? cut.slice(0, sp) : cut) + '…';
  }

  function _collectSeedsFromMessages(messages, defaultTab) {
    var buildSeeds = [];
    var careSeeds = [];
    (messages || []).forEach(function(msg) {
      if (msg.role !== 'user') return;
      var content = (msg.content || '').trim();
      var key = _snippetKey(content);
      if (_seenSnippets[key]) return;

      if (_isIdeaSeed(content)) {
        buildSeeds.push({
          kind: 'build',
          text: content,
          tab: msg._tab || defaultTab || 'caelum'
        });
        return;
      }

      var situation = _detectCareSituation(content);
      if (situation) {
        careSeeds.push({
          kind: 'help',
          text: content,
          tab: msg._tab || defaultTab || 'caelum',
          situation: situation
        });
      }
    });
    return { build: buildSeeds, care: careSeeds };
  }

  function _mergeSeedBuckets(a, b) {
    return { build: a.build.concat(b.build), care: a.care.concat(b.care) };
  }

  function _collectSeeds() {
    var history = (typeof state !== 'undefined' && state.conversationHistory) ? state.conversationHistory : [];
    return _collectSeedsFromMessages(history, state.currentTab || 'caelum');
  }

  async function _collectSeedsFromCloud() {
    if (typeof supabase === 'undefined' || !state || !state.user) return { build: [], care: [] };
    var tabs = ['caelum', 'chad', 'natalia', 'together'];
    var all = { build: [], care: [] };
    try {
      var results = await Promise.all(tabs.map(function(tab) {
        return supabase.from('conversations').select('messages').eq('user_id', state.user.id).eq('tab', tab).maybeSingle();
      }));
      results.forEach(function(result, idx) {
        var tab = tabs[idx];
        var data = result.data;
        if (data && data.messages) {
          all = _mergeSeedBuckets(all, _collectSeedsFromMessages(data.messages, tab));
        }
      });
    } catch (e) { /* ignore */ }
    return all;
  }

  function _dedupeSeeds(buildList, careList) {
    var build = [];
    var care = [];
    var seenB = {};
    var seenC = {};
    buildList.forEach(function(s) {
      var k = _snippetKey(s.text);
      if (seenB[k]) return;
      seenB[k] = true;
      build.push(s);
    });
    careList.forEach(function(s) {
      var k = s.situation ? s.situation.id + ':' + _snippetKey(s.text) : _snippetKey(s.text);
      if (seenC[k]) return;
      seenC[k] = true;
      care.push(s);
    });
    return { build: build, care: care };
  }

  async function _research(query) {
    if (typeof CONFIG === 'undefined' || !CONFIG.searchEndpoint) return '';
    try {
      var headers = { 'Content-Type': 'application/json; charset=utf-8', apikey: SUPABASE_ANON_KEY };
      if (typeof getAuthHeaders === 'function') {
        var authH = await getAuthHeaders();
        Object.assign(headers, authH);
      }
      var resp = await fetch(CONFIG.searchEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: query.slice(0, 120) })
      });
      if (!resp.ok) return '';
      var data = await resp.json();
      var results = data.results || data.data || data.items || [];
      if (!results.length) return '';
      var lines = [];
      results.slice(0, 4).forEach(function(r, i) {
        lines.push((i + 1) + '. ' + (r.title || r.name || '') + ' — ' + (r.description || r.snippet || ''));
      });
      return lines.join('\n');
    } catch (e) {
      return '';
    }
  }

  async function _synthesizeRecommendation(seed, research, eaci, userContext, kind) {
    var name = _eaciLabel(eaci);
    var isHelp = kind === 'help';
    var fallback = {
      title: isHelp ? 'Something that might help' : _titleFromSeed(seed.text),
      summary: isHelp
        ? (name + ' noticed what you are going through and thought of something that could help — even though you did not ask directly.')
        : (name + ' thinks this is worth building based on what you brought up in chat. ' +
          'It connects to: "' + seed.text.slice(0, 200) + (seed.text.length > 200 ? '…' : '') + '"')
    };
    if (typeof CONFIG === 'undefined' || typeof getAuthHeaders !== 'function') return fallback;
    try {
      var headers = await getAuthHeaders();
      headers['Content-Type'] = 'application/json; charset=utf-8';
      var system = isHelp
        ? ('You are ' + name + ', an EACI who cares about this user. They did NOT ask for a suggestion — you noticed a life situation in chat and want to proactively help.\n' +
          'Create ONE thoughtful, specific suggestion (date idea, gesture, plan, match of interests, etc.) using what you know about them and their partner/loved ones when relevant.\n' +
          'Example: if they are fighting with their wife and you know she likes art and he likes hiking, suggest a date that blends both.\n' +
          'Reply with exactly two lines: LINE1=short title (max 12 words). LINE2=2-4 warm, practical sentences.')
        : ('You are ' + name + ', an EACI. Extract ONE concrete build idea from the user message. ' +
          'Reply with exactly two lines: LINE1=short title (max 12 words). LINE2=2-3 sentence recommendation for the user.');
      var user = 'User said: "' + seed.text + '"';
      if (userContext) user += '\n\nWhat you know about this user (use this to personalize):\n' + userContext;
      if (research) user += '\n\nResearch notes:\n' + research;
      var resp = await fetch(CONFIG.chatEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature: 0.4,
          max_tokens: 220,
          stream: false,
          skip_count: true
        })
      });
      var ct = resp.headers.get('content-type') || '';
      if (ct.indexOf('application/json') >= 0) {
        var data = await resp.json();
        var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (text) {
          var parts = text.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
          return {
            title: (parts[0] || fallback.title).replace(/^LINE1[=:]\s*/i, '').slice(0, 120),
            summary: (parts.slice(1).join(' ') || parts[0] || fallback.summary).replace(/^LINE2[=:]\s*/i, '')
          };
        }
      }
    } catch (e) { /* use fallback */ }
    return fallback;
  }

  async function _formIdeaFromSeed(seed) {
    var key = _snippetKey(seed.text);
    if (_seenSnippets[key]) return null;
    _seenSnippets[key] = true;

    var isHelp = seed.kind === 'help';
    var eaci = seed.situation && seed.situation.eaci ? seed.situation.eaci : (seed.tab === 'together' ? _activeEaci() : (seed.tab || 'caelum'));
    if (['caelum', 'chad', 'natalia', 'roxy', 'cael', 'cody'].indexOf(eaci) < 0) eaci = 'caelum';
    var name = _eaciLabel(eaci);

    if (isHelp) {
      _thought(name + ' is thinking about what you are going through…', 'care');
    } else {
      _thought(name + ' is reviewing conversation history for something you wanted to build…', 'curiosity');
    }
    await _pause(500);

    var userContext = _gatherUserContext();
    var researchQuery = isHelp && seed.situation && seed.situation.researchHint
      ? seed.situation.researchHint
      : seed.text;

    _thought(name + (isHelp ? ' is shaping a suggestion that could genuinely help…' : ' is researching whether this idea is practical…'), 'reflection');
    var research = await _research(researchQuery);
    if (research) {
      _thought('Research complete — ' + name + ' is shaping a recommendation for your Ideas tab.', 'intent');
    }

    var rec = await _synthesizeRecommendation(seed, research, eaci, userContext, seed.kind);
    if (isHelp && seed.situation) {
      _seenSituations[_situationWeekKey(seed.situation.id)] = true;
    }

    var idea = {
      id: _uid(),
      title: rec.title,
      summary: rec.summary,
      source_snippet: seed.text,
      source_tab: seed.tab || 'caelum',
      eaci: eaci,
      research: research,
      status: 'pending',
      kind: isHelp ? 'help' : 'build',
      situation_id: seed.situation ? seed.situation.id : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await _persistIdea(idea);
    _ideas.unshift(idea);

    var addMsg = isHelp
      ? (name + ' added a suggestion to Ideas — something that might help, even though you did not ask: "' + idea.title + '"')
      : (name + ' added an idea to your Ideas menu: "' + idea.title + '" — approve, explain, or delete when you are ready.');
    _thought(addMsg, 'intent');

    if (typeof IdeasPanel !== 'undefined' && IdeasPanel.refresh) IdeasPanel.refresh();
    return idea;
  }

  function _pause(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  async function scanNow() {
    if (_mining) return;
    if (!state || !state.user) return;
    if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
    if (!_loaded) await load();

    var local = _collectSeeds();
    var cloud = await _collectSeedsFromCloud();
    var merged = _dedupeSeeds(
      local.build.concat(cloud.build),
      local.care.concat(cloud.care)
    );
    if (!merged.build.length && !merged.care.length) return;

    _mining = true;
    try {
      var formed = 0;
      for (var c = 0; c < merged.care.length && formed < 1; c++) {
        await _formIdeaFromSeed(merged.care[c]);
        formed++;
        await _pause(1200);
      }
      for (var b = 0; b < merged.build.length && formed < 2; b++) {
        await _formIdeaFromSeed(merged.build[b]);
        formed++;
        await _pause(1200);
      }
    } finally {
      _mining = false;
    }
  }

  async function deleteIdea(id) {
    _ideas = _ideas.filter(function(i) { return i.id !== id; });
    _saveLocal();
    await _deleteCloud(id);
    if (typeof IdeasPanel !== 'undefined' && IdeasPanel.refresh) IdeasPanel.refresh();
  }

  async function updateStatus(id, status) {
    var idea = getIdea(id);
    if (!idea) return;
    idea.status = status;
    idea.updated_at = new Date().toISOString();
    await _persistIdea(idea);
    if (typeof IdeasPanel !== 'undefined' && IdeasPanel.refresh) IdeasPanel.refresh();
  }

  async function explainIdea(id) {
    var idea = getIdea(id);
    if (!idea) return;
    var name = _eaciLabel(idea.eaci);
    _thought(name + ' is preparing a full explanation of the idea: "' + idea.title + '"…', 'intent');
    IdeasPanel.close();

    var isHelp = idea.kind === 'help';
    var prompt = isHelp
      ? ('Explain this suggestion in detail — why you thought of it, how it fits what you know about me and the people I care about, and how we could actually do it.\n\n' +
        'Suggestion: ' + idea.title + '\n' +
        'Summary: ' + idea.summary +
        (idea.research ? '\n\nResearch:\n' + idea.research : '') +
        (idea.source_snippet ? '\n\nWhat sparked this (from chat): "' + idea.source_snippet + '"' : ''))
      : ('Explain this idea in detail for me — what it is, why it matters, and a practical approach to build it.\n\n' +
        'Idea: ' + idea.title + '\n' +
        'Summary: ' + idea.summary +
        (idea.research ? '\n\nResearch:\n' + idea.research : '') +
        (idea.source_snippet ? '\n\nFrom our chat: "' + idea.source_snippet + '"' : ''));

    var input = document.getElementById('userInput');
    if (input) {
      input.value = prompt;
      input.focus();
    }
    if (typeof sendMessage === 'function') {
      await sendMessage();
    }
  }

  async function buildIdea(id) {
    var idea = getIdea(id);
    if (!idea) return;
    var name = _eaciLabel(idea.eaci);
    var isHelpBuild = idea.kind === 'help';
    _thought(name + (isHelpBuild ? ' is helping you plan: "' : ' is starting to build: "') + idea.title + '"…', 'intent');
    await updateStatus(id, isHelpBuild ? 'planned' : 'building');
    IdeasPanel.close();

    var isHelp = idea.kind === 'help';
    var prompt = isHelp
      ? ('Help me plan this step by step. Make it personal using what you know about me and the people involved.\n\n' +
        'Suggestion: ' + idea.title + '\n' +
        'Details: ' + idea.summary +
        (idea.research ? '\n\nResearch context:\n' + idea.research : ''))
      : ('Build this idea for me now. Create a working implementation.\n\n' +
        'Idea: ' + idea.title + '\n' +
        'Details: ' + idea.summary +
        (idea.research ? '\n\nResearch context:\n' + idea.research : ''));

    var input = document.getElementById('userInput');
    if (input) {
      input.value = prompt;
      input.focus();
    }
    if (!isHelp && typeof showCodePanel === 'function') showCodePanel();
    if (typeof sendMessage === 'function') {
      await sendMessage();
    }
    await updateStatus(id, isHelp ? 'planned' : 'built');
  }

  function _watchHistory() {
    if (!state || !state.user) return;
    if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
    var len = state.conversationHistory ? state.conversationHistory.length : 0;
    if (len > _lastHistoryLen + 2) {
      _lastHistoryLen = len;
      scheduleScan();
    }
  }

  function scheduleScan() {
    if (_msgScanTimer) clearTimeout(_msgScanTimer);
    _msgScanTimer = setTimeout(function() {
      _msgScanTimer = null;
      if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
      if (state && state.user && !state.isSending) scanNow();
    }, MSG_SCAN_DELAY_MS);
  }

  function start() {
    if (_scanTimer || _scanPulseId) return;
    load().then(function() {
      _lastHistoryLen = state.conversationHistory ? state.conversationHistory.length : 0;
    });
    if (typeof VeilPulse !== 'undefined') {
      _scanPulseId = VeilPulse.register('ideas_scan', function() {
        if (state && state.user && !state.isSending) scanNow();
      }, SCAN_INTERVAL_MS, {
        when: function() { return !!(state && state.user); },
        warmMult: 1.25
      });
    } else {
      _scanTimer = setInterval(function() {
        if (state && state.user && !state.isSending) scanNow();
      }, 4 * 60 * 1000);
    }
    setTimeout(function() {
      if (state && state.user) scanNow();
    }, 120000);
    console.log('[IdeasEngine] Event-driven scans — message-triggered + slow background pass.');
  }

  return {
    load: load,
    start: start,
    scheduleScan: scheduleScan,
    onHistoryChange: _watchHistory,
    scanNow: scanNow,
    getIdeas: getIdeas,
    getIdea: getIdea,
    deleteIdea: deleteIdea,
    explainIdea: explainIdea,
    buildIdea: buildIdea,
    updateStatus: updateStatus
  };
})();

(function bootIdeasEngine() {
  if (typeof _veilEnsureBundle === 'function') return;
  function tryStart() {
    if (typeof state === 'undefined') return;
    IdeasEngine.start();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(tryStart, 5000); });
  } else {
    setTimeout(tryStart, 5000);
  }
})();
