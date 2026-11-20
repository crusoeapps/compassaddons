#!/usr/bin/env python3
"""Change the Exam Rooms password.

    python3 exam-seating/set_exam_rooms_password.py

Asks for the new password (it isn't shown or saved anywhere), stores only a
slow PBKDF2 fingerprint of it in exam-rooms/ui.js, and rebuilds exam-rooms.js.
Then commit and push both files. Anyone already unlocked stays unlocked until
they close the Compass tab.
"""
import getpass, hashlib, os, re, secrets, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
UI = os.path.join(HERE, "exam-rooms", "ui.js")
ITERATIONS = 250000

pw = getpass.getpass("New Exam Rooms password: ")
if len(pw) < 12:
    sys.exit("Use at least 12 characters (four random words works well). Nothing changed.")
if getpass.getpass("Type it again: ") != pw:
    sys.exit("The two passwords were different. Nothing changed.")
salt = secrets.token_hex(16)
digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), ITERATIONS).hex()
src = open(UI, encoding="utf-8").read()
new, n = re.subn(r"var ER_LOCK = \{ salt: '[0-9a-f]+', iterations: \d+, hash: '[0-9a-f]+' \};",
                 "var ER_LOCK = { salt: '%s', iterations: %d, hash: '%s' };" % (salt, ITERATIONS, digest), src)
if n != 1:
    sys.exit("Could not find the password setting in exam-rooms/ui.js. Nothing changed.")
open(UI, "w", encoding="utf-8").write(new)
subprocess.run(["node", os.path.join(HERE, "build_exam_rooms.js")], check=True, cwd=HERE)
print("Password changed. Commit and push exam-seating/exam-rooms/ui.js and exam-rooms.js.")
