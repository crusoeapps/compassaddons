/* ===================== VIEW: SETTINGS (editors) =====================
   School-wide settings. Edits go into settingsDraft and only reach
   DB.config when "Save settings" passes validation, so a half-finished
   change never affects the plan. Saving is version-checked like
   sessions (see saveConfigNow in part2_core.js).
   ================================================================ */
var LOGO_MAX_CHARS = 40000;   // a Google Sheets cell holds 50,000 characters

function validLogo(src) { return /^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(String(src || '')); }

/* Apply school name, tagline, accent colour and logo to the page. */
function applyBranding() {
  if (!DB || !DB.config) return;
  var sc = cfg().school;
  document.title = sc.name + ' — Exam Seating Manager';
  var sub = document.getElementById('brandSub');
  if (sub) sub.innerHTML = esc(sc.name) + (sc.tagline ? ' &middot; ' + esc(sc.tagline) : '');
  var logo = document.getElementById('brandLogo');
  if (logo) {
    if (validLogo(sc.logo)) { logo.src = sc.logo; logo.style.display = ''; }
    else { logo.removeAttribute('src'); logo.style.display = 'none'; }
  }
  var root = document.documentElement.style, head = document.querySelector('header');
  var a = isHex(sc.accent) ? sc.accent.toLowerCase() : DEFAULT_ACCENT;
  if (a === DEFAULT_ACCENT) {
    root.removeProperty('--navy'); root.removeProperty('--blue');
    if (head) head.style.background = '';
  } else {
    root.setProperty('--navy', a); root.setProperty('--blue', mixHex(a, '#ffffff', 0.15));
    if (head) head.style.background = 'linear-gradient(135deg, ' + mixHex(a, '#000000', 0.2) + ' 0%, ' + a + ' 60%, ' + mixHex(a, '#ffffff', 0.15) + ' 100%)';
  }
}
function mixHex(a, b, t) {
  var x = hexToRgb(a), y = hexToRgb(b);
  return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join('');
}

function draft() {
  if (!settingsDraft) settingsDraft = clone(cfg());
  return settingsDraft;
}
function draftDirty() { return settingsDraft && JSON.stringify(settingsDraft) !== JSON.stringify(cfg()); }

/* Generic setter used by inputs: path like "school.name" or "statuses.2.label". */
function setDraft(path, value) {
  if (!editor) return;
  var parts = path.split('.'), o = draft();
  for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
  var bar = document.getElementById('settingsBar');
  if (bar) bar.className = 'settings-bar' + (draftDirty() ? ' dirty' : '');
}
function inputAttr(path, val, type) {
  return ' value="' + esc(val == null ? '' : val) + '" onchange="setDraft(\'' + path + '\', this.' + (type === 'check' ? 'checked' : 'value') + ')"';
}

