// ============================================================
// LOW POWER MODE — Saves battery, reduces heat on older/weaker devices
// ============================================================
var _lowPowerMode = false;

function _veilLikelyAutomationHost() {
  var ua = navigator.userAgent || '';
  if (navigator.webdriver) return true;
  if (/HeadlessChrome|Browserbase|Puppeteer|Playwright|CloudflareBrowser/i.test(ua)) return true;
  try {
    if (localStorage.getItem('veil_automation_mode') === '1') return true;
    if (sessionStorage.getItem('veil_automation_mode') === '1') return true;
    var q = new URLSearchParams(location.search);
    if (q.get('automation') === '1' || q.get('browserbase') === '1') {
      sessionStorage.setItem('veil_automation_mode', '1');
      return true;
    }
  } catch (e) {}
  // Cloud browser VMs (Browserbase, etc.): desktop Chrome, few cores, no touch
  if (/Chrome|Chromium|Edg\//i.test(ua) && !/Android|Mobile/i.test(ua)) {
    var cores = navigator.hardwareConcurrency || 0;
    var mem = navigator.deviceMemory || 0;
    var noTouch = !('ontouchstart' in window) && (navigator.maxTouchPoints || 0) === 0;
    var desktopVp = window.innerWidth >= 900 && window.innerHeight >= 600;
    if (desktopVp && noTouch && cores > 0 && cores <= 4 && (mem === 0 || mem <= 4)) return true;
  }
  return false;
}
window._veilLikelyAutomationHost = _veilLikelyAutomationHost;

function _detectLowPowerDevice() {
  if (_veilLikelyAutomationHost()) return false;

  // Auto-detect if device needs low power mode
  var dominated = false;
  
  // CPU cores alone — only on mobile (desktop 4-core is common, not weak)
  if (_isMobile && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) dominated = true;
  
  // Check device memory (if available) — 4GB or less = constrained
  if (navigator.deviceMemory && navigator.deviceMemory <= 4) dominated = true;
  
  // Check if it's a mobile device with a small screen (older phone)
  if (_isMobile && window.screen.height < 800) dominated = true;
  
  // Check connection speed — slow connection often means older device
  if (navigator.connection && navigator.connection.effectiveType === '2g') dominated = true;
  
  // Check for known older device patterns in user agent
  var ua = navigator.userAgent;
  if (/SM-[A-G]|SM-J|SM-M[0-2]|Pixel [1-3]\b|iPhone [5-8]\b|iPad (Air|Mini) [1-2]/i.test(ua)) dominated = true;
  
  return dominated;
}

function _initPowerMode() {
  if (_veilLikelyAutomationHost()) {
    _lowPowerMode = false;
    try { localStorage.setItem('veil_power_mode', 'full'); } catch (e) {}
    console.log('[PowerMode] Automation/cloud browser — Full Quality');
    return;
  }
  var saved = localStorage.getItem('veil_power_mode');
  if (saved === 'low') {
    _lowPowerMode = true;
  } else if (saved === 'full') {
    _lowPowerMode = false;
  } else {
    // Auto mode — detect device capability
    _lowPowerMode = _detectLowPowerDevice();
    if (_lowPowerMode) {
      console.log('[PowerMode] Auto-detected weak device — using Low Power Mode');
    }
  }
  if (typeof _applyAvatarVideoDim === 'function') _applyAvatarVideoDim();
}
_initPowerMode();

function _applyAvatarVideoDim() {
  var dim = _lowPowerMode || (typeof _isMobile !== 'undefined' && _isMobile);
  document.documentElement.classList.toggle('veil-avatar-dim', !!dim);
}
_applyAvatarVideoDim();

function previewPowerMode() {
  var sel = document.getElementById('setPowerMode');
  var info = document.getElementById('powerModeInfo');
  if (!sel || !info) return;
  var val = sel.value;
  if (val === 'low') {
    info.textContent = '⚡ Low Power: No particles, no background canvas, reduced animations. Best battery life.';
    info.style.color = '#ffd93d';
  } else if (val === 'full') {
    info.textContent = '✦ Full Quality: All visual effects enabled. Uses more battery on mobile.';
    info.style.color = 'var(--accent)';
  } else {
    var autoResult = _detectLowPowerDevice() ? 'Low Power (your device detected as constrained)' : 'Full Quality (your device can handle it)';
    info.textContent = '⚙ Auto: ' + autoResult;
    info.style.color = 'var(--muted)';
  }
}

function initCanvas() {
  var c = document.getElementById('bg');
  var ctx = c.getContext('2d');
  
  // LOW POWER MODE: Skip canvas entirely — just show solid background
  if (_lowPowerMode) {
    c.style.display = 'none';
    return;
  }
  
  function resize() { c.width = window.innerWidth; c.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  
  // MOBILE OPTIMIZATION: Fewer particles on mobile
  var particleCount = _isMobile ? 20 : 60;
  for (var i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5, a: Math.random() * 0.4 + 0.1
    });
  }
  
  var _frameCount = 0;
  var _lastDrawTime = 0;
  // MOBILE: Cap at 20fps. Desktop: 30fps (was uncapped 60fps)
  var _frameInterval = _isMobile ? 50 : 33;
  
  function draw(timestamp) {
    // Skip frames to reduce GPU load
    if (timestamp - _lastDrawTime < _frameInterval) {
      requestAnimationFrame(draw);
      return;
    }
    _lastDrawTime = timestamp;
    
    // Don't draw when tab is hidden
    if (document.hidden || _canvasHidden) {
      requestAnimationFrame(draw);
      return;
    }
    
    _frameCount++;
    ctx.clearRect(0, 0, c.width, c.height);
    var emotionColor = getEmotionColor();
    particles.forEach(function(p) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
      if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = emotionColor.replace('1)', p.a + ')');
      ctx.fill();
    });
    // MOBILE: Skip connection lines entirely (big GPU saver)
    if (!_isMobile && _frameCount % 3 === 0) {
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = emotionColor.replace('1)', (0.06 * (1 - dist / 80)) + ')');
            ctx.stroke();
          }
        }
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ── VISIBILITY API: Pause everything when tab is backgrounded ──
document.addEventListener('visibilitychange', function() {
  _canvasHidden = document.hidden;
  if (document.hidden && typeof MemoryEngine !== 'undefined') {
    MemoryEngine.forceSave();
  }
  if (!document.hidden && typeof VeilPulse !== 'undefined') {
    VeilPulse.bumpActivity('visibility');
  }
});

function getEmotionColor() {
  var colors = {
    neutral: 'rgba(0,255,200,1)', happy: 'rgba(0,255,200,1)',
    sad: 'rgba(107,140,255,1)', angry: 'rgba(255,107,107,1)',
    scared: 'rgba(255,135,135,1)', lost: 'rgba(255,217,61,1)',
    alone: 'rgba(167,139,250,1)'
  };
  return colors[state.emotionalState] || colors.neutral;
}

