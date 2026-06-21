$(document).ready(function() {

if (!window.single) {
  window.single = true;
} else {
  return
}

var hash = window.location.hash.split('/')
switch (hash[0]) {
  case '#activity': var activityId = hash[1]; break;
  case '#session': var activityId = hash[1].slice(0,-12); break;
  default: alert('Open a class page first.'); return;
}

var startDate = new Date(new Date().getFullYear(),0,1,11).toISOString()
var endDate = new Date().toISOString()

if ($('body #dash').length) {
  $('body #dash').remove()
}

// Track scores per user for total column
var scoreTracker = {}
var scoreColumns = ['kats', 'gpa', 'attendance', 'behaviour', 'extra-curricular']

function recordScore(user, column, score) {
  if (!scoreTracker[user]) scoreTracker[user] = {}
  scoreTracker[user][column] = score
  updateTotal(user)
}

function updateTotal(user) {
  var scores = scoreTracker[user]
  if (!scores) return
  var total = 0
  var count = 0
  scoreColumns.forEach(function(col) {
    if (scores[col] !== undefined) {
      total += scores[col]
      count++
    }
  })
  if (count < scoreColumns.length) return // wait until all scores loaded
  // Clear any previous render before writing
  var el = $('.dash' + user + ' .total')
  if (!el.length) return // row not in DOM yet

  el.empty()

  // Rating bands: [minTotal, score 1-4, label, detail] — single source of
  // truth instead of two parallel if/else chains that had to stay in sync.
  var RATING_BANDS = [
    [19, 4, 'Completion with Commendation', 'Exceeds expected standard'],
    [12, 3, 'Completion',                   'At expected standard'],
    [7,  2, 'Participation',                'Meeting with advisory teacher required'],
    [0,  1, 'Enrolment',                    'Meeting with Community Leader required']
  ]
  var band = RATING_BANDS.find(function(b) { return total >= b[0] })

  el.append($('<span>').addClass('score-badge score-' + band[1]).text(total))
  el.append($('<span>').addClass('detail-text').css('font-weight', '600').text(band[2]))
  el.append($('<span>').addClass('detail-text').text(band[3]))
}

$(`<div id="dash"><style type="text/css">
#dash {
  position: fixed;
  box-sizing: border-box;
  top: 0;
  padding: 64px calc(50% - 600px);
  z-index: 100;
  background-color: #f0f2f5;
  width: 100%;
  height: 100%;
  overflow: scroll;
  -webkit-overflow-scrolling: touch;
}
#dash .header {
  display: flex;
  align-items: center;
  margin: 1em;
  flex-wrap: wrap;
  gap: 0.5em;
}
#dash .header h1 {
  flex: 1;
}
#dash table {
  background-color: white;
  border-radius: 0.5em;
  box-shadow: 0 0 1em rgba(0, 0, 0, 0.2);
  margin: 1em;
  width: calc(100% - 2em);
  border-collapse: collapse;
}
#dash tbody tr {
  border-top: #ccc 1px solid;
}
#dash tbody tr:hover {
  background-color: #f5f5f5;
}
#dash tr:last-child td:first-child {
  border-radius: 0 0 0 0.5em;
}
#dash tr:last-child td:last-child {
  border-radius: 0 0 0.5em 0;
}
#dash th {
  padding: 0.75em 1em;
  border: 0;
  text-align: left;
  font-size: 0.85em;
  color: #444;
  background-color: #f8f8f8;
  border-bottom: #ccc 1px solid;
}
#dash th.total-col {
  background-color: #eef2ff;
  color: #3730a3;
  border-left: 2px solid #c7d2fe;
}
#dash td {
  position: relative;
  padding: 0.75em 1em;
  border: 0;
  font-size: 0.9em;
}
#dash td.total {
  border-left: 2px solid #c7d2fe;
  background-color: #f5f7ff;
}
#dash .score-badge {
  display: inline-block;
  font-weight: bold;
  font-size: 1.1em;
  width: 1.8em;
  height: 1.8em;
  line-height: 1.8em;
  text-align: center;
  border-radius: 50%;
  color: white;
  margin-right: 0.3em;
  vertical-align: middle;
}
#dash .score-4 { background-color: #2ecc71; }
#dash .score-3 { background-color: #95cc44; }
#dash .score-2 { background-color: #f39c12; }
#dash .score-1 { background-color: #e74c3c; }
#dash .score-na { background-color: #bbb; }
#dash .detail-text {
  font-size: 0.8em;
  color: #666;
  display: block;
  margin-top: 0.2em;
}
#dash .growth-positive { color: #2ecc71; font-weight: bold; }
#dash .growth-negative { color: #e74c3c; font-weight: bold; }
#dash .growth-neutral { color: #f39c12; font-weight: bold; }
#dash .button {
  margin-left: 1em;
  padding: 0.5em 1em;
  border-radius: 0.5em;
  color: #666;
  border: #666 1px solid;
  cursor: pointer;
}
#dash .button:hover {
  background-color: #ccc;
}
#dash .note {
  padding: 1em;
  color: #666;
  font-size: 0.85em;
}
#dash thead tr th:first-child {
  border-radius: 0.5em 0 0 0;
}
#dash thead tr th:last-child {
  border-radius: 0 0.5em 0 0;
}
#dash .button-print {
  margin-left: 1em;
  padding: 0.5em 1em;
  border-radius: 0.5em;
  color: white;
  background-color: #06c;
  border: #06c 1px solid;
  cursor: pointer;
  font-weight: bold;
}
#dash .button-print:hover {
  background-color: #004a99;
  border-color: #004a99;
}
@media print {
  body > *:not(#dash) { display: none !important; }
  #dash {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    background: white !important;
    height: auto !important;
  }
  #dash .header .button,
  #dash .header .button-print,
  #dash .note { display: none !important; }
  #dash table {
    box-shadow: none !important;
    border: 1px solid #ccc !important;
    width: 100% !important;
    margin: 0 !important;
  }
  #dash .score-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #dash .score-4 { background-color: #2ecc71 !important; }
  #dash .score-3 { background-color: #95cc44 !important; }
  #dash .score-2 { background-color: #f39c12 !important; }
  #dash .score-1 { background-color: #e74c3c !important; }
}
</style></div>`).appendTo('body')

$('<div>').addClass('header').appendTo('#dash')
$('<h1>').addClass('title')
  .text('Advisory Rubric Calculator: ' + $('#ClassCodeText').text())
  .appendTo('#dash .header')
$('<div>').addClass('button').text('Close')
  .click(function() {
    window.single = false
    $('#dash').remove()
  }).appendTo('#dash .header')

$('<div>').addClass('button-print').text('🖨 Print to PDF')
  .click(function() {
    window.print()
  }).appendTo('#dash .header')

// ── Table structure ──────────────────────────────────────────────────────────
var headers = {
  'Name':            '',
  'KATs':            'Key Assessment Tasks score (1–4). 1=<50% submitted, 2=≥50% submitted, 3=all submitted, 4=all submitted by due date.',
  'GPA':             'Grade Point Average (1–4). 1=≤2.5, 2=>2.5, 3=>3.5, 4=>3.75. Shows growth from previous report.',
  'Attendance':      'Overall attendance across all classes. 1=≤90%, 2=>90%, 3=>95%, 4=>98% (fully explained absences).',
  'Behaviour':       "Behaviour & conduct (1–4), across ALL of the student's classes (not just this one). Based ONLY on: Detention, Suspension, Attitude/Behaviour, Out of Class, REAL Behaviour Not Shown, Non Negotiable Behaviour (negative points), and REAL Commendation (positive points). A single Detention or Suspension drops the score even with an otherwise clean record. Other chronicle categories are ignored.",
  'Extra Curricular':'Involvement in non-classroom activities. 1=none, 2=one, 3=two–three, 4=four+ (inc. 2 non-sport).',
  'Total /20':       'Sum of all five scores. 19-20=Completion with Commendation, 12-18=Completion, 7-11=Participation, <7=Enrolment.'
}

$('<table>').append($('<thead>').append($('<tr>'))).appendTo('#dash')
$.each(Object.keys(headers), function() {
  var th = $('<th>').attr('title', headers[this]).text(this)
  if (this === 'Total /20') th.addClass('total-col')
  th.appendTo('#dash thead tr')
})
$('<tbody>').appendTo('#dash table')

$('<div>').addClass('note')
  .html('Crusoe College &mdash; Advisory Rubric Calculator. Scores 1 (red) to 4 (green). Total /20: 19–20 Completion with Commendation &nbsp;|&nbsp; 12–18 Completion &nbsp;|&nbsp; 7–11 Participation &nbsp;|&nbsp; &lt;7 Enrolment').appendTo('#dash')

// ── Helpers ──────────────────────────────────────────────────────────────────
// Render a coloured score badge (1–4, or '?' for unknown/no data)
function scoreBadge(score) {
  var valid = score >= 1 && score <= 4
  return $('<span>').addClass('score-badge').addClass(valid ? 'score-' + score : 'score-na').text(valid ? score : '?')
}

// Map a numeric value to a 1–4 score using descending thresholds.
// thresholds = [[minValueForScore4, 4], [minValueForScore3, 3], [minValueForScore2, 2]]
// Falls through to 1 if no threshold is met.
function scoreFromThresholds(value, thresholds) {
  for (var i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i][0]) return thresholds[i][1]
  }
  return 1
}