function viewSettings() {
  if (!editor) return '<div class="empty-msg">Settings are for exam coordinators. Use "Editor sign in" (top right).</div>';
  var d = draft();
  var html = '<div class="section-head"><div><h2>Settings</h2><p>Shared by every editor and every session. Nothing changes until you click <b>Save settings</b>.</p></div></div>';
  if (remote() && !backendHasSettings) {
    html += '<div class="warn-box">Your shared Google Sheet needs a one-off update before settings can be saved: paste in the new <b>Code.gs</b>, run <b>setup</b>, then publish a new version (SETUP_GUIDE.md, "Updating an existing install"). Until then the app uses its standard settings.</div>';
  }

  // ---- school & branding ----
  html += '<div class="set-card"><h3>School &amp; branding</h3>' +
    '<div class="form-grid"><div class="form-row"><label>School name</label><input type="text"' + inputAttr('school.name', d.school.name) + '></div>' +
    '<div class="form-row"><label>Header line</label><input type="text"' + inputAttr('school.tagline', d.school.tagline) + '></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Accent colour</label><input type="color"' + inputAttr('school.accent', d.school.accent) + '> ' +
    '<button class="btn small secondary" onclick="setDraft(\'school.accent\',DEFAULT_ACCENT);render()">Reset colour</button></div>' +
    '<div class="form-row"><label>Logo (PNG or JPG, shown in the header and on printouts)</label>' +
    (validLogo(d.school.logo) ? '<img src="' + esc(d.school.logo) + '" alt="" class="logo-preview"> <button class="btn small danger" onclick="setDraft(\'school.logo\',\'\');render()">Remove logo</button> ' : '') +
    '<button class="btn small secondary" onclick="pickLogo()">' + (d.school.logo ? 'Replace' : 'Choose') + ' logo</button></div></div></div>';

  // ---- room types ----
  html += '<div class="set-card"><h3>Room types</h3><p class="muted">Every room has a type. <b>Seat grid</b> rooms are filled by Generate seating; <b>list</b> rooms just hold names. A type with a print title gets its own sheet on the Print tab.</p>' +
    '<table class="set-table"><thead><tr><th>Name</th><th>Layout</th><th>Print title (blank = no sheet)</th><th></th></tr></thead><tbody>' +
    d.purposes.map(function (p, i) {
      return '<tr><td><input type="text"' + inputAttr('purposes.' + i + '.label', p.label) + '></td>' +
        '<td><select onchange="setDraft(\'purposes.' + i + '.layout\',this.value)">' + optionsHTML([['seated', 'Seat grid'], ['list', 'List']], p.layout) + '</select></td>' +
        '<td><input type="text"' + inputAttr('purposes.' + i + '.printTitle', p.printTitle) + '></td>' +
        '<td class="set-actions">' + orderButtons('purposes', i, d.purposes.length) +
        '<button class="btn small danger" onclick="removePurpose(' + i + ')">&#10005;</button></td></tr>';
    }).join('') + '</tbody></table>' +
    '<button class="btn small secondary" onclick="addPurpose()">+ Add room type</button></div>';

  // ---- statuses ----
  var purposeOpts = function (sel) { return d.purposes.map(function (p) { return [p.id, p.label]; }); };
  html += '<div class="set-card"><h3>Statuses</h3><p class="muted">Each status sends students to a room type. The <b>first</b> status is the default for new and imported students. Import words: if a spreadsheet status cell contains any of them (comma-separated), that status is used.</p>' +
    '<table class="set-table"><thead><tr><th>Name</th><th>Colour</th><th>Goes to</th><th>Import words</th><th></th></tr></thead><tbody>' +
    d.statuses.map(function (x, i) {
      return '<tr><td><input type="text"' + inputAttr('statuses.' + i + '.label', x.label) + '></td>' +
        '<td><input type="color"' + inputAttr('statuses.' + i + '.color', x.color) + '></td>' +
        '<td><select onchange="setDraft(\'statuses.' + i + '.purpose\',this.value)">' + optionsHTML(purposeOpts(), x.purpose) + '</select></td>' +
        '<td><input type="text" placeholder="e.g. special, provision"' + inputAttr('statuses.' + i + '.keywords', x.keywords) + '></td>' +
        '<td class="set-actions">' + orderButtons('statuses', i, d.statuses.length) +
        '<button class="btn small danger" onclick="removeStatus(' + i + ')">&#10005;</button></td></tr>';
    }).join('') + '</tbody></table>' +
    '<button class="btn small secondary" onclick="addStatus()">+ Add status</button></div>';

  // ---- seating defaults ----
  var S = d.seating;
  html += '<div class="set-card"><h3>Seating defaults for new sessions</h3><p class="muted">Existing sessions keep their own rules (Seating Plan &rarr; Seating rules).</p>' +
    '<div class="form-grid"><div class="form-row"><label>Order</label><select onchange="setDraft(\'seating.sortBy\',this.value)">' + optionsHTML(SORT_OPTIONS, S.sortBy) + '</select></div>' +
    '<div class="form-row"><label>Spacing</label><select onchange="setDraft(\'seating.pattern\',this.value)">' + optionsHTML(PATTERN_OPTIONS, S.pattern) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Fill rows</label><select onchange="setDraft(\'seating.rowDir\',this.value)">' + optionsHTML(ROWDIR_OPTIONS, S.rowDir) + '</select></div>' +
    '<div class="form-row"><label>Fill seats</label><select onchange="setDraft(\'seating.seatDir\',this.value)">' + optionsHTML(SEATDIR_OPTIONS, S.seatDir) + '</select></div></div>' +
    '<div class="form-row"><label>Keep-apart pairs must not be</label><select onchange="setDraft(\'seating.near\',this.value)">' + optionsHTML(NEAR_OPTIONS, S.near) + '</select></div></div>';

  // ---- print ----
  var P = d.print;
  var colBoxes = function (key) {
    return Object.keys(PRINT_COLS).map(function (c) {
      return '<label class="check"><input type="checkbox"' + (P[key].indexOf(c) >= 0 ? ' checked' : '') + ' onchange="toggleCol(\'' + key + '\',\'' + c + '\',this.checked)"> ' + PRINT_COLS[c][0] + '</label>';
    }).join('');
  };
  html += '<div class="set-card"><h3>Print</h3>' +
    '<div class="form-grid"><div class="form-row"><label>Seat grids</label><select onchange="setDraft(\'print.gridOrientation\',this.value)">' + optionsHTML([['landscape', 'Landscape'], ['portrait', 'Portrait']], P.gridOrientation) + '</select></div>' +
    '<div class="form-row"><label>Lists</label><select onchange="setDraft(\'print.listOrientation\',this.value)">' + optionsHTML([['portrait', 'Portrait'], ['landscape', 'Landscape']], P.listOrientation) + '</select></div></div>' +
    '<div class="form-row"><label>Master list columns</label><div class="checks">' + colBoxes('masterCols') + '</div></div>' +
    '<div class="form-row"><label>Room-type list columns (Arrangements is added automatically when anyone has some)</label><div class="checks">' + colBoxes('listCols') + '</div></div>' +
    '<div class="form-row"><label>Header lines</label><div class="checks">' +
    '<label class="check"><input type="checkbox"' + (P.showSupervisor ? ' checked' : '') + ' onchange="setDraft(\'print.showSupervisor\',this.checked)"> Room supervisor (set per room)</label>' +
    '<label class="check"><input type="checkbox"' + (P.showTimes ? ' checked' : '') + ' onchange="setDraft(\'print.showTimes\',this.checked)"> Start and finish times (set per session)</label></div></div>' +
    '<div class="form-row"><label>Instructions line on every sheet (optional)</label><input type="text" style="width:100%" placeholder="e.g. Phones off and in bags at the front"' + inputAttr('print.instructions', P.instructions) + '></div></div>';

  html += '<div id="settingsBar" class="settings-bar' + (draftDirty() ? ' dirty' : '') + '"><span class="muted">Unsaved changes</span>' +
    '<button class="btn secondary" onclick="discardSettings()">Discard changes</button>' +
    '<button class="btn" onclick="saveSettings()">Save settings</button></div>';
  return html;
}

