
/* ====================== VIEW: SESSIONS ======================== */
function viewSessions() {
  var cards = DB.sessions.map(function (s) {
    var isLoaded = s.loaded || !remote();
    var total = isLoaded ? s.students.length : '—';
    var seated = isLoaded ? s.students.filter(function (st) { return st.roomId && st.row; }).length : '—';
    var rooms = isLoaded ? s.rooms.length : '—';
    return '<div class="session-card ' + (s.id === DB.activeSessionId ? 'active' : '') + '" onclick="openSession(\'' + s.id + '\')">' +
      '<h3>' + esc(s.name) + '</h3>' +
      '<div class="sc-sub">' + esc(s.group || '') + (s.date ? ' &middot; ' + esc(s.date) : '') + '</div>' +
      '<div class="sc-stats"><span><b>' + total + '</b>Students</span><span><b>' + seated + '</b>Seated</span><span><b>' + rooms + '</b>Rooms</span></div>' +
      '<div class="sc-actions editor-only" onclick="event.stopPropagation()">' +
        '<button class="btn small secondary" onclick="editSessionModal(\'' + s.id + '\')">Edit</button>' +
        '<button class="btn small secondary" onclick="duplicateSession(\'' + s.id + '\')">Duplicate</button>' +
        '<button class="btn small danger" onclick="deleteSession(\'' + s.id + '\')">Delete</button>' +
      '</div></div>';
  }).join('');
  return '<div class="view-note">You are in <b>view-only mode</b> — browse, search and print everything you need. Nothing you click can change the data. Coordinators use "Editor sign in" (top right) to make changes.</div>' +
    '<div class="section-head"><div><h2>Exam Sessions</h2><p>Each session is one exam event with its own students, rooms and seating plan. Click a session to open it.</p></div>' +
    '<div class="toolbar"><button class="btn editor-only" onclick="newSessionModal()">+ New session</button>' +
    '<button class="btn secondary" onclick="savePlanFile()" title="Download every session as one file — a backup you can open on any computer">Save to file</button>' +
    '<button class="btn secondary editor-only" onclick="openPlanFile()" title="Load a plan saved with Save to file">Open file</button></div></div>' +
    (DB.sessions.length ? '<div class="session-grid">' + cards + '</div>'
      : '<div class="empty-msg">No exam sessions yet. Sign in as an editor and click "+ New session" to create the first one.</div>');
}

async function openSession(id) {
  DB.activeSessionId = id;
  lsSet(CONFIG.STORAGE_KEY + '_active', id);
  if (!remote()) { if (editor) markDirty(); }
  else {
    try { setSync('saving', 'Loading'); await ensureLoaded(id); setSync('ok', 'Synced'); }
    catch (e) { toast('Could not load that session: ' + e.message, true); }
  }
  go('students');
}

function timeFields(s) {
  var st = s ? s.settings : {};
  return '<div class="form-grid"><div class="form-row"><label>Start time (optional)</label><input type="time" id="f_start" value="' + esc(st.startTime || '') + '"></div>' +
    '<div class="form-row"><label>Finish time (optional)</label><input type="time" id="f_finish" value="' + esc(st.finishTime || '') + '"></div></div>';
}

function newSessionModal() {
  if (!editor) return;
  var tmplOpts = DB.templates.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + '</option>'; }).join('');
  openModal('New exam session',
    '<div class="form-row"><label>Session name</label><input type="text" id="f_name" placeholder="e.g. Semester 1 Exams 2027"></div>' +
    '<div class="form-grid"><div class="form-row"><label>Year group</label><input type="text" id="f_group" placeholder="e.g. Year 7"></div>' +
    '<div class="form-row"><label>Date</label><input type="date" id="f_date"></div></div>' +
    timeFields(null) +
    '<div class="form-row"><label>Start rooms from</label><select id="f_tmpl"><option value="">Blank (add rooms later)</option>' + tmplOpts + '</select></div>',
    [{ label: 'Create session', cls: 'btn', fn: async function () {
      var name = document.getElementById('f_name').value.trim();
      if (!name) { toast('Give the session a name', true); return; }
      var tmpl = DB.templates.find(function (t) { return t.id === document.getElementById('f_tmpl').value; });
      var s = {
        id: uid(), name: name,
        group: document.getElementById('f_group').value.trim(),
        date: document.getElementById('f_date').value,
        version: 1, loaded: true,
        rooms: tmpl ? JSON.parse(JSON.stringify(tmpl.rooms)).map(function (r) { r.id = uid(); return r; }) : [],
        students: [], settings: clone(cfg().seating)
      };
      s.settings.keepApart = [];
      s.settings.startTime = document.getElementById('f_start').value;
      s.settings.finishTime = document.getElementById('f_finish').value;
      migrateSession(s);
      if (remote()) {
        try {
          var out = await apiPost({ action: 'createSession', password: editorPassword, name: s.name, examDate: s.date, yearLevels: s.group,
                                    settingsJson: JSON.stringify(sessionSettingsForSave(s)) });
          if (!out.ok) throw new Error(out.error || 'create failed');
          s.id = out.session.sessionId; s.version = Number(out.session.version) || 1;
          DB.sessions.push(s); DB.activeSessionId = s.id;
          lsSet(CONFIG.STORAGE_KEY + '_active', s.id);
          if (s.rooms.length) await saveSessionNow(s);
        } catch (e) { toast('Could not create session: ' + e.message, true); return; }
      } else {
        DB.sessions.push(s); DB.activeSessionId = s.id; markDirty();
      }
      closeModal(); go('students');
      toast('Session created — now add students');
    } }]);
}

