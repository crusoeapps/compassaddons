/* ===================== EXAM ROOMS: PANEL + COMPASS =====================
   The step-by-step panel inside Compass. Talks only to Compass (the
   teacher's own login). Everything else stays in this page's memory until
   the coordinator saves a file or prints.
   ================================================================ */

var ER_STEPS = ['Exam session', 'Classes', 'Exemptions', 'SEA students', 'Fixed seats', 'Name fixes', 'Seating chart', 'Documents'];
var ER_GAPS = { seat: 'One empty seat', row: 'Start a new row', rowplus: 'New row plus one empty row' };

function erNewState() {
  return {
    v: 1,
    details: { exam: '', year: '', school: 'Crusoe College', sessions: [{ label: '', start: '', finish: '' }] },
    room: { name: '', rows: 15, seatsPerRow: 20, use: 17 },
    groups: [{ name: '', codes: '', gap: 'row' }],
    exemptText: '', seaRows: [], seaStay: {}, pins: {}, overrides: {}, matchChoice: {},
    spareOverflow: false, roster: {}
  };
}

var ER = {
  S: erNewState(),
  step: 0,
  seaText: '',          // pasted SEA table, kept in memory only (it may contain reasons)
  data: { classes: {}, students: {} },
  selected: null,       // seat-swap by clicking: first picked student id
  notice: '',           // message shown at the top of the current step
  root: null
};

/* ---------- Compass ---------- */

function erCompassError(what, e) {
  if (e && e.name === 'AbortError') return 'Compass took too long to answer for ' + what + '. Press Retry.';
  if (e && (e.status === 401 || e.status === 403)) return 'Compass would not let us read ' + what + '. You may have been logged out: refresh Compass, log in again, then press Retry.';
  if (e && e.status) return 'Compass could not load ' + what + ' (error ' + e.status + '). Press Retry; if it keeps happening, try again later.';
  return 'Could not reach Compass for ' + what + '. Check your connection, then press Retry.';
}

async function erPost(url, body) {
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 30000) : null;
  try {
    var res = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Requested-With': 'XMLHttpRequest' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: ctl ? ctl.signal : undefined
    });
    if (!res.ok) { var err = new Error('HTTP ' + res.status); err.status = res.status; throw err; }
    return await res.json();
  } finally { if (timer) clearTimeout(timer); }
}

/* Subjects in the currently relevant academic group (-1), as exam-results.js does. */
var erSubjectsCache = null;
async function erSubjects() {
  if (erSubjectsCache) return erSubjectsCache;
  var all = [], start = 0, LIMIT = 500;
  for (var guard = 0; guard < 10; guard++) {
    var r = await erPost('/Services/Subjects.svc/GetSubjectsInAcademicGroup', {
      academicGroupId: -1, includeDataSyncSubjects: true, page: guard + 1, start: start, limit: LIMIT,
      sort: '[{"property":"importIdentifier","direction":"ASC"}]' });
    var rows = (r && r.d && r.d.data) || [];
    all = all.concat(rows);
    if (rows.length < LIMIT) break;
    start += LIMIT;
  }
  erSubjectsCache = all;
  return all;
}

var erClassCache = {};
async function erClassesOfSubject(subjectId) {
  if (erClassCache[subjectId]) return erClassCache[subjectId];
  var all = [], start = 0, LIMIT = 100;
  for (var guard = 0; guard < 10; guard++) {
    var r = await erPost('/Services/Subjects.svc/GetStandardClassesOfSubject', {
      subjectId: subjectId, page: guard + 1, start: start, limit: LIMIT, sort: '[{"property":"name","direction":"ASC"}]' });
    var rows = (r && r.d && r.d.data) || [];
    all = all.concat(rows);
    if (rows.length < LIMIT) break;
    start += LIMIT;
  }
  erClassCache[subjectId] = all;
  return all;
}

/* Find a class by its code. Subjects whose code starts the class code are
   checked first (10MAG for 10MAG3); only if that fails is every subject checked. */
async function erFindClass(code) {
  var subs = await erSubjects();
  var key = code.toUpperCase();
  function matches(c) { return String(c.name || '').toUpperCase().replace(/\s+/g, '') === key; }
  var likely = subs.filter(function (s) { var id = String(s.importIdentifier || '').toUpperCase(); return id && key.indexOf(id) === 0; })
    .sort(function (a, b) { return String(b.importIdentifier).length - String(a.importIdentifier).length; });
  var i, found;
  for (i = 0; i < likely.length; i++) { found = (await erClassesOfSubject(likely[i].id)).filter(matches)[0]; if (found) return found; }
  for (i = 0; i < subs.length; i++) {
    if (likely.indexOf(subs[i]) >= 0) continue;
    found = (await erClassesOfSubject(subs[i].id)).filter(matches)[0];
    if (found) return found;
  }
  return null;
}

/* Lead teacher shown on the roll. Until a real Compass response confirms
   which field holds the staff code, this is the teacher's initials. */
async function erTeacher(managerId) {
  if (!managerId) return '';
  var r = await erPost('/Services/User.svc/GetUserDetailsBlobByUserId', {
    targetUserId: managerId, targetSchoolId: (window.Compass && window.Compass.schoolId) || undefined, page: 1, start: 0, limit: 25 });
  var full = String((r && r.d && r.d.userFullName) || '').trim().split(/\s+/).filter(Boolean);
  if (!full.length) return '';
  return (full[0][0] + (full.length > 1 ? full[full.length - 1][0] : '')).toUpperCase();
}

async function erEnrolments(activityId) {
  var all = [], start = 0, LIMIT = 100;
  for (var guard = 0; guard < 20; guard++) {
    var r = await erPost('/Services/Activity.svc/GetEnrolmentsByActivityId', { activityId: activityId, page: guard + 1, start: start, limit: LIMIT });
    var rows = (r && (Array.isArray(r.d) ? r.d : (r.d && r.d.data))) || [];
    all = all.concat(rows);
    if (rows.length < LIMIT) break;
    start += LIMIT;
  }
  // class-export-csv.js keeps only rows with "pi" set; do the same when the field is present.
  if (all.some(function (x) { return x && 'pi' in x; })) all = all.filter(function (x) { return x.pi; });
  return all;
}

