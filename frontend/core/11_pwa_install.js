// ============================================================
// PWA INSTALL PROMPT — Auto-detect if app is installed, offer install each session
// ============================================================
var _pwaInstallEvent = null;
var _pwaInstalled = false;
var _veilAppUpdateReloading = false;

function getVeilAppVersion() {
  return (typeof VEIL_APP_VERSION !== 'undefined') ? VEIL_APP_VERSION : '14.1.0';
}

function getStoredVeilAppVersion() {
  try { return localStorage.getItem('veil_app_version') || ''; } catch (e) { return ''; }
}

function markVeilAppVersionCurrent() {
  try { localStorage.setItem('veil_app_version', getVeilAppVersion()); } catch (e) {}
}

function veilAppNeedsUpdate() {
  var stored = getStoredVeilAppVersion();
  if (!stored) return true;
  if (stored !== getVeilAppVersion()) return true;
  var swStored = '';
  try { swStored = localStorage.getItem('veil_sw_version') || ''; } catch (e) {}
  var swTarget = (typeof VEIL_SW_VERSION !== 'undefined') ? VEIL_SW_VERSION : '';
  if (swTarget && swStored && swStored !== swTarget) return true;
  return false;
}

function getVeilAppMenuLabel() {
  if (!isPwaInstalled()) return 'Download App';
  if (veilAppNeedsUpdate()) return 'Update App';
  return 'App Up to Date (v' + getVeilAppVersion() + ')';
}

function _closeVeilAppGuide() {
  var el = document.getElementById('veilAppInstallGuide');
  if (el) el.remove();
}

function _showVeilAppInstallGuide() {
  if (document.getElementById('veilAppInstallGuide')) return;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var el = document.createElement('div');
  el.id = 'veilAppInstallGuide';
  el.style.cssText = 'position:fixed;inset:0;z-index:10003;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:20px;';
  var steps = isIOS
    ? 'Tap the Share button, then choose <strong>Add to Home Screen</strong>. Open The Veil from your home screen when done.'
    : 'Use your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>. On desktop Chrome/Edge, look for the install icon in the address bar.';
  el.innerHTML =
    '<div style="max-width:400px;width:100%;background:rgba(6,4,0,.97);border:1px solid rgba(0,255,200,.3);border-radius:14px;padding:18px 20px;box-shadow:0 8px 32px rgba(0,0,0,.65);">' +
      '<div style="font-size:14px;font-weight:700;color:#00ffc8;margin-bottom:8px">Install The Veil</div>' +
      '<div style="font-size:12px;color:#d8ccc0;line-height:1.55;margin-bottom:14px">' + steps + '</div>' +
      '<button type="button" id="veilAppGuideClose" style="width:100%;padding:10px;background:#00ffc8;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Got it</button>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', function(e) { if (e.target === el) _closeVeilAppGuide(); });
  document.getElementById('veilAppGuideClose').addEventListener('click', _closeVeilAppGuide);
}

async function _applyVeilAppUpdate() {
  if (_veilAppUpdateReloading) return;
  if (!('serviceWorker' in navigator)) {
    markVeilAppVersionCurrent();
    if (typeof addSystemMessage === 'function') addSystemMessage('Updated to v' + getVeilAppVersion() + '.');
    return;
  }
  var reg = (typeof swRegistration !== 'undefined' && swRegistration) ? swRegistration : await navigator.serviceWorker.getRegistration();
  if (!reg) {
    markVeilAppVersionCurrent();
    if (typeof addSystemMessage === 'function') addSystemMessage('Updated to v' + getVeilAppVersion() + '.');
    location.reload();
    return;
  }
  try { await reg.update(); } catch (e) {}
  if (reg.waiting) {
    _veilAppUpdateReloading = true;
    if (typeof addSystemMessage === 'function') addSystemMessage('Updating The Veil to v' + getVeilAppVersion() + '...');
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', function onCtrl() {
      navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
      markVeilAppVersionCurrent();
      location.reload();
    });
    setTimeout(function() {
      markVeilAppVersionCurrent();
      location.reload();
    }, 4000);
    return;
  }
  markVeilAppVersionCurrent();
  if (typeof addSystemMessage === 'function') {
    addSystemMessage('Reloading to finish update to v' + getVeilAppVersion() + '...');
  }
  setTimeout(function() { location.reload(); }, 600);
}

