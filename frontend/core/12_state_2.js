// ============================================================
// ERROR RECOVERY — Shows visible error states instead of infinite thinking
// ============================================================
function showErrorMessage(who, errorText) {
  removeThinkingIndicator(who);
  addMessage('system', errorText);
}

