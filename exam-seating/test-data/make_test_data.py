#!/usr/bin/env python3
"""Writes the FICTIONAL sample files used by UI_TEST_SCRIPT.md.

Every name here is made up. The files copy the layout of a Compass
"GridExport" CSV (a title row, a Name/Class/Performance header row, one row
per student with "First LAST" in one column, then Minimum/Maximum/Standard
Deviation/Mean/Median rows) so the test exercises the real import path.

    python3 make_test_data.py        # rewrites the CSVs next to this script
"""
import csv, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rnd = random.Random(11)
FIRST = ("Aria Asher Bella Blake Caleb Chloe Darcy Eli Ella Elsie Ethan Evie Finn Flora Freya Gus Harper Hazel Henry Isla "
         "Ivy Jack Jade Jasper Kai Leo Lily Lola Luca Mabel Mason Mia Milo Nate Nell Noah Nova Olive Oscar Paige Pippa "
         "Quinn Remy Riley Rosie Ruby Sam Sienna Theo Tess Toby Vera Wes Willow Zac Zara Arlo Beau Cleo Dexter Felix "
         "Hugo Indie Jude Kit Lottie Max Nico Phoebe Reuben Sadie Tilly").split()
LAST = ("ABBOTT AINSWORTH ALDER ASHBY BANNISTER BARLOW BECKETT BRAMLEY CALLOWAY CARVER CHANDLER CLEMENT DALTON DARBY "
        "DELANEY DRAPER EASTWOOD ELLERY FARROW FENWICK FINCH FLETCHER GALLOWAY GILMORE GOODWIN GRANGER HADLEY HARLOW "
        "HAYWARD HUXLEY INGRAM JARVIS KEARNEY KENDALL LANGFORD LARKIN LAWSON MACKAY MARLOW MERRITT MONROE NASH NORWOOD "
        "OAKLEY PAGET RADFORD RAMSAY RIDLEY SADLER SEXTON SHELBY STANTON SUTTON TALBOT TENNANT "
        "VARLEY WAKEFIELD WINSLOW WREN YARDLEY YATES").split()

# Hand-made rows covering every awkward case seen in a real cycle.
SPECIAL = {
    "Advanced": [("Aria", "QUILLFEATHER-BRANDENBURG", "10MAA1"),           # very long surname (grid shrink)
                 ("Theodore (Theo)", "MARCHWOOD", "10MAA2"),               # preferred name in brackets
                 ("Ivy", "VAN DER BERG", "10MAA1")],                       # multi-word surname
    "General":  [("Jesse (Jesse Holloway)", "PEMBERTON", "10MAG1"),        # bracket = different surname
                 ("Kaylee", "ORMSBY", "10MAG2, 10MAG3"),                   # two classes in one cell
                 ("Harley", "WEXFORD - DAVENTRY", "10MAG2"),               # spaced hyphen
                 ("Bella", "KILBRIDE-O'DARE", "10MAG1"),                   # apostrophe
                 ("Nyein Thu Zar (Thu)", "LWIN", "10MAG3"),                # long given name + short preferred
                 ("Ler Paw Myint", "KYAW", "10MAG3"),                       # exemption list misspells this "Kyaww"
                 ("Quinlan (Q J)", "ESTRADA", "10MAGX")],                  # capital letters inside brackets
    "Foundation": [("Annabel (Annie)", "FAIRWEATHER", "10MAF1"),
                   ("Oliver", "THISTLEWOOD", "10MAF2")],                   # exemption list says "Ollie Thistlewood"
}
SIZES = {"Advanced": (22, ["10MAA1", "10MAA2"]), "General": (40, ["10MAG1", "10MAG2", "10MAG3", "10MAGX"]),
         "Foundation": (14, ["10MAF1", "10MAF2"])}

used, groups = set(), {}
for g, (n, classes) in SIZES.items():
    rows = list(SPECIAL[g])
    used.update((f, l) for f, l, _ in rows)
    while len(rows) < n:
        f, l = rnd.choice(FIRST), rnd.choice(LAST)
        if (f, l) in used: continue
        used.add((f, l)); rows.append((f, l, rnd.choice(classes)))
    rows.sort(key=lambda r: (r[1], r[0]))
    groups[g] = rows

def write_grid(path, title, rows):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, quoting=csv.QUOTE_ALL)
        w.writerow(["", "", title]); w.writerow(["Name", "Class", "Performance"])
        for f, l, k in rows: w.writerow([f + " " + l, k, ""])
        for s in ["Minimum", "Maximum", "Standard Deviation", "Mean", "Median"]: w.writerow([s, "", "N/A"])

for g, rows in groups.items():
    write_grid(os.path.join(HERE, g + "_Maths.csv"), "Semester 2 Exam 10MAT", rows)

# English: every student above, spread over four English classes.
everyone = sorted({(f, l) for rows in groups.values() for f, l, _ in rows}, key=lambda r: (r[1], r[0]))
write_grid(os.path.join(HERE, "English.csv"), "Semester 2 Exam 10ENG",
           [(f, l, "10ENG%d" % (i % 4 + 1)) for i, (f, l) in enumerate(everyone)])

def pick(g, i): f, l, _ = groups[g][i]; return f.split(" (")[0], l.title()
exempt = [pick("General", 3), pick("General", 12), pick("Foundation", 5), pick("Advanced", 8),
          ("Ler Paw", "Kyaww"),               # typo: the record is Ler Paw Myint KYAW
          ("Ollie", "Thistlewood"),           # nickname: the record is Oliver THISTLEWOOD
          ("Rose", "Marlowe")]                # on no list at all
with open(os.path.join(HERE, "Exemptions.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["First name", "Last name"]); w.writerows(exempt)

prov = [("Advanced", 2, "Fictional reason A", "Smaller space"),
        ("General", 6, "Fictional reason B", "Scribe, separate room if needed"),
        ("General", 20, "Fictional reason C", "Use of computer where possible"),
        ("Foundation", 3, "Fictional reason D", "Rest breaks; may keep phone to monitor a medical device"),
        ("General", 25, "Fictional reason E", "Back row of the main room")]
with open(os.path.join(HERE, "Provisions.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["First name", "Last name", "Form", "Reason", "Provision"])
    for g, i, reason, p in prov:
        f, l = pick(g, i); w.writerow([f, l, "10", reason, p])

with open(os.path.join(HERE, "Teachers.csv"), "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["Class", "Lead teacher"])
    w.writerows([("10ENG1", "TCA"), ("10ENG2", "TCB"), ("10ENG3", "TCC"), ("10ENG4", "TCD")])

print("Wrote:", ", ".join(sorted(f for f in os.listdir(HERE) if f.endswith(".csv"))))
print({g: len(r) for g, r in groups.items()}, "English:", len(everyone))