async function erLoadClass(code) {
  var c = ER.data.classes[code] = { status: 'loading', studentIds: [], teacher: '', message: '' };
  erRender();
  try {
    var cls = await erFindClass(code);
    if (!cls) { c.status = 'missing'; c.message = 'No class called ' + code + ' was found in Compass this year. Check the code.'; erRender(); return; }
    var results = await Promise.all([erEnrolments(cls.id), erTeacher(cls.managerId).catch(function () { return ''; })]);
    c.teacher = results[1];
    c.activityId = cls.id;
    results[0].forEach(function (e) {
      if (e.uid == null || !e.n) return;
      var id = 'c' + e.uid;
      var st = ER.data.students[id];
      if (!st) st = ER.data.students[id] = erMakeStudent(e.uid, e.n, code);
      else if (st.classes.indexOf(code) < 0) st.classes.push(code);
      if (c.studentIds.indexOf(id) < 0) c.studentIds.push(id);
    });
    c.status = 'ok';
  } catch (e) {
    c.status = 'error'; c.message = erCompassError(code, e);
  }
  erRender();
}

function erAllCodes() {
  var out = [];
  ER.S.groups.forEach(function (g) { erExpandCodes(g.codes).forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); }); });
  return out;
}

async function erLoadAll() {
  var codes = erAllCodes(), queue = codes.slice();
  if (!codes.length) { ER.notice = 'Add at least one class code first.'; erRender(); return; }
  ER.data = { classes: {}, students: {} };
  codes.forEach(function (c) { ER.data.classes[c] = { status: 'waiting', studentIds: [], teacher: '', message: '' }; });
  erRender();
  try { await erSubjects(); }
  catch (e) { codes.forEach(function (c) { ER.data.classes[c] = { status: 'error', studentIds: [], message: erCompassError('the subject list', e) }; }); erRender(); return; }
  async function worker() { while (queue.length) await erLoadClass(queue.shift()); }
  await Promise.all([worker(), worker(), worker(), worker()]);
}

/* ---------- working out who goes where ---------- */

function erKeyFor(kind, first, last) { return kind + '|' + erKey(first) + '|' + erKey(last); }

/* Resolve one pasted name: { id | null, needsChoice, match } */
function erResolve(kind, first, last, list) {
  var key = erKeyFor(kind, first, last), choice = ER.S.matchChoice[key];
  var m = erMatchName(first, last, list);
  if (choice === 'none') return { key: key, id: null, done: true, match: m };
  if (choice && ER.data.students[choice]) return { key: key, id: choice, done: true, match: m };
  if (m.status === 'exact') return { key: key, id: m.student.id, done: true, match: m };
  return { key: key, id: null, done: false, match: m };
}

function erBuildModel() {
  var S = ER.S, data = ER.data;
  var students = {};
  Object.keys(data.students).forEach(function (id) {
    var s = data.students[id];
    students[id] = { id: id, uid: s.uid, legalFirst: s.legalFirst, bracket: s.bracket, first: s.first, compassLast: s.compassLast,
                     last: s.compassLast, classes: s.classes.slice() };
  });
  erApplyOverrides(Object.keys(students).map(function (k) { return students[k]; }), S.overrides);
  var list = Object.keys(students).map(function (k) { return students[k]; }).sort(erCompareNames);

  var exempt = {}, provision = {}, pending = [], report = [];
  erParseExemptions(S.exemptText).forEach(function (x) {
    var r = erResolve('ex', x.first, x.last, list);
    report.push({ kind: 'Exemption', entry: x, res: r });
    if (!r.done) pending.push(r.key);
    if (r.id) exempt[r.id] = true;
  });
  S.seaRows.forEach(function (x) {
    var r = erResolve('sea', x.first, x.last, list);
    report.push({ kind: 'SEA', entry: x, res: r });
    if (!r.done) pending.push(r.key);
    if (r.id && !exempt[r.id]) provision[r.id] = x.provision || '';
  });

  var classOrder = [], groups = [], groupOf = {}, placed = {};
  S.groups.forEach(function (g) {
    var codes = erExpandCodes(g.codes), ids = [];
    codes.forEach(function (code) {
      var c = data.classes[code];
      if (!c || c.status !== 'ok') return;          // codes not found get no roll
      if (classOrder.indexOf(code) < 0) classOrder.push(code);
      c.studentIds.forEach(function (id) {
        if (placed[id] || ids.indexOf(id) >= 0) return;
        ids.push(id);
      });
    });
    ids.forEach(function (id) { placed[id] = true; groupOf[id] = g.name || 'Group'; });
    groups.push({ name: g.name || 'Group', gap: g.gap, students: ids.filter(function (id) {
      return !exempt[id] && !(provision[id] !== undefined && !S.seaStay[id]);
    }).map(function (id) { return students[id]; }) });
  });

  var seating = erSeat(S.room, groups, S.pins);
  // Overflow into the spare seats, only if the coordinator chose that.
  if (seating.unplaced.length && S.spareOverflow) {
    var taken = {};
    Object.keys(seating.seats).forEach(function (id) { taken[seating.seats[id].row + '_' + seating.seats[id].seat] = 1; });
    var left = [];
    seating.unplaced.forEach(function (st) {
      for (var r = 1; r <= S.room.rows; r++) for (var s = 1; s <= S.room.seatsPerRow; s++) {
        if (!taken[r + '_' + s]) { taken[r + '_' + s] = 1; seating.seats[st.id] = { row: r, seat: s }; return; }
      }
      left.push(st);
    });
    seating.unplaced = left;
  }
  var sea = Object.keys(provision).map(function (id) { return students[id]; });
  var sitting = Object.keys(groupOf).filter(function (id) { return !exempt[id]; }).map(function (id) { return students[id]; });
  var classes = {};
  classOrder.forEach(function (code) {
    var c = data.classes[code] || {};
    classes[code] = { teacher: c.teacher || '', studentIds: (c.studentIds || []).slice() };
  });
  return {
    students: students, exempt: exempt, provision: provision, sea: sea, sitting: sitting, groupOf: groupOf,
    seats: seating.seats, unplaced: seating.unplaced, conflicts: seating.conflicts, groups: groups,
    ranges: erGroupRanges(S.room, groups, seating.seats, S.pins), classes: classes, classOrder: classOrder,
    report: report, pending: pending
  };
}

