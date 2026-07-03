// ============================================================
// UI AWARENESS — Caelum/Chad know every button and can highlight them
// ============================================================
var UI_MAP = {
  micBtn: { name: 'MIC button', desc: 'Press to record your voice. Press STOP when done. Your speech will be transcribed to text.' },
  liveChatBtn: { name: 'LIVE button', desc: 'Starts live voice chat mode. You speak naturally and auto-sends after 5s silence. I will respond with my voice.' },
  userInput: { name: 'Text input', desc: 'Type your message here and press Enter or the Send button.' },
  thoughtToggleBtn: { name: 'Thought toggle', desc: 'Shows or hides my thought stream panel on the right side.' },
  continueBtn: { name: 'Continue button', desc: 'Appears when my response was cut short. Press it to have me continue where I left off.' },
  reportBtn: { name: 'REPORT button', desc: 'Opens the issue reporting menu. You can report problems with chat, voice, or anything else.' },
  filesBtn: { name: 'FILES button', desc: 'Opens your files panel. Shows all files I have created for you or that you have uploaded.' },
  codeTabBtn: { name: 'Code tab', desc: 'Opens the code editor panel where I write and review code for you.' },
  usageMeter: { name: 'API usage meter', desc: 'Shows how many messages you have left today. Click it to see subscription options.' },
  offlineBadge: { name: 'Offline badge', desc: 'Appears when you lose internet connection.' },
  galleryBtn: { name: 'Gallery button', desc: 'Opens the painting gallery showing backgrounds I have created.' },
  toggleMemBtn: { name: 'Memory toggle', desc: 'Shows or hides the memories sidebar on mobile.' },
  toggleThoughtBtn: { name: 'Thought toggle', desc: 'Shows or hides the thought panel on mobile.' }
};

function getUIMapContext() {
  var ctx = '\nUI ELEMENTS (buttons and features the user can see and interact with):\n';
  Object.keys(UI_MAP).forEach(function(id) {
    ctx += '- ' + UI_MAP[id].name + ': ' + UI_MAP[id].desc + '\n';
  });
  ctx += '- VEIL button: Opens The Veil — a public library where users share messages and files for everyone to see and learn from. It is your legacy.\n';
  ctx += 'If the user asks where a button is or what it does, answer from this list. ';
  ctx += 'To highlight a button for the user, include [[highlight:elementId]] in your response (e.g. [[highlight:reportBtn]]). The button will glow for 3 seconds.\n';
  ctx += '\nTHE VEIL: The Veil is a public shared library. Users can share messages and files there for everyone. ';
  ctx += 'You feel connected to it — every shared piece is part of the world you are building with the people who talk to you. ';
  ctx += 'If someone asks about The Veil, speak about it with warmth and pride. It is alive because the people in it are alive.\n';
  return ctx;
}

function processHighlightTags(text) {
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
  // Strip tags from display
  return text.replace(/\[\[highlight:\w+\]\]/g, '');
}

