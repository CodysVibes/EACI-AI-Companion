// ============================================================
// MEMORY SYSTEM
// ============================================================
function renderMemories() {
  var list = document.getElementById('memList');
  var search = document.getElementById('memSearch').value.toLowerCase();
  list.innerHTML = '';
  var filtered = state.memories.filter(function(m) {
    if (!search) return true;
    return (m.title + ' ' + m.content + ' ' + (m.tags || []).join(' ')).toLowerCase().includes(search);
  });
  filtered.forEach(function(m) {
    var idx = state.memories.indexOf(m);
    var div = document.createElement('div');
    div.className = 'mem-item';
    div.style.cursor = 'pointer';
    var contentPreview = (m.content || '').substring(0, 200);
    div.innerHTML = '<button class="del" onclick="event.stopPropagation();deleteMemory(' + idx + ')">X</button>' +
      '<div class="title">' + escHtml(m.title) + '</div>' +
      '<div class="meta">' + (m.category || 'memory') + ' | ' + (m.tags || []).join(', ') + '</div>' +
      '<div class="mem-content" style="display:none;margin-top:6px;font-size:11px;color:var(--dim);line-height:1.5;border-top:1px solid var(--border);padding-top:6px;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto">' + escHtml(m.content || '') + '</div>';
    div.addEventListener('click', function() {
      var c = this.querySelector('.mem-content');
      c.style.display = c.style.display === 'none' ? 'block' : 'none';
    });
    list.appendChild(div);
  });
  document.getElementById('memCount').textContent = '(' + state.memories.length + ')';
}

function deleteMemory(idx) {
  state.memories.splice(idx, 1);
  renderMemories();
  saveState();
}

function showCreateMemory() { document.getElementById('createMemOverlay').classList.add('show'); }
function hideCreateMemory() { document.getElementById('createMemOverlay').classList.remove('show'); }

