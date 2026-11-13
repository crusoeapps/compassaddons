# Exam Seating Manager — Setup & Operations Guide

Crusoe College · Three pieces make the system work.

| Piece | What it is | Who touches it |
|---|---|---|
| `Exam_Seating_Manager.html` | The app everyone opens | Everyone (viewers just open the link) |
| A Google Sheet + `Code.gs` | The shared database | You, once, at setup |
| The editor password | Unlocks editing in the app | The 2–3 coordinators |

**You can use the app right now with no setup at all.** Open the HTML file and it runs in *local mode*: a demo Year 9 session with made-up names is already loaded, and the editor password is `crusoe2026`. Everything works except sharing — data stays in that one browser. Use **Save to file** to keep a backup or move your plan to another computer. Do Part 1 when you're ready for live shared data.

> **Two copies, two jobs.** The copy on the compassaddons site (not listed in the Compass Tools menu) must stay in **local mode** — it is a public website, and with an `API_URL` set anyone opening it could read the shared data. For shared mode, put a separate copy with your `API_URL` somewhere private (Part 3).

---

## Part 1 — Create the shared database (~10 minutes, once)

1. Go to **sheets.new** signed in with your school Google account. Name the sheet **Exam Seating Data**.
2. **Extensions → Apps Script.** Delete the placeholder code, paste in the entire contents of `Code.gs`, and save (the disk icon).
3. In the toolbar, choose the function **setup** and press **Run**. Approve the permissions prompt — it's your own script accessing your own sheet. This creates the Sessions, Students, Rooms, Separations, Templates and Settings tabs.
4. Set the editor password: **Project Settings** (gear icon, left side) → scroll to **Script Properties** → **Add script property**.
   - Property: `EDITOR_PASSWORD`
   - Value: whatever password the coordinators will share
   - **Save script properties**
5. **Deploy → New deployment →** gear icon **→ Web app**:
   - Description: `Exam seating backend`
   - Execute as: **Me**
   - Who has access: **Anyone** ← required so the app can reach it. Writing still needs the password.
6. **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

> **Test it:** paste that URL into a browser tab and add `?action=ping` on the end. You should see a short "backend is running" message.

## Part 2 — Connect the app

1. Open `Exam_Seating_Manager.html` in any plain text editor (Notepad is fine). Don't use Word.
2. Find this near the top of the script section:
   ```js
   var CONFIG = {
     API_URL: '',
   ```
3. Paste your web app URL between the quotes, so it reads `API_URL: 'https://script.google.com/.../exec',`
4. Save.

That is the only edit the HTML file ever needs.

## Part 3 — Host the app

Either option works; the file is identical for both.

**Option A — Netlify (free, fastest):** rename the file to `index.html`, go to **app.netlify.com/drop**, and drag it onto the page. You get a URL like `crusoe-exams.netlify.app` to share with staff. To update later, drag the new file onto the same site. Turn on Netlify's password protection (or use Option B) — otherwise this is a public address.

**Option B — School intranet:** give the file to IT to place on the intranet web server and share the resulting link.

> Keep the link internal either way — it shows student names. Viewers can't change anything, but anyone with the URL can see the plan.

## Part 4 — Who does what

**Viewers (all staff):** open the link. Look up a student's seat, browse the plan, print any sheet. No password. Nothing they click can change the data.

**Editors (2–3 coordinators):** open the link → **Editor sign in** → password. The pill at top right shows **Synced** once a change has saved (it saves automatically a second or two after each change).

**The Google Sheet:** you shouldn't need to open it, but if you do, the Students tab holds the live data. If you edit there directly, refresh the app afterwards.

## Running an exam — the short version

1. Editor sign in → **Exam Sessions** → **+ New session**, choose a room template if you have one (the demo data includes *NAPLAN standard setup*).
2. **Students** → **Import Excel / CSV** → pick your list → check the column matching → Import.
3. **Seating Plan** → check **Seating rules** (spacing, fill direction, order) → **Generate seating**.
4. Adjust: click two seats to swap, or use **Keep-apart pairs** then regenerate.
5. **Print** → seat grids, master list, special arrangements, withdrawals.

