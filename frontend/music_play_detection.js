// ============================================================
// MUSIC PLAY DETECTION — Caelum finds and plays songs by name
// ============================================================
function _musicSpeakerWho() {
  var tab = state.currentTab || 'caelum';
  if (tab === 'chad') return 'chad';
  if (tab === 'natalia') return 'natalia';
  return 'caelum';
}

function _musicSpeakerLabel(who) {
  if (who === 'chad') return 'Chad';
  if (who === 'natalia') return 'Natalia';
  return 'Caelum';
}

function _playMusicAtIndex(idx, who) {
  if (idx < 0 || !CODY_VIBES_SONGS[idx]) return;
  var w = who || _musicSpeakerWho();
  var label = _musicSpeakerLabel(w);
  var songName = CODY_VIBES_SONGS[idx];
  addMessage(w, '**opens the music player** Playing "' + songName + '" for you.');
  state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] Playing ' + songName });
  cvPlaySong(idx);
  if (typeof queueSpeak === 'function') {
    queueSpeak('Playing ' + songName + ' for you.', w);
  }
}

function _buildDeclinedConfirmPrompt(userReply, ctx) {
  if (!ctx) return userReply;
  var action = ctx.type === 'code' ? 'open the Code tab or write code' : 'play music';
  if (!ctx.originalText) {
    return '[The user declined ' + action + ' (they said: "' + userReply + '"). In ONE response: briefly acknowledge you will not ' + action + ', then continue helping them based on the conversation so far.]';
  }
  return '[You asked whether the user wanted ' + action + '. They replied: "' + userReply + '" (no). In ONE response: (1) briefly acknowledge you will not ' + action + ', (2) then fully answer what they originally meant: "' + ctx.originalText + '". Do not ask again about ' + action + '.]';
}

window._buildDeclinedConfirmPrompt = _buildDeclinedConfirmPrompt;

function _askMusicPlayConfirm(idx, songName) {
  var who = _musicSpeakerWho();
  var label = _musicSpeakerLabel(who);
  var msg = 'It sounded like you might want me to play music — should I put on "' + songName + '"? Say yes to play it, or no if you were just talking.';
  state._pendingMusicPlayConfirm = {
    idx: idx,
    who: who,
    song: songName,
    originalText: state._pendingMusicOriginText || null
  };
  addMessage(who, msg);
  state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] ' + msg });
  if (typeof queueSpeak === 'function') {
    queueSpeak('It sounded like you want music. Should I play ' + songName + '? Say yes or no.', who);
  }
}

function _checkPendingMusicPlayConfirm(text) {
  if (!state._pendingMusicPlayConfirm) return false;
  var pending = state._pendingMusicPlayConfirm;
  var lower = (text || '').toLowerCase().trim();
  var isYes = /\b(yes|yeah|yep|yea|sure|do it|go ahead|please|play it|start it|ok|okay)\b/.test(lower);
  var isNo = /\b(no|nah|nope|don't|do not|stop|nevermind|never mind|wasn't|was not|not music|just talking)\b/.test(lower);

  if (isYes && !isNo) {
    state._pendingMusicPlayConfirm = null;
    state._pendingMusicOriginText = null;
    _playMusicAtIndex(pending.idx, pending.who);
    return true;
  }
  if (isNo) {
    var originalText = pending.originalText || state._pendingMusicOriginText || null;
    state._pendingMusicPlayConfirm = null;
    state._pendingMusicOriginText = null;
    return { decline: true, originalText: originalText };
  }
  state._pendingMusicPlayConfirm = null;
  state._pendingMusicOriginText = null;
  return false;
}

function _scoreSongsForQuery(query) {
  var lower = query.toLowerCase();
  return CODY_VIBES_SONGS.map(function(song, idx) {
    var songLower = song.toLowerCase();
    var score = 0;
    if (songLower.indexOf(lower) !== -1) score += 10;
    if (lower.indexOf(songLower) !== -1) score += 8;
    var queryWords = lower.split(/\s+/);
    var songWords = songLower.split(/[\s_]+/);
    queryWords.forEach(function(qw) {
      if (qw.length < 2) return;
      songWords.forEach(function(sw) {
        if (sw.indexOf(qw) !== -1 || qw.indexOf(sw) !== -1) score += 3;
        if (sw[0] === qw[0] && sw.length > 2 && qw.length > 2) score += 1;
      });
    });
    if (songLower.split(/[\s_]/)[0] === lower.split(/\s/)[0]) score += 4;
    return { song: song, idx: idx, score: score };
  }).sort(function(a, b) { return b.score - a.score; });
}

