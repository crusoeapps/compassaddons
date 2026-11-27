# Exam Rooms: usability review (teacher + engineer)

*27 November 2026. Reviewed against `master` at 29234f7, using only the fictional `test-data/` and the fake Compass from `exam-rooms.test.py` (extended with the four fictional 10ENG classes). Every task was done in Chromium at 1366×768 by clicking, typing and dragging, the way a coordinator would. Screenshots were kept out of the repo.*

## Verdict

**Nearly ready, but not yet for a real exam without a coordinator double-checking two things.**

The seating itself is sound:
- Nobody was lost or seated twice in any scenario, including the edge cases.
- Every document matched the chart.
- Errors are explained in plain English and block the documents until they're fixed.
- Privacy holds: the tool only contacts Compass and stores nothing in the browser.
- It's fast even with 300 students.

**Blockers for exam day:**
1. **SEA students are on their class rolls with no hint that they sit in the SEA Room**, so a gym supervisor can mark them absent (T1).
2. **Very long surnames shrink to an unreadable 2–3 pt** on the supervisor grid (T2).

**Highest-risk annoyance:** closing the Compass tab loses everything since the last save, with no warning (T3). Fix these three and it's ready for a real cycle.

## Findings

Severity: **Blocker** means wrong or unusable exam-day output, or data loss. **Major** means likely to cause a mistake or a lot of wasted time. **Minor** and **Polish** are lower.