The **How-to Guides** tab inside the app covers all of this for staff who've never seen it.

## Customising the app (Settings tab)

Editors see a **Settings** tab. Changes apply only when you click **Save settings**, and they are shared with every editor through the Google Sheet (local mode: this browser only).

| Where | What you can change | Applies to |
|---|---|---|
| Settings → School & branding | School name, header line, colour, logo | Whole app and every printout |
| Settings → Room types | Name, seat grid or list, print title (gives the type its own Print sheet) | Whole school |
| Settings → Statuses | Name, colour, which room type it goes to, import words; add, reorder, delete | Whole school |
| Settings → Seating defaults | Order, spacing, fill direction, keep-apart rule | New sessions only |
| Settings → Print | Orientation, columns, supervisor / times lines, an instructions line | Every printout |
| Seating Plan → Seating rules | Same rules as the defaults, for this session | One session |
| Rooms & Layout → Edit | Blocked seats and aisles, row/seat labels (numbers or letters), supervisor, fill order (▲▼) | One room |
| Exam Sessions → Edit | Start and finish times | One session |
| Students → Edit | Special arrangements and notes | One student |

With nothing changed, the app behaves exactly as it always has. A status that any student still has cannot be deleted — move those students to another status first. Logos are shrunk automatically so they fit in the Sheet.

## Updating an existing install

If your Google Sheet was set up before the Settings tab existed, the app still works, but the Settings tab shows a yellow notice and settings cannot be saved. Do this once:

1. Open the Sheet → **Extensions → Apps Script**. Select all the old code, paste in the new `Code.gs`, and save.
2. Choose the function **setup** and press **Run**. It adds the Settings tab and two new columns (`settingsJson` on Sessions, `layoutJson` on Rooms). It never deletes or moves data.
3. **Deploy → Manage deployments →** pencil (Edit) **→ Version: New version → Deploy.** Use *Manage deployments*, **not** *New deployment* — a new deployment gets a different URL and the app would stop connecting.
4. Replace the hosted `Exam_Seating_Manager.html` with the new one at the same time.

> Update the backend and the app together. An old copy of the app saving to an updated Sheet would clear the new room-layout column (blocked seats and labels).

## Maintenance & recovery

- **Plan files:** **Exam Sessions → Save to file** downloads every session and your settings as one `.json` file. **Open file** (editors) loads it back: in local mode you can replace everything or add the sessions; in shared mode the sessions are always added as new ones. The file contains student names — keep it in your school OneDrive or Google Drive.

- **Backup:** in the Google Sheet, File → Make a copy. Do this before each exam period.
- **Change the editor password:** Apps Script → Project Settings → Script Properties → edit `EDITOR_PASSWORD`. Takes effect immediately.
- **"Offline" or "Save failed" in the app:** it couldn't reach the Sheet — usually internet, or the school firewall blocking `script.google.com`. The change wasn't saved; redo it once you're back online.
- **"Someone else saved first":** two editors had the same session open. Click **Reload latest** and redo the change. This is by design — it prevents one coordinator silently overwriting another.
- **Update the app:** replace the hosted HTML file. Data lives in the Sheet, so app updates never touch it.

## A note on your source spreadsheet

The Year 9 MASTER sheet ends with five statistics rows — Minimum, Maximum, Standard Deviation, Mean, Median — in the First Name column. The old dashboard imported these as if they were students (the Year 7 list shows a student named "Standard Deviation"). Real counts for Year 9 are **218 students: 212 in GYM, 2 special provision, 4 withdrawn/exempt**.

The importer now skips any row without a surname and tells you how many it skipped, so this can't recur. Worth checking your Year 7 numbers against this.