function editSessionModal(id) {
  if (!editor) return;
  var s = DB.sessions.find(function (x) { return x.id === id; });
  openModal('Edit session',
    '<div class="form-row"><label>Session name</label><input type="text" id="f_name" value="' + esc(s.name) + '"></div>' +
    '<div class="form-grid"><div class="form-row"><label>Year group</label><input type="text" id="f_group" value="' + esc(s.group || '') + '"></div>' +
    '<div class="form-row"><label>Date</label><input type="date" id="f_date" value="' + esc(s.date || '') + '"></div></div>' +
    timeFields(s),
    [{ label: 'Save', cls: 'btn', fn: async function () {
      var start = document.getElementById('f_start').value, finish = document.getElementById('f_finish').value;
      var timesChanged = start !== (s.settings.startTime || '') || finish !== (s.settings.finishTime || '');
      s.name = document.getElementById('f_name').value.trim() || s.name;
      s.group = document.getElementById('f_group').value.trim();
      s.date = document.getElementById('f_date').value;
      if (remote()) {
        try {
          var out = await apiPost({ action: 'updateSessionInfo', password: editorPassword, sessionId: s.id, name: s.name, yearLevels: s.group, examDate: s.date });
          if (!out.ok) throw new Error(out.error || 'update failed');
          if (timesChanged) {
            await ensureLoaded(s.id);
            s.settings.startTime = start; s.settings.finishTime = finish;
            await saveSessionNow(s);
          }
        } catch (e) { toast('Changes not saved: ' + e.message, true); }
      } else { s.settings.startTime = start; s.settings.finishTime = finish; markDirty(); }
      closeModal(); render();
    } }]);
}

async function duplicateSession(id) {
  if (!editor) return;
  var s = DB.sessions.find(function (x) { return x.id === id; });
  if (remote()) {
    try {
      await ensureLoaded(id);
      var out = await apiPost({ action: 'createSession', password: editorPassword, name: s.name + ' (copy)', examDate: s.date, yearLevels: s.group });
      if (!out.ok) throw new Error(out.error || 'create failed');
      var copy = JSON.parse(JSON.stringify(s));
      copy.id = out.session.sessionId; copy.name = s.name + ' (copy)';
      copy.version = Number(out.session.version) || 1; copy.loaded = true;
      DB.sessions.push(copy);
      await saveSessionNow(copy);
    } catch (e) { toast('Duplicate failed: ' + e.message, true); return; }
  } else {
    var c = JSON.parse(JSON.stringify(s));
    c.id = uid(); c.name = s.name + ' (copy)';
    DB.sessions.push(c); markDirty();
  }
  render();
  toast('Session duplicated');
}

function deleteSession(id) {
  if (!editor) return;
  var s = DB.sessions.find(function (x) { return x.id === id; });
  openModal('Delete session?',
    '<p>This permanently removes <b>' + esc(s.name) + '</b> including its students and seating plan. This cannot be undone.</p>',
    [{ label: 'Delete permanently', cls: 'btn danger', fn: async function () {
      if (remote()) {
        try {
          var out = await apiPost({ action: 'deleteSession', password: editorPassword, sessionId: id });
          if (!out.ok) throw new Error(out.error || 'delete failed');
        } catch (e) { toast('Delete failed: ' + e.message, true); return; }
      }
      DB.sessions = DB.sessions.filter(function (x) { return x.id !== id; });
      if (DB.activeSessionId === id) DB.activeSessionId = DB.sessions.length ? DB.sessions[0].id : null;
      if (!remote()) markDirty();
      closeModal(); render();
    } }]);
}