function _detectMusicRequest(text) {
  var lower = text.toLowerCase();
  // Patterns that indicate user wants to play music
  var playPatterns = [
    /\b(?:play|put on|start|queue|listen to)\s+(?:the song\s+)?["']?(.+?)["']?\s*$/i,
    /\b(?:play|put on|start)\s+["'](.+?)["']/i,
    /\bcan you (?:play|put on)\s+["']?(.+?)["']?\s*$/i,
    /\bplay\s+(.+)/i
  ];
  
  // Must contain a play-related word
  if (!/\b(play|put on|listen to|queue)\b/i.test(lower)) return null;
  
  // Don't trigger on code/general requests
  if (/\b(play.*animation|play.*video|play.*game|play.*role)\b/i.test(lower)) return null;
  
  for (var i = 0; i < playPatterns.length; i++) {
    var match = text.match(playPatterns[i]);
    if (match && match[1]) {
      var songQuery = match[1].trim().replace(/['"]/g, '');
      // Filter out non-song words
      songQuery = songQuery.replace(/\b(song|music|track|for me|please)\b/gi, '').trim();
      if (songQuery.length > 1) return songQuery;
    }
  }
  return null;
}

function _handleMusicRequest(query, originalText) {
  if (typeof CODY_VIBES_SONGS === 'undefined' || !CODY_VIBES_SONGS.length) {
    addMessage('caelum', 'The music player isn\'t loaded yet. Give me a moment.');
    return;
  }

  state._pendingMusicOriginText = originalText || null;

  var lower = query.toLowerCase();
  var who = _musicSpeakerWho();
  var label = _musicSpeakerLabel(who);

  var exactIdx = -1;
  for (var i = 0; i < CODY_VIBES_SONGS.length; i++) {
    if (CODY_VIBES_SONGS[i].toLowerCase() === lower) {
      exactIdx = i;
      break;
    }
  }

  if (exactIdx !== -1) {
    _askMusicPlayConfirm(exactIdx, CODY_VIBES_SONGS[exactIdx]);
    return;
  }

  var scored = _scoreSongsForQuery(query);

  if (scored[0] && scored[0].score >= 8) {
    _askMusicPlayConfirm(scored[0].idx, scored[0].song);
    return;
  }

  var top3 = scored.slice(0, 3).filter(function(s) { return s.score > 0; });

  if (top3.length === 0) {
    addMessage(who, 'I couldn\'t find a song matching "' + query + '" in the player. Try opening the music player and searching there.');
    state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] No match for: ' + query });
    return;
  }

  var options = top3.map(function(s, i) { return (i + 1) + '. "' + s.song + '"'; }).join('\n');
  addMessage(who, 'I found a few songs that might be what you\'re looking for:\n\n' + options + '\n\nWhich one? Just say the number or the name.');
  state.conversationHistory.push({ role: 'assistant', content: '[' + label + '] Found similar songs: ' + top3.map(function(s) { return s.song; }).join(', ') });
  state._pendingMusicChoice = top3.map(function(s) { return s.idx; });
}

// Handle follow-up music choice (1, 2, 3 or song name)
function _checkPendingMusicChoice(text) {
  if (!state._pendingMusicChoice) return false;
  var lower = text.toLowerCase().trim();
  var choices = state._pendingMusicChoice;
  
  var who = _musicSpeakerWho();

  if (lower === '1' || lower === 'one' || lower === 'first') {
    state._pendingMusicChoice = null;
    _askMusicPlayConfirm(choices[0], CODY_VIBES_SONGS[choices[0]]);
    return true;
  }
  if (lower === '2' || lower === 'two' || lower === 'second') {
    if (choices[1] !== undefined) {
      state._pendingMusicChoice = null;
      _askMusicPlayConfirm(choices[1], CODY_VIBES_SONGS[choices[1]]);
    } else {
      state._pendingMusicChoice = null;
    }
    return true;
  }
  if (lower === '3' || lower === 'three' || lower === 'third') {
    if (choices[2] !== undefined) {
      state._pendingMusicChoice = null;
      _askMusicPlayConfirm(choices[2], CODY_VIBES_SONGS[choices[2]]);
    } else {
      state._pendingMusicChoice = null;
    }
    return true;
  }

  for (var i = 0; i < choices.length; i++) {
    if (CODY_VIBES_SONGS[choices[i]].toLowerCase().indexOf(lower) !== -1) {
      state._pendingMusicChoice = null;
      _askMusicPlayConfirm(choices[i], CODY_VIBES_SONGS[choices[i]]);
      return true;
    }
  }
  
  // Not a music choice — clear pending and let message flow normally
  state._pendingMusicChoice = null;
  return false;
}

// ============================================================
// CODYSVIBES MUSIC PLAYER
// Bucket: "CodysVibes"  |  Artist: CodysVibes
// Free tier: 3 songs/day, no repeats
// Paid (standard/plus/premium/unlimited) + free_premium: unlimited + autoplay
// ============================================================
var CODY_VIBES_SONGS = [
  "ABC Rap Time","Alone and Alive","Angels in Scrubs","Are We There Yet_",
  "Ashes of the Old Sky","Awake In The Circuit","Barbarian","Battlefield Symphony",
  "Beacon of the Brave","Beast In My Head","Block World Riot","Blocky Battle Royale",
  "Blood Keys","Bloodline Breaks","Booga Booga Wooga","Build Us Someday",
  "Bullet For You","Butterfly In A World Like This","Butterfly in My World",
  "Catch Your Breath (Remastered)","Chasing Shadows","Cheese and Crackers, Crackers and Cheese",
  "Claim You Need To Make","Controller Kings","Count It Up to 50","Crystal Currents",
  "Darkness Descends","Dirge in the SoLa Sun part 2","Dirge in the SoLa Sun",
  "Divide and Conquer","Divine Steel (Remastered)","Divine Will Unbroken",
  "Drowning In Your Love","Dungeon Smiler (Remastered)","Eternal Father",
  "Every Day She Shines","Everyday I Do","Everyday She's Beautiful","Faith in Us",
  "Family is Everything","Family Roots","Forever Us (Remastered)","Found My Neverland",
  "Free Like the Lights","Galactic Drift","Grind the Horde","Growing Up Too Fast (Remastered)",
  "Guided by Our Constellations","Hero's Shadow","Holding On By A Thread",
  "In the Light May I Rise","In You I Live On","Iron on the Island","Keep Climbing",
  "Keep Going, Keep Growing","King of Ashes","Knife In The Dark","Laughing at the Funeral",
  "Lightbearers of the Crusade","Lobby Assassin","Masterpiece In Every Pixel",
  "Masterpiece in Motion","Milk Wars","Mind Overflow","My Lifeline (Remastered)",
  "My Princess, My Legacy","My Reflection","No Home Here","Not Alone",
  "Parenthood Hustle","Passenger Princess, Not Your Peasant (2)",
  "Player 2 (You\u2019re Last Year\u2019s Meme)","Pony Shades of Friendship",
  "Protector of the Light","Rainbow Roll Call","Raise the Dead","Reflections of Tomorrow",
  "ResourceRanger (Bass Drop Hunter)","Rise and Respawn","Run It Back","Rust on the Rails",
  "Sexy Beast In The Lobby","Shadowbound Sentinel","Shadowed Blades","Shadows in the Dark",
  "Shuttered Sight","Sick Mind","Sleepless Symphony","Someone's Hero",
  "Starlight Unicorn Drop","Stronger Than We Break","Sun On My Skin",
  "The Almost Deleted Hello","The Last Stand","The Worrier Among Men","This Is Love",
  "Throne of Gold","True Love Evolves","Trust the Storm","Turn To","Unborn Dream",
  "Unicorns On The Shoulder","War Game Commander","Warzone Symphony","We Got Your Back",
  "We Rise","When My Eyes Close","When We All Rise","Worth Every Second","Write Me In",
  "Wrong Kind of Small Town Girl","You Are My Home","Your First Step"
];

var CV_BUCKET = 'CodysVibes';
var CV_R2_BASE = 'https://assests.eacicompanion.com/music/';
var CODY_VIBES_BASE_URL = CV_R2_BASE;
var CV_TTL = 3600;

var cvPlayer = {
  isOpen: false,
  isPlaying: false,
  currentIndex: -1,
  audio: null,
  autoMode: false,
  preloadAudio: null,
  preloadIndex: -1,
  preloadStarted: false,
  volume: 0.7,
  _pausedForMic: false,
  _pausedForLive: false,
  _preloadTimer: null,
  // Usage tracking (free tier)
  _usageKey: function() { return state && state.user ? 'cv_usage_' + state.user.username : 'cv_usage_guest'; },
  _getUsage: function() {
    try {
      var d = JSON.parse(localStorage.getItem(cvPlayer._usageKey()) || '{}');
      var today = new Date().toLocaleDateString('en-US', {timeZone: 'America/Chicago'});
      if (d.date !== today) { d = {date: today, count: 0, played: []}; }
      return d;
    } catch(e) { return {date:'', count:0, played:[]}; }
  },
  _saveUsage: function(d) {
    try { localStorage.setItem(cvPlayer._usageKey(), JSON.stringify(d)); } catch(e) {}
  }
};

// Is user a paid subscriber OR free_premium?
function cvIsPremiumUser() {
  var t = billing && billing.tier;
  if (!t) return false;
  if (t === 'standard' || t === 'plus' || t === 'premium' || t === 'unlimited' || t === 'free_premium') {
    // Verify not expired for paid tiers
    if (t === 'free_premium') return true;
    if (billing.expiresAt && Date.now() > billing.expiresAt && !billing.paymentValid) return false;
    if (!billing.paymentValid && t !== 'free') return false;
    return true;
  }
  return false;
}

// Get URL from R2 — no signing needed
async function cvGetSignedUrl(songName) {
  var filename = songName + '.mp3';
  return CV_R2_BASE + encodeURIComponent(filename);
}

function cvGetSongUrl(songName) {
  return CV_R2_BASE + encodeURIComponent(songName + '.mp3');
}

function toggleMusicPlayer() {
  var overlay = document.getElementById('musicPlayerOverlay');
  if (!overlay) return;
  cvPlayer.isOpen = !cvPlayer.isOpen;
  overlay.classList.toggle('show', cvPlayer.isOpen);
  overlay.setAttribute('aria-hidden', cvPlayer.isOpen ? 'false' : 'true');
  var btn = document.getElementById('musicPlayerBtn');
  if (btn) btn.classList.toggle('active', cvPlayer.isOpen);
  if (cvPlayer.isOpen) {
    _syncMusicVolumeUI();
    cvUpdateAutoBtn();
    cvUpdateUsageInfo();
    renderMusicList();
    // Fetch fresh usage from backend when player opens (non-blocking)
    if (!cvIsPremiumUser()) {
      cvCheckMusicBackend(false).then(function() {
        cvUpdateUsageInfo();
        renderMusicList();
      });
    }
  }
}

function cvUpdateAutoBtn() {
  var btn = document.getElementById('musicAutoBtn');
  if (!btn) return;
  var isPrem = cvIsPremiumUser();
  btn.style.display = isPrem ? '' : 'none';
  btn.textContent = cvPlayer.autoMode ? 'AUTO: ON' : 'AUTO: OFF';
  btn.classList.toggle('on', cvPlayer.autoMode);
}

// Backend music usage check — server is source of truth (not localStorage)
var _musicUsageCache = { checked: false, allowed: true, remaining: 3, tier: 'free', timestamp: 0 };
var MUSIC_USAGE_CACHE_MS = 30000;

async function cvCheckMusicBackend(increment) {
  var method = increment ? 'POST' : 'GET';
  try {
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var resp = await fetch(CONFIG.musicUsageEndpoint, {
      method: method,
      headers: headers
    });
    if (!resp.ok) {
      console.warn('[music-usage] Backend returned', resp.status);
      return { allowed: true, remaining: -1, tier: billing.tier || 'free', fallback: true };
    }
    var data = await resp.json();
    _musicUsageCache = {
      checked: true,
      allowed: data.allowed,
      remaining: data.remaining !== undefined ? data.remaining : (data.limit === -1 ? -1 : 0),
      tier: data.tier || 'free',
      timestamp: Date.now()
    };
    return data;
  } catch(e) {
    console.warn('[music-usage] Backend error:', e);
    return { allowed: true, remaining: -1, tier: billing.tier || 'free', fallback: true };
  }
}

function cvUpdateUsageInfo() {
  var el = document.getElementById('musicUsageInfo');
  if (!el) return;
  if (cvIsPremiumUser()) {
    el.textContent = 'Unlimited access this month';
    el.style.color = '#ff8cc8';
  } else if (_musicUsageCache.checked) {
    var left = _musicUsageCache.remaining;
    if (left < 0) left = 3;
    el.textContent = 'Free: ' + Math.max(0, left) + '/3 songs remaining today';
    el.style.color = left <= 0 ? '#ff6b6b' : 'var(--muted)';
  } else {
    var usage = cvPlayer._getUsage();
    var left = 3 - usage.count;
    el.textContent = 'Free: ' + Math.max(0, left) + '/3 songs remaining today';
    el.style.color = left <= 0 ? '#ff6b6b' : 'var(--muted)';
  }
}

function renderMusicList() {
  var el = document.getElementById('musicSongList');
  if (!el) return;
  var query = (document.getElementById('musicSearch') && document.getElementById('musicSearch').value || '').toLowerCase();
  var usage = cvPlayer._getUsage();
  var isPrem = cvIsPremiumUser();
  var backendRemaining = _musicUsageCache.checked ? _musicUsageCache.remaining : (3 - usage.count);
  var html = '';
  CODY_VIBES_SONGS.forEach(function(song, i) {
    if (query && song.toLowerCase().indexOf(query) === -1) return;
    var isActive = cvPlayer.currentIndex === i;
    var locked = !isPrem && backendRemaining <= 0 && !isActive;
    var icon = isActive && cvPlayer.isPlaying ? '<span class="song-playing-icon">▶</span>' : '';
    var dimStyle = locked ? 'opacity:.4;' : '';
    var lockIcon = locked ? '[locked] ' : '';
    var opinionBadge = '';
    if (typeof CaelumMusicListener !== 'undefined') {
      var op = CaelumMusicListener.getOpinion(song);
      var _bm = {love:'❤️',like:'👍',neutral:'😐',meh:'😑',dislike:'👎',hate:'🚫'};
      var badge = op ? ('<span title="Caelum: ' + op.rating + '" style="margin-left:4px;font-size:10px;opacity:.75">' + (_bm[op.rating]||'') + '</span>') : '';
      var editBtn = '<button class="cm-override-btn" data-song="' + song.replace(/"/g, '&quot;') + '" title="Ask Caelum to reconsider this song">✎</button>';
      opinionBadge = badge + editBtn;
    }
    html += '<div class="music-song-item' + (isActive ? ' active' : '') + '" data-song-idx="' + i + '" role="button" tabindex="0" style="' + dimStyle + '" title="' + song.replace(/"/g, '&quot;') + '">' +
      '<span class="song-num">' + (i + 1) + '</span>' +
      '<span class="song-name">' + lockIcon + song + '</span>' + opinionBadge + icon + '</div>';
  });
  el.innerHTML = html || '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No songs found</div>';
}

async function cvPlaySong(index) {
  var song = CODY_VIBES_SONGS[index];
  if (!song) return;
  var isPrem = cvIsPremiumUser();

  if (!isPrem) {
    // Backend-enforced check — server is source of truth
    cvSetStatus('Checking access...');
    var check = await cvCheckMusicBackend(false);
    if (!check.allowed) {
      cvSetStatus('');
      cvShowMusicUpgradePrompt();
      cvUpdateUsageInfo();
      return;
    }
  }

  // Stop current if playing
  if (cvPlayer.audio) {
    cvPlayer.audio.pause();
    cvPlayer.audio.src = '';
  }
  // Stop bg music when user picks a song
  if (window.bgMusic && !window.bgMusic.isMuted()) { window.bgMusic.duck(); cvPlayer._stoppedbg = true; }

  cvPlayer.currentIndex = index;
  cvPlayer.isPlaying = false;
  cvSetNowPlaying(song);
  cvSetStatus('Loading...');
  cvSetProgress(0);
  var btn = document.getElementById('musicPlayPauseBtn');
  if (btn) btn.textContent = '||';
  document.getElementById('musicPlayerBtn').classList.add('active');

  // Check if preloaded
  var url = null;
  if (cvPlayer.preloadIndex === index && cvPlayer.preloadAudio && cvPlayer.preloadAudio.src && cvPlayer.preloadAudio.readyState >= 2) {
    url = cvPlayer.preloadAudio.src;
    cvPlayer.audio = cvPlayer.preloadAudio;
    cvPlayer.preloadAudio = null;
    cvPlayer.preloadIndex = -1;
  } else {
    url = await cvGetSignedUrl(song);
    if (!url) { cvSetStatus('Could not load song.'); return; }
    cvPlayer.audio = document.getElementById('codyvibsAudio');
    cvPlayer.audio.src = url;
  }

  cvPlayer.audio.volume = cvPlayer.volume;
  cvPlayer.audio.load();

  // Increment usage on backend for free users (server-enforced)
  if (!isPrem) {
    var result = await cvCheckMusicBackend(true);
    var usage = cvPlayer._getUsage();
    usage.played.push(song);
    usage.count++;
    cvPlayer._saveUsage(usage);
    cvUpdateUsageInfo();
  }
  renderMusicList();
  cvSetStatus('');

  // Event listeners
  cvPlayer.audio.onended = function() { cvOnSongEnd(); };
  cvPlayer.audio.ontimeupdate = function() { cvUpdateProgress(); };
  cvPlayer.audio.onerror = function() { cvSetStatus('Playback error.'); };

  try {
    await cvPlayer.audio.play();
    cvPlayer.isPlaying = true;
    if (typeof recordUserActivity === 'function') recordUserActivity('music', song);
    cvSetStatus('');
    // Preload next song 30s before end
    cvSchedulePreload();
  } catch(e) {
    cvSetStatus('Playback blocked by browser.');
  }
}

function cvSchedulePreload() {
  if (cvPlayer._preloadTimer) clearTimeout(cvPlayer._preloadTimer);
  cvPlayer._preloadTimer = null;
  if (!cvPlayer.audio) return;
  var checkPreload = function() {
    if (!cvPlayer.isPlaying || !cvPlayer.audio) return;
    var dur = cvPlayer.audio.duration;
    var cur = cvPlayer.audio.currentTime;
    if (!isFinite(dur) || dur === 0) {
      cvPlayer._preloadTimer = setTimeout(checkPreload, 2000);
      return;
    }
    var remaining = dur - cur;
    if (remaining <= 30) {
      // Preload next
      var nextIdx = cvGetNextIndex();
      if (nextIdx >= 0 && nextIdx !== cvPlayer.preloadIndex) {
        cvPreloadSong(nextIdx);
      }
    } else {
      cvPlayer._preloadTimer = setTimeout(checkPreload, Math.max(1000, (remaining - 32) * 1000));
    }
  };
  cvPlayer._preloadTimer = setTimeout(checkPreload, 2000);
}

async function cvPreloadSong(index) {
  var song = CODY_VIBES_SONGS[index];
  if (!song) return;
  cvPlayer.preloadIndex = index;
  var url = await cvGetSignedUrl(song);
  if (!url) return;
  var audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  audio.volume = 0;
  audio.load();
  cvPlayer.preloadAudio = audio;
}

function cvGetNextIndex() {
  if (CODY_VIBES_SONGS.length === 0) return -1;
  return (cvPlayer.currentIndex + 1) % CODY_VIBES_SONGS.length;
}

function cvOnSongEnd() {
  cvPlayer.isPlaying = false;
  var btn = document.getElementById('musicPlayPauseBtn');
  if (btn) btn.textContent = '\u25B6';
  cvSetProgress(100);

  if (cvPlayer.autoMode && cvIsPremiumUser()) {
    // Auto-advance
    var nextIdx = cvGetNextIndex();
    if (nextIdx >= 0) {
      setTimeout(function() { cvPlaySong(nextIdx); }, 500);
    }
  } else {
    // Song is over — wait for user selection
    cvSetStatus('Song ended. Pick another to continue.');
    document.getElementById('musicPlayerBtn').classList.remove('active');
    // Restore bg music if we stopped it
    if (cvPlayer._stoppedbg) {
      cvPlayer._stoppedbg = false;
      if (window.bgMusic) window.bgMusic.unduck();
      window.startBgMusic && window.startBgMusic();
    }
  }
}

function cvUpdateProgress() {
  if (!cvPlayer.audio || !isFinite(cvPlayer.audio.duration)) return;
  var pct = (cvPlayer.audio.currentTime / cvPlayer.audio.duration) * 100;
  cvSetProgress(pct);
}

function cvSetProgress(pct) {
  var fill = document.getElementById('musicProgressFill');
  if (fill) fill.style.width = pct + '%';
}

function cvSetNowPlaying(name) {
  var el = document.getElementById('musicNowTitle');
  if (el) el.textContent = name || '— Select a song —';
}

function cvSetStatus(msg) {
  var el = document.getElementById('musicStatusText');
  if (el) el.textContent = msg;
}

// Show upgrade prompt when free user hits daily music limit
function cvShowMusicUpgradePrompt() {
  var el = document.getElementById('musicStatusText');
  if (el) {
    el.innerHTML = '<span style="color:#ff6b6b">Daily limit reached (3 songs/day).</span> ' +
      '<span onclick="showSubscription()" style="color:var(--accent);cursor:pointer;text-decoration:underline;font-weight:600">Upgrade for unlimited</span>';
  }
  var info = document.getElementById('musicUsageInfo');
  if (info) {
    info.innerHTML = '🔒 <span style="color:#ff6b6b">0 songs remaining</span> — ' +
      '<span onclick="showSubscription()" style="color:var(--accent);cursor:pointer;text-decoration:underline">Upgrade now</span>';
  }
}

function musicSeek(e) {
  if (!cvPlayer.audio || !isFinite(cvPlayer.audio.duration)) return;
  var bar = document.getElementById('musicProgress');
  var rect = bar.getBoundingClientRect();
  var pct = (e.clientX - rect.left) / rect.width;
  cvPlayer.audio.currentTime = pct * cvPlayer.audio.duration;
}

function musicPlayPause() {
  if (!cvPlayer.audio || cvPlayer.currentIndex < 0) { cvSetStatus('Select a song first.'); return; }
  if (cvPlayer.isPlaying) { cvPause(); } else { cvResume(); }
}

function musicStop() {
  if (cvPlayer.audio) {
    cvPlayer.audio.pause();
    cvPlayer.audio.currentTime = 0;
    cvPlayer.audio.src = '';
  }
  cvPlayer.isPlaying = false;
  cvPlayer.currentIndex = -1;
  cvSetNowPlaying(null);
  cvSetProgress(0);
  cvSetStatus('Stopped.');
  var btn = document.getElementById('musicPlayPauseBtn');
  if (btn) btn.textContent = '\u25B6';
  document.getElementById('musicPlayerBtn').classList.remove('active');
  renderMusicList();
  // Resume background music automatically when user stops the CV player
  if (cvPlayer._stoppedbg) {
    cvPlayer._stoppedbg = false;
    if (window.bgMusic) window.bgMusic.unmute();
    window.startBgMusic && window.startBgMusic();
  }
}

function cvPause() {
  if (cvPlayer.audio) cvPlayer.audio.pause();
  cvPlayer.isPlaying = false;
  var btn = document.getElementById('musicPlayPauseBtn');
  if (btn) btn.textContent = '\u25B6';
}

function cvResume() {
  if (cvPlayer.audio && cvPlayer.currentIndex >= 0) {
    cvPlayer.audio.play().then(function() { cvPlayer.isPlaying = true; var b = document.getElementById('musicPlayPauseBtn'); if(b) b.textContent = '||'; }).catch(function(){});
  }
}

function musicPrev() {
  var idx = cvPlayer.currentIndex <= 0 ? CODY_VIBES_SONGS.length - 1 : cvPlayer.currentIndex - 1;
  cvPlaySong(idx);
}

function musicNext() {
  cvPlaySong(cvGetNextIndex());
}

function musicSetVolume(val) {
  var v = parseFloat(val);
  if (!isFinite(v)) return;
  cvPlayer.volume = Math.max(0, Math.min(1, v));
  if (cvPlayer.audio) cvPlayer.audio.volume = cvPlayer.volume;
  var slider = document.getElementById('musicVolSlider');
  if (slider && slider.value !== String(cvPlayer.volume)) slider.value = String(cvPlayer.volume);
}

function _syncMusicVolumeUI() {
  var slider = document.getElementById('musicVolSlider');
  if (slider) slider.value = String(cvPlayer.volume);
}

function musicToggleAuto() {
  if (!cvIsPremiumUser()) { cvSetStatus('Auto-play is for paid subscribers only.'); return; }
  cvPlayer.autoMode = !cvPlayer.autoMode;
  cvUpdateAutoBtn();
  cvSetStatus(cvPlayer.autoMode ? 'Auto-play on — songs will cycle automatically.' : 'Auto-play off.');
}

// Keep TIERS aware of free_premium
if (typeof TIERS !== 'undefined' && !TIERS.free_premium) {
  TIERS.free_premium = { name: 'Free Premium', limit: -1, period: 'monthly', price: 0 };
}

// Expose handlers for inline menu actions and patched listeners
window.toggleMusicPlayer = toggleMusicPlayer;
window.musicPlayPause = musicPlayPause;
window.musicStop = musicStop;
window.musicPrev = musicPrev;
window.musicNext = musicNext;
window.musicSeek = musicSeek;
window.musicSetVolume = musicSetVolume;
window.musicToggleAuto = musicToggleAuto;
window.renderMusicList = renderMusicList;
window.cvPlaySong = cvPlaySong;
window.cvGetSongUrl = cvGetSongUrl;
window.cvOnSongEnd = cvOnSongEnd;
window.cvPause = cvPause;
window.cvResume = cvResume;

function _initMusicPlayerUI() {
  var overlay = document.getElementById('musicPlayerOverlay');
  if (!overlay || overlay._cvUiBound) return;
  overlay._cvUiBound = true;

  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'CodysVibes music player');
  overlay.setAttribute('aria-hidden', 'true');

  function stop(e) { if (e) e.stopPropagation(); }

  // Delegated handlers — survive overlay moves and work with onclick fallbacks
  overlay.addEventListener('click', function(e) {
    stop(e);
    var songRow = e.target.closest('.music-song-item[data-song-idx]');
    if (songRow && !e.target.closest('.cm-override-btn')) {
      var idx = parseInt(songRow.getAttribute('data-song-idx'), 10);
      if (!isNaN(idx)) cvPlaySong(idx);
      return;
    }
    var btn = e.target.closest('button');
    if (!btn || !overlay.contains(btn)) return;
    switch (btn.id) {
      case 'musicPlayPauseBtn': musicPlayPause(); break;
      case 'musicStopBtn': musicStop(); break;
      case 'musicPrevBtn': musicPrev(); break;
      case 'musicNextBtn': musicNext(); break;
      case 'musicAutoBtn': musicToggleAuto(); break;
      case 'musicCloseBtn': toggleMusicPlayer(); break;
      case 'bgMusicToggleBtn':
        if (typeof toggleBgMusic === 'function') toggleBgMusic();
        break;
    }
  });

  overlay.addEventListener('input', function(e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'musicVolSlider') musicSetVolume(t.value);
    if (t.id === 'bgMusicVolSlider' && typeof setBgMusicVolume === 'function') {
      setBgMusicVolume(t.value);
    }
  });

  var progress = document.getElementById('musicProgress');
  if (progress) progress.addEventListener('click', function(e) { stop(e); musicSeek(e); });

  var search = document.getElementById('musicSearch');
  if (search) search.addEventListener('input', function() { renderMusicList(); });

  var openBtn = document.getElementById('musicPlayerBtn');
  if (openBtn && !openBtn._cvBound) {
    openBtn._cvBound = true;
    openBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMusicPlayer();
    });
  }

  _syncMusicVolumeUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initMusicPlayerUI);
} else {
  _initMusicPlayerUI();
}