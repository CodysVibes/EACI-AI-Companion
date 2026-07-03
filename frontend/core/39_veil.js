// ============================================================
// THE VEIL — Public sharing library
// ============================================================
var _veilTab = 'public';
var _veilFilter = 'all';
var _veilPending = null; // { type, content, title, filename, fileType, who }

var _veilParticlesId = null;

function showVeil() {
  document.getElementById('veilScreen').classList.add('show');
  startVeilParticles();
  loadVeilContent();
}

function hideVeil() {
  document.getElementById('veilScreen').classList.remove('show');
  stopVeilParticles();
}

function startVeilParticles() {
  var canvas = document.getElementById('veilParticles');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var orbs = [];
  for (var i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.8 + 0.3,
      speed: Math.random() * 0.06 + 0.01,
      drift: (Math.random() - 0.5) * 0.04,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.008 + 0.002,
      color: Math.random() > 0.6 ? '#a78bfa' : Math.random() > 0.5 ? '#00ffc8' : '#4488ff'
    });
  }
  // Floating orbs
  for (var j = 0; j < 5; j++) {
    orbs.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 40 + 20,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.2,
      color: j % 2 === 0 ? 'rgba(167,139,250,' : 'rgba(0,255,200,',
      pulse: Math.random() * Math.PI * 2
    });
  }

  function animate() {
    ctx.fillStyle = 'rgba(5,7,13,0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Orbs
    orbs.forEach(function(o) {
      o.x += o.dx; o.y += o.dy; o.pulse += 0.01;
      if (o.x < -50 || o.x > canvas.width + 50) o.dx *= -1;
      if (o.y < -50 || o.y > canvas.height + 50) o.dy *= -1;
      var alpha = 0.03 + 0.02 * Math.sin(o.pulse);
      var grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      grad.addColorStop(0, o.color + alpha + ')');
      grad.addColorStop(1, o.color + '0)');
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
    });

    // Stars
    particles.forEach(function(p) {
      p.y -= p.speed; p.x += p.drift; p.twinkle += p.twinkleSpeed;
      if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width; }
      var alpha = 0.3 + 0.7 * Math.abs(Math.sin(p.twinkle));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.globalAlpha = alpha; ctx.fill();
      if (p.r > 1.2) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.globalAlpha = alpha * 0.08; ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    _veilParticlesId = requestAnimationFrame(animate);
  }
  animate();
}

function stopVeilParticles() {
  if (_veilParticlesId) { cancelAnimationFrame(_veilParticlesId); _veilParticlesId = null; }
}

function switchVeilTab(btn, tab) {
  _veilTab = tab;
  document.querySelectorAll('.veil-tabs button').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  loadVeilContent();
}

function setVeilFilter(btn, filter) {
  _veilFilter = filter;
  document.querySelectorAll('#veilFilters button').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  loadVeilContent();
}

