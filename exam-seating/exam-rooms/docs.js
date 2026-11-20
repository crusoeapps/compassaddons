/* ===================== EXAM ROOMS: DOCUMENTS =====================
   Builds each output as a complete, self-contained HTML document (A4), used
   both for printing (hidden iframe -> Save as PDF) and for "Download all".
   Also builds the plan file the Exam Seating Manager opens.
   Needs part0_print_shared.js (PRINT_CSS, fitStyle, gridCellPt) and core.js.
   Privacy: reasons for provisions are never stored here, so they can never
   be printed. Fonts are the computer's own (Arial): no web fonts, so making
   a document sends nothing anywhere.
   ================================================================ */

var ER_FONT = 'Arial, Helvetica, sans-serif';

function erEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function erDocCSS() {
  return PRINT_CSS.split('"DM Sans", Arial, sans-serif').join(ER_FONT)
    .split('"DM Serif Display", Georgia, serif').join(ER_FONT) +
    'table.list td.last { font-weight: 700; text-transform: uppercase; }' +
    '.foot { margin-top: 4mm; font-size: 8pt; line-height: 1.5; }' +
    '.page { page-break-after: always; break-after: page; }' +
    '.page:last-child { page-break-after: auto; break-after: auto; }' +
    '.teacher { float: right; font-size: 24pt; font-weight: 700; color: #1a2540; line-height: 1; }' +
    'table.roll td { text-align: left; font-size: 9pt; padding: 5px 6px; }' +
    'table.roll th { text-align: left; font-size: 8pt; padding: 4px 6px; }' +
    'table.roll td.box { text-align: center; }' +
    'table.roll tr.exempt td { background: #ececec; color: #888; }' +
    'table.roll td.exemptbox { text-align: center; font-style: italic; color: #777; letter-spacing: 1px; }' +
    '.sig { margin-top: 10mm; font-size: 9pt; }' +
    '.sig div { margin-top: 8mm; border-top: 1px solid #555; width: 110mm; padding-top: 2px; }';
}

function erDoc(title, body, portrait) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + erEsc(title) + '</title><style>' +
    erDocCSS() + '@page { size: A4 ' + (portrait ? 'portrait' : 'landscape') + '; margin: 6mm; }</style></head><body>' +
    body + '</body></html>';
}

function erHeader(st, title) {
  return '<h1>' + erEsc(st.details.school || 'Crusoe College') + ' — ' + erEsc(title) + '</h1>' +
    '<div class="sub">' + erEsc(st.details.exam || 'Exam') + (st.details.year ? ' &middot; ' + erEsc(st.details.year) : '') + '</div>';
}

/* "Monday 16 November AM" -> "Mon 16 Nov AM" (for roll column headings). */
function erShortSession(label) {
  return String(label || '').replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b/gi, function (m, a) { return a; })
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi, function (m, a) { return a; })
    .replace(/\s+/g, ' ').trim();
}

/* 1. Seat grid: rows across the page, seats down, A4 landscape. */
function erDocSeatGrid(st, model) {
  var r = st.room, rows = Number(r.rows), per = Number(r.seatsPerRow);
  var grid = {};
  Object.keys(model.seats).forEach(function (id) { var p = model.seats[id]; grid[p.row + '_' + p.seat] = model.students[id]; });
  var avail = gridCellPt({ rows: rows }, false);
  var t = '<table><thead><tr><th class="rowhead"></th>';
  for (var row = 1; row <= rows; row++) t += '<th>Row ' + row + '</th>';
  t += '</tr></thead><tbody>';
  for (var seat = 1; seat <= per; seat++) {
    t += '<tr><th class="rowhead">Seat ' + seat + '</th>';
    for (var row2 = 1; row2 <= rows; row2++) {
      var s = grid[row2 + '_' + seat];
      t += '<td>' + (s ? '<span class="f"' + fitStyle(s.first, 6, avail, false, false, ER_FONT) + '>' + erEsc(s.first) + '</span>' +
        '<span class="l"' + fitStyle(s.last, 6.8, avail, true, true, ER_FONT) + '>' + erEsc(s.last) + '</span>' : '') + '</td>';
    }
    t += '</tr>';
  }
  t += '</tbody></table>';
  var foot = '<div class="foot">' + model.ranges.map(erEsc).join('<br>') + '</div>';
  return erDoc(r.name + ' seat grid', erHeader(st, (r.name || 'Exam room') + ' Supervisor Sheet') + t + foot, false);
}

function erNameCells(s) { return '<td>' + erEsc(s.first) + '</td><td class="last">' + erEsc(s.last) + '</td>'; }

/* 2. Master list: everyone sitting the exam, A-Z. No Status, Class or provisions. */
function erDocMaster(st, model) {
  var list = model.sitting.slice().sort(erCompareNames);
  var t = '<table class="list"><thead><tr><th>First name</th><th>Last name</th><th>Room</th><th style="width:14mm">Row</th><th style="width:14mm">Seat</th></tr></thead><tbody>';
  list.forEach(function (s) {
    var p = model.seats[s.id];
    t += '<tr>' + erNameCells(s) + '<td>' + erEsc(p ? st.room.name : 'SEA Room') + '</td><td><b>' + (p ? p.row : '') + '</b></td><td><b>' + (p ? p.seat : '') + '</b></td></tr>';
  });
  t += '</tbody></table>';
  return erDoc('Master list', erHeader(st, 'Master List') + t, true);
}

/* 3. SEA Room list: provisions only, never reasons. Students who stay in the
   main room are listed with their seat. */
