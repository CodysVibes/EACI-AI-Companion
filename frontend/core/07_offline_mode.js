// ============================================================
// OFFLINE MODE DETECTION
// ============================================================
var isOffline = !navigator.onLine;

window.addEventListener('online', function() {
  isOffline = false;
  var badge = document.getElementById('offlineBadge');
  if (badge) badge.classList.remove('show');
  addSystemMessage('Connection restored. You are back online.');
});

window.addEventListener('offline', function() {
  isOffline = true;
  var badge = document.getElementById('offlineBadge');
  if (badge) badge.classList.add('show');
  addSystemMessage('You are offline. Caelum can still reply from your cached engine — greetings and familiar topics work best.');
});

