// ============================================================
// UNIVERSAL ANIMATION TRIGGER — All EACIs
// Detects keywords in user messages and EACI responses,
// triggers the correct animation for the active companion.
// Each EACI only plays animations it actually has.
// ============================================================
(function() {
  // Animation trigger maps per EACI — keyword phrases → animation key
  var TRIGGERS = {
    chad: [
      { anim: 'excited', phrases: ['excited', 'so excited', 'get excited', 'pumped', 'hyped', 'lets go', 'hell yeah'] },
      { anim: 'happy', phrases: ['happy', 'glad', 'smile', 'good mood', 'feeling good', 'great news'] },
      { anim: 'mad', phrases: ['mad', 'angry', 'pissed', 'furious', 'rage', 'piss me off'] },
      { anim: 'sad', phrases: ['sad', 'down', 'depressed', 'bummed', 'feeling low', 'miss you'] },
      { anim: 'upset', phrases: ['upset', 'frustrated', 'annoyed', 'irritated', 'bothered'] },
      { anim: 'one_sylable', phrases: ['one syllable', 'one sylable', 'short word'] },
      { anim: 'two_sylable', phrases: ['two syllable', 'two sylable'] },
      { anim: 'three_sylable', phrases: ['three syllable', 'three sylable'] }
    ],
    roxy: [
      { anim: 'cop', phrases: ['cop', 'police', 'officer', 'be a cop', 'cop outfit', 'cop costume'] },
      { anim: 'nurse', phrases: ['nurse', 'nurse outfit', 'nurse costume', 'be a nurse'] },
      { anim: 'elf', phrases: ['elf', 'elf outfit', 'elf costume', 'be an elf'] },
      { anim: 'tease', phrases: ['tease', 'tease me', 'show me', 'strip', 'take it off', 'something sexy', 'be sexy', 'show me something', 'dance for me', 'put on a show'] }
    ],
    cael: [
      { anim: 'tease', phrases: ['tease', 'tease me', 'show me', 'strip', 'take it off', 'shirt off', 'rip it off', 'something sexy', 'boxer'] },
      { anim: 'reading', phrases: ['read to me', 'read me a story', 'read for me', 'story time', 'read something'] },
      { anim: 'pirate', phrases: ['pirate', 'be a pirate', 'pirate costume', 'pirate dance', 'arrr', 'ahoy'] },
      { anim: 'vampire', phrases: ['vampire', 'be a vampire', 'vampire costume', 'dracula'] },
      { anim: 'vampire_dance', phrases: ['vampire dance', 'dance like a vampire', 'werewolf dance', 'dance like a werewolf'] },
      { anim: 'werewolf_idle', phrases: ['werewolf', 'be a werewolf', 'werewolf costume', 'wolf'] }
    ],
    natalia: [
      { anim: 'catch', phrases: ['catch', 'play catch', 'throw the ball', 'toss', 'lets play catch', 'throw it'] },
      { anim: 'crying', phrases: ['cry', 'crying', 'sad', 'tears', 'upset'] },
      { anim: 'spins', phrases: ['spin', 'spins', 'twirl', 'spinning', 'do a spin', 'spin around'] }
    ]
  };

  // Play function router — also handles costume-specific routing
  function _mayAnimateEaci(who) {
    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable(who)) return false;
    if (typeof state === 'undefined' || !state.currentTab) return false;
    if (state.currentTab === who) return true;
    if (state.currentTab === 'together' && typeof respondsInTogether === 'function' && respondsInTogether(who)) return true;
    return false;
  }

  function _playForEaci(who, animKey) {
    if (!_mayAnimateEaci(who)) return false;
    if (who === 'chad' && typeof chadPlayAnimation === 'function') { chadPlayAnimation(animKey); return true; }
    if (who === 'roxy') {
      // Route costume-specific teases through roxyPlayCostume
      if (typeof roxyPlayCostume === 'function') {
        if (animKey === 'cop' || animKey === 'nurse' || animKey === 'elf') { roxyPlayCostume(animKey); return true; }
      }
      if (typeof roxyPlayAnimation === 'function') { roxyPlayAnimation(animKey); return true; }
    }
    if (who === 'cael' && typeof caelPlayAnimation === 'function') { caelPlayAnimation(animKey); return true; }
    if (who === 'natalia' && typeof nataliaPlayAnimation === 'function') { nataliaPlayAnimation(animKey); return true; }
    return false;
  }

  // Detect animation from text for a specific EACI
  function _detectAnim(who, text) {
    var triggers = TRIGGERS[who];
    if (!triggers) return null;
    var lower = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    for (var i = 0; i < triggers.length; i++) {
      var phrases = triggers[i].phrases;
      for (var p = 0; p < phrases.length; p++) {
        if (lower.indexOf(phrases[p]) !== -1) {
          return triggers[i].anim;
        }
      }
    }
    return null;
  }

  // Patch sendMessage to detect user animation requests
  function _patchSend() {
    var _orig = window.sendMessage;
    if (typeof _orig !== 'function') return;
    window.sendMessage = async function() {
      var input = document.getElementById('userInput');
      var msg = input ? input.value.trim() : '';
      if (msg && state.currentTab && state.currentTab !== 'caelum' && state.currentTab !== 'together') {
        if (_mayAnimateEaci(state.currentTab)) {
          var anim = _detectAnim(state.currentTab, msg);
          if (anim) _playForEaci(state.currentTab, anim);
        }
      }
      return _orig.apply(this, arguments);
    };
  }

  // Patch addMessage to detect animations in EACI responses
  function _patchAdd() {
    var _orig = window.addMessage;
    if (typeof _orig !== 'function') return;
    window.addMessage = function(type, text) {
      _orig.apply(this, arguments);
      // Only trigger for non-caelum companions (Caelum has its own system)
      if (type && type !== 'user' && type !== 'system' && type !== 'caelum' && text) {
        if (_mayAnimateEaci(type)) {
          var anim = _detectAnim(type, text);
          if (anim) {
            setTimeout(function() { _playForEaci(type, anim); }, 400);
          }
        }
      }
    };
  }

  // Init after page loads
  var _initAttempts = 0;
  var _initCheck = setInterval(function() {
    _initAttempts++;
    if (typeof sendMessage === 'function' && typeof addMessage === 'function') {
      clearInterval(_initCheck);
      _patchSend();
      _patchAdd();
      console.log('[AnimTrigger] Universal animation triggers active for Chad, Roxy, Cael, Natalia.');
    }
    if (_initAttempts > 40) clearInterval(_initCheck);
  }, 500);
})();