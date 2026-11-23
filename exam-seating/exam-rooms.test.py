#!/usr/bin/env python3
"""Checks for the Compass "Exam Rooms" tool (exam-rooms.js).

    python3 exam-seating/exam-rooms.test.py

Builds the tool and the Exam Seating Manager, then loads exam-rooms.js into a
stub Compass page whose Compass calls are answered from FICTIONAL responses made
from exam-seating/test-data/ (the same made-up names make_test_data.py writes).
Nothing here talks to the real Compass. Needs Python Playwright and Chromium
(see SETUP_GUIDE.md).
"""
import csv, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TD = os.path.join(HERE, "test-data")
TOOL = os.path.join(ROOT, "exam-rooms.js")
MANAGER = "file://" + os.path.join(HERE, "Exam_Seating_Manager.html")

subprocess.run(["node", os.path.join(HERE, "build_exam_rooms.js")], check=True, cwd=HERE)
subprocess.run(["node", os.path.join(HERE, "build.js")], check=True, cwd=HERE, stdout=subprocess.DEVNULL)
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers" if os.path.isdir("/opt/pw-browsers") else "")
if not os.environ["PLAYWRIGHT_BROWSERS_PATH"]:
    del os.environ["PLAYWRIGHT_BROWSERS_PATH"]
from playwright.sync_api import sync_playwright

results = []
def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS  " if cond else "FAIL  ") + name + ("" if cond else "   -> " + str(extra)[:400]))

# ---------------------------------------------------------------- fixtures
def read_grid(path):
    rows = list(csv.reader(open(path, encoding="utf-8")))[2:]
    return [(r[0], r[1]) for r in rows if r and r[0] and r[0] not in ("Minimum", "Maximum", "Standard Deviation", "Mean", "Median")]

def split_grid_name(name):
    """'Jesse (Jesse Holloway) PEMBERTON' -> ('Jesse (Jesse Holloway)', 'PEMBERTON')"""
    t = name.split(" ")
    i = len(t)
    while i > 1 and ")" not in t[i - 1] and (t[i - 1] == "-" or (t[i - 1].isupper() and re.search("[A-Z]", t[i - 1]))):
        i -= 1
    return " ".join(t[:i]), " ".join(t[i:])

STUDENTS = {}        # (given, LAST) -> uid
ENROL = {}           # class code -> [uid]
def add(given, last, code):
    key = (given, last)
    if key not in STUDENTS:
        STUDENTS[key] = 5000 + len(STUDENTS)
    ENROL.setdefault(code, [])
    if STUDENTS[key] not in ENROL[code]:
        ENROL[code].append(STUDENTS[key])

for fname in ("Advanced_Maths.csv", "General_Maths.csv", "Foundation_Maths.csv"):
    for name, codes in read_grid(os.path.join(TD, fname)):
        given, last = split_grid_name(name)
        for code in [c.strip() for c in codes.split(",") if c.strip()]:
            add(given, last, code)
NAME_OF = {uid: k for k, uid in STUDENTS.items()}

CLASSES = {  # code -> (activity id, subject code, manager id)
    "10MAA1": (101, "10MAA", 9001), "10MAA2": (102, "10MAA", 9002),
    "10MAG1": (201, "10MAG", 9003), "10MAG2": (202, "10MAG", 9004), "10MAG3": (203, "10MAG", 9005), "10MAGX": (204, "10MAG", 9006),
    "10MAF1": (301, "10MAF", 9007), "10MAF2": (302, "10MAF", 9008),
}
SUBJECTS = [{"id": 1, "importIdentifier": "10MAA"}, {"id": 2, "importIdentifier": "10MAG"},
            {"id": 3, "importIdentifier": "10MAF"}, {"id": 4, "importIdentifier": "10ENG"}]
TEACHERS = {9001: "Tess CARVER", 9002: "Bo DALTON", 9003: "Una FINCH", 9004: "Ned GRANGER",
            9005: "Ola HARLOW", 9006: "Pia INGRAM", 9007: "Rex JARVIS", 9008: "Sol KENDALL"}