function orderButtons(list, i, n) {
  return '<button class="btn small secondary" onclick="moveDraft(\'' + list + '\',' + i + ',-1)"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>' +
    '<button class="btn small secondary" onclick="moveDraft(\'' + list + '\',' + i + ',1)"' + (i === n - 1 ? ' disabled' : '') + '>&#9660;</button>';
}
function moveDraft(list, i, dir) {
  if (!editor) return;
  var a = draft()[list], j = i + dir;
  if (j < 0 || j >= a.length) return;
  var t = a[i]; a[i] = a[j]; a[j] = t;
  render();
}
function toggleCol(key, col, on) {
  if (!editor) return;
  var P = draft().print;
  P[key] = Object.keys(PRINT_COLS).filter(function (c) { return c === col ? on : P[key].indexOf(c) >= 0; });
  setDraft('print.' + key, P[key]);
}

function addPurpose() {
  if (!editor) return;
  draft().purposes.push({ id: 'p_' + uid(), label: 'New room type', layout: 'list', printTitle: '' });
  render();
}
function addStatus() {
  if (!editor) return;
  var d = draft();
  var listP = d.purposes.find(function (p) { return p.layout !== 'seated'; }) || d.purposes[0];
  d.statuses.push({ id: 's_' + uid(), label: 'New status', purpose: listP.id, color: '#6b7a99', keywords: '' });
  render();
}

