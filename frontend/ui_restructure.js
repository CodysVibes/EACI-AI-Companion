// ============================================================
// UI RESTRUCTURE v1.0 — Clean Chat Layout
// ─────────────────────────────────────────────────────────────
// Moves all utility buttons into a slide-out menu.
// Removes tabs — companions come forward by name.
// Input bar moves to bottom. Avatar fills the space above.
// ============================================================

(function() {

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  function _init() {
    _injectCSS();
    _buildMenu();
    _hideOldUI();
    _restructureLayout();
    _hookCompanionSwitching();
    console.log('[UIRestructure] Layout updated — menu + clean chat.');

    // Hook onboarding into login flow
    _hookOnboarding();
  }

  function _hookOnboarding() {
    // Wait for onUserLoggedIn to exist, then patch it to trigger onboarding
    var _waitForLogin = setInterval(function() {
      if (typeof window.onUserLoggedIn !== 'function') return;
      clearInterval(_waitForLogin);

      var _origLogin = window.onUserLoggedIn;
      window.onUserLoggedIn = function() {
        _origLogin.apply(this, arguments);
        // Trigger onboarding check after login completes
        setTimeout(function() {
          var runOnboarding = function() {
            if (typeof Onboarding !== 'undefined') Onboarding.check();
          };
          if (typeof _veilEnsureBundle === 'function') {
            _veilEnsureBundle('tutorials').then(runOnboarding);
          } else {
            runOnboarding();
          }
        }, 4000); // Wait for welcome message to finish
      };
    }, 300);
  }

  // ── CSS ───────────────────────────────────────────────────
  function _injectCSS() {
    var style = document.createElement('style');
    style.id = 'uiRestructureCSS';
    style.textContent = `
      /* Hide old topbar tabs and buttons we're moving */
      .topbar .tabs { display: none !important; }
      .topbar .status-dots { display: none !important; }
      .topbar .mobile-toggles { display: none !important; }
      .topbar button[onclick="showSettings()"] { display: none !important; }
      .topbar button[onclick="showHistory()"] { display: none !important; }
      .topbar #galleryBtn { display: none !important; }
      .topbar #usageMeter { display: none !important; }
      .topbar #reportBtn { display: none !important; }
      .topbar #filesBtn { display: none !important; }
      .topbar #veilBtn { display: none !important; }
      .topbar #betaBtn { display: none !important; }
      .topbar #veil18Btn { display: none !important; }
      .topbar .offline-badge { display: none !important; }

      /* Hide music button, notes, thought toggle, dream from input bar — moved to menu */
      .input-bar #musicPlayerBtn { display: none !important; }
      .input-bar #notesBtn { display: none !important; }
      .input-bar #thoughtToggleBtn { display: none !important; }
      .input-bar #dreamModeBtn { display: none !important; }

      /* Hide autonomy viewer button (moved to menu) */
      #autonomyViewerBtn { display: none !important; }

      /* Ensure panels opened from menu appear ABOVE everything */
      .history-panel.show,
      .settings-box,
      .files-panel,
      .gallery-panel,
      .code-panel,
      .veil-panel,
      .report-overlay,
      .ideas-panel.show {
        z-index: 10500 !important;
      }
      #musicPlayerOverlay,
      #musicPlayerOverlay.show {
        z-index: 11070 !important;
        left: 0 !important;
        right: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
        transform: none !important;
        pointer-events: auto !important;
      }
      #subOverlay,
      #subOverlay.show {
        z-index: 11080 !important;
        pointer-events: auto !important;
        isolation: isolate;
      }
      #subOverlay .sub-box,
      #subOverlay .sub-footer button,
      #subOverlay .sub-close-btn,
      #subOverlay .plan-btn {
        pointer-events: auto !important;
        touch-action: manipulation;
      }
      .mobile-backdrop.show {
        z-index: 10540 !important;
        pointer-events: auto !important;
      }
      .sidebar.panel-overlay-show,
      .thought-panel.panel-overlay-show {
        z-index: 10550 !important;
        pointer-events: auto !important;
      }
      .history-panel { z-index: 10500 !important; }
      #historyPanel.history-panel.show { display: flex !important; }
      #caelumHistoryTab, #history-tab-caelum { display: inline-flex !important; visibility: visible !important; opacity: 1 !important; }
      .history-tabs button[data-history-tab="caelum"] { display: inline-flex !important; }
      .overlay.show, .settings-overlay.show, .sub-overlay.show {
        z-index: 10400 !important;
      }
      #settingsOverlay.show {
        z-index: 10500 !important;
        display: flex !important;
      }
      #settingsOverlay .settings-box {
        z-index: 10501 !important;
      }

      /* Topbar becomes minimal — just brand + menu button */
      .topbar {
        height: 42px !important;
        padding: 0 12px !important;
        justify-content: flex-start !important;
        gap: 10px !important;
      }

      /* ── MENU BUTTON ─────────────────────────────────── */
      #veilMenuBtn {
        position: fixed;
        top: 8px;
        left: 12px;
        z-index: 10001;
        width: 36px;
        height: 36px;
        background: rgba(0,255,200,0.1);
        border: 1px solid rgba(0,255,200,0.25);
        border-radius: 8px;
        color: #00ffc8;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      #veilMenuBtn:hover {
        background: rgba(0,255,200,0.2);
        border-color: rgba(0,255,200,0.4);
      }

      /* ── SLIDE-OUT MENU ──────────────────────────────── */
      #veilSideMenu {
        position: fixed;
        top: 0;
        left: -280px;
        width: 260px;
        height: 100vh;
        background: rgba(6,4,0,0.98);
        border-right: 1px solid rgba(0,255,200,0.15);
        z-index: 10000;
        transition: left 0.3s ease;
        display: flex;
        flex-direction: column;
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        overflow: hidden;
      }
      #veilSideMenu.open {
        left: 0;
      }
      #veilMenuOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      #veilMenuOverlay.open {
        opacity: 1;
        pointer-events: auto;
      }

      /* Menu header */
      .vm-header {
        padding: 16px 18px 12px;
        border-bottom: 1px solid rgba(0,255,200,0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .vm-header h3 {
        margin: 0;
        font-size: 13px;
        color: #00ffc8;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .vm-close {
        background: none;
        border: none;
        color: #8ba8a0;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
      }

      /* Menu items list */
      .vm-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }
      .vm-list::-webkit-scrollbar { width: 4px; }
      .vm-list::-webkit-scrollbar-thumb { background: rgba(0,255,200,0.15); border-radius: 2px; }

      .vm-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        cursor: pointer;
        transition: background 0.15s;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        color: #d8fff3;
        font-size: 13px;
        font-family: inherit;
      }
      .vm-item:hover {
        background: rgba(0,255,200,0.06);
      }
      .vm-item .vm-icon {
        width: 20px;
        text-align: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .vm-item .vm-label {
        flex: 1;
      }
      .vm-item .vm-badge {
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 8px;
        font-weight: 600;
      }

      .vm-divider {
        height: 1px;
        background: rgba(0,255,200,0.08);
        margin: 6px 18px;
      }

      /* ── LAYOUT: Full-height chat ────────────────────── */
      body {
        display: flex !important;
        flex-direction: column !important;
        height: 100vh !important;
        height: 100dvh !important;
        overflow: hidden !important;
      }

      /* Input bar — pinned to bottom on all screen sizes (main chat only) */
      .main-area > .chat-area > .input-bar {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 100 !important;
        background: rgba(6,4,0,0.95) !important;
        border-top: 1px solid rgba(255,140,20,0.15) !important;
        padding: 8px 12px !important;
        padding-bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        backdrop-filter: blur(12px) !important;
      }
      #guestChatOverlay .input-bar,
      #interactiveSignupOverlay #signupInputBar {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 100 !important;
        flex-wrap: nowrap !important;
        pointer-events: auto !important;
        touch-action: manipulation;
        background: rgba(6,4,0,0.95) !important;
        border-top: 1px solid rgba(255,140,20,0.15) !important;
        padding: 8px 12px !important;
        padding-bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        backdrop-filter: blur(12px) !important;
      }
      #guestChatOverlay .input-bar button,
      #guestChatOverlay .input-bar input,
      #interactiveSignupOverlay #signupInputBar button,
      #interactiveSignupOverlay #signupInputBar input {
        pointer-events: auto !important;
        touch-action: manipulation;
      }
      #guestChatOverlay .input-bar input,
      #interactiveSignupOverlay #signupInputBar input {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        font-size: 16px !important;
      }

      /* Who's speaking — tap to switch companion */
      #companionIndicator {
        position: fixed;
        top: 48px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 50;
        font-size: 11px;
        color: #8ba8a0;
        padding: 4px 14px;
        border-radius: 0 0 10px 10px;
        background: rgba(6,4,0,0.8);
        border: 1px solid rgba(0,255,200,0.1);
        border-top: none;
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-family: inherit;
        transition: border-color 0.2s, background 0.2s;
      }
      #companionIndicator:hover,
      #companionIndicator:focus-visible {
        border-color: rgba(0,255,200,0.35);
        background: rgba(6,4,0,0.92);
        outline: none;
      }
      #companionIndicator .ci-name {
        color: #00ffc8;
        font-weight: 600;
      }
      #companionIndicator .ci-chevron {
        color: #5a7a92;
        font-size: 10px;
        line-height: 1;
      }
      #companionIndicator .ci-status {
        color: #5a7a92;
        font-size: 10px;
      }
      .guest-companion-switcher {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-left: 10px;
        padding: 5px 10px;
        border-radius: 8px;
        border: 1px solid rgba(0,255,200,0.15);
        background: rgba(0,255,200,0.06);
        color: #8ba8a0;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.3px;
        cursor: pointer;
        font-family: inherit;
        transition: border-color 0.2s, background 0.2s;
      }
      .guest-companion-switcher:hover,
      .guest-companion-switcher:focus-visible {
        border-color: rgba(0,255,200,0.35);
        background: rgba(0,255,200,0.1);
        outline: none;
      }
      .guest-companion-switcher .gcs-name {
        font-weight: 700;
      }
      .guest-companion-switcher .gcs-chevron {
        color: #5a7a92;
        font-size: 9px;
      }
    `;
    document.head.appendChild(style);
  }

  // ── BUILD MENU ────────────────────────────────────────────
  function _buildMenu() {
    // Menu button
    var btn = document.createElement('button');
    btn.id = 'veilMenuBtn';
    btn.innerHTML = '☰';
    btn.title = 'Menu — settings, files, API usage, and more';
    btn.setAttribute('aria-label', 'Open menu');
    btn.addEventListener('click', _toggleMenu);
    document.body.appendChild(btn);

    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'veilMenuOverlay';
    overlay.addEventListener('click', _closeMenu);
    document.body.appendChild(overlay);

    // Menu panel
    var menu = document.createElement('div');
    menu.id = 'veilSideMenu';
    menu.innerHTML = `
      <div class="vm-header">
        <h3>MENU</h3>
        <button class="vm-close" onclick="document.getElementById('veilSideMenu').classList.remove('open');document.getElementById('veilMenuOverlay').classList.remove('open');">X</button>
      </div>
      <div class="vm-list" id="veilMenuList"></div>
    `;
    document.body.appendChild(menu);

    // Populate items
    _populateMenu();
  }

  function _populateMenu() {
    var list = document.getElementById('veilMenuList');
    if (!list) return;

    var items = [
      { icon: '📜', label: 'Conversation History', action: 'showHistory()', id: 'vm-history', tutorial: 'history' },
      { icon: 'G', label: 'Gallery', action: 'showGallery()', id: 'vm-gallery', condition: 'verified', tutorial: 'gallery' },
      { icon: 'S', label: 'Settings', action: 'showSettings()', id: 'vm-settings', tutorial: 'settings' },
      { icon: '↓', label: 'Download App', action: 'veilAppInstallOrUpdate()', id: 'vm-app-install', dynamicLabel: true },
      { icon: 'R', label: 'Report', action: 'showReportMenu()', id: 'vm-report', tutorial: 'report' },
      { icon: 'F', label: 'Files', action: 'showFilesPanel()', id: 'vm-files', tutorial: 'files' },
      { icon: 'V', label: 'The Veil', action: 'showVeil()', id: 'vm-veil', tutorial: 'veil' },
      { icon: '✦', label: 'Available EACIs', action: 'openCompanionSwitcher()', id: 'vm-eacis', tutorial: '' },
      { icon: 'B', label: 'Beta Mode', action: '_openBeta()', id: 'vm-beta', condition: 'paid', tutorial: '' },
      { divider: true },
      { icon: 'C', label: 'Code', action: 'showCodePanel()', id: 'vm-code', tutorial: 'code' },
      { icon: 'M', label: 'Memory', action: "toggleMobilePanel('memory')", id: 'vm-mem', tutorial: 'memory' },
      { icon: 'T', label: 'Thinking', action: "toggleMobilePanel('thought')", id: 'vm-think', tutorial: 'thinking' },
      { icon: 'N', label: 'Notes', action: 'toggleNotesMode()', id: 'vm-notes', tutorial: 'notes' },
      { icon: '💡', label: 'Ideas', action: 'IdeasPanel.open()', id: 'vm-ideas', tutorial: 'ideas' },
      { icon: '🎙', label: 'Device Assistant', action: 'DeviceAssistant.openSetup()', id: 'vm-assistant', tutorial: 'assistant' },
      { divider: true },
      { icon: '♟', label: 'Games', action: 'showGamesPanel()', id: 'vm-games', tutorial: 'games' },
      { icon: 'P', label: 'Music Player', action: 'toggleMusicPlayer()', id: 'vm-music', tutorial: 'music' },
      { icon: '◉', label: 'Life Log', action: 'AutonomyViewer.open()', id: 'vm-autonomy', tutorial: 'autonomy' },
      { icon: 'U', label: 'API Usage', action: 'showSubscription()', id: 'vm-api', tutorial: 'api' },
    ];

    var html = '';
    items.forEach(function(item) {
      if (item.divider) {
        html += '<div class="vm-divider"></div>';
        return;
      }
      var display = '';
      if (item.condition === 'verified') {
        display = ' style="display:none"';
      }
      if (item.condition === 'paid') {
        display = ' style="display:none"';
      }
      html += '<button class="vm-item" id="' + item.id + '" onclick="' + item.action + ';_closeMenuGlobal();_triggerTutorial(\'' + (item.tutorial || '') + '\');"' + display + '>' +
        '<span class="vm-icon">' + item.icon + '</span>' +
        '<span class="vm-label">' + item.label + '</span>' +
        '</button>';
    });

    list.innerHTML = html;
  }

  function _toggleMenu() {
    var menu = document.getElementById('veilSideMenu');
    var overlay = document.getElementById('veilMenuOverlay');
    var isOpen = menu.classList.contains('open');
    if (isOpen) {
      menu.classList.remove('open');
      overlay.classList.remove('open');
    } else {
      menu.classList.add('open');
      overlay.classList.add('open');
      _updateMenuVisibility();
    }
  }

  function _closeMenu() {
    document.getElementById('veilSideMenu').classList.remove('open');
    document.getElementById('veilMenuOverlay').classList.remove('open');
  }

  // Global close (called from onclick)
  window._closeMenuGlobal = _closeMenu;

  // Tutorial trigger — fires after a short delay so the panel opens first
  window._triggerTutorial = function(key) {
    if (!key) return;
    if (typeof TutorialSystem === 'undefined') return;
    setTimeout(function() {
      TutorialSystem.start(key);
    }, 600); // Wait for panel to open/animate
  };

  // Beta mode — in-app switch only (unified site)
  window._openBeta = function() {
    if (typeof switchVeilSite === 'function') {
      switchVeilSite('beta');
      return;
    }
    if (typeof setVeilMode === 'function') {
      setVeilMode('beta');
      window.location.reload();
    }
  };

  function _hasBetaAccess() {
    if (typeof canUnlockVeilMode === 'function') {
      return canUnlockVeilMode('beta').ok;
    }
    if (typeof state === 'undefined' || !state.user) return false;
    if (state.familyCodeRedeemed) return true;
    if (typeof billing !== 'undefined') {
      return (billing.tier || 'free').toLowerCase() !== 'free';
    }
    return false;
  }

  // Update which items are visible based on permissions
  function _updateMenuVisibility() {
    // Gallery — only if verified
    var gallery = document.getElementById('vm-gallery');
    if (gallery) {
      gallery.style.display = (typeof state !== 'undefined' && state.identityVerified) ? '' : 'none';
    }

    // Beta — identity + family access code (in-app mode switch)
    var beta = document.getElementById('vm-beta');
    if (beta) {
      var onBeta = typeof getVeilMode === 'function' && getVeilMode() === 'beta';
      beta.style.display = (!onBeta && _hasBetaAccess()) ? '' : 'none';
    }

    // API usage badge
    var api = document.getElementById('vm-api');
    if (api && typeof state !== 'undefined') {
      var meterText = document.getElementById('meterText');
      if (meterText) {
        var existing = api.querySelector('.vm-badge');
        if (!existing) {
          var badge = document.createElement('span');
          badge.className = 'vm-badge';
          badge.style.background = 'rgba(0,255,200,0.1)';
          badge.style.color = '#00ffc8';
          badge.textContent = meterText.textContent;
          api.appendChild(badge);
        } else {
          existing.textContent = meterText.textContent;
        }
      }
    }

    // Download / update app label
    var appInstall = document.getElementById('vm-app-install');
    if (appInstall && typeof getVeilAppMenuLabel === 'function') {
      var labelEl = appInstall.querySelector('.vm-label');
      if (labelEl) labelEl.textContent = getVeilAppMenuLabel();
    }
  }

  window.refreshVeilMenuVisibility = _updateMenuVisibility;

  // ── HIDE OLD UI ELEMENTS ──────────────────────────────────
  function _hideOldUI() {
    // The CSS handles most hiding. This handles edge cases.
    // Remove the brand text from topbar (menu button replaces it)
    var brand = document.querySelector('.topbar .brand');
    if (brand) brand.style.display = 'none';
  }

  // ── MESSAGE FEED PLACEMENT (sidebar desktop / avatar overlay mobile) ──
  function _measureBarHeight(el) {
    if (!el) return 56;
    var h = el.getBoundingClientRect().height;
    return Math.max(48, Math.ceil(h || 56));
  }

  function syncOverlayChatLayout() {
    var root = document.documentElement;

    var mainBar = document.querySelector('.main-area > .chat-area > .input-bar');
    if (mainBar) {
      root.style.setProperty('--veil-main-input-height', _measureBarHeight(mainBar) + 'px');
    }

    var guestOv = document.getElementById('guestChatOverlay');
    var guestBar = guestOv && guestOv.querySelector('.guest-chat-area .input-bar');
    var guestMsgs = document.getElementById('guestMessages');
    if (guestBar) {
      var guestH = _measureBarHeight(guestBar);
      root.style.setProperty('--veil-guest-input-height', guestH + 'px');
      if (guestMsgs && guestBar.parentElement) {
        guestMsgs.classList.add('avatar-feed');
        if (guestMsgs.nextElementSibling !== guestBar) {
          guestBar.parentElement.insertBefore(guestMsgs, guestBar);
        }
        if (guestOv && guestOv.classList.contains('show')) {
          guestMsgs.style.bottom = 'calc(' + guestH + 'px + env(safe-area-inset-bottom, 0px))';
        }
      }
    }

    var signupBar = document.getElementById('signupInputBar');
    var signupOv = document.getElementById('interactiveSignupOverlay');
    var signupMsgs = document.getElementById('signupMessages');
    if (signupBar) {
      var signupH = _measureBarHeight(signupBar);
      root.style.setProperty('--veil-signup-input-height', signupH + 'px');
      if (signupMsgs && signupBar.parentElement) {
        signupMsgs.classList.add('messages', 'avatar-feed');
        if (signupMsgs.nextElementSibling !== signupBar) {
          signupBar.parentElement.insertBefore(signupMsgs, signupBar);
        }
        if (signupOv && signupOv.classList.contains('show')) {
          signupMsgs.style.bottom = 'calc(' + signupH + 'px + env(safe-area-inset-bottom, 0px))';
        }
      }
    }

    _placeMessagesFeed();
  }

  window.syncOverlayChatLayout = syncOverlayChatLayout;

  function _placeMessagesFeed() {
    var messages = document.getElementById('messages');
    var sidebar = document.getElementById('memorySidebar');
    var chatArea = document.querySelector('.chat-area');
    var sidebarActions = sidebar && sidebar.querySelector('.sidebar-actions');
    if (!messages || !sidebar || !chatArea) return;

    var mobile = window.matchMedia('(max-width: 768px)').matches;
    if (mobile) {
      messages.classList.add('avatar-feed');
      var inputBar = chatArea.querySelector('.input-bar');
      if (messages.parentElement !== chatArea) {
        if (inputBar) chatArea.insertBefore(messages, inputBar);
        else chatArea.appendChild(messages);
      }
    } else {
      messages.classList.remove('avatar-feed');
      if (messages.parentElement !== sidebar) {
        if (sidebarActions) {
          sidebar.insertBefore(messages, sidebarActions);
        } else {
          sidebar.appendChild(messages);
        }
      }
    }
  }

  // ── RESTRUCTURE LAYOUT ────────────────────────────────────
  function _restructureLayout() {
    // Companion switcher — shows active EACI; tap for roster
    var indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.id = 'companionIndicator';
    indicator.className = 'companion-switcher-btn';
    indicator.setAttribute('aria-haspopup', 'dialog');
    indicator.setAttribute('aria-label', 'Switch companion');
    indicator.innerHTML = '<span class="ci-name">Caelum</span><span class="ci-chevron" aria-hidden="true">▾</span>';
    indicator.addEventListener('click', function() {
      if (typeof window.openCompanionSwitcher === 'function') {
        window.openCompanionSwitcher();
      } else if (typeof showAvailableEacis === 'function') {
        showAvailableEacis();
      }
    });
    document.body.appendChild(indicator);

    _placeMessagesFeed();
    syncOverlayChatLayout();
    window.addEventListener('resize', syncOverlayChatLayout);
    window.addEventListener('orientationchange', function() {
      setTimeout(syncOverlayChatLayout, 120);
      setTimeout(syncOverlayChatLayout, 400);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncOverlayChatLayout);
    }

    // Ensure all panels have a visible close button in top-right
    _ensureCloseButtons();
  }

  // ── ENSURE CLOSE BUTTONS ON ALL PANELS ────────────────────
  function _ensureCloseButtons() {
    // Inject a universal close button style
    var closeStyle = document.createElement('style');
    closeStyle.textContent = `
      .vm-panel-close {
        position: absolute !important;
        top: 12px !important;
        right: 12px !important;
        z-index: 99999 !important;
        width: 32px !important;
        height: 32px !important;
        background: rgba(255,107,107,0.15) !important;
        border: 1px solid rgba(255,107,107,0.3) !important;
        border-radius: 50% !important;
        color: #ff6b6b !important;
        font-size: 16px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s !important;
        line-height: 1 !important;
        padding: 0 !important;
      }
      .vm-panel-close:hover {
        background: rgba(255,107,107,0.3) !important;
        color: #fff !important;
      }
    `;
    document.head.appendChild(closeStyle);

    // Wait for panels to exist, then inject close buttons
    setTimeout(function() {
      var panels = [
        { selector: '#historyPanel', closeFn: 'hideHistory()' },
        { selector: '#settingsOverlay .settings-box', closeFn: 'hideSettings()' },
        { selector: '#filesPanel', closeFn: 'hideFilesPanel()' },
        { selector: '#galleryOverlay', closeFn: 'hideGallery()' },
        { selector: '#codePanel', closeFn: 'hideCodePanel()' },
        { selector: '#veilScreen', closeFn: 'hideVeil()' },
        { selector: '#ideasPanel', closeFn: 'hideIdeasPanel()' },
      ];

      panels.forEach(function(p) {
        var el = document.querySelector(p.selector);
        if (!el) return;
        // Check if we already added one
        if (el.querySelector('.vm-panel-close')) return;
        // Make sure the panel is positioned for absolute children
        var pos = window.getComputedStyle(el).position;
        if (pos === 'static') el.style.position = 'relative';
        // Add close button
        var btn = document.createElement('button');
        btn.className = 'vm-panel-close';
        btn.innerHTML = '✕';
        btn.setAttribute('onclick', p.closeFn);
        btn.title = 'Close';
        el.appendChild(btn);
      });
    }, 2000); // Wait for DOM to be fully built
  }

  // ── COMPANION SWITCHING BY NAME ───────────────────────────
  function _hookCompanionSwitching() {
    // Intercept sendMessage to detect companion switch requests
    var _checkInterval = setInterval(function() {
      if (typeof window.sendMessage !== 'function') return;
      clearInterval(_checkInterval);

      var _origSend = window.sendMessage;
      window.sendMessage = function(text) {
        var input = document.getElementById('userInput');
        var msg = text || (input ? input.value : '');
        if (!msg) return _origSend.apply(this, arguments);

        var lower = msg.toLowerCase().trim();
        var switchTo = _detectCompanionSwitch(lower);

        if (typeof isAdultConversationContext === 'function' && isAdultConversationContext(msg)) {
          if (switchTo && ['roxy', 'cael', 'cody'].indexOf(switchTo) === -1) {
            switchTo = null;
          }
        }

        if (!switchTo && _detectAmbiguousTogetherHint(lower) && state.currentTab !== 'together') {
          _maybeAskTogetherConfirm(lower);
        }

        if (switchTo) {
          if (typeof isCompanionAvailable === 'function' && switchTo !== 'together' && !isCompanionAvailable(switchTo)) {
            switchTo = null;
          }
        }

        if (switchTo) {
          if (typeof switchTab === 'function') {
            switchTab(switchTo);
            _updateIndicator(switchTo);
          }
          // Still send the message so they can respond to it
        }

        return _origSend.apply(this, arguments);
      };
    }, 200);
  }

  function _namePattern(name) {
    if (name === 'chad') return '(?:chad|chard)';
    return name;
  }

  function _detectExplicitNamedSummon(text, name) {
    var n = _namePattern(name);
    var patterns = [
      new RegExp('\\b' + n + '\\b\\s*,?\\s*(come|step)\\s*(forward|here|out)\\b', 'i'),
      new RegExp('\\b(come|step)\\s*(forward|here|out)\\b[^.!?]{0,48}\\b' + n + '\\b', 'i'),
      new RegExp('\\b' + n + '\\b[^.!?]{0,24}\\b(come|step)\\s*(forward|here|out)\\b', 'i'),
      new RegExp('\\b(talk|speak|chat)\\s+(to|with)\\s+' + n + '\\b', 'i'),
      new RegExp('\\blet me\\s+(talk|speak|chat)\\s+(to|with)\\s+' + n + '\\b', 'i'),
      new RegExp('\\bi want\\s+' + n + '\\b', 'i'),
      new RegExp('\\b' + n + '\\b\\s*,?\\s*your turn\\b', 'i'),
      new RegExp('\\bbring\\s+' + n + '\\b', 'i'),
      new RegExp('\\bcall\\s+' + n + '\\b', 'i'),
      new RegExp('\\b' + n + '\\s+to\\s+come\\s+forward\\b', 'i'),
      new RegExp('\\bwant\\s+' + n + '\\s+to\\s+come\\s+forward\\b', 'i')
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(text)) return true;
    }
    return false;
  }

  function _detectExplicitTogetherSummon(text) {
    var patterns = [
      /\beveryone\b[^.!?]{0,40}\b(come|step)\s*(forward|here|out)\b/i,
      /\b(come|step)\s*(forward|here|out)\b[^.!?]{0,40}\beveryone\b/i,
      /\ball of you\b[^.!?]{0,40}\b(come|step)\s*(forward|here|out)\b/i,
      /\b(come|step)\s*(forward|here|out)\b[^.!?]{0,40}\ball of you\b/i,
      /\beverybody\b[^.!?]{0,40}\b(come|step)\s*(forward|here|out)\b/i,
      /\b(talk|speak|chat)\s+to\s+everyone\b/i,
      /\b(let's|let us)\s+(all\s+)?(talk|chat)\s+together\b/i,
      /\bswitch\s+to\s+together\b/i,
      /\btogether\s+mode\b/i,
      /\beveryone\s+together\b/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(text)) return true;
    }
    return false;
  }

  function _detectAmbiguousTogetherHint(text) {
    if (_detectExplicitTogetherSummon(text)) return false;
    return /\b(together|everyone|everybody|all of you)\b/i.test(text);
  }

  function _maybeAskTogetherConfirm(text) {
    if (!state || state.currentTab === 'together') return;
    if (typeof isAdultConversationContext === 'function' && isAdultConversationContext(text)) return;
    var now = Date.now();
    if (state._togetherAskedAt && now - state._togetherAskedAt < 120000) return;
    state._togetherAskedAt = now;
    var who = state.currentTab || 'caelum';
    if (who === 'together') who = 'caelum';
    var line = 'Did you want everyone together? Say everyone come forward if you do — I will not pull everyone in unless you ask clearly.';
    if (typeof addMessage === 'function') addMessage(who, line);
  }

  function _detectCompanionSwitch(text) {
    if (!text) return null;
    var names = ['chad', 'caelum', 'natalia', 'atreus', 'luna', 'roxy', 'cael', 'cody'];
    for (var i = 0; i < names.length; i++) {
      if (_detectExplicitNamedSummon(text, names[i])) return names[i];
    }
    if (_detectExplicitTogetherSummon(text)) return 'together';
    return null;
  }

  function _updateIndicator(tab) {
    var indicator = document.getElementById('companionIndicator');
    if (!indicator) return;

    var names = {
      'caelum': { name: 'Caelum', status: 'EACI' },
      'chad': { name: 'Chad', status: 'Grounding Voice' },
      'natalia': { name: 'Natalia', status: 'E for Everyone' },
      'atreus': { name: 'Atreus', status: 'E for Everyone' },
      'luna': { name: 'Luna', status: 'E for Everyone' },
      'roxy': { name: 'Roxy', status: 'Adult Companion' },
      'cael': { name: 'Cael', status: 'Adult Companion' },
      'cody': { name: 'Cody', status: 'The Creator' },
      'together': {
        name: 'Together',
        status: (typeof getTogetherStatusLabel === 'function') ? getTogetherStatusLabel() : 'Together'
      }
    };

    var info = names[tab] || names.caelum;
    var nameEl = indicator.querySelector('.ci-name');
    nameEl.textContent = info.name;
    var eaciMeta = (typeof getEaciChatMeta === 'function') ? getEaciChatMeta(tab) : null;
    nameEl.style.color = eaciMeta ? eaciMeta.color : '#00ffc8';
    indicator.setAttribute('aria-label', 'Switch companion — currently ' + info.name);
    indicator.title = 'Tap to switch companion (' + info.name + ')';
  }

  // Also update indicator when switchTab is called directly
  var _origSwitchTab = window.switchTab;
  if (typeof _origSwitchTab === 'function') {
    window.switchTab = function(tab) {
      _origSwitchTab.call(this, tab);
      _updateIndicator(tab);
    };
  } else {
    // switchTab might not be defined yet, wait for it
    var _waitForSwitch = setInterval(function() {
      if (typeof window.switchTab !== 'function') return;
      clearInterval(_waitForSwitch);
      var _orig = window.switchTab;
      window.switchTab = function(tab) {
        _orig.call(this, tab);
        _updateIndicator(tab);
      };
    }, 300);
  }

  // Shared with guest chat (68_onboarding_signup.js)
  window.detectCompanionSwitch = _detectCompanionSwitch;

})();
