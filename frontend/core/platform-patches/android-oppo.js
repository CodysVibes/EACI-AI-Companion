(function() {
  'use strict';
  if (typeof VeilCompat === 'undefined') return;
  VeilCompat.util.wrapFetchWithTimeout(45000);
})();