/* Everything that might use a status or room type, across ALL sessions
   (remote sessions load lazily, so load them first). */
async function usageAcrossSessions(test) {
  if (remote()) {
    toast('Checking every session…');
    try { await ensureAllLoaded(); }
    catch (e) { toast('Could not check every session: ' + e.message + ' — try again', true); return null; }
  }
  var hits = [];
  DB.sessions.forEach(function (s) {
    var n = test(s);
    if (n) hits.push(s.name + ' (' + n + ')');
  });
  return hits;
}

async function removeStatus(i) {
  if (!editor) return;
  var d = draft(), x = d.statuses[i];
  if (d.statuses.length === 1) { toast('Keep at least one status', true); return; }
  var hits = await usageAcrossSessions(function (s) { return s.students.filter(function (st) { return st.status === x.id; }).length; });
  if (hits === null) return;
  if (hits.length) {
    openModal('Status still in use', '<p><b>' + esc(x.label) + '</b> is still given to students in: ' + esc(hits.join(', ')) +
      '.</p><p style="margin-top:8px">Change those students to another status first (Students &rarr; Edit), then delete it.</p>', []);
    return;
  }
  d.statuses.splice(i, 1);
  render();
}

async function removePurpose(i) {
  if (!editor) return;
  var d = draft(), p = d.purposes[i];
  if (d.purposes.length === 1) { toast('Keep at least one room type', true); return; }
  var users = d.statuses.filter(function (x) { return x.purpose === p.id; }).map(function (x) { return x.label; });
  if (users.length) { toast('Statuses still go to "' + p.label + '": ' + users.join(', ') + '. Point them at another room type first.', true); return; }
  var hits = await usageAcrossSessions(function (s) { return s.rooms.filter(function (r) { return r.purpose === p.id; }).length; });
  if (hits === null) return;
  if (hits.length) {
    openModal('Room type still in use', '<p>Rooms of type <b>' + esc(p.label) + '</b> exist in: ' + esc(hits.join(', ')) +
      '.</p><p style="margin-top:8px">Change or delete those rooms first (Rooms &amp; Layout).</p>', []);
    return;
  }
  d.purposes.splice(i, 1);
  render();
}

function pickLogo() {
  if (!editor) return;
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/png,image/jpeg';
  inp.onchange = function () { if (inp.files[0]) loadLogo(inp.files[0]); };
  inp.click();
}
/* Shrink the logo in the browser so it fits in one Sheet cell. */
function loadLogo(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 96 / img.height, 360 / img.width);
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var data = c.toDataURL('image/png');
      if (data.length > LOGO_MAX_CHARS) {
        var g = c.getContext('2d'); g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', 0.8);
      }
      if (data.length > LOGO_MAX_CHARS) { toast('That logo is too detailed to store. Try a simpler or smaller image.', true); return; }
      setDraft('school.logo', data); render();
    };
    img.onerror = function () { toast('Could not read that image. Use a PNG or JPG file.', true); };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function discardSettings() {
  if (!editor) return;
  settingsDraft = null; render();
  toast('Changes discarded');
}

