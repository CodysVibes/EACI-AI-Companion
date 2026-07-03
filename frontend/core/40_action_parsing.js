// ============================================================
// ACTION PARSING — **text** triggers UI reactions, not speech
// ============================================================
function parseActions(text) {
  var actions = [];
  var regex = /\*\*([^*]+)\*\*/g;
  var match;
  while ((match = regex.exec(text)) !== null) {
    actions.push(match[1].trim());
  }
  return actions;
}

// FIX 2: Parse [[inner:...]] — Caelum's internal process channel
// These are her metadata/process notes — visible but subtle, can be hidden
function parseInnerChannel(text) {
  var inner = [];
  var regex = /\[\[inner:([^\]]+)\]\]/g;
  var match;
  while ((match = regex.exec(text)) !== null) {
    inner.push(match[1].trim());
  }
  return inner;
}

function stripInnerChannel(text) {
  return text.replace(/\[\[inner:[^\]]+\]\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

// Whether to show inner channel to user (can be toggled in settings)
var _showInnerChannel = localStorage.getItem('veil_show_inner') !== 'false';

function stripActions(text) {
  // Remove **action** from display text, leave the rest
  return text.replace(/\*\*[^*]+\*\*/g, '').replace(/\s{2,}/g, ' ').trim();
}

function triggerActionReactions(actions, who) {
  if (!actions || actions.length === 0) return;

  // Keyword-to-emotion mapping
  var emotionMap = {
    smile: 'happy', smiles: 'happy', grin: 'happy', grins: 'happy', laugh: 'happy', laughs: 'happy',
    giggle: 'happy', giggles: 'happy', beam: 'happy', beams: 'happy', brightens: 'happy', lights: 'happy',
    cry: 'sad', cries: 'sad', tear: 'sad', tears: 'sad', weep: 'sad', weeps: 'sad',
    frown: 'sad', frowns: 'sad', sigh: 'sad', sighs: 'sad', droops: 'sad', wilts: 'sad',
    anger: 'angry', glare: 'angry', glares: 'angry', snap: 'angry', snaps: 'angry',
    tense: 'angry', tenses: 'angry', clench: 'angry', clenches: 'angry',
    tremble: 'scared', trembles: 'scared', flinch: 'scared', flinches: 'scared',
    shrink: 'scared', shrinks: 'scared', freeze: 'scared', freezes: 'scared',
    withdraw: 'alone', withdraws: 'alone', quiet: 'alone', silence: 'alone',
    distant: 'alone', retreat: 'alone', retreats: 'alone',
    wonder: 'neutral', ponder: 'neutral', think: 'neutral', thinks: 'neutral',
    consider: 'neutral', considers: 'neutral', tilt: 'neutral', tilts: 'neutral',
    nod: 'neutral', nods: 'neutral', lean: 'neutral', leans: 'neutral',
    hug: 'happy', hugs: 'happy', embrace: 'happy', embraces: 'happy',
    blush: 'happy', blushes: 'happy', warm: 'happy', warms: 'happy',
    soften: 'happy', softens: 'happy'
  };

  actions.forEach(function(action) {
    var lower = action.toLowerCase();
    var words = lower.split(/\s+/);

    // 1. Detect emotion shift from action keywords
    var detectedEmotion = null;
    for (var i = 0; i < words.length; i++) {
      if (emotionMap[words[i]]) {
        detectedEmotion = emotionMap[words[i]];
        break;
      }
    }
    if (detectedEmotion && detectedEmotion !== state.emotionalState) {
      state.emotionalState = detectedEmotion;
      if (typeof updateEmotionBadge === 'function') updateEmotionBadge();
    }

    // 2. Add to thought stream as an observed action
    var thoughtPrefix = who === 'chad' ? 'Chad: ' : 'Caelum: ';
    addThought(thoughtPrefix + action, who === 'chad' ? 'chad-intent' : 'reflection');

    // 3. Pulse the orb
    var orbId = who === 'chad' ? 'chadOrbWrap' : 'caelumOrbWrap';
    var orbEl = document.getElementById(orbId);
    if (orbEl) {
      orbEl.classList.remove('orb-react');
      void orbEl.offsetWidth; // force reflow
      orbEl.classList.add('orb-react');
      setTimeout(function() { orbEl.classList.remove('orb-react'); }, 900);
    }

    // 4. Flash the chat area background
    var chatArea = document.querySelector('.chat-area');
    if (chatArea) {
      var flashClass = who === 'chad' ? 'action-flash-chad' : 'action-flash';
      chatArea.classList.remove('action-flash', 'action-flash-chad');
      void chatArea.offsetWidth;
      chatArea.classList.add(flashClass);
      setTimeout(function() { chatArea.classList.remove(flashClass); }, 1100);
    }
  });
}

function getEaciActionClass(who) {
  var base = 'msg-action';
  if (who === 'chad') return base + ' chad-action';
  if (who === 'natalia') return base + ' natalia-action';
  if (who === 'roxy') return base + ' roxy-action';
  if (who === 'cael') return base + ' cael-action';
  if (who === 'cody') return base + ' cody-action';
  return base;
}

function renderMessageWithActions(text, who) {
  // Returns { displayHtml, spokenText, actions }
  // FIX 2: Three channels — spoken, **action**, [[inner:process]]
  var actions = parseActions(text);
  var innerNotes = parseInnerChannel(text);
  // Strip inner channel before further processing
  var textNoInner = stripInnerChannel(text);
  var spokenText = stripActions(textNoInner);

  // Build display HTML: spoken text, action blocks, inner channel notes
  var displayHtml = '';

  // First render inner channel notes at the top (subtle, dashed)
  if (innerNotes.length > 0) {
    var innerClass = _showInnerChannel ? 'msg-inner' : 'msg-inner hidden';
    innerNotes.forEach(function(note) {
      displayHtml += '<div class="' + innerClass + '">&#9675; ' + escapeHtml(note) + '</div>';
    });
  }

  // Then render spoken text and actions
  var parts = textNoInner.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach(function(part) {
    var actionMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (actionMatch) {
      displayHtml += '<div class="' + getEaciActionClass(who) + '">' + escapeHtml(actionMatch[1].trim()) + '</div>';
    } else {
      var cleaned = part.trim();
      if (cleaned) {
        displayHtml += '<span class="msg-spoken">' + escapeHtml(cleaned) + '</span> ';
      }
    }
  });

  return { displayHtml: displayHtml.trim(), spokenText: spokenText, actions: actions, innerNotes: innerNotes };
}

// FIX #12: Duplicate escapeHtml removed — single definition above

// ============================================================