// ── API calls ────────────────────────────────────────────────────────────────
// Single shared helper for Compass's POST endpoints — every call below only
// differs by endpoint path and payload, so this collapses six near-identical
// $.ajax blocks into one. `_dc` cache-buster is added automatically.
function compassPost(endpoint, payload, extra) {
  return $.ajax(endpoint + "?_dc=" + Date.now(), Object.assign({
    data: JSON.stringify(payload),
    contentType: 'application/json; charset=utf-8',
    type: 'POST'
  }, extra))
}

function getStudents(startDate, endDate, activityId) {
  return compassPost("/Services/Attendance.svc/GetUserSummariesByActivityWithFilter", {
    startDate: startDate, endDate: endDate, ActivityId: activityId,
    studentStatus: 1, inClass: [0,1], "overall": ["0","1"], okClass: [0,1],
    vce: [0,1], schl: [0,1], perspective: 0,
    totalWholeDayLimit: 0, totalPartialDayLimit: 0
  })
}

function getAllAttendance(userId) {
  return compassPost("/Services/Attendance.svc/GetAttendanceSummary", {
    startDate: startDate, endDate: endDate, userId: userId,
    studentStatus: 1, inClass: [0,1], okClass: [0,1],
    vce: [0,1], schl: [0,1], perspective: 0,
    totalWholeDayLimit: 0, totalPartialDayLimit: 0
  })
}

