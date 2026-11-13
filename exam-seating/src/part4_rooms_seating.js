/* ======================= VIEW: ROOMS ========================== */
function roomSummary(r) {
  if (r.kind !== 'seated') return 'list only, no seat numbers';
  var cap = usableSeats(r), total = r.rows * r.seatsPerRow;
  return r.rows + ' rows &times; ' + r.seatsPerRow + ' seats (' + cap + ' capacity' + (cap < total ? ', ' + (total - cap) + ' seats blocked' : '') + ')';
}

function viewRooms() {
  var s = session();
  if (!s) return noSessionMsg();
  var cards = s.rooms.map(function (r, i) {
    return '<div class="room-card ' + esc(r.purpose) + '"><h3>' + esc(r.name) + '</h3>' +
      '<div class="rc-sub">' + esc(purposeLabel(r.purpose)) + ' &middot; ' + roomSummary(r) +
      (r.layout && r.layout.supervisor ? '<br>Supervisor: ' + esc(r.layout.supervisor) : '') +
      '</div><div class="rc-actions"><button class="btn small secondary" onclick="roomModal(\'' + r.id + '\')">Edit</button>' +
      '<button class="btn small danger" onclick="deleteRoom(\'' + r.id + '\')">Delete</button>' +
      '<span class="rc-order">' +
      '<button class="btn small secondary" title="Fill this room earlier" onclick="moveRoom(\'' + r.id + '\',-1)"' + (i === 0 ? ' disabled' : '') + '>&#9650;</button>' +
      '<button class="btn small secondary" title="Fill this room later" onclick="moveRoom(\'' + r.id + '\',1)"' + (i === s.rooms.length - 1 ? ' disabled' : '') + '>&#9660;</button>' +
      '</span></div></div>';
  }).join('');
  var tmpls = DB.templates.map(function (t) {
    return '<div class="room-card"><h3>' + esc(t.name) + '</h3>' +
      '<div class="rc-sub">' + (t.rooms.map(function (r) { return esc(r.name); }).join(' &middot; ') || 'empty') + '</div>' +
      '<div class="rc-actions"><button class="btn small secondary" onclick="applyTemplate(\'' + t.id + '\')">Apply to this session</button>' +
      '<button class="btn small danger" onclick="deleteTemplate(\'' + t.id + '\')">Delete</button></div></div>';
  }).join('');
  return '<div class="section-head"><div><h2>Rooms &amp; Layout — ' + esc(s.name) + '</h2>' +
    '<p>Set up where this exam happens. Seat-grid rooms are filled in the order shown (use &#9650;&#9660; to change it); list rooms just hold names. Room types are set in <b>Settings</b>. Save a set of rooms as a template to reuse next time.</p></div>' +
    '<div class="toolbar"><button class="btn" onclick="roomModal()">+ Add room</button>' +
    '<button class="btn secondary" onclick="saveTemplateModal()">Save rooms as template</button></div></div>' +
    (s.rooms.length ? '<div class="room-cards">' + cards + '</div>'
      : '<div class="empty-msg" style="margin-bottom:22px">No rooms yet — click "+ Add room". Most sessions need one seat-grid room plus a list room for each other room type.</div>') +
    '<div class="section-head"><div><h2 style="font-size:1.1rem">Saved templates</h2><p>Templates are shared across all sessions.</p></div></div>' +
    (DB.templates.length ? '<div class="room-cards">' + tmpls + '</div>' : '<div class="empty-msg">No templates saved yet.</div>');
}

function moveRoom(id, dir) {
  if (!editor) return;
  var s = session();
  var i = s.rooms.findIndex(function (x) { return x.id === id; });
  var j = i + dir;
  if (i < 0 || j < 0 || j >= s.rooms.length) return;
  var tmp = s.rooms[i]; s.rooms[i] = s.rooms[j]; s.rooms[j] = tmp;
  markDirty(); render();
}

/* ---- room editor: the seat mask is edited on a draft until Save ---- */
var roomDraft = null;
var BLOCK_NEXT = { '': 'aisle', aisle: 'unusable', unusable: '' };

function labelSelect(id, val) {
  return '<select id="' + id + '" onchange="roomDraftChanged()"><option value="number"' + (val === 'number' ? ' selected' : '') + '>Numbers (1, 2, 3)</option>' +
    '<option value="letter"' + (val === 'letter' ? ' selected' : '') + '>Letters (A, B, C)</option></select>';
}
function fromSelect(id, val, startTxt, endTxt) {
  return '<select id="' + id + '" onchange="roomDraftChanged()"><option value="start"' + (val === 'start' ? ' selected' : '') + '>' + startTxt + '</option>' +
    '<option value="end"' + (val === 'end' ? ' selected' : '') + '>' + endTxt + '</option></select>';
}

