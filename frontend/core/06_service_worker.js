// ============================================================
// SERVICE WORKER & PUSH NOTIFICATIONS
// ============================================================
var swRegistration = null;

var BUILD_VERSION = (typeof VEIL_SW_VERSION !== 'undefined') ? VEIL_SW_VERSION : 'v14.1.0-20260620';

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service worker registered');
    swRegistration.update().catch(function() {});

    var activeSW = swRegistration.active || swRegistration.installing || swRegistration.waiting;
    if (activeSW) {
      navigator.serviceWorker.addEventListener('message', function onSwMsg(e) {
        if (e.data && e.data.type === 'SW_VERSION') {
          navigator.serviceWorker.removeEventListener('message', onSwMsg);
          var swVer = e.data.version;
          var lastKnown = localStorage.getItem('veil_sw_version');
          if (lastKnown && lastKnown !== swVer) {
            console.log('New deploy detected (' + lastKnown + ' → ' + swVer + ') — clearing stale flags');
            var keep = ['veil_user_id','veil_session','veil_memories','veil_billing','veil_orientation_dismissed','veil_sw_version','veil_app_version','veil_compat_v1'];
            Object.keys(localStorage).forEach(function(k) {
              if (k.indexOf('veil_state') === 0) keep.push(k);
            });
            keep = keep.filter(function(v, i, a) { return a.indexOf(v) === i; });
            var saved = {};
            keep.forEach(function(k) { var v = localStorage.getItem(k); if (v) saved[k] = v; });
            localStorage.clear();
            keep.forEach(function(k) { if (saved[k]) localStorage.setItem(k, saved[k]); });
            if (typeof addSystemMessage === 'function') {
              addSystemMessage('Site updated — refresh if anything looks wrong.');
            }
          }
          localStorage.setItem('veil_sw_version', swVer);
        }
      });
      activeSW.postMessage({ type: 'GET_VERSION' });
    }
  } catch(e) {
    console.log('SW registration failed:', e);
  }
}

registerServiceWorker();

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  if (typeof showPermissionExplainer === 'function') {
    var ok = await showPermissionExplainer('notifications');
    if (!ok) return false;
  }
  var result = await Notification.requestPermission();
  return result === 'granted';
}

async function subscribeToPush() {
  if (!swRegistration) return null;
  try {
    var sub = await swRegistration.pushManager.getSubscription();
    if (sub) return sub;
    await requestNotificationPermission();
    return null;
  } catch(e) {
    console.log('Push subscription error:', e);
    return null;
  }
}

function showLocalNotification(title, body) {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body: body, tag: 'veil-notification' });
  }
}

async function requestNotifPerm() {
  var btn = document.getElementById('notifPermBtn');
  var granted = await requestNotificationPermission();
  if (granted) {
    btn.textContent = 'Caelum Check-ins On';
    btn.style.opacity = '0.5';
    btn.disabled = true;
    addSystemMessage('Caelum will check in on you with notifications from time to time.');
    if (typeof CaelumCheckins !== 'undefined') CaelumCheckins.start();
  } else {
    btn.textContent = 'Permission Denied';
    btn.style.color = '#ff6b6b';
    btn.style.borderColor = 'rgba(255,107,107,.3)';
  }
}