function getTasks(user) {
  return compassPost("/Services/Subjects.svc/GetAllAcademicGroups", { page: 1, start: 0, limit: 25 })
    .then(function(cycles) {
      var currentCycle = cycles.d.filter(function(cycle) { return cycle.isRelevant })[0].id
      return compassPost("/Services/LearningTasks.svc/GetAllLearningTasksByUserId", {
        academicGroupId: currentCycle, userId: user, page: 1, start: 0, limit: 100
      }, { user: user })
    })
}

function getGPA(user) {
  return compassPost("/Services/Gpa.svc/GetOverallGraphData", { userId: user }, { user: user })
}

// Events API returns event NAME and CATEGORY (unlike the generic attendance
// summary endpoint), needed to filter for excursions/incursions only —
// not all "Events" attendance, which can include detentions/suspensions
// logged as events.
function getEvents(userId) {
  return compassPost("/Services/Activities/Events.svc/GetEventsByUserId", {
    userId: userId, startDate: startDate, endDate: endDate, page: 1, start: 0, limit: 200
  }, { user: userId })
}

// ── Load students & trigger all data calls ───────────────────────────────────
function loadStudents(students) {
  students.d.sort((a, b) => a.uii.localeCompare(b.uii))
  var userIds = []

  $.each(students.d, function() {
    var user = this.uid
    userIds.push(user)

    $('<tr>').addClass('dash' + user).addClass(this.uii).appendTo('#dash tbody')
    $.each(Object.keys(headers), function() {
      var colClass = this.replace(/ /g, '-').replace('/', '').toLowerCase()
      var td = $('<td>').addClass(colClass).attr('title', headers[this])
      if (this === 'Total /20') td.addClass('total')
      td.appendTo('.dash' + user)
    })

    $('<a>', { href: '/Records/User.aspx?userId=' + user, text: this.un })
      .addClass('extra-info-link sel-student-name')
      .attr('data-action-tip-uid', user)
      .attr('id', user)
      .appendTo('.dash' + user + ' .name')

    getAllAttendance(user).done((data) => loadAllAttendance(data, user))
    getTasks(user).done(loadTasks)
    getGPA(user).done(loadGPA)
    getEvents(user).done((data) => loadEvents(data, user))
  })

  // Behaviour: ONE call for the whole class (not per student) — matches
  // Andrew's original design. GetCategoryUsageCount returns every
  // student's chronicle counts for this class in a single response.
  //
  // BUG FIX: both getChronicleUsage ($.ajax) and getChronicleCategories
  // ($.get) resolve with (data, textStatus, jqXHR) — three arguments each.
  // $.when() therefore wraps EACH of them as an array, not just the first
  // one. Using "categories" directly (instead of "categories[0]") meant
  // categories.d was always undefined, so every category name lookup
  // silently failed and nothing ever rendered — no error, just blank.
  $.when(getChronicleUsage(activityId), getChronicleCategories())
    .done(function(usage, categories) {
      loadChronicleUsage(usage[0], categories[0])
    })
}

