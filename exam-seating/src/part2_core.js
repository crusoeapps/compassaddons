'use strict';
/* ================================================================
   CONFIG — the only section a maintainer ever edits.
   API_URL: paste the Google Apps Script web-app URL here after
   completing SETUP_GUIDE.md. Leave it blank to run in local mode
   (data stays in this browser only — good for testing).
   PRIVACY: never set API_URL in a copy hosted on a PUBLIC website
   (such as the compassaddons GitHub Pages site). Reading from the
   backend needs no password, so anyone who opens that page could
   read every student's name. Host a shared-mode copy privately.
   ================================================================ */
var CONFIG = {
  API_URL: '',
  LOCAL_EDITOR_PASSWORD: 'crusoe2026',
  STORAGE_KEY: 'crusoe_exam_seating_v1'
};

/* ============================ STATE ============================ */
var DB = null;
var editor = false;
var editorPassword = '';
var activeTab = 'sessions';
var saveTimer = null;
var selectedSeat = null;
var seatingRoomFilter = 'all';
var studentFilter = { q: '', status: 'all' };
var importRows = null;
var settingsDraft = null;   // working copy while the Settings tab is open

var backendHasSettings = true;   // false when the Apps Script backend predates the Settings tab

/* ====================== DEFAULT SETTINGS ======================
   Everything a coordinator can change on the Settings tab. These
   defaults reproduce the app's original behaviour exactly, so data
   saved before settings existed looks and seats the same.
   Status ids for the four built-in statuses are the original
   strings ('Completing' etc.) so existing student rows need no
   rewriting; renaming a status only changes its label.
   ================================================================ */
