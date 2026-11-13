# Prompt: make the Exam Seating Manager customisable

Copy everything below the line into a new Claude Code session opened in the `exam-seating` folder.

---

You're working on the Exam Seating Manager in this folder. Read `README.md` and `SETUP_GUIDE.md` first. They set out the architecture and conventions, and you must follow both. The app ships as one self-contained HTML file built from `src/` by `node build.js`. Never hand-edit `Exam_Seating_Manager.html`.

## Goal

At the moment the app is built around one school (Crusoe College) and one exam type (NAPLAN). I want coordinators to be able to adapt it to any exam (NAPLAN, semester exams, VCE practice exams, GAT) and to their own rooms **from inside the app**, without editing code. Anything a coordinator might reasonably want to change should be a setting with a sensible default. Today's behaviour must stay exactly the same until somebody changes a setting.

## What's hard-coded now (verified in the source)

1. **School name.** "Crusoe College" is written into `src/part1_head.html` (the `<title>` and the header subtitle) and into `printHeader()` in `src/part5_lookup_print_help.js`.
2. **Student statuses.** These are a fixed array, `STATUSES`, in `src/part2_core.js`: Completing, Special Provision, Withdrawn, Exemption. Room purposes are a fixed map, `PURPOSES`, in the same file.
3. **Status → room routing.** This is hard-coded string matching in `routeStudent()` in `src/part3_sessions.js`. The seating engine (`autoSeat()` in `src/part4_rooms_seating.js`) also hard-codes `'Completing'` as the only status that gets seated.
4. **Room layouts.** Every room is a plain rectangle of rows × seats. The defaults are 12 × 18 and the maximum is 60. There's no way to mark aisles, broken or unusable seats, or row labels such as A, B, C. These all live in `roomModal()`.
5. **Seating rules.** `autoSeat()` fills main rooms in list order, row by row, from seat 1. There's no option for spacing (every second seat or every second row), for the direction the fill runs, or for choosing which rooms fill first. Sort order is either surname or class, and nothing else.
6. **Keep-apart.** "Apart" is a single fixed adjacency definition, in `adjacentPairs()` and `fixKeepApart()`. The `reason` is always saved as `''`.
7. **Unused backend fields.** `studentToRow()` always writes `arrangements: ''` and `notes: ''`, and `roomToRow()` always writes `color: ''`. The backend has columns for these, but the app throws them away.
8. **Print sheets.** These are fixed: a seat grid per room, a master list, and status lists. There are no choices about columns, orientation, or extra lines such as supervisor, start and finish time, or instructions.
9. **NAPLAN-specific copy.** This appears in the seed data, in placeholder text such as "NAPLAN standard setup", and in the How-to Guides.

## What to build

Add a **Settings** tab that only editors can see, with these sections:

- **School & branding.** School name, an optional logo, and an accent colour. These are used in the header, the page title and every print sheet.
- **Statuses.** Add, rename, reorder or remove statuses. For each status, set a colour, choose whether students with that status are seated in a grid or placed on a list, and choose which room purpose they go to. `routeStudent()` must read these rules and stop matching strings. Keep `routeStudent()` as the single routing point. Don't let anyone delete a status that students still have; tell them to reassign those students first.
- **Room purposes.** Make these editable in the same way as statuses.
- **Seating rules.** These are per-session, with school-wide defaults:
  - Fill pattern: every seat, every second seat, or a checkerboard.
  - Fill direction: front to back or back to front, and left to right or snake.
  - Room fill order.
  - Sort order: surname, first name, class then surname, random with a reshuffle button, or the student ID from the import.
- **Room editor.** Click seats in the grid to mark them as aisle or unusable. Choose how rows and seats are labelled (numbers or letters, starting from either end). `autoSeat()`, seat swapping and keep-apart all have to skip unusable seats.
- **Keep-apart.** Choose what counts as "near": the same row only, or the 8 surrounding seats. Allow an optional reason for each pair, and save it to the backend's existing `reason` field.
- **Student fields.** Bring `arrangements` and `notes` through the app. They should appear in the student modal and on the special-arrangements print sheet, and be imported if the spreadsheet has matching columns.
- **Print options.** Choose which columns appear on each sheet, the orientation, and optional header fields (supervisor, start and finish time, and an instructions line).
- **Help text.** Make the How-to Guides and placeholder text use the configured names, with no NAPLAN or Crusoe wording baked in.

`CONFIG` stays as-is. It's deployment config (the API URL and storage key), not user settings.

## Constraints

- **Backward compatible.** Existing local-mode data in `localStorage` and existing Google Sheet data must load without errors and look exactly as they do now. Missing settings fall back to defaults that reproduce today's behaviour. Write a small migration that runs on load and is idempotent.
- **Backend contract.** Settings that are shared need to live in the backend, so every editor sees the same thing. `Code.gs` is the authoritative API contract. Its `SHEETS` object has tabs for Sessions, Students, Rooms, Separations and Templates. There's no settings tab, and the Sessions tab has no column for per-session settings such as `sortBy`, so check how those settings are stored today before you design anything. School-wide settings will most likely need a new tab, such as `Settings` with key and JSON-value columns, plus get and save actions. Seat masks and labels need a home on the Rooms tab. `setup()` is safe to re-run and adds any missing tabs. When the schema changes, `roomToRow`, `rowToRoom`, `studentToRow`, `rowToStudent` and `Code.gs` all change together, and `SETUP_GUIDE.md` must tell an existing school exactly what to do: paste in the new `Code.gs`, run `setup` again, and deploy a new version.
- **Concurrency.** Keep the optimistic-concurrency `version` round-trip. Settings saves also need to handle `VERSION_CONFLICT` with the existing reload prompt.
- **House style.** Use ES5 `var` and plain function syntax. `async`/`await` is allowed only in the sync layer. Everything that goes into `innerHTML` passes through `esc()`, and that includes user-defined status names, room names and colours: validate colours as hex values. Wrap all storage access with `lsGet`/`lsSet`. Printing stays in the hidden iframe.
- **Copy.** Write in plain English for non-technical staff. Every error should say what happened and what to do next.
- **Viewers.** People in view-only mode can't see or change settings, but the configured branding and labels still apply to what they see. Enforce this the same way as the other editor controls. Gate the controls on the `is-editor` body class, and also guard every handler with `if (!editor) return`. Hiding a control isn't enough on its own.
- **Follow `CLAUDE.md`.** Its invariants apply to everything in this prompt.

## How to work

1. Read every file in `src/` before you change anything. Then send me a short plan: the data model for settings, where each setting is stored (school-wide or per-session), the migration, and any backend changes. **Wait for my OK before you implement.**
2. Implement in small steps. After each step, run `node build.js`.
3. Run `python3 test.py` after each step. All of its existing checks must keep passing, and you mustn't change their expectations so that they pass. Add checks for the new settings:
   - with no settings changed, the output matches today's: the same seat assignments and the same print HTML;
   - each new setting actually changes behaviour;
   - a viewer can't open Settings or change anything there;
   - data saved by the current version still loads after the migration.

   Update the check count in `README.md` and `CLAUDE.md`.
4. Update `README.md` (layout, architecture notes and test counts) and `SETUP_GUIDE.md` (where settings live, and what an existing install needs to do), and add a short section about the Settings tab to the in-app How-to Guides.
5. Commit in logical chunks with clear messages. Don't push unless I ask.

Finish with a short summary covering: what's now configurable, what's still fixed and why, anything you need from me (such as `Code.gs` or a redeploy step), and anything you couldn't verify. Excel import isn't covered by automated tests, so test it by hand if you changed it.
