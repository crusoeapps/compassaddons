/* ===================== EXAM ROOMS: CORE LOGIC =====================
   Pure functions (no Compass, no page): names, matching, seating, ranges.
   Built into exam-rooms.js by build_exam_rooms.js; also loaded on its own
   by exam-rooms.test.py.
   ================================================================ */

/* ---------- names ---------- */

/* Key used for comparing names: case, spaces, hyphens, apostrophes and
   full stops are ignored. */
function erKey(s) {
  return String(s || '').toLowerCase().replace(/[\s\-‐-―'‘’`.]+/g, '');
}

function erTitleCase(s) {
  return String(s || '').toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

/* Split a Compass name into its parts. Accepts both forms seen in Compass:
     "FAIRWEATHER, Annabel (Annie)"   (enrolment lists: LAST, First)
     "Annabel (Annie) FAIRWEATHER"    (grid exports: First LAST, surname in capitals)
   Returns { legal, bracket, last }. */
function erParseCompassName(n) {
  var s = String(n || '').replace(/\s+/g, ' ').trim();
  var legal = '', bracket = '', last = '';
  var comma = s.indexOf(',');
  if (comma >= 0) {
    last = s.slice(0, comma).trim();
    var rest = s.slice(comma + 1).trim();
    var m = rest.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (m) { legal = m[1].trim(); bracket = m[2].trim(); } else legal = rest;
  } else {
    var m2 = s.match(/^(.*?)\s*\(([^)]*)\)\s*(.*)$/);
    if (m2) { legal = m2[1].trim(); bracket = m2[2].trim(); last = m2[3].trim(); }
    else {
      // Surname = the trailing words in capitals (handles "VAN DER BERG").
      var words = s.split(' '), i = words.length;
      while (i > 1 && /[A-Z]/.test(words[i - 1]) && words[i - 1] === words[i - 1].toUpperCase()) i--;
      if (i === words.length) i = words.length - 1;
      legal = words.slice(0, i).join(' ');
      last = words.slice(i).join(' ');
    }
  }
  return { legal: legal, bracket: bracket, last: last };
}

/* The first name to print. A bracket is a preferred name ("Annabel (Annie)"
   -> Annie, "Nyein Thu Zar (Thu)" -> Thu) unless it starts with the legal
   first name and adds more words, which means a different surname
   ("Jesse (Jesse Holloway)"): then keep the legal first name. */
function erPreferredFirst(p) {
  var b = String(p.bracket || '').trim();
  if (!b) return p.legal;
  var bw = b.split(' '), lw = String(p.legal || '').split(' ');
  if (bw.length > 1 && erKey(bw[0]) === erKey(lw[0])) return p.legal;
  return b;
}

/* Normalise one Compass student into the tool's record. */
function erMakeStudent(uid, compassName, klass) {
  var p = erParseCompassName(compassName);
  return {
    id: 'c' + uid, uid: uid,
    legalFirst: p.legal, bracket: p.bracket,
    first: erPreferredFirst(p),
    compassLast: String(p.last || '').toUpperCase(),
    last: String(p.last || '').toUpperCase(),
    classes: klass ? [klass] : []
  };
}

/* Apply surname overrides ({ studentId: 'HOLLOWAY' }). */
function erApplyOverrides(students, overrides) {
  students.forEach(function (st) {
    var o = overrides && overrides[st.id];
    st.last = o ? String(o).toUpperCase().trim() : st.compassLast;
  });
}

/* Sort: last name, then first name, plain case-insensitive comparison. */
function erCompareNames(a, b) {
  var x = String(a.last).toLowerCase(), y = String(b.last).toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  x = String(a.first).toLowerCase(); y = String(b.first).toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return 0;
}

/* ---------- matching pasted names ---------- */

/* Common nicknames: nickname -> formal names. Only ever a suggestion the
   coordinator must confirm. */
var ER_NICKNAMES = {
  abby: ['abigail'], alex: ['alexander', 'alexandra', 'alexis'], andy: ['andrew'], ben: ['benjamin'],
  beth: ['elizabeth', 'bethany'], bill: ['william'], charlie: ['charles', 'charlotte'], chris: ['christopher', 'christian', 'christine'],
  dan: ['daniel'], danny: ['daniel'], dave: ['david'], ed: ['edward'], ellie: ['eleanor', 'elena', 'ella'],
  freddie: ['frederick', 'alfred'], gus: ['angus', 'augustus'], harry: ['harrison', 'henry', 'harold'],
  izzy: ['isabella', 'isabel', 'isobel'], jack: ['jackson', 'john'], jake: ['jacob'], jim: ['james'], jimmy: ['james'],
  joe: ['joseph'], josh: ['joshua'], kate: ['katherine', 'catherine', 'kathryn'], katie: ['katherine', 'catherine', 'kathryn'],
  kit: ['christopher', 'katherine'], liz: ['elizabeth'], lottie: ['charlotte'], maddie: ['madison', 'madeleine', 'madeline'],
  matt: ['matthew'], max: ['maxwell', 'maximilian', 'maxim'], mike: ['michael'], nate: ['nathan', 'nathaniel'],
  nick: ['nicholas'], ollie: ['oliver', 'olivia'], rosie: ['rose', 'rosalind', 'rosemary'], sam: ['samuel', 'samantha'],
  ted: ['edward', 'theodore'], teddy: ['edward', 'theodore'], theo: ['theodore'], tilly: ['matilda'], tom: ['thomas'],
  tommy: ['thomas'], will: ['william'], zac: ['zachary'], zach: ['zachary']
};

function erNickMatch(a, b) {
  a = erKey(a); b = erKey(b);
  return (ER_NICKNAMES[a] || []).indexOf(b) >= 0 || (ER_NICKNAMES[b] || []).indexOf(a) >= 0;
}

/* True if one name is the other's first words ("Ler Paw" / "Ler Paw Myint"). */
function erLeadingWords(a, b) {
  var x = String(a || '').toLowerCase().split(/\s+/).filter(Boolean);
  var y = String(b || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!x.length || !y.length || x.length === y.length) return false;
  var s = x.length < y.length ? x : y, l = x.length < y.length ? y : x;
  for (var i = 0; i < s.length; i++) if (erKey(s[i]) !== erKey(l[i])) return false;
  return true;
}

/* Exactly one letter different (added, removed or changed). */
function erOneLetterApart(a, b) {
  a = erKey(a); b = erKey(b);
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  var i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) === 1;
}

/* Match one pasted first + last name against the students.
   Returns { status: 'exact' | 'confirm' | 'none', student, candidates: [{ student, why }] }.
   'exact' happens only for exactly one student matching first and last name
   (legal first name, the preferred name, or the printed first name). Anything
   looser is a suggestion that needs the coordinator to confirm, and a surname
   that is merely close is never automatic. */
function erMatchName(first, last, students) {
  var f = erKey(first), l = erKey(last);
  if (!f && !l) return { status: 'none', candidates: [] };
  function surnameIs(st) { return erKey(st.last) === l || erKey(st.compassLast) === l; }
  function firstIs(st) { return f && (erKey(st.legalFirst) === f || erKey(st.bracket) === f || erKey(st.first) === f); }
  var exact = students.filter(function (st) { return surnameIs(st) && firstIs(st); });
  if (exact.length === 1) return { status: 'exact', student: exact[0], candidates: [{ student: exact[0], why: 'Exact match' }] };
  if (exact.length > 1) {
    return { status: 'confirm', candidates: exact.map(function (st) { return { student: st, why: 'More than one student has this name' }; }) };
  }
  var cands = [];
  students.forEach(function (st) {
    var why = '';
    if (surnameIs(st)) {
      if (erNickMatch(first, st.legalFirst) || erNickMatch(first, st.first)) why = 'Nickname for ' + st.legalFirst;
      else if (erLeadingWords(first, st.legalFirst)) why = 'First name is part of ' + st.legalFirst;
    } else if (erOneLetterApart(last, st.compassLast) || erOneLetterApart(last, st.last)) {
      if (firstIs(st) || erLeadingWords(first, st.legalFirst)) why = 'Surname one letter different';
    }
    if (why) cands.push({ student: st, why: why });
  });
  if (cands.length) return { status: 'confirm', candidates: cands };
  return { status: 'none', candidates: [] };
}

/* ---------- parsing what the coordinator types or pastes ---------- */

/* "10MAG1–10MAG6, 10MAGX" -> ['10MAG1', ..., '10MAG6', '10MAGX'] */
function erExpandCodes(text) {
  var out = [];
  String(text || '').split(/[,;\n]+/).forEach(function (part) {
    part = part.trim().toUpperCase();
    if (!part) return;
    var r = part.match(/^([A-Z0-9]*?[A-Z])(\d+)\s*[\-‐-―]\s*(?:([A-Z0-9]*?[A-Z]))?(\d+)$/);
    if (r && (!r[3] || r[3] === r[1]) && Number(r[4]) >= Number(r[2]) && Number(r[4]) - Number(r[2]) < 40) {
      for (var n = Number(r[2]); n <= Number(r[4]); n++) out.push(r[1] + n);
    } else out.push(part.replace(/\s+/g, ''));
  });
  return out.filter(function (c, i) { return out.indexOf(c) === i; });
}

/* Split pasted rows (from Excel, Sheets or a CSV) into cells. */
function erParseRows(text) {
  var lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (x) { return x.trim(); });
  return lines.map(function (line) {
    if (line.indexOf('\t') >= 0) return line.split('\t').map(function (c) { return c.trim(); });
    var cells = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

/* Drop a header row if the first row looks like one. */
function erDropHeader(rows) {
  if (rows.length && /first|last|name|surname/i.test(rows[0].join(' ')) && !/\d/.test(rows[0].join(''))) return rows.slice(1);
  return rows;
}

/* Exemptions: "First, Last" or "First<TAB>Last" per row. A whole name in a
   single cell is split at the last space for now and kept as `whole`, so the
   panel can try every split against the class lists (erSplitWhole). */
function erParseExemptions(text) {
  return erDropHeader(erParseRows(text)).map(function (r) {
    if (r.length >= 2) return { first: r[0], last: r[1] };
    var s = r[0].trim(), k = s.lastIndexOf(' ');
    return k > 0 ? { first: s.slice(0, k), last: s.slice(k + 1), whole: s } : { first: '', last: s };
  }).filter(function (x) { return x.first || x.last; });
}

/* A whole name typed in one cell ("Ivy Van Der Berg"): try every first/last
   split and use the one that is an exact match, so multi-word surnames work.
   With no exact match it falls back to splitting at the last space, and the
   usual confirm / not-found rules apply. */
function erSplitWhole(whole, students) {
  var w = String(whole || '').trim().split(/\s+/);
  for (var i = w.length - 1; i >= 1; i--) {
    var f = w.slice(0, i).join(' '), l = w.slice(i).join(' ');
    if (erMatchName(f, l, students).status === 'exact') return { first: f, last: l };
  }
  return { first: w.slice(0, -1).join(' '), last: w[w.length - 1] || '' };
}

/* SEA table: First name, Last name, Form, Reason, Provision. The reason is
   deliberately NOT kept: it is sensitive and never printed or saved. */
function erParseSEA(text) {
  return erDropHeader(erParseRows(text)).map(function (r) {
    return { first: r[0] || '', last: r[1] || '', form: r[2] || '', provision: (r.length >= 5 ? r[4] : (r[3] || '')) || '' };
  }).filter(function (x) { return x.first || x.last; });
}

/* ---------- seating ---------- */

function erSeatKey(row, seat) { return row + '_' + seat; }

/* Seat everyone in the main room.
   room:   { rows, seatsPerRow, use }  - seats 1..use in each row are filled
   groups: [{ name, gap: 'seat' | 'row' | 'rowplus', students: [...] }] in fill order
   pins:   { studentId: { row, seat } | { back: true } }
   Returns { seats: { studentId: { row, seat } }, unplaced: [students], groupOrder: { studentId: groupName },
             conflicts: [text] }.
   Never drops anyone silently: whoever does not fit is listed in unplaced. */
function erSeat(room, groups, pins) {
  pins = pins || {};
  var rows = Number(room.rows) || 0, perRow = Number(room.seatsPerRow) || 0;
  var use = Math.min(Number(room.use) || perRow, perRow);
  var taken = {}, seats = {}, unplaced = [], conflicts = [], groupOf = {};
  var allIds = {};
  groups.forEach(function (g) { g.students.forEach(function (st) { allIds[st.id] = st; groupOf[st.id] = g.name; }); });

  // Fixed seats are reserved first.
  Object.keys(pins).forEach(function (id) {
    var p = pins[id];
    if (!allIds[id] || !p || p.back) return;
    var r = Number(p.row), s = Number(p.seat);
    if (!(r >= 1 && r <= rows && s >= 1 && s <= perRow)) {
      conflicts.push(allIds[id].first + ' ' + allIds[id].last + ' is fixed to Row ' + p.row + ' Seat ' + p.seat + ', which is not in this room.');
      return;
    }
    var k = erSeatKey(r, s);
    if (taken[k]) { conflicts.push(allIds[id].first + ' ' + allIds[id].last + ' and ' + allIds[taken[k]].first + ' ' + allIds[taken[k]].last + ' are both fixed to Row ' + r + ' Seat ' + s + '.'); return; }
    taken[k] = id; seats[id] = { row: r, seat: s };
  });

  var row = 1, seat = 1;
  function nextFree() {
    while (row <= rows) {
      if (seat > use) { row++; seat = 1; continue; }
      if (!taken[erSeatKey(row, seat)]) return true;
      seat++;
    }
    return false;
  }

  groups.forEach(function (g, gi) {
    var list = g.students.slice().sort(erCompareNames);
    var placedAny = false;
    list.forEach(function (st) {
      if (seats[st.id]) return;                       // already fixed
      var p = pins[st.id];
      if (!nextFree()) { unplaced.push(st); return; }
      if (p && p.back) {
        // Back of the row they would otherwise land in.
        var k = erSeatKey(row, use);
        if (!taken[k]) { taken[k] = st.id; seats[st.id] = { row: row, seat: use }; placedAny = true; return; }
        conflicts.push(st.first + ' ' + st.last + ' could not have the back seat of Row ' + row + ' (already taken), so they sit in the next free seat.');
      }
      taken[erSeatKey(row, seat)] = st.id; seats[st.id] = { row: row, seat: seat }; placedAny = true;
      seat++;
    });
    if (gi === groups.length - 1 || !placedAny) return;
    // Gap after this group.
    if (g.gap === 'seat') { if (nextFree()) seat++; }
    else if (g.gap === 'row' || g.gap === 'rowplus') {
      if (seat > 1) { row++; seat = 1; }
      if (g.gap === 'rowplus') row++;
    }
  });
  return { seats: seats, unplaced: unplaced, groupOf: groupOf, conflicts: conflicts };
}

/* Footer lines: each group's seat range in fill order, from its actual seats.
   Fixed seats away from the rest of the group are added at the end. */
function erGroupRanges(room, groups, seats, pins) {
  var perRow = Number(room.seatsPerRow) || 1;
  function ord(p) { return (p.row - 1) * perRow + p.seat; }
  function label(p) { return 'Row ' + p.row + ' Seat ' + p.seat; }
  return groups.map(function (g) {
    var own = [], fixed = [];
    g.students.forEach(function (st) {
      var p = seats[st.id];
      if (!p) return;
      if (pins && pins[st.id] && !pins[st.id].back) fixed.push(p); else own.push(p);
    });
    if (!own.length && !fixed.length) return null;
    var main = own.length ? own : fixed.splice(0, fixed.length);
    main.sort(function (a, b) { return ord(a) - ord(b); });
    var lo = ord(main[0]), hi = ord(main[main.length - 1]);
    var extra = fixed.filter(function (p) { return ord(p) < lo || ord(p) > hi; }).sort(function (a, b) { return ord(a) - ord(b); });
    var count = own.length + fixed.length + (own.length ? 0 : main.length);
    var text = g.name + ' – ' + label(main[0]) + (main.length > 1 ? ' to ' + label(main[main.length - 1]) : '');
    if (extra.length) text += ', and ' + extra.map(label).join(', and ');
    return text + ' (' + count + ' student' + (count === 1 ? '' : 's') + ')';
  }).filter(Boolean);
}
