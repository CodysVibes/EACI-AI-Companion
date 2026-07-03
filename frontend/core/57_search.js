// ============================================================
// CONVERSATION SEARCH
// ============================================================
function filterHistory() {
  var query = (document.getElementById('historySearch').value || '').toLowerCase().trim();
  var msgs = document.querySelectorAll('#historyMessages .hist-msg');
  msgs.forEach(function(m) {
    if (!query) { m.style.display = ''; return; }
    var text = m.textContent.toLowerCase();
    m.style.display = text.indexOf(query) !== -1 ? '' : 'none';
  });
}

