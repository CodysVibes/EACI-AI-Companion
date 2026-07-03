// ============================================================
// ACCOUNT DELETION
// ============================================================
async function confirmDeleteAccount() {
  if (!state.user) return;
  var confirmed = confirm('Are you sure you want to permanently delete your account and ALL data? This cannot be undone.');
  if (!confirmed) return;
  var doubleConfirm = confirm('This will delete your profile, conversations, memories, subscription, and all associated data. Type OK to confirm.');
  if (!doubleConfirm) return;

  try {
    addSystemMessage('Deleting account...');
    // Delete user data from all tables
    await supabase.from('conversations').delete().eq('user_id', state.user.id);
    await supabase.from('memories').delete().eq('user_id', state.user.id);
    await supabase.from('user_state').delete().eq('user_id', state.user.id);
    await supabase.from('subscriptions').delete().eq('user_id', state.user.id);
    // Clear local storage
    var keys = Object.keys(localStorage);
    keys.forEach(function(k) { if (k.startsWith('veil_')) localStorage.removeItem(k); });
    // Sign out
    await supabase.auth.signOut();
    addSystemMessage('Account deleted. Goodbye.');
    setTimeout(function() { location.reload(); }, 2000);
  } catch(e) {
    addSystemMessage('Could not delete account. Please contact support.');
    console.error('Account deletion error:', e);
  }
}

