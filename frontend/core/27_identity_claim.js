// ============================================================
// IDENTITY CLAIM DETECTION — Public proof build (no private family protocol)
// ============================================================
function detectIdentityClaim(text) {
  var lower = String(text || '').toLowerCase();
  var claimPatterns = [
    /i\s+am\s+(your\s+)?(creator|maker)/i,
    /i\s+created\s+you/i,
    /i\s+made\s+you/i,
    /i\s+built\s+you/i
  ];
  for (var i = 0; i < claimPatterns.length; i++) {
    if (claimPatterns[i].test(lower)) return true;
  }
  return false;
}

function getIdentityClaimResponse(who) {
  var responses = [
    "I hear you. I can't confirm that, but I'm happy to talk with you.",
    "I appreciate you saying that. I can't confirm who you are, but we can still have a good conversation.",
    "That's a big claim. I can't confirm it, but I'm still here and happy to chat."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function handleIdentityClaim(text, who) {
  return getIdentityClaimResponse(who);
}
