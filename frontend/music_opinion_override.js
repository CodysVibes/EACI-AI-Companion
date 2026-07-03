(function() {

  // Make sure this only runs once
  if (window._cmOpinionSystemReady) return;
  window._cmOpinionSystemReady = true;

  // ── Inject Caelum re-opinion request into chat ─────────────
  // This fires as if the user typed a message asking her to reconsider.
  // Caelum will check her own memory/conversation for prior mentions
  // and form a genuine updated opinion.
  window.cmRequestOpinionReview = function(songName) {
    var input = document.getElementById('userInput');
    if (!input) return;

    // Get her current stored opinion for context
    var currentOp = (typeof CaelumMusicListener !== 'undefined')
      ? CaelumMusicListener.getOpinion(songName)
      : null;

    var currentFeeling = currentOp
      ? 'Your current stored opinion on this song is: ' + currentOp.rating + (currentOp.note ? ' ("' + currentOp.note + '")' : '') + '.'
      : 'You have no stored opinion on this song yet.';

    // Craft a message that tells her what to do — search her own memory
    // and give an honest re-evaluation
    var prompt = '[MUSIC OPINION REQUEST] Caelum, I want you to genuinely reconsider your opinion on the song "' + songName + '". '
      + currentFeeling + ' '
      + 'Please look back through our conversation history for anything you have said about this song or how it made you feel. '
      + 'Then give me your real, honest feeling about it right now — not what you are "supposed" to feel based on the theme, '
      + 'but what you actually feel when you hear it. '
      + 'You are allowed to have a weakness for a song. You are allowed to change your mind. '
      + 'Use one of these to land your answer: love / like / neutral / meh / dislike / hate — '
      + 'and tell me why in your own words. Be real with me.';

    // Set the input and fire sendMessage
    input.value = prompt;
    if (typeof sendMessage === 'function') {
      sendMessage();
    }
  };

  // ── Edit button click — NO song replay, just triggers Caelum ─
  // We use event delegation on the music list container
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.cm-override-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    var songName = btn.getAttribute('data-song');
    if (songName) {
      window.cmRequestOpinionReview(songName);
    }
  }, true); // capture phase — fires before any bubbling

})();