# Prompt: Compass "Exam Seating" button

Copy everything below the line into a new Claude Code session opened at the root of the `compassaddons` repo.

---

Build a new Compass tool called **Exam Rooms**. It runs inside Compass from a bookmark button, the same way the other tools in this repo do. In one pass it should:

1. Read class lists straight from Compass using class codes.
2. Take the exemption and SEA (special exam arrangements) lists the coordinator pastes in.
3. Seat everyone using the rules below.
4. Save the room charts, lists and rolls as documents on the coordinator's computer.

Today this whole job is done by hand: export CSVs from Compass, clean the names, seat students in the Exam Seating Manager, then print. This tool should do it from one button.

## Read these first

- **`compass-tools.js`: how buttons work.** The bookmark loads the launcher, and the launcher loads a tool script from `https://crusoeapps.github.io/compassaddons/`. Tools run in the teacher's own browser, use their existing Compass login, and talk **only** to Compass.
- **`class-list.js`, `class-dashboard.js`, `exam-results.js`, `attendance-class.js`: how existing tools call Compass.** These already use `/Services/Subjects.svc/GetSubjectsInAcademicGroup`, `GetStandardClassesOfSubject`, `/Services/Activity.svc/GetEnrolmentsByActivityId` and `/Services/User.svc/GetUserDetailsBlobByUserId`.
  - Copy the request style these tools use: headers, `limit`/`start` paging, and how they find the academic group.
  - **Don't guess endpoint names or response fields.** If a value you need, such as a class's lead teacher, isn't in a response these tools already read, say so and stop, so I can capture a real response from Compass for you.
- **`exam-seating/`: the Exam Seating Manager, including its `CLAUDE.md`.**
  - The tool's output must be a plan file that the Manager's **Open file** accepts: `app: 'Exam Seating Manager'`, `format: 1`. See `src/part7_files.js`.
  - Reuse its print look and rules where you can. In `src/part5_lookup_print_help.js` that means the hidden-iframe printing, the seat-grid renderer and `fitStyle()`, which shrinks long names to fit their box.
- **`exam-seating/test-data/`: fictional files in the Compass GridExport format.** They cover every awkward case found this cycle and can be used as fixtures.

## Privacy rules (the repo and website are public)

- **No student data in the repo, ever.** That includes code, fixtures, screenshots and docs. Tests use fictional data only. `.gitignore` ignores `*.json` and `*.csv`; add narrow exceptions only for fictional fixtures.
- **Student data must only be sent to Compass.** No analytics, no third-party scripts, no external libraries that receive data. Generated documents go to the user's own computer via a download or "Save as PDF".
- **Keep the button private.** Do **not** add it to `TOOLS` in `compass-tools.js` or to `index.html`. Instead, give me a separate bookmark (a `javascript:` URL in the same style as the launcher) that loads `exam-rooms.js` directly. Mention in your summary that it can be added to the menu later.
- **Treat reasons for provisions as sensitive.** Keep them only in memory and in the plan file; never print them (see "Outputs").

## What the coordinator does in the tool

It's a panel in the same style as the Compass Tools menu, worked through one step at a time.

1. **Exam details.**
   - Exam name (e.g. "Semester 2 Exam"), year level, and the dates and sessions for the roll. For example: "Monday 16 November AM" and "Monday 16 November PM", allowing one or more sessions.
   - School name, defaulting to Crusoe College.
2. **Groups.** Each group has a name and the class codes in it, for example:
   - Advanced Maths: `10MAA1, 10MAA2`
   - General Maths: `10MAG1–10MAG6, 10MAGX`
   - Foundation Maths: `10MAF1, 10MAF2`

   The tool fetches each class's enrolments and lead teacher from Compass. It shows how many students it found per class and flags any code it can't find. A student in more than one class of the same group is seated **once**.
3. **Room.**
   - Name (e.g. "BSSC Gym"), the number of rows and the number of seats per row (e.g. 15 × 20).
   - How many seats to **use** in each row (e.g. 17). The rest stay spare and empty.
   - The order the groups are filled in.
   - The gap after each group:
     - **one seat**;
     - **start on a new row**;
     - **new row plus one empty row**.
4. **Exemptions.** Paste a list of first and last names. These students are left out of the seating but still listed on the roll as **<Exempt>**.
5. **SEA students.** Paste the table with columns First name, Last name, Form, Reason and Provision. These students go to a second room, the "SEA Room", which is a list, not a grid. Each one can be ticked "stays in the main room" instead; their provision is still recorded.
6. **Fixed seats (optional).** Pin a student to a seat (e.g. Tess BRAMLEY in Row 1 Seat 1), or to "back of their row", meaning seat N of the row they'd otherwise land in. Everyone else fills in around pinned students.
7. **Name fixes (optional).** A small table of surname overrides (e.g. Jesse PEMBERTON should be HOLLOWAY), applied before sorting.
8. **Check.** Show a preview of the grid and the matching report: every exemption, SEA entry and fixed seat, and the student each one matched or "not found". The coordinator must confirm anything that wasn't an exact match before continuing.
9. **Create documents.**

## Matching names (pasted lists against Compass)

Real lists from this cycle had typos and nicknames, so matching must be careful, and it must never silently pick the wrong student.

- An exact match on first and last name is automatic. Ignore case, spaces, hyphens and apostrophes.
- Accept a pasted first name that matches the student's **preferred** name in Compass.
- These need the coordinator to confirm:
  - A known nickname, e.g. Ollie for Oliver.
  - One letter different in the surname, e.g. "Kyaww" for KYAW, when the first name matches.
  - A longer first name that matches, e.g. "Ler Paw" for "Ler Paw Myint".
