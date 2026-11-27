# Prompt: usability review of Exam Rooms (teacher + engineer)

Copy everything below the line into a new Claude Code session opened at the root of the `compassaddons` repo.

---

Review **Exam Rooms**, the Compass button that seats an exam and makes its documents, for how well it works as an exam seating tool. Review it twice:

- **As a teacher.** You're a Victorian secondary school exam coordinator who isn't technical, under time pressure, getting a Year 10 exam ready.
- **As a software engineer.** You're responsible for it being correct, robust and maintainable.

**This is a review, not a fix.** Don't change any code until I've read your findings and said which to act on.

## Read first

- `exam-seating/CLAUDE.md`, especially the privacy rules and the Exam Rooms entries.
- `exam-seating/SETUP_GUIDE.md`, the section "Exam Rooms: seat an exam straight from Compass". This is what a coordinator would read.
- The tool's source:
  - `exam-seating/exam-rooms/core.js`: names, matching and seating.
  - `exam-seating/exam-rooms/docs.js`: the documents and the plan file.
  - `exam-seating/exam-rooms/ui.js`: the panel and the Compass calls.
  - `exam-seating/build_exam_rooms.js`: builds `exam-rooms.js` from those three.
- `exam-seating/exam-rooms.test.py`. Its `FakeCompass` class serves fictional Compass responses, so you can run the real tool in a browser without Compass.
- `exam-seating/test-data/`: fictional class lists, exemptions and SEA provisions in Compass's own formats.

## Rules

- **Fictional data only.** Use `test-data/` and the fake Compass. Never use real student names, and don't commit screenshots; keep them in your scratchpad.
- **Run the real tool.** Use the fake-Compass approach from `exam-rooms.test.py` with Playwright (Chromium is installed) and do the tasks below as a coordinator would: by clicking, typing and dragging, not by calling functions directly. Take screenshots at real desktop size, 1366×768 and 1920×1080, and of the printed documents at A4.
- **Evidence for every finding:** the steps to reproduce it, what happened, what a coordinator would expect, and a screenshot or quote where it helps.

## Part 1: as a teacher (coordinator tasks)

Do each task, time it, and count the clicks. Note every point where you hesitate, have to guess, or could make a mistake without noticing.

1. **First exam from scratch:**
   - Semester 2 Exam, Year 10, Monday AM and PM sessions.
   - BSSC Gym: 15 rows × 20 seats, using 17 per row.
   - Groups: Advanced Maths (10MAA1, 10MAA2), General Maths (10MAG1–10MAG3, 10MAGX) and Foundation Maths (10MAF1, 10MAF2), with a new row between groups.
2. **Paste the lists:**
   - Paste `Exemptions.csv` and `Provisions.csv` as if copied from Excel.
   - Resolve the typo, the nickname and the name that isn't on any list.
   - Notice the student who ends up on both the exempt and SEA lists. Is it obvious what to do?
3. **Seating changes:**
   - Pin one student to Row 1 Seat 1, and one to the back of their row.
   - Fix a surname, for example the "Jesse (Jesse Holloway)" case.
4. **On the chart:**
   - Make the room 16 rows, then back to 15.
   - Move one student; then pick a 2×3 block and move it.
   - Undo twice.
   - Unfix two students, then clear all fixed seats and undo that.
5. **Documents:** print, or save as PDF, each document. Check every page against the chart:
   - seat grid;
   - master list;
   - SEA Room list;
   - exempt list;
   - exam rolls.
6. **Save, then come back:** **Save session file**, close the tab, reopen Compass and **Open saved file**. Is anything lost?
7. **Next exam:**
   - **Duplicate exam** for English (10ENG1–10ENG4).
   - Confirm the seating starts fresh, then use **Copy seating from a saved exam** with the maths file.
   - Are the results what a coordinator expects for students who weren't in the maths exam?
8. **Things going wrong:**
   - a class code that doesn't exist;
   - Compass failing for one class (the fake can do this);
   - too many students for the room;
   - closing the panel by accident halfway through;
   - opening the wrong kind of file.

**For each task, judge:**
- **Clarity:** is it clear what to do next?
- **Wording:** are labels and messages plain English and free of jargon?
- **Results:** are the results trustworthy?
- **Mistakes:** can a mistake be spotted and undone?

**Overall, also consider:**
- **Exam-day needs:** does the tool match what a coordinator actually needs on exam day? That includes supervisors finding a student quickly, special arrangements being visible to the right people, and the rolls matching the room.
- **Printouts:** are names readable at A4, with no name cut off and nothing on the wrong page?
- **Accessibility:**
  - keyboard-only use, including the chart and drag and drop;
  - focus order;
  - colour contrast in the green, yellow and grey seat states;
  - labels for screen readers;
  - colour-blind-safe states.
- **Wording consistency:** for example "Master list" against "Seating list", "Fixed seat" against "pinned", and "SEA Room".

## Part 2: as an engineer

- **Correctness:**
  - Seating with gaps, pins, "back" pins, spare-seat overflow, block moves and swaps, undo, and copying seating.
  - Look for any way to lose a student, seat two students in one seat, or leave the documents out of step with the chart.
  - Try odd inputs:
    - a 1×1 room;
    - a 60×60 room;
    - zero students;
    - a student in three classes;
    - duplicate class codes;
    - a range like `10MAG6–10MAG1`;
    - an empty group.
- **Robustness:**
  - Compass errors and slow responses.
  - Double clicks.
  - Changing settings while classes are loading.
  - Pins pointing at students who have left.
  - A saved file from an older version.
  - Browser storage blocked.
- **Performance:** time a render and the document build with 300 students in a 20×25 room. `erBuildModel()` runs on every render, so is anything noticeably slow when dragging or typing?
- **Security and privacy:**
  - Everything shown on the page and in documents must go through `erEsc`. Try a name containing `<img onerror>`.
  - Nothing may be sent anywhere except Compass.
  - Reasons must never be stored or printed.
  - No student data may be kept in browser storage.
- **Maintainability:**
  - Structure of `ui.js` (size, state, event handling).
  - Duplication with the Exam Seating Manager.
  - Test coverage gaps: which risky behaviours have no check?
- **Compass assumptions:**
  - List every Compass endpoint and field the tool depends on.
  - Note which are proven by other tools in the repo and which are untested against real Compass. The teacher code is still initials, and the preferred-name format is still unconfirmed.

## Deliverable

Write `exam-seating/USABILITY_REVIEW.md` (fictional data only) with:

1. **One-paragraph verdict:** is this ready for a coordinator to use for a real exam? If not, what are the blockers?
2. **Findings table**, ranked by severity:
   - **Blocker:** wrong seating or documents, or data loss.
   - **Major:** likely to cause a mistake or a lot of wasted time.
   - **Minor.**
   - **Polish.**

   For each finding give: ID, perspective (Teacher or Engineer), severity, what happens, the evidence, and a recommended fix with a rough size (S, M or L).
3. **Task timings and click counts**, from Part 1.
4. **Quick wins:** at most 10 small changes with the biggest effect.
5. **Gaps you couldn't check here**, such as real Compass and real printers. Say what to check by hand.

Send me the summary and the top 5 findings, then **wait for me to choose** which to fix.
