// ============================================================
// BIRTHDAY HELPERS (age verification — all Veil sites)
// Accepts many spoken/typed DOB formats (US-style default).
// ============================================================

var _MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

function _monthFromToken(token) {
  if (token == null || token === '') return null;
  var n = parseInt(token, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  var key = String(token).toLowerCase().replace(/\./g, '');
  return _MONTH_NAMES[key] || null;
}

function _isoBirthday(y, m, d) {
  var year = parseInt(y, 10);
  var month = parseInt(m, 10);
  var day = parseInt(d, 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  var iso = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  var dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  if (dt > new Date()) return null;
  return iso;
}

function _tryDateTriplet(a, b, c) {
  var sa = String(a), sb = String(b), sc = String(c);
  var na = parseInt(sa, 10), nb = parseInt(sb, 10), nc = parseInt(sc, 10);
  if (isNaN(na) || isNaN(nb) || isNaN(nc)) return null;

  if (sa.length === 4) return _isoBirthday(na, nb, nc);
  if (sc.length === 4) {
    var r = _isoBirthday(nc, na, nb);
    if (r) return r;
    return _isoBirthday(nc, nb, na);
  }
  return null;
}

function _parseCompactDigits(digits) {
  if (!/^\d+$/.test(digits)) return null;

  if (digits.length === 8) {
    return _isoBirthday(digits.slice(4), digits.slice(0, 2), digits.slice(2, 4));
  }

  if (digits.length === 7) {
    var y7 = digits.slice(3);
    var mid2 = parseInt(digits.slice(1, 3), 10);
    if (mid2 > 12) {
      var rMid = _isoBirthday(y7, digits.slice(0, 1), digits.slice(1, 3));
      if (rMid) return rMid;
    }
    var tries = [
      [digits.slice(0, 1), digits.slice(1, 3), y7],
      [digits.slice(0, 2), digits.slice(2, 3), y7],
      [digits.slice(0, 1), digits.slice(1, 2), y7]
    ];
    for (var i = 0; i < tries.length; i++) {
      var r = _isoBirthday(tries[i][2], tries[i][0], tries[i][1]);
      if (r) return r;
    }
  }

  if (digits.length === 6) {
    var y6 = parseInt(digits.slice(2), 10);
    var year6 = y6 < 30 ? 2000 + y6 : 1900 + y6;
    return _isoBirthday(year6, digits.slice(0, 1), digits.slice(1, 2)) ||
      _isoBirthday(year6, digits.slice(0, 2), digits.slice(2, 3));
  }

  return null;
}

function _parseTokenizedDate(tokens) {
  if (!tokens || tokens.length < 3) return null;
  tokens = tokens.slice();

  var yearIdx = -1;
  for (var i = 0; i < tokens.length; i++) {
    if (/^\d{4}$/.test(tokens[i])) { yearIdx = i; break; }
  }
  if (yearIdx === -1) return null;

  var year = tokens[yearIdx];
  var rest = tokens.filter(function(_, idx) { return idx !== yearIdx; });
  if (rest.length < 2) return null;

  var m1 = _monthFromToken(rest[0]);
  var m2 = _monthFromToken(rest[1]);
  var d1 = parseInt(rest[0], 10);
  var d2 = parseInt(rest[1], 10);

  if (m1 && !isNaN(d2)) return _isoBirthday(year, m1, d2);
  if (m2 && !isNaN(d1)) return _isoBirthday(year, m2, d1);
  if (m1 && m2) return _isoBirthday(year, m1, m2);
  return _tryDateTriplet(rest[0], rest[1], year);
}

function parseBirthdayInput(text) {
  if (!text) return null;
  var raw = String(text).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return _isoBirthday(raw.slice(0, 4), raw.slice(5, 7), raw.slice(8, 10));
  }

  var digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length >= 6 && digitsOnly.length <= 8 && /^\d+$/.test(digitsOnly) &&
      raw.replace(/[\s\/\-\.]/g, '').length === digitsOnly.length) {
    var compact = _parseCompactDigits(digitsOnly);
    if (compact) return compact;
  }

  var t = raw.toLowerCase()
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/g, function(m) {
      return String(_MONTH_NAMES[m] || m);
    })
    .replace(/\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g, function(m) {
      return String(_MONTH_NAMES[m.replace(/\./g, '')] || m);
    })
    .replace(/\bfirst\b/g, '1').replace(/\bsecond\b/g, '2').replace(/\bthird\b/g, '3')
    .replace(/\bfourth\b/g, '4').replace(/\bfifth\b/g, '5').replace(/\bsixth\b/g, '6')
    .replace(/\bseventh\b/g, '7').replace(/\beighth\b/g, '8').replace(/\bninth\b/g, '9')
    .replace(/\btenth\b/g, '10').replace(/\beleventh\b/g, '11').replace(/\btwelfth\b/g, '12')
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)\b/g, '$1')
    .replace(/\bof\b/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ').trim();

  var m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return _isoBirthday(m[3], m[1], m[2]);

  m = t.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (m) return _isoBirthday(m[1], m[2], m[3]);

  m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m) {
    var yy = parseInt(m[3], 10);
    var fullYear = yy < 30 ? 2000 + yy : 1900 + yy;
    return _isoBirthday(fullYear, m[1], m[2]);
  }

  var tokens = t.split(/\s+/).filter(Boolean);
  var fromTokens = _parseTokenizedDate(tokens);
  if (fromTokens) return fromTokens;

  m = t.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/);
  if (m) return _tryDateTriplet(m[1], m[2], m[3]);

  m = t.match(/^(\d{4})\s+(\d{1,2})\s+(\d{1,2})$/);
  if (m) return _isoBirthday(m[1], m[2], m[3]);

  return null;
}