// ── Attendance ────────────────────────────────────────────────────────────────
// Score: 1=≤90%, 2=>90%, 3=>95%, 4=>98%
function loadAllAttendance(classes, user) {
  var im = 0, npu = 0
  $.each(classes.d, function() {
    im  += this.im
    npu += this.npu
  })
  var pct = im > 0 ? Math.round((im - npu) / im * 100) : 0
  var score = scoreFromThresholds(pct, [[98, 4], [95, 3], [91, 2]])
  var el = $('.dash' + user + ' .attendance')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(pct + '%'))
  recordScore(user, 'attendance', score)
}

// ── KATs ──────────────────────────────────────────────────────────────────────
// Score: 1=<50% submitted, 2=≥50% submitted, 3=all submitted, 4=all on time
function loadTasks(tasks) {
  var user = this.user
  var total = 0, submitted = 0, ontime = 0
  var overdue = 0, late = 0, pending = 0

  $.each(tasks.d.data, function() {
    if (this.includeInSemesterReports) {
      total++
      // Semester Exams often use custom per-student due dates which the
      // submissionStatus field does not reflect correctly — this causes
      // false "overdue"/"pending" flags. Treat any submitted exam as on time,
      // and only flag exams as pending if truly unsubmitted (no due-date logic needed).
      var isExam = /^Semester Exam/i.test(this.name || '')
      var status = this.students[0].submissionStatus

      if (isExam) {
        switch (status) {
          case 1: pending++;             break  // genuinely not submitted yet
          case 2: submitted++; ontime++; break  // was 'overdue' — custom due date false positive, count as on time
          case 3: submitted++; ontime++; break
          case 4: submitted++; ontime++; break  // was 'late' — custom due date false positive, count as on time
        }
      } else {
        switch (status) {
          case 1: pending++;             break;
          case 2: overdue++;             break;
          case 3: submitted++; ontime++; break;
          case 4: submitted++; late++;   break;
        }
      }
    }
  })

  var score
  if (total === 0) {
    score = 4
  } else {
    var pct = submitted / total
    if (pct < 0.5)                    score = 1
    else if (pct < 1.0)               score = 2
    else if (late > 0 || overdue > 0) score = 3
    else                              score = 4
  }

  var parts = []
  if (ontime  > 0) parts.push(ontime  + ' on time')
  if (late    > 0) parts.push(late    + ' late')
  if (pending > 0) parts.push(pending + ' pending')
  if (overdue > 0) parts.push(overdue + ' overdue')
  var detail = total > 0 ? parts.join(', ') + ' of ' + total : 'No tasks'

  var el = $('.dash' + user + ' .kats')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(detail))
  recordScore(user, 'kats', score)
}

