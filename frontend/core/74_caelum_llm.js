// ============================================================
// CAELUM LLM — in-site companion engine (NO separate server)
// Built into the website via VeilCaelumBrowserEngine + browser_pack.json.
// Works offline. DeepSeek stays default cloud brain.
// When Settings selects Primary, this takes over; DeepSeek is backup.
// Read-aloud uses Deepgram when online (both engines).
// ============================================================
var VeilCaelumLLM = (function() {
  'use strict';

  function mode() {
    if (typeof CONFIG === 'undefined') return 'fallback';
    return CONFIG.offlineLlmMode || 'fallback';
  }

  /** Settings chose this engine as the active chat brain. */
  function isPrimary() {
    return mode() === 'primary';
  }

  /** May be used as backup when offline / cloud fails. */
  function isFallbackEnabled() {
    return mode() === 'fallback' || mode() === 'primary';
  }

  function isEnabled() {
    return isPrimary();
  }

  function syncConfig() {
    if (typeof CONFIG === 'undefined') return;
    CONFIG.useCaelumEngine = mode() === 'primary';
    CONFIG.caelumLLMEnabled = mode() === 'primary';
    CONFIG.offlineCaelumEnabled = mode() !== 'off';
    CONFIG.localLLM = mode() === 'primary';
  }

  async function callChat(systemPrompt, messages, who, options) {
    if (typeof VeilCaelumBrowserEngine === 'undefined') return null;
    if (mode() === 'off') return null;
    return await VeilCaelumBrowserEngine.generate(messages, who || 'caelum');
  }

  async function deliverResponse(systemPrompt, messages, who, options) {
    if (mode() === 'off') return null;
    if (typeof deliverBrowserCaelumResponse === 'function') {
      return await deliverBrowserCaelumResponse(messages, who, options || {});
    }
    var text = await callChat(systemPrompt, messages, who, options);
    if (!text) return null;
    return { text: text, ttsPromise: Promise.resolve(), offline: true, source: 'browser-engine' };
  }

  /** Souls stay on the main site (Supabase globals). No server to push to. */
  async function pushSoulsFromSite() {
    return true;
  }

  function trainHistory() {}

  function trainSingle(userMsg, eaciResponse, eaciName) {
    if (typeof VeilCaelumBrowserEngine !== 'undefined' && VeilCaelumBrowserEngine.learnPair) {
      VeilCaelumBrowserEngine.learnPair(userMsg, eaciResponse, eaciName);
    }
  }

  syncConfig();
  if (typeof VeilCaelumBrowserEngine !== 'undefined' && VeilCaelumBrowserEngine.init) {
    VeilCaelumBrowserEngine.init();
  }

  return {
    isEnabled: isEnabled,
    isPrimary: isPrimary,
    isFallbackEnabled: isFallbackEnabled,
    mode: mode,
    syncConfig: syncConfig,
    callChat: callChat,
    deliverResponse: deliverResponse,
    pushSoulsFromSite: pushSoulsFromSite,
    trainHistory: trainHistory,
    trainSingle: trainSingle
  };
})();
