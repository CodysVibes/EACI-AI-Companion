// Service Worker for The Veil — keep SW_VERSION in sync with core/00_veil_app_version.js
// Strategy: cache static assets, network-first for navigations, offline fallbacks
const SW_VERSION = 'v14.1.3-20260626';
const CHECKIN_CACHE = 'veil-checkins-v1';
const CACHE_NAME = 'veil-v3-cache-' + SW_VERSION;

let _checkinTimer = null;

const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|mp3|wav|json)(\?|$)/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== CHECKIN_CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim()).then(() => _restoreCheckinTimer())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.hostname.includes('supabase') || url.pathname.includes('/functions/')) {
    return;
  }

  if (url.hostname.includes('r2.dev') || url.pathname.endsWith('.mp4') || url.pathname.endsWith('.webm')) {
    return;
  }

  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var cloned = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, cloned);
            }).catch(function() {});
          }
          return response;
        }).catch(function() {
          if (cached) return cached;
          return fetch(event.request);
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.status === 200) {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned)).catch(() => {});
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

async function _storeCheckinSchedule(data) {
  const cache = await caches.open(CHECKIN_CACHE);
  await cache.put('/checkin-schedule', new Response(JSON.stringify(data)));
}

async function _loadCheckinSchedule() {
  try {
    const cache = await caches.open(CHECKIN_CACHE);
    const res = await cache.match('/checkin-schedule');
    if (!res) return null;
    return JSON.parse(await res.text());
  } catch (e) {
    return null;
  }
}

async function _clearCheckinSchedule() {
  try {
    const cache = await caches.open(CHECKIN_CACHE);
    await cache.delete('/checkin-schedule');
  } catch (e) { /* ignore */ }
}

function _notifyClientsCheckinFired(body) {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
    clients.forEach(function(c) { c.postMessage({ type: 'CAELUM_CHECKIN_FIRED', body: body || '' }); });
  });
}

function _armCheckinTimer(delayMs, payload) {
  if (_checkinTimer) clearTimeout(_checkinTimer);
  const wait = Math.max(1000, Math.min(delayMs, 2147483647));
  _checkinTimer = setTimeout(function() {
    _checkinTimer = null;
    const title = (payload && payload.title) || 'Caelum';
    const body = (payload && payload.body) || 'Just checking in on you.';
    const icon = (payload && payload.icon) || '/icon-192.png';
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: icon,
      tag: 'caelum-checkin',
      data: '/',
      vibrate: [80, 40, 80]
    }).then(function() {
      _clearCheckinSchedule();
      _notifyClientsCheckinFired(body);
    }).catch(function() {});
  }, wait);
}

async function _restoreCheckinTimer() {
  const sched = await _loadCheckinSchedule();
  if (!sched || !sched.at) return;
  const delay = sched.at - Date.now();
  if (delay > 1000) {
    _armCheckinTimer(delay, sched);
  } else if (delay > -600000) {
    _armCheckinTimer(1500, sched);
  } else {
    await _clearCheckinSchedule();
  }
}

self.addEventListener('push', (event) => {
  let data = { title: 'The Veil', body: 'Caelum has something to say...' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'The Veil', {
      body: data.body || '',
      icon: data.icon || undefined,
      badge: data.badge || undefined,
      tag: data.tag || 'veil-notification',
      data: data.url || '/',
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
    return;
  }
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'ARM_CAELUM_CHECKIN') {
    const delayMs = data.delayMs || 0;
    const sched = {
      at: data.at || (Date.now() + delayMs),
      title: data.title || 'Caelum',
      body: data.body || 'Just checking in on you.',
      icon: data.icon || '/icon-192.png'
    };
    event.waitUntil(
      _storeCheckinSchedule(sched).then(function() { _armCheckinTimer(delayMs, sched); })
    );
    return;
  }
  if (data.type === 'CANCEL_CAELUM_CHECKIN') {
    if (_checkinTimer) clearTimeout(_checkinTimer);
    _checkinTimer = null;
    event.waitUntil(_clearCheckinSchedule());
  }
});
