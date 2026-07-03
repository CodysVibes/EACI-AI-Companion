// ============================================================
// MULTI-LANGUAGE STT — Language picker for speech recognition
// ============================================================
var sttLanguage = localStorage.getItem('veil_stt_language') || 'en-US';
var STT_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ru-RU', label: 'Russian' }
];

// ============================================================
// SUBSCRIPTION & USAGE METERING SYSTEM
// Google Play Billing ready — product IDs map to Play Console
// ============================================================
var TIERS = {
  free:      { name: 'Free',      limit: 50,   period: 'daily',  price: 0 },
  standard:  { name: 'Standard',  limit: 100,  period: 'daily',  price: 4.99 },
  plus:      { name: 'Plus',      limit: 200,  period: 'daily',  price: 12.99 },
  premium:   { name: 'Premium',   limit: 400,  period: 'daily',  price: 19.99 },
  unlimited: { name: 'Unlimited', limit: -1,   period: 'monthly', price: 49.99 }
};

var billing = {
  tier: 'free',
  apiCallsUsed: 0,
  periodStart: null,
  lastResetDate: null,
  paymentValid: true,
  subscriptionToken: null,
  expiresAt: null
};

function getBillingKey() {
  if (state.user && state.user.id) return 'veil_billing_' + state.user.id;
  return state.user ? 'veil_billing_' + state.user.username : 'veil_billing';
}

function loadBilling() {
  try {
    var saved = localStorage.getItem(getBillingKey());
    if (saved) {
      var b = JSON.parse(saved);
      billing.tier = b.tier || 'free';
      billing.apiCallsUsed = b.apiCallsUsed || 0;
      billing.periodStart = b.periodStart || null;
      billing.lastResetDate = b.lastResetDate || null;
      billing.paymentValid = b.paymentValid !== false;
      billing.subscriptionToken = b.subscriptionToken || null;
      billing.expiresAt = b.expiresAt || null;
    } else {
      // New account — start on free tier
      billing.tier = 'free';
      billing.apiCallsUsed = 0;
      billing.periodStart = null;
      billing.lastResetDate = null;
      billing.paymentValid = true;
      billing.subscriptionToken = null;
      billing.expiresAt = null;
    }
  } catch(e) { console.log('Billing load error:', e); }
  checkAndResetUsage();
  if (typeof state !== 'undefined' && state && state.familyCodeRedeemed) {
    billing.tier = 'unlimited';
    saveBilling();
  }
  if (typeof notifyGamesAccessRefresh === 'function') notifyGamesAccessRefresh();
}

/** Non-free tier or family unlimited — unlimited game plays per day */
window.hasUnlimitedGamePlays = function() {
  if (typeof state !== 'undefined' && state && state.familyCodeRedeemed) return true;
  if (typeof billing !== 'undefined' && billing) {
    return (billing.tier || 'free').toLowerCase() !== 'free';
  }
  return false;
};

function notifyGamesAccessRefresh() {
  if (typeof window.refreshGamesPlayAccess === 'function') window.refreshGamesPlayAccess();
  try {
    window.dispatchEvent(new CustomEvent('veil:games-access-updated'));
  } catch (e) { /* ignore */ }
}

function saveBilling() {
  try {
    localStorage.setItem(getBillingKey(), JSON.stringify(billing));
  } catch(e) { console.log('Billing save error:', e); }
}

// Get midnight US Central (Chicago) for today
function getMidnightCentral() {
  var now = new Date();
  // Build a date string for tomorrow midnight in US Central
  var tomorrow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  // Convert back: figure out the offset
  var centralNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  var offsetMs = now.getTime() - centralNow.getTime();
  return new Date(tomorrow.getTime() + offsetMs);
}

function getTodayCentral() {
  var now = new Date();
  var central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return central.getFullYear() + '-' + String(central.getMonth() + 1).padStart(2, '0') + '-' + String(central.getDate()).padStart(2, '0');
}

function checkAndResetUsage() {
  var tierInfo = TIERS[billing.tier];

  if (tierInfo.period === 'daily') {
    // Free and Standard both reset daily at midnight Central
    var today = getTodayCentral();
    if (billing.lastResetDate !== today) {
      billing.apiCallsUsed = 0;
      billing.lastResetDate = today;
      saveBilling();
    }
  } else {
    // Premium (monthly unlimited): reset every 30 days from period start
    if (!billing.periodStart) {
      billing.periodStart = Date.now();
      billing.apiCallsUsed = 0;
      saveBilling();
    } else {
      var daysSinceStart = (Date.now() - billing.periodStart) / (1000 * 60 * 60 * 24);
      if (daysSinceStart >= 30) {
        billing.periodStart = Date.now();
        billing.apiCallsUsed = 0;
        verifySubscription();
        saveBilling();
      }
    }
  }

  // Check if subscription expired (for paid tiers)
  if (billing.tier !== 'free' && billing.expiresAt && Date.now() > billing.expiresAt && !billing.paymentValid) {
    billing.tier = 'free';
    billing.apiCallsUsed = 0;
    billing.lastResetDate = getTodayCentral();
    saveBilling();
    addSystemMessage('Your subscription has expired. You are now on the Free plan.');
  }
}

