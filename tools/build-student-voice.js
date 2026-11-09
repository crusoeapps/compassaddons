#!/usr/bin/env node
// Build student-voice-data.json (whole-school totals) from a Student Voice
// survey CSV export.
//
//   node tools/build-student-voice.js path/to/export.csv
//
// The CSV is read on your computer and NEVER committed (see .gitignore).
// Only totals are written out, never individual responses:
//   - no teacher names, individual classes, free text or timestamps
//   - filters: semester, gender, and subject. A subject is offered only if it
//     has 3+ classes (the dashboard's rule) AND 2+ different teachers, so no
//     subject option is one teacher's results. Subjects are matched on the
//     class code (e.g. 9ENGE -> 9ENG); raw subject text is never published
//     because students often typed the teacher's name into it.
//   - every published total covers at least MIN_RESPONSES responses
//   - complementary suppression: a total is also withheld if subtracting
//     published totals would reveal a group of 1-9 responses (e.g. all
//     students in a subject minus the published genders)
//   - responses with no gender recorded are left out of everything
// Semesters: Jan-Jun = S1, Jul-Dec = S2 (same as the dashboard). 'ALL' is
// published for a combination only if each semester's total is published.
'use strict'
const fs = require('fs')
const path = require('path')

const MIN_RESPONSES = 10

// Same question prefixes and option lists as the Student Voice dashboard.
const LPX = [
  'My teacher tries their best',
  'I find the work in this class slightly',
  'The classroom is always quiet',
  'My teacher manages disruptions',
  'I felt supported when the learning was challenging',
  'This class keeps my attention',
  'I know what i am supposed to do',
  'The teacher always treats me with respect'
]
const GW_OPTS = [
  'The learning is fun', 'I know what to do when I enter the class', 'I know the class routine',
  'I am rewarded when I do the right thing', 'I feel adequately challenged',
  'Student behaviour has clear boundaries', 'My teacher explains things clearly',
  'I feel like I genuinely contribute to this class',
  'My teacher always encourages me to be better than yesterday',
  'It is clear what is required of me to meet the aim of the class'
]
const WC_OPTS = [
  'More structure and routine', 'More rewards for good effort and behaviour',
  'Plan easier tasks I feel I can do', 'Plan harder tasks that challenge me',
  'Clearly articulate boundaries for appropriate behaviour', 'Explain concepts clearer',
  'Spend less time presenting workshops to the class', 'Encourage me to contribute more',
  'Make it clearer what is expected of me in this class'
]

// Minimal RFC 4180 CSV parser (quoted fields, embedded commas/newlines).
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false }
      else f += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(f); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []
    } else f += c
  }
  row.push(f); if (row.some(x => x !== '')) rows.push(row)
  return rows
}

function semesterOf(s) {
  if (!s) return null
  const d = new Date(String(s).replace(/\s+GMT[+-]\d+$/i, '').trim())
  if (isNaN(d)) return null
  return (d.getMonth() < 6 ? 'S1 ' : 'S2 ') + d.getFullYear()
}

function countOpts(raw, opts, into) {
  raw = raw || ''
  const parts = raw.includes(', ') ? raw.split(', ') : raw.split(';')
  const seen = new Set()
  parts.forEach(v => {
    const t = v.trim().replace(/\s+/g, ' ').toLowerCase()
    const i = opts.findIndex(o => o.toLowerCase() === t)
    if (i >= 0 && !seen.has(i)) { seen.add(i); into[i]++ }
  })
}

