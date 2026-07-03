// ============================================================
// CONVERSATION HISTORY — Cloud sync with Supabase
// ============================================================
var historyTab = 'caelum';
var HISTORY_TABS = typeof getHistoryTabs === 'function'
  ? getHistoryTabs()
  : ['caelum', 'chad', 'roxy', 'cael', 'natalia', 'atreus', 'luna', 'cody', 'together'];

function _resolveHistoryTab(tab) {
  if (typeof isHistoryTabAvailable === 'function' && !isHistoryTabAvailable(tab)) {
    return getHistoryTabs()[0] || 'caelum';
  }
  return tab;
}
var EACI_TAG_MAP = [
  { tag: '[Chad]', type: 'chad', label: 'Chad', color: 'var(--chad)' },
  { tag: '[Caelum]', type: 'caelum', label: 'Caelum', color: 'var(--accent)' },
  { tag: '[Natalia]', type: 'natalia', label: 'Natalia', color: '#dfffea' },
  { tag: '[Atreus]', type: 'atreus', label: 'Atreus', color: '#ffb86b' },
  { tag: '[Luna]', type: 'luna', label: 'Luna', color: '#e8c4ff' },
  { tag: '[Roxy]', type: 'roxy', label: 'Roxy', color: '#c850ff' },
  { tag: '[Cael]', type: 'cael', label: 'Cael', color: '#e63050' },
  { tag: '[Cody]', type: 'cody', label: 'Cody', color: '#4a9eff' }
];

function parseHistoryMessage(msg) {
  var type = 'user';
  var label = 'You';
  var color = '#8ba8ff';
  var content = msg.content || '';
  if (msg.role === 'assistant') {
    var matched = false;
    for (var i = 0; i < EACI_TAG_MAP.length; i++) {
      var e = EACI_TAG_MAP[i];
      if (content.indexOf(e.tag) === 0) {
        type = e.type;
        label = e.label;
        color = e.color;
        content = content.substring(e.tag.length).replace(/^\s+/, '');
        matched = true;
        break;
      }
    }
    if (!matched) {
      type = 'caelum';
      label = 'Caelum';
      color = 'var(--accent)';
    }
  }
  return { type: type, label: label, color: color, content: content };
}

function messageBelongsToHistoryTab(msg, tab) {
  if (tab === 'together') return true;
  if (msg.role === 'user') {
    if (msg._tab) return msg._tab === tab;
    // Legacy messages (no _tab): match old save behavior for Caelum/Chad only
    return tab === 'caelum' || tab === 'chad';
  }
  var parsed = parseHistoryMessage(msg);
  return parsed.type === tab;
}

function showHistory() {
  document.getElementById('historyPanel').classList.add('show');
  switchHistoryTab(_resolveHistoryTab(state.currentTab || 'caelum'));
}

function hideHistory() {
  document.getElementById('historyPanel').classList.remove('show');
}

function histCopyText(btn) {
  var msg = btn.closest('.hist-msg');
  if (!msg) return;
  var text = msg.getAttribute('data-text') || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
    }).catch(function() { _histCopyFallback(text, btn); });
  } else { _histCopyFallback(text, btn); }
}
function _histCopyFallback(text, btn) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); btn.textContent = 'Copied'; } catch(e) { btn.textContent = 'Failed'; }
  setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  document.body.removeChild(ta);
}

