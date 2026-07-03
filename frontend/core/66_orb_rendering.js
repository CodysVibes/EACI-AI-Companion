// ============================================================
// ORB RENDERING SYSTEM — Audio-reactive animated orbs
// ============================================================
var orbState = {
  caelumPhase: 0,
  chadPhase: 0,
  startupPhase: 0,
  introPlayed: false
};

function drawOrb(canvas, color, rgbArr, audioLevel, phase, isBackground) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var cx = w / 2;
  var cy = h / 2;
  var baseR = isBackground ? Math.min(w, h) * 0.22 : Math.min(w, h) * 0.3;

  ctx.clearRect(0, 0, w, h);

  // Slow drift for background orbs
  var drift = isBackground ? Math.sin(phase * 0.15) * 10 : 0;
  var driftY = isBackground ? Math.cos(phase * 0.2) * 7 : 0;
  var ocx = cx + drift;
  var ocy = cy + driftY;

  // Audio-reactive expansion
  var expand = 1 + audioLevel * 0.5;
  var vibrate = audioLevel > 0.05 ? (Math.random() - 0.5) * audioLevel * 4 : 0;

  // Outer glow — bigger when speaking
  var glowR = baseR * (isBackground ? 2.5 : 1.8) * expand;
  var grad = ctx.createRadialGradient(ocx + vibrate, ocy + vibrate, baseR * 0.2 * expand, ocx, ocy, glowR);
  grad.addColorStop(0, 'rgba(' + rgbArr.join(',') + ',' + (isBackground ? 0.15 : 0.3) + ')');
  grad.addColorStop(0.5, 'rgba(' + rgbArr.join(',') + ',' + (isBackground ? 0.04 : 0.08) + ')');
  grad.addColorStop(1, 'rgba(' + rgbArr.join(',') + ',0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Pulsing ring
  var pulseR = baseR * (0.9 + 0.1 * Math.sin(phase * 0.8)) * expand;
  ctx.beginPath();
  ctx.arc(ocx + vibrate, ocy + vibrate, pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(' + rgbArr.join(',') + ',' + (0.1 + audioLevel * 0.3) + ')';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // SPIKES when speaking — jagged distortion around the orb
  if (audioLevel > 0.03) {
    var spikeCount = 24;
    var breathe = 1 + 0.06 * Math.sin(phase * 0.6);
    var spikeBaseR = baseR * 0.75 * breathe * expand;
    ctx.beginPath();
    for (var i = 0; i <= spikeCount; i++) {
      var angle = (i / spikeCount) * Math.PI * 2;
      var spikeLen = spikeBaseR + (Math.random() * audioLevel * baseR * 1.2) + Math.sin(phase * 4 + i * 1.3) * audioLevel * baseR * 0.6;
      var sx = ocx + vibrate + Math.cos(angle) * spikeLen;
      var sy = ocy + vibrate + Math.sin(angle) * spikeLen;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + rgbArr.join(',') + ',' + (0.08 + audioLevel * 0.15) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + rgbArr.join(',') + ',' + (0.15 + audioLevel * 0.25) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Core orb with breathing
  var breathe2 = 1 + 0.06 * Math.sin(phase * 0.6);
  var coreR = baseR * 0.7 * breathe2 * expand;
  var coreGrad = ctx.createRadialGradient(ocx + vibrate - coreR * 0.2, ocy + vibrate - coreR * 0.2, coreR * 0.1, ocx + vibrate, ocy + vibrate, coreR);
  coreGrad.addColorStop(0, 'rgba(' + rgbArr.map(function(c) { return Math.min(255, c + 80); }).join(',') + ',' + (0.9 + audioLevel * 0.1) + ')');
  coreGrad.addColorStop(0.6, 'rgba(' + rgbArr.join(',') + ',' + (0.7 + audioLevel * 0.2) + ')');
  coreGrad.addColorStop(1, 'rgba(' + rgbArr.join(',') + ',0.1)');
  ctx.beginPath();
  ctx.arc(ocx + vibrate, ocy + vibrate, coreR, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.shadowBlur = 20 + audioLevel * 40;
  ctx.shadowColor = color;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Inner highlight
  var hiR = coreR * 0.35;
  var hiGrad = ctx.createRadialGradient(ocx + vibrate - hiR * 0.5, ocy + vibrate - hiR * 0.5, 0, ocx + vibrate, ocy + vibrate, hiR);
  hiGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
  hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(ocx + vibrate - hiR * 0.3, ocy + vibrate - hiR * 0.3, hiR, 0, Math.PI * 2);
  ctx.fillStyle = hiGrad;
  ctx.fill();
}

function orbAnimationLoop() {
  // LOW POWER MODE: Skip orb animation entirely
  if (_lowPowerMode) {
    requestAnimationFrame(orbAnimationLoop);
    return;
  }
  // MOBILE OPTIMIZATION: Only draw orbs when actually speaking
  if (_isMobile && !state.currentSpeaker && !state.isPlayingAudio) {
    requestAnimationFrame(orbAnimationLoop);
    return;
  }
  // Skip when tab is hidden
  if (document.hidden) {
    requestAnimationFrame(orbAnimationLoop);
    return;
  }
  
  var audioLevel = getOrbAudioLevel();
  var speaker = state.currentSpeaker;
  var chadLevel = speaker === 'chad' ? audioLevel : 0;

  orbState.chadPhase += 0.01;
  orbState.startupPhase += 0.012;

  // Chad header orb (small)
  var chadCanvas = document.getElementById('chadOrbCanvas');
  if (chadCanvas) drawOrb(chadCanvas, '#ffa500', [255, 165, 0], chadLevel, orbState.chadPhase, false);

  // Live chat Chad orb
  if (liveChat.active) {
    var liveChadCanvas = document.getElementById('liveChadCanvas');
    if (liveChadCanvas && liveChadCanvas.offsetParent !== null) {
      drawOrb(liveChadCanvas, '#ffa500', [255, 165, 0], chadLevel, orbState.chadPhase, state.currentSpeaker === 'chad');
    }
  }

  requestAnimationFrame(orbAnimationLoop);
}

