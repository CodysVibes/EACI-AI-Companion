// ============================================================
// SHARED SUPABASE AUTH STORAGE — .eacicompanion.com subdomains
// Lets www / beta / private / analytics share the same login session.
// ============================================================
var VeilAuthStorage = (function() {
  var COOKIE_DOMAIN = null;
  var host = location.hostname || '';
  if (/\.eacicompanion\.com$/i.test(host) || host === 'eacicompanion.com') {
    COOKIE_DOMAIN = '.eacicompanion.com';
  }

  var CHUNK_SIZE = 3200;

  function _escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function _cookieGet(name) {
    var re = new RegExp('(?:^|; )' + _escapeRe(name) + '=([^;]*)');
    var match = document.cookie.match(re);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function _cookieSet(name, value, maxAge) {
    var parts = [name + '=' + encodeURIComponent(value), 'path=/', 'SameSite=Lax'];
    if (COOKIE_DOMAIN) parts.push('domain=' + COOKIE_DOMAIN);
    if (location.protocol === 'https:') parts.push('Secure');
    parts.push('max-age=' + (maxAge == null ? 60 * 60 * 24 * 400 : maxAge));
    document.cookie = parts.join('; ');
  }

  function _cookieRemove(name) {
    _cookieSet(name, '', 0);
    var i = 0;
    while (_cookieGet(name + '__' + i) !== null) {
      _cookieSet(name + '__' + i, '', 0);
      i++;
    }
  }

  function _readCookieValue(key) {
    var direct = _cookieGet(key);
    if (direct !== null) return direct;
    var parts = [];
    var i = 0;
    while (true) {
      var chunk = _cookieGet(key + '__' + i);
      if (chunk === null) break;
      parts.push(chunk);
      i++;
    }
    return parts.length ? parts.join('') : null;
  }

  function _writeCookieValue(key, value) {
    _cookieRemove(key);
    if (!value) return;
    if (value.length <= CHUNK_SIZE) {
      _cookieSet(key, value);
      return;
    }
    for (var i = 0, off = 0; off < value.length; i++, off += CHUNK_SIZE) {
      _cookieSet(key + '__' + i, value.slice(off, off + CHUNK_SIZE));
    }
  }

  return {
    getItem: function(key) {
      if (COOKIE_DOMAIN) {
        var fromCookie = _readCookieValue(key);
        if (fromCookie !== null) return fromCookie;
        try {
          var fromLocal = localStorage.getItem(key);
          if (fromLocal) {
            _writeCookieValue(key, fromLocal);
            return fromLocal;
          }
        } catch (e) {}
        return null;
      }
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem: function(key, value) {
      if (COOKIE_DOMAIN) _writeCookieValue(key, value);
      try { localStorage.setItem(key, value); } catch (e) {}
    },
    removeItem: function(key) {
      if (COOKIE_DOMAIN) _cookieRemove(key);
      try { localStorage.removeItem(key); } catch (e) {}
    },
    migrateLocalToCookies: function(key) {
      if (!COOKIE_DOMAIN || !key) return;
      try {
        var fromLocal = localStorage.getItem(key);
        if (fromLocal && !_readCookieValue(key)) _writeCookieValue(key, fromLocal);
      } catch (e) {}
    }
  };
})();

(function veilAuthBootstrapMigrate() {
  var key = 'sb-lntyddrwrztpuotyavlp-auth-token';
  if (typeof VeilAuthStorage !== 'undefined' && VeilAuthStorage.migrateLocalToCookies) {
    VeilAuthStorage.migrateLocalToCookies(key);
  }
})();