class FakeCompass:
    def __init__(self):
        self.fail_once = set()   # activity ids whose enrolments fail on the next request
        self.extra = {}          # code -> extra (given, LAST) added after a save
        self.calls = []
    def enrolments(self, aid):
        code = [c for c, v in CLASSES.items() if v[0] == aid][0]
        rows = [{"uid": uid, "n": NAME_OF[uid][1] + ", " + NAME_OF[uid][0], "ii": "FIC%04d" % uid, "pi": True} for uid in ENROL.get(code, [])]
        for given, last in self.extra.get(code, []):
            rows.append({"uid": 7000 + len(rows), "n": last + ", " + given, "ii": "NEW", "pi": True})
        rows.append({"uid": 1, "n": "NOTASTUDENT, Somebody", "ii": "X", "pi": False})   # filtered out like class-export-csv.js
        return rows
    def handle(self, route):
        req = route.request
        url, body = req.url, (json.loads(req.post_data) if req.post_data else {})
        self.calls.append(url.split("/Services/")[-1].split("?")[0])
        j = lambda o: route.fulfill(status=200, content_type="application/json", body=json.dumps(o))
        if "GetSubjectsInAcademicGroup" in url:
            return j({"d": {"data": SUBJECTS if body.get("start", 0) == 0 else []}})
        if "GetStandardClassesOfSubject" in url:
            sub = [s["importIdentifier"] for s in SUBJECTS if s["id"] == body["subjectId"]][0]
            return j({"d": {"data": [{"id": v[0], "name": c, "managerId": v[2]} for c, v in CLASSES.items() if v[1] == sub]}})
        if "GetUserDetailsBlobByUserId" in url:
            return j({"d": {"userFullName": TEACHERS.get(body["targetUserId"], ""), "userPreferredName": "X"}})
        if "GetEnrolmentsByActivityId" in url:
            aid = body["activityId"]
            if aid in self.fail_once:
                self.fail_once.discard(aid)
                return route.fulfill(status=500, body="error")
            rows = self.enrolments(aid)
            return j({"d": rows[body.get("start", 0): body.get("start", 0) + body.get("limit", 100)]})
        return route.fulfill(status=200, content_type="text/html", body="<html><body><h1>Compass</h1></body></html>")

TOOL_JS = open(TOOL, encoding="utf-8").read()

def load_tool(page):
    page.add_script_tag(content=TOOL_JS)
    page.wait_for_selector("#er-root .er-steps")

EXEMPT = open(os.path.join(TD, "Exemptions.csv"), encoding="utf-8").read()
SEA = open(os.path.join(TD, "Provisions.csv"), encoding="utf-8").read()