/* ====================== VIEW: STUDENTS ======================== */
function roomName(s, roomId) { var r = s.rooms.find(function (x) { return x.id === roomId; }); return r ? r.name : '—'; }
/* CSS class for a status's room purpose: built-in purposes are styled (special, withdrawn). */
function pillClass(status) { return statusPurpose(status) || 'none'; }
/* "GYM · Row 3 · Seat 7" with the room's own row/seat labels. */
function locText(s, st, empty) {
  var r = s.rooms.find(function (x) { return x.id === st.roomId; });
  if (!r) return empty === undefined ? '—' : empty;
  if (st.row) return esc(r.name) + ' &middot; Row ' + esc(rowLabel(r, st.row)) + ' &middot; Seat ' + esc(seatLabel(r, st.seat));
  return esc(r.name);
}

function viewStudents() {
  var s = session();
  if (!s) return noSessionMsg();
  var q = studentFilter.q.toLowerCase();
  var list = s.students.slice().sort(byName);
  if (q) list = list.filter(function (st) { return (st.first + ' ' + st.last + ' ' + (st.klass || '')).toLowerCase().indexOf(q) >= 0; });
  if (studentFilter.status !== 'all') list = list.filter(function (st) { return st.status === studentFilter.status; });
  var rows = list.map(function (st) {
    var extra = (st.arrangements ? '<div class="t-extra">' + esc(st.arrangements) + '</div>' : '');
    return '<tr><td class="t-last">' + esc(st.last) + '</td><td>' + esc(st.first) + extra + '</td><td>' + esc(st.klass || '') + '</td>' +
      '<td>' + pillHTML(st.status) + '</td><td>' + locText(s, st) + '</td>' +
      '<td class="editor-only" style="white-space:nowrap"><button class="btn small secondary" onclick="studentModal(\'' + st.id + '\')">Edit</button> ' +
      '<button class="btn small danger" onclick="deleteStudent(\'' + st.id + '\')">&#10005;</button></td></tr>';
  }).join('');
  var statusOpts = '<option value="all"' + (studentFilter.status === 'all' ? ' selected' : '') + '>All statuses</option>' +
    statusList().map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (studentFilter.status === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>';
    }).join('');
  return '<div class="view-note">View-only mode — browse and search freely; nothing can be changed.</div>' +
    '<div class="section-head"><div><h2>Students — ' + esc(s.name) + '</h2><p>The master list for this session. Import from Excel or CSV, or add students one at a time. Change a status here and the seating plan updates automatically.</p></div>' +
    '<div class="toolbar editor-only"><button class="btn" onclick="startImport()">Import Excel / CSV</button>' +
    '<button class="btn secondary" onclick="studentModal()">+ Add student</button>' +
    '<button class="btn secondary" onclick="exportCSV()">Export CSV</button></div></div>' +
    '<div class="filter-bar"><input type="text" placeholder="Filter by name or class" value="' + esc(studentFilter.q) + '" oninput="studentFilter.q=this.value;render()">' +
    '<select onchange="studentFilter.status=this.value;render()">' + statusOpts + '</select>' +
    '<span class="muted">' + list.length + ' of ' + s.students.length + ' students</span></div>' +
    (s.students.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Surname</th><th>First name</th><th>Class</th><th>Status</th><th>Seat</th><th class="editor-only"></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="empty-msg">No students yet.<br><br>Editors: click <b>Import Excel / CSV</b> to load a class list, or <b>+ Add student</b> to type one in.</div>');
}