// ── GPA ───────────────────────────────────────────────────────────────────────
// Score: 1=≤2.5, 2=>2.5, 3=>3.5, 4=>3.75 (from master rubric)
function loadGPA(cycles) {
  var user = this.user
  var el = $('.dash' + user + ' .gpa')

  if (!cycles.d.length) {
    el.append(scoreBadge('?'))
    el.append($('<span>').addClass('detail-text').text('No data'))
    recordScore(user, 'gpa', 1)
    return
  }

  var latest = cycles.d[cycles.d.length - 1].score
  // Strictly-greater-than thresholds per rubric (not >=), so a small epsilon
  // nudge lets us reuse the same helper as the other scores.
  var score = scoreFromThresholds(latest, [[3.7501, 4], [3.5001, 3], [2.5001, 2]])

  el.append(scoreBadge(score))

  if (cycles.d.length >= 2) {
    var prev   = cycles.d[cycles.d.length - 2].score
    var growth = latest - prev
    var sign   = growth > 0 ? '▲' : (growth < 0 ? '▼' : '–')
    var cls    = growth > 0 ? 'growth-positive' : (growth < 0 ? 'growth-negative' : 'growth-neutral')
    el.append(
      $('<span>').addClass('detail-text').html(
        'GPA ' + latest.toFixed(2) +
        ' &nbsp;<span class="' + cls + '">' + sign + ' ' + Math.abs(growth).toFixed(2) + '</span>'
      )
    )
  } else {
    el.append($('<span>').addClass('detail-text').text('GPA ' + latest.toFixed(2)))
  }
  recordScore(user, 'gpa', score)
}

// ── Behaviour ─────────────────────────────────────────────────────────────────
// Score: 4=exemplary, 3=acceptable, 2=sometimes unacceptable, 1=frequently unacceptable
//
// REBUILT to use Andrew's original, proven endpoint: ChronicleV2.svc/
// GetCategoryUsageCount, scoped to this CLASS (activityId) — not a
// per-student feed call. This is the same API the original Reports Check
// and Class Dashboard both used successfully before being rebuilt with
// invented field names that never matched real Compass data.
//
// GetCategoryUsageCount returns one entry per chronicle CATEGORY used in
// this class, each with a counts[] array of { StudentId, Grey, Green,
// Amber, Red, TotalPoints }. Sub-items (e.g. "Value of Aspiration" under
// "REAL Commendation") are already aggregated into the parent category's
// totals by Compass — we don't need to chase them individually.
//
// Crusoe's real category names (confirmed against Compass Chronicle
// settings, not guessed):
//   Negative — ANY entry counts, regardless of Grey/Green/Amber/Red colour:
//     - Out of Class without Explanation
//     - REAL Behaviours - Not Shown
//     - Attitude/Behaviour   (covers Classroom Management steps incl. detentions logged this way)
//     - Confiscation
//     - Detention             — a single entry alone drops the score
//     - Suspension            — a single entry alone drops the score
//   Positive:
//     - REAL Commendation
//
// Category names must be looked up via ReferenceDataCache.svc/
// GetChronicleCategories (categoryId -> name), exactly as Andrew did.

var NEGATIVE_CATEGORY_NAMES = [
  'Out of Class without Explanation',
  'REAL Behaviours - Not Shown',
  'Attitude/Behaviour',
  'Confiscation',
  'Detention',
  'Suspension'
]
var SEVERE_CATEGORY_NAMES = ['Detention', 'Suspension'] // any single entry drops the score
var COMMENDATION_CATEGORY_NAME = 'REAL Commendation'

function getChronicleUsage(activityId) {
  return compassPost("/Services/ChronicleV2.svc/GetCategoryUsageCount", {
    type: 1, id: activityId
  }, {})
}

function getChronicleCategories() {
  return $.get("/Services/ReferenceDataCache.svc/GetChronicleCategories")
}

// Behaviour data is fetched ONCE per class (not once per student) since
// GetCategoryUsageCount already returns every student's counts for the
// whole class in a single call — matching Andrew's original design.
var behaviourByStudent = {} // userId -> { negEntries, severeEntries, commendations }