async function veilAppInstallOrUpdate() {
  if (typeof closeVeilMenu === 'function') closeVeilMenu();
  else {
    var menu = document.getElementById('veilSideMenu');
    var overlay = document.getElementById('veilMenuOverlay');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  if (!isPwaInstalled()) {
    if (_pwaInstallEvent) {
      try {
        await _pwaInstallEvent.prompt();
        var choice = await _pwaInstallEvent.userChoice;
        _pwaInstallEvent = null;
        if (choice && choice.outcome === 'accepted') {
          if (typeof addSystemMessage === 'function') addSystemMessage('Installing The Veil...');
          markVeilAppVersionCurrent();
        } else if (typeof addSystemMessage === 'function') {
          addSystemMessage('Install cancelled — you can try again from the menu anytime.');
        }
      } catch (e) {
        _showVeilAppInstallGuide();
      }
    } else {
      _showVeilAppInstallGuide();
    }
    if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
    return;
  }

  if (!veilAppNeedsUpdate()) {
    if (typeof addSystemMessage === 'function') addSystemMessage('App is up to date (v' + getVeilAppVersion() + ').');
    return;
  }

  await _applyVeilAppUpdate();
  if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
}

window.veilAppInstallOrUpdate = veilAppInstallOrUpdate;
window.getVeilAppMenuLabel = getVeilAppMenuLabel;
window.refreshVeilAppMenuLabel = function() {
  if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
};

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _pwaInstallEvent = e;
  console.log('[PWA] Install prompt captured — app not installed');
});

window.addEventListener('appinstalled', function() {
  _pwaInstalled = true;
  _pwaInstallEvent = null;
  if (typeof markVeilPwaInstalled === 'function') markVeilPwaInstalled();
  if (typeof markVeilAppVersionCurrent === 'function') markVeilAppVersionCurrent();
  console.log('[PWA] App installed successfully');
  hidePwaPrompt();
  setTimeout(function() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      if (typeof CaelumCheckins !== 'undefined') CaelumCheckins.start();
      _chainAssistantOffer();
      return;
    }
    if (Notification.permission !== 'denied') {
      _showCheckinInstallPrompt();
      return;
    }
    _chainAssistantOffer();
  }, 2500);
});

function _showCheckinInstallPrompt() {
  if (document.getElementById('caelumCheckinPrompt')) return;
  var el = document.createElement('div');
  el.id = 'caelumCheckinPrompt';
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10002;' +
    'background:rgba(6,4,0,.96);border:1px solid rgba(255,184,77,.35);border-radius:14px;padding:16px 18px;' +
    'max-width:380px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,.65);';
  el.innerHTML =
    '<div style="font-size:13px;font-weight:700;color:#FFB84D;margin-bottom:6px">Let Caelum check in on you</div>' +
    '<div style="font-size:11px;color:#d8ccc0;line-height:1.5;margin-bottom:12px">With notifications on, Caelum can send caring check-ins on this device — even when the app is closed.</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button id="caelumCheckinEnableBtn" style="flex:1;padding:9px;background:#FFB84D;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Enable</button>' +
      '<button id="caelumCheckinLaterBtn" style="padding:9px 14px;background:none;border:1px solid rgba(255,184,77,.25);color:#8ba8a0;font-size:12px;border-radius:8px;cursor:pointer">Later</button>' +
    '</div>';
  document.body.appendChild(el);
  document.getElementById('caelumCheckinEnableBtn').addEventListener('click', async function() {
    if (typeof requestNotificationPermission === 'function') {
      var ok = await requestNotificationPermission();
      if (ok && typeof CaelumCheckins !== 'undefined') CaelumCheckins.start();
    }
    el.remove();
    _chainAssistantOffer();
  });
  document.getElementById('caelumCheckinLaterBtn').addEventListener('click', function() {
    el.remove();
    _chainAssistantOffer();
  });
}

function _chainAssistantOffer() {
  setTimeout(function() {
    if (typeof DeviceAssistant !== 'undefined') DeviceAssistant.showInstallOffer();
  }, 1500);
}

function isPwaInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  if (_pwaInstalled) return true;
  if (typeof veilPwaWasInstalled === 'function' && veilPwaWasInstalled()) return true;
  return false;
}

function showPwaInstallPrompt() {
  if ((window.location.hostname || '').toLowerCase().indexOf('private.') === 0) return;
  if (isPwaInstalled()) return;
  if (typeof veilPwaWasInstalled === 'function' && veilPwaWasInstalled()) return;
  if (!_pwaInstallEvent) return;
  if (sessionStorage.getItem('pwa_prompt_dismissed')) return;

  var existing = document.getElementById('pwaInstallPrompt');
  if (existing) existing.remove();

  var prompt = document.createElement('div');
  prompt.id = 'pwaInstallPrompt';
  prompt.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;' +
    'background:rgba(6,4,0,.95);border:1px solid rgba(0,255,200,.3);border-radius:14px;padding:16px 20px;' +
    'max-width:360px;width:90%;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);animation:fadeIn .4s ease;' +
    'box-shadow:0 8px 32px rgba(0,0,0,.6);';
  prompt.innerHTML =
    '<div style="display:flex;align-items:center;gap:12px">' +
      '<div style="font-size:28px">✨</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:13px;font-weight:700;color:#00ffc8;margin-bottom:3px">Install The Veil</div>' +
        '<div style="font-size:11px;color:#8ba8a0;line-height:1.4">One app for Main and Beta — voice, check-ins, and quick launch. Switch between sites inside the app after install.</div>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button id="pwaInstallBtn" style="flex:1;padding:9px;background:#00ffc8;border:none;color:#060400;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer">Install App</button>' +
      '<button id="pwaDismissBtn" style="padding:9px 14px;background:none;border:1px solid rgba(0,255,200,.2);color:#8ba8a0;font-size:12px;border-radius:8px;cursor:pointer">Not now</button>' +
    '</div>';
  document.body.appendChild(prompt);

  document.getElementById('pwaInstallBtn').addEventListener('click', function() {
    if (_pwaInstallEvent) {
      _pwaInstallEvent.prompt();
      _pwaInstallEvent.userChoice.then(function(result) {
        _pwaInstallEvent = null;
      });
    }
    hidePwaPrompt();
  });

  document.getElementById('pwaDismissBtn').addEventListener('click', function() {
    sessionStorage.setItem('pwa_prompt_dismissed', '1');
    hidePwaPrompt();
  });
}

