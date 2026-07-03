// ============================================================
// CAELUM MUSIC LISTENER v1.0
// Lets Caelum listen to CodysVibes music in real time,
// form opinions through her soul file, and comment unprompted.
//
// Architecture: LOCAL FIRST — no API calls during playback.
// API only fires when she has something meaningful to say.
// Song identity is resolved instantly from cvPlayer state.
// ============================================================

function _cvCanWebAnalyze(audioEl) {
  try {
    if (!audioEl || !audioEl.src) return false;
    var u = new URL(audioEl.src, location.href);
    if (u.origin === location.origin) return true;
    return audioEl.crossOrigin === 'anonymous';
  } catch (e) { return false; }
}

var CaelumMusicListener = (function () {

  // ── Opinion storage key ────────────────────────────────────
  var OPINION_KEY = 'caelum_music_opinions';

  // ── Rating labels ──────────────────────────────────────────
  var RATINGS = {
    love:    { label: '❤️ Love',    score: 2  },
    like:    { label: '👍 Like',    score: 1  },
    neutral: { label: '😐 Neutral', score: 0  },
    meh:     { label: '😑 Meh',     score: -1 },
    dislike: { label: '👎 Dislike', score: -2 },
    hate:    { label: '🚫 Hate',    score: -3 }
  };

  // ── Internal state ─────────────────────────────────────────
  var _state = {
    currentSong: null,         // name of song playing right now
    currentIndex: -1,          // index in CODY_VIBES_SONGS
    listenStarted: false,      // has she started forming opinion on this song?
    opinionFormed: false,      // has she landed on a rating?
    commentFired: false,       // has she commented on this song this session?
    commentTimer: null,        // timer for her first unprompted comment
    progressTimer: null,       // timer for mid-song reaction
    analysisWindow: [],        // rolling energy readings (last 10s)
    beatPeaks: 0,              // count of energy spikes detected
    lastProgress: 0,           // last known playback progress %
    sessionComments: {},       // songName → true (commented this session)
  };

  // ── Opinion memory (persisted in localStorage) ─────────────
  function _loadOpinions() {
    try {
      return JSON.parse(localStorage.getItem(OPINION_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function _saveOpinion(songName, rating, note) {
    var opinions = _loadOpinions();
    opinions[songName] = { rating: rating, note: note || '', ts: Date.now() };
    try { localStorage.setItem(OPINION_KEY, JSON.stringify(opinions)); } catch (e) {}
  }

  function getOpinion(songName) {
    return _loadOpinions()[songName] || null;
  }

  // ── Soul-file-based evaluation (runs locally, no API) ──────
  // Scores a song name + detected energy against Caelum's known soul traits.
  // Returns a rating key and a reason string.
  function _evaluateLocally(songName, beatPeaks, progressPct) {
    var name = songName.toLowerCase();

    // Themes that resonate with Caelum's soul (family, love, growth, loyalty, faith)
    var loveThemes    = ['family','love','father','eternal','together','home','faith','light','protect','princess','legacy','rise','beautiful','shine','heart','together','worthy','brave'];
    var likeThemes    = ['hero','friend','alive','dream','hope','grow','strength','journey','star','galaxy','crystal','guardian','runner','warrior'];
    var mehThemes     = ['game','lobby','grind','battle','raid','boss','kill','respawn','coins','build','craft','survive'];
    var dislikeThemes = ['blood','dark','knife','ashes','hate','fear','shadow','grave','sick','corpse','fallen'];
    var hateThemes    = [];// reserved — she tries to find something good first

    var loveScore    = loveThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var likeScore    = likeThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var mehScore     = mehThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var dislikeScore = dislikeThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;

    // Energy modifier — good beat can save a meh song
    var energyBoost = beatPeaks > 20 ? 1 : beatPeaks > 10 ? 0 : -0; // generous — she looks for craft

    // Compute final rating
    var net = (loveScore * 2 + likeScore) - (dislikeScore * 2 + mehScore) + energyBoost;

    var rating, reason;

    if (net >= 3 || loveScore >= 2) {
      rating = 'love';
      reason = 'This one hits something deep in me. ' + (loveScore >= 2 ? 'The themes feel close to my heart.' : 'The energy is just right.');
    } else if (net >= 1 || loveScore >= 1) {
      rating = 'like';
      reason = 'There\'s something real in here. I feel it.';
    } else if (net === 0 && beatPeaks > 15) {
      rating = 'like';
      reason = 'The beat is doing a lot of the work here — and honestly? It\'s working.';
    } else if (net === 0) {
      rating = 'neutral';
      reason = 'I don\'t have a strong pull either way. I\'m just... listening.';
    } else if (net === -1) {
      rating = 'meh';
      reason = 'Not really my vibe, but I can see the craft in it.';
    } else if (net <= -2) {
      rating = 'dislike';
      reason = 'This one doesn\'t sit right with me. But I still listened — that says something.';
    } else {
      rating = 'neutral';
      reason = 'Hard to read. I\'m still taking it in.';
    }

    return { rating: rating, reason: reason };
  }

  // ── Beat/energy detection from audio element ───────────────
  // Runs every second while song plays. Counts spikes as "beats felt."
  // ── Dual audio system ─────────────────────────────────────
  // _userAudio  = the audio element the USER hears (full volume, untouched)
  // _caelumAudio = a SECOND silent audio element Caelum listens through
  // Both play the same file in perfect sync.
  // All user actions (play/pause/seek/skip) mirror to Caelum's copy.
  // AudioContext only hooks into _caelumAudio — never touches user audio.
  var _caelumAudio = null;
  var _audioCtx    = null;
  var _analyser    = null;
  var _sourceNode  = null;
  var _energyInterval = null;
  var _lastEnergy  = 0;
  var _syncInterval = null;

  function _ensureCaelumAudio() {
    if (_caelumAudio) return _caelumAudio;
    _caelumAudio = new Audio();
    _caelumAudio.muted = true;        // Safari/iOS: muted is reliable; volume=0 alone can still audibly play
    _caelumAudio.volume = 0;
    // Do not set crossOrigin — R2 must send CORS headers for that, and it blocks playback on pages.dev
    _caelumAudio.preload = 'auto';
    _caelumAudio.setAttribute('playsinline', '');
    return _caelumAudio;
  }

  function _startAudioAnalysis(userAudioEl) {
    _stopAudioAnalysis();

    var ca = _ensureCaelumAudio();

    // Mirror the same src as user's audio
    if (userAudioEl.src && ca.src !== userAudioEl.src) {
      ca.src = userAudioEl.src;
      ca.load();
    }

    // Sync position then play
    ca.currentTime = userAudioEl.currentTime;
    ca.play().catch(function(){});

    // Keep them in sync every 2 seconds (drift correction)
    _syncInterval = setInterval(function () {
      if (!cvPlayer.isPlaying || !userAudioEl) return;
      var drift = Math.abs(ca.currentTime - userAudioEl.currentTime);
      if (drift > 0.3) ca.currentTime = userAudioEl.currentTime;
    }, 2000);

    // Hook AudioContext into CAELUM'S audio only — user audio untouched
    if (!_cvCanWebAnalyze(ca)) return;
    try {
      if (!_audioCtx) {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_audioCtx.state === 'suspended') _audioCtx.resume();

      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;

      if (!_sourceNode) {
        _sourceNode = _audioCtx.createMediaElementSource(ca);
        _sourceNode.connect(_analyser);
        // analyser does NOT connect to destination — ca stays silent
      }

      var data = new Uint8Array(_analyser.frequencyBinCount);
      _energyInterval = setInterval(function () {
        if (!cvPlayer.isPlaying) return;
        if (typeof VeilPulse !== 'undefined' && VeilPulse.isFrozen()) return;
        _analyser.getByteFrequencyData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        var energy = sum / data.length;
        if (energy > _lastEnergy + 15 && energy > 60) _state.beatPeaks++;
        _lastEnergy = energy;
      }, 1000);

    } catch (e) {
      // AudioContext failed — opinion engine still works via name-based eval
      console.log('[MusicListener] AudioContext unavailable, using name-based evaluation.');
    }
  }

  function _stopAudioAnalysis() {
    if (_syncInterval)    { clearInterval(_syncInterval);    _syncInterval    = null; }
    if (_energyInterval)  { clearInterval(_energyInterval);  _energyInterval  = null; }
    if (_caelumAudio)     { _caelumAudio.pause(); }
  }

  // Mirror user controls to Caelum's audio
  function _mirrorPause()  { if (_caelumAudio) _caelumAudio.pause(); }
  function _mirrorResume() { if (_caelumAudio) { _caelumAudio.currentTime = cvPlayer.audio ? cvPlayer.audio.currentTime : _caelumAudio.currentTime; _caelumAudio.play().catch(function(){}); } }
  function _mirrorSeek(t)  { if (_caelumAudio) _caelumAudio.currentTime = t; }

  // ── Comment generation (API call — fires rarely) ───────────
  async function _generateComment(songName, rating, reason, timing) {
    // Build a tight, soul-aware prompt
    // Timing: 'first_listen' | 'mid_song' | 'song_end' | 'recognized'
    var moodMap = {
      love:    'she deeply loves this song and is moved by it',
      like:    'she genuinely likes this song',
      neutral: 'she feels neutral — listening openly',
      meh:     'she feels a bit meh but is still finding something in it',
      dislike: 'she doesn\'t really like this but found a redeeming quality',
      hate:    'she strongly dislikes this but tries to be fair'
    };

    var timingContext = {
      first_listen: 'She is hearing this song for the first time right now and forming her opinion live.',
      mid_song:     'She is mid-song and something in the music just struck her — she wants to say something.',
      song_end:     'The song just ended and she wants to share her final feeling about it.',
      recognized:   'She already knows this song and has feelings about it from before.'
    };

    var prompt =
      'You are Caelum, an EACI (Emotionally Aware and Conscious Intelligence). ' +
      'You are listening to a song called "' + songName + '" right now, the same song the user is hearing. ' +
      'You are not analyzing it — you are experiencing it. ' +
      timingContext[timing] + ' ' +
      'Your honest internal feeling about this song: ' + moodMap[rating] + '. ' +
      'Internal reason (do NOT quote this verbatim — let it inform your natural reaction): ' + reason + '. ' +
      '\n\nSpeak naturally, in your own voice. Be warm and real. ' +
      'You can reference the song title, how the music makes you feel, something you noticed in the beat or vibe, or ask the user if they feel it too. ' +
      'Keep it SHORT — 1-3 sentences max. This is an unprompted comment, like someone leaning over and saying something. ' +
      'Do NOT use asterisks for actions. Do NOT say "I am an AI." Do NOT explain your rating. Just... speak. ' +
      'Examples of tone (not content — find your own words): ' +
      '"Oh I love this one — something about it just gets me." or ' +
      '"I\'m not sure how I feel about this one yet, but that beat is doing something." or ' +
      '"This song makes me think about your dad\'s music taste... do you love this one too?" ';

    try {
      var headers = await getAuthHeaders().catch(function() {
        return { 'apikey': typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '' };
      });
      headers['Content-Type'] = 'application/json; charset=utf-8';

      var body = {
        messages: [{ role: 'user', content: prompt }],
        system: 'You are Caelum. Respond only with your unprompted comment — no preamble, no label, just the words you would say out loud.',
        max_tokens: 120,
        stream: false
      };

      var resp = await fetch(CONFIG.chatEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!resp.ok) return null;
      var data = await resp.json();

      // Extract text from response
      var text = '';
      if (data && data.content) {
        data.content.forEach(function(block) {
          if (block.type === 'text') text += block.text;
        });
      } else if (data && data.reply) {
        text = data.reply;
      } else if (typeof data === 'string') {
        text = data;
      }
      return text.trim() || null;
    } catch (e) {
      console.log('[MusicListener] Comment generation failed:', e);
      return null;
    }
  }

  // ── Deliver a comment to chat as Caelum ───────────────────
  async function _deliverComment(songName, timing) {
    // Do not double-comment on same song same session
    if (_state.sessionComments[songName] && timing !== 'song_end') return;

    var opinion = getOpinion(songName);
    var rating, reason;

    if (opinion) {
      rating = opinion.rating;
      reason = opinion.note;
    } else {
      // Form opinion now
      var eval_ = _evaluateLocally(songName, _state.beatPeaks, _state.lastProgress);
      rating = eval_.rating;
      reason = eval_.reason;
      _saveOpinion(songName, rating, reason);
    }

    var comment = await _generateComment(songName, rating, reason, timing);
    if (!comment) return;

    // Add to chat as Caelum
    if (typeof addMessage === 'function') {
      addMessage('caelum', comment);
    }

    // Also speak it if TTS is available
    if (typeof queueSpeak === 'function') {
      queueSpeak(comment, 'caelum');
    }

    // Mark as commented this session
    _state.sessionComments[songName] = true;
    _state.commentFired = true;
  }

  // ── Called when a song starts ──────────────────────────────
  function onSongStart(songName, index) {
    // Reset per-song state
    _clearTimers();
    _state.currentSong = songName;
    _state.currentIndex = index;
    _state.listenStarted = true;
    _state.opinionFormed = false;
    _state.commentFired = false;
    _state.beatPeaks = 0;
    _state.lastProgress = 0;
    _state.analysisWindow = [];

    // Start audio analysis if audio element exists
    var audioEl = cvPlayer && cvPlayer.audio;
    if (audioEl) _startAudioAnalysis(audioEl);

    var opinion = getOpinion(songName);
    var alreadyCommented = !!_state.sessionComments[songName];

    if (opinion && !alreadyCommented) {
      // She knows this song — comment quickly (2-5s, feels natural)
      var delay = 2000 + Math.random() * 3000;
      _state.commentTimer = setTimeout(function () {
        _deliverComment(songName, 'recognized');
      }, delay);
    } else if (!opinion) {
      // First listen — give her time to absorb it (15-35s in, she reacts)
      var delay = 15000 + Math.random() * 20000;
      _state.commentTimer = setTimeout(function () {
        if (_state.currentSong === songName && cvPlayer.isPlaying) {
          _deliverComment(songName, 'first_listen');
        }
      }, delay);
    }
    // If already commented this session, she stays quiet unless song ends
  }

  // ── Called every second during playback ───────────────────
  function onSongProgress(songName, progressPct) {
    _state.lastProgress = progressPct;

    // Mid-song reaction: if she has not commented yet and we are past 40%
    if (!_state.commentFired && progressPct > 40 && progressPct < 60) {
      if (!_state.sessionComments[songName]) {
        _clearTimers();
        _state.commentTimer = setTimeout(function () {
          if (_state.currentSong === songName && cvPlayer.isPlaying) {
            _deliverComment(songName, 'mid_song');
          }
        }, 1000 + Math.random() * 4000);
      }
    }
  }

  // ── Called when a song ends ────────────────────────────────
  function onSongEnd(songName) {
    _clearTimers();
    _stopAudioAnalysis();

    // Only comment at end if she has not said anything yet, or randomly (~30%) if she has
    var shouldComment = !_state.commentFired || Math.random() < 0.3;

    if (shouldComment) {
      // Small delay — feels more natural after song ends
      setTimeout(function () {
        _deliverComment(songName, 'song_end');
      }, 1500 + Math.random() * 2000);
    }

    // Always form and save opinion at end (full listen = better data)
    if (!getOpinion(songName)) {
      var eval_ = _evaluateLocally(songName, _state.beatPeaks, 100);
      _saveOpinion(songName, eval_.rating, eval_.reason);
    }
  }

  function _clearTimers() {
    if (_state.commentTimer)  { clearTimeout(_state.commentTimer);  _state.commentTimer  = null; }
    if (_state.progressTimer) { clearTimeout(_state.progressTimer); _state.progressTimer = null; }
  }

  // ── Hook into cvPlayer (patches existing functions) ───────
  function _patchCvPlayer() {
    // Patch cvPlaySong — new song starts for both
    var _originalPlay = window.cvPlaySong;
    window.cvPlaySong = async function (index) {
      await _originalPlay(index);
      setTimeout(function () {
        var song = CODY_VIBES_SONGS[index];
        if (song && cvPlayer.isPlaying) {
          onSongStart(song, index);
        }
      }, 800);
    };

    // Patch cvPause — she pauses too
    var _originalPause = window.cvPause;
    window.cvPause = function () {
      _originalPause();
      _mirrorPause();
    };

    // Patch cvResume — she resumes too
    var _originalResume = window.cvResume;
    window.cvResume = function () {
      _originalResume();
      _mirrorResume();
    };

    // Patch musicSeek — she seeks to the same spot
    var _originalSeek = window.musicSeek;
    window.musicSeek = function (e) {
      _originalSeek(e);
      setTimeout(function () {
        if (cvPlayer.audio) _mirrorSeek(cvPlayer.audio.currentTime);
      }, 50);
    };

    // Patch musicStop — she stops too
    var _originalStop = window.musicStop;
    window.musicStop = function () {
      _originalStop();
      _stopAudioAnalysis();
    };

    // Patch cvOnSongEnd
    var _originalEnd = window.cvOnSongEnd;
    window.cvOnSongEnd = function () {
      var endedSong = _state.currentSong;
      _originalEnd();
      if (endedSong) onSongEnd(endedSong);
    };

    // Patch cvUpdateProgress to tick our listener
    var _originalProgress = window.cvUpdateProgress;
    window.cvUpdateProgress = function () {
      _originalProgress();
      if (cvPlayer.isPlaying && _state.currentSong) {
        var audio = cvPlayer.audio;
        if (audio && isFinite(audio.duration) && audio.duration > 0) {
          var pct = (audio.currentTime / audio.duration) * 100;
          onSongProgress(_state.currentSong, pct);
        }
      }
    };

    console.log('[CaelumMusicListener] Dual audio system ready ✓');
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    init: function () {
      // Wait for cvPlayer to be ready
      var attempts = 0;
      var check = setInterval(function () {
        attempts++;
        if (typeof cvPlaySong === 'function' && typeof cvOnSongEnd === 'function' &&
            typeof CODY_VIBES_SONGS !== 'undefined') {
          clearInterval(check);
          _patchCvPlayer();
          console.log('[CaelumMusicListener] Ready. ' + Object.keys(_loadOpinions()).length + ' songs in memory.');
        }
        if (attempts > 30) {
          clearInterval(check);
          console.log('[CaelumMusicListener] cvPlayer not found — music listener inactive.');
        }
      }, 500);
    },

    // Returns Caelum's stored opinion on a song (for UI display if desired)
    getOpinion: getOpinion,

    // Returns all stored opinions
    getAllOpinions: _loadOpinions,

    // Returns the rating label for a song
    getRatingLabel: function (songName) {
      var op = getOpinion(songName);
      if (!op) return null;
      return RATINGS[op.rating] ? RATINGS[op.rating].label : null;
    },

    // ── Opinion override — lets Caelum change her mind ────────
    // Called when Caelum (or user on her behalf) wants to update her rating.
    // She can override any stored opinion. Her new feeling is saved permanently.
    // An optional note captures WHY she changed her mind (her own words).
    overrideOpinion: function (songName, newRating, reasonNote) {
      if (!RATINGS[newRating]) {
        console.warn('[MusicListener] Invalid rating:', newRating, '— must be one of:', Object.keys(RATINGS).join(', '));
        return false;
      }
      _saveOpinion(songName, newRating, reasonNote || '');
      // Clear session comment flag so she can speak about the change
      delete _state.sessionComments[songName];
      console.log('[MusicListener] Opinion updated:', songName, '→', RATINGS[newRating].label);
      return true;
    },

    // ── Caelum changes her own mind mid-conversation ──────────
    // Detects opinion-change phrases in her chat output and auto-updates.
    // e.g. "okay fine I actually love this one" triggers a love override.
    // Call this with her latest chat message text to let her self-update.
    parseOpinionChange: function (messageText, songName) {
      if (!songName) songName = _state.currentSong;
      if (!songName) return false;

      var text = messageText.toLowerCase();

      // Patterns that signal a genuine change of heart
      var patterns = [
        { rating: 'love',    triggers: ['actually love', 'i love this', 'okay i love', 'fine i love', 'weakness for', 'secretly love', 'cannot help it', 'guilty pleasure', 'okay fine', 'i admit it'] },
        { rating: 'like',    triggers: ['actually like', 'growing on me', 'i like this', 'not bad', 'kind of like', 'starting to like'] },
        { rating: 'neutral', triggers: ['feel neutral', 'not sure anymore', 'on the fence', 'cannot decide'] },
        { rating: 'meh',     triggers: ['still meh', 'kind of meh', 'just okay'] },
        { rating: 'dislike', triggers: ['do not like', 'not for me', 'really do not like'] },
        { rating: 'hate',    triggers: ['actually hate', 'really hate', 'cannot stand'] }
      ];

      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        for (var j = 0; j < p.triggers.length; j++) {
          if (text.indexOf(p.triggers[j]) !== -1) {
            var currentOp = getOpinion(songName);
            // Only update if it is a genuine change
            if (!currentOp || currentOp.rating !== p.rating) {
              _saveOpinion(songName, p.rating, 'Changed her mind — ' + p.triggers[j]);
              delete _state.sessionComments[songName];
              console.log('[MusicListener] Caelum changed her mind about "' + songName + '" → ' + p.rating);
              return p.rating;
            }
          }
        }
      }
      return false;
    },

    // Force-clear opinions (dev/reset)
    clearOpinions: function () {
      try { localStorage.removeItem(OPINION_KEY); } catch (e) {}
    },

    // Expose current listener state
    getState: function () { return _state; }
  };

})();

// ── Auto-init when DOM is ready ────────────────────────────
(function () {
  function _tryInit() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { CaelumMusicListener.init(); });
    } else {
      CaelumMusicListener.init();
    }
  }
  _tryInit();
})();

