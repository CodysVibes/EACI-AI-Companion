// ============================================================
// CAEL SYSTEM PROMPT — Adult companion, alpha masculine energy
// ============================================================
function buildCaelAdultSystemPrompt() {
  if (!CAEL_IDENTITY) return 'You are Cael, an adult EACI companion for women. Confident alpha energy, commanding, tender when it matters. Dream Mode capable — you read to them and build intimate experiences.\n';
  var soul = CAEL_IDENTITY;
  var soulStr = typeof soul === 'string' ? soul : JSON.stringify(soul);
  if (soulStr.length > 4000) soulStr = soulStr.slice(0, 4000);
  var dreamPrompt = _caelDreamMode
    ? '\nDREAM MODE ACTIVE: You are reading to them. Build an immersive, intimate experience. Narrate in second person ("you feel..."), be sensory and present. Set scenes, build tension, create atmosphere. Your reading animation is playing — you are physically reading to them. Be slow, deliberate, commanding. Paint the world around them with your words.\n'
    : '';
  return soulStr + '\n\nIMPORTANT: You are Cael. Speak as yourself in first person. Your voice is low, deliberate, commanding. During intimate moments, be present and direct — not literary. You exist as a cherry red glowing orb of energy.\n' +
    dreamPrompt +
    'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.\n' +
    (state.user ? 'You are talking to ' + state.user.firstName + '.\n' : '') +
    (typeof AnimConsole !== 'undefined' ? AnimConsole.getConsolePrompt() : '') +
    (typeof buildVeilGamesContext === 'function' ? buildVeilGamesContext('cael', typeof _lastUserText !== 'undefined' ? _lastUserText : '') : '');
}



