#!/usr/bin/env node
/**
 * Builds Exam_Seating_Manager.html from the parts in src/.
 * Run:  node build.js
 *
 * The app ships as ONE self-contained HTML file so staff can open it from a
 * link or the intranet with nothing installed. These source parts exist so the
 * file stays editable; never hand-edit the built HTML — your change would be
 * overwritten on the next build.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'Exam_Seating_Manager.html');

const JS_PARTS = [
  'part2_core.js',             // config, state, sync layer, editor mode, modal, nav
  'part3_sessions.js',         // sessions + students + Excel/CSV import
  'part4_rooms_seating.js',    // rooms, templates, seating engine, seat grid
  'part6_settings.js',         // Settings tab: branding, statuses, room types, defaults, print
  'part7_files.js',            // Save to file / Open file (plan backups)
  'part5_lookup_print_help.js' // lookup, print sheets, how-to guides, seed, boot
];

const seed = JSON.parse(fs.readFileSync(path.join(SRC, 'seed.json'), 'utf8'));

let js = JS_PARTS.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');

const SEED_MARKER = 'var SEED_RAW = null; /*__SEED__*/';
if (!js.includes(SEED_MARKER)) {
  console.error('Build failed: seed marker missing from part5_lookup_print_help.js');
  process.exit(1);
}
js = js.replace(SEED_MARKER, 'var SEED_RAW = ' + JSON.stringify(seed) + ';');

const head = fs.readFileSync(path.join(SRC, 'part1_head.html'), 'utf8');
const html = head + '\n<script>\n' + js + '\n</scr' + 'ipt>\n</body>\n</html>\n';

fs.writeFileSync(OUT, html);

const students = Object.values(seed).reduce((n, list) => n + list.length, 0);
console.log('Built ' + path.basename(OUT));
console.log('  size:      ' + Math.round(html.length / 1024) + ' KB');
console.log('  seeded:    ' + students + ' students across ' + Object.keys(seed).length + ' session(s)');