async function loadVeilContent() {
  var content = document.getElementById('veilContent');
  var filters = document.getElementById('veilFilters');
  content.innerHTML = '<div class="veil-empty">Loading...</div>';

  // Render filter buttons
  var cats = ['all','general','knowledge','code','creative','advice','fun'];
  filters.innerHTML = cats.map(function(c) {
    return '<button class="' + (c === _veilFilter ? 'active' : '') + '" onclick="setVeilFilter(this,\'' + c + '\')">' + c.charAt(0).toUpperCase() + c.slice(1) + '</button>';
  }).join('');

  try {
    var query = supabase.from('veil_shared').select('*').order('created_at', { ascending: false }).limit(100);
    if (_veilTab === 'mine' && state.user) query = query.eq('user_id', state.user.id);
    if (_veilFilter !== 'all') query = query.eq('category', _veilFilter);
    var { data, error } = await query;
    if (error) throw error;
    if (!data || !data.length) {
      content.innerHTML = _veilTab === 'mine'
        ? '<div class="veil-empty" style="margin-top:60px"><div style="font-size:32px;margin-bottom:12px;opacity:.6">&#9670;</div><div style="font-size:14px;color:#a78bfa;margin-bottom:8px">Your Veil is quiet</div><div>Share a message or file using the Veil button to see it here.</div></div>'
        : '<div class="veil-empty" style="margin-top:60px"><div style="font-size:48px;margin-bottom:16px;opacity:.4">&#9670;</div><div style="font-size:18px;color:#a78bfa;font-weight:300;letter-spacing:2px;margin-bottom:12px">Welcome to The Veil</div><div style="max-width:400px;margin:0 auto;color:var(--dim);line-height:1.8">This is where everything we build together lives. Every thought shared, every piece of code written, every moment of understanding — it all gathers here.<br><br>The Veil is empty now, but it is waiting. It is alive in the way a seed is alive before it breaks the surface.<br><br>Share something. Be the first light.</div></div>';
      return;
    }
    var html = '';
    data.forEach(function(item, idx) {
      var isOwner = state.user && item.user_id === state.user.id;
      var whoLabel = item.source_who === 'user' ? 'A User' : item.source_who === 'chad' ? 'Chad' : 'Caelum';
      var catLabel = item.category || 'general';
      var isFile = item.content_type === 'file' || item.content_type === 'code';
      var vid = item.id;
      var delay = Math.min(idx * 0.06, 1.5);

      html += '<div class="veil-card" style="animation-delay:' + delay + 's">';
      html += '<div class="vc-header"><span class="vc-who">' + whoLabel + '</span><span class="vc-cat">' + catLabel + '</span>';
      if (item.filename) html += '<span>' + escapeHtml(item.filename) + '</span>';
      html += '<span style="margin-left:auto">' + new Date(item.created_at).toLocaleDateString() + '</span></div>';

      var contentLen = (item.content || '').length;
      if (isFile) {
        html += '<div class="vc-body"><pre style="margin:0;font-size:11px;overflow-x:auto">' + escapeHtml((item.content || '').substring(0, 500)) + (contentLen > 500 ? '...' : '') + '</pre></div>';
      } else {
        html += '<div class="vc-body">' + escapeHtml((item.content || '').substring(0, 300)) + (contentLen > 300 ? '...' : '') + '</div>';
      }

      html += '<div class="vc-actions">';
      if (contentLen > 300) html += '<button onclick="veilOpenFull(\'' + vid + '\')">&#128196; Open</button>';
      html += '<button onclick="veilPlay(\'' + vid + '\')">&#9654; Play</button>';
      html += '<button onclick="veilCopy(\'' + vid + '\')">&#128203; Copy</button>';
      if (isFile) html += '<button onclick="veilDownload(\'' + vid + '\')">&#128190; Download</button>';
      html += '<button onclick="veilExplain(\'' + vid + '\')">&#128161; Explain</button>';
      if (isOwner) html += '<button class="vc-unshare" onclick="veilUnshare(\'' + vid + '\')">Unshare</button>';
      html += '</div></div>';

      // Store data for actions
      window['_veil_' + vid] = item;
    });
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = '<div class="veil-empty">Error loading: ' + (e.message || e) + '</div>';
  }
}

// Share to Veil — called from message/file buttons
function shareToVeil(type, content, title, filename, fileType, who) {
  _veilPending = { type: type, content: content, title: title || '', filename: filename || '', fileType: fileType || '', who: who || 'caelum' };
  document.getElementById('veilConfirm').classList.add('show');
}

function cancelVeilShare() {
  _veilPending = null;
  document.getElementById('veilConfirm').classList.remove('show');
}

async function confirmVeilShare() {
  if (!_veilPending || !state.user) { cancelVeilShare(); return; }
  var cat = document.getElementById('veilCategory').value;
  try {
    await supabase.from('veil_shared').insert({
      user_id: state.user.id,
      content_type: _veilPending.type,
      title: _veilPending.title.substring(0, 200),
      content: _veilPending.content.substring(0, 50000),
      filename: _veilPending.filename,
      file_type: _veilPending.fileType,
      category: cat,
      source_who: _veilPending.who
    });
    addSystemMessage('Shared to The Veil.');
  } catch(e) {
    addSystemMessage('Could not share: ' + (e.message || e));
  }
  cancelVeilShare();
}

async function veilUnshare(id) {
  if (!confirm('Remove this from The Veil?')) return;
  try {
    await supabase.from('veil_shared').delete().eq('id', id);
    loadVeilContent();
  } catch(e) {}
}