function studentModal(id) {
  if (!editor) return;
  var s = session();
  var st = id ? s.students.find(function (x) { return x.id === id; }) : null;
  var statusOpts = statusList().map(function (x) {
    return '<option value="' + esc(x.id) + '"' + (st && st.status === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>';
  }).join('');
  if (st && !statusById(st.status)) statusOpts += '<option value="' + esc(st.status) + '" selected>' + esc(st.status) + ' (no longer in Settings)</option>';
  openModal(st ? 'Edit student' : 'Add student',
    '<div class="form-grid"><div class="form-row"><label>First name</label><input type="text" id="f_first" value="' + (st ? esc(st.first) : '') + '"></div>' +
    '<div class="form-row"><label>Surname</label><input type="text" id="f_last" value="' + (st ? esc(st.last) : '') + '"></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Class / homegroup</label><input type="text" id="f_klass" value="' + (st ? esc(st.klass || '') : '') + '"></div>' +
    '<div class="form-row"><label>Status</label><select id="f_status">' + statusOpts + '</select></div></div>' +
    '<div class="form-row"><label>Special arrangements (optional)</label><textarea id="f_arr" rows="2" placeholder="e.g. Reader, extra time 25%, rest breaks">' + (st ? esc(st.arrangements || '') : '') + '</textarea></div>' +
    '<div class="form-row"><label>Notes (optional)</label><textarea id="f_notes" rows="2">' + (st ? esc(st.notes || '') : '') + '</textarea></div>' +
    '<p class="muted">Changing status releases the student\'s seat and moves them to the room for their new status.</p>',
    [{ label: st ? 'Save changes' : 'Add student', cls: 'btn', fn: function () {
      var first = document.getElementById('f_first').value.trim();
      var last = document.getElementById('f_last').value.trim();
      if (!first && !last) { toast('Enter a name', true); return; }
      var status = document.getElementById('f_status').value;
      var klass = document.getElementById('f_klass').value.trim();
      var arr = document.getElementById('f_arr').value.trim(), notes = document.getElementById('f_notes').value.trim();
      if (st) {
        st.first = first; st.last = last; st.klass = klass; st.arrangements = arr; st.notes = notes;
        if (st.status !== status) { st.status = status; routeStudent(s, st); }
      } else {
        var ns = { id: uid(), first: first, last: last, klass: klass, status: status, roomId: null, row: null, seat: null, arrangements: arr, notes: notes };
        routeStudent(s, ns);
        s.students.push(ns);
      }
      markDirty(); closeModal(); render();
    } }]);
}

/* THE single place that decides placement from status (see CLAUDE.md).
   Clears any seat. A status whose room purpose is a seat grid waits for
   Generate seating or a manual move; a list purpose goes straight to the
   first room with that purpose. Rules come from Settings → Statuses. */
function routeStudent(s, st) {
  st.row = null; st.seat = null; st.roomId = null;
  var pid = statusPurpose(st.status);
  if (!pid || purposeById(pid).layout === 'seated') return;
  var r = s.rooms.find(function (x) { return x.purpose === pid; });
  if (r) st.roomId = r.id;
}

function deleteStudent(id) {
  if (!editor) return;
  var s = session();
  var st = s.students.find(function (x) { return x.id === id; });
  openModal('Remove student?', '<p>Remove <b>' + esc(st.first) + ' ' + esc(st.last) + '</b> from this session?</p>',
    [{ label: 'Remove', cls: 'btn danger', fn: function () {
      s.students = s.students.filter(function (x) { return x.id !== id; });
      s.settings.keepApart = s.settings.keepApart.filter(function (p) { return p[0] !== id && p[1] !== id; });
      markDirty(); closeModal(); render();
    } }]);
}

function exportCSV() {
  if (!editor) return;
  var s = session();
  var lines = [['First', 'Surname', 'Class', 'Status', 'Room', 'Row', 'Seat', 'Arrangements', 'Notes'].join(',')];
  s.students.slice().sort(byName).forEach(function (st) {
    var r = s.rooms.find(function (x) { return x.id === st.roomId; });
    lines.push([st.first, st.last, st.klass || '', statusLabel(st.status), roomName(s, st.roomId),
                st.row && r ? rowLabel(r, st.row) : '', st.seat && r ? seatLabel(r, st.seat) : '', st.arrangements || '', st.notes || '']
      .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });
  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = s.name.replace(/[^a-z0-9]+/gi, '_') + '_students.csv';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

/* ==================== IMPORT (Excel / CSV) ==================== */
function startImport() {
  if (!editor) return;
  var inp = document.getElementById('fileInput');
  inp.value = '';
  inp.onchange = function () { if (inp.files[0]) readImportFile(inp.files[0]); };
  inp.click();
}

function readImportFile(file) {
  if (typeof XLSX === 'undefined') {
    toast('The spreadsheet reader did not load. Check your internet connection and refresh the page.', true);
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      var cleaned = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
      if (cleaned.length < 2) { toast('That file looks empty', true); return; }
      importRows = cleaned;
      showMappingModal();
    } catch (err) { toast('Could not read that file: ' + err.message, true); }
  };
  reader.readAsArrayBuffer(file);
}

function guessCol(headers, keys) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase();
    for (var j = 0; j < keys.length; j++) if (h.indexOf(keys[j]) >= 0) return i;
  }
  return -1;
}