const file = process.argv[2]
if (!file) { console.error('Usage: node tools/build-student-voice.js path/to/export.csv'); process.exit(1) }
const rows = parseCSV(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
const head = rows.shift().map(h => h.trim())
const find = p => head.findIndex(h => h.toLowerCase().startsWith(p.toLowerCase()))
const col = {
  ts: head.findIndex(h => h.toLowerCase().includes('timestamp')),
  likert: LPX.map(find),
  gw: head.findIndex(h => h.toLowerCase().includes('going well')),
  wc: head.findIndex(h => h.toLowerCase().includes('change') && h.toLowerCase().includes('engaging'))
}
if (col.ts < 0 || col.likert.some(i => i < 0)) {
  console.error('Columns not recognised -- check this is a Student Voice survey export.'); process.exit(1)
}

col.subject = head.findIndex(h => h.toLowerCase().startsWith('select your subject code'))
col.gender = head.findIndex(h => h.toLowerCase().includes('gender'))
col.teacher = head.findIndex(h => h.toLowerCase().includes("teacher's name") || h.toLowerCase().includes('teacher name'))
if (col.subject < 0 || col.gender < 0 || col.teacher < 0) {
  console.error('Subject, gender or teacher column not found.'); process.exit(1)
}

// Class code from text like "9A English - 9ENGA" or "10BUS6 — <teacher>".
const CODE = /^\d{1,2}[A-Z]{2,}[A-Z0-9]*$/
const parts = s => String(s || '').split(/\s+[-–—]\s+/).map(p => p.trim())
function classCode(s) {
  const ps = parts(s)
  for (let i = ps.length - 1; i >= 0; i--) { const c = ps[i].replace(/\s+/g, '').toUpperCase(); if (CODE.test(c)) return { code: c, i, ps } }
  return null
}
// Same idea as the dashboard's classCodePrefix: 10ENG1 -> 10ENG, 8MATA -> 8MAT
function codePrefix(c) {
  const noDigits = c.replace(/\d+$/, '')
  if (noDigits !== c) return noDigits
  return c.length > 4 ? c.replace(/[A-Z]$/, '') : c
}

// ── Pass 1: decide which subjects can be offered (whole dataset) ──
const subj = {}
const records = []
rows.forEach(r => {
  const sem = semesterOf(r[col.ts]); if (!sem) return
  const gender = (r[col.gender] || '').trim(); if (!gender) return
  const cc = classCode(r[col.subject])
  let key = null
  if (cc) {
    key = codePrefix(cc.code)
    const g = subj[key] || (subj[key] = { classes: new Set(), teachers: new Set(), names: {} })
    g.classes.add(cc.code); g.teachers.add((r[col.teacher] || '').trim())
    // A description is only taken from text BEFORE the code ("9A English"),
    // never after it, where students typed teacher names.
    if (cc.i > 0) {
      const name = cc.ps.slice(0, cc.i).join(' ').replace(/^(year\s*)?\d+[A-Z]?\s+/i, '').replace(/\s+/g, ' ').trim()
      if (name && !/\d/.test(name)) g.names[name] = (g.names[name] || 0) + 1
    }
  }
  records.push({ sem, gender, key, r })
})
const subjects = Object.keys(subj).filter(k => subj[k].classes.size >= 3 && subj[k].teachers.size >= 2)
  .sort((a, b) => (parseInt(a) - parseInt(b)) || a.localeCompare(b))
// Names for codes that only ever appear without a description.
const CODE_NAMES = { ART: 'Art', HUM: 'Humanities', SCI: 'Science', BIO: 'Biology', ENG: 'English', MAT: 'Maths', MUS: 'Music' }
const subjectLabel = k => {
  const names = Object.entries(subj[k].names).sort((a, b) => b[1] - a[1])
  const bare = k.replace(/^\d+/, '')
  return 'Year ' + parseInt(k) + ' ' + (names.length ? names[0][0] : (CODE_NAMES[bare] || bare)) + ' (' + k + ')'
}
const genders = [...new Set(records.map(x => x.gender))].sort()

// ── Pass 2: totals for every semester x gender x subject ('*' = all) ──
const order = id => { const [h, y] = id.split(' '); return Number(y) * 10 + (h === 'S1' ? 1 : 2) }
const semIds = [...new Set(records.map(x => x.sem))].sort((a, b) => order(a) - order(b))
const blank = () => ({ n: 0, likert: LPX.map(() => [0, 0, 0, 0]), goingWell: GW_OPTS.map(() => 0), change: WC_OPTS.map(() => 0) })
const cells = {}   // cells[bucket][gender|subject]
function add(bucket, g, s, r) {
  const b = cells[bucket] || (cells[bucket] = {})
  const c = b[g + '|' + s] || (b[g + '|' + s] = blank())
  c.n++
  col.likert.forEach((ci, qi) => { const v = parseInt(r[ci], 10); if (v >= 1 && v <= 4) c.likert[qi][v - 1]++ })
  if (col.gw >= 0) countOpts(r[col.gw], GW_OPTS, c.goingWell)
  if (col.wc >= 0) countOpts(r[col.wc], WC_OPTS, c.change)
}
records.forEach(x => {
  const sk = subjects.includes(x.key) ? x.key : null
  ;[x.sem, 'ALL'].forEach(bucket => {
    add(bucket, '*', '*', x.r); add(bucket, x.gender, '*', x.r)
    if (sk) { add(bucket, '*', sk, x.r); add(bucket, x.gender, sk, x.r) }
  })
})

// ── Suppression ──
const nOf = (b, k) => (cells[b] && cells[b][k]) ? cells[b][k].n : 0
function suppress(bucket) {
  const ok = new Set(Object.keys(cells[bucket] || {}).filter(k => cells[bucket][k].n >= MIN_RESPONSES))
  const lines = []
  ;['*'].concat(subjects).forEach(s => lines.push({ total: '*|' + s, parts: genders.map(g => g + '|' + s) }))
  ;['*'].concat(genders).forEach(g => lines.push({ total: g + '|*', parts: subjects.map(s => g + '|' + s) }))
  let changed = true
  while (changed) {
    changed = false
    lines.forEach(L => {
      if (!ok.has(L.total)) {
        // Total hidden: if exactly one part is hidden, the others plus... nothing
        // to subtract from, so parts alone are safe.
        return
      }
      const shown = L.parts.filter(k => ok.has(k))
      const rem = nOf(bucket, L.total) - shown.reduce((a, k) => a + nOf(bucket, k), 0)
      if (rem > 0 && rem < MIN_RESPONSES && shown.length) {
        const smallest = shown.sort((a, b) => nOf(bucket, a) - nOf(bucket, b))[0]
        ok.delete(smallest); changed = true
      }
    })
  }
  return ok
}
const published = {}
semIds.forEach(id => { published[id] = suppress(id) })
// ALL: run the same rules, then also require every semester's total to be
// published (or that semester to have no responses for it).
const allOk = semIds.length > 1 ? suppress('ALL') : new Set()
;[...allOk].forEach(k => { if (!semIds.every(id => published[id].has(k) || nOf(id, k) === 0)) allOk.delete(k) })
// Withholding from ALL can expose a remainder again, so re-run rules on what's left.
if (semIds.length > 1) {
  const again = suppress('ALL'); [...allOk].forEach(k => { if (!again.has(k)) allOk.delete(k) })
  published.ALL = allOk
}

function pack(bucket) {
  const out = {}
  ;[...published[bucket]].sort().forEach(k => { out[k] = cells[bucket][k] })
  return out
}
const semesters = semIds.filter(id => published[id].has('*|*')).map(id => ({ id, cells: pack(id) }))
const dropped = semIds.filter(id => !published[id].has('*|*'))

const out = {
  note: 'Totals only. Built by tools/build-student-voice.js. No teacher names, individual classes, free text or timestamps. Keys are "gender|subject"; * = all.',
  minResponses: MIN_RESPONSES,
  questions: col.likert.map(i => head[i].split('\n')[0].trim()),
  scale: ['Strongly disagree', 'Disagree', 'Agree', 'Strongly agree'],
  goingWellOptions: GW_OPTS,
  changeOptions: WC_OPTS,
  genders,
  subjects: subjects.map(k => ({ id: k, label: subjectLabel(k) })),
  semesters,
  all: published.ALL ? { id: 'ALL', cells: pack('ALL') } : null
}
const dest = path.join(__dirname, '..', 'student-voice-data.json')
fs.writeFileSync(dest, JSON.stringify(out) + '\n')
console.log('Wrote ' + dest)
console.log('  Genders: ' + genders.join(', ') + ' (' + (rows.length - records.length) + ' responses with no gender or date left out)')
console.log('  Subjects offered (3+ classes, 2+ teachers): ' + subjects.join(', '))
const skipped = Object.keys(subj).filter(k => subj[k].classes.size >= 3 && subj[k].teachers.size < 2)
if (skipped.length) console.log('  Not offered (3+ classes but only one teacher): ' + skipped.join(', '))
semesters.forEach(s => {
  const total = genders.length * (subjects.length + 1) + subjects.length + 1
  console.log('  ' + s.id + ': ' + s.cells['*|*'].n + ' responses, ' + Object.keys(s.cells).length + ' of ' + total + ' combinations published')
})
if (dropped.length) console.log('  Left out (fewer than ' + MIN_RESPONSES + ' responses): ' + dropped.join(', '))
