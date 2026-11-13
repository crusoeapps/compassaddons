/**
 * ═══════════════════════════════════════════════════════════════
 *  CRUSOE COLLEGE — EXAM SEATING BACKEND (Google Apps Script)
 *  Version 1.1 — adds the Settings tab and per-session settings,
 *  room layouts (blocked seats, labels, supervisor).
 *  Updating from 1.0: paste this file in, run setup once, then
 *  Deploy → Manage deployments → Edit → Version: New version.
 *
 *  This script turns the attached Google Sheet into a small
 *  database + API for the Exam Seating web app.
 *
 *  SETUP (see SETUP_GUIDE.md for click-by-click steps):
 *    1. Paste this whole file into Extensions → Apps Script
 *    2. Run the function  setup  once (grants permissions,
 *       creates all the tabs)
 *    3. Add a Script Property called EDITOR_PASSWORD
 *    4. Deploy → New deployment → Web app
 *       ("Execute as: Me", "Who has access: Anyone")
 * ═══════════════════════════════════════════════════════════════
 */

// ── Sheet structure: tab name → column headers ──────────────────
// New columns are only ever ADDED AT THE END so existing sheets keep working.
const SHEETS = {
  Sessions:    ['sessionId', 'name', 'examDate', 'yearLevels', 'status', 'version', 'updatedAt', 'settingsJson'],
  Students:    ['sessionId', 'studentId', 'firstName', 'lastName', 'homegroup', 'status', 'room', 'row', 'seat', 'arrangements', 'notes'],
  Rooms:       ['sessionId', 'roomId', 'name', 'layoutType', 'rows', 'seatsPerRow', 'color', 'sortOrder', 'layoutJson'],
  Separations: ['sessionId', 'studentIdA', 'studentIdB', 'reason'],
  Templates:   ['templateId', 'name', 'roomsJson'],
  Settings:    ['key', 'valueJson', 'version', 'updatedAt']
};

// A Google Sheets cell holds at most 50,000 characters.
const MAX_CELL = 49000;