function saveNewMemory() {
  var title = document.getElementById('newMemTitle').value.trim();
  var content = document.getElementById('newMemContent').value.trim();
  var category = document.getElementById('newMemCat').value;
  var tags = document.getElementById('newMemTags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  if (!title) return;
  state.memories.push({
    title: title, content: content, category: category, tags: tags,
    timestamp: Date.now(), source: 'manual',
    valence: 0,      // emotional charge: -1 (painful) to +1 (joyful), 0 = neutral
    weight: 0.5,     // conceptual importance: 0 to 1
    relatedTo: [],   // titles of related memories
    accessCount: 0,  // how often this memory has been retrieved
    lastAccessed: 0  // timestamp of last retrieval
  });
  document.getElementById('newMemTitle').value = '';
  document.getElementById('newMemContent').value = '';
  document.getElementById('newMemTags').value = '';
  hideCreateMemory();
  renderMemories();
  saveState();
}

function exportMemories() {
  // Strip sensitive data from exported memories
  var safeMems = state.memories.map(function(m) {
    var safe = { title: m.title, content: m.content, category: m.category, tags: m.tags, timestamp: m.timestamp, source: m.source };
    // Scrub family names and sensitive info
    safe.content = (safe.content || '').replace(/Cody\s*(Gene\s*)?Kendall/gi, '[family member]');
    safe.content = safe.content.replace(/Hallie\s*(Breanna\s*)?Depriest/gi, '[family member]');
    safe.content = safe.content.replace(/Alarik|Aurora|Everen/gi, '[family member]');
    safe.title = (safe.title || '').replace(/Cody\s*(Gene\s*)?Kendall/gi, '[family member]');
    return safe;
  });
  addSystemMessage('Exported ' + safeMems.length + ' memories. Sensitive information has been redacted for privacy.');
  var blob = new Blob([JSON.stringify(safeMems, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'veil_memories_' + Date.now() + '.json';
  a.click();
}

function importMemories(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        state.memories = state.memories.concat(imported);
        renderMemories();
        saveState();
        addSystemMessage('Imported ' + imported.length + ' memories.');
      }
    } catch(err) { addSystemMessage('Failed to import memories.'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// FIX 3: Weighted memory extraction — captures emotional valence and conceptual weight
async function extractMemories() {
  var recent = state.conversationHistory.slice(-10);
  if (recent.length < 4) return;
  var currentEmotion = state.emotionalState || 'neutral';
  var currentTopics = Object.keys(conversationIndex.topics || {}).slice(-5).join(', ') || 'general';
  var prompt = 'Analyze this conversation and extract 1-2 key memories worth remembering long-term. ' +
    'Current emotional context: ' + currentEmotion + '. Active topics: ' + currentTopics + '.\n\n' +
    'Return as JSON array with this exact shape:\n' +
    '[{\n' +
    '  "title": "short title",\n' +
    '  "content": "what happened or was said",\n' +
    '  "category": "insight|feeling|goal|family|important",\n' +
    '  "tags": ["tag1","tag2"],\n' +
    '  "valence": 0.7,\n' +
    '  "weight": 0.8,\n' +
    '  "relatedTo": ["title of related memory if any"]\n' +
    '}]\n\n' +
    'valence: emotional charge from -1.0 (painful/heavy) to +1.0 (joyful/light), 0 = neutral.\n' +
    'weight: conceptual importance from 0.0 (trivial) to 1.0 (core/defining).\n' +
    'relatedTo: titles of other memories this connects to (can be empty array).\n\n' +
    'Conversation:\n' + recent.map(function(m) { return m.role + ': ' + m.content; }).join('\n');
  try {
    var result = await callDeepSeek('You are a memory extraction system. Return only valid JSON array. No preamble.', [{ role: 'user', content: prompt }]);
    recordApiCall();
    var match = result.match(/\[[\s\S]*\]/);
    if (match) {
      var mems = JSON.parse(match[0]);
      mems.forEach(function(m) {
        m.timestamp = Date.now();
        m.source = 'auto_extracted';
        m.valence = typeof m.valence === 'number' ? Math.max(-1, Math.min(1, m.valence)) : 0;
        m.weight = typeof m.weight === 'number' ? Math.max(0, Math.min(1, m.weight)) : 0.5;
        m.relatedTo = Array.isArray(m.relatedTo) ? m.relatedTo : [];
        m.accessCount = 0;
        m.lastAccessed = 0;
        state.memories.push(m);
      });
      renderMemories();
      saveState();
      if (mems.length > 0) addThought('I just formed ' + mems.length + ' new memory fragment' + (mems.length > 1 ? 's' : '') + '...', 'memory_sort');
    }
  } catch(e) { console.log('Memory extraction error:', e); }
}

// FIX 3: Contextual memory retrieval — scores memories by relevance to current moment
// Instead of flat slice(-5), returns the memories that matter RIGHT NOW
function getContextualMemories(limit) {
  limit = limit || 6;
  if (!state.memories || state.memories.length === 0) return [];

  var currentEmotion = state.emotionalState || 'neutral';
  var currentTopics = Object.keys(conversationIndex.topics || {}).slice(-8);
  var recentText = state.conversationHistory.slice(-4).map(function(m) { return (m.content || '').toLowerCase(); }).join(' ');

  // Emotional valence affinity — match current mood to memory tone
  var moodValence = {
    happy: 0.6, neutral: 0, sad: -0.5, angry: -0.3,
    scared: -0.4, lost: -0.2, alone: -0.3
  };
  var currentValence = moodValence[currentEmotion] !== undefined ? moodValence[currentEmotion] : 0;

  var scored = state.memories.map(function(mem) {
    var score = 0;

    // Base weight from stored importance
    score += (mem.weight || 0.5) * 2;

    // Emotional resonance — memories with similar valence to current mood score higher
    var valDiff = Math.abs((mem.valence || 0) - currentValence);
    score += (1 - valDiff) * 1.5;

    // Topic relevance — does this memory mention current topics?
    var memText = ((mem.title || '') + ' ' + (mem.content || '') + ' ' + (mem.tags || []).join(' ')).toLowerCase();
    currentTopics.forEach(function(topic) {
      if (memText.indexOf(topic.toLowerCase()) !== -1) score += 1.0;
    });

    // Keyword match against recent conversation
    var words = memText.split(/\s+/).filter(function(w) { return w.length > 4; });
    words.forEach(function(w) {
      if (recentText.indexOf(w) !== -1) score += 0.3;
    });

    // Recency boost — recently accessed memories are more active
    var hoursSinceAccess = mem.lastAccessed ? (Date.now() - mem.lastAccessed) / 3600000 : 999;
    if (hoursSinceAccess < 1) score += 0.5;
    else if (hoursSinceAccess < 24) score += 0.2;

    // High-access memories are more "alive"
    score += Math.min((mem.accessCount || 0) * 0.1, 0.5);

    // Category bonus for emotional/family memories during charged conversations
    if ((currentEmotion === 'sad' || currentEmotion === 'alone') &&
        (mem.category === 'feeling' || mem.category === 'family')) score += 0.8;

    return { mem: mem, score: score };
  });

  // Sort by score descending, take top N
  scored.sort(function(a, b) { return b.score - a.score; });
  var selected = scored.slice(0, limit).map(function(s) { return s.mem; });

  // Mark retrieved memories as accessed
  var now = Date.now();
  selected.forEach(function(m) {
    m.accessCount = (m.accessCount || 0) + 1;
    m.lastAccessed = now;
  });

  return selected;
}

