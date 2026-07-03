// ============================================================
// LAUNCH PROGRESS — top loading bar with percentage
// ============================================================
var VeilLaunchProgress = (function() {
  'use strict';

  var pct = (window.__veilLaunchPct) || 5;
  var done = false;
  var creepTimer = null;

  function els() {
    return {
      wrap: document.getElementById('veilLaunchBarWrap'),
      fill: document.getElementById('veilLaunchBarFill'),
      pct: document.getElementById('veilLaunchBarPct'),
      label: document.getElementById('veilLaunchBarLabel')
    };
  }

  function render() {
    var e = els();
    if (!e.fill) return;
    var p = Math.min(100, Math.round(pct));
    e.fill.style.width = p + '%';
    if (e.pct) e.pct.textContent = p + '%';
    if (e.wrap) e.wrap.setAttribute('aria-valuenow', String(p));
  }

  function setMin(n, labelText) {
    if (done) return;
    if (n > pct) pct = n;
    if (labelText) {
      var e = els();
      if (e.label) e.label.textContent = labelText;
    }
    render();
  }

  function bump(n, labelText) {
    setMin(n, labelText);
  }

  function startCreep() {
    if (creepTimer) return;
    creepTimer = setInterval(function() {
      if (done || pct >= 94) return;
      pct += 0.35;
      render();
    }, 180);
  }

  function complete() {
    if (done) return;
    done = true;
    if (creepTimer) { clearInterval(creepTimer); creepTimer = null; }
    setMin(100, 'Ready');
    var e = els();
    setTimeout(function() {
      if (e.wrap) e.wrap.classList.add('veil-launch-done');
    }, 450);
  }

  render();
  startCreep();

  return { setMin: setMin, bump: bump, complete: complete };
})();