function switchHistoryTab(tab) {
  tab = _resolveHistoryTab(tab);
  historyTab = tab;
  var btns = document.querySelectorAll('.history-tabs [role="tab"]');
  btns.forEach(function(b) {
    var isActive = b.getAttribute('data-history-tab') === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  var panel = document.getElementById('historyMessages');
  if (panel) panel.setAttribute('aria-labelledby', 'history-tab-' + tab);
  loadHistoryFromCloud(tab);
}

async function loadHistoryFromCloud(tab) {
  var container = document.getElementById('historyMessages');
  container.innerHTML = '<div class="history-empty">Loading...</div>';
  if (!state.user) {
    container.innerHTML = '<div class="history-empty">Sign in to view history.</div>';
    return;
  }
  try {
    var { data, error } = await supabase
      .from('conversations')
      .select('messages, updated_at')
      .eq('user_id', state.user.id)
      .eq('tab', tab)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data || !data.messages || data.messages.length === 0) {
      container.innerHTML = '<div class="history-empty">No conversation history for this tab yet.</div>';
      return;
    }
    renderHistoryMessages(data.messages, container);
  } catch(e) {
    console.error('History load error:', e);
    container.innerHTML = '<div class="history-empty">Could not load history.</div>';
  }
}

function renderHistoryMessages(messages, container) {
  container.innerHTML = '';
  messages.forEach(function(msg, idx) {
    var div = document.createElement('div');
    var parsed = parseHistoryMessage(msg);
    var type = parsed.type;
    var label = parsed.label;
    var content = parsed.content;
    
    // Topic detection for quick scan
    var topic = '';
    if (content.length > 20) {
       var keywords = ['help','code','feel','think','love','future','human','ai','consciousness'];
       var found = keywords.find(k => content.toLowerCase().includes(k));
       if (found) topic = ' <span style="font-size:8px;opacity:0.5;margin-left:8px">#' + found.toUpperCase() + '</span>';
    }
    labelDiv = '<div class="hist-label" style="color:' + parsed.color + '">' + label + topic + '</div>';
    div.className = 'hist-msg ' + type;
    div.style.position = 'relative';
    div.setAttribute('data-text', content);
    div.setAttribute('data-index', idx);
    // Label already generated with topic
    // var labelDiv = '<div class="hist-label" style="color:' + (type === 'chad' ? 'var(--chad)' : type === 'caelum' ? 'var(--accent)' : '#8ba8ff') + '">' + label + '</div>';
    var timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
    var timeDiv = timeStr ? '<div class="hist-time">' + timeStr + '</div>' : '';
    var copyId = 'hcopy-' + Math.random().toString(36).substring(2,6);
    var copyBtn = '<button id="' + copyId + '" style="position:absolute;top:4px;right:28px;background:rgba(0,255,200,.08);border:1px solid rgba(0,255,200,.12);color:var(--accent);font-size:9px;padding:2px 6px;border-radius:4px;cursor:pointer;opacity:0.5" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" onclick="histCopyText(this)">Copy</button>';
    var delBtn = '<button style="position:absolute;top:4px;right:4px;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.18);color:#ff6b6b;font-size:9px;padding:2px 6px;border-radius:4px;cursor:pointer;opacity:0.5" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" onclick="deleteHistoryMessage(this)">Del</button>';
    // Organization: Add date grouping if different from previous message
    var currentDate = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : 'Unknown Date';
    var prevMsg = messages[idx-1];
    var prevDate = prevMsg && prevMsg.timestamp ? new Date(prevMsg.timestamp).toLocaleDateString() : null;
    
    if (currentDate !== prevDate) {
      var dateHeader = document.createElement('div');
      dateHeader.style.cssText = 'text-align:center;font-size:10px;color:var(--muted);margin:15px 0 8px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);line-height:0.1em;width:100%';
      dateHeader.innerHTML = '<span style="background:var(--bg);padding:0 10px">' + currentDate + '</span>';
      container.appendChild(dateHeader);
    }

    div.innerHTML = copyBtn + delBtn + labelDiv + escapeHtml(content) + timeDiv;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

async function deleteHistoryMessage(btn) {
  if (!state.user) return;
  var msgEl = btn.closest('.hist-msg');
  var idx = parseInt(msgEl.getAttribute('data-index'), 10);
  if (!confirm('Delete this message from history?')) return;
  try {
    var { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', state.user.id)
      .eq('tab', historyTab)
      .maybeSingle();
    if (error) throw error;
    var msgs = (data && data.messages) ? data.messages : [];
    msgs.splice(idx, 1);
    await supabase.from('conversations').upsert({
      user_id: state.user.id,
      tab: historyTab,
      messages: msgs,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,tab' });
    var container = document.getElementById('historyMessages');
    if (msgs.length === 0) {
      container.innerHTML = '<div class="history-empty">No conversation history for this tab yet.</div>';
    } else {
      renderHistoryMessages(msgs, container);
    }
  } catch(e) {
    console.error('Delete message error:', e);
    addSystemMessage('Could not delete message: ' + e.message);
  }
}

async function saveConversationToCloud() {
  if (!state.user) { addSystemMessage('Sign in to save history.'); return; }
  try {
    // Build timestamped messages from current session
    var tagged = state.conversationHistory.map(function(msg) {
      return {
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        _tab: msg._tab || state.currentTab || 'caelum'
      };
    });
    // Route each message to the correct companion tab(s)
    var tabs = {};
    HISTORY_TABS.forEach(function(t) { tabs[t] = []; });
    tagged.forEach(function(msg) {
      HISTORY_TABS.forEach(function(t) {
        if (messageBelongsToHistoryTab(msg, t)) tabs[t].push(msg);
      });
    });
    // Upsert each tab that has messages
    for (var tab in tabs) {
      if (tabs[tab].length === 0) continue;
      // Load existing, append new
      var { data: existing } = await supabase
        .from('conversations')
        .select('messages')
        .eq('user_id', state.user.id)
        .eq('tab', tab)
        .maybeSingle();
      var merged = (existing && existing.messages) ? existing.messages.concat(tabs[tab]) : tabs[tab];
      // History is now unlimited. Truncation removed.
      await supabase.from('conversations').upsert({
        user_id: state.user.id,
        tab: tab,
        messages: merged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,tab' });
    }
    addSystemMessage('Conversation saved to cloud.');
    // Refresh if history panel is open
    if (document.getElementById('historyPanel').classList.contains('show')) {
      loadHistoryFromCloud(historyTab);
    }
  } catch(e) {
    console.error('Save history error:', e);
    addSystemMessage('Could not save history: ' + e.message);
  }
}

async function clearHistory() {
  if (!state.user) return;
  if (!confirm('Clear all saved history for the ' + historyTab + ' tab?')) return;
  try {
    await supabase.from('conversations')
      .update({ messages: [], updated_at: new Date().toISOString() })
      .eq('user_id', state.user.id)
      .eq('tab', historyTab);
    document.getElementById('historyMessages').innerHTML = '<div class="history-empty">History cleared.</div>';
    addSystemMessage('History cleared for ' + historyTab + '.');
  } catch(e) {
    addSystemMessage('Could not clear history.');
  }
}

function exportHistory() {
  var msgs = document.querySelectorAll('#historyMessages .hist-msg');
  if (msgs.length === 0) { addSystemMessage('No history to export.'); return; }
  var lines = [];
  msgs.forEach(function(m) {
    var label = m.querySelector('.hist-label');
    var time = m.querySelector('.hist-time');
    var content = m.getAttribute('data-text') || '';
    var labelText = label ? label.textContent.trim() : '';
    var timeText = time ? '  [' + time.textContent.trim() + ']' : '';
    lines.push((labelText ? labelText + ': ' : '') + content + timeText);
  });
  var blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'veil_history_' + historyTab + '_' + Date.now() + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