/* ---------- save / open ---------- */

function erDownload(name, text, type) {
  var blob = new Blob([text], { type: type });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
}

function erSaveState() {
  var S = JSON.parse(JSON.stringify(ER.S));
  S.roster = {};
  Object.keys(ER.data.classes).forEach(function (c) { if (ER.data.classes[c].status === 'ok') S.roster[c] = ER.data.classes[c].studentIds.slice(); });
  return S;
}

function erSaveSession() {
  var model = erBuildModel();
  var file = erPlanFile(ER.S, model, erSaveState());
  erDownload(erFileName(ER.S, 'Exam Rooms session', 'json'), JSON.stringify(file, null, 1), 'application/json');
  ER.notice = 'Saved. The file has student names: keep it somewhere private. Open it again with "Open saved file" (or in the Exam Seating Manager).';
  erRender();
}

function erOpenSession() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function () {
    var f = inp.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { erOpenText(String(reader.result)); };
    reader.onerror = function () { ER.notice = 'Could not read that file. Try again.'; erRender(); };
    reader.readAsText(f);
  };
  inp.click();
}

async function erOpenText(text) {
  var f;
  try { f = JSON.parse(text); } catch (e) { ER.notice = 'That file is not a saved Exam Rooms session.'; erRender(); return; }
  if (!f || f.app !== 'Exam Seating Manager' || !f.examRooms) {
    ER.notice = 'That file was not saved by Exam Rooms, so it cannot be reopened here. (Plans from the Exam Seating Manager open in the Manager.)';
    erRender(); return;
  }
  var old = f.examRooms.roster || {};
  ER.S = Object.assign(erNewState(), f.examRooms);
  ER.seaText = erSeaRowsToText(ER.S.seaRows);
  ER.step = 6;
  ER.notice = 'Reading the latest class lists from Compass…';
  erRender();
  await erLoadAll();
  // Who joined or left since the file was saved.
  var joined = [], left = [];
  Object.keys(ER.data.classes).forEach(function (code) {
    var now = ER.data.classes[code].studentIds || [], before = old[code] || [];
    now.forEach(function (id) { if (before.indexOf(id) < 0) joined.push(id + '|' + code); });
    before.forEach(function (id) { if (now.indexOf(id) < 0) left.push(id + '|' + code); });
  });
  var name = function (x) {
    var id = x.split('|')[0], st = ER.data.students[id];
    return (st ? st.first + ' ' + st.compassLast : 'A student no longer in Compass') + ' (' + x.split('|')[1] + ')';
  };
  ER.notice = 'Opened your saved session and read the latest class lists. ' +
    (joined.length || left.length
      ? (joined.length ? 'Joined since you saved: ' + joined.map(name).join(', ') + '. ' : '') +
        (left.length ? 'No longer in these classes: ' + left.length + ' student' + (left.length === 1 ? '' : 's') + '. ' : '') +
        'The chart below includes these changes; your fixed seats and moves are kept. Check it, then save again.'
      : 'Nothing has changed, so the seats are exactly as you saved them.');
  erRender();
}

function erSeaRowsToText(rows) {
  return (rows || []).map(function (r) { return [r.first, r.last, r.form, '', r.provision].join('\t'); }).join('\n');
}

/* ---------- documents ---------- */

function erDocsFor(model) {
  var S = ER.S;
  return [
    { key: 'grid', label: 'Seat grid (' + (S.room.name || 'exam room') + ')', file: erFileName(S, (S.room.name || 'Exam room') + ' seat grid', 'html'), html: erDocSeatGrid(S, model) },
    { key: 'master', label: 'Master list', file: erFileName(S, 'Master list', 'html'), html: erDocMaster(S, model) },
    { key: 'sea', label: 'SEA Room list', file: erFileName(S, 'SEA Room list', 'html'), html: erDocSEA(S, model) },
    { key: 'rolls', label: 'Exam rolls (one page per class)', file: erFileName(S, 'Exam rolls', 'html'), html: erDocRolls(S, model) }
  ];
}

function erDownloadAll() {
  var model = erBuildModel();
  var docs = erDocsFor(model);
  var items = docs.map(function (d) { return [d.file, d.html, 'text/html']; });
  items.push([erFileName(ER.S, 'Exam Seating plan', 'json'), JSON.stringify(erPlanFile(ER.S, model, erSaveState()), null, 1), 'application/json']);
  items.forEach(function (it, i) { setTimeout(function () { erDownload(it[0], it[1], it[2]); }, i * 400); });
  ER.notice = 'Saving ' + items.length + ' files to your Downloads. If the browser asks, allow multiple downloads.';
  erRender();
}

/* ---------- panel ---------- */

var ER_CSS =
  '#er-root{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.45);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#1f2937}' +
  '#er-root .er-card{position:absolute;inset:3vh 3vw;background:#fff;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}' +
  '#er-root .er-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #e5e7eb}' +
  '#er-root .er-head strong{font-size:17px;margin-right:auto}' +
  '#er-root .er-steps{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid #f1f5f9;background:#f9fafb}' +
  '#er-root .er-steps button{border:1px solid #d1d5db;background:#fff;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;color:#374151}' +
  '#er-root .er-steps button.on{background:#0d5c2e;border-color:#0d5c2e;color:#fff}' +
  '#er-root .er-body{flex:1;overflow:auto;padding:16px}' +
  '#er-root .er-foot{display:flex;justify-content:space-between;padding:10px 16px;border-top:1px solid #e5e7eb}' +
  '#er-root button.er-btn{border:1px solid #d1d5db;background:#fff;border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;color:#1f2937}' +
  '#er-root button.er-btn.pri{background:#0d5c2e;border-color:#0d5c2e;color:#fff}' +
  '#er-root button.er-btn:disabled{opacity:.45;cursor:not-allowed}' +
  '#er-root label{display:block;font-weight:600;font-size:12px;color:#4b5563;margin:10px 0 3px}' +
  '#er-root input,#er-root select,#er-root textarea{font:inherit;border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;color:#111827;background:#fff}' +
  '#er-root textarea{width:100%;min-height:120px}' +
  '#er-root table.er-t{border-collapse:collapse;width:100%;margin:8px 0}' +
  '#er-root table.er-t th,#er-root table.er-t td{border-bottom:1px solid #eef0f4;padding:5px 6px;text-align:left;vertical-align:top;font-size:13px}' +
  '#er-root .er-note{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 12px;margin-bottom:12px}' +
  '#er-root .er-warn{background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:8px 12px;margin:8px 0}' +
  '#er-root .er-bad{color:#b91c1c;font-weight:600}' +
  '#er-root .er-ok{color:#166534;font-weight:600}' +
  '#er-root .er-muted{color:#6b7280;font-size:12px}' +
  '#er-root .er-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}' +
  '#er-root .er-grid{border-collapse:collapse;font-size:10px;margin-top:8px}' +
  '#er-root .er-grid th{background:#0d5c2e;color:#fff;padding:2px 3px;font-weight:600}' +
  '#er-root .er-grid td{border:1px solid #d1d5db;width:62px;height:30px;padding:1px 2px;text-align:center;vertical-align:middle;cursor:pointer;user-select:none}' +
  '#er-root .er-grid td.spare{background:#f3f4f6}' +
  '#er-root .er-grid td.pin{box-shadow:inset 0 0 0 2px #0d5c2e}' +
  '#er-root .er-grid td.sel{background:#fde68a}' +
  '#er-root .er-grid td.over{background:#bbf7d0}' +
  '#er-root .er-grid td b{display:block;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px}' +
  '#er-root .er-grid td span{display:block;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px}';

