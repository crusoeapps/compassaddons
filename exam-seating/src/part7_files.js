/* ===================== SAVE / OPEN PLAN FILES =====================
   "Save to file" downloads everything (settings, room templates, every
   session with its students, rooms, seats and keep-apart pairs) as one
   .json file. Anyone can save a copy of what they can see.
   "Open file" (editors only) loads one back:
     - local mode: replace everything in this browser, or add the file's
       sessions alongside the ones already here;
     - shared mode: add the file's sessions to the shared data as NEW
       sessions (it never overwrites anyone's existing work).
   Real student data lives in these files, so they stay on the user's
   own computer; nothing here sends them anywhere except the app's own
   backend.
   ================================================================ */
var PLAN_FILE_APP = 'Exam Seating Manager';
var PLAN_FILE_FORMAT = 1;
var openedPlan = null;   // parsed file waiting for the user to choose replace / add

function planFileName() {
  var d = new Date();
  var stamp = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  return (cfg().school.name + ' exam seating ' + stamp).replace(/[^a-z0-9 _-]+/gi, '').replace(/\s+/g, '_') + '.json';
}

function sessionForFile(s) {
  var c = clone(s);
  delete c.loaded; delete c.version;
  return c;
}

async function savePlanFile() {
  if (remote()) {
    toast('Gathering every session…');
    try { await ensureAllLoaded(); }
    catch (e) { toast('Could not load every session to save: ' + e.message + ' — check your connection and try again', true); return; }
  }
  var file = {
    app: PLAN_FILE_APP, format: PLAN_FILE_FORMAT, savedAt: new Date().toISOString(),
    config: clone(cfg()),
    templates: clone(DB.templates),
    sessions: DB.sessions.map(sessionForFile),
    activeSessionId: DB.activeSessionId
  };
  var blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = planFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  toast('Saved ' + DB.sessions.length + ' session' + (DB.sessions.length === 1 ? '' : 's') + ' to ' + a.download + ' — keep it somewhere private, it has student names');
}

function openPlanFile() {
  if (!editor) return;
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function () { if (inp.files[0]) readPlanFile(inp.files[0]); };
  inp.click();
}

/* Check a parsed file is ours and well-formed. Returns an error message or ''. */
function checkPlanFile(f) {
  if (!isPlainObj(f) || f.app !== PLAN_FILE_APP) return 'That file is not an Exam Seating plan. Choose a file made with "Save to file".';
  if (Number(f.format) > PLAN_FILE_FORMAT) return 'That plan was saved by a newer version of the app. Use the latest app to open it.';
  if (!Array.isArray(f.sessions)) return 'That plan file is damaged (no sessions found).';
  for (var i = 0; i < f.sessions.length; i++) {
    var s = f.sessions[i];
    if (!isPlainObj(s) || !s.name || !Array.isArray(s.students) || !Array.isArray(s.rooms)) return 'That plan file is damaged (session ' + (i + 1) + ' is incomplete).';
  }
  return '';
}

function readPlanFile(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var f;
    try { f = JSON.parse(e.target.result); }
    catch (err) { toast('Could not read that file — it is not a saved plan.', true); return; }
    var err2 = checkPlanFile(f);
    if (err2) { toast(err2, true); return; }
    openedPlan = f;
    var students = f.sessions.reduce(function (n, s) { return n + s.students.length; }, 0);
    var names = f.sessions.map(function (s) { return esc(s.name); }).join(', ') || 'no sessions';
    var saved = f.savedAt ? new Date(f.savedAt).toLocaleString() : 'unknown date';
    var body = '<p>This file has <b>' + f.sessions.length + ' session' + (f.sessions.length === 1 ? '' : 's') + '</b> (' + students + ' students), saved ' + esc(saved) + ':</p>' +
      '<p class="muted" style="margin:6px 0 12px">' + names + '</p>';
    var buttons;
    if (remote()) {
      body += '<p>They will be <b>added to the shared data as new sessions</b>. Nothing already there is changed.</p>';
      buttons = [{ label: 'Add sessions', cls: 'btn', fn: function () { applyPlanFile('add'); } }];
    } else {
      body += '<p><b>Replace</b> swaps everything in this browser (sessions, settings and templates) for the file. <b>Add</b> keeps what is here and adds the file\'s sessions as copies.</p>';
      buttons = [{ label: 'Add sessions', cls: 'btn secondary', fn: function () { applyPlanFile('add'); } },
                 { label: 'Replace everything', cls: 'btn danger', fn: function () { applyPlanFile('replace'); } }];
    }
    openModal('Open plan file', body, buttons);
  };
  reader.onerror = function () { toast('Could not read that file. Try again.', true); };
  reader.readAsText(file);
}

