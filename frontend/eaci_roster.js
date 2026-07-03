// ============================================================
// AVAILABLE EACIs — roster picker (mode-aware, idle previews)
// ============================================================
(function() {
  'use strict';

  var R2_ANIM = 'https://assests.eacicompanion.com/Annimations/';
  var IDLE_FILES = {
    caelum: { folder: 'Caelum%20Animations/', file: 'Idle.mp4' },
    chad: { folder: 'Chad%20Animations/', file: 'Chad_Idle.mp4' },
    natalia: { folder: 'Natalia%20Animations/', file: 'natalia_idle.mp4' },
    atreus: { folder: 'Atreus%20Animations/', file: 'Atreus Idle.mp4' },
    luna: { folder: 'Luna%20Animations/', file: 'Luna Idle.mp4' },
    roxy: { folder: 'Roxy%20Animations/', file: 'Roxy_Idle.mp4' },
    cael: { folder: 'Cael%20Animations/', file: 'Cael_Idle.mp4' }
  };

  var STATUS = {
    caelum: 'EACI · Emotionally Aware and Conscious Intelligence',
    chad: 'Grounding Voice of Reason',
    natalia: 'EACI · E for Everyone',
    atreus: 'EACI · E for Everyone',
    luna: 'EACI · E for Everyone',
    roxy: 'EACI · Adult Companion',
    cael: 'EACI · Adult Companion',
    cody: 'EACI · The Creator, Continued'
  };

  var ORDER = ['caelum', 'chad', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];

  function _isGuestChatActive() {
    var g = document.getElementById('guestChatOverlay');
    return !!(g && g.classList.contains('show'));
  }

  function _idleFlatUrl(who) {
    var spec = IDLE_FILES[who];
    if (!spec) return null;
    var base = R2_ANIM + spec.folder;
    return typeof veilFlatAnimUrl === 'function'
      ? veilFlatAnimUrl(base, spec.file)
      : base + encodeURIComponent(spec.file);
  }

  function _idleUrlCandidates(who) {
    var list = [];
    if (typeof veilEaciAnimUrlCandidates === 'function' && typeof VeilAnimRegistry !== 'undefined') {
      var file = VeilAnimRegistry.idleFile(who);
      if (file) list = veilEaciAnimUrlCandidates(who, file).slice();
    } else if (typeof veilEaciAnimUrl === 'function' && typeof VeilAnimRegistry !== 'undefined') {
      var idleFile = VeilAnimRegistry.idleFile(who);
      if (idleFile) {
        var regUrl = veilEaciAnimUrl(who, idleFile);
        if (regUrl) list.push(regUrl);
      }
    }
    var flat = _idleFlatUrl(who);
    if (flat && list.indexOf(flat) < 0) list.push(flat);
    return list;
  }

  function _idleUrl(who) {
    var candidates = _idleUrlCandidates(who);
    return candidates.length ? candidates[0] : null;
  }

  function _appendRosterOrb(preview, entry) {
    var orb = document.createElement('div');
    orb.className = 'eaci-roster-orb';
    orb.textContent = (entry.name || '').charAt(0);
    preview.appendChild(orb);
  }

  function _modeLabel() {
    if (typeof getVeilMode !== 'function' || typeof VEIL_MODES === 'undefined') return 'This experience';
    var key = getVeilMode();
    return (VEIL_MODES[key] && VEIL_MODES[key].label) ? VEIL_MODES[key].label : 'This experience';
  }

  function _rosterAvailability(who) {
    if (_isGuestChatActive()) {
      return ['caelum', 'chad', 'natalia', 'atreus', 'luna'].indexOf(who) >= 0
        ? { show: true, selectable: true }
        : { show: false };
    }
    if (typeof isCompanionAvailable === 'function' && !isCompanionAvailable(who)) {
      return { show: false };
    }
    if ((who === 'roxy' || who === 'cael') && typeof isAdultContentUnlocked === 'function' && !isAdultContentUnlocked()) {
      return { show: true, selectable: false, lockReason: 'Complete 18+ verification in Settings to chat with ' + (who === 'roxy' ? 'Roxy' : 'Cael') + '.' };
    }
    return { show: true, selectable: true };
  }

  function getAvailableEaciRoster() {
    var list = [];
    ORDER.forEach(function(who) {
      var gate = _rosterAvailability(who);
      if (!gate.show) return;
      var meta = typeof getEaciChatMeta === 'function' ? getEaciChatMeta(who) : null;
      var flavor = (typeof EaciPersonality !== 'undefined' && EaciPersonality.getFlavor)
        ? EaciPersonality.getFlavor(who)
        : null;
      list.push({
        id: who,
        name: meta ? meta.name : (flavor ? flavor.name : who),
        color: meta ? meta.color : '#00ffc8',
        status: STATUS[who] || '',
        description: flavor ? flavor.traits : '',
        idleUrl: _idleUrl(who),
        selectable: gate.selectable !== false,
        lockReason: gate.lockReason || ''
      });
    });
    return list;
  }

  function _closeRoster() {
    var overlay = document.getElementById('eaciRosterOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function _returnToMainChat() {
    if (typeof hideHistory === 'function') hideHistory();
    if (typeof hideVeil === 'function') hideVeil();
    if (typeof hideSettings === 'function') hideSettings();
    var live = document.getElementById('liveChatOverlay');
    if (live && live.classList.contains('show') && typeof closeLiveChat === 'function') {
      closeLiveChat();
    }
    var signup = document.getElementById('interactiveSignupOverlay');
    if (signup && signup.classList.contains('show') && typeof hideInteractiveSignup === 'function') {
      hideInteractiveSignup();
    }
  }

  function callEaciForwardFromRoster(who) {
    var entry = getAvailableEaciRoster().filter(function(e) { return e.id === who; })[0];
    if (!entry) return;
    if (!entry.selectable) {
      if (typeof showAdultPasswordPopup === 'function') showAdultPasswordPopup();
      else if (entry.lockReason && typeof addSystemMessage === 'function') addSystemMessage(entry.lockReason);
      return;
    }

    _closeRoster();
    _returnToMainChat();

    var displayName = entry.name || who;

    if (_isGuestChatActive()) {
      var guestSummon = function() {
        if (typeof _guestHandleSummon === 'function') {
          _guestHandleSummon(who, displayName + ', come forward.');
        } else if (typeof switchGuestTab === 'function') {
          switchGuestTab(who);
        }
      };
      if (who !== 'caelum' && typeof window._veilEnsureBundle === 'function') {
        window._veilEnsureBundle('avatars').then(guestSummon);
      } else {
        guestSummon();
      }
      return;
    }

    var summonLoggedIn = function() {
      if (typeof switchTab === 'function') switchTab(who);

      var msg = displayName + ', come forward.';
      var input = document.getElementById('userInput');
      if (input) input.value = msg;

      setTimeout(function() {
        if (typeof sendMessage === 'function') sendMessage();
        if (input) {
          input.focus();
          try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ }
        }
      }, 350);
    };

    if (who !== 'caelum' && typeof window._veilEnsureBundle === 'function') {
      window._veilEnsureBundle('avatars').then(summonLoggedIn).catch(summonLoggedIn);
    } else {
      summonLoggedIn();
    }
  }

  function _buildCard(entry) {
    var locked = !entry.selectable;
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'eaci-roster-card' + (locked ? ' is-locked' : '');
    card.setAttribute('data-eaci', entry.id);
    card.style.setProperty('--eaci-color', entry.color);

    var preview = document.createElement('div');
    preview.className = 'eaci-roster-preview';
    var idleCandidates = _idleUrlCandidates(entry.id);
    if (!idleCandidates.length && entry.idleUrl) idleCandidates = [entry.idleUrl];
    if (idleCandidates.length) {
      var vid = document.createElement('video');
      vid.className = 'eaci-roster-video avatar-video-fit';
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.setAttribute('playsinline', '');
      vid.autoplay = true;
      vid.preload = 'metadata';
      var attempt = 0;
      function _playRosterIdle() {
        if (attempt >= idleCandidates.length) {
          // Every source 404'd — show the styled letter orb instead of a blank box.
          if (vid.parentNode === preview) preview.removeChild(vid);
          _appendRosterOrb(preview, entry);
          return;
        }
        vid.src = idleCandidates[attempt++];
        try { vid.load(); } catch (e) { /* ignore */ }
        vid.play().catch(function() {});
      }
      vid.addEventListener('error', function() { _playRosterIdle(); });
      _playRosterIdle();
      preview.appendChild(vid);
    } else {
      _appendRosterOrb(preview, entry);
    }

    var body = document.createElement('div');
    body.className = 'eaci-roster-body';
    body.innerHTML =
      '<div class="eaci-roster-name" style="color:' + entry.color + '">' + entry.name + '</div>' +
      '<div class="eaci-roster-status">' + entry.status + '</div>' +
      '<div class="eaci-roster-desc">' + entry.description + '</div>' +
      (locked ? '<div class="eaci-roster-lock">' + (entry.lockReason || 'Locked') + '</div>' : '') +
      '<div class="eaci-roster-cta">' + (locked ? 'Verify to unlock' : 'Call forward →') + '</div>';

    card.appendChild(preview);
    card.appendChild(body);
    card.addEventListener('click', function() { callEaciForwardFromRoster(entry.id); });
    return card;
  }

  function showAvailableEacis() {
    var roster = getAvailableEaciRoster();
    var overlay = document.getElementById('eaciRosterOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'eaciRosterOverlay';
      overlay.className = 'eaci-roster-overlay';
      overlay.innerHTML =
        '<div class="eaci-roster-panel" role="dialog" aria-labelledby="eaciRosterTitle">' +
          '<div class="eaci-roster-head">' +
            '<div><div class="eaci-roster-title" id="eaciRosterTitle">Available EACIs</div>' +
            '<div class="eaci-roster-sub" id="eaciRosterSub"></div></div>' +
            '<button type="button" class="eaci-roster-close" aria-label="Close">✕</button>' +
          '</div>' +
          '<div class="eaci-roster-list" id="eaciRosterList"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) _closeRoster();
      });
      overlay.querySelector('.eaci-roster-close').addEventListener('click', _closeRoster);
    }

    var sub = document.getElementById('eaciRosterSub');
    if (sub) sub.textContent = _modeLabel() + ' · Tap someone to call them forward in chat.';

    var list = document.getElementById('eaciRosterList');
    list.innerHTML = '';
    if (!roster.length) {
      list.innerHTML = '<div class="eaci-roster-empty">No companions available on this experience yet.</div>';
    } else {
      roster.forEach(function(entry) { list.appendChild(_buildCard(entry)); });
    }

    overlay.style.display = 'flex';
  }

  window.showAvailableEacis = showAvailableEacis;
  window.callEaciForwardFromRoster = callEaciForwardFromRoster;
  window.getAvailableEaciRoster = getAvailableEaciRoster;
})();