function isAdultByBirthday(isoDate) {
  if (!isoDate) return false;
  var parts = isoDate.split('-');
  var birth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var now = new Date();
  var age = now.getFullYear() - birth.getFullYear();
  var mdiff = now.getMonth() - birth.getMonth();
  if (mdiff < 0 || (mdiff === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 18;
}

function _normalizeBirthdayIso(value) {
  if (!value) return null;
  var s = String(value).substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return typeof parseBirthdayInput === 'function' ? parseBirthdayInput(String(value)) : null;
}

async function _birthdayFromSessionMeta() {
  try {
    var result = await supabase.auth.getSession();
    var session = result.data && result.data.session;
    var meta = session && session.user ? (session.user.user_metadata || {}) : {};
    return _normalizeBirthdayIso(meta.birthday);
  } catch (e) {
    return null;
  }
}

async function saveUserBirthday(isoDate) {
  var iso = _normalizeBirthdayIso(isoDate);
  if (!iso || !state || !state.user || !state.user.id) return { ok: false, error: 'invalid' };
  try {
    var row = { id: state.user.id, birthday: iso };
    if (state.user.email) row.email = state.user.email;
    if (state.user.firstName) row.first_name = state.user.firstName;
    if (state.user.lastName) row.last_name = state.user.lastName;
    if (state.user.username) row.username = state.user.username;
    var { error } = await supabase.from('profiles').upsert(row);
    if (error) return { ok: false, error: error.message };
    try {
      await supabase.auth.updateUser({ data: { birthday: iso } });
    } catch (e) { /* non-fatal */ }
    state.user.birthday = iso;
    return { ok: true, birthday: iso };
  } catch (e) {
    return { ok: false, error: e.message || 'save failed' };
  }
}

async function fetchUserBirthday(userId) {
  var uid = userId || (state && state.user ? state.user.id : null);
  if (!uid) return null;

  if (state && state.user && state.user.birthday) {
    return _normalizeBirthdayIso(state.user.birthday);
  }

  try {
    var { data, error } = await supabase.from('profiles').select('birthday').eq('id', uid).maybeSingle();
    if (!error && data && data.birthday) {
      var fromProfile = _normalizeBirthdayIso(data.birthday);
      if (fromProfile && state && state.user) state.user.birthday = fromProfile;
      return fromProfile;
    }
  } catch (e) { /* fall through */ }

  var fromMeta = await _birthdayFromSessionMeta();
  if (fromMeta) {
    if (state && state.user) state.user.birthday = fromMeta;
    saveUserBirthday(fromMeta).catch(function() {});
    return fromMeta;
  }

  return null;
}
