// ============================================================
// STARTUP INTRO SEQUENCE — Cinematic multi-phase reveal
// ============================================================
function initIntroParticles() {
  var canvas = document.getElementById('introParticles');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var pts = [];
  for (var i = 0; i < 100; i++) {
    pts.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -Math.random() * 0.4 - 0.1,
      r: Math.random() * 1.8 + 0.3,
      a: Math.random() * 0.5 + 0.05,
      pulse: Math.random() * Math.PI * 2
    });
  }

  var introAlpha = { value: 0 };
  var running = true;

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pts.forEach(function(p) {
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.02;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;

      var flicker = 0.5 + 0.5 * Math.sin(p.pulse);
      var alpha = p.a * flicker * introAlpha.value;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,255,200,' + alpha + ')';
      ctx.fill();
    });

    // Draw faint connecting lines for nearby particles
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i].x - pts[j].x;
        var dy = pts[i].y - pts[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = 'rgba(0,255,200,' + (0.04 * (1 - dist / 100) * introAlpha.value) + ')';
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();

  // Fade particles in over 2 seconds
  var fadeStart = performance.now();
  function fadeIn(now) {
    var elapsed = now - fadeStart;
    introAlpha.value = Math.min(1, elapsed / 2000);
    if (introAlpha.value < 1) requestAnimationFrame(fadeIn);
  }
  requestAnimationFrame(fadeIn);

  return function stop() { running = false; };
}

function typeText(el, text, speed) {
  return new Promise(function(resolve) {
    var i = 0;
    el.style.opacity = '1';
    function tick() {
      if (i <= text.length) {
        el.textContent = text.substring(0, i);
        i++;
        setTimeout(tick, speed);
      } else {
        resolve();
      }
    }
    tick();
  });
}

var tapGateResolved = null;

function dismissTapGate() {
  if (typeof trackFunnel === 'function') trackFunnel('startup_tap', { funnel_step: 'startup_tap' });
  var tapGate = document.getElementById('tapGate');
  if (tapGate) tapGate.style.display = 'none';
  if (typeof markAudioUnlocked === 'function') {
    markAudioUnlocked();
  } else if (!orbAudioCtx) {
    orbAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    orbAnalyser = orbAudioCtx.createAnalyser();
    orbAnalyser.fftSize = 128;
    orbAnalyser.smoothingTimeConstant = 0.8;
    orbAudioData = new Uint8Array(orbAnalyser.frequencyBinCount);
    if (orbAudioCtx.state === 'suspended') orbAudioCtx.resume();
  }
  if (tapGateResolved) tapGateResolved();
  if (typeof window._veilMarkChatEngaged === 'function') window._veilMarkChatEngaged();
  if (typeof window._veilStartBgMusicImpl === 'function') {
    window._veilStartBgMusicImpl();
  } else if (typeof startBgMusic === 'function') {
    startBgMusic();
  }
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 768 && 'ontouchstart' in window);
}

