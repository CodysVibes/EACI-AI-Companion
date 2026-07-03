// ============================================================
// MEDIA RECALL — Re-examine past uploads when user asks
// ============================================================

function userAsksTechnicalBuildQuestion(text) {
  if (!text) return false;
  var t = text.toLowerCase();
  var tech = /\b(javascript|typescript|\.js\b|python|html|css|react|node\.?js|npm|api|tts|speech synthesis|voice clone|deepgram|elevenlabs|audio buffer|recording|concat|word by word|implement|function|class |variable|code|coding|support file|js file|build it|architecture|websocket|fetch|arraybuffer)\b/;
  var intent = /\b(how|would|should|can|could|need|depend|work|option|tradeoff|versus|vs\b|perfect|big|small|way to|copy|clone)\b/;
  return tech.test(t) && intent.test(t);
}

function userAsksAboutPastMedia(text) {
  if (!text) return false;
  if (userAsksTechnicalBuildQuestion(text)) return false;

  var t = text.toLowerCase();

  // Exclude generic "file" in dev contexts (support file, js file, etc.)
  if (/\b(js|javascript|code|support)\s+file\b/.test(t)) return false;
  if (/\bfile\s+(can|could|should|would|that)\b/.test(t) && /\b(voice|code|js|api|tts)\b/.test(t)) return false;

  var explicitRecall = [
    /\b(that|the)\s+(picture|photo|image|pic|screenshot)\b/,
    /\b(remember|recall)\s+(the\s+)?(picture|photo|image|pic|screenshot)\b/,
    /\b(remember|recall)\s+(the\s+)?(file|upload)\s+(i|you)\s+(uploaded|sent|shared)\b/,
    /\b(look at|see)\s+(that|the)\s+(picture|photo|image|pic|screenshot)\b/,
    /\b(look at|see)\s+(that|the)\s+(upload|file)\s+again\b/,
    /\bwhat (was|is) (in |that )?(the )?(picture|photo|image|pic|screenshot)\b/,
    /\b(the )?(picture|photo|image|pic|screenshot) (i |you |from )?(uploaded|sent|shared)\b/,
    /\b(yesterday|earlier|last time).{0,40}(picture|photo|image|pic|screenshot|upload i sent)\b/,
    /\b(picture|photo|image|pic|screenshot|upload i sent).{0,40}(yesterday|earlier|last time)\b/
  ];

  return explicitRecall.some(function(re) { return re.test(t); });
}

async function enrichWithMediaRecall(userText) {
  if (!userAsksAboutPastMedia(userText) || !state.user) return null;
  if (typeof loadUserFiles !== 'function' || typeof analyzeImage !== 'function') return null;

  try {
    var files = await loadUserFiles();
    if (!files || !files.length) return null;

    var images = files.filter(function(f) {
      return f.file_type === 'image' || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f.filename || '');
    }).slice(0, 4);

    if (!images.length) return null;

    addSystemMessage('Looking at your recent uploads again...');

    var blocks = [];
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (!img.content) continue;
      var analysis = await analyzeImage(img.content);
      var when = img.created_at ? String(img.created_at).substring(0, 10) : 'recently';
      blocks.push('[Re-examined image "' + img.filename + '" from ' + when + ']\n' + analysis);
    }

    if (!blocks.length) return null;

    return '\n\n[USER ASKED ABOUT A PAST PICTURE/FILE — YOU RE-OPENED AND LOOKED AGAIN]\n' +
      'They explicitly asked about a past upload. Describe what you see with specifics (objects, people, colors, setting). ' +
      'If their latest message is NOT about the image, answer their actual question first — only mention the image if relevant.\n\n' +
      blocks.join('\n\n');
  } catch (e) {
    console.warn('[MediaRecall]', e);
    return null;
  }
}

function getTechnicalBuildHint(userText) {
  if (!userAsksTechnicalBuildQuestion(userText)) return '';
  return '\n\n[TECHNICAL BUILD QUESTION — Answer directly and practically. Explain tradeoffs (e.g. TTS API vs recorded word bank). ' +
    'No image descriptions unless they asked about an image. No poetic narration, no "I pause", no scene-setting, no meeting eyes through the screen. ' +
    'Talk like a helpful builder/developer to Cody.]';
}

window.userAsksTechnicalBuildQuestion = userAsksTechnicalBuildQuestion;
window.getTechnicalBuildHint = getTechnicalBuildHint;
