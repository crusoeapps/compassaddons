# Exam Seating Manager — source

Crusoe College. The deliverable is a **single self-contained HTML file** so staff
can open it from a link with nothing installed. These source parts exist so it
stays maintainable.

## Layout

```
src/part1_head.html              <head>, all CSS, page shell, nav, modal markup
src/part2_core.js                CONFIG, default settings + migration, state, Apps Script sync layer, editor mode, modal, router
src/part3_sessions.js            Sessions + students + Excel/CSV import
src/part4_rooms_seating.js       Rooms (seat-map editor), templates, seating engine + rules, interactive seat grid
src/part6_settings.js            Settings tab: branding, room types, statuses, seating defaults, print options
src/part7_files.js               Save to file / Open file: the whole plan as one .json backup
src/part5_lookup_print_help.js   Lookup, print sheets, how-to guides, seed data, boot (built last)
src/seed.json                    Local-mode demo data (Year 9 NAPLAN 2026 layout, fictional names)
build.js                         Concatenates the above into Exam_Seating_Manager.html
test.py                          Playwright end-to-end suite (99 checks)
test_backend.js                  Test-only: runs the real Code.gs on an in-memory fake Google Sheet
test_baseline.json               Test fixture: seats + print HTML from the original (pre-settings) app
Code.gs                          Google Apps Script backend (authoritative API contract)
SETUP_GUIDE.md                   Setup and operations guide for Duane
```

**Never hand-edit `Exam_Seating_Manager.html`** — it is generated. Edit `src/`, then rebuild.

## Privacy

This folder is part of the public `compassaddons` repo and site, but it is not
listed in the Compass Tools menu or on the home page, and the page asks search
engines not to index it. Being unlisted is not the same as private, so:
the demo names are fictional, `CONFIG.API_URL` stays blank in this copy (backend
reads need no password), and real data lives only in each user's browser,
their saved plan files, or a privately hosted shared-mode copy.

## Build

```bash
node build.js
```

## Test

```bash
pip install playwright && playwright install chromium   # first time only
python3 test.py        # needs node on the PATH too (for test_backend.js)
```

The suite drives a real browser against the built file: viewer lockdown, seat
swapping, keep-apart conflict resolution, status routing, print wiring,
persistence across reload, and a zero-JS-error assertion. It also covers every
setting (branding, statuses, room types, seating rules, blocked seats, labels,
print options), checks that **default settings reproduce the original app
byte-for-byte** against `test_baseline.json`, and runs the app in shared mode
against the **real `Code.gs`** (via `test_backend.js`): settings save/load,
`VERSION_CONFLICT` handling, an old v1.0 backend, and `setup()` upgrading an
existing sheet. Regenerate `test_baseline.json` only for a deliberate change to
default output. It expects the Year 9
seed (218 students, 212 in GYM) — update the counts in `test.py` if you change
`seed.json`.

Two notes on the test environment: CDN requests (fonts, SheetJS) fail offline
and are filtered out of the error assertion, so **Excel import is not covered by
the suite** — verify that one by hand after touching `readImportFile` or
`doImport`.

## Architecture notes

- **Two modes.** With `CONFIG.API_URL` blank the app runs in *local mode* against
  `localStorage` and `seed.json`. With a URL set it talks to the Apps Script
  backend. `remote()` is the switch; every write path handles both.
- **`Code.gs` is the authoritative API contract.** The app maps its own model to
  that schema in `roomToRow` / `rowToRoom` / `studentToRow` / `rowToStudent`.
  Change the sheet schema and those four functions plus `Code.gs` move together.
- **Sessions load lazily.** `listSessions` returns shells; `ensureLoaded()`
  fetches students, rooms and separations on first open. Session cards show `—`
  for counts until loaded.
- **Optimistic concurrency.** Each session carries a `version`. A stale save
  returns `VERSION_CONFLICT` and the app shows a reload prompt rather than
  overwriting another coordinator's work. Do not remove the version round-trip.
- **Status drives placement.** `routeStudent()` is the single place that decides
  where a student goes, and it reads the rules from Settings: each status points
  at a room type, each room type is a seat grid or a list. Anything that changes
  a status must call it.
- **Settings.** School-wide settings live in `DB.config` (Settings tab in the
  Sheet, one version-checked JSON row). Per-session rules live in
  `s.settings` (Sessions → `settingsJson`), per-room layout in `r.layout`
  (Rooms → `layoutJson`). `DEFAULT_CONFIG` reproduces the original behaviour.
- **Statuses are ids, not labels.** The four built-in ids are the original
  strings (`'Completing'` …) so old rows need no rewriting; renaming a status
  changes only its label. Never compare against a label.
- **Migration.** `migrateDB()` runs on every load, fills anything missing with
  the original behaviour and is idempotent. Add new fields there, never assume
  they exist.
- **Printing uses a hidden iframe,** not `window.open()`, which is blocked in
  sandboxed previews and some locked-down SOE browsers.
- **`localStorage` is always wrapped in try/catch** (`lsGet`/`lsSet`) — it throws
  outright in some embedded contexts.

## Conventions

- ES5-style function syntax and `var` throughout, for maximum browser tolerance
  on school machines. `async`/`await` is used only in the sync layer.
- All user-facing strings go through `esc()` before reaching `innerHTML`.
- Copy is plain English for non-technical staff: say what happened and what to
  do next, never a raw error code alone.
