var liveChat = {
  active: false,
  stream: null,
  socket: null,
  isMuted: false,
  fullTranscript: '',
  lastSpoken: '',
  sendTimer: null,
  autoMode: true,
  autoTimer: null,
  mode: 'user' // 'user', 'guest', 'signup'
};

function toggleAutoMode() {
  liveChat.autoMode = !liveChat.autoMode;
  var btn = document.getElementById('autoToggleBtn');
  var banner = document.getElementById('liveSendBanner');
  if (liveChat.autoMode) {
    if (btn) {
      btn.innerText = 'Auto: ON';
      btn.style.background = 'rgba(0,255,200,.15)';
    }
    if (banner) banner.innerText = 'Auto-send enabled: Stop speaking to respond';
    // When switching to Auto, make sure we aren't waiting for a command
    if (liveChat.active && !liveChat.isMuted) {
       console.log("Auto Mode engaged: Monitoring silence...");
    }
  } else {
    if (btn) {
      btn.innerText = 'Auto: OFF';
      btn.style.background = 'rgba(255,255,255,.05)';
    }
    if (banner) banner.innerText = 'Say “send message” when you’re done speaking';
    if (liveChat.autoTimer) clearTimeout(liveChat.autoTimer);
  }
}

// This function will be called within the Deepgram socket 'results' handler
function _handleLiveChatAutoSend() {
    if (!liveChat.autoMode) return;
    if (liveChat.autoTimer) clearTimeout(liveChat.autoTimer);
    liveChat.autoTimer = setTimeout(function() {
        if (liveChat.active && !liveChat.isMuted && liveChat.fullTranscript.trim().length > 0) {
            // Trigger send
            sendLiveMessage();
        }
    }, 5000);
}