var DEFAULT_ACCENT = '#0d5c2e';
var DEFAULT_CONFIG = {
  school: { name: 'Crusoe College', tagline: 'Shared seating & supervision plans', accent: DEFAULT_ACCENT, logo: '' },
  purposes: [
    { id: 'main', label: 'Main exam room', layout: 'seated', printTitle: '' },
    { id: 'special', label: 'Special provisions', layout: 'list', printTitle: 'Special Exam Arrangements',
      printCard: 'Special exam arrangements', printDesc: 'All special-provision students and where they sit.', printBtn: 'Print arrangements' },
    { id: 'withdrawn', label: 'Withdrawn / exemptions', layout: 'list', printTitle: 'Withdrawals and Exemptions',
      printCard: 'Withdrawals & exemptions', printDesc: 'Students not completing this exam, for the front office.', printBtn: 'Print list' }
  ],
  statuses: [
    { id: 'Completing', label: 'Completing', purpose: 'main', color: '#1a5c22', keywords: '' },
    { id: 'Special Provision', label: 'Special Provision', purpose: 'special', color: '#5a3a8a', keywords: 'special' },
    { id: 'Withdrawn', label: 'Withdrawn', purpose: 'withdrawn', color: '#b83232', keywords: 'withdraw' },
    { id: 'Exemption', label: 'Exemption', purpose: 'withdrawn', color: '#b83232', keywords: 'exempt' }
  ],
  seating: { sortBy: 'surname', pattern: 'all', rowDir: 'front', seatDir: 'ltr', near: 'cross' },
  print: { gridOrientation: 'landscape', listOrientation: 'portrait',
           masterCols: ['student', 'klass', 'status', 'location'], listCols: ['student', 'klass', 'status', 'room'],
           showSupervisor: true, showTimes: true, instructions: '' }
};
var DEFAULT_ROOM_LAYOUT = { rowLabels: 'number', rowFrom: 'start', seatLabels: 'number', seatFrom: 'start', blocked: {}, supervisor: '' };

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function isPlainObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
/* Fill any key missing from target with a copy of the default. Never overwrites. */
function fillDefaults(target, defaults) {
  Object.keys(defaults).forEach(function (k) {
    if (target[k] === undefined || target[k] === null) target[k] = clone(defaults[k]);
    else if (isPlainObj(target[k]) && isPlainObj(defaults[k])) fillDefaults(target[k], defaults[k]);
  });
  return target;
}
function isHex(c) { return /^#[0-9a-f]{6}$/i.test(String(c || '')); }
function safeJSON(str, fallback) { if (!str) return fallback; try { return JSON.parse(str); } catch (e) { return fallback; } }

/* ---- settings lookups ---- */
function cfg() { return DB.config; }
function statusList() { return cfg().statuses; }
function statusById(id) { return statusList().find(function (x) { return x.id === id; }) || null; }
function statusLabel(id) { var x = statusById(id); return x ? x.label : String(id || ''); }
function defaultStatusId() { return statusList()[0].id; }
function purposeById(id) {
  return cfg().purposes.find(function (p) { return p.id === id; }) || { id: id, label: String(id || 'Unknown'), layout: 'list', printTitle: '' };
}
function purposeLabel(id) { return purposeById(id).label; }
function statusPurpose(id) { var x = statusById(id); return x ? x.purpose : null; }
/* True when students with this status are placed in a seat grid (not on a list). */
function isSeatedStatus(id) { var p = statusPurpose(id); return !!p && purposeById(p).layout === 'seated'; }
function statusColor(id) { var x = statusById(id); return x && isHex(x.color) ? x.color : '#6b7a99'; }
function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function pillHTML(id) {
  var c = statusColor(id), rgb = hexToRgb(c);
  return '<span class="pill" style="background:rgba(' + rgb.join(',') + ',0.12);color:' + c + '">' + esc(statusLabel(id)) + '</span>';
}

/* ---- room labels: positions are stored as numbers; labels are display only ---- */
function letters(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function lineLabel(n, total, style, from) {
  var k = from === 'end' ? total - n + 1 : n;
  return style === 'letter' ? letters(k) : String(k);
}
function rowLabel(r, n) { var L = r.layout || DEFAULT_ROOM_LAYOUT; return lineLabel(n, r.rows, L.rowLabels, L.rowFrom); }
function seatLabel(r, n) { var L = r.layout || DEFAULT_ROOM_LAYOUT; return lineLabel(n, r.seatsPerRow, L.seatLabels, L.seatFrom); }
function seatBlocked(r, row, seat) { return !!(r.layout && r.layout.blocked && r.layout.blocked[row + '_' + seat]); }
function usableSeats(r) {
  var n = 0;
  for (var row = 1; row <= r.rows; row++) for (var seat = 1; seat <= r.seatsPerRow; seat++) if (!seatBlocked(r, row, seat)) n++;
  return n;
}

/* ============================ MIGRATION ============================
   Runs on every load and is idempotent: brings data saved by any
   earlier version up to the current shape without changing what it
   means. Missing settings take the original behaviour.
   ================================================================ */
function migrateConfig(c) {
  c = isPlainObj(c) ? c : {};
  fillDefaults(c, DEFAULT_CONFIG);
  if (!Array.isArray(c.statuses) || !c.statuses.length) c.statuses = clone(DEFAULT_CONFIG.statuses);
  if (!Array.isArray(c.purposes) || !c.purposes.length) c.purposes = clone(DEFAULT_CONFIG.purposes);
  if (!Array.isArray(c.print.masterCols)) c.print.masterCols = clone(DEFAULT_CONFIG.print.masterCols);
  if (!Array.isArray(c.print.listCols)) c.print.listCols = clone(DEFAULT_CONFIG.print.listCols);
  if (!isHex(c.school.accent)) c.school.accent = DEFAULT_ACCENT;
  return c;
}
function migrateRoom(r) {
  r.layout = isPlainObj(r.layout) ? r.layout : {};
  fillDefaults(r.layout, DEFAULT_ROOM_LAYOUT);
  if (!isPlainObj(r.layout.blocked)) r.layout.blocked = {};
  // List rooms never had a size; give one in case their type becomes a seat grid.
  if (!(Number(r.rows) > 0)) r.rows = 12;
  if (!(Number(r.seatsPerRow) > 0)) r.seatsPerRow = 18;
  return r;
}
function migrateSession(s) {
  s.settings = isPlainObj(s.settings) ? s.settings : {};
  if (!Array.isArray(s.settings.keepApart)) s.settings.keepApart = [];
  // Older sessions get the original rules, not whatever the school default is now.
  fillDefaults(s.settings, DEFAULT_CONFIG.seating);
  fillDefaults(s.settings, { shuffleSeed: 1, startTime: '', finishTime: '' });
  (s.rooms || []).forEach(migrateRoom);
  (s.students || []).forEach(function (st) {
    if (st.arrangements == null) st.arrangements = '';
    if (st.notes == null) st.notes = '';
  });
  normaliseSession(s);
  return s;
}
/* Keep rooms and placements consistent with the current room-purpose settings. */
function normaliseSession(s) {
  if (!DB || !DB.config) return;
  (s.rooms || []).forEach(function (r) { r.kind = purposeById(r.purpose).layout === 'seated' ? 'seated' : 'list'; });
  (s.students || []).forEach(function (st) {
    if (!st.roomId) return;
    var r = s.rooms.find(function (x) { return x.id === st.roomId; });
    if (!r) { st.roomId = null; st.row = null; st.seat = null; return; }
    if (r.kind !== 'seated' && st.row) { st.row = null; st.seat = null; }
  });
}
function migrateDB(db) {
  db.config = migrateConfig(db.config);
  db.sessions = db.sessions || [];
  db.templates = db.templates || [];
  db.templates.forEach(function (t) { (t.rooms || []).forEach(migrateRoom); });
  var prev = DB; DB = db;           // helpers read DB.config
  db.sessions.forEach(migrateSession);
  DB = prev;
  return db;
}
/* The per-session settings that travel in the Sessions tab's settingsJson column.
   Keep-apart pairs travel separately in the Separations tab. */
function sessionSettingsForSave(s) {
  var o = {};
  Object.keys(s.settings).forEach(function (k) { if (k !== 'keepApart') o[k] = s.settings[k]; });
  return o;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
function byName(a, b) { return (a.last + a.first).localeCompare(b.last + b.first); }
function session() { return DB.sessions.find(function (s) { return s.id === DB.activeSessionId; }) || null; }
function remote() { return !!CONFIG.API_URL; }

function toast(msg, isErr) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isErr ? 'show err' : 'show';
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.className = ''; }, 3200);
}