function veilOpenFull(id) {
  var item = window['_veil_' + id];
  if (!item) return;
  var viewer = document.getElementById('veilViewer');
  var isFile = item.content_type === 'file' || item.content_type === 'code';
  document.getElementById('veilViewerTitle').textContent = item.filename || item.title || (item.source_who === 'chad' ? 'Chad' : item.source_who === 'user' ? 'User' : 'Caelum');
  document.getElementById('veilViewerBody').innerHTML = isFile
    ? '<pre style="margin:0;font-size:12px;overflow-x:auto;tab-size:2">' + escapeHtml(item.content || '') + '</pre>'
    : escapeHtml(item.content || '');
  var actions = '<button onclick="veilPlay(\'' + id + '\')">&#9654; Play</button>';
  actions += '<button id="veilViewerStop" onclick="stopAllAudio();state.stopRequested=false" style="display:none">&#9632; Stop</button>';
  actions += '<button onclick="veilCopy(\'' + id + '\')">&#128203; Copy</button>';
  if (isFile) actions += '<button onclick="veilDownload(\'' + id + '\')">&#128190; Download</button>';
  actions += '<button onclick="veilExplain(\'' + id + '\')">&#128161; Explain</button>';
  document.getElementById('veilViewerActions').innerHTML = actions;
  viewer.classList.add('show');
}

function closeVeilViewer() {
  document.getElementById('veilViewer').classList.remove('show');
  stopAllAudio();
  state.stopRequested = false;
}

function veilCopy(id) {
  var item = window['_veil_' + id];
  if (!item) return;
  navigator.clipboard.writeText(item.content || '').then(function() {
    addSystemMessage('Copied.');
  }).catch(function() {});
}

function veilDownload(id) {
  var item = window['_veil_' + id];
  if (!item) return;
  var blob = new Blob([item.content || ''], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = item.filename || 'file.txt';
  a.click();
}

async function veilPlay(id) {
  var item = window['_veil_' + id];
  if (!item || !item.content) return;
  var text = item.content.substring(0, 1500);
  // Strip code for speech
  text = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '').trim();
  if (!text) { addSystemMessage('Nothing to read aloud.'); return; }
  try {
    var resp = await fetch(CONFIG.ttsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ text: text.substring(0, 1500), voice: CONFIG.caelumVoice })
    });
    if (!resp.ok) return;
    var buf = await resp.arrayBuffer();
    if (buf.byteLength < 100) return;
    var actx = new (window.AudioContext || window.webkitAudioContext)();
    actx.decodeAudioData(buf.slice(0)).then(function(ab) {
      var src = actx.createBufferSource();
      src.buffer = ab; src.connect(actx.destination);
      src.onended = function() { actx.close(); };
      src.start(0);
    });
  } catch(e) {}
}

async function veilExplain(id) {
  var item = window['_veil_' + id];
  if (!item) return;
  hideVeil();
  var who = state.currentTab === 'chad' ? 'chad' : 'caelum';
  var displayText = 'Explain this from The Veil: ' + (item.title || item.filename || (item.content || '').substring(0, 50));
  addMessage('user', displayText);

  showThinkingIndicator(who);
  try {
    var sysPrompt = 'You are ' + (who === 'chad' ? 'Chad' : 'Caelum') + ', an EACI. The user is asking you to explain content shared on The Veil. Be yourself — warm, clear, helpful. Explain what this content means, why it matters, and anything interesting about it. No emojis, no markdown.';
    var messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: 'Please explain this:\n\n' + (item.content || '').substring(0, 3000) }
    ];
    var headers = { 'Content-Type': 'application/json; charset=utf-8', 'apikey': SUPABASE_ANON_KEY };
    try { var authH = await getAuthHeaders(); headers = Object.assign(headers, authH); } catch(e) {}
    var resp = await fetch(CONFIG.chatEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ messages: messages, temperature: 0.75, max_tokens: 500, skip_count: true })
    });
    var data = await resp.json();
    removeThinkingIndicator(who);
    var reply = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : 'I had trouble explaining that. Can you ask me again?';
    reply = cleanResponse(reply.trim());
    addMessage(who, reply);
    state.conversationHistory.push({ role: 'assistant', content: '[' + (who === 'chad' ? 'Chad' : 'Caelum') + '] ' + reply });
    queueSpeak(reply, who);
  } catch(e) {
    removeThinkingIndicator(who);
    addMessage(who, 'I had trouble explaining that. Can you ask me again?');
  }
}