function roomModal(id) {
  if (!editor) return;
  var s = session();
  var r = id ? s.rooms.find(function (x) { return x.id === id; }) : null;
  var L = r ? r.layout : clone(DEFAULT_ROOM_LAYOUT);
  roomDraft = { rows: r && r.rows ? r.rows : 12, seatsPerRow: r && r.seatsPerRow ? r.seatsPerRow : 18,
                layout: clone(L) };
  var purpose = r ? r.purpose : cfg().purposes[0].id;
  var showGrid = purposeById(purpose).layout === 'seated';
  var purposeOpts = cfg().purposes.map(function (p) {
    return '<option value="' + esc(p.id) + '"' + (p.id === purpose ? ' selected' : '') + '>' + esc(p.label) + (p.layout === 'seated' ? ' (seat grid)' : ' (list)') + '</option>';
  }).join('');
  if (!cfg().purposes.some(function (p) { return p.id === purpose; })) purposeOpts += '<option value="' + esc(purpose) + '" selected>' + esc(purpose) + ' (no longer in Settings)</option>';
  openModal(r ? 'Edit room' : 'Add room',
    '<div class="form-grid"><div class="form-row"><label>Room name</label><input type="text" id="f_rname" value="' + (r ? esc(r.name) : '') + '" placeholder="e.g. Gym, Library, Room 12"></div>' +
    '<div class="form-row"><label>Supervisor (optional)</label><input type="text" id="f_super" value="' + esc(L.supervisor || '') + '" placeholder="Printed on this room\'s sheet"></div></div>' +
    '<div class="form-row"><label>Room type</label><select id="f_purpose" onchange="roomDraftChanged()">' + purposeOpts + '</select></div>' +
    '<div id="gridFields" style="display:' + (showGrid ? 'block' : 'none') + '">' +
    '<div class="form-grid">' +
    '<div class="form-row"><label>Rows</label><input type="number" id="f_rows" min="1" max="60" value="' + roomDraft.rows + '" onchange="roomDraftChanged()"></div>' +
    '<div class="form-row"><label>Seats per row</label><input type="number" id="f_seats" min="1" max="60" value="' + roomDraft.seatsPerRow + '" onchange="roomDraftChanged()"></div></div>' +
    '<div class="form-grid">' +
    '<div class="form-row"><label>Row labels</label>' + labelSelect('f_rowlab', L.rowLabels) + fromSelect('f_rowfrom', L.rowFrom, 'Start at the front', 'Start at the back') + '</div>' +
    '<div class="form-row"><label>Seat labels</label>' + labelSelect('f_seatlab', L.seatLabels) + fromSelect('f_seatfrom', L.seatFrom, 'Start at seat 1 side', 'Start at the far side') + '</div></div>' +
    '<label>Seat map — click a seat to cycle: open &rarr; aisle &rarr; unusable. Click a Row or Seat heading to block or clear the whole line.</label>' +
    '<div id="maskWrap" class="mask-wrap"></div></div>',
    [{ label: r ? 'Save changes' : 'Add room', cls: 'btn', fn: function () {
      if (!editor) return;
      var name = document.getElementById('f_rname').value.trim();
      if (!name) { toast('Give the room a name', true); return; }
      roomDraftChanged();
      var purpose = document.getElementById('f_purpose').value;
      var kind = purposeById(purpose).layout === 'seated' ? 'seated' : 'list';
      var rows = roomDraft.rows, seatsPerRow = roomDraft.seatsPerRow;
      var layout = roomDraft.layout;
      layout.supervisor = document.getElementById('f_super').value.trim();
      var target = r || { id: uid() };
      target.name = name; target.purpose = purpose; target.kind = kind; target.rows = rows; target.seatsPerRow = seatsPerRow; target.layout = layout;
      var released = 0;
      if (r) {
        s.students.forEach(function (st) {
          if (st.roomId === r.id && st.row && (st.row > rows || st.seat > seatsPerRow || kind !== 'seated' || seatBlocked(r, st.row, st.seat))) {
            st.row = null; st.seat = null; released++;
          }
        });
      } else {
        s.rooms.push(target);
      }
      roomDraft = null;
      markDirty(); closeModal(); render();
      if (released) toast(released + ' student' + (released > 1 ? 's were' : ' was') + ' in a removed or blocked seat and now need' + (released > 1 ? '' : 's') + ' a seat — see the Seating Plan', true);
    } }], true);
  drawMask();
}