function erVal(path) { var o = ER.S; path.split('.').forEach(function (k) { o = o == null ? o : o[k]; }); return o == null ? '' : o; }
function erIn(path, attrs) { return '<input data-bind="' + path + '" value="' + erEsc(erVal(path)) + '"' + (attrs || '') + '>'; }

function erStepExam() {
  var S = ER.S;
  var h = '<p>Set up the exam and the room. You can save this as a file at any time (top right) and open it again later.</p><div class="er-row">' +
    '<div><label>Exam name</label>' + erIn('details.exam', ' placeholder="Semester 2 Exam" size="28"') + '</div>' +
    '<div><label>Year level</label>' + erIn('details.year', ' placeholder="Year 10" size="10"') + '</div>' +
    '<div><label>School</label>' + erIn('details.school', ' size="22"') + '</div></div>' +
    '<label>Sessions (one per roll column)</label><table class="er-t"><tr><th>Date and session</th><th>Start</th><th>Finish</th><th></th></tr>';
  S.details.sessions.forEach(function (x, i) {
    h += '<tr><td>' + erIn('details.sessions.' + i + '.label', ' placeholder="Monday 16 November AM" size="30"') + '</td><td>' +
      erIn('details.sessions.' + i + '.start', ' placeholder="9:00" size="7"') + '</td><td>' +
      erIn('details.sessions.' + i + '.finish', ' placeholder="11:00" size="7"') + '</td><td>' +
      (S.details.sessions.length > 1 ? '<button class="er-btn" data-act="delSession" data-i="' + i + '">Remove</button>' : '') + '</td></tr>';
  });
  h += '</table><button class="er-btn" data-act="addSession">+ Add a session</button>' +
    '<h3>Room</h3><div class="er-row">' +
    '<div><label>Room name</label>' + erIn('room.name', ' placeholder="BSSC Gym" size="20"') + '</div>' +
    '<div><label>Rows</label>' + erIn('room.rows', ' type="number" min="1" max="60" style="width:70px"') + '</div>' +
    '<div><label>Seats per row</label>' + erIn('room.seatsPerRow', ' type="number" min="1" max="60" style="width:70px"') + '</div>' +
    '<div><label>Seats to use in each row</label>' + erIn('room.use', ' type="number" min="1" max="60" style="width:70px"') + '</div></div>' +
    '<p class="er-muted">Seats beyond "seats to use" stay empty as spares. Row 1 is the front.</p>';
  return h;
}

function erStepClasses() {
  var S = ER.S, h = '<p>Add each group of classes in the order they should be seated, with the class codes in it. ' +
    'Ranges work: <b>10MAG1–10MAG6</b>. Students come straight from each class\'s current enrolments in Compass.</p>' +
    '<table class="er-t"><tr><th>Order</th><th>Group name</th><th>Class codes</th><th>Gap after this group</th><th></th></tr>';
  S.groups.forEach(function (g, i) {
    h += '<tr><td style="white-space:nowrap">' + (i + 1) + ' ' +
      (i > 0 ? '<button class="er-btn" data-act="upGroup" data-i="' + i + '" title="Move up">↑</button>' : '') + '</td><td>' +
      erIn('groups.' + i + '.name', ' placeholder="Advanced Maths" size="18"') + '</td><td>' +
      erIn('groups.' + i + '.codes', ' placeholder="10MAA1, 10MAA2" size="34"') + '</td><td><select data-bind="groups.' + i + '.gap">' +
      Object.keys(ER_GAPS).map(function (k) { return '<option value="' + k + '"' + (g.gap === k ? ' selected' : '') + '>' + ER_GAPS[k] + '</option>'; }).join('') +
      '</select></td><td>' + (S.groups.length > 1 ? '<button class="er-btn" data-act="delGroup" data-i="' + i + '">Remove</button>' : '') + '</td></tr>';
  });
  h += '</table><button class="er-btn" data-act="addGroup">+ Add a group</button> ' +
    '<button class="er-btn pri" data-act="loadAll">Get students from Compass</button>';
  var codes = erAllCodes();
  if (codes.some(function (c) { return ER.data.classes[c]; })) {
    h += '<table class="er-t"><tr><th>Class</th><th>Students</th><th>Teacher</th><th>Status</th></tr>';
    codes.forEach(function (c) {
      var x = ER.data.classes[c] || { status: 'waiting' };
      var st = x.status === 'ok' ? '<span class="er-ok">Found</span>'
        : x.status === 'loading' || x.status === 'waiting' ? 'Loading…'
        : '<span class="er-bad">' + erEsc(x.message || 'Not loaded') + '</span> <button class="er-btn" data-act="retry" data-code="' + erEsc(c) + '">Retry</button>';
      h += '<tr><td>' + erEsc(c) + '</td><td>' + (x.status === 'ok' ? x.studentIds.length : '') + '</td><td>' + erEsc(x.teacher || '') + '</td><td>' + st + '</td></tr>';
    });
    h += '</table>';
    var multi = Object.keys(ER.data.students).filter(function (id) { return ER.data.students[id].classes.length > 1; });
    if (multi.length) h += '<p class="er-muted">' + multi.length + ' student' + (multi.length === 1 ? ' is' : 's are') + ' in more than one of these classes; each is seated once, with their first group.</p>';
  }
  return h;
}