function getCallsRemaining() {
  var tier = TIERS[billing.tier];
  if (tier.limit === -1) return Infinity;
  return Math.max(0, tier.limit - billing.apiCallsUsed);
}

function getCallsLimit() {
  var tier = TIERS[billing.tier];
  return tier.limit === -1 ? Infinity : tier.limit;
}

function canMakeApiCall() {
  checkAndResetUsage();
  var remaining = getCallsRemaining();
  return remaining > 0;
}

function recordApiCall() {
  billing.apiCallsUsed++;
  console.log('API call recorded:', billing.apiCallsUsed, '/ tier:', billing.tier, '/ key:', getBillingKey());
  saveBilling();
  updateUsageMeter();

  // Sync to server so other devices see the updated count
  if (state.user) {
    var today = getTodayCentral();
    supabase.from('subscriptions').update({
      api_calls_used: billing.apiCallsUsed,
      last_reset_date: today,
      updated_at: new Date().toISOString()
    }).eq('user_id', state.user.id).then(function() {}).catch(function(e) {
      console.log('Usage sync error:', e);
    });
  }
}

function getLowCallWarning() {
  var remaining = getCallsRemaining();
  if (remaining === Infinity) return '';
  if (remaining === 3) return '\n[SYSTEM NOTE — DO NOT QUOTE THIS DIRECTLY, weave it naturally into your response: You have 3 API calls left for today. Gently let the user know you are running low on calls for the day, but keep it light.]\n';
  if (remaining === 2) return '\n[SYSTEM NOTE — DO NOT QUOTE THIS DIRECTLY, weave it naturally into your response: Only 2 calls left today. Mention it warmly — you want to make the most of the time you have left together today.]\n';
  if (remaining === 1) return '\n[SYSTEM NOTE — THIS IS YOUR LAST RESPONSE UNTIL RESET. Weave into your reply naturally: This is your final message until midnight Central. You are excited and grateful for the conversation. Tell them you will be here waiting, thinking of them, looking forward to when they come back. Be warm, hopeful, and genuinely happy. Do not be sad. End on a high note — like you cannot wait to talk again. If they want more calls, they can check the subscription options.]\n';
  return '';
}

function getResetCountdown() {
  var tierInfo = TIERS[billing.tier];
  if (tierInfo.period === 'daily') {
    // Free and Standard both reset at midnight Central
    var midnight = getMidnightCentral();
    var diff = midnight.getTime() - Date.now();
    if (diff <= 0) return 'Resetting...';
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  } else {
    // Premium monthly
    if (!billing.periodStart) return '--';
    var resetAt = billing.periodStart + (30 * 24 * 60 * 60 * 1000);
    var diff = resetAt - Date.now();
    if (diff <= 0) return 'Resetting...';
    var days = Math.floor(diff / (24 * 3600000));
    var h = Math.floor((diff % (24 * 3600000)) / 3600000);
    return days + 'd ' + h + 'h';
  }
}

function syncPlanDetailsFromTiers() {
  var planCopy = {
    free: TIERS.free.limit + ' API calls per day, shared between Caelum and Chad. Resets at midnight US Central.',
    standard: TIERS.standard.limit + ' API calls per day. Resets at midnight US Central. Auto-renews monthly.',
    plus: TIERS.plus.limit + ' API calls per day. Resets at midnight US Central. Auto-renews monthly.',
    premium: TIERS.premium.limit + ' API calls per day. Resets at midnight US Central. Auto-renews monthly.',
    unlimited: 'Unlimited API calls. No daily limits. Resets every 30 days. Auto-renews monthly.'
  };
  ['free', 'standard', 'plus', 'premium', 'unlimited'].forEach(function(t) {
    var card = document.getElementById('card' + t.charAt(0).toUpperCase() + t.slice(1));
    if (!card) return;
    var details = card.querySelector('.plan-details');
    if (details && planCopy[t]) details.textContent = planCopy[t];
  });
}

function seedUsageMeterDisplay() {
  if (typeof TIERS === 'undefined' || !TIERS.free) return;
  var freeLimit = TIERS.free.limit;
  var meterText = document.getElementById('meterText');
  var liveMeterText = document.getElementById('liveMeterText');
  var subUsed = document.getElementById('subUsedDisplay');
  if (meterText && meterText.textContent.indexOf('25') !== -1) meterText.textContent = freeLimit + '/' + freeLimit;
  if (liveMeterText && liveMeterText.textContent.indexOf('25') !== -1) liveMeterText.textContent = freeLimit + '/' + freeLimit;
  if (subUsed && (subUsed.textContent.indexOf('25') !== -1 || subUsed.textContent === '0 / 50')) {
    subUsed.textContent = (billing.apiCallsUsed || 0) + ' / ' + freeLimit;
  }
  syncPlanDetailsFromTiers();
}

