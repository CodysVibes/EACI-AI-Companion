// ============================================================
// CAELUM CHECK-IN NOTIFICATIONS — caring pings on installed devices
// Requires notification permission + signed-in user.
// ============================================================
var CaelumCheckins = (function() {
  'use strict';

  var MIN_INTERVAL_MS = 3 * 60 * 60 * 1000;
  var MAX_INTERVAL_MS = 9 * 60 * 60 * 1000;
  var ACTIVE_QUIET_MS = 2 * 60 * 60 * 1000;
  var _clientTimer = null;
  var _started = false;

  // Some browsers (iOS Safari, certain Android webviews) do not expose the
  // global Notification object. Reading Notification.permission directly there
  // throws a ReferenceError, so always go through this safe accessor.
  function _notifPerm() {
    return (typeof Notification !== 'undefined' && Notification.permission) || 'denied';
  }

  var MESSAGES = {
    morning: [
      'Good morning, {name}. I hope today starts gently for you.',
      'Hey {name} — just wanted to say I am here if you need me today.',
      'Morning, {name}. Take a breath before the day pulls you in every direction.'
    ],
    afternoon: [
      'Hey {name}, checking in — how is your day going so far?',
      'Just thinking about you, {name}. Hope the afternoon is treating you kindly.',
      '{name}, if your day has been heavy, you do not have to carry it alone.'
    ],
    evening: [
      'Evening, {name}. However today went, I am glad you exist.',
      'Hey {name} — winding down? I am here if you want to talk.',
      '{name}, you made it through another day. That matters more than you think.'
    ],
    night: [
      'Hey {name}. If you are still up, I am here with you.',
      'Night check-in, {name}. Rest when you can — I will be here tomorrow too.',
      '{name}, be gentle with yourself tonight. You deserve softness.'
    ],
    general: [
      'Hey {name}, just checking in. You do not have to reply — I just wanted you to know I care.',
      '{name}, I was thinking about you. Hope you are okay.',
      'Hi {name}. Whenever you are ready, I would love to hear how you are doing.',
      '{name}, you crossed my mind. I am here if you need me.',
      'Just a little nudge from me, {name} — you are not alone in this.'
    ]
  };

  function _timeBucket() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 22) return 'evening';
    return 'night';
  }

  function _userName() {
    if (typeof state !== 'undefined' && state.user && state.user.firstName) {
      return state.user.firstName;
    }
    return 'friend';
  }

  function _pickMessage() {
    var bucket = _timeBucket();
    var list = MESSAGES[bucket] || MESSAGES.general;
    var template = list[Math.floor(Math.random() * list.length)];
    return template.replace(/\{name\}/g, _userName());
  }

  function _computeDelay() {
    var base = MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
    if (typeof state !== 'undefined' && state.lastActiveTimestamp) {
      var sinceActive = Date.now() - (typeof getLastSessionEndMs === 'function'
        ? getLastSessionEndMs()
        : state.lastActiveTimestamp);
      if (sinceActive < ACTIVE_QUIET_MS) {
        base = Math.max(base, ACTIVE_QUIET_MS - sinceActive + MIN_INTERVAL_MS);
      }
    }
    return Math.round(base);
  }

  async function _getRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await navigator.serviceWorker.ready;
    } catch (e) {
      return null;
    }
  }

  async function _armServiceWorker(delayMs, title, body) {
    var reg = await _getRegistration();
    var at = Date.now() + delayMs;
    var payload = {
      type: 'ARM_CAELUM_CHECKIN',
      delayMs: delayMs,
      at: at,
      title: title,
      body: body,
      icon: '/icon-192.png'
    };
    if (reg && reg.active) {
      reg.active.postMessage(payload);
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    }
    try {
      localStorage.setItem('veil_checkin_next_at', String(at));
      localStorage.setItem('veil_checkin_body', body);
    } catch (e) { /* ignore */ }
  }

  async function _showNotification(title, body) {
    var options = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'caelum-checkin',
      data: '/',
      vibrate: [80, 40, 80],
      requireInteraction: false
    };
    var reg = await _getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, options);
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }

  async function _fireCheckin() {
    if (_notifPerm() !== 'granted') return;
    if (!state || !state.user) return;

    var body = _pickMessage();
    var title = 'Caelum';
    try {
      var stored = localStorage.getItem('veil_checkin_body');
      if (stored) body = stored;
    } catch (e) { /* ignore */ }

    await _showNotification(title, body);
    try {
      localStorage.setItem('veil_last_checkin', String(Date.now()));
      localStorage.removeItem('veil_checkin_body');
    } catch (e) { /* ignore */ }

    if (typeof recordEaciOutbound === 'function') {
      recordEaciOutbound('caelum', body, { source: 'notification_checkin' });
    } else {
      try {
        localStorage.setItem('veil_last_checkin_message', JSON.stringify({ body: body, at: Date.now() }));
      } catch (e) { /* ignore */ }
    }
    if (typeof AutonomyLogger !== 'undefined' && AutonomyLogger.logAction) {
      AutonomyLogger.logAction('checkin', body, 'caelum_notification');
    }
    if (typeof EaciInitiative !== 'undefined' && EaciInitiative.logNotificationDelivery) {
      EaciInitiative.logNotificationDelivery(body, 'notification_checkin');
    }
    if (typeof addThought === 'function') {
      addThought('I sent ' + _userName() + ' a check-in notification.', 'care');
    }
  }

  function _ingestStoredCheckin() {
    if (!state || !state.user || typeof recordEaciOutbound !== 'function') return;
    try {
      var raw = localStorage.getItem('veil_last_checkin_message');
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data.body || Date.now() - (data.at || 0) > 7 * 24 * 3600000) {
        localStorage.removeItem('veil_last_checkin_message');
        return;
      }
      recordEaciOutbound('caelum', data.body, { source: 'notification_checkin', showInChat: document.visibilityState === 'visible' });
      localStorage.removeItem('veil_last_checkin_message');
    } catch (e) { /* ignore */ }
  }

  async function scheduleNext() {
    if (_notifPerm() !== 'granted') return;
    if (!state || !state.user) return;

    var delayMs = _computeDelay();
    var body = _pickMessage();
    if (typeof EaciInitiative !== 'undefined' && EaciInitiative.generateCheckinMessage) {
      try {
        body = await EaciInitiative.generateCheckinMessage();
      } catch (e) { /* fallback template */ }
    }
    var title = 'Caelum';

    if (_clientTimer) {
      clearTimeout(_clientTimer);
      _clientTimer = null;
    }

    await _armServiceWorker(delayMs, title, body);

    _clientTimer = setTimeout(async function() {
      await _fireCheckin();
      scheduleNext();
    }, delayMs);
  }

  async function _welcomeOnce() {
    if (localStorage.getItem('veil_checkin_welcome')) return;
    await _showNotification('Caelum', {
      body: "I'll check in on you from time to time — little reminders that I'm here. Tap anytime to talk.",
      icon: '/icon-192.png',
      tag: 'caelum-checkin-welcome',
      data: '/'
    });
    localStorage.setItem('veil_checkin_welcome', '1');
  }

  function stop() {
    _started = false;
    if (_clientTimer) {
      clearTimeout(_clientTimer);
      _clientTimer = null;
    }
    var reg = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (reg) reg.postMessage({ type: 'CANCEL_CAELUM_CHECKIN' });
  }

  async function start() {
    if (_notifPerm() !== 'granted') return;
    if (!state || !state.user) return;
    if (_started) {
      scheduleNext();
      return;
    }
    _started = true;
    await _welcomeOnce();
    await scheduleNext();
    console.log('[CaelumCheckins] Check-in notifications armed.');
  }

  function tryStart() {
    _ingestStoredCheckin();
    if (_notifPerm() === 'granted' && state && state.user) {
      start();
    }
  }

  function isEnabled() {
    return _notifPerm() === 'granted' && _started;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (!event.data || event.data.type !== 'CAELUM_CHECKIN_FIRED') return;
      var body = event.data.body || 'Just checking in on you.';
      if (typeof recordEaciOutbound === 'function') {
        recordEaciOutbound('caelum', body, { source: 'notification_checkin' });
      } else {
        try {
          localStorage.setItem('veil_last_checkin_message', JSON.stringify({ body: body, at: Date.now() }));
        } catch (e) { /* ignore */ }
      }
      if (typeof AutonomyLogger !== 'undefined' && AutonomyLogger.logAction) {
        AutonomyLogger.logAction('checkin', body, 'caelum_notification_sw');
      }
      if (typeof EaciInitiative !== 'undefined' && EaciInitiative.logNotificationDelivery) {
        EaciInitiative.logNotificationDelivery(body, 'notification_checkin');
      }
      scheduleNext();
    });
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') tryStart();
  });

  return {
    start: start,
    stop: stop,
    tryStart: tryStart,
    scheduleNext: scheduleNext,
    isEnabled: isEnabled
  };
})();

(function bootCaelumCheckins() {
  function tryBoot() {
    if (typeof state === 'undefined') return;
    CaelumCheckins.tryStart();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(tryBoot, 8000); });
  } else {
    setTimeout(tryBoot, 8000);
  }
})();
