#!/usr/bin/env node
/**
 * Test-only: runs the REAL Code.gs against an in-memory fake Google Sheet and
 * serves it over HTTP, so test.py can drive the app in shared (remote) mode.
 *
 *   node test_backend.js <port>
 *
 * Extra endpoints for the tests (not part of the real API):
 *   GET  /__state          dump every tab as arrays of rows
 *   POST /__load           replace the whole sheet: {"Tab": [[header...], [row...]]}
 *   POST /__setup          run Code.gs setup()
 *   POST /__mode           {"old": true} makes it behave like a v1.0 backend
 *                          (no getSettings/saveSettings, settingsJson ignored)
 * Not a perfect Sheets emulation: values are stored as given (real Sheets
 * would turn some strings into numbers/dates). Good enough for the contract.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const PASSWORD = 'testpass';
let book = {};              // tab name -> array of row arrays (row 0 = headers)
let oldMode = false;

function lastRow(data) {
  for (let r = data.length - 1; r >= 0; r--) if (data[r].some(v => v !== '' && v !== null && v !== undefined)) return r + 1;
  return 0;
}
function makeSheet(name) {
  if (!book[name]) book[name] = [];
  const sh = {
    getName: () => name,
    getLastRow: () => lastRow(book[name]),
    getRange: (r, c, nr, nc) => makeRange(name, r, c, nr || 1, nc || 1),
    appendRow: (arr) => { const d = book[name]; d.length = lastRow(d); d.push(arr.slice()); return sh; },
    deleteRow: (i) => { book[name].splice(i - 1, 1); return sh; },
    setFrozenRows: () => sh
  };
  return sh;
}
function makeRange(name, r, c, nr, nc) {
  const rng = {
    getValues: () => {
      const d = book[name], out = [];
      for (let i = 0; i < nr; i++) {
        const row = d[r - 1 + i] || [], o = [];
        for (let j = 0; j < nc; j++) { const v = row[c - 1 + j]; o.push(v === undefined || v === null ? '' : v); }
        out.push(o);
      }
      return out;
    },
    setValues: (vals) => {
      const d = book[name];
      vals.forEach((row, i) => {
        while (d.length < r + i) d.push([]);
        const target = d[r - 1 + i];
        row.forEach((v, j) => { while (target.length < c - 1 + j) target.push(''); target[c - 1 + j] = v; });
      });
      return rng;
    },
    setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng
  };
  return rng;
}
const spreadsheet = {
  getSheetByName: (n) => (book[n] ? makeSheet(n) : null),
  insertSheet: (n) => { book[n] = []; return makeSheet(n); },
  getSheets: () => Object.keys(book).map(makeSheet),
  deleteSheet: (sh) => { delete book[sh.getName()]; }
};
let uuid = 0;
const ctx = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  ContentService: { createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'EDITOR_PASSWORD' ? PASSWORD : null) }) },
  Utilities: { getUuid: () => 'uuid-' + (++uuid) },
  Logger: { log() {} },
  JSON, Date, String, Number, Array, Object, Error
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8') +
  '\n;this.doGet = doGet; this.doPost = doPost; this.setup = setup;', ctx);
ctx.setup();

function send(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}
const OLD_UNKNOWN = { getSettings: 1, saveSettings: 1 };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      if (url.pathname === '/__state') return send(res, book);
      if (url.pathname === '/__load') { book = JSON.parse(body); return send(res, { ok: true }); }
      if (url.pathname === '/__setup') { ctx.setup(); return send(res, { ok: true }); }
      if (url.pathname === '/__mode') { oldMode = !!JSON.parse(body).old; return send(res, { ok: true }); }
      if (req.method === 'OPTIONS') return send(res, '');
      if (req.method === 'GET') {
        const p = Object.fromEntries(url.searchParams);
        if (oldMode && OLD_UNKNOWN[p.action]) return send(res, { ok: false, error: 'Unknown or missing action.' });
        return send(res, ctx.doGet({ parameter: p }).content);
      }
      const parsed = JSON.parse(body);
      if (oldMode) {
        if (OLD_UNKNOWN[parsed.action]) return send(res, { ok: false, error: 'Unknown action: ' + parsed.action });
        delete parsed.settingsJson;
        body = JSON.stringify(parsed);
      }
      return send(res, ctx.doPost({ postData: { contents: body } }).content);
    } catch (e) {
      send(res, { ok: false, error: 'TEST SERVER: ' + e.message });
    }
  });
}).listen(Number(process.argv[2] || 8765), '127.0.0.1', () => console.log('ready'));
