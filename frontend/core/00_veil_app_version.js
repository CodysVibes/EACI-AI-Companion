// ============================================================
// VEIL APP VERSION — bump all mirrors when releasing:
//   core/00_veil_app_version.js  (this file)
//   manifest.json                version + version_name
//   sw.js                        SW_VERSION
//   core/06_service_worker.js    BUILD_VERSION
// ============================================================
var VEIL_APP_VERSION = '14.1.1';
var VEIL_APP_BUILD = '20260626';
var VEIL_SW_VERSION = 'v' + VEIL_APP_VERSION + '-' + VEIL_APP_BUILD;

window.VEIL_APP_VERSION = VEIL_APP_VERSION;
window.VEIL_APP_BUILD = VEIL_APP_BUILD;
window.VEIL_SW_VERSION = VEIL_SW_VERSION;
