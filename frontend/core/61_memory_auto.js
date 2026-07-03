// ============================================================
// MEMORY AUTO-EXTRACTION — Re-enabled with smarter extraction
// ============================================================
var memoryExtractionEnabled = true;
var MEMORY_EXTRACT_EVERY = 8; // every 8 exchanges

// Auto-save conversation to cloud after each exchange
var _lastSavedCount = 0;
async function autoSaveConversation() {
  if (!state.user || state.conversationHistory.length === 0) return;
  var newMessages = state.conversationHistory.slice(_lastSavedCount);
  if (newMessages.length === 0) return;
  _lastSavedCount = state.conversationHistory.length;
  try {
    var tab = state.currentTab || 'caelum';
    var tagged = newMessages.filter(function(msg) {
      return messageBelongsToHistoryTab(msg, tab);
    }).map(function(msg) {
      return {
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        _tab: msg._tab || tab
      };
    });
    if (tagged.length === 0) return;
    var { data: existing } = await supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', state.user.id)
      .eq('tab', tab)
      .maybeSingle();
    var merged = (existing && existing.messages) ? existing.messages.concat(tagged) : tagged;
    // Unlimited history enabled. Old 200-message limit removed.
    await supabase.from('conversations').upsert({
      user_id: state.user.id,
      tab: tab,
      messages: merged,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,tab' });
  } catch(e) {
    console.log('Auto-save error:', e);
    logError('auto_save', e.message, e.stack, 'autoSaveConversation', {});
  }
}

