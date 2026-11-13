
/* ======================= VIEW: LOOKUP ========================= */
function viewLookup() {
  return '<div class="section-head"><div><h2>Student Lookup</h2><p>For supervisors on the day — type a name to find a student\'s room and seat instantly.</p></div></div>' +
    '<div class="lookup-box"><div class="lookup-input-wrap"><span class="lookup-icon">&#128269;</span>' +
    '<input type="text" class="search-input" id="searchInput" placeholder="Type student name" oninput="doSearch(this.value)" autocomplete="off"></div>' +
    '<div class="search-results" id="searchResults"><div class="empty-msg" style="border:none;background:none">Start typing to search</div></div></div>';
}

function doSearch(q) {
  var s = session();
  var el = document.getElementById('searchResults');
  if (!s || !q.trim()) { el.innerHTML = '<div class="empty-msg" style="border:none;background:none">Start typing to search</div>'; return; }
  var term = q.toLowerCase();
  var hits = s.students.filter(function (st) { return (st.first + ' ' + st.last).toLowerCase().indexOf(term) >= 0; }).sort(byName).slice(0, 12);
  if (!hits.length) { el.innerHTML = '<div class="empty-msg" style="border:none;background:none">No students found in this session.</div>'; return; }
  el.innerHTML = hits.map(function (st) {
    var cls = isSeatedStatus(st.status) ? '' : esc(pillClass(st.status));
    var loc = locText(s, st, 'Not yet seated');
    return '<div class="result-card ' + cls + '"><div><div class="result-first">' + esc(st.first) + (st.klass ? ' &middot; ' + esc(st.klass) : '') + '</div>' +
      '<div class="result-name">' + esc(st.last) + '</div><div class="result-details">' + loc + '</div></div>' +
      pillHTML(st.status) + '</div>';
  }).join('');
}

/* ======================== VIEW: PRINT ========================= */
function viewPrint() {
  var s = session();
  if (!s) return noSessionMsg();
  var mains = s.rooms.filter(function (r) { return r.kind === 'seated'; });
  var roomBtns = mains.map(function (r) {
    return '<button class="btn secondary" style="margin:3px" onclick="printRoomSheet(\'' + r.id + '\')">' + esc(r.name) + ' seat grid</button>';
  }).join('');
  return '<div class="section-head"><div><h2>Print — ' + esc(s.name) + '</h2><p>Everything prints on A4 with a session header. A print dialog opens; choose your printer, or "Save as PDF" to email it.</p></div></div>' +
    '<div class="print-grid">' +
    '<div class="print-card"><h3>Supervisor seat grids</h3><p>One grid per main room — the seat-by-seat sheet supervisors use to mark attendance.</p>' + (roomBtns || '<span class="muted">No seated rooms yet.</span>') + '</div>' +
    '<div class="print-card"><h3>Master list (A&ndash;Z)</h3><p>Every student with their room, row and seat, alphabetical by surname. Post at the entrance.</p><button class="btn secondary" onclick="printMasterList()">Print master list</button></div>' +
    cfg().purposes.filter(function (p) { return p.printTitle; }).map(function (p) {
      var names = statusList().filter(function (x) { return x.purpose === p.id; }).map(function (x) { return esc(x.label); }).join(', ');
      return '<div class="print-card"><h3>' + esc(p.printCard || p.printTitle) + '</h3><p>' + (p.printDesc ? esc(p.printDesc) : 'Students with status: ' + (names || 'none yet') + '.') + '</p>' +
        '<button class="btn secondary" onclick="printPurposeList(\'' + esc(p.id) + '\')">' + esc(p.printBtn || 'Print list') + '</button></div>';
    }).join('') +
    '</div>';
}