function erStudentOptions(selected, blankLabel) {
  var list = Object.keys(ER.data.students).map(function (id) { return ER.data.students[id]; }).sort(erCompareNames);
  return '<option value="">' + erEsc(blankLabel || 'Choose a student…') + '</option>' + list.map(function (st) {
    return '<option value="' + erEsc(st.id) + '"' + (st.id === selected ? ' selected' : '') + '>' + erEsc(st.compassLast + ', ' + st.first + (st.legalFirst !== st.first ? ' (' + st.legalFirst + ')' : '') + ' – ' + st.classes.join(', ')) + '</option>';
  }).join('');
}

/* One pasted name and how it matched; anything not exact needs a choice. */
function erMatchRow(item, model) {
  var r = item.res, m = r.match, e = item.entry;
  var who = r.id ? model.students[r.id] : null;
  var status;
  if (r.id && m.status === 'exact' && !ER.S.matchChoice[r.key]) status = '<span class="er-ok">Matched</span> ' + erEsc(who.first + ' ' + who.last);
  else {
    var choice = ER.S.matchChoice[r.key] || '';
    var opts = '<option value="">' + (r.done ? '' : 'Choose…') + '</option>' +
      m.candidates.map(function (c) { return '<option value="' + erEsc(c.student.id) + '"' + (choice === c.student.id ? ' selected' : '') + '>' + erEsc(c.student.first + ' ' + c.student.last + ' – ' + c.why) + '</option>'; }).join('') +
      '<option value="none"' + (choice === 'none' ? ' selected' : '') + '>Not found – leave this name out</option>' +
      '<option value="other"' + (choice && choice !== 'none' && !m.candidates.some(function (c) { return c.student.id === choice; }) ? ' selected' : '') + '>Someone else…</option>';
    status = (r.done ? '<span class="er-ok">Confirmed</span> ' : '<span class="er-bad">' + (m.status === 'none' ? 'Not found – please choose' : 'Please confirm') + '</span> ') +
      '<select data-match="' + erEsc(r.key) + '">' + opts + '</select>';
    if (choice && choice !== 'none' && !m.candidates.some(function (c) { return c.student.id === choice; }) || ER.otherFor === r.key) {
      status += ' <select data-match="' + erEsc(r.key) + '">' + erStudentOptions(choice, 'Choose the right student…') + '</select>';
    }
  }
  return '<tr><td>' + erEsc(item.kind) + '</td><td>' + erEsc(e.first + ' ' + e.last) + '</td><td>' + status + '</td></tr>';
}

function erMatchTable(model, kind) {
  var rows = model.report.filter(function (x) { return !kind || x.kind === kind; });
  if (!rows.length) return '<p class="er-muted">Nothing entered.</p>';
  return '<table class="er-t"><tr><th>List</th><th>Name entered</th><th>Match in Compass</th></tr>' + rows.map(function (x) { return erMatchRow(x, model); }).join('') + '</table>';
}

function erStepExemptions(model) {
  return '<p>Paste the exempt students: first name and last name, one per line (copied from a spreadsheet is fine). ' +
    'They are left out of the seating but still listed on the roll as &lt;Exempt&gt;.</p>' +
    '<textarea data-bind="exemptText" placeholder="Rose&#9;Marlowe">' + erEsc(ER.S.exemptText) + '</textarea>' +
    (Object.keys(ER.data.students).length ? erMatchTable(model, 'Exemption') : '<p class="er-muted">Get students from Compass (step 2) to check these names.</p>');
}

function erStepSEA(model) {
  var h = '<p>Paste the SEA table with columns <b>First name, Last name, Form, Reason, Provision</b>. ' +
    'Reasons are used only to read the table: they are never shown, printed or saved.</p>' +
    '<textarea data-sea="1" placeholder="First name&#9;Last name&#9;Form&#9;Reason&#9;Provision">' + erEsc(ER.seaText) + '</textarea>';
  if (!Object.keys(ER.data.students).length) return h + '<p class="er-muted">Get students from Compass (step 2) to check these names.</p>';
  h += erMatchTable(model, 'SEA');
  var sea = model.sea.slice().sort(erCompareNames);
  if (sea.length) {
    h += '<h3>Where they sit</h3><table class="er-t"><tr><th>Student</th><th>Provision</th><th>Stays in the main room?</th></tr>';
    sea.forEach(function (st) {
      h += '<tr><td>' + erEsc(st.first + ' ' + st.last) + '</td><td>' + erEsc(model.provision[st.id]) + '</td><td><input type="checkbox" data-stay="' + erEsc(st.id) + '"' + (ER.S.seaStay[st.id] ? ' checked' : '') + '> Stays in ' + erEsc(ER.S.room.name || 'the main room') + '</td></tr>';
    });
    h += '</table>';
  }
  return h;
}

function erStepPins() {
  var S = ER.S, ids = Object.keys(S.pins);
  var h = '<p>Optional. Fix a student to a seat, or to the back of the row they would otherwise sit in. Everyone else fills in around them. ' +
    'Moving students on the seating chart adds them here too.</p><table class="er-t"><tr><th>Student</th><th>Fixed to</th><th></th></tr>';
  ids.forEach(function (id) {
    var p = S.pins[id], st = ER.data.students[id];
    h += '<tr><td>' + erEsc(st ? st.first + ' ' + st.compassLast : 'A student not in these classes') + '</td><td>' +
      (p.back ? 'Back of their row' : 'Row ' + erEsc(p.row) + ' Seat ' + erEsc(p.seat)) + '</td><td><button class="er-btn" data-act="delPin" data-id="' + erEsc(id) + '">Remove</button></td></tr>';
  });
  if (!ids.length) h += '<tr><td colspan="3" class="er-muted">No fixed seats.</td></tr>';
  h += '</table><div class="er-row"><div><label>Student</label><select id="er-pin-who">' + erStudentOptions('') + '</select></div>' +
    '<div><label>Where</label><select id="er-pin-kind"><option value="seat">A particular seat</option><option value="back">Back of their row</option></select></div>' +
    '<div><label>Row</label><input id="er-pin-row" type="number" min="1" style="width:70px"></div>' +
    '<div><label>Seat</label><input id="er-pin-seat" type="number" min="1" style="width:70px"></div>' +
    '<div><button class="er-btn pri" data-act="addPin">Add</button></div></div>';
  if (S.spareOverflow) h += '<p class="er-muted">Students who do not fit go in the spare seats (chosen on the seating chart). <button class="er-btn" data-act="spareOff">Stop using spare seats</button></p>';
  return h;
}

