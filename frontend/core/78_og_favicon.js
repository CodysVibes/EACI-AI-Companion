/**
 * Animated tab favicon from og-video.mp4 (static favicon.png is the fallback).
 */
(function() {
  'use strict';
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var link = document.querySelector('link[rel="icon"][sizes="32x32"]') || document.querySelector('link[rel="icon"]');
  if (!link) return;

  var video = document.createElement('video');
  video.src = '/og-video.mp4';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = 'auto';
  video.width = 32;
  video.height = 32;
  video.style.cssText = 'position:fixed;left:-9999px;width:32px;height:32px;opacity:0;pointer-events:none';

  var canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  var ctx = canvas.getContext('2d');
  var running = false;

  function paint() {
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, 32, 32);
      try { link.href = canvas.toDataURL('image/png'); } catch (e) {}
    }
    if (running) requestAnimationFrame(paint);
  }

  video.addEventListener('loadeddata', function() {
    video.play().catch(function() {});
    if (!running) {
      running = true;
      paint();
    }
  });

  document.documentElement.appendChild(video);
})();