/* Add statuses / room types the file uses that this school's settings lack,
   so imported students keep their status and rooms keep their type. */
function mergeMissingSettings(fileConfig) {
  var fc = migrateConfig(clone(fileConfig || {}));
  var c = cfg(), added = 0;
  fc.purposes.forEach(function (p) { if (!c.purposes.some(function (x) { return x.id === p.id; })) { c.purposes.push(p); added++; } });
  fc.statuses.forEach(function (x) { if (!c.statuses.some(function (y) { return y.id === x.id; })) { c.statuses.push(x); added++; } });
  return added;
}

async function applyPlanFile(mode) {
  if (!editor || !openedPlan) return;
  var f = openedPlan;
  openedPlan = null;
  closeModal();
  var incoming = f.sessions.map(function (s) { return clone(s); });

  if (mode === 'replace' && !remote()) {
    DB = migrateDB({ version: 1, config: f.config, templates: clone(f.templates || []), sessions: incoming,
                     activeSessionId: f.activeSessionId });
    DB.sessions.forEach(function (s) { s.loaded = true; s.version = 1; });
    if (!DB.sessions.some(function (s) { return s.id === DB.activeSessionId; })) DB.activeSessionId = DB.sessions.length ? DB.sessions[0].id : null;
    lsSet(CONFIG.STORAGE_KEY, JSON.stringify(DB));
    settingsDraft = null; applyBranding(); go('sessions');
    toast('Plan opened — ' + DB.sessions.length + ' session' + (DB.sessions.length === 1 ? '' : 's') + ' loaded');
    return;
  }

  // ADD: every session arrives as a new one, with fresh ids so nothing collides.
  var settingsAdded = mergeMissingSettings(f.config);
  if (settingsAdded && remote() && !(await saveConfigNow())) {
    toast('Sessions not added: the statuses or room types they need could not be saved to Settings.', true);
    return;
  }
  var added = 0;
  for (var i = 0; i < incoming.length; i++) {
    var s = incoming[i];
    var roomIds = {}, stuIds = {};
    s.rooms.forEach(function (r) { var n = uid(); roomIds[r.id] = n; r.id = n; });
    s.students.forEach(function (st) { var n = uid(); stuIds[st.id] = n; st.id = n; st.roomId = st.roomId ? roomIds[st.roomId] || null : null; });
    s.settings = isPlainObj(s.settings) ? s.settings : {};
    s.settings.keepApart = (s.settings.keepApart || []).filter(function (p) { return stuIds[p[0]] && stuIds[p[1]]; })
      .map(function (p) { var q = [stuIds[p[0]], stuIds[p[1]]]; if (p[2]) q.push(p[2]); return q; });
    if (DB.sessions.some(function (x) { return x.name === s.name; })) s.name = s.name + ' (from file)';
    s.id = uid(); s.version = 1; s.loaded = true;
    migrateSession(s);
    if (remote()) {
      try {
        var out = await apiPost({ action: 'createSession', password: editorPassword, name: s.name, examDate: s.date || '', yearLevels: s.group || '',
                                  settingsJson: JSON.stringify(sessionSettingsForSave(s)) });
        if (!out.ok) throw new Error(out.error || 'create failed');
        s.id = out.session.sessionId; s.version = Number(out.session.version) || 1;
        DB.sessions.push(s);
        if (!(await saveSessionNow(s))) throw new Error('the session was created but its students could not be saved');
      } catch (e) {
        toast('Stopped after ' + added + ' session' + (added === 1 ? '' : 's') + ': ' + e.message + ' — check your connection and try again', true);
        render(); return;
      }
    } else {
      DB.sessions.push(s);
    }
    added++;
  }
  if (!remote()) lsSet(CONFIG.STORAGE_KEY, JSON.stringify(DB));
  settingsDraft = null; go('sessions');
  toast('Added ' + added + ' session' + (added === 1 ? '' : 's') + ' from the file' + (settingsAdded ? ' (and ' + settingsAdded + ' status / room type' + (settingsAdded === 1 ? '' : 's') + ' they use)' : ''));
}