/* ==================== STORAGE & SYNC LAYER ==================== */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

function setSync(state, text) {
  document.getElementById('syncPill').className = 'sync-pill ' + state;
  document.getElementById('syncText').textContent = text;
}

async function apiPost(payload) {
  var res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Network error ' + res.status);
  return await res.json();
}

async function apiGet(params) {
  var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  var res = await fetch(CONFIG.API_URL + '?' + qs);
  if (!res.ok) throw new Error('Network error ' + res.status);
  return await res.json();
}

/* ---- mapping between the app model and the backend sheet rows ---- */
function roomToRow(sid, r, i) {
  return { sessionId: sid, roomId: r.id, name: r.name, layoutType: r.kind + ':' + r.purpose,
           rows: r.rows || '', seatsPerRow: r.seatsPerRow || '', color: '', sortOrder: i,
           layoutJson: JSON.stringify(r.layout || {}) };
}
function rowToRoom(x) {
  var lt = String(x.layoutType || 'seated:main').split(':');
  return migrateRoom({ id: String(x.roomId), name: String(x.name || ''), kind: lt[0] === 'list' ? 'list' : 'seated',
           purpose: lt[1] || 'main', rows: Number(x.rows) || 12, seatsPerRow: Number(x.seatsPerRow) || 18,
           layout: safeJSON(x.layoutJson, {}) });
}
function studentToRow(sid, st) {
  return { sessionId: sid, studentId: st.id, firstName: st.first, lastName: st.last, homegroup: st.klass || '',
           status: st.status, room: st.roomId || '', row: st.row || '', seat: st.seat || '',
           arrangements: st.arrangements || '', notes: st.notes || '' };
}
function rowToStudent(x) {
  return { id: String(x.studentId), first: String(x.firstName || ''), last: String(x.lastName || ''),
           klass: String(x.homegroup || ''), status: String(x.status || 'Completing'),
           roomId: String(x.room || '') || null, row: Number(x.row) || null, seat: Number(x.seat) || null,
           arrangements: String(x.arrangements || ''), notes: String(x.notes || '') };
}
function sessionShell(s) {
  var settings = safeJSON(s.settingsJson, {});
  if (!isPlainObj(settings)) settings = {};
  settings.keepApart = [];
  return { id: s.sessionId, name: s.name, group: s.yearLevels || '', date: s.examDate || '',
           version: Number(s.version) || 1, loaded: false, rooms: [], students: [], settings: settings };
}