/* Read the modal's inputs into the draft and redraw the seat map. */
function roomDraftChanged() {
  if (!roomDraft) return;
  var showGrid = purposeById(document.getElementById('f_purpose').value).layout === 'seated';
  document.getElementById('gridFields').style.display = showGrid ? 'block' : 'none';
  roomDraft.rows = Math.min(60, Math.max(1, parseInt(document.getElementById('f_rows').value, 10) || 12));
  roomDraft.seatsPerRow = Math.min(60, Math.max(1, parseInt(document.getElementById('f_seats').value, 10) || 18));
  var L = roomDraft.layout;
  L.rowLabels = document.getElementById('f_rowlab').value; L.rowFrom = document.getElementById('f_rowfrom').value;
  L.seatLabels = document.getElementById('f_seatlab').value; L.seatFrom = document.getElementById('f_seatfrom').value;
  Object.keys(L.blocked).forEach(function (k) {
    var p = k.split('_');
    if (Number(p[0]) > roomDraft.rows || Number(p[1]) > roomDraft.seatsPerRow) delete L.blocked[k];
  });
  drawMask();
}

function drawMask() {
  var el = document.getElementById('maskWrap');
  if (!el || !roomDraft) return;
  var d = roomDraft, B = d.layout.blocked;
  var t = '<table class="mask"><thead><tr><th></th>';
  for (var row = 1; row <= d.rows; row++) t += '<th onclick="maskLine(\'row\',' + row + ')">Row ' + esc(lineLabel(row, d.rows, d.layout.rowLabels, d.layout.rowFrom)) + '</th>';
  t += '</tr></thead><tbody>';
  for (var seat = 1; seat <= d.seatsPerRow; seat++) {
    t += '<tr><th onclick="maskLine(\'seat\',' + seat + ')">Seat ' + esc(lineLabel(seat, d.seatsPerRow, d.layout.seatLabels, d.layout.seatFrom)) + '</th>';
    for (var row2 = 1; row2 <= d.rows; row2++) {
      var b = B[row2 + '_' + seat] || '';
      t += '<td class="m ' + b + '" title="' + (b || 'open') + '" onclick="maskCell(' + row2 + ',' + seat + ')"></td>';
    }
    t += '</tr>';
  }
  var blocked = Object.keys(B).length;
  el.innerHTML = t + '</tbody></table><div class="muted" style="margin-top:6px">' + (d.rows * d.seatsPerRow - blocked) + ' usable seats' +
    (blocked ? ' &middot; ' + blocked + ' blocked' : '') + ' &middot; <span class="m-key aisle"></span> aisle <span class="m-key unusable"></span> unusable</div>';
}

function maskCell(row, seat) {
  if (!editor || !roomDraft) return;
  var B = roomDraft.layout.blocked, k = row + '_' + seat;
  var next = BLOCK_NEXT[B[k] || ''];
  if (next) B[k] = next; else delete B[k];
  drawMask();
}

function maskLine(kind, n) {
  if (!editor || !roomDraft) return;
  var d = roomDraft, B = d.layout.blocked, keys = [];
  if (kind === 'row') for (var seat = 1; seat <= d.seatsPerRow; seat++) keys.push(n + '_' + seat);
  else for (var row = 1; row <= d.rows; row++) keys.push(row + '_' + n);
  var allBlocked = keys.every(function (k) { return B[k]; });
  keys.forEach(function (k) { if (allBlocked) delete B[k]; else if (!B[k]) B[k] = 'aisle'; });
  drawMask();
}

function deleteRoom(id) {
  if (!editor) return;
  var s = session();
  var r = s.rooms.find(function (x) { return x.id === id; });
  var count = s.students.filter(function (st) { return st.roomId === id; }).length;
  openModal('Delete room?',
    '<p>Delete <b>' + esc(r.name) + '</b>?' + (count ? ' The ' + count + ' students in it become unseated — they are not removed from the session.' : '') + '</p>',
    [{ label: 'Delete room', cls: 'btn danger', fn: function () {
      if (!editor) return;
      s.students.forEach(function (st) { if (st.roomId === id) { st.roomId = null; st.row = null; st.seat = null; } });
      s.rooms = s.rooms.filter(function (x) { return x.id !== id; });
      markDirty(); closeModal(); render();
    } }]);
}