| ID | View | Severity | What happens | Evidence | Recommended fix | Size |
|---|---|---|---|---|---|---|
| T1 | Teacher | **Blocker** | Exam rolls list SEA students like everyone else (e.g. Vera BECKETT in 10MAA2), with no "SEA Room" note, and no student's room or seat appears on the roll. A gym supervisor marks them absent, or can't find a student quickly. | Roll page for 10MAA2 (doc-rolls); `erRollPage` has no room or seat column. | Add a **Room / Seat** column (e.g. "BSSC Gym R3 S7", "SEA Room"), or at least mark SEA students "SEA Room" the way exempt students show <Exempt>. | S |
| T2 | Teacher | **Blocker** | On the supervisor grid, shrink-to-fit takes a 24-letter surname down to **3.5 px (about 2.6 pt)**, which is unreadable on paper. Real data last cycle went to 4.1 pt. | Document check: smallest grid font 3.5 px; QUILLFEATHER-BRANDENBURG in R1S15 is illegible. | Set a floor of about 6 pt, and let long names wrap onto two lines at a hyphen or space, or abbreviate (e.g. "QUILLFEATHER-B."). | S |
| T3 | Teacher | **Major** | Closing or reloading the Compass tab loses all work since the last **Save session file**: no warning, no autosave. | `onbeforeunload` is not set; a fresh tab opens on step 1 with empty fields. | Warn before leaving when there are unsaved changes, show "Unsaved changes" next to Save, and optionally keep a non-student draft (settings only). | S |
| T4 | Teacher | **Major** | On a 1366×768 laptop the seating chart starts below the fold. Undo, Copy seating, Clear fixed seats, the room-size boxes and two paragraphs of help take about 400 px, leaving 4 seat rows visible. | Screenshot 08-chart. | Put the tools in one compact toolbar row, collapse the help into a "How to move students" link, and give the grid its own scroll area of at least 70% of the height. | M |
| T5 | Engineer | **Major** | The chart can't be used without a mouse. 0 of 500 seat cells can be reached with Tab, and moving or swapping is mouse-only. The 3 room-size boxes aren't linked to their labels, and the panel has no dialog role. | Accessibility check: `keyboardFocusableCells: 0`, `unlabeled: 3`; Tab goes from the room-size boxes straight to Back and Next. | Give cells a roving tabindex with Enter to pick or place and arrow keys to move; add `<label for>` or `aria-label`; add `role="dialog"` and `aria-modal` to the panel. | M |
| T6 | Teacher | Minor | The supervisor grid header shows only "Semester 2 Exam · Year 10", with no date or session. | doc-grid. | Add the date, sessions and times to the grid and list headers. | S |
| T7 | Teacher | Minor | The "on both the exempt and SEA lists" warning appears only on the Seating chart, not on the Exemptions or SEA steps where you'd fix it. | Visible on Chart only, not on Exemptions or SEA. | Show the same warning on both list steps. | S |
| T8 | Teacher | Minor | **Duplicate exam** clears the exempt and SEA lists. In a real cycle the same exemptions and provisions applied to Maths and English, so they had to be pasted again. | Duplicate dialog and notice. | Add a tick box in Duplicate: "Keep the exempt and SEA lists (same exam period)". | S |
| T9 | Teacher | Minor | The chart doesn't show which group a student is in. Groups are only visible as gaps, which makes block moves and checking the order slow. | Screenshot 08-chart; the group shows only in a hover tooltip. | Give each group a light colour, with a legend matching the footer ranges. | S |
| T10 | Teacher | Minor | "Please confirm" rows start on "Choose…", even when there's one strong suggestion (e.g. "Oliver THISTLEWOOD – Nickname for Oliver"). Every confirmation means opening a drop-down. | Exemptions screenshot. | Show the suggestion inline with **Yes, that's them** and **No / someone else** buttons. Keep the never-guess rule. | S |
| T11 | Teacher | Minor | The chart shows rows as **columns** ("Row 1" across the top, "Seat 1" down the side). It matches the printouts, but it isn't how most people picture a room. | Chart and grid. | Label the edges "Front (Row 1)" and "Seat 1 side", or offer a turned view. | S |
| E1 | Engineer | Minor | Clicking **Get students from Compass** twice starts two loads: 11 Compass requests instead of about 6. The result is correct, but it's wasteful and could race. | Double-click test: 11 requests. | Disable the button while loading, or ignore a second click. | S |
| E2 | Engineer | Minor | A reversed range like `10MAG6–10MAG1` is kept as one literal code, then reported as "No class called 10MAG6-10MAG1". | `expandCodes('10MAG6-10MAG1')` returns `['10MAG6-10MAG1']`. | Expand reversed ranges, or say "this range is backwards". | S |
| E3 | Engineer | Minor | Changing the class codes while classes are loading leaves the new codes unloaded until **Get students** is clicked again. Documents are correctly blocked, but nothing says "click Get students again". | `classProblems: ['10MAF1']`. | When the codes change, mark the old load as stale and show "Codes changed: get students again". | S |
| E4 | Engineer | Polish | **Retry** is offered for a class code that doesn't exist, where retrying can't help. | 12-errors. | For "not found", show "Fix the code" instead of Retry. | S |
| E5 | Engineer | Polish | Moving one student gives no message, but moving a group does ("Moved 6 students"). | Notice empty after a single move. | Show "Moved Beau VARLEY to Row 2 Seat 18" for consistency, and so Undo is discoverable. | S |
| E6 | Engineer | Polish | "Back of their row" puts the student in the last *used* seat (e.g. 17), not a spare seat (18–20) as was done by hand last cycle. | `seat()` with use 4 of 6 puts them at seat 4. | Offer "Back of row (spare seat)" as well. | S |

### What held up well (no finding)

- **Correctness:** no lost or doubled students in any case tested:
  - 1×1 room (overflow reported);
  - zero students;
  - empty groups;
  - duplicate codes (removed);
  - a fixed seat outside the room, or two students fixed to one seat (both reported in plain English);
  - block moves with swaps;
  - undo;
  - copying seating;
  - clearing fixed seats.

  Every document matched the chart, and the plan reopened with identical seats.
- **Errors:** missing classes, Compass failures, names on both lists, and students who don't fit all block the documents, with a plain-English reason and a fix.
- **Security:** a name containing `<img onerror>` or `<svg onload>` didn't run in the panel or in any document; everything is escaped.
- **Privacy:** the only host contacted was Compass. `localStorage` and `sessionStorage` were empty after use. Reasons are never printed or saved.
- **Performance:** 300 students in a 20×25 room took about 1 ms to build the model, 23 ms to draw the chart and 8 ms to make the documents. Moves are instant.
- **Recovery:** **Close** only hides the panel, so clicking the button again brings it back with everything intact. **Open saved file** restored the seats exactly and reported who had joined or left.

