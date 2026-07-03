// ============================================================
// UTILITIES
// ============================================================
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