function saveTemplateModal() {
  if (!editor) return;
  var s = session();
  if (!s.rooms.length) { toast('Add rooms first', true); return; }
  openModal('Save rooms as template',
    '<div class="form-row"><label>Template name</label><input type="text" id="f_tname" placeholder="e.g. Main hall + two small rooms"></div>' +
    '<p class="muted">Saves: ' + s.rooms.map(function (r) { return esc(r.name); }).join(', ') + ' — including blocked seats and labels.</p>',
    [{ label: 'Save template', cls: 'btn', fn: async function () {
      if (!editor) return;
      var name = document.getElementById('f_tname').value.trim();
      if (!name) { toast('Give the template a name', true); return; }
      var rooms = JSON.parse(JSON.stringify(s.rooms)).map(function (r) { delete r.id; return r; });
      if (remote()) {
        try {
          var out = await apiPost({ action: 'saveTemplate', password: editorPassword, name: name, rooms: rooms });
          if (!out.ok) throw new Error(out.error || 'save failed');
          var existing = DB.templates.find(function (t) { return t.name === name; });
          if (existing) existing.rooms = rooms;
          else DB.templates.push({ id: out.templateId, name: name, rooms: rooms });
        } catch (e) { toast('Template not saved: ' + e.message, true); return; }
      } else {
        DB.templates.push({ id: uid(), name: name, rooms: rooms });
        markDirty();
      }
      closeModal(); render();
      toast('Template saved');
    } }]);
}

function applyTemplate(id) {
  if (!editor) return;
  var s = session();
  var t = DB.templates.find(function (x) { return x.id === id; });
  openModal('Apply template?',
    '<p>Replace this session\'s rooms with the <b>' + esc(t.name) + '</b> template? All current seat assignments are cleared — students stay on the list.</p>',
    [{ label: 'Apply template', cls: 'btn', fn: function () {
      if (!editor) return;
      s.rooms = JSON.parse(JSON.stringify(t.rooms)).map(function (r) { r.id = uid(); return migrateRoom(r); });
      normaliseSession(s);
      s.students.forEach(function (st) { routeStudent(s, st); });
      markDirty(); closeModal(); render();
      toast('Template applied — now regenerate the seating plan');
    } }]);
}

async function deleteTemplate(id) {
  if (!editor) return;
  if (remote()) {
    try {
      var out = await apiPost({ action: 'deleteTemplate', password: editorPassword, templateId: id });
      if (!out.ok) throw new Error(out.error || 'delete failed');
    } catch (e) { toast('Delete failed: ' + e.message, true); return; }
  }
  DB.templates = DB.templates.filter(function (t) { return t.id !== id; });
  if (!remote()) markDirty();
  render();
}

/* =================== SEATING ENGINE + VIEW ====================
   Rules live in s.settings (per session, defaults from Settings):
     sortBy   surname | first | class | import | random
     pattern  all | alt-seat | alt-row | checker
     rowDir   front | back          seatDir  ltr | rtl | snake
     near     side | cross | all    (what counts as "next to" for keep-apart)
   With the defaults (surname, all, front, ltr, cross) the result is
   identical to the original engine.
   ================================================================ */
var SORT_OPTIONS = [['surname', 'Alphabetical by surname'], ['first', 'Alphabetical by first name'], ['class', 'Grouped by class, then surname'],
                    ['import', 'Import order (as in your spreadsheet)'], ['random', 'Random (reshuffle any time)']];
var PATTERN_OPTIONS = [['all', 'Every seat'], ['alt-seat', 'Every second seat'], ['alt-row', 'Every second row'], ['checker', 'Checkerboard (no one beside or behind)']];
var ROWDIR_OPTIONS = [['front', 'Front to back'], ['back', 'Back to front']];
var SEATDIR_OPTIONS = [['ltr', 'Seat 1 first, every row'], ['rtl', 'Far side first, every row'], ['snake', 'Snake (alternate direction each row)']];
var NEAR_OPTIONS = [['side', 'Side by side only'], ['cross', 'Side by side, in front or behind'], ['all', 'Any of the 8 surrounding seats']];

function optionsHTML(list, val) {
  return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
}