/* Fetch the school-wide settings. An old backend has no getSettings action:
   fall back to defaults and say so on the Settings tab instead of failing. */
async function fetchSettings() {
  var out;
  try { out = await apiGet({ action: 'getSettings' }); }
  catch (e) { out = { ok: false }; }
  if (!out.ok) { backendHasSettings = false; DB.configVersion = 0; DB.config = migrateConfig({}); return; }
  backendHasSettings = true;
  DB.configVersion = Number(out.version) || 0;
  DB.config = migrateConfig(safeJSON(out.valueJson, {}));
}

async function loadDB() {
  if (remote()) {
    setSync('saving', 'Loading');
    try {
      var both = await Promise.all([apiGet({ action: 'listSessions' }), apiGet({ action: 'listTemplates' })]);
      var ls = both[0], lt = both[1];
      if (!ls.ok) throw new Error(ls.error || 'load failed');
      DB = {
        version: 1,
        sessions: (ls.sessions || []).map(sessionShell),
        templates: (lt.ok ? lt.templates : []).map(function (t) { return { id: t.templateId, name: t.name, rooms: t.rooms || [] }; }),
        activeSessionId: lsGet(CONFIG.STORAGE_KEY + '_active')
      };
      await fetchSettings();
      migrateDB(DB);
      if (!DB.sessions.find(function (s) { return s.id === DB.activeSessionId; })) {
        DB.activeSessionId = DB.sessions.length ? DB.sessions[0].id : null;
      }
      if (DB.activeSessionId) await ensureLoaded(DB.activeSessionId);
      setSync('ok', 'Synced');
      return;
    } catch (e) {
      setSync('err', 'Offline');
      toast('Could not reach the shared data: ' + e.message + ' — check your internet, then refresh', true);
      DB = migrateDB({ version: 1, sessions: [], templates: [], activeSessionId: null });
      return;
    }
  }
  var raw = lsGet(CONFIG.STORAGE_KEY);
  if (raw) { try { DB = JSON.parse(raw); } catch (e) { DB = null; } }
  if (!DB || !DB.sessions) DB = buildSeedDB();
  migrateDB(DB);
  setSync('local', 'Local mode');
}

async function ensureLoaded(id) {
  var s = DB.sessions.find(function (x) { return x.id === id; });
  if (!s || s.loaded || !remote()) return;
  var out = await apiGet({ action: 'getSession', sessionId: id });
  if (!out.ok) throw new Error(out.error || 'session load failed');
  s.rooms = (out.rooms || []).sort(function (a, b) { return Number(a.sortOrder) - Number(b.sortOrder); }).map(rowToRoom);
  s.students = (out.students || []).map(rowToStudent);
  var saved = safeJSON(out.session.settingsJson, null);
  if (isPlainObj(saved)) Object.keys(saved).forEach(function (k) { if (k !== 'keepApart') s.settings[k] = saved[k]; });
  s.settings.keepApart = (out.separations || []).map(function (p) {
    var pair = [String(p.studentIdA), String(p.studentIdB)];
    if (p.reason) pair.push(String(p.reason));
    return pair;
  });
  s.version = Number(out.session.version) || s.version;
  s.loaded = true;
  migrateSession(s);
}