/**
 * ONE-TIME SETUP — run this from the Apps Script editor.
 * Creates every tab with its headers (safe to re-run; it never
 * deletes data, only adds anything that's missing).
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    // Rewrite the header row if ANY header differs — this is how columns
    // added at the end in a new version get their heading. Data is untouched.
    if (firstRow.map(String).join('\u0001') !== headers.join('\u0001')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0d5c2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  // Remove the default empty "Sheet1" if it exists and is empty
  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  Logger.log('Setup complete. Tabs ready: ' + Object.keys(SHEETS).join(', '));
}

// ═════════════════════════ HTTP ENTRY POINTS ════════════════════

/** Read-only requests (no password needed). */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    switch (p.action) {
      case 'ping':
        return json_({ ok: true, message: 'Exam Seating backend is running', time: new Date().toISOString() });
      case 'listSessions':
        return json_({ ok: true, sessions: readAll_('Sessions') });
      case 'getSession':
        return json_(getSession_(p.sessionId));
      case 'getSettings':
        return json_(getSettings_());
      case 'listTemplates':
        return json_({ ok: true, templates: readAll_('Templates').map(function (t) {
          return { templateId: t.templateId, name: t.name, rooms: safeParse_(t.roomsJson, []) };
        }) });
      default:
        return json_({ ok: false, error: 'Unknown or missing action. Valid GET actions: ping, listSessions, getSession, listTemplates, getSettings' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Write requests — every one requires the editor password. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // wait up to 20s for another editor's write to finish
    const body = JSON.parse(e.postData.contents);

    if (!checkPassword_(body.password)) {
      return json_({ ok: false, error: 'WRONG_PASSWORD' });
    }

    switch (body.action) {
      case 'checkPassword':
        return json_({ ok: true });
      case 'createSession':
        return json_(createSession_(body));
      case 'updateSessionInfo':
        return json_(updateSessionInfo_(body));
      case 'deleteSession':
        return json_(deleteSession_(body.sessionId));
      case 'saveSessionData':
        return json_(saveSessionData_(body));
      case 'saveTemplate':
        return json_(saveTemplate_(body));
      case 'deleteTemplate':
        return json_(deleteTemplate_(body.templateId));
      case 'saveSettings':
        return json_(saveSettings_(body));
      default:
        return json_({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ═════════════════════════ ACTIONS ══════════════════════════════

function getSession_(sessionId) {
  if (!sessionId) return { ok: false, error: 'sessionId is required' };
  const session = readAll_('Sessions').find(function (s) { return s.sessionId === sessionId; });
  if (!session) return { ok: false, error: 'Session not found' };
  return {
    ok: true,
    session: session,
    students: rowsFor_('Students', sessionId),
    rooms: rowsFor_('Rooms', sessionId),
    separations: rowsFor_('Separations', sessionId)
  };
}

function createSession_(body) {
  if (!body.name) return { ok: false, error: 'Session name is required' };
  const session = {
    sessionId: Utilities.getUuid(),
    name: String(body.name),
    examDate: String(body.examDate || ''),
    yearLevels: String(body.yearLevels || ''),
    status: 'draft',
    version: 1,
    updatedAt: new Date().toISOString(),
    settingsJson: String(body.settingsJson || '')
  };
  if (session.settingsJson.length > MAX_CELL) return { ok: false, error: 'SETTINGS_TOO_LARGE' };
  appendRow_('Sessions', session);
  return { ok: true, session: session };
}

function updateSessionInfo_(body) {
  const sh = sheet_('Sessions');
  const idx = findRowIndex_(sh, 'sessionId', body.sessionId);
  if (idx < 0) return { ok: false, error: 'Session not found' };
  const current = rowToObject_(sh, idx);
  ['name', 'examDate', 'yearLevels', 'status'].forEach(function (f) {
    if (body[f] !== undefined) current[f] = String(body[f]);
  });
  current.updatedAt = new Date().toISOString();
  writeRow_(sh, idx, current);
  return { ok: true, session: current };
}

function deleteSession_(sessionId) {
  if (!sessionId) return { ok: false, error: 'sessionId is required' };
  deleteRowsFor_('Students', sessionId);
  deleteRowsFor_('Rooms', sessionId);
  deleteRowsFor_('Separations', sessionId);
  const sh = sheet_('Sessions');
  const idx = findRowIndex_(sh, 'sessionId', sessionId);
  if (idx >= 0) sh.deleteRow(idx);
  return { ok: true };
}

/**
 * The main save: replaces ALL students / rooms / separations for one
 * session in a single call. Uses a version number so two editors
 * can't silently overwrite each other: the client sends the version
 * it loaded, and if the sheet has moved on, the save is rejected.
 */
function saveSessionData_(body) {
  const sh = sheet_('Sessions');
  const idx = findRowIndex_(sh, 'sessionId', body.sessionId);
  if (idx < 0) return { ok: false, error: 'Session not found' };
  const session = rowToObject_(sh, idx);

  if (Number(body.version) !== Number(session.version)) {
    return { ok: false, error: 'VERSION_CONFLICT',
      message: 'Someone else saved changes after you opened this session. Reload to get the latest data, then re-apply your change.' };
  }

  if (body.settingsJson !== undefined) {
    if (String(body.settingsJson).length > MAX_CELL) return { ok: false, error: 'SETTINGS_TOO_LARGE' };
    session.settingsJson = String(body.settingsJson);
  }
  if (Array.isArray(body.students))    replaceRowsFor_('Students',    body.sessionId, body.students);
  if (Array.isArray(body.rooms))       replaceRowsFor_('Rooms',       body.sessionId, body.rooms);
  if (Array.isArray(body.separations)) replaceRowsFor_('Separations', body.sessionId, body.separations);

  session.version = Number(session.version) + 1;
  session.updatedAt = new Date().toISOString();
  writeRow_(sh, idx, session);
  return { ok: true, version: session.version };
}

function saveTemplate_(body) {
  if (!body.name) return { ok: false, error: 'Template name is required' };
  const sh = sheet_('Templates');
  // Overwrite a template with the same name, otherwise create new
  const all = readAll_('Templates');
  const existing = all.find(function (t) { return t.name === body.name; });
  const tpl = {
    templateId: existing ? existing.templateId : Utilities.getUuid(),
    name: String(body.name),
    roomsJson: JSON.stringify(body.rooms || [])
  };
  if (existing) {
    const idx = findRowIndex_(sh, 'templateId', tpl.templateId);
    writeRow_(sh, idx, tpl);
  } else {
    appendRow_('Templates', tpl);
  }
  return { ok: true, templateId: tpl.templateId };
}

function deleteTemplate_(templateId) {
  const sh = sheet_('Templates');
  const idx = findRowIndex_(sh, 'templateId', templateId);
  if (idx < 0) return { ok: false, error: 'Template not found' };
  sh.deleteRow(idx);
  return { ok: true };
}

/**
 * School-wide settings: one row, key "config", holding JSON. Version-checked
 * exactly like sessions so two editors cannot silently overwrite each other.
 */
function getSettings_() {
  const sh = sheet_('Settings');
  const idx = findRowIndex_(sh, 'key', 'config');
  if (idx < 0) return { ok: true, valueJson: '', version: 0 };
  const row = rowToObject_(sh, idx);
  return { ok: true, valueJson: String(row.valueJson || ''), version: Number(row.version) || 0 };
}

function saveSettings_(body) {
  const valueJson = String(body.valueJson || '');
  if (valueJson.length > MAX_CELL) return { ok: false, error: 'SETTINGS_TOO_LARGE' };
  try { JSON.parse(valueJson); } catch (e) { return { ok: false, error: 'Settings are not valid JSON' }; }
  const sh = sheet_('Settings');
  const idx = findRowIndex_(sh, 'key', 'config');
  const current = idx < 0 ? 0 : Number(rowToObject_(sh, idx).version) || 0;
  if (Number(body.version) !== current) {
    return { ok: false, error: 'VERSION_CONFLICT',
      message: 'Someone else saved the settings after you loaded them. Reload, then re-apply your change.' };
  }
  const row = { key: 'config', valueJson: valueJson, version: current + 1, updatedAt: new Date().toISOString() };
  if (idx < 0) appendRow_('Settings', row); else writeRow_(sh, idx, row);
  return { ok: true, version: row.version };
}

// ═════════════════════════ HELPERS ══════════════════════════════

function checkPassword_(pw) {
  const stored = PropertiesService.getScriptProperties().getProperty('EDITOR_PASSWORD');
  if (!stored) throw new Error('EDITOR_PASSWORD script property has not been set. See setup guide, Part D.');
  return String(pw) === stored;
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" is missing — run setup() again.');
  return sh;
}

/** Read every data row of a tab as an array of objects. */
function readAll_(name) {
  const sh = sheet_(name);
  const headers = SHEETS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map(function (row) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function rowsFor_(name, sessionId) {
  return readAll_(name).filter(function (r) { return r.sessionId === sessionId; });
}

/** Delete all rows for a session, then append the new set (bottom-up delete). */
function replaceRowsFor_(name, sessionId, objects) {
  deleteRowsFor_(name, sessionId);
  if (!objects || !objects.length) return;
  const sh = sheet_(name);
  const headers = SHEETS[name];
  const rows = objects.map(function (o) {
    o.sessionId = sessionId; // never trust the client on this one
    return headers.map(function (h) { return o[h] !== undefined && o[h] !== null ? o[h] : ''; });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function deleteRowsFor_(name, sessionId) {
  const sh = sheet_(name);
  const headers = SHEETS[name];
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let r = ids.length - 1; r >= 0; r--) {           // bottom-up so indexes stay valid
    if (String(ids[r][0]) === String(sessionId)) sh.deleteRow(r + 2);
  }
}

function appendRow_(name, obj) {
  const sh = sheet_(name);
  const headers = SHEETS[name];
  sh.appendRow(headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

/** Find the 1-based sheet row whose `column` equals `value`, or -1. */
function findRowIndex_(sh, column, value) {
  const headers = SHEETS[sh.getName()];
  const col = headers.indexOf(column) + 1;
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const values = sh.getRange(2, col, last - 1, 1).getValues();
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0]) === String(value)) return r + 2;
  }
  return -1;
}

function rowToObject_(sh, rowIndex) {
  const headers = SHEETS[sh.getName()];
  const row = sh.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}

function writeRow_(sh, rowIndex, obj) {
  const headers = SHEETS[sh.getName()];
  sh.getRange(rowIndex, 1, 1, headers.length)
    .setValues([headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; })]);
}

function safeParse_(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