var PRINT_CSS =
  '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
  'body { font-family: "DM Sans", Arial, sans-serif; color: #1a2540; margin: 0; padding: 10mm 8mm; }' +
  'h1 { font-family: "DM Serif Display", Georgia, serif; font-size: 15pt; color: #0d5c2e; margin: 0; }' +
  '.sub { font-size: 8pt; color: #666; margin: 2px 0 10px; }' +
  'table { border-collapse: collapse; width: 100%; table-layout: fixed; }' +
  'th { background: #0d5c2e; color: white; font-size: 6.5pt; padding: 3px 2px; }' +
  'td { border: 1px solid #ccc; font-size: 6.5pt; padding: 3px 2px; text-align: center; vertical-align: top; overflow: hidden; }' +
  'td .f { display: block; color: #777; font-size: 6pt; white-space: nowrap; overflow: hidden; }' +
  'td .l { display: block; font-weight: 700; text-transform: uppercase; font-size: 6.8pt; white-space: nowrap; overflow: hidden; }' +
  'th.rowhead { width: 34px; }' +
  'table.list td { text-align: left; font-size: 8.5pt; padding: 4px 6px; }' +
  'table.list th { text-align: left; font-size: 8pt; padding: 4px 6px; }';

function printCSS() {
  var a = cfg().school.accent;
  return isHex(a) && a.toLowerCase() !== DEFAULT_ACCENT ? PRINT_CSS.split(DEFAULT_ACCENT).join(a) : PRINT_CSS;
}

function printHTML(title, bodyHtml, portrait) {
  var page = '@page { size: A4 ' + (portrait ? 'portrait' : 'landscape') + '; margin: 6mm; }';
  var doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">' +
    '<style>' + printCSS() + page + '</style></head><body>' + bodyHtml + '</body></html>';
  // Hidden iframe: works where window.open() is blocked (sandboxed previews, some SOE browsers).
  var frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(doc);
  frame.contentDocument.close();
  setTimeout(function () {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch (e) { toast('Print failed: ' + e.message, true); }
    setTimeout(function () { frame.remove(); }, 4000);
  }, 600);
}

/* Optional lines (logo, times, supervisor, instructions) appear only when set,
   so with default settings the sheets are exactly as before. */
function printHeader(title, room) {
  var s = session(), c = cfg(), P = c.print;
  var logo = validLogo(c.school.logo) ? '<img src="' + esc(c.school.logo) + '" alt="" style="height:12mm;float:right;margin-left:6mm">' : '';
  var extra = [];
  if (P.showTimes && (s.settings.startTime || s.settings.finishTime)) {
    extra.push('Start ' + esc(s.settings.startTime || '—') + ' &middot; Finish ' + esc(s.settings.finishTime || '—'));
  }
  if (P.showSupervisor && room && room.layout && room.layout.supervisor) extra.push('Supervisor: ' + esc(room.layout.supervisor));
  if (P.instructions) extra.push(esc(P.instructions));
  return logo + '<h1>' + esc(c.school.name) + ' — ' + esc(title) + '</h1><div class="sub">' + esc(s.name) +
    (s.group ? ' &middot; ' + esc(s.group) : '') + (s.date ? ' &middot; ' + esc(s.date) : '') +
    ' &middot; printed ' + new Date().toLocaleDateString() + '</div>' +
    extra.map(function (x) { return '<div class="sub" style="font-size:9pt;color:#1a2540">' + x + '</div>'; }).join('');
}

/* Shrink a name's font so it fits its grid box. Width is measured with the
   print font on a canvas; names that already fit keep the normal size (so
   default output is unchanged). Returns '' or an inline style. */