- Report anything unmatched; never guess it. In a real cycle, one pasted name matched nobody, and the coordinator had to choose the right student by hand.
- Don't confuse students who share a surname or have very similar surnames. A one-letter surname match is never automatic.

## Names on documents

- **Use the preferred name where practical.**
  - Compass shows "Annabel (Annie) FAIRWEATHER"; print **Annie**.
  - If the bracket holds a different surname, keep the legal first name: "Jesse (Jesse Holloway) PEMBERTON" prints Jesse. The surname-overrides table is how the coordinator switches the surname.
  - A bracket with a shortened form of a long name counts as a preferred name: "Nyein Thu Zar (Thu)" prints Thu.
- **No brackets anywhere** on the documents.
- **Show first name and last name in separate columns.** Last names are in bold capitals.
- **Sort by last name, then first name**, using plain case-insensitive comparison.

## Seating rules

- Fill row by row. Row 1 is the front. In each row, fill seat 1 up to the "use" limit.
- Fill the groups in the chosen order, each in alphabetical order. Pinned students come first where they're pinned to, e.g. a student pinned to R1S1 with the rest of their group alphabetical after them.
- Apply each group's gap rule between groups.
- Pinned seats are reserved, and the fill flows around them.
- **If it doesn't fit, say so before creating anything.** Report how many students won't fit and offer choices: use more seats per row, use smaller gaps, or put the overflow in the spare seats. Never quietly drop or squeeze students. This happened this cycle: 223 students into 15 × 15 seats with a blank row didn't fit.

## Outputs

Each output should be a print-ready A4 page, opened through a hidden iframe so the coordinator can choose **Save as PDF**. There should also be a **Download all** button that saves every document as a self-contained `.html` file plus the plan `.json`. File names must not mention the subject unless the coordinator types it.

1. **Seat grid**, one sheet per grid room, A4 landscape.
   - Title: "‹School› — ‹Room› Supervisor Sheet". Subtitle: "‹Exam› · ‹Year›".
   - Rows run across the page and seats run down. Each box shows the first name and, under it, the bold last name, **shrunk to fit its box** using `fitStyle()`.
   - **Footer:** one line per group with its seat ranges, worked out from the actual seats, e.g. "Advanced Maths – Row 1 Seat 1 to Row 3 Seat 11 (45 students)". Pinned seats outside a group's range are added, e.g. ", and Row 8 Seat 20".
2. **Master list**, A4 portrait, A–Z by last name. Columns: First name, **Last name**, Room, **Row**, **Seat**. **No Status column, no Class column, no provisions.** SEA students show "SEA Room" with Row and Seat left blank.
3. **SEA Room list**, A4 portrait. Columns: First name, **Last name**, Class, Room, Arrangements (the provision). **No Status column and no Reason column.**
4. **Exam roll**, A4 portrait, **one page per class code**, covering every class in every group, exempt students included.
   - Title: "‹School› — Exam Roll ‹CLASS›". The class's **lead teacher code at about 24pt in the top right**.
   - Columns: #, First name, **Last name**, then one tick-box column per session, e.g. "Mon 16 Nov AM" and "Mon 16 Nov PM".
   - Exempt students are greyed, with **<Exempt>** written across their tick boxes.
   - Signature lines at the bottom, one per session.
5. **Plan file** (`.json`) that the Exam Seating Manager opens. Include the grid room with the spare seats left open, the SEA Room as a "Special provisions" list room, and each student's provision in `arrangements`, with their group name in `notes`. Reasons are not stored in `notes`; keep them in a separate field that nothing prints, or leave them out. Ask me which.

## Constraints

- Follow the repo's conventions: plain ES5 (`var`, `function`) apart from `async`/`await` around Compass calls, everything that goes into the page passed through an escape function, and plain-English messages for non-technical staff.
- Handle Compass being slow or refusing a request with a friendly message, and let the user retry a single class without starting over.
- Don't change existing tools or the Exam Seating Manager's behaviour. If you need shared code, factor it out carefully. The Manager's `python3 exam-seating/test.py` (103 checks) must still pass, including the check that default output is identical to the original.

## Testing

You can't reach Compass here, so test against fictional fixtures.

- **Recorded responses.** Write fictional JSON responses shaped exactly like the responses the existing tools parse, for subjects, classes, enrolments and user details. Serve them with Playwright `page.route`, and load the tool into a stub page. The fixture names come from `exam-seating/test-data/` (`make_test_data.py`).
- **Scenarios to cover:**
  - every name case in that folder;
  - exemptions with a typo, a nickname and a name that matches nobody;
  - a student in two classes;
  - a pinned seat in the middle of a group, and one at the back of a row;
  - each gap rule;
  - the "doesn't fit" warning;
  - a Compass error part-way through.
- **Check every output.**
  - Assert on each document's columns and content, including that no Status, Class or Reason appears where it's banned.
  - Render the seat grid at real A4 size and check that no name overflows its box.
  - Check the plan file opens in the Manager and gives the same seats.
- Add the suite as `exam-rooms.test.py` next to the tool, and make it runnable with one command.

## How to work

1. Read the files above, then send me a short plan. **Wait for my OK** before writing code. The plan should cover:
   - the Compass calls and fields you'll use, each with the existing file and line it comes from;
   - the panel's steps;
   - how you'll share code with the Exam Seating Manager;
   - the plan-file mapping;
   - anything you need from me, such as a real captured response for lead teachers.
2. Build in small steps, commit each one with a clear message, and push only when I ask.
3. Finish with:
   - the private bookmark link;
   - a two-minute "how to use it" for coordinators, added to `exam-seating/SETUP_GUIDE.md`;
   - what you tested and how;
   - anything you couldn't check without real Compass access.