function validateDraft(d) {
  if (!String(d.school.name || '').trim()) return 'Enter the school name.';
  if (!isHex(d.school.accent)) return 'The accent colour is not valid.';
  if (d.school.logo && !validLogo(d.school.logo)) return 'The logo is not a valid image. Remove it and choose it again.';
  var seen = {};
  for (var i = 0; i < d.purposes.length; i++) {
    var p = d.purposes[i], k = String(p.label || '').trim().toLowerCase();
    if (!k) return 'Every room type needs a name.';
    if (seen['p' + k]) return 'Two room types are both called "' + p.label + '". Give each a different name.';
    seen['p' + k] = 1;
    if (p.layout !== 'seated' && p.layout !== 'list') p.layout = 'list';
  }
  for (var j = 0; j < d.statuses.length; j++) {
    var x = d.statuses[j], ks = String(x.label || '').trim().toLowerCase();
    if (!ks) return 'Every status needs a name.';
    if (seen['s' + ks]) return 'Two statuses are both called "' + x.label + '". Give each a different name.';
    seen['s' + ks] = 1;
    if (!isHex(x.color)) return 'The colour for "' + x.label + '" is not valid.';
    if (!d.purposes.some(function (p) { return p.id === x.purpose; })) return 'Choose a room type for "' + x.label + '".';
  }
  if (!d.statuses.length) return 'Keep at least one status.';
  if (!d.purposes.length) return 'Keep at least one room type.';
  return '';
}

async function saveSettings() {
  if (!editor) return;
  var d = draft();
  d.school.name = d.school.name.trim();
  d.purposes.forEach(function (p) { p.label = p.label.trim(); p.printTitle = String(p.printTitle || '').trim(); });
  d.statuses.forEach(function (x) { x.label = x.label.trim(); });
  var err = validateDraft(d);
  if (err) { toast(err, true); return; }
  var before = DB.config;
  // Built-in room types carry fixed card wording; drop it once their print title is changed.
  d.purposes.forEach(function (p) {
    var old = before.purposes.find(function (o) { return o.id === p.id; });
    if (old && old.printTitle !== p.printTitle) { delete p.printCard; delete p.printDesc; }
  });
  DB.config = clone(d);
  var ok = await saveConfigNow();
  if (!ok) { DB.config = before; render(); return; }
  settingsDraft = null;
  applyBranding();
  if (routingKey(before) !== routingKey(DB.config)) {
    if (remote()) { try { await ensureAllLoaded(); } catch (e) { toast('Some sessions could not be updated: ' + e.message + '. Open each one to refresh it.', true); } }
    await reconcileSessions();
  }
  render();
  toast('Settings saved');
}

/* After room types or status routing change, put students where the new
   rules say — only those now in the wrong kind of room move. */
function routingKey(c) {
  return JSON.stringify([c.purposes.map(function (p) { return [p.id, p.layout]; }), c.statuses.map(function (x) { return [x.id, x.purpose]; })]);
}
async function reconcileSessions() {
  for (var i = 0; i < DB.sessions.length; i++) {
    var s = DB.sessions[i];
    if (!s.loaded && remote()) continue;           // could not be loaded; untouched
    var snapshot = JSON.stringify([s.rooms, s.students]);
    normaliseSession(s);
    s.students.forEach(function (st) {
      var want = statusPurpose(st.status);
      var r = st.roomId ? s.rooms.find(function (x) { return x.id === st.roomId; }) : null;
      if (r && r.purpose === want && (r.kind !== 'seated' || st.row)) return;   // right room (and seated if it's a grid)
      if (!r && isSeatedStatus(st.status)) return;   // waiting for a seat is fine
      routeStudent(s, st);
    });
    if (JSON.stringify([s.rooms, s.students]) !== snapshot) {
      if (remote()) await saveSessionNow(s); else lsSet(CONFIG.STORAGE_KEY, JSON.stringify(DB));
    }
  }
}