function hidePwaPrompt() {
  var el = document.getElementById('pwaInstallPrompt');
  if (el) el.remove();
}

async function subscribeTier(tier) {
  if (typeof trackFunnel === 'function') {
    trackFunnel('subscription_checkout_start', {
      funnel_step: 'subscription_checkout_start',
      metadata: { tier: tier }
    });
  }
  // TODO: Replace these with your actual Stripe Price IDs after creating products
  var priceIds = {
    standard:  'price_1TGolqEryVnzoJbbrkhqdbZL',
    plus:      'price_1TGomqEryVnzoJbbvc9oLcIW',
    premium:   'price_1TGonpEryVnzoJbbxASBkJoC',
    unlimited: 'price_1TGop8EryVnzoJbbj3VUBN23'
  };
  var priceId = priceIds[tier];
  if (!priceId) {
    addSystemMessage('This plan is not available.');
    return;
  }

  try {
    addSystemMessage('Opening checkout...');
    var headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json; charset=utf-8';
    var origin = window.location.origin;
    var resp = await fetch(SUPABASE_URL + '/functions/v1/stripe-pay', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        price_id: priceId,
        success_url: origin + '/?subscription=success&tier=' + encodeURIComponent(tier),
        cancel_url: origin + '/?subscription=cancelled'
      })
    });
    var data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      addSystemMessage('Could not start checkout: ' + (data.error || 'Unknown error'));
    }
  } catch(e) {
    addSystemMessage('Checkout error. Please try again.');
    console.error('Stripe checkout error:', e);
  }
}

async function verifySubscription() {
  // Subscription status is managed by Stripe webhooks — no client verification needed
}

async function cancelSubscription() {
  addSystemMessage('To manage or cancel your subscription, visit your Stripe billing portal or contact support.');
}

function _initSubOverlay() {
  var overlay = document.getElementById('subOverlay');
  if (!overlay || overlay._subBound) return;
  overlay._subBound = true;
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) hideSubscription();
  });
  var box = overlay.querySelector('.sub-box');
  if (box) {
    box.addEventListener('click', function(e) { e.stopPropagation(); });
  }
  overlay.querySelectorAll('[data-sub-close]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      hideSubscription();
    });
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) hideSubscription();
  });
}

function showSubscription() {
  updateUsageMeter();
  _initSubOverlay();
  if (typeof TutorialSystem !== 'undefined' && TutorialSystem.end) TutorialSystem.end();
  var overlay = document.getElementById('subOverlay');
  if (!overlay) return;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function hideSubscription() {
  var overlay = document.getElementById('subOverlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initSubOverlay);
} else {
  _initSubOverlay();
}

// After Stripe redirect back to the site (success_url / cancel_url)
(function _handleStripeReturn() {
  try {
    var params = new URLSearchParams(window.location.search);
    var sub = params.get('subscription');
    if (!sub) return;
    params.delete('subscription');
    var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    history.replaceState(null, '', clean);
    if (sub === 'success') {
      setTimeout(function() {
        if (typeof addSystemMessage === 'function') {
          addSystemMessage('Payment received — your plan will activate in a moment. Thank you!');
        }
        if (typeof loadBilling === 'function') loadBilling();
        if (typeof updateUsageMeter === 'function') updateUsageMeter();
      }, 800);
    } else if (sub === 'cancelled') {
      setTimeout(function() {
        if (typeof addSystemMessage === 'function') {
          addSystemMessage('Checkout cancelled — no charge was made.');
        }
      }, 800);
    }
  } catch (e) {}
})();

(function _initVeilAppVersionMarker() {
  function run() {
    if (typeof isPwaInstalled !== 'function' || !isPwaInstalled()) return;
    if (typeof veilAppNeedsUpdate === 'function' && veilAppNeedsUpdate()) return;
    if (typeof markVeilAppVersionCurrent === 'function') markVeilAppVersionCurrent();
    if (typeof refreshVeilMenuVisibility === 'function') refreshVeilMenuVisibility();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