## Task action counts (Part 1)

These are counts of clicks, typed fields, drags and keys from the scripted walkthrough. The human times are **estimates** for a first-time coordinator; the script itself ran each task in 1–3 seconds.

| Task | Clicks | Typed fields | Keys | Estimated human time | Hesitation points |
|---|---|---|---|---|---|
| 1. Set up the exam, room and 3 groups; get students | 8 | 14 | 0 | 4–5 min | Where the room size goes (step 1, not the chart); what "Gap after this group" will look like |
| 2. Paste exemptions and SEA; resolve 3 names | 10 | 2 | 0 | 3 min | "Please confirm" means opening each drop-down (T10); the "both lists" warning is only on the chart (T7) |
| 3. Fix 2 seats and 1 surname | 10 | 3 | 0 | 2 min | A long A–Z drop-down with repeated surnames (classes are shown, which helps) |
| 4. Resize, move one, move a block, undo, unfix, clear | 16 | 2 | 1 | 3–4 min | Grid mostly off-screen on a laptop (T4); groups not visible (T9) |
| 5. Make every document | 1 (+1 per print) | 0 | 0 | 2 min | None |
| 6. Save, close the tab, reopen | 2 | 0 | 0 | 1 min | Easy to forget to save; no warning (T3) |
| 7. Duplicate for English, copy seating | 7 | 3 | 0 | 2–3 min | Lists must be pasted again (T8) |
| 8. Things going wrong | 6 | 2 | 0 | n/a | Retry shown for a code that doesn't exist (E4) |

## Quick wins (biggest effect for the least work)

1. **Room / Seat column on the rolls**, with SEA students marked "SEA Room" (T1).
2. **Minimum name size with wrapping** on the grid (T2).
3. **Warning before leaving with unsaved changes** (T3).
4. **Compact chart toolbar**, with help collapsed, so the grid is visible on a laptop (T4).
5. **Date and session in every document header** (T6).
6. **"Keep exempt and SEA lists" option** in Duplicate (T8).
7. **"On both lists" warning** on the Exemptions and SEA steps (T7).
8. **Group colours and a legend** on the chart (T9).
9. **Disable Get students while it's loading** (E1).
10. **"Yes, that's them" buttons** for suggested name matches (T10).

## What couldn't be checked here

- **Real Compass:** endpoint shapes, paging over 100 enrolments, and how preferred names appear in `GetEnrolmentsByActivityId` (bracketed or not). The teacher code is still **initials** taken from `userFullName`, not yet confirmed against the school's codes. The endpoints relied on, all already used by `class-export-csv.js` and `class-dashboard.js`:
  - `Subjects.svc/GetSubjectsInAcademicGroup` (`academicGroupId: -1`);
  - `Subjects.svc/GetStandardClassesOfSubject`;
  - `Activity.svc/GetEnrolmentsByActivityId` (`n`, `pi`, `uid`);
  - `User.svc/GetUserDetailsBlobByUserId`.
- **Real printers:** A4 scaling and margins on the school's copiers, and how readable the smallest grid font is in print.
- **Screen readers and real keyboard-only use:** checked by inspecting the page, not with NVDA or VoiceOver.
- **Older SOE browsers:** only current Chromium was tested.

## Engineering notes

- **`ui.js` is about 1,030 lines.** It holds a single global state (`ER`) and rebuilds the whole panel's HTML on every change. That's simple and fast enough at this size, but it's the reason for focus loss and the keyboard gaps (T5). Splitting the chart into its own render and event module would make T4, T5 and T9 easier.
- **`erBuildModel()` is called in 10 places and recomputes everything each time.** That's fine at 300 students (about 1 ms); no action needed.
- **Test gaps:** nothing checks keyboard operation, a leave warning, minimum print size, or roll room/seat details. Add checks with the fixes above.
