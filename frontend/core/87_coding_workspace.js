// ============================================================
// VEIL CODING WORKSPACE — repo index, grep, symbols, smart context
// ============================================================
(function () {
  'use strict';

  var INDEX_TTL = 300000;
  var MAX_READ = 32;
  var MAX_SYMBOL_FILES = 500;
  var CONTEXT_DEFAULT = 56000;
  var WS_DB = 'veil-ws-index-v2';
  var TEXT_EXT = { js: 1, jsx: 1, ts: 1, tsx: 1, html: 1, htm: 1, css: 1, json: 1, py: 1, rs: 1, md: 1, sql: 1, toml: 1 };

  var cache = {
    at: 0,
    paths: [],
    scripts: [],
    entryHtml: '',
    symbols: [],
    symbolAt: 0
  };

  var SYMBOL_RE = [
    /function\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /class\s+([A-Za-z_$][\w$]*)/g,
    /pub\s+fn\s+([A-Za-z_][\w]*)/g,
    /fn\s+([A-Za-z_][\w]*)/g,
    /export\s+(?:default\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*)/g
  ];

  function ide() {
    return typeof VeilIDE !== 'undefined' ? VeilIDE : null;
  }

  function tokenize(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9_./-]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 1;
    });
  }

  function scoreTokens(tokens, hay) {
    if (!tokens.length || !hay) return 0;
    var h = hay.toLowerCase();
    var hit = 0;
    tokens.forEach(function (t) {
      if (h.indexOf(t) >= 0) hit++;
    });
    return hit / tokens.length;
  }

  function isTextFile(path) {
    var ext = (path || '').split('.').pop().toLowerCase();
    return !!TEXT_EXT[ext];
  }

  function wsKey() {
    var v = ide();
    var label = (v && v.getWorkspaceLabel) ? v.getWorkspaceLabel() : 'ws';
    return label + '|' + cache.paths.length;
  }

  function openWsDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(WS_DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  async function wsDbGet(key) {
    try {
      var db = await openWsDb();
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('kv', 'readonly');
        var r = tx.objectStore('kv').get(key);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    } catch (e) { return null; }
  }

  async function wsDbSet(key, val) {
    try {
      var db = await openWsDb();
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(val, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    } catch (e) { /* ignore */ }
  }

  function findImportRefs(content) {
    var refs = [];
    var re = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?|from\s+['"]([^'"]+)['"]/g;
    var m;
    while ((m = re.exec(content)) !== null) {
      refs.push(m[1] || m[2]);
    }
    return refs;
  }

  async function getRelatedFiles(activePath) {
    if (!activePath) return [];
    var v = ide();
    if (!v || !v.readWorkspaceFile) return [];
    await ensureIndex();
    try {
      var content = await v.readWorkspaceFile(activePath);
      var refs = findImportRefs(content);
      var base = activePath.split('/').slice(0, -1).join('/');
      var out = [];
      refs.forEach(function (ref) {
        if (ref.indexOf('.') < 0) ref += '.js';
        var candidates = [
          ref,
          base + '/' + ref,
          'core/' + ref.replace(/^\.\//, '')
        ];
        candidates.forEach(function (c) {
          var hit = cache.paths.find(function (p) { return p === c || p.endsWith('/' + c); });
          if (hit && out.indexOf(hit) < 0) out.push(hit);
        });
      });
      return out.slice(0, 12);
    } catch (e) { return []; }
  }

  async function deepExplore(userText) {
    await ensureIndex();
    await buildSymbolIndex();
    var tokens = tokenize(userText).filter(function (t) { return t.length > 2; }).slice(0, 8);
    var parts = ['## AUTO-EXPLORE (repo scan)'];
    var seenPath = {};

    for (var i = 0; i < tokens.length; i++) {
      var gh = await grep(tokens[i], 25);
      gh.slice(0, 8).forEach(function (h) {
        if (seenPath[h.path]) return;
        seenPath[h.path] = 1;
        parts.push('- `' + h.path + '` L' + h.line + ': ' + h.text.trim().slice(0, 100));
      });
    }

    var symNames = [];
    tokens.forEach(function (tok) {
      cache.symbols.forEach(function (sym) {
        if (sym.name.toLowerCase() === tok || sym.name.toLowerCase().indexOf(tok) >= 0) {
          symNames.push(sym.name + ' → ' + sym.path);
        }
      });
    });
    if (symNames.length) {
      parts.push('## SYMBOLS\n' + symNames.slice(0, 20).join('\n'));
    }

    var active = ide() && ide().getActivePath ? ide().getActivePath() : '';
    if (active) {
      var rel = await getRelatedFiles(active);
      if (rel.length) parts.push('## IMPORTS FROM ACTIVE FILE\n' + rel.join('\n'));
    }

    if (typeof VeilCodingTerminal !== 'undefined') {
      try {
        var git = await VeilCodingTerminal.gitStatus();
        if (git && !git.skipped) parts.push('## GIT\n' + VeilCodingTerminal.formatGitStatus(git));
      } catch (e) { /* ignore */ }
    }

    return parts.join('\n').slice(0, 6000);
  }

  function pathExists(path) {
    return cache.paths.indexOf(path) >= 0 || cache.paths.some(function (p) { return p.endsWith('/' + path); });
  }

  async function ensureIndex() {
    var v = ide();
    if (!v || !v.isActive || !v.isActive()) return cache;
    if (cache.at && Date.now() - cache.at < INDEX_TTL && cache.paths.length) return cache;

    var entries = v.getFileEntries ? v.getFileEntries() : [];
    cache.paths = entries.map(function (e) { return e.path; }).filter(isTextFile);
    cache.scripts = [];
    cache.entryHtml = '';

    var htmlPath = cache.paths.find(function (p) { return /(^|\/)index\.html$/i.test(p); });
    if (htmlPath && v.readWorkspaceFile) {
      try {
        var html = await v.readWorkspaceFile(htmlPath);
        cache.entryHtml = htmlPath;
        var re = /<script[^>]+src=["']([^"']+)["']/gi;
        var m;
        while ((m = re.exec(html)) !== null) {
          cache.scripts.push(m[1].replace(/^\//, ''));
        }
      } catch (e) { /* ignore */ }
    }

    cache.at = Date.now();
    return cache;
  }

  function extractSymbols(path, content) {
    var out = [];
    SYMBOL_RE.forEach(function (re) {
      var m;
      var r = new RegExp(re.source, re.flags);
      while ((m = r.exec(content)) !== null) {
        if (m[1] && m[1].length > 2) out.push({ name: m[1], path: path });
      }
    });
    return out;
  }

  async function buildSymbolIndex() {
    await ensureIndex();
    if (cache.symbolAt && Date.now() - cache.symbolAt < INDEX_TTL && cache.symbols.length) return cache.symbols;

    var cached = await wsDbGet('sym:' + wsKey());
    if (cached && cached.symbols && cached.pathsLen === cache.paths.length && Date.now() - (cached.at || 0) < INDEX_TTL * 2) {
      cache.symbols = cached.symbols;
      cache.symbolAt = cached.at;
      return cache.symbols;
    }

    var v = ide();
    if (!v || !v.readWorkspaceFile) return [];
    var symbols = [];
    var scanned = 0;
    for (var i = 0; i < cache.paths.length && scanned < MAX_SYMBOL_FILES; i++) {
      var p = cache.paths[i];
      if (!/\.(js|jsx|ts|tsx|rs|py)$/i.test(p)) continue;
      try {
        var content = await v.readWorkspaceFile(p);
        extractSymbols(p, content).forEach(function (s) { symbols.push(s); });
        scanned++;
      } catch (e) { /* skip */ }
    }
    cache.symbols = symbols;
    cache.symbolAt = Date.now();
    wsDbSet('sym:' + wsKey(), { at: cache.symbolAt, symbols: symbols, pathsLen: cache.paths.length });
    return symbols;
  }

  async function grep(query, limit) {
    limit = limit || 60;
    var q = String(query || '').trim();
    if (q.length < 2) return [];

    var v = ide();
    // Tauri native grep when available; empty result falls through to JS scan (website / web folder API)
    if (v && v.grepWorkspace) {
      try {
        var nativeHits = await v.grepWorkspace(q, limit);
        if (nativeHits && nativeHits.length) return nativeHits;
      } catch (e) { /* fallback */ }
    }

    await ensureIndex();
    if (!v || !v.readWorkspaceFile) return [];
    var ql = q.toLowerCase();
    var hits = [];
    for (var i = 0; i < cache.paths.length && hits.length < limit; i++) {
      try {
        var content = await v.readWorkspaceFile(cache.paths[i]);
        var lines = content.split('\n');
        for (var li = 0; li < lines.length && hits.length < limit; li++) {
          if (lines[li].toLowerCase().indexOf(ql) >= 0) {
            hits.push({ path: cache.paths[i], line: li + 1, text: lines[li].slice(0, 240) });
          }
        }
      } catch (e) { /* skip */ }
    }
    return hits;
  }

  function findMirrorHint(path) {
    if (!path) return '';
    var p = path.replace(/\\/g, '/');
    if (p.indexOf('offline version/app/') >= 0) {
      return p.replace('offline version/app/', 'Version 14 all three sites/the-veil-main-v14/');
    }
    if (p.indexOf('the-veil-main-v14/') >= 0) {
      return p.replace('Version 14 all three sites/the-veil-main-v14/', 'offline version/app/');
    }
    return '';
  }

  function expandWithMirrors(files) {
    var out = files.slice();
    var seen = {};
    files.forEach(function (f) { seen[f.path] = 1; });
    files.forEach(function (f) {
      var mirror = findMirrorHint(f.path);
      if (!mirror || seen[mirror]) return;
      if (!pathExists(mirror)) return;
      var base = f.path.split('/').pop();
      if (mirror.endsWith('/' + base) || mirror.endsWith(base)) {
        out.push({ path: mirror, lang: f.lang, code: f.code, mirrored: true });
        seen[mirror] = 1;
      }
    });
    return out;
  }

  async function search(userText, limit) {
    limit = limit || 10;
    await ensureIndex();
    var tokens = tokenize(userText);
    var scored = [];

    cache.paths.forEach(function (p) {
      var s = scoreTokens(tokens, p);
      if (s > 0.2) scored.push({ path: p, score: s });
    });

    cache.scripts.forEach(function (s) {
      var sScore = scoreTokens(tokens, s);
      if (sScore > 0.25) {
        var norm = s.replace(/^\//, '');
        var match = cache.paths.find(function (p) { return p.endsWith(norm) || p.endsWith(s); });
        if (match) scored.push({ path: match, score: sScore + 0.15, viaScript: true });
      }
    });

    await buildSymbolIndex();
    tokens.forEach(function (tok) {
      if (tok.length < 3) return;
      cache.symbols.forEach(function (sym) {
        if (sym.name.toLowerCase() === tok || sym.name.toLowerCase().indexOf(tok) >= 0) {
          scored.push({ path: sym.path, score: 0.85, viaSymbol: sym.name });
        }
      });
    });

    var grepHits = await grep(tokens.slice(0, 4).join(' '), 40);
    grepHits.forEach(function (h) {
      scored.push({ path: h.path, score: 0.7, grepLine: h.line, grepText: h.text });
    });

    scored.sort(function (a, b) { return b.score - a.score; });
    var seen = {};
    var out = [];
    scored.forEach(function (row) {
      if (seen[row.path]) return;
      seen[row.path] = 1;
      out.push(row);
    });
    return out.slice(0, limit);
  }

  function snippetAround(content, tokens, maxLen) {
    maxLen = maxLen || 600;
    var lines = String(content || '').split('\n');
    var best = -1;
    var bestScore = 0;
    for (var i = 0; i < lines.length; i++) {
      var s = scoreTokens(tokens, lines[i]);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    if (best < 0) return String(content || '').slice(0, maxLen);
    var start = Math.max(0, best - 8);
    var chunk = lines.slice(start, start + 24).join('\n');
    if (chunk.length > maxLen) chunk = chunk.slice(0, maxLen) + '\n...';
    return chunk;
  }

  async function buildContext(userText, maxChars) {
    maxChars = maxChars || CONTEXT_DEFAULT;
    var v = ide();
    if (!v || !v.isActive || !v.isActive()) return v && v.getProjectContext ? v.getProjectContext(maxChars) : '';

    await ensureIndex();
    await buildSymbolIndex();
    var parts = [];
    var budget = maxChars;
    var tokens = tokenize(userText);

    parts.push('## WORKSPACE (' + (v.getWorkspaceLabel ? v.getWorkspaceLabel() : 'project') + ')');
    parts.push('Text files: ' + cache.paths.length + ' | Symbols indexed: ' + cache.symbols.length);
    if (cache.scripts.length) {
      parts.push('index.html loads ' + cache.scripts.length + ' scripts (order matters for new core/*.js files).');
    }
    if (typeof VeilCodingBuild !== 'undefined' && VeilCodingBuild.detectProjectType) {
      var bt = VeilCodingBuild.detectProjectType();
      if (bt) parts.push('Build system detected: ' + bt + ' (agent will run check after edits).');
    }
    var mirror = v.getActivePath ? findMirrorHint(v.getActivePath()) : '';
    if (mirror && pathExists(mirror)) {
      parts.push('MIRROR: also update `' + mirror + '` when editing shared core files.');
    }
    budget -= 500;

    var symHits = [];
    tokens.forEach(function (tok) {
      if (tok.length < 3) return;
      cache.symbols.forEach(function (sym) {
        if (sym.name.toLowerCase() === tok) symHits.push(sym.name + ' in ' + sym.path);
      });
    });
    if (symHits.length && budget > 400) {
      var symChunk = '## SYMBOL MATCHES\n' + symHits.slice(0, 12).join('\n') + '\n';
      parts.push(symChunk);
      budget -= symChunk.length;
    }

    var hits = await search(userText, MAX_READ);
    var v2 = ide();
    for (var i = 0; i < hits.length && budget > 1200; i++) {
      try {
        var content = await v2.readWorkspaceFile(hits[i].path);
        var label = hits[i].path;
        if (hits[i].viaSymbol) label += ' (symbol: ' + hits[i].viaSymbol + ')';
        if (hits[i].grepLine) label += ' (grep L' + hits[i].grepLine + ')';
        var chunk = '### ' + label + '\n```\n' + snippetAround(content, tokens, 2200) + '\n```\n';
        if (chunk.length > budget) break;
        parts.push(chunk);
        budget -= chunk.length;
      } catch (e) { /* skip */ }
    }

    var openCtx = v.getProjectContext ? v.getProjectContext(Math.min(budget, 14000)) : '';
    if (openCtx && openCtx.length <= budget) {
      parts.push('## OPEN TABS\n' + openCtx);
      budget -= openCtx.length;
    }

    if (cache.scripts.length && budget > 800) {
      parts.push('## SCRIPT LOAD ORDER (index.html)\n' + cache.scripts.slice(-45).join('\n'));
    }

    return parts.join('\n');
  }

  function needsMultiFile(userText) {
    var t = String(userText || '').toLowerCase();
    if (/\b(multiple files|several files|all files|both files|mirror|offline version|index\.html.*script|add.*script.*index|cargo|rust|tauri)\b/i.test(t)) return true;
    if (/\b(and also|plus update|also change|update .+\.js and)\b/i.test(t)) return true;
    if (findMirrorHint(ide() && ide().getActivePath ? ide().getActivePath() : '') && /\bcore\//i.test(t)) return true;
    return false;
  }

  function invalidate() {
    cache.at = 0;
    cache.symbolAt = 0;
  }

  window.VeilCodingWorkspace = {
    ensureIndex: ensureIndex,
    buildSymbolIndex: buildSymbolIndex,
    grep: grep,
    search: search,
    buildContext: buildContext,
    deepExplore: deepExplore,
    getRelatedFiles: getRelatedFiles,
    findMirrorHint: findMirrorHint,
    expandWithMirrors: expandWithMirrors,
    pathExists: pathExists,
    needsMultiFile: needsMultiFile,
    invalidate: invalidate,
    getScriptOrder: function () { return cache.scripts.slice(); },
    CONTEXT_DEFAULT: CONTEXT_DEFAULT
  };
})();