function erStepNames() {
  var S = ER.S, ids = Object.keys(S.overrides);
  var h = '<p>Optional. Change a surname used on the documents, for example when a student is known by a different surname. Applied before sorting.</p>' +
    '<table class="er-t"><tr><th>Student</th><th>Surname in Compass</th><th>Print as</th><th></th></tr>';
  ids.forEach(function (id) {
    var st = ER.data.students[id];
    h += '<tr><td>' + erEsc(st ? st.first : '?') + '</td><td>' + erEsc(st ? st.compassLast : '') + '</td><td><b>' + erEsc(S.overrides[id]) + '</b></td><td><button class="er-btn" data-act="delOverride" data-id="' + erEsc(id) + '">Remove</button></td></tr>';
  });
  if (!ids.length) h += '<tr><td colspan="4" class="er-muted">No surname changes.</td></tr>';
  h += '</table><div class="er-row"><div><label>Student</label><select id="er-ov-who">' + erStudentOptions('') + '</select></div>' +
    '<div><label>Print surname as</label><input id="er-ov-last" size="20" placeholder="HOLLOWAY"></div>' +
    '<div><button class="er-btn pri" data-act="addOverride">Add</button></div></div>';
  return h;
}

function erStepChart(model) {
  var S = ER.S, r = S.room, rows = Number(r.rows), per = Number(r.seatsPerRow), use = Math.min(Number(r.use) || per, per);
  var h = '';
  if (model.pending.length) h += '<div class="er-warn"><b>' + model.pending.length + ' name' + (model.pending.length === 1 ? ' needs' : 's need') + ' checking</b> before documents can be made. Choose the right student (or "Not found") below.</div>';
  if (model.unplaced.length) {
    h += '<div class="er-warn"><b>' + model.unplaced.length + ' student' + (model.unplaced.length === 1 ? ' does' : 's do') + ' not fit</b> in ' +
      erEsc(r.name || 'the room') + ' with these settings. Nobody has been dropped. Choose one: ' +
      '<button class="er-btn" data-act="fitUse">Use all ' + per + ' seats in each row</button> ' +
      '<button class="er-btn" data-act="fitGaps">Use one-seat gaps between groups</button> ' +
      '<button class="er-btn" data-act="fitSpare">Put the extra students in the spare seats</button></div>';
  }
  model.conflicts.forEach(function (c) { h += '<div class="er-warn">' + erEsc(c) + '</div>'; });
  h += '<p>Drag a student onto another seat to swap them (or onto an empty seat to move them). Or click one seat, then another. ' +
    'Moved students become fixed seats, so they stay put if you change anything else. Green outline = fixed.</p>';
  var grid = {};
  Object.keys(model.seats).forEach(function (id) { var p = model.seats[id]; grid[p.row + '_' + p.seat] = model.students[id]; });
  h += '<div style="overflow:auto"><table class="er-grid"><tr><th></th>';
  for (var row = 1; row <= rows; row++) h += '<th>Row ' + row + '</th>';
  h += '</tr>';
  for (var seat = 1; seat <= per; seat++) {
    h += '<tr><th>Seat ' + seat + '</th>';
    for (var row2 = 1; row2 <= rows; row2++) {
      var st = grid[row2 + '_' + seat], cls = [];
      if (seat > use) cls.push('spare');
      if (st && S.pins[st.id]) cls.push('pin');
      if (st && ER.selected === st.id) cls.push('sel');
      h += '<td class="' + cls.join(' ') + '" data-row="' + row2 + '" data-seat="' + seat + '"' +
        (st ? ' draggable="true" data-id="' + erEsc(st.id) + '" title="' + erEsc(st.first + ' ' + st.last + ' – ' + (model.groupOf[st.id] || '')) + '"><span>' + erEsc(st.first) + '</span><b>' + erEsc(st.last) + '</b>' : '>') + '</td>';
    }
    h += '</tr>';
  }
  h += '</table></div><p class="er-muted">Grey seats are spares (beyond "seats to use").</p>';
  h += '<h3>Groups</h3><ul>' + model.ranges.map(function (x) { return '<li>' + erEsc(x) + '</li>'; }).join('') + '</ul>';
  h += '<p>' + model.sitting.length + ' sitting the exam: ' + Object.keys(model.seats).length + ' in ' + erEsc(r.name || 'the main room') + ', ' +
    model.sea.filter(function (s) { return !model.seats[s.id]; }).length + ' in the SEA Room. ' + Object.keys(model.exempt).length + ' exempt.</p>';
  h += '<h3>Names checked</h3>' + erMatchTable(model);
  return h;
}

function erStepDocs(model) {
  var blocked = model.pending.length ? 'Some names still need checking (Seating chart step).' : model.unplaced.length ? 'Some students do not fit yet (Seating chart step).' : '';
  if (blocked) return '<div class="er-warn">' + erEsc(blocked) + ' Documents can be made once that is sorted.</div>';
  var docs = erDocsFor(model);
  var h = '<p>Each document opens the print dialog: choose <b>Save as PDF</b> to keep it, or print it. Nothing leaves this computer.</p><table class="er-t">';
  docs.forEach(function (d) { h += '<tr><td>' + erEsc(d.label) + '</td><td><button class="er-btn pri" data-act="print" data-doc="' + d.key + '">Print / Save as PDF</button></td></tr>'; });
  h += '<tr><td>Plan file for the Exam Seating Manager (.json)</td><td><button class="er-btn" data-act="planFile">Download</button></td></tr></table>' +
    '<button class="er-btn pri" data-act="downloadAll">Download all (documents as .html + plan .json)</button>' +
    '<p class="er-muted">Files have student names: keep them somewhere private.</p>';
  return h;
}