# ---------------------------------------------------------------- run
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    fake = FakeCompass()
    ctx = browser.new_context(accept_downloads=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    external = []
    pg.on("request", lambda r: external.append(r.url) if not r.url.startswith(("https://compass.test", "data:", "blob:", "about:")) else None)
    pg.route("https://compass.test/**", fake.handle)
    pg.goto("https://compass.test/Records/User.aspx")
    pg.evaluate("window.Compass = { schoolId: 1 }")
    # ---- opening: no password ----
    check("no password left in the published code", not re.search(r"ER_LOCK|erCheckPassword|data-lock", TOOL_JS))
    pg.add_script_tag(content=TOOL_JS)
    pg.wait_for_selector("#er-root .er-card .er-steps", timeout=5000)
    check("opens straight to the steps, no password asked", pg.query_selector("#er-root input[type=password]") is None and pg.is_visible("#er-root .er-steps"))
    check("no Compass data is read just by opening it", not any(".svc" in c for c in fake.calls), fake.calls)
    menu = open(os.path.join(HERE, "..", "compass-tools.js"), encoding="utf-8").read()
    check("Compass Tools menu no longer shows a lock or asks for a password",
          "locked" not in menu and "Password needed" not in menu and "password" not in menu.lower() and "exam-rooms.js" in menu)

    F = lambda: "window.__examRooms.fn"
    # ---- names: every case in test-data ----
    cases = {
        "THEODORE": ("MARCHWOOD, Theodore (Theo)", "Theo"),
        "JESSE": ("PEMBERTON, Jesse (Jesse Holloway)", "Jesse"),
        "THU": ("LWIN, Nyein Thu Zar (Thu)", "Thu"),
        "ANNIE": ("FAIRWEATHER, Annabel (Annie)", "Annie"),
        "QJ": ("ESTRADA, Quinlan (Q J)", "Q J"),
        "GRID": ("Annabel (Annie) FAIRWEATHER", "Annie"),
        "VAN": ("Ivy VAN DER BERG", "Ivy"),
    }
    for k, (n, want) in cases.items():
        got = pg.evaluate("n => { var f = window.__examRooms.fn; return f.preferredFirst(f.parseName(n)); }", n)
        check("printed first name for " + n, got == want, got)
    got = pg.evaluate("() => window.__examRooms.fn.parseName('Ivy VAN DER BERG').last")
    check("multi-word surname kept whole", got == "VAN DER BERG", got)
    got = pg.evaluate("() => window.__examRooms.fn.expandCodes('10MAG1–10MAG3, 10magx')")
    check("class code ranges expand", got == ["10MAG1", "10MAG2", "10MAG3", "10MAGX"], got)
    check("session headings shorten", pg.evaluate("() => window.__examRooms.fn.shortSession('Monday 16 November AM')") == "Mon 16 Nov AM")

    # ---- step 1: exam session ----
    def fill(sel, val):
        pg.fill("#er-root " + sel, str(val)); pg.dispatch_event("#er-root " + sel, "change")
    fill("[data-bind='details.exam']", "Semester 2 Exam")
    fill("[data-bind='details.year']", "Year 10")
    fill("[data-bind='details.sessions.0.label']", "Monday 16 November AM")
    fill("[data-bind='details.sessions.0.start']", "9:00")
    pg.click("#er-root [data-act='addSession']")
    fill("[data-bind='details.sessions.1.label']", "Monday 16 November PM")
    fill("[data-bind='room.name']", "BSSC Gym")
    fill("[data-bind='room.rows']", 15); fill("[data-bind='room.seatsPerRow']", 20); fill("[data-bind='room.use']", 17)
    S = lambda: pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.ER.S))")
    s = S()
    check("exam details stored", s["details"]["exam"] == "Semester 2 Exam" and len(s["details"]["sessions"]) == 2 and s["room"]["use"] == 17, s["details"])

    # ---- step 2: classes, a missing code and a Compass error part-way ----
    pg.click("#er-root [data-act='next']")
    fill("[data-bind='groups.0.name']", "Advanced Maths"); fill("[data-bind='groups.0.codes']", "10MAA1, 10MAA2")
    pg.click("#er-root [data-act='addGroup']")
    fill("[data-bind='groups.1.name']", "General Maths"); fill("[data-bind='groups.1.codes']", "10MAG1–10MAG4, 10MAGX")
    pg.click("#er-root [data-act='addGroup']")
    fill("[data-bind='groups.2.name']", "Foundation Maths"); fill("[data-bind='groups.2.codes']", "10MAF1, 10MAF2")
    fake.fail_once.add(202)   # 10MAG2 enrolments fail first time
    pg.click("#er-root [data-act='loadAll']")
    pg.wait_for_function("() => Object.values(window.__examRooms.ER.data.classes).every(c => c.status !== 'loading' && c.status !== 'waiting')", timeout=15000)
    cls = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.ER.data.classes))")
    check("missing class code is flagged", cls["10MAG4"]["status"] == "missing" and "10MAG4" in pg.inner_text("#er-root .er-body"), cls.get("10MAG4"))
    check("Compass error shows a friendly message and Retry", cls["10MAG2"]["status"] == "error" and "Retry" in pg.inner_text("#er-root .er-body")
          and "error 500" in cls["10MAG2"]["message"], cls["10MAG2"])
    check("other classes loaded despite the error", all(cls[c]["status"] == "ok" for c in CLASSES if c != "10MAG2"))
    pg.click("#er-root [data-act='retry'][data-code='10MAG2']")
    pg.wait_for_function("() => window.__examRooms.ER.data.classes['10MAG2'].status === 'ok'", timeout=10000)
    cls = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.ER.data.classes))")
    check("retry loads just that class", cls["10MAG2"]["status"] == "ok" and len(cls["10MAG2"]["studentIds"]) == len(ENROL["10MAG2"]))
    check("per-class counts match Compass", all(len(cls[c]["studentIds"]) == len(ENROL[c]) for c in CLASSES), {c: (len(cls[c]["studentIds"]), len(ENROL[c])) for c in CLASSES})
    check("non-student rows filtered out (pi)", "c1" not in pg.evaluate("() => Object.keys(window.__examRooms.ER.data.students)"))
    check("lead teacher initials", cls["10MAA1"]["teacher"] == "TC" and cls["10MAF2"]["teacher"] == "SK", (cls["10MAA1"]["teacher"], cls["10MAF2"]["teacher"]))
    total = len(STUDENTS)
    check("student in two classes counted once", pg.evaluate("() => Object.keys(window.__examRooms.ER.data.students).length") == total)
    check("a class that did not load blocks documents", pg.evaluate("() => window.__examRooms.model().classProblems") == ["10MAG4"])
    fill("[data-bind='groups.1.codes']", "10MAG1–10MAG3, 10MAGX")
    check("removing the bad code clears the block", pg.evaluate("() => window.__examRooms.model().classProblems") == [])
    sw = pg.evaluate("() => window.__examRooms.fn.splitWhole('Ivy Van Der Berg', Object.values(window.__examRooms.ER.data.students))")
    check("a whole name in one cell finds a multi-word surname", sw == {"first": "Ivy", "last": "Van Der Berg"}, sw)
    check("exam-rooms.js is pure ASCII (works whatever the page charset)", all(ord(ch) < 128 for ch in open(os.path.join(HERE, "..", "exam-rooms.js"), encoding="utf-8").read()))

    # ---- step 3/4: exemptions and SEA ----
    pg.click("#er-root [data-act='next']")
    pg.fill("#er-root [data-bind='exemptText']", EXEMPT); pg.dispatch_event("#er-root [data-bind='exemptText']", "change")
    body = pg.inner_text("#er-root .er-body")
    M = lambda: pg.evaluate("() => { var m = window.__examRooms.model(); return { pending: m.pending.length, report: m.report.map(function (r) { return [r.kind, r.entry.first + ' ' + r.entry.last, r.res.match.status, r.res.id, r.res.match.candidates.map(function (c) { return c.student.id; })]; }) }; }")
    rep = {r[1]: r for r in M()["report"]}
    uid = lambda given_prefix, last: "c%d" % [u for (g, l), u in STUDENTS.items() if l == last and g.startswith(given_prefix)][0]
    check("exact exemptions match automatically", rep["Remy Abbott"][2] == "exact" and rep["Annabel Fairweather"][2] == "exact" and rep["Quinlan Estrada"][2] == "exact", rep)
    check("one-letter surname typo needs confirming", rep["Ler Paw Kyaww"][2] == "confirm" and rep["Ler Paw Kyaww"][4] == [uid("Ler Paw", "KYAW")], rep["Ler Paw Kyaww"])
    check("nickname needs confirming", rep["Ollie Thistlewood"][2] == "confirm" and rep["Ollie Thistlewood"][4] == [uid("Oliver", "THISTLEWOOD")], rep["Ollie Thistlewood"])
    check("unknown name is not guessed", rep["Rose Marlowe"][2] == "none" and rep["Rose Marlowe"][3] is None)
    check("unconfirmed names are flagged on screen", "Please confirm" in body and "Not found" in body)
    pg.click("#er-root [data-act='next']")
    pg.fill("#er-root [data-sea]", SEA); pg.dispatch_event("#er-root [data-sea]", "change")
    s = S()
    check("SEA reasons are dropped when read", not any("reason" in json.dumps(r).lower() for r in s["seaRows"]) and len(s["seaRows"]) == 5, s["seaRows"])
    willow = uid("Willow", "NASH")
    pg.check("#er-root [data-stay='%s']" % willow)
    check("SEA student can stay in the main room", S()["seaStay"].get(willow) is True)

    # ---- pending names block documents ----
    pg.click("#er-root [data-act='go'][data-i='7']")
    check("documents wait until names are checked", "Some names still need checking" in pg.inner_text("#er-root .er-body"))
    pg.click("#er-root [data-act='go'][data-i='6']")
    for key_name, choice in (("Ler Paw Kyaww", uid("Ler Paw", "KYAW")), ("Ollie Thistlewood", uid("Oliver", "THISTLEWOOD")), ("Rose Marlowe", "none")):
        first, last = key_name.rsplit(" ", 1)
        sel = "#er-root select[data-match^='ex|']"
        key = pg.evaluate("([f, l]) => 'ex|' + f.toLowerCase().replace(/[\\s\\-'.]+/g, '') + '|' + l.toLowerCase().replace(/[\\s\\-'.]+/g, '')", [first, last])
        pg.select_option("#er-root select[data-match='%s']" % key, choice)
    check("all names confirmed", M()["pending"] == 0, M()["pending"])
    both = pg.evaluate("() => window.__examRooms.model().both.map(function (s) { return s.id; })")
    check("a student on both the exempt and SEA lists is flagged", both == [uid("Ler Paw", "KYAW")], both)
    pg.click("#er-root [data-act='go'][data-i='7']")
    check("...and blocks documents", "on both the exempt list and the SEA list" in pg.inner_text("#er-root .er-body"))
    pg.click("#er-root [data-act='go'][data-i='6']")
    key = pg.evaluate("() => 'ex|' + 'lerpaw' + '|' + 'kyaww'")
    pg.select_option("#er-root select[data-match='%s']" % key, "none")   # the exemption list's "Kyaww" was not this student
    check("choosing Not found for the typo clears it", pg.evaluate("() => window.__examRooms.model().both.length") == 0)

    # ---- fixed seats and name fixes ----
    tess = uid("Tess", "BRAMLEY") if any(l == "BRAMLEY" and g == "Tess" for g, l in STUDENTS) else None
    listed = {r[1].upper() for r in csv.reader(EXEMPT.splitlines())} | {r[1].upper() for r in csv.reader(SEA.splitlines())}
    gen = sorted([(l, g) for (g, l), u in STUDENTS.items() if l not in listed and "c%d" % u in [f"c{x}" for c in ("10MAG1", "10MAG2", "10MAG3", "10MAGX") for x in ENROL[c]]])
    mid = uid(gen[10][1], gen[10][0])      # a General Maths student
    back = uid(gen[20][1], gen[20][0])
    pg.click("#er-root [data-act='go'][data-i='4']")
    pg.select_option("#er-pin-who", mid); pg.select_option("#er-pin-kind", "seat"); pg.fill("#er-pin-row", "8"); pg.fill("#er-pin-seat", "20")
    pg.click("#er-root [data-act='addPin']")
    pg.select_option("#er-pin-who", back); pg.select_option("#er-pin-kind", "back"); pg.click("#er-root [data-act='addPin']")
    check("fixed seats added", S()["pins"].get(mid) == {"row": 8, "seat": 20} and S()["pins"].get(back) == {"back": True}, S()["pins"])
    pg.click("#er-root [data-act='go'][data-i='5']")
    jesse = uid("Jesse", "PEMBERTON")
    pg.select_option("#er-ov-who", jesse); pg.fill("#er-ov-last", "Holloway"); pg.click("#er-root [data-act='addOverride']")
    model = pg.evaluate("() => { var m = window.__examRooms.model(); return JSON.parse(JSON.stringify({ seats: m.seats, students: m.students, unplaced: m.unplaced.length, ranges: m.ranges, exempt: m.exempt, provision: m.provision, groupOf: m.groupOf })); }")
    check("surname override applied", model["students"][jesse]["last"] == "HOLLOWAY" and model["students"][jesse]["first"] == "Jesse")

    # ---- seating rules ----
    seats = model["seats"]
    def at(r, s): return [i for i, p in seats.items() if p["row"] == r and p["seat"] == s]
    adv = sorted([model["students"][i] for i, g in model["groupOf"].items() if g == "Advanced Maths" and i in seats], key=lambda x: (x["last"].lower(), x["first"].lower()))
    check("first group starts at Row 1 Seat 1, alphabetical", at(1, 1) == [adv[0]["id"]] and seats[adv[1]["id"]] == {"row": 1, "seat": 2})
    check("only the first 17 seats of a row are used", all(p["seat"] <= 17 for i, p in seats.items() if i != mid))
    check("pinned seat honoured", seats[mid] == {"row": 8, "seat": 20})
    check("back-of-row pin sits at seat 17 of its row", seats[back]["seat"] == 17, seats[back])
    check("exempt students are not seated", not any(i in seats for i in model["exempt"]))
    seated_sea = [i for i in model["provision"] if i in seats]
    check("SEA students go to the SEA Room unless kept", seated_sea == [willow], seated_sea)
    check("nobody left out", model["unplaced"] == 0)
    gen_first = min((p["row"], p["seat"]) for i, p in seats.items() if model["groupOf"].get(i) == "General Maths" and i != mid)
    adv_last = max((p["row"], p["seat"]) for i, p in seats.items() if model["groupOf"].get(i) == "Advanced Maths")
    check("'new row' gap: next group starts on a fresh row", gen_first == (adv_last[0] + 1, 1), (adv_last, gen_first))
    check("footer ranges worked out from seats, with the far pinned seat added", any(r.startswith("General Maths – Row") and ", and Row 8 Seat 20" in r for r in model["ranges"]), model["ranges"])
    # gap rules and the doesn't-fit warning, via the core function
    gap = pg.evaluate("""() => { var f = window.__examRooms.fn, mk = function (p, n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: p + i, first: 'F', last: p + String.fromCharCode(65 + i) }); return a; };
      var out = {}; ['seat', 'row', 'rowplus'].forEach(function (g) {
        var r = f.seat({ rows: 5, seatsPerRow: 6, use: 5 }, [{ name: 'A', gap: g, students: mk('A', 7) }, { name: 'B', gap: g, students: mk('B', 2) }], {});
        out[g] = r.seats.B0; });
      out.over = f.seat({ rows: 2, seatsPerRow: 4, use: 4 }, [{ name: 'A', gap: 'row', students: mk('A', 11) }], {}).unplaced.length;
      return out; }""")
    check("gap rule: one empty seat", gap["seat"] == {"row": 2, "seat": 4}, gap["seat"])
    check("gap rule: new row", gap["row"] == {"row": 3, "seat": 1}, gap["row"])
    check("gap rule: new row plus empty row", gap["rowplus"] == {"row": 4, "seat": 1}, gap["rowplus"])
    check("too many students are reported, not dropped", gap["over"] == 3, gap["over"])

    pg.click("#er-root [data-act='go'][data-i='0']")
    fill("[data-bind='room.rows']", 3)
    pg.click("#er-root [data-act='go'][data-i='6']")
    body = pg.inner_text("#er-root .er-body")
    check("doesn't-fit warning with choices", "do not fit" in body and "Use all 20 seats" in body and "spare seats" in body, body[:300])
    pg.click("#er-root [data-act='go'][data-i='7']")
    check("documents wait until everyone fits", "do not fit yet" in pg.inner_text("#er-root .er-body"))
    pg.click("#er-root [data-act='go'][data-i='0']"); fill("[data-bind='room.rows']", 15)
    pg.click("#er-root [data-act='go'][data-i='6']")

    # ---- drag and drop on the chart ----
    a_id, b_id = at(1, 1)[0], at(1, 2)[0]
    pg.drag_and_drop("#er-root td[data-row='1'][data-seat='1']", "#er-root td[data-row='1'][data-seat='2']")
    m2 = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    check("drag and drop swaps two students", m2[a_id] == {"row": 1, "seat": 2} and m2[b_id] == {"row": 1, "seat": 1}, (m2[a_id], m2[b_id]))
    pg.click("#er-root td[data-row='1'][data-seat='1']"); pg.click("#er-root td[data-row='1'][data-seat='18']")
    m3 = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    check("click-then-click moves a student to an empty seat", m3[b_id] == {"row": 1, "seat": 18}, m3[b_id])
    check("moves are kept as fixed seats", S()["pins"].get(b_id) == {"row": 1, "seat": 18})

    # ---- room size on the chart step, before saving and documents ----
    check("room size can be changed on the seating chart", pg.locator("#er-root [data-roomsize] [data-bind='room.rows']").count() == 1
          and pg.locator("#er-root [data-roomsize] [data-bind='room.use']").count() == 1)
    def chart_rows(): return pg.evaluate("() => document.querySelectorAll('#er-root table.er-grid tr:first-child th').length - 1")
    def chart_spares(): return pg.locator("#er-root table.er-grid td.spare").count()
    M2 = lambda: pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    rows0, spares0 = chart_rows(), chart_spares()
    pg.fill("#er-root [data-roomsize] [data-bind='room.rows']", str(rows0 + 1)); pg.dispatch_event("#er-root [data-roomsize] [data-bind='room.rows']", "change")
    check("changing rows on the chart redraws it straight away", chart_rows() == rows0 + 1 and S()["room"]["rows"] == rows0 + 1, (rows0, chart_rows()))
    pg.fill("#er-root [data-roomsize] [data-bind='room.use']", "18"); pg.dispatch_event("#er-root [data-roomsize] [data-bind='room.use']", "change")
    check("changing seats to use on the chart redraws the spares", chart_spares() < spares0 and S()["room"]["use"] == 18, (spares0, chart_spares()))
    check("moved students stay put when the room is resized", M2()[b_id] == {"row": 1, "seat": 18} and M2()[a_id] == {"row": 1, "seat": 2})
    g2 = pg.evaluate("() => window.__examRooms.docs()")[0]["html"]
    check("the documents use the resized room", g2.count("<th>Row ") == rows0 + 1, g2.count("<th>Row "))
    pg.fill("#er-root [data-roomsize] [data-bind='room.rows']", str(rows0)); pg.dispatch_event("#er-root [data-roomsize] [data-bind='room.rows']", "change")
    pg.fill("#er-root [data-roomsize] [data-bind='room.use']", "17"); pg.dispatch_event("#er-root [data-roomsize] [data-bind='room.use']", "change")
    check("...and back again", chart_rows() == rows0 and chart_spares() == spares0)

    # ---- documents ----
    docs = {d["key"]: d for d in pg.evaluate("() => window.__examRooms.docs()")}
    def text(h): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h.replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&amp;", "&")))
    def headers(h, table_index=0):
        t = re.findall(r"<thead>(.*?)</thead>", h, re.S)[table_index]
        return [text(x).strip() for x in re.findall(r"<th[^>]*>(.*?)</th>", t, re.S)]
    grid, master, sea, rolls = docs["grid"]["html"], docs["master"]["html"], docs["sea"]["html"], docs["rolls"]["html"]
    check("seat grid title", "Crusoe College — BSSC Gym Supervisor Sheet" in text(grid) and "Semester 2 Exam · Year 10" in text(grid).replace("&middot;", "·"))
    check("seat grid is A4 landscape", "size: A4 landscape" in grid)
    check("seat grid footer lists groups", "Advanced Maths – Row 1 Seat 1 to" in text(grid) and "students)" in text(grid))
    check("master list columns", headers(master) == ["First name", "Last name", "Room", "Row", "Seat"], headers(master))
    check("SEA list columns", headers(sea) == ["First name", "Last name", "Class", "Room", "Arrangements"], headers(sea))
    ex_doc = docs["exempt"]["html"]
    check("exempt list columns", headers(ex_doc) == ["First name", "Last name", "Class"], headers(ex_doc))
    ex_last = [text(x).strip() for x in re.findall(r'<td class="last">(.*?)</td>', ex_doc, re.S)]
    want_last = sorted(model["students"][i]["last"] for i in model["exempt"])
    check("exempt list has every exempt student, A-Z, and nobody else", ex_last == want_last, (ex_last, want_last))
    check("exempt list title", "Crusoe College — Exempt Students" in text(ex_doc) and "size: A4 portrait" in ex_doc)
    roll_heads = headers(rolls)
    check("roll columns, one tick column per session", roll_heads == ["#", "First name", "Last name", "Mon 16 Nov AM", "Mon 16 Nov PM"], roll_heads)
    check("one roll page per class code found", len(re.findall(r'class="page"', rolls)) == len(CLASSES), len(re.findall(r'class="page"', rolls)))
    check("roll title and teacher initials", "Crusoe College — Exam Roll 10MAA1" in text(rolls) and '<div class="teacher">TC</div>' in rolls)
    n_exempt = len(model["exempt"])
    check("exempt students greyed with <Exempt>", rolls.count('class="exempt"') == n_exempt and rolls.count("&lt;Exempt&gt;") == n_exempt, (n_exempt, rolls.count('class="exempt"')))
    check("signature line per session", rolls.count("Supervisor signature") == 2 * len(CLASSES))
    allhtml = grid + master + sea + rolls
    check("no Status column anywhere", "Status" not in text(allhtml))
    check("no reasons anywhere", "Fictional reason" not in allhtml and "Reason" not in text(allhtml))
    check("no Class column on the master list", "Class" not in headers(master))
    check("no brackets in printed names", not re.search(r"\(\s*(Annie|Theo|Thu|Jesse|Q J)", text(allhtml)))
    check("preferred names printed", all(n in text(rolls) for n in ("Annie", "Theo", "Thu", "Q J")) and "Annabel" not in text(rolls))
    check("surname override printed", "HOLLOWAY" in master and "PEMBERTON" not in master)
    check("last names in bold capitals on lists", 'td.last { font-weight: 700; text-transform: uppercase; }' in master)
    names_in_master = re.findall(r"<tr><td>(.*?)</td><td class=\"last\">(.*?)</td>", master)
    keys = [(l.lower(), f.lower()) for f, l in names_in_master]
    check("master list A–Z by last name then first", keys == sorted(keys), keys[:5])
    check("SEA students show SEA Room with no row or seat", re.search(r"SEA Room</td><td><b></b></td><td><b></b></td>", master) is not None)
    check("SEA list shows provisions", "Rest breaks; may keep phone to monitor a medical device" in text(sea).replace("&#39;", "'"))
    kaylee = uid("Kaylee", "ORMSBY")
    check("student in two classes is on both rolls", text(rolls).count("ORMSBY") == 2 and text(master).count("ORMSBY") == 1)
    check("document file names only use the exam name", all(d["file"].startswith("Semester 2 Exam - ") for d in docs.values()), [d["file"] for d in docs.values()])

    # names fit their boxes at real A4 landscape size
    view = ctx.new_page()
    view.set_viewport_size({"width": 1123, "height": 794})
    view.set_content(grid); view.emulate_media(media="print"); view.wait_for_timeout(300)
    over = view.evaluate("""() => Array.from(document.querySelectorAll('td span')).filter(function (s) { return s.scrollWidth > s.clientWidth + 0.5; }).map(function (s) { return s.textContent; })""")
    check("no name overflows its seat box on A4", over == [], over[:5])
    shrunk = view.evaluate("""() => Array.from(document.querySelectorAll('td span[style]')).map(function (s) { return s.textContent; })""")
    check("long names are shrunk to fit", "QUILLFEATHER-BRANDENBURG" in shrunk, shrunk[:5])
    view.close()

    # ---- plan file opens in the Manager with the same seats ----
    plan = pg.evaluate("() => window.__examRooms.plan()")
    check("plan file header", plan["app"] == "Exam Seating Manager" and plan["format"] == 1)
    rooms = {r["name"]: r for r in plan["sessions"][0]["rooms"]}
    check("plan rooms: grid with open spares, SEA list, exemptions list",
          rooms["BSSC Gym"]["kind"] == "seated" and rooms["BSSC Gym"]["seatsPerRow"] == 20 and rooms["BSSC Gym"]["layout"]["blocked"] == {}
          and rooms["SEA Room"]["purpose"] == "special" and rooms["Exemptions"]["purpose"] == "withdrawn")
    pst = {st["id"]: st for st in plan["sessions"][0]["students"]}
    check("plan: provision in arrangements, group in notes", pst[willow]["arrangements"] == "Back row of the main room" and pst[willow]["notes"] == "General Maths")
    check("plan file has no reasons", "Fictional reason" not in json.dumps(plan) and "reason" not in json.dumps(plan["examRooms"]).lower())
    tmp = tempfile.mkdtemp()
    plan_path = os.path.join(tmp, "plan.json"); json.dump(plan, open(plan_path, "w"))
    mg = ctx.new_page(); mg.goto(MANAGER); mg.wait_for_timeout(1200)
    mg.click("#editorBtn"); mg.wait_for_timeout(200); mg.fill("#pwInput", "crusoe2026")
    mg.click("#modalFoot button:has-text('Sign in')"); mg.wait_for_timeout(500)
    mg.click("nav button[data-tab='sessions']"); mg.wait_for_timeout(300)
    with mg.expect_file_chooser() as fc:
        mg.click("button:has-text('Open file')")
    fc.value.set_files(plan_path); mg.wait_for_timeout(500)
    mg.click("#modalFoot button:has-text('Replace everything')"); mg.wait_for_timeout(500)
    mg.locator(".session-card").first.click(); mg.wait_for_timeout(300)
    mseats = mg.evaluate("""() => { var out = {}; session().students.forEach(function (st) { if (st.row) out[st.id] = { row: st.row, seat: st.seat, room: roomName(session(), st.roomId) }; }); return out; }""")
    mine = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    check("plan opens in the Manager with the same seats", {k: {"row": v["row"], "seat": v["seat"]} for k, v in mseats.items()} == mine and all(v["room"] == "BSSC Gym" for v in mseats.values()),
          (len(mseats), len(mine)))
    check("Manager keeps SEA and exempt students in their lists", mg.evaluate("() => session().students.filter(function (s) { return s.status === 'Exemption'; }).length") == len(model["exempt"]))
    mg.close()

    # ---- save session file, then reopen (unchanged, then with a new student) ----
    with pg.expect_download() as dl:
        pg.click("#er-root [data-act='save']")
    saved = os.path.join(tmp, "session.json"); dl.value.save_as(saved)
    check("session file name uses the exam name", dl.value.suggested_filename == "Semester 2 Exam - Exam Rooms session.json", dl.value.suggested_filename)
    saved_text = open(saved, encoding="utf-8").read()
    check("session file has no reasons", "Fictional reason" not in saved_text)
    before = pg.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    # reopen in a fresh tab (nothing in memory)
    p2 = ctx.new_page(); p2.on("pageerror", lambda e: errors.append(str(e)))
    p2.route("https://compass.test/**", fake.handle)
    p2.goto("https://compass.test/Records/User.aspx"); p2.evaluate("window.Compass = { schoolId: 1 }"); load_tool(p2)
    with p2.expect_file_chooser() as fc:
        p2.click("#er-root [data-act='open']")
    fc.value.set_files(saved)
    p2.wait_for_function("() => /Nothing has changed|Joined since/.test(document.querySelector('#er-root .er-note') ? document.querySelector('#er-root .er-note').textContent : '')", timeout=15000)
    after = p2.evaluate("() => JSON.parse(JSON.stringify(window.__examRooms.model().seats))")
    check("reopened session restores the same seats", after == before, (len(after), len(before)))
    check("reopen says nothing changed", "Nothing has changed" in p2.inner_text("#er-root .er-note"))
    check("reopen keeps confirmed names and moves", p2.evaluate("() => window.__examRooms.model().pending.length") == 0 and p2.evaluate("() => window.__examRooms.ER.S.pins['%s'].seat" % b_id) == 18)
    fake.extra["10MAF1"] = [("Zed", "ZYGMUNT")]
    with p2.expect_file_chooser() as fc:
        p2.click("#er-root [data-act='open']")
    fc.value.set_files(saved)
    p2.wait_for_function("() => /Joined since/.test(document.querySelector('#er-root .er-note').textContent)", timeout=15000)
    note = p2.inner_text("#er-root .er-note")
    check("reopen reads the latest roll and lists who joined", "Zed ZYGMUNT (10MAF1)" in note, note)
    check("new student is seated", any(st["last"] == "ZYGMUNT" for st in p2.evaluate("() => Object.values(window.__examRooms.model().students)")) and
          p2.evaluate("() => { var m = window.__examRooms.model(); return Object.keys(m.seats).some(function (k) { return m.students[k].last === 'ZYGMUNT'; }); }"))
    check("a file not made by Exam Rooms is refused clearly",
          p2.evaluate("() => { window.__examRooms.open(JSON.stringify({ app: 'Exam Seating Manager', format: 1, sessions: [] })); return document.querySelector('#er-root .er-note').textContent; }").startswith("That file was not saved by Exam Rooms"))
    p2.close()

    # ---- download all ----
    pg.click("#er-root [data-act='go'][data-i='7']")
    names = []
    for _ in range(6):
        with pg.expect_download() as dl:
            if not names: pg.click("#er-root [data-act='downloadAll']")
        names.append(dl.value.suggested_filename)
    check("download all saves 5 documents and the plan", sorted(names) == sorted([
        "Semester 2 Exam - BSSC Gym seat grid.html", "Semester 2 Exam - Master list.html", "Semester 2 Exam - SEA Room list.html",
        "Semester 2 Exam - Exempt list.html", "Semester 2 Exam - Exam rolls.html", "Semester 2 Exam - Exam Seating plan.json"]), names)
    # print uses a hidden iframe
    pg.evaluate("document.querySelectorAll('iframe').forEach(function (f) { f.remove(); })")
    pg.evaluate("window.print = function () {}")
    pg.click("#er-root [data-act='print'][data-doc='master']"); pg.wait_for_timeout(100)
    check("print opens the document in a hidden iframe", "Master List" in (pg.evaluate("() => { var f = document.querySelector('iframe'); return f ? f.contentDocument.body.innerText : ''; }") or ""))

    check("only Compass was contacted", external == [], external[:5])
    # ---- duplicate exam ----
    before = S()
    pg.once("dialog", lambda d: d.dismiss())
    pg.click("#er-root [data-act='duplicate']")
    check("duplicate asks first; Cancel changes nothing", S() == before)
    pg.once("dialog", lambda d: d.accept())
    pg.click("#er-root [data-act='duplicate']")
    dup = S()
    check("duplicate copies the setup", dup["room"] == before["room"] and dup["groups"] == before["groups"] and
          dup["details"]["sessions"] == before["details"]["sessions"] and dup["pins"] == before["pins"] and dup["overrides"] == before["overrides"])
    check("duplicate marks the new exam as a copy", dup["details"]["exam"] == before["details"]["exam"] + " (copy)", dup["details"]["exam"])
    check("duplicate clears the exempt and SEA lists", dup["exemptText"] == "" and dup["seaRows"] == [] and dup["seaStay"] == {} and dup["matchChoice"] == {})
    check("duplicate goes back to step 1 with instructions", pg.evaluate("() => window.__examRooms.ER.step") == 0 and "copy for a new exam" in pg.inner_text("#er-root .er-note"))
    check("the copy seats everyone again without reloading Compass",
          pg.evaluate("() => { var m = window.__examRooms.model(); return Object.keys(m.seats).length > 0 && m.classProblems.length === 0 && Object.keys(m.exempt).length === 0; }"))

    check("no JavaScript errors", errors == [], errors[:3])
    browser.close()

failed = [n for n, ok in results if not ok]
print("\n%d checks, %d failed" % (len(results), len(failed)))
print("ALL PASSED" if not failed else "FAILED: " + ", ".join(failed))
sys.exit(1 if failed else 0)