function erDocSEA(st, model) {
  var list = model.sea.slice().sort(erCompareNames);
  var t = '<table class="list"><thead><tr><th>First name</th><th>Last name</th><th style="width:22mm">Class</th><th>Room</th><th>Arrangements</th></tr></thead><tbody>';
  list.forEach(function (s) {
    var p = model.seats[s.id];
    t += '<tr>' + erNameCells(s) + '<td>' + erEsc(s.classes.join(', ')) + '</td><td>' +
      erEsc(p ? st.room.name + ' – Row ' + p.row + ' Seat ' + p.seat : 'SEA Room') + '</td><td>' + erEsc(model.provision[s.id] || '') + '</td></tr>';
  });
  if (!list.length) t += '<tr><td colspan="5">No SEA students.</td></tr>';
  t += '</tbody></table>';
  return erDoc('SEA Room list', erHeader(st, 'SEA Room') + t, true);
}

/* 4. Exam rolls: one page per class, exempt students greyed. */
function erRollPage(st, model, code) {
  var cls = model.classes[code] || {};
  var sessions = (st.details.sessions || []).filter(function (x) { return x.label; });
  if (!sessions.length) sessions = [{ label: 'Exam' }];
  var list = (cls.studentIds || []).map(function (id) { return model.students[id]; }).filter(Boolean).sort(erCompareNames);
  var t = '<div class="page"><div class="teacher">' + erEsc(cls.teacher || '') + '</div>' + erHeader(st, 'Exam Roll ' + code) +
    '<table class="list roll"><thead><tr><th style="width:9mm">#</th><th>First name</th><th>Last name</th>' +
    sessions.map(function (x) { return '<th style="width:26mm;text-align:center">' + erEsc(erShortSession(x.label)) + '</th>'; }).join('') +
    '</tr></thead><tbody>';
  list.forEach(function (s, i) {
    var ex = model.exempt[s.id];
    t += '<tr' + (ex ? ' class="exempt"' : '') + '><td>' + (i + 1) + '</td>' + erNameCells(s) +
      (ex ? '<td class="exemptbox" colspan="' + sessions.length + '">' + erEsc('<Exempt>') + '</td>'
          : sessions.map(function () { return '<td class="box">&#9744;</td>'; }).join('')) + '</tr>';
  });
  if (!list.length) t += '<tr><td colspan="' + (3 + sessions.length) + '">No students found in this class.</td></tr>';
  t += '</tbody></table><div class="sig">' + sessions.map(function (x) {
    return '<div>Supervisor signature — ' + erEsc(erShortSession(x.label)) + '</div>';
  }).join('') + '</div></div>';
  return t;
}
function erDocRolls(st, model, codes) {
  return erDoc('Exam rolls', (codes || model.classOrder).map(function (c) { return erRollPage(st, model, c); }).join(''), true);
}

/* 5. Plan file for the Exam Seating Manager (app/format checked by its
   "Open file"). Main room is a seat grid with the spare seats left open;
   SEA students go in a "Special provisions" list room; exempt students in
   a "Withdrawn / exemptions" list room. Provision -> arrangements, group
   -> notes. No reasons. The tool's own inputs ride along in examRooms so
   the file can be reopened in Exam Rooms. */
function erPlanFile(st, model, toolState) {
  var sid = 'er' + Date.now().toString(36);
  var main = { id: sid + '-main', name: st.room.name || 'Exam room', kind: 'seated', purpose: 'main',
               rows: Number(st.room.rows), seatsPerRow: Number(st.room.seatsPerRow),
               layout: { rowLabels: 'number', rowFrom: 'start', seatLabels: 'number', seatFrom: 'start', blocked: {}, supervisor: '',
                         footer: model.ranges.join('\n') } };
  var seaRoom = { id: sid + '-sea', name: 'SEA Room', kind: 'list', purpose: 'special', rows: 12, seatsPerRow: 18, layout: { blocked: {} } };
  var exRoom = { id: sid + '-ex', name: 'Exemptions', kind: 'list', purpose: 'withdrawn', rows: 12, seatsPerRow: 18, layout: { blocked: {} } };
  var students = Object.keys(model.students).map(function (id) {
    var s = model.students[id], p = model.seats[id], status = 'Completing', roomId = null;
    if (model.exempt[id]) { status = 'Exemption'; roomId = exRoom.id; }
    else if (model.provision[id] !== undefined) { status = 'Special Provision'; roomId = p ? main.id : seaRoom.id; }
    else if (p) roomId = main.id;
    return { id: id, first: s.first, last: s.last, klass: s.classes.join(', '), status: status, roomId: roomId,
             row: p && roomId === main.id ? p.row : null, seat: p && roomId === main.id ? p.seat : null,
             arrangements: model.provision[id] || '', notes: model.groupOf[id] || '' };
  }).sort(erCompareNames);
  var dates = (st.details.sessions || []).map(function (x) { return x.label; }).filter(Boolean);
  return {
    app: 'Exam Seating Manager', format: 1, savedAt: new Date().toISOString(),
    config: { school: { name: st.details.school || 'Crusoe College' } },
    templates: [],
    sessions: [{ id: sid, name: st.details.exam || 'Exam', group: st.details.year || '', date: dates.join('; '),
                 rooms: [main, seaRoom, exRoom], students: students,
                 settings: { keepApart: [], startTime: (st.details.sessions[0] || {}).start || '', finishTime: (st.details.sessions[0] || {}).finish || '' } }],
    activeSessionId: sid,
    examRooms: toolState
  };
}

/* File names: only what the coordinator typed (the exam name), never a subject
   we worked out ourselves. */
function erFileName(st, what, ext) {
  var base = (st.details.exam || 'Exam') + ' - ' + what;
  return base.replace(/[^a-z0-9 ._()-]+/gi, '').replace(/\s+/g, ' ').trim() + '.' + ext;
}