/* Replacing the panel can blur a text box, which fires "change" and asks for
   another render while this one is still writing: queue it instead. */
function erRender() {
  if (ER.rendering) { ER.renderAgain = true; return; }
  ER.rendering = true;
  try { erRenderNow(); } finally {
    ER.rendering = false;
    if (ER.renderAgain) { ER.renderAgain = false; setTimeout(erRender, 0); }
  }
}

function erRenderNow() {
  var root = ER.root;
  if (!root) return;
  var model = erBuildModel();
  var body = [erStepExam, erStepClasses, erStepExemptions, erStepSEA, erStepPins, erStepNames, erStepChart, erStepDocs][ER.step](model);
  var keepScroll = root.querySelector('.er-body') ? root.querySelector('.er-body').scrollTop : 0;
  root.innerHTML = '<div class="er-card"><div class="er-head"><strong>Exam Rooms</strong>' +
    '<button class="er-btn" data-act="open">Open saved file</button><button class="er-btn" data-act="save">Save session file</button>' +
    '<button class="er-btn" data-act="close" aria-label="Close">Close</button></div>' +
    '<div class="er-steps">' + ER_STEPS.map(function (s, i) { return '<button data-act="go" data-i="' + i + '" class="' + (i === ER.step ? 'on' : '') + '">' + (i + 1) + '. ' + erEsc(s) + '</button>'; }).join('') + '</div>' +
    '<div class="er-body">' + (ER.notice ? '<div class="er-note">' + erEsc(ER.notice) + '</div>' : '') + '<h2 style="margin:0 0 6px;font-size:18px">' + erEsc(ER_STEPS[ER.step]) + '</h2>' + body + '</div>' +
    '<div class="er-foot"><button class="er-btn" data-act="back"' + (ER.step === 0 ? ' disabled' : '') + '>Back</button>' +
    '<button class="er-btn pri" data-act="next"' + (ER.step === ER_STEPS.length - 1 ? ' disabled' : '') + '>Next</button></div></div>';
  root.querySelector('.er-body').scrollTop = keepScroll;
}

function erSet(path, value) {
  var keys = path.split('.'), o = ER.S;
  for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  var last = keys[keys.length - 1];
  o[last] = /^(rows|seatsPerRow|use)$/.test(last) ? Math.max(1, Math.min(60, parseInt(value, 10) || 1)) : value;
}

/* Move a student to a seat by fixing them there; whoever was there swaps. */
function erMoveTo(id, row, seat) {
  var model = erBuildModel(), from = model.seats[id];
  var other = Object.keys(model.seats).filter(function (k) { return model.seats[k].row === row && model.seats[k].seat === seat; })[0];
  if (other === id) return;
  ER.S.pins[id] = { row: row, seat: seat };
  if (other) {
    if (from) ER.S.pins[other] = { row: from.row, seat: from.seat };
    else delete ER.S.pins[other];
  }
  ER.selected = null;
  ER.notice = '';
  erRender();
}

function erHandle(e) {
  var t = e.target.closest('[data-act]');
  if (t) {
    var act = t.getAttribute('data-act'), i = Number(t.getAttribute('data-i'));
    var S = ER.S;
    ER.notice = act === 'go' || act === 'next' || act === 'back' ? '' : ER.notice;
    if (act === 'close') { ER.root.style.display = 'none'; return; }
    if (act === 'go') ER.step = i;
    else if (act === 'next') ER.step = Math.min(ER.step + 1, ER_STEPS.length - 1);
    else if (act === 'back') ER.step = Math.max(ER.step - 1, 0);
    else if (act === 'addSession') S.details.sessions.push({ label: '', start: '', finish: '' });
    else if (act === 'delSession') S.details.sessions.splice(i, 1);
    else if (act === 'addGroup') S.groups.push({ name: '', codes: '', gap: 'row' });
    else if (act === 'delGroup') S.groups.splice(i, 1);
    else if (act === 'upGroup') { var g = S.groups.splice(i, 1)[0]; S.groups.splice(i - 1, 0, g); }
    else if (act === 'loadAll') { erLoadAll(); return; }
    else if (act === 'retry') { erLoadClass(t.getAttribute('data-code')); return; }
    else if (act === 'delPin') delete S.pins[t.getAttribute('data-id')];
    else if (act === 'addPin') {
      var who = ER.root.querySelector('#er-pin-who').value, kind = ER.root.querySelector('#er-pin-kind').value;
      var row = parseInt(ER.root.querySelector('#er-pin-row').value, 10), seat = parseInt(ER.root.querySelector('#er-pin-seat').value, 10);
      if (!who) ER.notice = 'Choose a student first.';
      else if (kind === 'back') S.pins[who] = { back: true };
      else if (!(row >= 1 && row <= S.room.rows && seat >= 1 && seat <= S.room.seatsPerRow)) ER.notice = 'That seat is not in the room (it has ' + S.room.rows + ' rows of ' + S.room.seatsPerRow + ' seats).';
      else S.pins[who] = { row: row, seat: seat };
    }
    else if (act === 'spareOff') S.spareOverflow = false;
    else if (act === 'delOverride') delete S.overrides[t.getAttribute('data-id')];
    else if (act === 'addOverride') {
      var w = ER.root.querySelector('#er-ov-who').value, l = ER.root.querySelector('#er-ov-last').value.trim();
      if (!w || !l) ER.notice = 'Choose a student and type the surname to print.'; else S.overrides[w] = l.toUpperCase();
    }
    else if (act === 'fitUse') S.room.use = S.room.seatsPerRow;
    else if (act === 'fitGaps') S.groups.forEach(function (g) { g.gap = 'seat'; });
    else if (act === 'fitSpare') S.spareOverflow = true;
    else if (act === 'save') { erSaveSession(); return; }
    else if (act === 'open') { erOpenSession(); return; }
    else if (act === 'print') {
      var d = erDocsFor(erBuildModel()).filter(function (x) { return x.key === t.getAttribute('data-doc'); })[0];
      if (d) printInHiddenFrame(d.html, function () { ER.notice = 'The print dialog could not open. Try "Download all" instead.'; erRender(); });
      return;
    }
    else if (act === 'planFile') {
      erDownload(erFileName(S, 'Exam Seating plan', 'json'), JSON.stringify(erPlanFile(S, erBuildModel(), erSaveState()), null, 1), 'application/json');
      return;
    }
    else if (act === 'downloadAll') { erDownloadAll(); return; }
    erRender();
    return;
  }
  // Seating chart: click one seat, then another.
  var cell = e.target.closest('.er-grid td[data-row]');
  if (cell) {
    var id = cell.getAttribute('data-id');
    if (ER.selected) erMoveTo(ER.selected, Number(cell.getAttribute('data-row')), Number(cell.getAttribute('data-seat')));
    else if (id) { ER.selected = id; erRender(); }
  }
}