var _fitCanvas = null;
function fitStyle(text, basePt, availPt, bold, upper) {
  if (!text) return '';
  try {
    _fitCanvas = _fitCanvas || document.createElement('canvas');
    var g = _fitCanvas.getContext('2d');
    g.font = (bold ? '700 ' : '400 ') + '100px "DM Sans", Arial, sans-serif';
    var em = g.measureText(upper ? String(text).toUpperCase() : String(text)).width / 100;
    var fit = availPt / em * 0.92;                       // small safety margin
    if (fit >= basePt) return '';
    return ' style="font-size:' + Math.max(2.5, Math.floor(fit * 10) / 10) + 'pt"';
  } catch (e) { return ''; }
}
/* Usable width of one seat box on the printed grid, in points. */
function gridCellPt(r, portrait) {
  var pageMm = portrait ? 210 : 297;
  var cellMm = (pageMm - 12 - 16 - 9) / r.rows - 1.1;   // page margins, body padding, Seat column, cell padding
  return cellMm * 72 / 25.4;
}

function printRoomSheet(roomId) {
  var s = session();
  var r = s.rooms.find(function (x) { return x.id === roomId; });
  var grid = {};
  s.students.forEach(function (st) { if (st.roomId === roomId && st.row) grid[st.row + '_' + st.seat] = st; });
  var portrait = cfg().print.gridOrientation === 'portrait';
  var avail = gridCellPt(r, portrait);
  var t = '<table><thead><tr><th class="rowhead"></th>';
  for (var row = 1; row <= r.rows; row++) t += '<th>Row ' + esc(rowLabel(r, row)) + '</th>';
  t += '</tr></thead><tbody>';
  for (var seat = 1; seat <= r.seatsPerRow; seat++) {
    t += '<tr><th class="rowhead">Seat ' + esc(seatLabel(r, seat)) + '</th>';
    for (var row2 = 1; row2 <= r.rows; row2++) {
      var blk = seatBlocked(r, row2, seat);
      if (blk) { t += '<td style="background:#e4e4e4"></td>'; continue; }
      var st = grid[row2 + '_' + seat];
      t += '<td>' + (st ? '<span class="f"' + fitStyle(st.first, 6, avail, false, false) + '>' + esc(st.first) + '</span>' +
                          '<span class="l"' + fitStyle(st.last, 6.8, avail, true, true) + '>' + esc(st.last) + '</span>' : '') + '</td>';
    }
    t += '</tr>';
  }
  t += '</tbody></table>';
  printHTML(r.name + ' seat grid', printHeader(r.name + ' Supervisor Sheet', r) + t, portrait);
}