function showMappingModal() {
  var headers = importRows[0].map(function (h) { return String(h); });
  function opts(i) {
    return '<option value="-1">— not in file —</option>' + headers.map(function (h, j) {
      return '<option value="' + j + '"' + (j === i ? ' selected' : '') + '>' + esc(h) + '</option>';
    }).join('');
  }
  var preview = importRows.slice(1, 4).map(function (r) {
    return '<tr>' + r.slice(0, 6).map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
  }).join('');
  openModal('Match your columns',
    '<p class="muted" style="margin-bottom:12px">Found <b>' + (importRows.length - 1) + '</b> rows. Tell the app which column holds what — it has guessed where it can.</p>' +
    '<div class="form-grid"><div class="form-row"><label>First name column</label><select id="m_first">' + opts(guessCol(headers, ['first', 'given'])) + '</select></div>' +
    '<div class="form-row"><label>Surname column</label><select id="m_last">' + opts(guessCol(headers, ['surname', 'last', 'family'])) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Class / homegroup</label><select id="m_klass">' + opts(guessCol(headers, ['class', 'homegroup', 'home group', 'form', 'hg'])) + '</select></div>' +
    '<div class="form-row"><label>Status (optional)</label><select id="m_status">' + opts(guessCol(headers, ['status', 'provision'])) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Arrangements (optional)</label><select id="m_arr">' + opts(guessCol(headers, ['arrangement', 'adjustment'])) + '</select></div>' +
    '<div class="form-row"><label>Notes (optional)</label><select id="m_notes">' + opts(guessCol(headers, ['note', 'comment'])) + '</select></div></div>' +
    '<div class="form-row"><label>How to add these students</label><select id="m_mode"><option value="replace">Replace the current student list</option><option value="append">Add to the current student list</option></select></div>' +
    '<label>File preview (first rows)</label><div class="table-wrap" style="max-height:130px"><table class="data"><tbody>' + preview + '</tbody></table></div>',
    [{ label: 'Import students', cls: 'btn', fn: doImport }], true);
}

/* Match a spreadsheet status cell to a status: its label, or any of its
   import keywords (Settings → Statuses). The first status is the default. */
function matchImportStatus(raw) {
  raw = String(raw || '').toLowerCase().trim();
  var list = statusList();
  if (!raw) return list[0].id;
  for (var i = 1; i < list.length + 1; i++) {
    var x = list[i % list.length];
    var keys = String(x.keywords || '').split(',').map(function (k) { return k.trim().toLowerCase(); }).filter(Boolean);
    keys.push(String(x.label).toLowerCase());
    for (var j = 0; j < keys.length; j++) if (raw.indexOf(keys[j]) >= 0) return x.id;
  }
  return list[0].id;
}

function doImport() {
  if (!editor) return;
  var s = session();
  function ci(id) { return parseInt(document.getElementById(id).value, 10); }
  var cFirst = ci('m_first'), cLast = ci('m_last'), cKlass = ci('m_klass'), cStatus = ci('m_status'), cArr = ci('m_arr'), cNotes = ci('m_notes');
  if (cFirst < 0 && cLast < 0) { toast('Pick at least a name column', true); return; }
  var mode = document.getElementById('m_mode').value;
  var incoming = [];
  var skipped = 0;
  importRows.slice(1).forEach(function (r) {
    var first = cFirst >= 0 ? String(r[cFirst]).trim() : '';
    var last = cLast >= 0 ? String(r[cLast]).trim() : '';
    // A real student always has a surname. Rows without one are almost always
    // spreadsheet totals ("Mean", "Median", "Standard Deviation") or blank
    // filler, so they are skipped rather than imported as students.
    if (cLast >= 0 ? !last : !first) { if (first || last) skipped++; return; }
    if (!first && !last) return;
    var status = cStatus >= 0 ? matchImportStatus(r[cStatus]) : defaultStatusId();
    var st = { id: uid(), first: first, last: last, klass: cKlass >= 0 ? String(r[cKlass]).trim() : '', status: status, roomId: null, row: null, seat: null,
               arrangements: cArr >= 0 ? String(r[cArr]).trim() : '', notes: cNotes >= 0 ? String(r[cNotes]).trim() : '' };
    routeStudent(s, st);
    incoming.push(st);
  });
  if (mode === 'replace') { s.students = incoming; s.settings.keepApart = []; }
  else s.students = s.students.concat(incoming);
  markDirty(); closeModal(); render();
  toast(incoming.length + ' students imported' +
    (skipped ? ', ' + skipped + ' non-student row' + (skipped > 1 ? 's' : '') + ' skipped (no surname)' : '') +
    ' — go to Seating Plan and click Generate');
}