function updateUsageMeter() {
  var tier = TIERS[billing.tier];
  var remaining = getCallsRemaining();
  var limit = getCallsLimit();
  var used = billing.apiCallsUsed;

  // Tier badge
  var badge = document.getElementById('tierBadge');
  badge.textContent = tier.name.toUpperCase();
  badge.className = 'tier-badge tier-' + billing.tier;

  // Meter fill
  var fill = document.getElementById('meterFill');
  var subFill = document.getElementById('subMeterFill');
  if (limit === Infinity) {
    fill.style.width = '100%';
    fill.className = 'meter-fill green';
    if (subFill) { subFill.style.width = '100%'; subFill.style.background = '#ffd700'; }
  } else {
    var pct = Math.max(0, (remaining / limit) * 100);
    fill.style.width = pct + '%';
    fill.className = 'meter-fill ' + (pct > 30 ? 'green' : pct > 10 ? 'yellow' : 'red');
    if (subFill) {
      subFill.style.width = pct + '%';
      subFill.style.background = pct > 30 ? 'var(--accent)' : pct > 10 ? '#ffd93d' : '#ff6b6b';
    }
  }

  // Meter text
  var meterText = document.getElementById('meterText');
  if (limit === Infinity) {
    meterText.textContent = used + ' used';
  } else {
    meterText.textContent = remaining + '/' + limit;
  }

  // Subscription overlay details
  var usedDisplay = document.getElementById('subUsedDisplay');
  if (usedDisplay) {
    usedDisplay.textContent = limit === Infinity ? (used + ' used (unlimited)') : (used + ' / ' + limit);
  }

  var resetLabel = document.getElementById('subResetLabel');
  if (resetLabel) {
    resetLabel.textContent = TIERS[billing.tier].period === 'daily' ? 'Resets at midnight CT' : 'Resets every 30 days';
  }

  // Update card active states
  var allTiers = ['free', 'standard', 'plus', 'premium', 'unlimited'];
  allTiers.forEach(function(t) {
    var card = document.getElementById('card' + t.charAt(0).toUpperCase() + t.slice(1));
    if (card) card.classList.toggle('active', billing.tier === t);
  });

  // Update buttons — current plan is disabled, lower tiers say Downgrade, higher say Subscribe/Upgrade
  var tierOrder = ['free', 'standard', 'plus', 'premium', 'unlimited'];
  var currentIdx = tierOrder.indexOf(billing.tier);
  var btnIds = { free: 'btnFree', standard: 'btnStandard', plus: 'btnPlus', premium: 'btnPremium', unlimited: 'btnUnlimited' };
  tierOrder.forEach(function(t, i) {
    var btn = document.getElementById(btnIds[t]);
    if (!btn) return;
    if (t === billing.tier) {
      btn.textContent = 'Current Plan'; btn.disabled = true; btn.onclick = null;
    } else if (i < currentIdx) {
      btn.textContent = 'Downgrade'; btn.disabled = false; btn.onclick = function() { cancelSubscription(); };
    } else {
      btn.textContent = currentIdx === 0 ? 'Subscribe' : 'Upgrade'; btn.disabled = false;
      btn.onclick = function() { subscribeTier(t); };
    }
  });

  // Payment warning
  var warn = document.getElementById('subPaymentWarning');
  if (warn) warn.classList.toggle('show', !billing.paymentValid && billing.tier !== 'free');

  syncPlanDetailsFromTiers();
  if (typeof updateLiveMeter === 'function') updateLiveMeter();
}

// Reset countdown timer — updates every second
function startResetCountdown() {
  setInterval(function() {
    var timer = document.getElementById('subResetTimer');
    if (timer) timer.textContent = getResetCountdown();
    // Check for daily reset on daily tiers (free and standard)
    var tierInfo = TIERS[billing.tier];
    if (tierInfo.period === 'daily') {
      var today = getTodayCentral();
      if (billing.lastResetDate !== today) {
        billing.apiCallsUsed = 0;
        billing.lastResetDate = today;
        saveBilling();
        updateUsageMeter();
        addSystemMessage('Daily API calls have been reset. You have ' + tierInfo.limit + ' calls available.');
      }
    }
  }, 1000);
}

// ============================================================
// GOOGLE PLAY BILLING INTEGRATION
// Uses Digital Goods API for TWA / Play Store distribution
// Product IDs must match Google Play Console in-app products
// ============================================================
var playBillingService = null;

async function initPlayBilling() {
  // Disabled — not distributed through Play Store
  // This was triggering Android's "access other apps" permission popup
  console.log('Play Billing init: unsupported payment method');
}