/* Print columns, chosen in Settings → Print. */
var PRINT_COLS = {
  student: ['Student', function (s, st) { return '<b>' + esc(st.last) + '</b>, ' + esc(st.first); }],
  first: ['First name', function (s, st) { return esc(st.first); }],
  last: ['Last name', function (s, st) { return '<b>' + esc(st.last) + '</b>'; }],
  klass: ['Class', function (s, st) { return esc(st.klass || ''); }],
  status: ['Status', function (s, st) { return esc(statusLabel(st.status)); }],
  location: ['Location', function (s, st) { return locText(s, st); }],
  room: ['Room', function (s, st) { return esc(st.roomId ? roomName(s, st.roomId) : '—'); }],
  row: ['Row', function (s, st) { var r = s.rooms.find(function (x) { return x.id === st.roomId; }); return st.row && r ? '<b>' + esc(rowLabel(r, st.row)) + '</b>' : ''; }],
  seat: ['Seat', function (s, st) { var r = s.rooms.find(function (x) { return x.id === st.roomId; }); return st.seat && r ? '<b>' + esc(seatLabel(r, st.seat)) + '</b>' : ''; }],
  arrangements: ['Arrangements', function (s, st) { return esc(st.arrangements || ''); }],
  notes: ['Notes', function (s, st) { return esc(st.notes || ''); }]
};
function validCols(cols) { return (cols || []).filter(function (c) { return PRINT_COLS[c]; }); }
function listTable(s, list, cols) {
  return '<table class="list"><thead><tr>' + cols.map(function (c) { return '<th>' + PRINT_COLS[c][0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    list.map(function (st) { return '<tr>' + cols.map(function (c) { return '<td>' + PRINT_COLS[c][1](s, st) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table>';
}

function printMasterList() {
  var s = session();
  var cols = validCols(cfg().print.masterCols);
  if (!cols.length) cols = ['student'];
  printHTML('Master list', printHeader('Master Student List') + listTable(s, s.students.slice().sort(byName), cols),
    cfg().print.listOrientation !== 'landscape');
}

/* One list per room type that has a print title (Settings → Room types). */
function printPurposeList(purposeId) {
  var s = session();
  var p = purposeById(purposeId);
  var title = p.printTitle || p.label;
  var list = s.students.filter(function (st) { return statusPurpose(st.status) === purposeId; }).sort(byName);
  var cols = validCols(cfg().print.listCols);
  if (!cols.length) cols = ['student'];
  if (cols.indexOf('arrangements') < 0 && list.some(function (st) { return st.arrangements; })) cols = cols.concat(['arrangements']);
  printHTML(title, printHeader(title) +
    (list.length ? listTable(s, list, cols) : '<p>No students in this category.</p>'), cfg().print.listOrientation !== 'landscape');
}

/* ======================== VIEW: HELP ========================== */
function viewHelp() {
  var statusNames = statusList().map(function (x) { return x.label; }).join(', ');
  var listStatusNames = statusList().filter(function (x) { return !isSeatedStatus(x.id); }).map(function (x) { return x.label; }).join(', ');
  var gridNames = cfg().purposes.filter(function (p) { return p.layout === 'seated'; }).map(function (p) { return p.label; }).join(' / ');
  var listNames = cfg().purposes.filter(function (p) { return p.layout !== 'seated'; }).map(function (p) { return p.label; }).join(', ');
  var guides = [
    ['Set up a new exam (coordinators)',
      '<ol><li>Click <b>Editor sign in</b> (top right) and enter the editor password.</li>' +
      '<li>Go to <b>Exam Sessions</b> then <b>+ New session</b>. Name it, set the year group and date. If a room template exists, choose it and your rooms are ready instantly.</li>' +
      '<li>If you started blank, go to <b>Rooms &amp; Layout</b> and add a seat-grid room (' + esc(gridNames) + ') with its rows and seats, plus a list room for each of: ' + esc(listNames || 'none') + '.</li>' +
      '<li>Go to <b>Students</b> then <b>Import Excel / CSV</b> and load your class list.</li>' +
      '<li>Go to <b>Seating Plan</b> and click <b>Generate seating</b>. Done.</li></ol>' +
      '<div class="tip">Once your rooms are right, save them as a template (Rooms &amp; Layout) so next term takes thirty seconds.</div>'],
    ['Import a student list from Excel',
      '<ol><li>Your spreadsheet needs columns for first name and surname. Class and status columns are optional, and headers can be named anything.</li>' +
      '<li>In <b>Students</b>, click <b>Import Excel / CSV</b> and choose the file (.xlsx, .xls or .csv).</li>' +
      '<li>The app guesses which column is which — check the dropdowns and fix any it got wrong.</li>' +
      '<li>Choose <b>Replace</b> for a fresh start or <b>Add</b> to top up the existing list, then click Import.</li></ol>' +
      '<div class="tip">If a status column contains a status name (' + esc(statusNames) + ') or one of its import words from Settings, the app assigns that status automatically. Optional Arrangements and Notes columns are imported too.</div>'],
    ['Generate and adjust the seating plan',
      '<ol><li>In <b>Seating Plan</b>, choose the order and click <b>Generate seating</b>. <b>Seating rules</b> sets spacing (every seat, every second seat, checkerboard) and fill direction.</li>' +
      '<li>To swap two students, click the first seat then the second. To move someone into an empty seat, click them then click the gap.</li>' +
      '<li>Students in the yellow panel have no seat yet — click one, then click any empty seat.</li>' +
      '<li>Students whose status goes to a list room (' + esc(listStatusNames || 'none') + ') are listed under that room automatically.</li></ol>' +
      '<div class="tip">Regenerating replaces all seats in seat-grid rooms, so do your manual tweaks last.</div>'],
    ['Keep two students apart',
      '<ol><li>In <b>Seating Plan</b>, click <b>Keep-apart pairs</b>.</li>' +
      '<li>Pick the two students and click <b>Add pair</b>. Add as many pairs as you need.</li>' +
      '<li>Click <b>Generate seating</b> — the app avoids placing them next to each other. <b>Seating rules</b> sets what counts as "next to".</li>' +
      '<li>If a manual move creates a conflict, both seats turn red with a warning mark so you can fix it.</li></ol>'],
    ['Change a student\'s status (' + esc(statusNames) + ')',
      '<ol><li>In <b>Students</b>, click <b>Edit</b> next to the student and change their <b>Status</b>.</li>' +
      '<li>Their seat is released and they move to the matching room list automatically.</li>' +
      '<li>Add any <b>special arrangements</b> (reader, extra time) in the same window — they print on the arrangements sheet.</li>' +
      '<li>Print the paperwork from the <b>Print</b> tab.</li></ol>' +
      '<div class="tip">Changed your mind? Set them back to "' + esc(statusLabel(defaultStatusId())) + '" and they appear in the unseated panel, ready to place.</div>'],
    ['Print sheets for exam day',
      '<ol><li>Go to <b>Print</b>. You do not need to be signed in as an editor.</li>' +
      '<li>Click the sheet you need — a print dialog opens.</li>' +
      '<li>Choose a printer, or choose <b>Save as PDF</b> to email it.</li></ol>' +
      '<div class="tip">Orientation, columns and extra header lines (supervisor, times, instructions) are set in Settings → Print.</div>'],
    ['For general staff (viewers)',
      '<p>No sign-in needed — just open the link. You can:</p>' +
      '<ol><li>Use <b>Lookup</b> to find any student\'s seat on exam day.</li>' +
      '<li>Browse the <b>Seating Plan</b> — it is always the latest version.</li>' +
      '<li><b>Print</b> any sheet.</li></ol>' +
      '<p>You cannot change anything by accident: editing is locked behind the coordinator password.</p>'],
    ['Something looks wrong?',
      '<ol><li><b>"Save failed" showing?</b> Check your internet, then make the change again. Tell the exam coordinator if it keeps happening.</li>' +
      '<li><b>"Someone else saved first"?</b> Another editor changed this session while you had it open. Click <b>Reload latest</b> and redo your change.</li>' +
      '<li><b>A name is misspelled?</b> An editor fixes it under Students then Edit. In an emergency an editor can also fix it in the Google Sheet (Students tab), then refresh the app.</li>' +
      '<li><b>Plan looks out of date?</b> Refresh the page — it always loads the latest shared copy.</li>' +
      '<li><b>Locked out?</b> The exam coordinators hold the editor password; the master copy lives in the Google Apps Script settings.</li></ol>'],
    ['Save a backup, or move your plan to another computer',
      '<ol><li>On <b>Exam Sessions</b>, click <b>Save to file</b>. Every session (students, rooms, seats, keep-apart pairs) and your settings download as one file.</li>' +
      '<li>To load it, sign in as an editor and click <b>Open file</b>. On a single computer you can <b>replace</b> everything or <b>add</b> the file\'s sessions; with shared data, sessions are always <b>added</b> as new ones so nobody\'s work is overwritten.</li></ol>' +
      '<div class="tip">The file contains student names. Keep it in your school OneDrive or Google Drive, not on a USB stick or in email to outside addresses. Save one before each exam period.</div>'],
    ['Customise the app (Settings)',
      '<p>Editors only. Open the <b>Settings</b> tab, make changes, then click <b>Save settings</b>. Settings are shared by every editor and every session.</p>' +
      '<ol><li><b>School &amp; branding</b> — school name, header line, colour and logo, used on screen and on every printed sheet.</li>' +
      '<li><b>Room types</b> — seat-grid or list rooms. Give a room type a print title and it gets its own sheet on the Print tab.</li>' +
      '<li><b>Statuses</b> — rename, recolour, add or remove statuses and choose which room type each one goes to. A status still used by a student cannot be deleted.</li>' +
      '<li><b>Seating defaults</b> — the rules new sessions start with. Each session can change its own under Seating Plan → Seating rules.</li>' +
      '<li><b>Print</b> — orientation, columns, and optional supervisor, time and instruction lines.</li></ol>' +
      '<div class="tip">Blocked seats, aisles, row/seat labels and supervisors are set per room: Rooms &amp; Layout → Edit.</div>']
  ];
  return '<div class="section-head"><div><h2>How-to Guides</h2><p>Click a task to see the steps. Written for busy staff — no technical knowledge needed.</p></div></div>' +
    guides.map(function (g, i) {
      return '<div class="help-item" id="help' + i + '"><button onclick="document.getElementById(\'help' + i + '\').classList.toggle(\'open\')">' +
        g[0] + '<span>&#9662;</span></button><div class="help-body">' + g[1] + '</div></div>';
    }).join('');
}

/* ========================= SEED DATA ========================== */
var SEED_RAW = null; /*__SEED__*/

function buildSeedDB() {
  var db = { version: 1, sessions: [], templates: [], activeSessionId: null };
  var tmplRooms = [
    { name: 'GYM', purpose: 'main', kind: 'seated', rows: 12, seatsPerRow: 18 },
    { name: 'CDV2', purpose: 'special', kind: 'list' },
    { name: 'BL3', purpose: 'withdrawn', kind: 'list' }
  ];
  db.templates.push({ id: uid(), name: 'NAPLAN standard setup (GYM + CDV2 + BL3)', rooms: JSON.parse(JSON.stringify(tmplRooms)) });

  if (SEED_RAW) {
    Object.keys(SEED_RAW).forEach(function (yr) {
      var rooms = JSON.parse(JSON.stringify(tmplRooms)).map(function (r) { r.id = uid(); return r; });
      var byRoomName = {};
      rooms.forEach(function (r) { byRoomName[r.name] = r; });
      var students = SEED_RAW[yr].map(function (x) {
        var st = { id: uid(), first: x.first, last: x.last, klass: '', status: x.status, roomId: null, row: null, seat: null };
        var r = byRoomName[x.room];
        if (r) {
          // A student sitting in a list room is there for that room's reason.
          if (r.purpose === 'special' && st.status === 'Completing') st.status = 'Special Provision';
          if (r.purpose === 'withdrawn' && st.status === 'Completing') st.status = 'Withdrawn';
          st.roomId = r.id;
          if (r.kind === 'seated' && x.row) {
            st.row = parseInt(String(x.row).replace(/\D/g, ''), 10) || null;
            st.seat = parseInt(String(x.seat).replace(/\D/g, ''), 10) || null;
          }
        }
        return st;
      });
      db.sessions.push({
        id: uid(), name: 'NAPLAN 2026 — Year ' + yr, group: 'Year ' + yr, date: '2026-03-11',
        version: 1, loaded: true, rooms: rooms, students: students,
        settings: { sortBy: 'surname', keepApart: [] }
      });
    });
  }
  db.activeSessionId = db.sessions.length ? db.sessions[0].id : null;
  return db;
}

/* =========================== BOOT ============================= */
(async function boot() {
  try {
    await loadDB();
    applyBranding();
    render();
  } catch (e) {
    document.getElementById('main').innerHTML =
      '<div class="empty-msg">The app could not start: ' + esc(e.message) + '<br><br>Try refreshing. If it keeps happening, tell the exam coordinator.</div>';
  }
})();
