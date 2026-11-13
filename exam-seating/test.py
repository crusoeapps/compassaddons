import sys, json
from playwright.sync_api import sync_playwright

import os
APP = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "Exam_Seating_Manager.html")
errors, logs = [], []
fails = []

def check(name, cond, extra=""):
    print(("PASS  " if cond else "FAIL  ") + name + (" :: " + str(extra) if extra and not cond else ""))
    if not cond:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.on("console", lambda m: (logs.append(m.text), errors.append(m.text)) if m.type == "error" else logs.append(m.text))
    pg.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    pg.goto(APP)
    pg.wait_for_timeout(1500)

    net = [e for e in errors if "ERR_TUNNEL" in e or "Failed to load resource" in e]
    real = [e for e in errors if e not in net]
    check("no JS errors on load (CDN blocked offline, ignored)", not real, real[:3])
    check("sessions render", pg.locator(".session-card").count() >= 1,
          pg.locator(".session-card").count())
    body = pg.inner_text("#main")
    check("seed session visible", "NAPLAN 2026" in body, body[:120])
    check("view-only notice shown", pg.locator(".view-note").first.is_visible())
    check("editor-only button hidden for viewers",
          not pg.locator("button:has-text('+ New session')").first.is_visible())

    # Open the session
    pg.locator(".session-card").first.click()
    pg.wait_for_timeout(500)
    rows = pg.locator("table.data tbody tr").count()
    check("students table populated (218 real students)", rows == 218, rows)

    # Lookup works for a viewer
    pg.click("nav button[data-tab='lookup']")
    pg.fill("#searchInput", "ABBOTT")
    pg.wait_for_timeout(400)
    check("lookup finds student", "ABBOTT" in pg.inner_text("#searchResults"),
          pg.inner_text("#searchResults")[:120])
    check("lookup shows seat", "Row 1" in pg.inner_text("#searchResults"),
          pg.inner_text("#searchResults")[:160])

    # Seating plan renders for viewer
    pg.click("nav button[data-tab='seating']")
    pg.wait_for_timeout(700)
    seats = pg.locator(".seat-cell").count()
    check("seat grid renders (12x18=216 cells)", seats == 216, seats)
    filled = pg.locator(".seat-cell .sc-lastn").count()
    check("seats are filled (212 GYM students)", filled == 212, filled)
    check("seating toolbar hidden for viewer",
          not pg.locator("button:has-text('Generate seating')").first.is_visible())

    # Rooms tab hidden for viewer
    check("rooms tab hidden for viewer",
          not pg.locator("nav button[data-tab='rooms']").is_visible())

    # ---- sign in as editor ----
    pg.click("#editorBtn")
    pg.wait_for_timeout(300)
    pg.fill("#pwInput", "wrongpass")
    pg.click("#modalFoot button:has-text('Sign in')")
    pg.wait_for_timeout(400)
    check("wrong password rejected", "Wrong password" in pg.inner_text("#toast"),
          pg.inner_text("#toast"))

    pg.fill("#pwInput", "crusoe2026")
    pg.click("#modalFoot button:has-text('Sign in')")
    pg.wait_for_timeout(600)
    check("editor mode unlocked", "is-editor" in (pg.get_attribute("body", "class") or ""))
    check("rooms tab now visible", pg.locator("nav button[data-tab='rooms']").is_visible())

    # Rooms tab
    pg.click("nav button[data-tab='rooms']")
    pg.wait_for_timeout(400)
    check("3 rooms configured", pg.locator(".room-card").count() >= 3,
          pg.locator(".room-card").count())
    check("template listed", "NAPLAN standard setup" in pg.inner_text("#main"))

    # Seating: swap two students
    pg.click("nav button[data-tab='seating']")
    pg.wait_for_timeout(700)
    cells = pg.locator(".seat-cell")
    n0 = cells.nth(0).inner_text()
    n1 = cells.nth(1).inner_text()
    cells.nth(0).click(); pg.wait_for_timeout(200)
    cells.nth(1).click(); pg.wait_for_timeout(500)
    a1 = pg.locator(".seat-cell").nth(0).inner_text()
    b1 = pg.locator(".seat-cell").nth(1).inner_text()
    check("seat swap works", a1 == n1 and b1 == n0, f"{n0}/{n1} -> {a1}/{b1}")

    # Keep-apart: add a pair then regenerate and verify no conflicts
    pg.click("#main button:has-text('Keep-apart pairs')")
    pg.wait_for_timeout(400)
    optvals = pg.eval_on_selector("#ka_a", "el => [el.options[0].value, el.options[1].value]")
    pg.select_option("#ka_a", optvals[0])
    pg.select_option("#ka_b", optvals[1])
    pg.click("#modalBody button:has-text('Add pair')")
    pg.wait_for_timeout(500)
    check("keep-apart pair added", "Keep-apart pairs" in pg.inner_text("#modalTitle"))
    pg.click(".modal-head button")
    pg.wait_for_timeout(300)

    pg.click("#main button:has-text('Generate seating')")
    pg.wait_for_timeout(1500)
    conflicts = pg.locator(".seat-cell.conflict").count()
    check("no keep-apart conflicts after generate", conflicts == 0, conflicts)
    refilled = pg.locator(".seat-cell .sc-lastn").count()
    check("all completing students reseated", refilled == 212, refilled)

    # Change a status and confirm the student leaves the grid
    pg.click("nav button[data-tab='students']")
    pg.wait_for_timeout(500)
    pg.fill("input[placeholder='Filter by name or class']", "ABBOTT")
    pg.wait_for_timeout(400)
    pg.locator("table.data tbody button:has-text('Edit')").first.click()
    pg.wait_for_timeout(400)
    pg.select_option("#f_status", "Withdrawn")
    pg.click("#modalFoot button:has-text('Save changes')")
    pg.wait_for_timeout(600)
    txt = pg.inner_text("table.data tbody")
    check("status change applied", "Withdrawn" in txt, txt[:160])
    check("withdrawn student routed to BL3", "BL3" in txt, txt[:160])

    pg.click("nav button[data-tab='seating']")
    pg.wait_for_timeout(700)
    after = pg.locator(".seat-cell .sc-lastn").count()
    check("withdrawn student removed from grid (211)", after == 211, after)
    check("unseated panel not shown (nobody pending)",
          pg.locator(".unseated-panel").count() == 0)

    # Print: master list builds without error
    pg.click("nav button[data-tab='print']")
    pg.wait_for_timeout(400)
    check("print options listed", "Supervisor seat grids" in pg.inner_text("#main"))
    check("GYM print button present", pg.locator("button:has-text('GYM seat grid')").count() == 1)

    # Help
    pg.click("nav button[data-tab='help']")
    pg.wait_for_timeout(300)
    check("10 how-to guides", pg.locator(".help-item").count() == 10,
          pg.locator(".help-item").count())
    pg.locator(".help-item button").first.click()
    pg.wait_for_timeout(300)
    check("guide expands", pg.locator(".help-item.open .help-body").first.is_visible())

    # Persistence across reload (local mode)
    pg.reload()
    pg.wait_for_timeout(1500)
    pg.click("nav button[data-tab='students']")
    pg.wait_for_timeout(500)
    pg.fill("input[placeholder='Filter by name or class']", "ABBOTT")
    pg.wait_for_timeout(400)
    check("edit persisted after reload", "Withdrawn" in pg.inner_text("table.data tbody"),
          pg.inner_text("table.data tbody")[:120])
    check("reverts to view-only after reload",
          "is-editor" not in (pg.get_attribute("body", "class") or ""))

    # ================================================================
    #  CUSTOMISATION (Settings tab, seating rules, rooms, print)
    #  Each group runs in a fresh browser context = fresh localStorage.
    # ================================================================
    def fresh():
        c = b.new_context()
        c.add_init_script("window.print = function(){};")
        q = c.new_page()
        q.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        q.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
        return c, q

    def open_app(q, url=APP, session=True):
        q.goto(url); q.wait_for_timeout(1200)
        if session:
            q.locator(".session-card").first.click(); q.wait_for_timeout(400)

    def sign_in(q, pw="crusoe2026"):
        q.click("#editorBtn"); q.wait_for_timeout(200)
        q.fill("#pwInput", pw)
        q.click("#modalFoot button:has-text('Sign in')"); q.wait_for_timeout(500)

    def grab_print(q, js):
        q.evaluate("document.querySelectorAll('iframe').forEach(function(f){f.remove()})")
        q.evaluate(js); q.wait_for_timeout(200)
        return q.evaluate("() => { var f = document.querySelector('iframe'); return f ? f.contentDocument.documentElement.outerHTML : ''; }")

    def placements(q):
        return q.evaluate("""() => session().students.map(function (st) { return [st.last, st.first, st.status, st.roomId ? roomName(session(), st.roomId) : null, st.row, st.seat]; }).sort()""")

    # ---- default settings reproduce the original app exactly ----
    # test_baseline.json was captured from the build BEFORE settings existed:
    # seat assignments (seed, generated by surname / by class / with keep-apart
    # pairs) and the HTML of every print sheet. Default settings must match it.
    import re, tempfile
    def snap_print(q, label):
        q.evaluate("document.querySelectorAll('iframe').forEach(function(f){f.remove()})")
        q.locator("button", has_text=label).first.click(); q.wait_for_timeout(300)
        h = q.evaluate("() => { var f = document.querySelector('iframe'); return f ? f.contentDocument.documentElement.outerHTML : null; }")
        return re.sub(r"printed [^<]*", "printed X", h or "")
    def snap_seats(q):
        return q.evaluate("""() => { var s = session(); return s.students.map(function(st){
          var r = s.rooms.find(function(x){return x.id===st.roomId});
          return [st.last, st.first, st.status, r ? r.name : null, st.row, st.seat]; }).sort(); }""")
    base = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_baseline.json")))
    c, q = fresh(); q.goto(APP); q.wait_for_timeout(1200)
    got = {"title": q.title(), "header": q.inner_text("header .header-title"), "seed": snap_seats(q)}
    q.evaluate("document.querySelector('.session-card').click()"); q.wait_for_timeout(300)
    sign_in(q)
    q.click("nav button[data-tab='print']"); q.wait_for_timeout(300)
    for lab in ["GYM seat grid", "Print master list", "Print arrangements", "Print list"]:
        got["print_seed:" + lab] = snap_print(q, lab)
    q.click("nav button[data-tab='seating']"); q.wait_for_timeout(300)
    q.click("#main button:has-text('Generate seating')"); q.wait_for_timeout(500)
    got["gen_surname"] = snap_seats(q)
    q.evaluate("session().settings.sortBy='class'; autoSeat()"); q.wait_for_timeout(300)
    got["gen_class"] = snap_seats(q)
    q.evaluate("""() => { var s = session(); var c = s.students.filter(function(x){return x.status==='Completing'}).sort(byName);
      s.settings.keepApart.push([c[0].id, c[1].id]); s.settings.keepApart.push([c[5].id, c[30].id]); s.settings.sortBy='surname'; autoSeat(); }""")
    q.wait_for_timeout(300)
    got["gen_keepapart"] = snap_seats(q)
    q.click("nav button[data-tab='print']"); q.wait_for_timeout(300)
    for lab in ["GYM seat grid", "Print master list"]:
        got["print_gen:" + lab] = snap_print(q, lab)
    diff = [k for k in base if base[k] != got.get(k)]
    check("default settings: seats and every print sheet identical to the original app", not diff, diff)
    c.close()

    # ---- viewers cannot reach or change settings ----
    c, q = fresh(); open_app(q)
    check("settings tab hidden for viewer", not q.locator("nav button[data-tab='settings']").is_visible())
    q.evaluate("go('settings')")
    check("viewer cannot navigate to settings", q.evaluate("activeTab") != "settings", q.evaluate("activeTab"))
    q.evaluate("setDraft('school.name','HACKED'); saveSettings(); settingsDraft = {school:{name:'HACKED'}};")
    q.wait_for_timeout(300)
    check("viewer cannot change settings via handlers", q.evaluate("cfg().school.name") == "Crusoe College", q.evaluate("cfg().school.name"))
    q.evaluate("settingsDraft = null")
    before = placements(q)
    q.evaluate("autoSeat(); roomModal(); keepApartModal(); seatingRulesModal(); moveRoom(session().rooms[0].id, 1); removeKA(0)")
    q.wait_for_timeout(200)
    check("viewer cannot run editor handlers (no modal, no change)",
          placements(q) == before and not q.locator("#modalBack.open").count(), q.locator("#modalBack.open").count())

    # ---- data saved by the previous version loads after migration ----
    q.evaluate("""() => {
      var old = JSON.parse(JSON.stringify(DB));
      delete old.config;
      old.templates.forEach(function (t) { t.rooms.forEach(function (r) { delete r.layout; }); });
      old.sessions.forEach(function (s) {
        s.settings = { sortBy: s.settings.sortBy, keepApart: [] };
        s.rooms.forEach(function (r) { delete r.layout; if (r.kind === 'list') { delete r.rows; delete r.seatsPerRow; } });
        s.students.forEach(function (st) { delete st.arrangements; delete st.notes; });
      });
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(old));
    }""")
    q.reload(); q.wait_for_timeout(1200)
    q.locator(".session-card").first.click(); q.wait_for_timeout(300)
    check("old-format data loads with same placements", placements(q) == before)
    check("migration fills settings and is idempotent",
          q.evaluate("() => { var a = JSON.stringify(DB); migrateDB(DB); return !!DB.config && a === JSON.stringify(DB); }"))
    c.close()

    # ---- branding, status rename, delete guard, import words ----
    c, q = fresh(); open_app(q); sign_in(q)
    check("settings tab visible to editor", q.locator("nav button[data-tab='settings']").is_visible())
    q.click("nav button[data-tab='settings']"); q.wait_for_timeout(300)
    check("settings shows 5 sections", q.locator(".set-card").count() == 5, q.locator(".set-card").count())
    q.evaluate("setDraft('school.name','Test High'); setDraft('school.tagline','Exam office'); setDraft('school.accent','#123456')")
    first_label = q.locator(".set-table").nth(1).locator("tbody tr").first.locator("input[type=text]").first
    first_label.fill("Sitting"); first_label.dispatch_event("change")
    q.click("#settingsBar button:has-text('Save settings')"); q.wait_for_timeout(400)
    check("school name in header and title", "Test High" in q.inner_text("#brandSub") and q.title().startswith("Test High"),
          q.inner_text("#brandSub") + " / " + q.title())
    h = grab_print(q, "printMasterList()")
    check("school name and accent on printouts", "Test High — Master Student List" in h and "#123456" in h and "#0d5c2e" not in h)
    q.click("nav button[data-tab='students']"); q.wait_for_timeout(300)
    check("renamed status shown, stored id unchanged",
          "Sitting" in q.inner_text("table.data tbody") and q.evaluate("session().students.some(function(s){return s.status==='Completing'})"))
    q.click("nav button[data-tab='settings']"); q.wait_for_timeout(300)
    q.locator(".set-table").nth(1).locator("tbody tr").first.locator("button.danger").click(); q.wait_for_timeout(400)
    check("in-use status cannot be deleted", "Status still in use" in q.inner_text("#modalTitle"))
    q.evaluate("closeModal(); addStatus(); var d = draft(); var x = d.statuses[d.statuses.length-1]; x.label = 'Medical'; x.keywords = 'medical, hospital';")
    q.evaluate("saveSettings()"); q.wait_for_timeout(300)
    check("import words map spreadsheet statuses",
          q.evaluate("[matchImportStatus('In hospital'), matchImportStatus('Exempt (parent)'), matchImportStatus(''), matchImportStatus('special provision')]")
          [1:] == ["Exemption", "Completing", "Special Provision"] and
          q.evaluate("statusLabel(matchImportStatus('In hospital'))") == "Medical")
    c.close()

    # ---- routing follows settings ----
    c, q = fresh(); open_app(q); sign_in(q)
    q.evaluate("""() => { var d = draft();
      d.purposes.find(function (p) { return p.id === 'special'; }).layout = 'seated';
      d.statuses.find(function (x) { return x.id === 'Exemption'; }).purpose = 'special'; }""")
    q.evaluate("saveSettings()"); q.wait_for_timeout(500)
    r = q.evaluate("""() => { var s = session(), cd = s.rooms.find(function (r) { return r.purpose === 'special'; });
      var sp = s.students.filter(function (st) { return st.status === 'Special Provision'; });
      return { kind: cd.kind, spCount: sp.length, spUnseated: sp.every(function (st) { return !st.roomId; }) }; }""")
    check("room type switched to seat grid reroutes its students", r["kind"] == "seated" and r["spUnseated"], r)
    q.evaluate("autoSeat()"); q.wait_for_timeout(300)
    r2 = q.evaluate("""() => { var s = session(), cd = s.rooms.find(function (r) { return r.purpose === 'special'; });
      return s.students.filter(function (st) { return st.status === 'Special Provision' || st.status === 'Exemption'; })
        .every(function (st) { return st.roomId === cd.id && st.row; }); }""")
    check("generate seats every seat-grid room type separately", r2 and r["spCount"] > 0, r)
    c.close()

    # ---- seating rules ----
    c, q = fresh(); open_app(q); sign_in(q)
    def rules(**kw):
        q.evaluate("(kw) => { var s = session().settings; Object.keys(kw).forEach(function (k) { s[k] = kw[k]; }); autoSeat(); }", kw)
        q.wait_for_timeout(200)
        return q.evaluate("() => session().students.filter(function (st) { return st.row; }).map(function (st) { return [st.row, st.seat, st.first, st.last, st.id]; })")
    seated = rules(pattern="alt-seat")
    check("every-second-seat leaves even seats empty", seated and all(s[1] % 2 == 1 for s in seated) and len(seated) == 108, len(seated))
    check("overflow is reported", "did not fit" in q.inner_text("#toast"), q.inner_text("#toast"))
    seated = rules(pattern="checker")
    pos = {(s[0], s[1]) for s in seated}
    check("checkerboard: nobody beside or behind anyone",
          not any((r_ + 1, s_) in pos or (r_, s_ + 1) in pos for (r_, s_) in pos), len(pos))
    seated = rules(pattern="all", rowDir="back", seatDir="snake", sortBy="surname")
    first = q.evaluate("() => session().students.filter(function (st) { return st.row; }).sort(byName)[0]")
    check("back-to-front fill starts in the last row", first["row"] == 12 and first["seat"] == 1, (first["row"], first["seat"]))
    row11 = sorted([s for s in seated if s[0] == 11], key=lambda s: s[1])
    check("snake fill reverses alternate rows", q.evaluate("() => { var s = session(); var x = s.students.filter(function (st) { return st.row; }).sort(byName); return [x[18].row, x[18].seat]; }") == [11, 18])
    a1 = rules(rowDir="front", seatDir="ltr", sortBy="random", shuffleSeed=42)
    a2 = rules(sortBy="random", shuffleSeed=42)
    q.evaluate("reshuffle()"); q.wait_for_timeout(200)
    a3 = q.evaluate("() => session().students.filter(function (st) { return st.row; }).map(function (st) { return [st.row, st.seat, st.first, st.last, st.id]; })")
    check("random order is stable until reshuffled", a1 == a2 and a1 != a3)
    rules(sortBy="first")
    f = q.evaluate("() => { var s = session(); var top = s.students.filter(function (st) { return st.row === 1 && st.seat === 1; })[0];"
                   " var best = s.students.filter(function (st) { return isSeatedStatus(st.status); }).sort(function (a, b) { return (a.first + a.last).localeCompare(b.first + b.last); })[0]; return top.id === best.id; }")
    check("first-name order", f)
    rules(sortBy="import")
    f = q.evaluate("() => { var s = session(); var top = s.students.filter(function (st) { return st.row === 1 && st.seat === 1; })[0];"
                   " return top.id === s.students.filter(function (st) { return isSeatedStatus(st.status); })[0].id; }")
    check("import order", f)
    near = q.evaluate("""() => { var s = session(); var x = s.students.filter(function (st) { return st.row; });
      x[0].row = 3; x[0].seat = 3; x[1].row = 4; x[1].seat = 4; var y2 = x[2], y3 = x[3]; y2.row = 6; y2.seat = 6; y3.row = 7; y3.seat = 6;
      s.settings.keepApart = [[x[0].id, x[1].id], [y2.id, y3.id]];
      var out = {}; ['side', 'cross', 'all'].forEach(function (n) { s.settings.near = n; out[n] = adjacentPairs(s).length; }); return out; }""")
    check("keep-apart 'near' rule: side / cross / all", near == {"side": 0, "cross": 1, "all": 2}, near)
    q.evaluate("session().settings.near = 'all'; autoSeat()"); q.wait_for_timeout(200)
    check("generate honours the 8-seat keep-apart rule", q.evaluate("adjacentPairs(session()).length") == 0)
    q.click("nav button[data-tab='seating']"); q.wait_for_timeout(300)
    q.click("#main button:has-text('Seating rules')"); q.wait_for_timeout(200)
    q.select_option("#r_pattern", "alt-row")
    q.click("#modalFoot button:has-text('Save rules')"); q.wait_for_timeout(200)
    check("seating rules dialog saves to the session", q.evaluate("session().settings.pattern") == "alt-row")
    c.close()

    # ---- room editor: blocked seats, labels, supervisor, order, templates ----
    c, q = fresh(); open_app(q); sign_in(q)
    q.click("nav button[data-tab='rooms']"); q.wait_for_timeout(300)
    q.locator(".room-card").first.locator("button:has-text('Edit')").click(); q.wait_for_timeout(300)
    q.locator(".mask td.m").nth(1).click()                     # row 2, seat 1 -> aisle
    q.locator(".mask td.m").nth(2).click(); q.locator(".mask td.m").nth(2).click()   # row 3, seat 1 -> unusable
    q.locator(".mask thead th").nth(1).click()       # whole row 1 -> aisle
    q.select_option("#f_rowlab", "letter")
    q.fill("#f_super", "Ms Lee")
    q.click("#modalFoot button:has-text('Save changes')"); q.wait_for_timeout(400)
    g = q.evaluate("() => { var r = session().rooms[0]; return { n: Object.keys(r.layout.blocked).length, b: r.layout.blocked['3_1'], a: r.layout.blocked['2_1'] }; }")
    check("seat map editor blocks seats and lines", g == {"n": 20, "b": "unusable", "a": "aisle"}, g)
    check("students in newly blocked seats are released", "need" in q.inner_text("#toast"), q.inner_text("#toast"))
    q.evaluate("autoSeat()"); q.wait_for_timeout(200)
    check("generate never uses a blocked seat",
          q.evaluate("() => { var s = session(), r = s.rooms[0]; return s.students.filter(function (st) { return st.roomId === r.id && st.row; }).every(function (st) { return !seatBlocked(r, st.row, st.seat); }); }"))
    q.click("nav button[data-tab='seating']"); q.wait_for_timeout(400)
    check("blocked seats shown on the plan", q.locator(".seat-cell.blocked").count() == 20, q.locator(".seat-cell.blocked").count())
    check("letter row labels on the plan", "Row A" in q.locator(".seat-table thead").first.text_content())
    occupied_before = placements(q)
    q.evaluate("seatClick(session().rooms[0].id, 3, 1)"); q.wait_for_timeout(100)
    check("cannot move into a blocked seat", "blocked" in q.inner_text("#toast") and placements(q) == occupied_before)
    h = grab_print(q, "printRoomSheet(session().rooms[0].id)")
    check("print grid: labels, blocked cells, supervisor", "Row A" in h and "background:#e4e4e4" in h and "Supervisor: Ms Lee" in h)
    q.evaluate("var d = draft(); d.print.showSupervisor = false; saveSettings()"); q.wait_for_timeout(300)
    check("supervisor line can be turned off", "Supervisor:" not in grab_print(q, "printRoomSheet(session().rooms[0].id)"))
    q.evaluate("moveRoom(session().rooms[0].id, 1)")
    check("room fill order can be changed", q.evaluate("session().rooms[1].name") == "GYM")
    q.evaluate("moveRoom(session().rooms[1].id, -1)")
    q.click("nav button[data-tab='rooms']"); q.wait_for_timeout(200)
    q.click("#main button:has-text('Save rooms as template')"); q.wait_for_timeout(200)
    q.fill("#f_tname", "Blocked layout"); q.click("#modalFoot button:has-text('Save template')"); q.wait_for_timeout(300)
    check("templates keep blocked seats and labels",
          q.evaluate("() => { var t = DB.templates.find(function (t) { return t.name === 'Blocked layout'; }); return Object.keys(t.rooms[0].layout.blocked).length === 20 && t.rooms[0].layout.rowLabels === 'letter'; }"))
    c.close()

    # ---- student arrangements and print options ----
    c, q = fresh(); open_app(q); sign_in(q)
    q.click("nav button[data-tab='students']"); q.wait_for_timeout(300)
    sp = q.evaluate("() => session().students.filter(function (st) { return st.status === 'Special Provision'; })[0].last")
    q.fill("input[placeholder='Filter by name or class']", sp); q.wait_for_timeout(300)
    q.locator("table.data tbody button:has-text('Edit')").first.click(); q.wait_for_timeout(300)
    q.fill("#f_arr", "Reader, extra time 25%"); q.fill("#f_notes", "Bring own laptop")
    q.click("#modalFoot button:has-text('Save changes')"); q.wait_for_timeout(300)
    check("arrangements shown on student list", "Reader, extra time 25%" in q.inner_text("table.data tbody"))
    h = grab_print(q, "printPurposeList('special')")
    check("arrangements column added to the arrangements sheet", "<th>Arrangements</th>" in h and "Reader, extra time 25%" in h)
    q.evaluate("var d = draft(); d.print.masterCols = ['student','location','notes']; d.print.instructions = 'Phones off'; d.print.listOrientation = 'landscape'; saveSettings()")
    q.wait_for_timeout(300)
    h = grab_print(q, "printMasterList()")
    check("print columns, instructions and orientation follow settings",
          "<th>Class</th>" not in h and "<th>Notes</th>" in h and "Bring own laptop" in h and "Phones off" in h and "A4 landscape" in h)
    q.evaluate("var d = draft(); d.print.masterCols = ['student','room','row','seat']; saveSettings()"); q.wait_for_timeout(300)
    h = grab_print(q, "printMasterList()")
    check("separate bold Row and Seat columns, no Status", "<th>Row</th><th>Seat</th>" in h and "<td><b>1</b></td>" in h and "<th>Status</th>" not in h)
    q.click("nav button[data-tab='sessions']"); q.wait_for_timeout(300)
    q.locator(".session-card").first.locator("button:has-text('Edit')").click(); q.wait_for_timeout(200)
    q.fill("#f_start", "09:00"); q.fill("#f_finish", "10:30")
    q.click("#modalFoot button:has-text('Save')"); q.wait_for_timeout(300)
    check("session start/finish times on printouts", "Start 09:00 · Finish 10:30" in grab_print(q, "printMasterList()").replace("&middot;", "·"))
    c.close()

    # ---- save / open plan files ----
    c, q = fresh(); open_app(q, session=False)
    check("viewer can save a copy but not open a file",
          q.locator("button:has-text('Save to file')").is_visible() and not q.locator("button:has-text('Open file')").is_visible())
    with q.expect_download() as dl:
        q.click("button:has-text('Save to file')")
    plan_path = os.path.join(tempfile.mkdtemp(), "plan.json")
    dl.value.save_as(plan_path)
    plan = json.load(open(plan_path))
    check("save to file: settings, templates and every session in one file",
          plan.get("app") == "Exam Seating Manager" and len(plan["sessions"]) == 1 and len(plan["sessions"][0]["students"]) == 218
          and "config" in plan and len(plan["templates"]) == 1 and dl.value.suggested_filename.endswith(".json"), dl.value.suggested_filename)
    q.evaluate("openedPlan = { sessions: [] }; applyPlanFile('replace')"); q.wait_for_timeout(200)
    check("viewer cannot apply a plan file", q.evaluate("DB.sessions.length") == 1 and q.evaluate("openedPlan") is not None)
    q.locator(".session-card").first.click(); q.wait_for_timeout(300)
    saved_places = placements(q)
    c.close()

    c, q = fresh(); open_app(q); sign_in(q)
    q.evaluate("session().students.splice(0, 5); session().name = 'Changed'; markDirty()")
    q.click("nav button[data-tab='sessions']"); q.wait_for_timeout(300)
    with q.expect_file_chooser() as fc:
        q.click("button:has-text('Open file')")
    fc.value.set_files(plan_path); q.wait_for_timeout(500)
    check("open file shows what is in it", "Open plan file" in q.inner_text("#modalTitle") and "218 students" in q.inner_text("#modalBody"))
    q.click("#modalFoot button:has-text('Replace everything')"); q.wait_for_timeout(400)
    q.locator(".session-card").first.click(); q.wait_for_timeout(300)
    check("replace restores the saved plan exactly", placements(q) == saved_places and q.evaluate("session().name") == "NAPLAN 2026 — Year 9")
    q.reload(); q.wait_for_timeout(1200)
    q.locator(".session-card").first.click(); q.wait_for_timeout(300)
    check("opened plan persists after reload", placements(q) == saved_places)
    sign_in(q); q.click("nav button[data-tab='sessions']"); q.wait_for_timeout(300)
    with q.expect_file_chooser() as fc:
        q.click("button:has-text('Open file')")
    fc.value.set_files(plan_path); q.wait_for_timeout(500)
    q.click("#modalFoot button:has-text('Add sessions')"); q.wait_for_timeout(400)
    r = q.evaluate("""() => { var a = DB.sessions[0], b = DB.sessions[1];
      var ids = {}; a.students.forEach(function (s) { ids[s.id] = 1; });
      var rooms = {}; b.rooms.forEach(function (r) { rooms[r.id] = 1; });
      return [DB.sessions.length, b.name, b.students.some(function (s) { return ids[s.id]; }),
              b.students.filter(function (s) { return s.roomId; }).every(function (s) { return rooms[s.roomId]; }), b.students.length]; }""")
    check("add brings sessions in as new copies with their own ids", r == [2, "NAPLAN 2026 — Year 9 (from file)", False, True, 218], r)
    bad = os.path.join(tempfile.mkdtemp(), "bad.json"); open(bad, "w").write('{"hello": 1}')
    with q.expect_file_chooser() as fc:
        q.click("button:has-text('Open file')")
    fc.value.set_files(bad); q.wait_for_timeout(400)
    check("a file that is not a plan is refused with a clear message", "not an Exam Seating plan" in q.inner_text("#toast") and q.evaluate("DB.sessions.length") == 2)
    c.close()

    # ================================================================
    #  SHARED MODE: the real Code.gs running on a fake Google Sheet
    # ================================================================
    import subprocess, urllib.request
    PORT = 8765
    API = "http://127.0.0.1:%d/exec" % PORT
    srv = subprocess.Popen(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_backend.js"), str(PORT)],
                           stdout=subprocess.PIPE, text=True)
    srv.stdout.readline()
    def api(payload=None, path="/exec", params=""):
        url = "http://127.0.0.1:%d%s%s" % (PORT, path, params)
        data = None if payload is None else json.dumps(payload).encode()
        return json.loads(urllib.request.urlopen(urllib.request.Request(url, data=data)).read())
    try:
        src = open(APP[len("file://"):], encoding="utf-8").read()
        assert "API_URL: ''," in src
        tmpdir = tempfile.mkdtemp()
        RAPP = "file://" + os.path.join(tmpdir, "remote.html")
        open(RAPP[len("file://"):], "w", encoding="utf-8").write(src.replace("API_URL: '',", "API_URL: '" + API + "',"))

        # A session as the previous app version would have saved it.
        sid = api({"action": "createSession", "password": "testpass", "name": "Remote Test", "yearLevels": "Year 9"})["session"]["sessionId"]
        api({"action": "saveSessionData", "password": "testpass", "sessionId": sid, "version": 1,
             "rooms": [{"roomId": "r1", "name": "HALL", "layoutType": "seated:main", "rows": 3, "seatsPerRow": 4, "sortOrder": 0},
                       {"roomId": "r2", "name": "LIB", "layoutType": "list:special", "sortOrder": 1}],
             "students": [{"studentId": "a%d" % i, "firstName": "F%d" % i, "lastName": "L%d" % i, "status": "Completing",
                           "arrangements": "Large print" if i == 0 else ""} for i in range(5)],
             "separations": []})

        c, q = fresh(); open_app(q, RAPP, session=False)
        check("shared mode loads from Code.gs", q.inner_text("#syncText") == "Synced" and "Remote Test" in q.inner_text("#main"), q.inner_text("#syncText"))
        q.locator(".session-card").first.click(); q.wait_for_timeout(500)
        sign_in(q, "testpass")
        q.evaluate("() => { var st = session().students.find(function (x) { return x.id === 'a1'; }); st.first = 'Renamed'; markDirty(); }")
        q.wait_for_timeout(2500)
        stu = api(path="/__state")["Students"]
        hdr = stu[0]
        row0 = [r for r in stu[1:] if r[hdr.index("studentId")] == "a0"][0]
        check("saving no longer wipes arrangements typed in the Sheet", row0[hdr.index("arrangements")] == "Large print", row0)
        q.evaluate("setSortBy('class'); var r = session().rooms[0]; r.layout.blocked['1_1'] = 'unusable'; r.layout.rowLabels = 'letter'; session().settings.keepApart = [['a0','a2','Siblings']]; markDirty();")
        q.wait_for_timeout(2500)
        q.reload(); q.wait_for_timeout(1500)
        r = q.evaluate("() => { var s = session(); return [s.settings.sortBy, s.rooms[0].layout.blocked['1_1'], s.rooms[0].layout.rowLabels, s.settings.keepApart[0][2]]; }")
        check("session rules, room layout and pair reasons persist in the Sheet", r == ["class", "unusable", "letter", "Siblings"], r)

        sign_in(q, "testpass")
        q.evaluate("setDraft('school.name', 'Remote School'); saveSettings()"); q.wait_for_timeout(800)
        st = api(params="?action=getSettings")
        check("settings saved to the Settings tab (version 1)", st["version"] == 1 and "Remote School" in st["valueJson"], st.get("version"))
        q.reload(); q.wait_for_timeout(1500)
        check("shared settings load for everyone", "Remote School" in q.inner_text("#brandSub"))
        stale = api({"action": "saveSettings", "password": "testpass", "version": 0, "valueJson": "{}"})
        check("stale settings save refused by Code.gs", stale.get("error") == "VERSION_CONFLICT", stale)
        other = json.loads(st["valueJson"]); other["school"]["name"] = "Other Editor School"
        api({"action": "saveSettings", "password": "testpass", "version": 1, "valueJson": json.dumps(other)})
        sign_in(q, "testpass")
        q.evaluate("setDraft('school.name', 'Mine'); saveSettings()"); q.wait_for_timeout(800)
        check("settings conflict shows the reload prompt", "Someone else changed the settings" in q.inner_text("#modalTitle"), q.inner_text("#modalTitle"))
        check("conflicting save does not overwrite", "Other Editor School" in api(params="?action=getSettings")["valueJson"])
        q.click("#modalFoot button:has-text('Reload latest')"); q.wait_for_timeout(800)
        check("reload picks up the other editor's settings", q.evaluate("cfg().school.name") == "Other Editor School")
        sess_stale = api({"action": "saveSessionData", "password": "testpass", "sessionId": sid, "version": 1, "students": []})
        check("session version check still enforced", sess_stale.get("error") == "VERSION_CONFLICT", sess_stale)
        q.click("nav button[data-tab='sessions']"); q.wait_for_timeout(300)
        with q.expect_file_chooser() as fc:
            q.click("button:has-text('Open file')")
        fc.value.set_files(plan_path); q.wait_for_timeout(500)
        check("shared mode: opening a file only offers to add", q.locator("#modalFoot button:has-text('Replace everything')").count() == 0)
        q.click("#modalFoot button:has-text('Add sessions')"); q.wait_for_timeout(2500)
        sessions = api(params="?action=listSessions")["sessions"]
        new = [x for x in sessions if x["sessionId"] != sid]
        got = api(params="?action=getSession&sessionId=" + new[0]["sessionId"]) if new else {}
        check("shared mode: file sessions are created as new shared sessions",
              len(sessions) == 2 and len(got.get("students", [])) == 218 and len(api(params="?action=getSession&sessionId=" + sid)["students"]) == 5,
              len(sessions))
        with q.expect_download() as dl:
            q.click("button:has-text('Save to file')")
        p2 = os.path.join(tempfile.mkdtemp(), "shared.json"); dl.value.save_as(p2)
        check("shared mode: save to file includes every session", len(json.load(open(p2))["sessions"]) == 2)
        c.close()

        # Backend not yet updated (v1.0): app must still work, settings just can't be shared.
        api({"old": True}, path="/__mode")
        c, q = fresh(); open_app(q, RAPP, session=False)
        check("old backend: app still loads", q.inner_text("#syncText") == "Synced" and q.evaluate("cfg().school.name") == "Crusoe College")
        sign_in(q, "testpass"); q.click("nav button[data-tab='settings']"); q.wait_for_timeout(300)
        check("old backend: Settings explains the one-off update", q.locator(".warn-box").is_visible())
        q.evaluate("setDraft('school.name','X'); saveSettings()"); q.wait_for_timeout(400)
        check("old backend: saving settings is refused with a clear message", "one-off update" in q.inner_text("#toast"), q.inner_text("#toast"))
        c.close()
        api({"old": False}, path="/__mode")

        # setup() upgrades a v1.0 sheet: new headers added, data untouched.
        legacy = {
            "Sessions": [["sessionId", "name", "examDate", "yearLevels", "status", "version", "updatedAt"], ["s1", "Legacy", "", "Y7", "draft", 3, "x"]],
            "Students": [["sessionId", "studentId", "firstName", "lastName", "homegroup", "status", "room", "row", "seat", "arrangements", "notes"],
                         ["s1", "k1", "Ann", "Old", "7A", "Completing", "r1", 1, 1, "", ""]],
            "Rooms": [["sessionId", "roomId", "name", "layoutType", "rows", "seatsPerRow", "color", "sortOrder"], ["s1", "r1", "HALL", "seated:main", 2, 2, "", 0]],
            "Separations": [["sessionId", "studentIdA", "studentIdB", "reason"]],
            "Templates": [["templateId", "name", "roomsJson"]]}
        api(legacy, path="/__load"); api({}, path="/__setup")
        book = api(path="/__state")
        check("setup() upgrades an existing sheet without touching data",
              book["Sessions"][0][-1] == "settingsJson" and book["Rooms"][0][-1] == "layoutJson" and "Settings" in book
              and book["Sessions"][1][:7] == legacy["Sessions"][1] and book["Rooms"][1][:8] == legacy["Rooms"][1], book["Sessions"][0])
        c, q = fresh(); open_app(q, RAPP)
        check("upgraded sheet loads in the app", "1 of 1 students" in q.inner_text("#main") and q.inner_text("#syncText") == "Synced", q.inner_text("#syncText"))
        c.close()
    finally:
        srv.terminate()

    real2 = [e for e in errors if "ERR_TUNNEL" not in e and "Failed to load resource" not in e]
    check("no JS errors during whole run", not real2, real2[:5])
    pg.screenshot(path="seating.png", full_page=False)
    b.close()

print("\n" + ("ALL PASSED" if not fails else "FAILURES: " + ", ".join(fails)))
sys.exit(1 if fails else 0)