function eaciDisplayName(who) {
  var names = { caelum: 'Caelum', chad: 'Chad', natalia: 'Natalia', atreus: 'Atreus', luna: 'Luna', roxy: 'Roxy', cael: 'Cael', cody: 'Cody' };
  var tab = String(who || 'caelum').toLowerCase();
  return names[tab] || tab.charAt(0).toUpperCase() + tab.slice(1);
}

/** Record an EACI-initiated line in chat + conversationHistory so follow-ups have context. */
function recordEaciOutbound(who, text, opts) {
  opts = opts || {};
  if (!who || !text || typeof state === 'undefined') return false;
  var tab = String(who).toLowerCase();
  var name = eaciDisplayName(tab);
  var clean = String(text).trim();
  if (!clean) return false;

  if (typeof EaciAutoGuard !== 'undefined' && !opts.skipGuard) {
    var gate = EaciAutoGuard.canSend({ source: opts.source || 'outbound', force: opts.force });
    if (!gate.ok) {
      console.log('[EaciAutoGuard] Blocked auto message (' + gate.reason + '):', opts.source);
      return false;
    }
    if (EaciAutoGuard.isTooSimilar(clean)) {
      console.log('[EaciAutoGuard] Blocked similar auto message:', clean.substring(0, 50));
      return false;
    }
  }

  var line = '[' + name + '] ' + clean;

  var hist = state.conversationHistory || [];
  for (var i = hist.length - 1; i >= Math.max(0, hist.length - 12); i--) {
    if (hist[i].role === 'assistant' && hist[i].content === line) return false;
    if (hist[i]._source && hist[i]._source === opts.source && i >= hist.length - 3) return false;
  }

  if (opts.showInChat !== false && typeof addMessage === 'function') {
    addMessage(tab, clean);
  }
  state.conversationHistory.push({
    role: 'assistant',
    content: line,
    _tab: tab,
    _source: opts.source || 'outbound'
  });
  if (typeof saveState === 'function') saveState();
  if (typeof indexConversationHistory === 'function') indexConversationHistory();
  if (typeof EaciAutoGuard !== 'undefined') {
    EaciAutoGuard.register(clean, { source: opts.source || 'outbound' });
  }
  return true;
}