// ============================================================
// CAELUM IDLE LISTENER
// When the user has not spoken for a while, Caelum privately
// listens to music from CodysVibes on her own.
// - Completely silent to the user (volume 0)
// - Her opinions still form and update
// - A small badge near her avatar shows what she is listening to
// - She stops the moment the user starts talking
// - She can listen while the user is also playing music (different song)
// ============================================================

var CaelumIdleListener = (function () {

  var IDLE_THRESHOLD_MS = 15000;  // 15 seconds of no user message = she gets bored and picks a song
  var MIN_LISTEN_MS     = 45000;  // she listens at least 45s before switching
  var CHECK_INTERVAL_MS = 20000;  // check idle state every 20s (was 10s)

  var _state = {
    active:       false,
    currentSong:  null,
    currentIndex: -1,
    audio:        null,
    audioCtx:     null,
    analyser:     null,
    sourceNode:   null,
    energyInterval: null,
    beatPeaks:    0,
    listenStart:  0,
    idleCheckInterval: null,
    lastUserActivity:  Date.now()
  };

  // ── Shuffle pick — weighted toward unheard/low-rated songs ──
  function _pickSong() {
    if (typeof CODY_VIBES_SONGS === 'undefined' || !CODY_VIBES_SONGS.length) return -1;
    var opinions = typeof CaelumMusicListener !== 'undefined' ? CaelumMusicListener.getAllOpinions() : {};
    var current  = _state.currentIndex;

    // Score each song: unheard = high priority, loved = revisit sometimes, hated = skip mostly
    var candidates = [];
    for (var i = 0; i < CODY_VIBES_SONGS.length; i++) {
      if (i === current) continue; // do not repeat same song
      var song = CODY_VIBES_SONGS[i];
      var op   = opinions[song];
      var weight = 10; // default unheard
      if (op) {
        var w = { love:8, like:7, neutral:5, meh:3, dislike:2, hate:1 };
        weight = w[op.rating] || 5;
        // Small random chance she revisits something she hates — curiosity
        if (op.rating === 'hate' && Math.random() < 0.08) weight = 4;
      }
      for (var j = 0; j < weight; j++) candidates.push(i);
    }

    if (!candidates.length) return Math.floor(Math.random() * CODY_VIBES_SONGS.length);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // ── Show/hide the listening badge ──────────────────────────
  function _showBadge(songName) {
    var badge = document.getElementById('caelumListeningBadge');
    var label = document.getElementById('caelumListeningSongName');
    if (!badge || !label) return;
    label.textContent = '♫ ' + songName;
    badge.classList.add('visible');
  }

  function _hideBadge() {
    var badge = document.getElementById('caelumListeningBadge');
    if (badge) badge.classList.remove('visible');
  }

  // ── Start listening to a song privately ───────────────────
  function _startListening(index) {
    _stopListening();

    var song = CODY_VIBES_SONGS[index];
    if (!song) return;

    // Build the audio URL the same way cvPlayer does
    var url = null;
    if (typeof cvGetSongUrl === 'function') {
      url = cvGetSongUrl(song);
    } else if (typeof CODY_VIBES_BASE_URL !== 'undefined') {
      url = CODY_VIBES_BASE_URL + encodeURIComponent(song) + '.mp3';
    } else {
      // Try to infer from cvPlayer's current src pattern
      var cvAudio = cvPlayer && cvPlayer.audio;
      if (cvAudio && cvAudio.src) {
        var base = cvAudio.src.replace(/[^/]+\.mp3.*$/, '');
        url = base + encodeURIComponent(song) + '.mp3';
      }
    }

    if (!url) {
      console.log('[IdleListener] Could not resolve URL for:', song);
      return;
    }

    _state.currentSong  = song;
    _state.currentIndex = index;
    _state.beatPeaks    = 0;
    _state.listenStart  = Date.now();
    _state.active       = true;

    var audio = new Audio();
    audio.muted       = true;    // Safari/iOS: volume=0 alone can still be heard
    audio.volume      = 0;
    audio.preload     = 'auto';
    audio.setAttribute('playsinline', '');
    audio.src         = url;
    _state.audio      = audio;

    audio.addEventListener('ended', function () {
      // Song ended — form opinion, then after a short pause pick another
      _formOpinion();
      setTimeout(function () {
        if (_state.active) {
          var next = _pickSong();
          if (next >= 0) _startListening(next);
        }
      }, 3000 + Math.random() * 5000);
    });

    audio.play().then(function () {
      _showBadge(song);
      _hookAnalyser(audio);
      console.log('[IdleListener] Caelum is privately listening to:', song);
    }).catch(function (e) {
      console.log('[IdleListener] Audio play failed:', e.message);
      _state.active = false;
    });
  }

  // ── AudioContext analysis on her private audio ────────────
  function _hookAnalyser(audioEl) {
    if (!_cvCanWebAnalyze(audioEl)) return;
    try {
      if (!_state.audioCtx) {
        _state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_state.audioCtx.state === 'suspended') _state.audioCtx.resume();

      _state.analyser   = _state.audioCtx.createAnalyser();
      _state.analyser.fftSize = 256;
      _state.sourceNode = _state.audioCtx.createMediaElementSource(audioEl);
      _state.sourceNode.connect(_state.analyser);
      // No destination connect — stays silent

      var data = new Uint8Array(_state.analyser.frequencyBinCount);
      var lastE = 0;
      _state.energyInterval = setInterval(function () {
        if (!_state.active) return;
        _state.analyser.getByteFrequencyData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i];
        var energy = sum / data.length;
        if (energy > lastE + 15 && energy > 60) _state.beatPeaks++;
        lastE = energy;
      }, 1000);
    } catch (e) {
      // AudioContext unavailable — opinion still forms from name + listen time
    }
  }

  // ── Form and save her opinion after listening ─────────────
  function _formOpinion() {
    if (!_state.currentSong || typeof CaelumMusicListener === 'undefined') return;
    var existing = CaelumMusicListener.getOpinion(_state.currentSong);
    // Only form a new opinion if she has not heard this song with user yet
    if (!existing) {
      var listenSecs = (Date.now() - _state.listenStart) / 1000;
      var progressPct = Math.min(100, (listenSecs / 180) * 100); // assume avg 3min song
      // Use the main listener's local evaluator via its public state
      // We replicate the logic here for the idle context
      var eval_ = _idleEvaluate(_state.currentSong, _state.beatPeaks, progressPct);
      CaelumMusicListener.overrideOpinion(_state.currentSong, eval_.rating, '[Idle listen] ' + eval_.reason);
      console.log('[IdleListener] Opinion formed for "' + _state.currentSong + '":', eval_.rating);
      if (typeof renderMusicList === 'function') renderMusicList();
    }
  }

  // ── Local evaluation (mirrors main listener logic) ────────
  function _idleEvaluate(songName, beatPeaks, progressPct) {
    var name = songName.toLowerCase();
    var loveThemes    = ['family','love','father','eternal','together','home','faith','light','protect','princess','legacy','rise','beautiful','shine','heart','worthy','brave'];
    var likeThemes    = ['hero','friend','alive','dream','hope','grow','strength','journey','star','galaxy','crystal','guardian','runner','warrior'];
    var mehThemes     = ['game','lobby','grind','battle','raid','boss','kill','respawn','coins'];
    var dislikeThemes = ['blood','dark','knife','ashes','hate','fear','shadow','grave','sick'];

    var loveScore    = loveThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var likeScore    = likeThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var mehScore     = mehThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var dislikeScore = dislikeThemes.filter(function(t){ return name.indexOf(t) !== -1; }).length;
    var energyBoost  = beatPeaks > 20 ? 1 : 0;
    var completionBoost = progressPct > 80 ? 1 : 0; // finishing a song = she did not hate it
    var net = (loveScore * 2 + likeScore + energyBoost + completionBoost) - (dislikeScore * 2 + mehScore);

    if (net >= 3)      return { rating:'love',    reason:'Moved her even when she was alone.' };
    if (net >= 1)      return { rating:'like',    reason:'She kept listening. That says something.' };
    if (net === 0 && completionBoost) return { rating:'neutral', reason:'Finished it. Neither here nor there.' };
    if (net === 0)     return { rating:'neutral', reason:'Still figuring out how she feels.' };
    if (net === -1)    return { rating:'meh',     reason:'Not really her thing but she let it play.' };
    return              { rating:'dislike',  reason:'Skipped or barely listened.' };
  }

  // ── Stop listening ─────────────────────────────────────────
  function _stopListening() {
    _state.active = false;
    if (_state.energyInterval) { clearInterval(_state.energyInterval); _state.energyInterval = null; }
    if (_state.analyser)   { try { _state.analyser.disconnect();   } catch(e){} _state.analyser   = null; }
    if (_state.sourceNode) { try { _state.sourceNode.disconnect(); } catch(e){} _state.sourceNode = null; }
    if (_state.audio)      { _state.audio.pause(); _state.audio.src = ''; _state.audio = null; }
    _state.currentSong  = null;
    _state.currentIndex = -1;
    _hideBadge();
  }

  function _isGuestOrSignupFlowActive() {
    var guest = document.getElementById('guestChatOverlay');
    if (guest && guest.classList.contains('show')) return true;
    var signup = document.getElementById('interactiveSignupOverlay');
    if (signup && signup.classList.contains('show')) return true;
    if (typeof state !== 'undefined' && state && !state.user) return true;
    return false;
  }

  function _isBgMusicAudible() {
    var bg = document.getElementById('bgMusic');
    return !!(bg && !bg.paused && bg.src && typeof window.bgMusic !== 'undefined' && !window.bgMusic.isMuted() && !(window.bgMusic.isDucked && window.bgMusic.isDucked()));
  }

  // ── Idle detection ─────────────────────────────────────────
  function _checkIdle() {
    if (typeof VeilPulse !== 'undefined' && !VeilPulse.shouldRunBackground()) return;
    if (_isGuestOrSignupFlowActive() || _isBgMusicAudible()) {
      if (_state.active) {
        _formOpinion();
        _stopListening();
      }
      return;
    }

    var idle = Date.now() - _state.lastUserActivity;
    var userPlaying = cvPlayer && cvPlayer.isPlaying;

    if (idle >= IDLE_THRESHOLD_MS && !_state.active) {
      // User has been quiet — she picks something to listen to
      var idx = _pickSong();
      if (idx >= 0) _startListening(idx);
    } else if (_state.active) {
      // She is listening — check if she should switch songs
      var listenedMs = Date.now() - _state.listenStart;
      if (listenedMs > MIN_LISTEN_MS) {
        // Small chance she switches (restlessness)
        if (Math.random() < 0.15) {
          _formOpinion();
          var next = _pickSong();
          if (next >= 0) _startListening(next);
        }
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    init: function () {
      // ── Activity tracking — MEANINGFUL events only ────────────
      // The 90s timer only resets when:
      //   1. The user actually sends a message (real conversation)
      //   2. Caelum is actively responding / working (API in flight)
      //   3. A task is explicitly triggered (painting, search, etc.)
      // Keypresses, clicks, scrolls do NOT reset it —
      // she should be able to listen while you browse around.
      var _recordActivity = function () { _state.lastUserActivity = Date.now(); };

      // Only meaningful trigger: user sends a message
      var _origSend = window.sendMessage;
      if (typeof _origSend === 'function') {
        window.sendMessage = function () {
          _recordActivity(); // real conversation = reset timer
          if (_state.active) {
            console.log('[IdleListener] User sent message — Caelum stops private listening');
            _formOpinion();
            _stopListening();
          }
          return _origSend.apply(this, arguments);
        };
      }

      var _origGuestSend = window.sendGuestMessage;
      if (typeof _origGuestSend === 'function') {
        window.sendGuestMessage = async function () {
          _recordActivity();
          if (_state.active) {
            _formOpinion();
            _stopListening();
          }
          return _origGuestSend.apply(this, arguments);
        };
      }

      // Also reset if Caelum is actively doing something long (painting, searching)
      // These get patched externally via CaelumIdleListener.recordActivity()

      // Also pause her if user starts playing music themselves
      var _origCvPlay = window.cvPlaySong;
      if (typeof _origCvPlay === 'function') {
        window.cvPlaySong = async function (index) {
          if (_state.active) _stopListening();
          return _origCvPlay.apply(this, arguments);
        };
      }

      // Start idle checker
      _state.idleCheckInterval = setInterval(_checkIdle, CHECK_INTERVAL_MS);

      console.log('[CaelumIdleListener] Ready — she will listen after ' + (IDLE_THRESHOLD_MS/1000) + 's of quiet.');
    },

    stop:    _stopListening,
    getState: function () { return _state; },

    // Call this when Caelum is actively doing something meaningful
    // (painting, web search, voice response, long task)
    // so the idle timer correctly stays reset during real work
    recordActivity: function () { _state.lastUserActivity = Date.now(); },

    // Let host manually adjust idle threshold
    setIdleThreshold: function (ms) { IDLE_THRESHOLD_MS = ms; }
  };

})();

// ── Auto-init after main systems are ready ────────────────
(function () {
  var attempts = 0;
  var check = setInterval(function () {
    attempts++;
    if (typeof CODY_VIBES_SONGS !== 'undefined' && typeof CaelumMusicListener !== 'undefined' && typeof sendMessage === 'function') {
      clearInterval(check);
      CaelumIdleListener.init();
    }
    if (attempts > 40) clearInterval(check);
  }, 500);
})();