function erInput(e) {
  var el = e.target;
  if (el.hasAttribute('data-bind')) {
    erSet(el.getAttribute('data-bind'), el.value);
    // Re-render only for things that change other parts of the step.
    if (e.type === 'change') erRender();
  } else if (el.hasAttribute('data-sea')) {
    ER.seaText = el.value;
    ER.S.seaRows = erParseSEA(el.value);   // reasons dropped here
    if (e.type === 'change') erRender();
  } else if (el.hasAttribute('data-match') && e.type === 'change') {
    var key = el.getAttribute('data-match');
    if (el.value === 'other') { ER.otherFor = key; delete ER.S.matchChoice[key]; }
    else if (el.value) { ER.S.matchChoice[key] = el.value; ER.otherFor = null; }
    else delete ER.S.matchChoice[key];
    erRender();
  } else if (el.hasAttribute('data-stay') && e.type === 'change') {
    if (el.checked) ER.S.seaStay[el.getAttribute('data-stay')] = true; else delete ER.S.seaStay[el.getAttribute('data-stay')];
    erRender();
  }
}

/* ---------- password ----------
   The code is public, so this is a lock on the door, not a safe: it keeps the
   tool from being opened by accident. It can never show anyone more than their
   own Compass login allows. Only a slow PBKDF2 fingerprint of the password is
   stored here, never the password. To change it, see SETUP_GUIDE.md. */
var ER_LOCK = { salt: 'b32245d605bc4efcb9a19a1699ddfaa5', iterations: 250000, hash: 'a63eb35210cfb4b266c4f85794db03f735f75779e87eb4c32a145f83c5a03ce4' };
var ER_UNLOCK_KEY = 'examRoomsUnlocked';

function erHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
function erUnhex(hex) { var a = new Uint8Array(hex.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16); return a; }

async function erCheckPassword(pw) {
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  var bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: erUnhex(ER_LOCK.salt), iterations: ER_LOCK.iterations }, key, 256);
  return erHex(bits) === ER_LOCK.hash;
}
function erUnlocked() { try { return sessionStorage.getItem(ER_UNLOCK_KEY) === ER_LOCK.hash; } catch (e) { return false; } }
function erRemember() { try { sessionStorage.setItem(ER_UNLOCK_KEY, ER_LOCK.hash); } catch (e) { /* asked again next time */ } }

function erShowLock(root, onOpen) {
  root.innerHTML = '<div class="er-card" style="inset:auto;left:50%;top:20vh;transform:translateX(-50%);width:min(420px,92vw)">' +
    '<div class="er-head"><strong>Exam Rooms</strong><button class="er-btn" data-lock="close">Close</button></div>' +
    '<form class="er-body" data-lock="form"><p>Exam Rooms is for exam coordinators. Enter the password to open it.</p>' +
    '<input type="password" data-lock="pw" autocomplete="off" style="width:100%" aria-label="Password">' +
    '<p class="er-bad" data-lock="msg" style="min-height:1.4em;margin:8px 0"></p>' +
    '<button class="er-btn pri" type="submit">Open</button></form></div>';
  var pw = root.querySelector('[data-lock="pw"]'), msg = root.querySelector('[data-lock="msg"]');
  pw.focus();
  root.querySelector('[data-lock="close"]').onclick = function () { root.remove(); };
  root.querySelector('[data-lock="form"]').onsubmit = async function (e) {
    e.preventDefault();
    msg.textContent = 'Checking…';
    var ok = false;
    try { ok = await erCheckPassword(pw.value); }
    catch (err) { msg.textContent = 'This browser could not check the password. Try Chrome or Edge.'; return; }
    if (!ok) { msg.textContent = 'That password is not right. Try again.'; pw.select(); return; }
    erRemember();
    onOpen();
  };
}

function erStart() {
  var existing = document.getElementById('er-root');
  if (existing) { existing.style.display = 'block'; return; }
  if (!erUnlocked()) {
    var lock = document.createElement('div');
    lock.id = 'er-root';
    if (!document.getElementById('er-style')) {
      var st = document.createElement('style'); st.id = 'er-style'; st.textContent = ER_CSS; document.head.appendChild(st);
    }
    document.body.appendChild(lock);
    erShowLock(lock, function () { lock.remove(); erStart(); });
    return;
  }
  if (!document.getElementById('er-style')) {
    var style = document.createElement('style');
    style.id = 'er-style';
    style.textContent = ER_CSS;
    document.head.appendChild(style);
  }
  var root = document.createElement('div');
  root.id = 'er-root';
  document.body.appendChild(root);
  ER.root = root;
  root.addEventListener('click', erHandle);
  root.addEventListener('input', erInput);
  root.addEventListener('change', erInput);
  root.addEventListener('dragstart', function (e) {
    var td = e.target.closest && e.target.closest('td[data-id]');
    if (!td) return;
    e.dataTransfer.setData('text/plain', td.getAttribute('data-id'));
    e.dataTransfer.effectAllowed = 'move';
  });
  root.addEventListener('dragover', function (e) {
    var td = e.target.closest && e.target.closest('.er-grid td[data-row]');
    if (td) { e.preventDefault(); td.classList.add('over'); }
  });
  root.addEventListener('dragleave', function (e) {
    var td = e.target.closest && e.target.closest('.er-grid td[data-row]');
    if (td) td.classList.remove('over');
  });
  root.addEventListener('drop', function (e) {
    var td = e.target.closest && e.target.closest('.er-grid td[data-row]');
    if (!td) return;
    e.preventDefault();
    var id = e.dataTransfer.getData('text/plain');
    if (id) erMoveTo(id, Number(td.getAttribute('data-row')), Number(td.getAttribute('data-seat')));
  });
  erRender();
}
