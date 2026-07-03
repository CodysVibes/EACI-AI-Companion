// ============================================================
// VEIL PROJECT RECIPES — Cody's stack (core JS, Tauri, index.html scripts)
// ============================================================
(function () {
  'use strict';

  var RECIPES = [
    {
      id: 'core_module',
      re: /\b(core module|new core file|iife module|add.*core\/.*\.js)\b/i,
      body: function () {
        return 'FILENAME: core/my_module.js\n```javascript\n// ============================================================\n// MY MODULE\n// ============================================================\n(function () {\n  \'use strict\';\n\n  function init() {\n    console.log(\'[MyModule] ready\');\n  }\n\n  window.MyModule = {\n    init: init\n  };\n\n  document.addEventListener(\'DOMContentLoaded\', init);\n})();\n```\nVERIFY: Add script tag to index.html after dependencies; reload — expect log in console.';
      }
    },
    {
      id: 'tauri_invoke',
      re: /\b(tauri invoke|tauri command|__TAURI__\.core\.invoke)\b/i,
      body: function () {
        return 'FILENAME: core/my_bridge.js\n```javascript\n(function () {\n  \'use strict\';\n\n  function isTauri() {\n    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);\n  }\n\n  async function myCommand(args) {\n    if (!isTauri()) throw new Error(\'Desktop app only\');\n    return window.__TAURI__.core.invoke(\'my_command\', args || {});\n  }\n\n  window.MyBridge = { isTauri: isTauri, myCommand: myCommand };\n})();\n```\nVERIFY: Register command in src-tauri lib.rs invoke_handler; rebuild EXE.';
      }
    },
    {
      id: 'index_script_tag',
      re: /\b(add script to index|index\.html script|load.*core\/.*\.js)\b/i,
      body: function (req) {
        var file = (req.match(/core\/[\w_.-]+\.js/i) || [])[0] || 'core/my_module.js';
        return 'FILENAME: index.html\n```html\n<!-- Add before closing scripts block, AFTER dependencies: -->\n<script src="/' + file + '?v=1"></script>\n```\nVERIFY: Place after files it depends on; hard refresh (Ctrl+Shift+R). Mirror to offline version/app/index.html if editing main site.';
      }
    },
    {
      id: 'veil_ide_hook',
      re: /\b(veilide|veil ide|open folder|project mode)\b/i,
      body: function () {
        return 'FILENAME: core/my_feature.js\n```javascript\n(function () {\n  \'use strict\';\n  function onProjectOpen() {\n    if (typeof VeilIDE === \'undefined\' || !VeilIDE.isActive()) return;\n    console.log(\'Project:\', VeilIDE.getWorkspaceLabel && VeilIDE.getWorkspaceLabel());\n  }\n  document.addEventListener(\'DOMContentLoaded\', function () {\n    setTimeout(onProjectOpen, 2000);\n  });\n})();\n```\nVERIFY: Open folder in Code tab — callback runs.';
      }
    },
    {
      id: 'fix_brackets',
      re: /\b(fix bracket|unclosed brace|syntax error|mismatched)\b/i,
      body: function () {
        return 'Use local lint: run Check in Code tab. Balance {}, (), []. Return COMPLETE file — no partial snippets.';
      }
    },
    {
      id: 'mirror_offline',
      re: /\b(mirror offline|offline version|sync main and offline)\b/i,
      body: function (req) {
        var f = (req.match(/core\/[\w_.-]+\.js/i) || [])[0] || 'core/file.js';
        return 'Update BOTH paths when changing shared core:\n1. Version 14 all three sites/the-veil-main-v14/' + f + '\n2. offline version/app/' + f + '\nAlso bump ?v= on script tags in both index.html files.';
      }
    },
    {
      id: 'rust_command_stub',
      re: /\b(rust command|tauri command rust|#\[tauri::command\])\b/i,
      body: function () {
        return 'FILENAME: src-tauri/src/my_cmd.rs\n```rust\n#[tauri::command]\npub fn my_command(name: String) -> Result<String, String> {\n    if name.trim().is_empty() {\n        return Err("name required".into());\n    }\n    Ok(format!("Hello, {}", name.trim()))\n}\n```\nVERIFY: Add `mod my_cmd;` and register in lib.rs invoke_handler; cargo check.';
      }
    }
  ];

  window.VEIL_CODING_VEIL_PACK = {
    recipes: RECIPES,
    version: 1
  };
})();
