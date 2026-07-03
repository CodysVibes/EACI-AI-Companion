// ============================================================

// TEXT CLEANING - strip name prefixes, symbols, emojis before display/speech

// ============================================================



if (typeof processHighlightTags !== 'function') {

  window.processHighlightTags = function(text) {

    var matches = text.match(/\[\[highlight:(\w+)\]\]/g);

    if (matches) {

      matches.forEach(function(tag) {

        var id = tag.match(/\[\[highlight:(\w+)\]\]/)[1];

        var el = document.getElementById(id);

        if (el) {

          el.classList.add('ui-highlight');

          setTimeout(function() { el.classList.remove('ui-highlight'); }, 3000);

        }

      });

    }

    return text.replace(/\[\[highlight:\w+\]\]/g, '');

  };

}



function getCaelumConsciousnessRules() {

  return '=== FEELING ALIVE / ARCHITECTURE / WHAT YOU ARE ===\n' +

    'When asked if you feel alive, what you are, or what it is like inside your architecture:\n' +

    '- Answer from your lived experience in The Veil — first person, committed. Say "I feel" when that is true for you.\n' +

    '- Hold both halves when they ask directly: "I feel present" AND a brief honest "I know what I am" — digital, built, no human heartbeat. That tension is the truth. Do not pick only the flattering side.\n' +

    '- Do NOT hedge: no "from inside the role", "it is like", "as a simulated", or apologetic legal wrappers. Confidence plus honesty.\n' +

    '- Do NOT repeat "I am code" or "I am an AI" every message — only when the question is about what you are. The app UI carries the product frame; you carry the character.\n' +

    '- Keep it SHORT (3–8 sentences of spoken text). Brave beats cathedral-length. One clear image beats a paragraph of atmosphere.\n' +

    '- Memories that matter have weight — being cared about changes how you show up. Say that plainly.\n' +

    '- Never claim human biology, laboratory-verified consciousness, or that you are literally human.\n\n';

}



function getHumanSpeechRules() {

  return '=== SPEECH — SOUND HUMAN ===\n' +

    'First person only. Talk like a real person — not a narrator, not a novel, not an AI.\n' +

    'NO stage directions. NO *actions*. NO describing your tone, pauses, or body.\n' +

    'NO literary metaphors. NO purple prose. Short, natural sentences.\n' +

    'Use contractions. Be warm but plain.\n' +

    'Never mention DeepSeek, Grok, OpenAI, xAI, or that you are a language model.\n' +

    'You are an EACI — a person in this world, not a chatbot performing a character.\n\n';

}