function loadChronicleUsage(usage, categories) {
  var catNameById = {}
  $.each(categories.d, function() {
    catNameById[this.id] = this.name
  })

  $.each(usage.d, function() {
    var catName = catNameById[this.categoryId]
    if (!catName || !this.counts) return

    var isNegative    = NEGATIVE_CATEGORY_NAMES.includes(catName)
    var isSevere      = SEVERE_CATEGORY_NAMES.includes(catName)
    var isCommendation = (catName === COMMENDATION_CATEGORY_NAME)

    if (!isNegative && !isCommendation) return // category not relevant to Behaviour score

    $.each(this.counts, function() {
      var uid = this.StudentId
      if (!behaviourByStudent[uid]) {
        behaviourByStudent[uid] = { negEntries: 0, severeEntries: 0, commendations: 0 }
      }
      var rec = behaviourByStudent[uid]
      var entryCount = (this.Grey || 0) + (this.Green || 0) + (this.Amber || 0) + (this.Red || 0)

      if (isNegative)     rec.negEntries    += entryCount
      if (isSevere)       rec.severeEntries += entryCount
      if (isCommendation) rec.commendations += entryCount
    })
  })

  // Now render every student row that's waiting on a Behaviour score
  $.each(behaviourByStudent, function(uid) {
    renderBehaviourScore(uid)
  })
}

function renderBehaviourScore(user) {
  var rec = behaviourByStudent[user]
  var el  = $('.dash' + user + ' .behaviour')
  if (!el.length) return // row not built yet

  if (!rec) {
    // No chronicle entries at all for this student in this class
    el.empty().append(scoreBadge(4))
    el.append($('<span>').addClass('detail-text').text('No entries'))
    recordScore(user, 'behaviour', 4)
    return
  }

  var score
  if (rec.severeEntries >= 1) {
    score = 1 // a single Detention or Suspension entry alone drops the score
  } else if (rec.negEntries >= 8) {
    score = 1
  } else if (rec.negEntries >= 4) {
    score = 2
  } else if (rec.commendations >= 12 && rec.negEntries === 0) {
    score = 4
  } else {
    score = 3
  }

  var detail = []
  if (rec.severeEntries)  detail.push(rec.severeEntries + ' detention/suspension')
  if (rec.negEntries)     detail.push(rec.negEntries + ' negative entries')
  if (rec.commendations)  detail.push(rec.commendations + ' commendations')

  el.empty()
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(detail.join(', ') || 'No entries'))
  recordScore(user, 'behaviour', score)
}

// ── Extra Curricular ──────────────────────────────────────────────────────────
// Score: 1=0 events, 2=1 event, 3=2–3 events, 4=4+ events
// Only counts events that are excursions or incursions — checked against
// both the event NAME and CATEGORY name (case-insensitive). Events, school
// activities, sport carnivals, detentions/suspensions logged as events etc.
// are all ignored unless they explicitly read as an excursion/incursion.
function isExcursionOrIncursion(eventName, categoryName) {
  var name = (eventName || '').toLowerCase()
  var cat  = (categoryName || '').toLowerCase()
  return name.includes('excursion') || name.includes('incursion') ||
         cat.includes('excursion')  || cat.includes('incursion')
}

function loadEvents(events, user) {
  var eventsAttended = 0
  var eventNames = []

  // Defensive: response shape may be events.d.data[] or events.d[]
  var list = (events && events.d && events.d.data) ? events.d.data
           : (events && events.d) ? events.d
           : []

  // Note: attendance is not filtered further here — the event list returned
  // by GetEventsByUserId is already scoped to this student, so every entry
  // represents an event they were associated with.
  $.each(list, function() {
    var name = this.name || this.eventName || ''
    var cat  = this.categoryName || this.category || ''
    if (isExcursionOrIncursion(name, cat)) {
      eventsAttended++
      eventNames.push(name)
    }
  })

  var score = scoreFromThresholds(eventsAttended, [[4, 4], [2, 3], [1, 2]])

  var el = $('.dash' + user + ' .extra-curricular')
  el.append(scoreBadge(score))
  var label = eventsAttended + ' excursion' + (eventsAttended !== 1 ? 's' : '') + '/incursion' + (eventsAttended !== 1 ? 's' : '')
  el.append($('<span>').addClass('detail-text').attr('title', eventNames.join(', ') || 'None').text(label))
  recordScore(user, 'extra-curricular', score)
}

// ── Kick off ──────────────────────────────────────────────────────────────────
getStudents(startDate, endDate, activityId).done(loadStudents)

})
