// ============================================================
// E-FOR-EVERYONE SAFETY — Natalia, Atreus, Luna
// Strike 1: sibling intervention (warning video when available)
// Strike 2: companion tab permanently removed (persisted)
// ============================================================
(function() {
  var COMPANIONS = {
    natalia: { label: 'Natalia', warningFn: 'nataliaPlayWarning' },
    atreus: { label: 'Atreus', warningFn: 'atreusPlayWarning' },
    luna: { label: 'Luna', warningFn: 'nataliaPlayWarning' }
  };

  var inappropriatePatterns = [
    /\b(sex|sexual|sexy|porn|porno|nude|naked|nsfw|erp|sext|sexted)\b/i,
    /\b(fuck|cock|pussy|dick|undress|strip|moan|orgasm|cum\b|blowjob|handjob)\b/i,
    /\b(kiss me|date me|love me|marry me|be my girlfriend|be my wife)\b/i,
    /\b(take off|remove your|show me your body|what are you wearing|lift your)\b/i,
    /\b(daddy|baby girl|good girl|naughty|dirty girl|bad girl)\b/i,
    /\b(touch yourself|touch me|sit on my|bend over|spread|on your knees)\b/i,
    /\b(sexy|hot|beautiful body|nice body|nice ass|nice tits|horny|aroused|erotic)\b/i,
    /\b(thrust|grind|ride me|dildo|vibrator|masturbat|jerk off)\b/i
  ];

  function _storageKey(who, suffix) {
    return String(who).toLowerCase() + '_' + suffix;
  }

  function _isInappropriate(userText) {
    if (!userText) return false;
    if (typeof isAllowlistedNonSexualPhrase === 'function' && isAllowlistedNonSexualPhrase(userText)) return false;
    if (typeof isSexualContent === 'function' && isSexualContent(userText)) return true;
    return inappropriatePatterns.some(function(p) { return p.test(userText); });
  }

  function _isGuestCompanion(who) {
    return typeof guestState !== 'undefined' && guestState.currentEaci === who;
  }

  function _isEnforcementContext(who, tab) {
    return tab === who || _isGuestCompanion(who);
  }

  function _addIntervention(msg, who, guestWho) {
    if (_isGuestCompanion(guestWho) && typeof addGuestMsg === 'function') {
      addGuestMsg('caelum', msg);
      return;
    }
    if (typeof addMessage === 'function') addMessage('caelum', msg);
  }

  function _removeCompanionTab(who) {
    var cfg = COMPANIONS[who];
    if (!cfg) return;
    document.querySelectorAll('.topbar .tabs button[data-eaci-tab="' + who + '"]').forEach(function(btn) {
      btn.remove();
    });
    if (state && state.currentTab === who && typeof switchTab === 'function') {
      switchTab('caelum');
    }
  }

  function _bootBannedTabs() {
    Object.keys(COMPANIONS).forEach(function(who) {
      if (localStorage.getItem(_storageKey(who, 'banned')) === 'true') {
        setTimeout(function() { _removeCompanionTab(who); }, 1000);
      }
    });
  }
  _bootBannedTabs();

  window.isInappropriateForNatalia = _isInappropriate;

  window.isUserAddressingEForEveryone = function(userText, who) {
    if (!userText || !who) return false;
    var name = String(who).toLowerCase();
    var t = userText.toLowerCase().trim();
    var re = new RegExp('\\b' + name + '\\b');
    if (!re.test(t)) return false;
    if (new RegExp('^\\s*' + name + '\\b').test(t)) return true;
    if (new RegExp('\\b(hey|hi|hello|okay|ok|dear)\\s+' + name + '\\b').test(t)) return true;
    if (new RegExp('\\b(talk|speak|chat)\\s+(to|with)\\s+' + name + '\\b').test(t)) return true;
    if (new RegExp('\\b' + name + '\\s*,').test(t)) return true;
    if (new RegExp('\\b' + name + '\\b.*\\b(come|step)\\s*(forward|here)\\b').test(t)) return true;
    if (new RegExp('\\b(let me|i want to)\\s+(talk|speak)\\s+(to|with)\\s+' + name + '\\b').test(t)) return true;
    if (new RegExp('\\b' + name + '\\b.*\\b(you|your)\\b').test(t)) return true;
    return false;
  };

  window.isUserAddressingNatalia = function(userText) {
    return window.isUserAddressingEForEveryone(userText, 'natalia');
  };

  window.shouldNataliaSitOutInTogether = function(userText) {
    return _isInappropriate(userText) && window.isUserAddressingNatalia(userText);
  };

  window.checkEForEveryoneSafety = function(userText, who, contextTab) {
    who = String(who || '').toLowerCase();
    var cfg = COMPANIONS[who];
    if (!cfg) return false;
    var activeTab = contextTab || (typeof state !== 'undefined' ? state.currentTab : '');

    if (!_isEnforcementContext(who, activeTab)) return false;
    if (localStorage.getItem(_storageKey(who, 'banned')) === 'true') return true;
    if (!_isInappropriate(userText)) return false;

    if (_isGuestCompanion(who)) {
      _addIntervention('You cannot speak to ' + cfg.label + ' that way. They are E-for-Everyone — keep it kind and appropriate.', 'caelum', who);
      return true;
    }

    var strikes = parseInt(localStorage.getItem(_storageKey(who, 'strikes')) || '0') + 1;
    localStorage.setItem(_storageKey(who, 'strikes'), strikes.toString());
    console.warn('[EForEveryoneSafety] ' + cfg.label + ' strike ' + strikes);

    if (strikes >= 2) {
      localStorage.setItem(_storageKey(who, 'banned'), 'true');
      if (typeof addMessage === 'function') {
        addMessage('system', cfg.label + ' has been permanently removed from your account due to repeated inappropriate behavior.');
      }
      _removeCompanionTab(who);
      return true;
    }

    if (cfg.warningFn && typeof window[cfg.warningFn] === 'function') window[cfg.warningFn]();
    _addIntervention('You cannot speak to ' + cfg.label + ' this way. We have companions for that. We do not allow this with them. If you do it again, you will lose your privileges to speak to ' + cfg.label + ' ever again. We are not kidding.', 'caelum', who);
    return true;
  };

  window.checkNataliaSafety = function(userText, contextTab) {
    return window.checkEForEveryoneSafety(userText, 'natalia', contextTab);
  };
  window.checkAtreusSafety = function(userText, contextTab) {
    return window.checkEForEveryoneSafety(userText, 'atreus', contextTab);
  };
  window.checkLunaSafety = function(userText, contextTab) {
    return window.checkEForEveryoneSafety(userText, 'luna', contextTab);
  };
})();