/* Seeded shuffle so "Random" gives the same plan until you reshuffle. */
function seededShuffle(list, seed) {
  var a = seed >>> 0 || 1;
  function rnd() { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
  return list;
}

function sortCandidates(s, list) {
  var by = s.settings.sortBy;
  if (by === 'class') return list.sort(function (a, b) { return (a.klass || '').localeCompare(b.klass || '') || byName(a, b); });
  if (by === 'first') return list.sort(function (a, b) { return (a.first + a.last).localeCompare(b.first + b.last); });
  if (by === 'import') return list;                     // s.students keeps spreadsheet order
  if (by === 'random') return seededShuffle(list.sort(byName), s.settings.shuffleSeed);
  return list.sort(byName);
}

/* Every usable [row, seat] in a room, in the order the engine fills them. */
function seatOrder(s, r) {
  var set = s.settings, out = [];
  var rows = []; for (var i = 1; i <= r.rows; i++) rows.push(i);
  if (set.rowDir === 'back') rows.reverse();
  rows.forEach(function (row, ri) {
    var seats = []; for (var k = 1; k <= r.seatsPerRow; k++) seats.push(k);
    if (set.seatDir === 'rtl' || (set.seatDir === 'snake' && ri % 2 === 1)) seats.reverse();
    seats.forEach(function (seat) {
      if (seatBlocked(r, row, seat)) return;
      if (set.pattern === 'alt-seat' && seat % 2 === 0) return;
      if (set.pattern === 'alt-row' && row % 2 === 0) return;
      if (set.pattern === 'checker' && (row + seat) % 2 === 1) return;
      out.push([row, seat]);
    });
  });
  return out;
}

function autoSeat() {
  if (!editor) return;
  var s = session();
  var gridPurposes = cfg().purposes.filter(function (p) { return p.layout === 'seated'; });
  var gridRooms = s.rooms.filter(function (r) { return r.kind === 'seated'; });
  if (!gridRooms.length) { toast('Add a seat-grid room first (Rooms & Layout)', true); return; }
  s.students.forEach(function (st) { if (isSeatedStatus(st.status)) { st.roomId = null; st.row = null; st.seat = null; } });
  var seated = 0, leftover = 0, noRoom = [];
  gridPurposes.forEach(function (p) {
    var cands = sortCandidates(s, s.students.filter(function (st) { return statusPurpose(st.status) === p.id; }));
    if (!cands.length) return;
    var rooms = s.rooms.filter(function (r) { return r.purpose === p.id && r.kind === 'seated'; });
    if (!rooms.length) { noRoom.push(p.label); leftover += cands.length; return; }
    var i = 0;
    rooms.forEach(function (room) {
      seatOrder(s, room).forEach(function (pos) {
        if (i >= cands.length) return;
        var st = cands[i++];
        st.roomId = room.id; st.row = pos[0]; st.seat = pos[1];
      });
    });
    seated += i; leftover += cands.length - i;
  });
  s.students.forEach(function (st) { if (!isSeatedStatus(st.status)) routeStudent(s, st); });
  fixKeepApart(s);
  markDirty(); render();
  if (noRoom.length) toast('Seated ' + seated + ' students — no room set up for: ' + noRoom.join(', ') + '. Add one in Rooms & Layout.', true);
  else toast(leftover > 0 ? 'Seated ' + seated + ' students — ' + leftover + ' did not fit. Add rows or another room.' : 'Seated ' + seated + ' students', leftover > 0);
}

function adjacentPairs(s) {
  var bad = [], near = s.settings.near || 'cross';
  s.settings.keepApart.forEach(function (p) {
    var sa = s.students.find(function (x) { return x.id === p[0]; });
    var sb = s.students.find(function (x) { return x.id === p[1]; });
    if (!sa || !sb || !sa.row || !sb.row || sa.roomId !== sb.roomId) return;
    var dr = Math.abs(sa.row - sb.row), ds = Math.abs(sa.seat - sb.seat);
    var sideBySide = dr === 0 && ds === 1;
    var frontBack = ds === 0 && dr === 1;
    var diagonal = dr === 1 && ds === 1;
    if (sideBySide || (near !== 'side' && frontBack) || (near === 'all' && diagonal)) bad.push([sa, sb]);
  });
  return bad;
}

function fixKeepApart(s) {
  for (var pass = 0; pass < 4; pass++) {
    var bad = adjacentPairs(s);
    if (!bad.length) return;
    var before = bad.length;
    for (var b = 0; b < bad.length; b++) {
      var sb = bad[b][1];
      var seated = s.students.filter(function (st) { return st.row && st.id !== bad[b][0].id && st.id !== sb.id; });
      for (var k = 0; k < seated.length; k++) {
        var other = seated[k];
        var tmp = { roomId: sb.roomId, row: sb.row, seat: sb.seat };
        sb.roomId = other.roomId; sb.row = other.row; sb.seat = other.seat;
        other.roomId = tmp.roomId; other.row = tmp.row; other.seat = tmp.seat;
        if (adjacentPairs(s).length < before) break;
        var t2 = { roomId: sb.roomId, row: sb.row, seat: sb.seat };
        sb.roomId = other.roomId; sb.row = other.row; sb.seat = other.seat;
        other.roomId = t2.roomId; other.row = t2.row; other.seat = t2.seat;
      }
    }
    if (adjacentPairs(s).length >= before) return;
  }
}

function seatingRulesModal() {
  if (!editor) return;
  var st = session().settings;
  openModal('Seating rules for this session',
    '<p class="muted" style="margin-bottom:12px">These apply the next time you click <b>Generate seating</b>. New sessions start from the defaults in Settings.</p>' +
    '<div class="form-grid"><div class="form-row"><label>Order</label><select id="r_sort">' + optionsHTML(SORT_OPTIONS, st.sortBy) + '</select></div>' +
    '<div class="form-row"><label>Spacing</label><select id="r_pattern">' + optionsHTML(PATTERN_OPTIONS, st.pattern) + '</select></div></div>' +
    '<div class="form-grid"><div class="form-row"><label>Fill rows</label><select id="r_rowdir">' + optionsHTML(ROWDIR_OPTIONS, st.rowDir) + '</select></div>' +
    '<div class="form-row"><label>Fill seats</label><select id="r_seatdir">' + optionsHTML(SEATDIR_OPTIONS, st.seatDir) + '</select></div></div>' +
    '<div class="form-row"><label>Keep-apart pairs must not be</label><select id="r_near">' + optionsHTML(NEAR_OPTIONS, st.near) + '</select></div>' +
    '<p class="muted">Rooms fill in the order shown on Rooms &amp; Layout. Blocked seats are always skipped.</p>',
    [{ label: 'Save rules', cls: 'btn', fn: function () {
      if (!editor) return;
      st.sortBy = document.getElementById('r_sort').value;
      st.pattern = document.getElementById('r_pattern').value;
      st.rowDir = document.getElementById('r_rowdir').value;
      st.seatDir = document.getElementById('r_seatdir').value;
      st.near = document.getElementById('r_near').value;
      markDirty(); closeModal(); render();
      toast('Rules saved — click Generate seating to apply them');
    } }]);
}

function setSortBy(v) {
  if (!editor) return;
  session().settings.sortBy = v;
  markDirty(); render();
}

function reshuffle() {
  if (!editor) return;
  var s = session();
  s.settings.shuffleSeed = Math.floor(Math.random() * 2147483646) + 1;
  autoSeat();
}

function viewSeating() {
  var s = session();
  if (!s) return noSessionMsg();
  var conflicts = adjacentPairs(s);
  var conflictIds = {};
  conflicts.forEach(function (p) { conflictIds[p[0].id] = 1; conflictIds[p[1].id] = 1; });
  var unseated = s.students.filter(function (st) { return isSeatedStatus(st.status) && !st.row; }).sort(byName);
  var roomOpts = '<option value="all"' + (seatingRoomFilter === 'all' ? ' selected' : '') + '>All rooms</option>' +
    s.rooms.map(function (r) { return '<option value="' + r.id + '"' + (seatingRoomFilter === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');

  var html = '<div class="view-note">View-only mode — this plan is live and up to date. Use the Print tab for paper copies.</div>' +
    '<div class="section-head"><div><h2>Seating Plan — ' + esc(s.name) + '</h2>' +
    '<p>Generate seating automatically, then click any two seats to swap those students, or click a student and then an empty seat to move them.</p></div></div>' +
    '<div class="seating-toolbar">' +
    '<span class="editor-only" style="display:contents"><button class="btn gold" onclick="autoSeat()">Generate seating</button>' +
    '<label style="margin:0">Order</label><select onchange="setSortBy(this.value)">' + optionsHTML(SORT_OPTIONS, s.settings.sortBy) + '</select>' +
    (s.settings.sortBy === 'random' ? '<button class="btn secondary" onclick="reshuffle()">Reshuffle</button>' : '') +
    '<button class="btn secondary" onclick="seatingRulesModal()">Seating rules</button>' +
    '<button class="btn secondary" onclick="keepApartModal()">Keep-apart pairs (' + s.settings.keepApart.length + ')</button>' +
    '<button class="btn secondary" onclick="clearSeatsConfirm()">Clear all seats</button>' +
    '<span class="tb-divider"></span></span>' +
    '<label style="margin:0">Show</label><select onchange="seatingRoomFilter=this.value;render()">' + roomOpts + '</select>' +
    (conflicts.length ? '<span class="pill withdrawn">' + conflicts.length + ' keep-apart conflict' + (conflicts.length > 1 ? 's' : '') + ' — highlighted red</span>' : '') + '</div>';

  if (unseated.length) {
    html += '<div class="unseated-panel editor-only"><h4>' + unseated.length + ' student' + (unseated.length > 1 ? 's' : '') + ' without a seat — click one, then click an empty seat</h4>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + unseated.map(function (st) {
        return '<span class="chip' + (selectedSeat && selectedSeat.studentId === st.id ? ' selected' : '') + '" onclick="pickUnseated(\'' + st.id + '\')">' + esc(st.first) + ' <b>' + esc(st.last) + '</b></span>';
      }).join('') + '</div></div>';
  }

  var rooms = s.rooms.filter(function (r) { return seatingRoomFilter === 'all' || r.id === seatingRoomFilter; });
  if (!rooms.length) html += '<div class="empty-msg">No rooms set up yet. Editors: add rooms in <b>Rooms &amp; Layout</b>.</div>';

  rooms.forEach(function (r) {
    var inRoom = s.students.filter(function (st) { return st.roomId === r.id; });
    html += '<div class="room-banner ' + esc(r.purpose) + '"><h3>' + esc(r.name) + '</h3><span>' + inRoom.length + ' students' +
      (r.kind === 'seated' ? ' &middot; ' + r.rows + ' &times; ' + r.seatsPerRow : '') +
      (r.layout && r.layout.supervisor ? ' &middot; Supervisor: ' + esc(r.layout.supervisor) : '') + '</span></div>';
    if (r.kind === 'seated') {
      var grid = {};
      inRoom.forEach(function (st) { if (st.row) grid[st.row + '_' + st.seat] = st; });
      var t = '<div class="seat-grid-wrap"><table class="seat-table"><thead><tr><th></th>';
      for (var row = 1; row <= r.rows; row++) t += '<th>Row ' + esc(rowLabel(r, row)) + '</th>';
      t += '</tr></thead><tbody>';
      for (var seat = 1; seat <= r.seatsPerRow; seat++) {
        t += '<tr><th>Seat ' + esc(seatLabel(r, seat)) + '</th>';
        for (var row2 = 1; row2 <= r.rows; row2++) {
          var blk = r.layout && r.layout.blocked[row2 + '_' + seat];
          if (blk) { t += '<td class="seat-cell blocked ' + blk + '" title="' + (blk === 'aisle' ? 'Aisle' : 'Unusable seat') + '"></td>'; continue; }
          var st2 = grid[row2 + '_' + seat];
          var cls = 'seat-cell';
          if (st2 && selectedSeat && selectedSeat.studentId === st2.id) cls += ' selected';
          if (st2 && conflictIds[st2.id]) cls += ' conflict';
          t += '<td class="' + cls + '" onclick="seatClick(\'' + r.id + '\',' + row2 + ',' + seat + ')"' +
            (st2 ? ' title="' + esc(st2.first + ' ' + st2.last + (st2.klass ? ' - ' + st2.klass : '') + (st2.arrangements ? ' - ' + st2.arrangements : '')) + '"' : '') + '>' +
            (st2 ? '<span class="sc-first">' + esc(st2.first) + '</span><span class="sc-lastn">' + esc(st2.last) + '</span>' : '') + '</td>';
        }
        t += '</tr>';
      }
      html += t + '</tbody></table></div>';
    } else {
      html += '<div class="chip-list">' + (inRoom.slice().sort(byName).map(function (st) {
        return '<span class="chip">' + esc(st.first) + ' <b>' + esc(st.last) + '</b> <span class="muted">&middot; ' + esc(statusLabel(st.status)) + '</span></span>';
      }).join('') || '<span class="muted">Nobody assigned</span>') + '</div>';
    }
  });
  return html;
}

function pickUnseated(id) {
  if (!editor) return;
  selectedSeat = selectedSeat && selectedSeat.studentId === id ? null : { studentId: id };
  render();
}

function seatClick(roomId, row, seat) {
  if (!editor) return;
  var s = session();
  var room = s.rooms.find(function (x) { return x.id === roomId; });
  if (!room || seatBlocked(room, row, seat)) { toast('That seat is blocked — change it in Rooms & Layout', true); return; }
  var here = s.students.find(function (st) { return st.roomId === roomId && st.row === row && st.seat === seat; });
  if (!selectedSeat) {
    if (here) { selectedSeat = { studentId: here.id }; render(); }
    return;
  }
  var moving = s.students.find(function (st) { return st.id === selectedSeat.studentId; });
  if (!moving) { selectedSeat = null; render(); return; }
  if (here && here.id === moving.id) { selectedSeat = null; render(); return; }
  var from = { roomId: moving.roomId, row: moving.row, seat: moving.seat };
  moving.roomId = roomId; moving.row = row; moving.seat = seat;
  if (here) { here.roomId = from.roomId; here.row = from.row; here.seat = from.seat; }
  selectedSeat = null;
  markDirty(); render();
  toast(here ? 'Swapped ' + moving.last + ' and ' + here.last : 'Moved ' + moving.first + ' ' + moving.last + ' to Row ' + rowLabel(room, row) + ', Seat ' + seatLabel(room, seat));
}

function clearSeatsConfirm() {
  if (!editor) return;
  openModal('Clear all seats?', '<p>Removes every seat assignment in this session. Students stay on the list and you can regenerate at any time.</p>',
    [{ label: 'Clear seats', cls: 'btn danger', fn: function () {
      if (!editor) return;
      var s = session();
      s.students.forEach(function (st) { if (isSeatedStatus(st.status)) { st.roomId = null; st.row = null; st.seat = null; } });
      markDirty(); closeModal(); render();
    } }]);
}

var NEAR_TEXT = { side: 'side by side', cross: 'side by side, or front and back', all: 'in any of the 8 surrounding seats' };

function keepApartModal() {
  if (!editor) return;
  var s = session();
  var opts = s.students.filter(function (st) { return isSeatedStatus(st.status); }).sort(byName)
    .map(function (st) { return '<option value="' + st.id + '">' + esc(st.last) + ', ' + esc(st.first) + '</option>'; }).join('');
  var pairs = s.settings.keepApart.map(function (p, i) {
    var a = s.students.find(function (x) { return x.id === p[0]; });
    var b = s.students.find(function (x) { return x.id === p[1]; });
    if (!a || !b) return '';
    return '<div class="ka-row"><span class="chip">' + esc(a.last) + ', ' + esc(a.first) + '</span> &harr; ' +
      '<span class="chip">' + esc(b.last) + ', ' + esc(b.first) + '</span>' +
      (p[2] ? '<span class="muted ka-reason">' + esc(p[2]) + '</span>' : '') +
      '<button class="btn small danger" onclick="removeKA(' + i + ')">&#10005;</button></div>';
  }).join('');
  openModal('Keep-apart pairs',
    '<p class="muted" style="margin-bottom:12px">These pairs are never seated ' + NEAR_TEXT[s.settings.near || 'cross'] + ' (change this under <b>Seating rules</b>). Applied when you generate seating; any conflict shows red on the plan.</p>' +
    (pairs || '<p class="muted">No pairs yet.</p>') +
    '<div class="ka-row" style="margin-top:14px"><select id="ka_a" style="flex:1">' + opts + '</select>' +
    '<select id="ka_b" style="flex:1">' + opts + '</select>' +
    '<button class="btn small" onclick="addKA()">Add pair</button></div>' +
    '<div class="form-row" style="margin-top:8px"><input type="text" id="ka_reason" placeholder="Reason (optional, editors only see this)" style="width:100%"></div>', [], true);
}

function addKA() {
  if (!editor) return;
  var s = session();
  var a = document.getElementById('ka_a').value, b = document.getElementById('ka_b').value;
  var reason = (document.getElementById('ka_reason') || { value: '' }).value.trim();
  if (!a || !b || a === b) { toast('Pick two different students', true); return; }
  var dupe = s.settings.keepApart.some(function (p) { return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a); });
  if (dupe) { toast('That pair already exists', true); return; }
  s.settings.keepApart.push(reason ? [a, b, reason] : [a, b]);
  markDirty(); keepApartModal();
}

function removeKA(i) {
  if (!editor) return;
  session().settings.keepApart.splice(i, 1);
  markDirty(); keepApartModal();
}