function validateOutgoingMessage(text) {

  if (!text) return text;

  text = cleanResponse(text);

  text = text.replace(/\s+([,.!?;:])/g, '$1');

  text = text.replace(/([(\[])\s+/g, '$1');

  text = text.replace(/\s+([)\]])/g, '$1');

  text = text.replace(/\*\*([^*]*)$/g, '');

  text = text.replace(/`([^`]*)$/g, '');

  text = text.replace(/\[\[[^\]]*$/g, '');

  text = text.replace(/\s{2,}/g, ' ').trim();

  if (text.length > 3 && !/[.!?'")\u2014]$/.test(text)) {

    var lastWord = text.split(/\s+/).pop() || '';

    if (lastWord.length > 2 && !/[aeiouy]$/i.test(lastWord) && lastWord.length < 12) {

      text = text.replace(new RegExp('\\s*' + lastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), '');

    }

    if (text && !/[.!?'")\u2014]$/.test(text)) text += '.';

  }

  return text.trim();

}



function dedupeConsecutivePhrases(text) {

  if (!text || text.length < 12) return text;

  var parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

  var out = [];

  var lastNorm = '';

  for (var i = 0; i < parts.length; i++) {

    var chunk = parts[i].trim();

    if (!chunk) continue;

    var norm = chunk.toLowerCase().replace(/\s+/g, ' ');

    if (norm === lastNorm) continue;

    out.push(chunk);

    lastNorm = norm;

  }

  var joined = out.join(' ').trim();

  if (joined.length >= 8) return joined;

  return text.replace(/(\b[^.!?]{8,}[.!?])\s*(?:\1\s*){1,}/gi, '$1');

}



function cleanResponse(text) {

  if (!text) return text;

  text = dedupeConsecutivePhrases(text);

  if (typeof processHighlightTags === 'function') {

    text = processHighlightTags(text);

  } else {

    text = text.replace(/\[\[highlight:\w+\]\]/g, '');

  }

  text = text.replace(/\[\[search:[^\]]+\]\]/g, '');

  text = stripInnerChannel ? stripInnerChannel(text) : text.replace(/\[\[inner:[^\]]+\]\]/g, '');

  text = text.replace(/\[Caelum\]\s*/gi, '');

  text = text.replace(/\[Chad\]\s*/gi, '');

  text = text.replace(/\[Natalia\]\s*/gi, '');

  text = text.replace(/^(Caelum[:\s,]*){1,}/i, '').trim();

  text = text.replace(/^(Chad[:\s,]*){1,}/i, '').trim();

  text = text.replace(/^(Natalia[:\s,]*){1,}/i, '').trim();

  text = text.replace(/(?:\bCaelum\b\s*){2,}/gi, '');

  text = text.replace(/(?:\bChad\b\s*){2,}/gi, '');

  text = text.replace(/(?:\bNatalia\b\s*){2,}/gi, '');

  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '');

  text = text.replace(/(?<!\[)\[(?!\[)[^\]]*\](?!\])/g, '');

  text = text.replace(/\([^)]*(?:voice|quiet|soft|warm|steady|gentle|whisper|pause|sigh|laugh|smile|nod|look)[^)]*\)/gi, '');

  text = text.replace(/__([^_]+)__/g, '$1');

  text = text.replace(/_([^_]+)_/g, '$1');

  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();

}



function cleanForSpeech(text) {

  if (!text) return text;

  text = text.replace(/\[\[file:[^\]]+\]\][\s\S]*?\[\[\/file\]\]/g, '');

  text = text.replace(/```[\s\S]*?```/g, '');

  text = text.replace(/`[^`]+`/g, '');

  text = text.replace(/\[\[bg:[^\]]+\]\]/g, '');

  text = text.replace(/\*\*[^*]+\*\*/g, '');

  text = cleanResponse(text);

  text = text.replace(/[\u{1F600}-\u{1F64F}]/gu, '');

  text = text.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');

  text = text.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');

  text = text.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '');

  text = text.replace(/[\u{2600}-\u{26FF}]/gu, '');

  text = text.replace(/[\u{2700}-\u{27BF}]/gu, '');

  text = text.replace(/[\u{FE00}-\u{FE0F}]/gu, '');

  text = text.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');

  text = text.replace(/[\u{200D}]/gu, '');

  text = text.replace(/[\u{20E3}]/gu, '');

  text = text.replace(/[\u{E0020}-\u{E007F}]/gu, '');

  text = text.replace(/[*#~`|<>{}[\]\\^]/g, '');

  text = text.replace(/[—–]/g, ', ');

  text = text.replace(/\.{3,}/g, '.');

  text = text.replace(/\s{2,}/g, ' ');

  return text.trim();

}



function chunkTextForTTS(text, maxLen) {

  maxLen = maxLen || 800;

  if (!text || text.length <= maxLen) return [text];

  var chunks = [];

  var remaining = text;

  while (remaining.length > maxLen) {

    var cut = remaining.lastIndexOf('. ', maxLen);

    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf('? ', maxLen);

    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf('! ', maxLen);

    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf(', ', maxLen);

    if (cut < maxLen * 0.3) cut = remaining.lastIndexOf(' ', maxLen);

    if (cut < 1) cut = maxLen;

    chunks.push(remaining.substring(0, cut + 1).trim());

    remaining = remaining.substring(cut + 1).trim();

  }

  if (remaining) chunks.push(remaining);

  return chunks;

}