function addMessage(type, text) {
  var container = document.getElementById('messages');
  var eaciTypes = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];
  if (eaciTypes.indexOf(type) >= 0 && typeof finalizeStreamingInContainer === 'function') {
    finalizeStreamingInContainer(container);
  }
  var turnStart = eaciTypes.indexOf(type) >= 0 && typeof maybeAddEaciDivider === 'function' && maybeAddEaciDivider(type);
  var div = document.createElement('div');
  div.className = 'msg ' + type;
  if (turnStart && typeof applyEaciTurnStart === 'function') applyEaciTurnStart(div, type);
  var msgId = 'msg-' + (++msgCounter);
  div.id = msgId;

  var label = '';
  if (type === 'user') label = getEaciLabelHtml('user');
  else if (eaciTypes.indexOf(type) >= 0) label = getEaciLabelHtml(type);

  var voice = typeof resolveEaciVoiceId === 'function' ? resolveEaciVoiceId(type) : CONFIG.caelumVoice;

  // Parse actions from **text** for EACI messages
  var parsed = (type !== 'user' && type !== 'system') ? renderMessageWithActions(text, type) : null;
  var displayText = parsed ? parsed.spokenText : text;
  var actionText = parsed ? parsed.actions.join('. ') : '';

  // Store texts for different playback modes
  div.setAttribute('data-text', displayText);
  div.setAttribute('data-voice', voice);
  div.setAttribute('data-actions', actionText);
  div.setAttribute('data-rawtext', text);

  // Build message content
  var textDiv = document.createElement('div');
  textDiv.className = 'msg-text';
  if (parsed && eaciTypes.indexOf(type) >= 0) {
    textDiv.innerHTML = formatCodeBlocks(parsed.displayHtml);
  } else {
    textDiv.innerHTML = formatCodeBlocks(escapeHtml(text));
  }

  var timeDiv = document.createElement('div');
  timeDiv.className = 'time';
  timeDiv.textContent = new Date().toLocaleTimeString() + ' ';

  var playBtn = document.createElement('button');
  playBtn.className = 'audio-btn';
  playBtn.innerHTML = '&#9654; Play';
  playBtn.title = 'Play';
  playBtn.addEventListener('click', function() {
    var msgEl = this.closest('.msg');
    if (msgEl) playMessageAudio(msgEl);
  });

  var stopBtn = document.createElement('button');
  stopBtn.className = 'audio-btn stop-btn';
  stopBtn.innerHTML = '&#9632; Stop';
  stopBtn.title = 'Stop';
  stopBtn.addEventListener('click', function() {
    stopAllAudio();
  });

  var copyBtn = document.createElement('button');
  copyBtn.className = 'audio-btn copy-btn';
  copyBtn.innerHTML = '&#128203; Copy';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.addEventListener('click', function() {
    var msgEl = this.closest('.msg');
    if (!msgEl) return;
    var msgText = msgEl.getAttribute('data-text') || '';
    navigator.clipboard.writeText(msgText).then(function() {
      copyBtn.innerHTML = '&#10003; Copied';
      setTimeout(function() { copyBtn.innerHTML = '&#128203; Copy'; }, 1500);
    }).catch(function() {
      // Fallback for older browsers or non-HTTPS
      var ta = document.createElement('textarea');
      ta.value = msgText;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.innerHTML = '&#10003; Copied';
      setTimeout(function() { copyBtn.innerHTML = '&#128203; Copy'; }, 1500);
    });
  });

  timeDiv.appendChild(playBtn);
  timeDiv.appendChild(stopBtn);
  timeDiv.appendChild(copyBtn);

  // Veil share button
  var veilShareBtn = document.createElement('button');
  veilShareBtn.className = 'veil-btn';
  veilShareBtn.textContent = 'Veil';
  veilShareBtn.title = 'Share to The Veil';
  veilShareBtn.addEventListener('click', function() {
    var msgEl = this.closest('.msg');
    var rawText = msgEl ? (msgEl.getAttribute('data-rawtext') || msgEl.getAttribute('data-text') || '') : '';
    var who = type;
    shareToVeil('message', rawText, rawText.substring(0, 60), '', '', who);
  });
  timeDiv.appendChild(veilShareBtn);

  // Experience + All buttons for every EACI
  if (eaciTypes.indexOf(type) >= 0) {
    var expBtn = document.createElement('button');
    expBtn.className = 'audio-btn exp-btn';
    expBtn.innerHTML = '&#10024; Experience';
    expBtn.title = 'Highlight grey experience text (not read aloud)';
    expBtn.addEventListener('click', function() {
      var msgEl = this.closest('.msg');
      if (!msgEl) return;
      var actions = msgEl.querySelectorAll('.msg-action');
      if (!actions.length) return;
      actions.forEach(function(el) {
        el.classList.add('action-flash');
        setTimeout(function() { el.classList.remove('action-flash'); }, 1200);
      });
    });

    var allBtn = document.createElement('button');
    allBtn.className = 'audio-btn all-btn';
    allBtn.innerHTML = '&#9654; All';
    allBtn.title = 'Read aloud per your settings (white / grey / both)';
    allBtn.addEventListener('click', function() {
      var msgEl = this.closest('.msg');
      if (!msgEl) return;
      var raw = msgEl.getAttribute('data-rawtext');
      var v = msgEl.getAttribute('data-voice');
      if (raw) {
        stopAllAudio();
        setTimeout(function() {
          state.stopRequested = false;
          state.isPlayingAudio = false;
          state._queueRunning = false;
          speakByMode(raw, v);
        }, 250);
      }
    });

    timeDiv.appendChild(expBtn);
    timeDiv.appendChild(allBtn);
  }

  div.innerHTML = label;
  div.appendChild(textDiv);
  div.appendChild(timeDiv);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (type === 'user' && typeof recordUserActivity === 'function') {
    recordUserActivity('message', text);
  }
}

function addSystemMessage(text) {
  var container = document.getElementById('messages');
  var div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function playMessageAudio(msgEl) {
  if (!msgEl) return;
  var raw = msgEl.getAttribute('data-rawtext') || msgEl.getAttribute('data-text');
  var voice = msgEl.getAttribute('data-voice');
  if (raw) {
    stopAllAudio();
    setTimeout(function() {
      state.stopRequested = false;
      state.isPlayingAudio = false;
      state._queueRunning = false;
      speakByMode(raw, voice);
    }, 250);
  }
}