/* Load every session (remote mode loads lazily). Used before checks that
   must see all data, such as deleting a status that might still be in use. */
async function ensureAllLoaded() {
  for (var i = 0; i < DB.sessions.length; i++) await ensureLoaded(DB.sessions[i].id);
}

function markDirty() {
  if (!editor) return;
  if (!remote()) { lsSet(CONFIG.STORAGE_KEY, JSON.stringify(DB)); return; }
  setSync('saving', 'Saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { var s = session(); if (s) saveSessionNow(s); }, 1200);
}

async function saveSessionNow(s) {
  try {
    var out = await apiPost({
      action: 'saveSessionData', password: editorPassword,
      sessionId: s.id, version: s.version,
      settingsJson: JSON.stringify(sessionSettingsForSave(s)),
      students: s.students.map(function (st) { return studentToRow(s.id, st); }),
      rooms: s.rooms.map(function (r, i) { return roomToRow(s.id, r, i); }),
      separations: s.settings.keepApart.map(function (p) { return { sessionId: s.id, studentIdA: p[0], studentIdB: p[1], reason: p[2] || '' }; })
    });
    if (out.ok) { s.version = out.version; setSync('ok', 'Synced'); return true; }
    if (out.error === 'VERSION_CONFLICT') { setSync('err', 'Conflict'); conflictModal(s); return false; }
    throw new Error(out.error || 'Save rejected');
  } catch (e) {
    setSync('err', 'Save failed');
    toast('Save failed: ' + e.message + ' — check your connection and make the change again', true);
    return false;
  }
}

/* Save the school-wide settings. Same optimistic-concurrency rule as sessions:
   send the version we loaded; a stale save is refused, never overwritten. */
async function saveConfigNow() {
  if (!editor) return false;
  if (!remote()) { lsSet(CONFIG.STORAGE_KEY, JSON.stringify(DB)); return true; }
  if (!backendHasSettings) {
    toast('Settings cannot be shared yet: the Google Sheet backend needs a one-off update (see SETUP_GUIDE.md, "Updating an existing install").', true);
    return false;
  }
  setSync('saving', 'Saving');
  try {
    var out = await apiPost({ action: 'saveSettings', password: editorPassword, version: DB.configVersion, valueJson: JSON.stringify(DB.config) });
    if (out.ok) { DB.configVersion = out.version; setSync('ok', 'Synced'); return true; }
    if (out.error === 'VERSION_CONFLICT') { setSync('err', 'Conflict'); settingsConflictModal(); return false; }
    if (out.error === 'SETTINGS_TOO_LARGE') throw new Error('the settings are too big to store — try a smaller logo');
    throw new Error(out.error || 'Save rejected');
  } catch (e) {
    setSync('err', 'Save failed');
    toast('Settings not saved: ' + e.message + ' — check your connection and try again', true);
    return false;
  }
}

function settingsConflictModal() {
  openModal('Someone else changed the settings',
    '<p>Another editor saved the school settings after you loaded them. To protect their work, your settings changes were <b>not</b> saved.</p><p style="margin-top:8px">Reload to get their version, then make your change again.</p>',
    [{ label: 'Reload latest', cls: 'btn', fn: async function () {
      try { await fetchSettings(); DB.sessions.forEach(normaliseSession); setSync('ok', 'Synced'); }
      catch (e) { toast('Reload failed: ' + e.message, true); }
      settingsDraft = null; applyBranding(); closeModal(); render();
    } }]);
}

function conflictModal(s) {
  openModal('Someone else saved first',
    '<p>Another editor saved changes to <b>' + esc(s.name) + '</b> after you loaded it. To protect their work, your last change was <b>not</b> saved.</p><p style="margin-top:8px">Reload to get the latest plan, then redo your change.</p>',
    [{ label: 'Reload latest', cls: 'btn', fn: async function () {
      s.loaded = false;
      try { await ensureLoaded(s.id); setSync('ok', 'Synced'); }
      catch (e) { toast('Reload failed: ' + e.message, true); }
      closeModal(); render();
    } }]);
}

/* ========================= EDITOR MODE ========================= */
function toggleEditor() {
  if (editor) {
    editor = false; editorPassword = ''; selectedSeat = null;
    document.body.classList.remove('is-editor');
    document.getElementById('editorBtn').textContent = 'Editor sign in';
    settingsDraft = null;
    if (activeTab === 'rooms' || activeTab === 'settings') activeTab = 'seating';
    render();
    toast('Now in view-only mode');
    return;
  }
  openModal('Editor sign in',
    '<p class="muted" style="margin-bottom:12px">Editing is limited to exam coordinators. Enter the editor password to unlock changes — everyone else can view and print without signing in.</p>' +
    '<div class="form-row"><label>Editor password</label><input type="password" id="pwInput" autocomplete="off"></div>',
    [{ label: 'Sign in', cls: 'btn', fn: attemptSignIn }]);
  setTimeout(function () {
    var el = document.getElementById('pwInput');
    if (el) { el.focus(); el.onkeydown = function (e) { if (e.key === 'Enter') attemptSignIn(); }; }
  }, 60);
}

async function attemptSignIn() {
  var el = document.getElementById('pwInput');
  var pw = el ? el.value : '';
  if (remote()) {
    try {
      var out = await apiPost({ action: 'checkPassword', password: pw });
      if (!out.ok) { toast('Wrong password', true); return; }
    } catch (e) { toast('Could not verify — check your connection', true); return; }
  } else if (pw !== CONFIG.LOCAL_EDITOR_PASSWORD) {
    toast('Wrong password', true); return;
  }
  editorPassword = pw; editor = true;
  document.body.classList.add('is-editor');
  document.getElementById('editorBtn').textContent = 'Sign out (editing)';
  closeModal(); render();
  toast('Editing unlocked');
}

/* =========================== MODAL ============================ */
function openModal(title, bodyHTML, buttons, wide) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBox').className = wide ? 'modal wide' : 'modal';
  var foot = document.getElementById('modalFoot');
  foot.innerHTML = '';
  var cancel = document.createElement('button');
  cancel.className = 'btn secondary'; cancel.textContent = 'Cancel'; cancel.onclick = closeModal;
  foot.appendChild(cancel);
  (buttons || []).forEach(function (b) {
    var btn = document.createElement('button');
    btn.className = b.cls || 'btn'; btn.textContent = b.label; btn.onclick = b.fn;
    foot.appendChild(btn);
  });
  document.getElementById('modalBack').classList.add('open');
}
function closeModal() { document.getElementById('modalBack').classList.remove('open'); }

/* ========================= NAVIGATION ========================= */
var EDITOR_TABS = { rooms: 1, settings: 1 };
function go(tab) {
  if (EDITOR_TABS[tab] && !editor) return;
  activeTab = tab;
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
  render();
  window.scrollTo(0, 0);
}

function render() {
  var s = session();
  document.getElementById('sessionBadge').textContent = s ? s.name : 'No session';
  document.querySelectorAll('nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === activeTab); });
  if (EDITOR_TABS[activeTab] && !editor) activeTab = 'seating';
  var views = { sessions: viewSessions, students: viewStudents, rooms: viewRooms, seating: viewSeating, lookup: viewLookup, print: viewPrint, help: viewHelp, settings: viewSettings };
  document.getElementById('main').innerHTML = (views[activeTab] || viewSessions)();
  if (activeTab === 'lookup') { var el = document.getElementById('searchInput'); if (el) el.focus(); }
}

function noSessionMsg() {
  return '<div class="empty-msg">No exam session is open. Go to <b>Exam Sessions</b> and open or create one.</div>';
}
