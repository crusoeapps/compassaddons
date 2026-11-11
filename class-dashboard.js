// Advisory Rubric Calculator — class-dashboard.js
// Crusoe College | crusoeapps.github.io/compassaddons
// Updated: 11 November 2026
// Changes: Total /20 now fills in (it never got its 'total' class); a failed
//          Compass lookup now says so in its cell instead of staying blank;
//          KATs no longer counts pending tasks, and Total flags them
// Previously (9 Nov 2026): KATs excludes Semester Exams for Year 10 students only
// Previously (5 Aug 2026): Chronicle endpoint fixed (GetUserChronicleFeedThin), Extra Curricular
//          cell shows total events / excursion score basis / detention-suspension warning line

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
  if (count < scoreColumns.length) return
  var el = $('.dash' + user + ' .total')
  if (!el.length) return
  el.empty()
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
  var pending = scores.pendingTasks || 0
  if (pending > 0) {
    el.append($('<span>').addClass('detail-text-warning')
      .text('\u26A0 ' + pending + ' task' + (pending !== 1 ? 's' : '') + ' pending: score may change'))
  }
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
#dash .header h1 { flex: 1; }
#dash table {
  background-color: white;
  border-radius: 0.5em;
  box-shadow: 0 0 1em rgba(0,0,0,0.2);
  margin: 1em;
  width: calc(100% - 2em);
  border-collapse: collapse;
}
#dash tbody tr { border-top: #ccc 1px solid; }
#dash tbody tr:hover { background-color: #f5f5f5; }
#dash tr:last-child td:first-child { border-radius: 0 0 0 0.5em; }
#dash tr:last-child td:last-child  { border-radius: 0 0 0.5em 0; }
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
#dash .score-4  { background-color: #2ecc71; }
#dash .score-3  { background-color: #95cc44; }
#dash .score-2  { background-color: #f39c12; }
#dash .score-1  { background-color: #e74c3c; }
#dash .score-na { background-color: #bbb; }
#dash .detail-text {
  font-size: 0.8em;
  color: #666;
  display: block;
  margin-top: 0.2em;
}
#dash .detail-text-warning {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #b45309;
  margin-top: 2px;
}
#dash .detail-text-danger {
  font-size: 0.8em;
  color: #c0392b;
  display: block;
  margin-top: 0.2em;
}
#dash .growth-positive { color: #2ecc71; font-weight: bold; }
#dash .growth-negative { color: #e74c3c; font-weight: bold; }
#dash .growth-neutral  { color: #f39c12; font-weight: bold; }
#dash .button {
  margin-left: 1em;
  padding: 0.5em 1em;
  border-radius: 0.5em;
  color: #666;
  border: #666 1px solid;
  cursor: pointer;
}
#dash .button:hover { background-color: #ccc; }
#dash .note {
  padding: 1em;
  color: #666;
  font-size: 0.85em;
}
#dash thead tr th:first-child { border-radius: 0.5em 0 0 0; }
#dash thead tr th:last-child  { border-radius: 0 0.5em 0 0; }
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
#dash .button-print:hover { background-color: #004a99; border-color: #004a99; }
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
  .click(function() { window.single = false; $('#dash').remove() })
  .appendTo('#dash .header')
$('<div>').addClass('button-print').text('🖨 Print to PDF')
  .click(function() { window.print() })
  .appendTo('#dash .header')

var headers = {
  'Name':            '',
  'KATs':            'Key Assessment Tasks score (1–4). 1=<50% submitted, 2=≥50% submitted, 3=all submitted, 4=all submitted by due date. Pending tasks (not submitted, not yet overdue) are not counted. Semester Exams are excluded for Year 10 students.',
  'GPA':             'Grade Point Average (1–4). 1=≤2.5, 2=>2.5, 3=>3.5, 4=>3.75. Shows growth from previous report.',
  'Attendance':      'Overall attendance across all classes. 1=≤90%, 2=>90%, 3=>95%, 4=>98%.',
  'Behaviour':       "Behaviour & conduct (1–4) across ALL classes. Based on: Detention, Suspension, Attitude/Behaviour, Out of Class, REAL Behaviour Not Shown, Non Negotiable Behaviour, and REAL Commendation.",
  'Extra Curricular':'Score from excursions/incursions only (1=none, 2=one, 3=two–three, 4=four+). Total events shown; detention/suspension-linked events flagged separately.',
  'Total /20':       'Sum of all five scores. 19–20=Completion with Commendation, 12–18=Completion, 7–11=Participation, <7=Enrolment. Flagged when a student has pending tasks, as the score may change.'
}

$('<table>').append($('<thead>').append($('<tr>'))).appendTo('#dash')
// Use the name argument, not `this`: inside $.each `this` is a String object,
// so `this === 'Total /20'` was never true and Total never got its class.
$.each(Object.keys(headers), function(i, name) {
  var th = $('<th>').attr('title', headers[name]).text(name)
  if (name === 'Total /20') th.addClass('total-col')
  th.appendTo('#dash thead tr')
})
$('<tbody>').appendTo('#dash table')

$('<div>').addClass('note')
  .html('Crusoe College &mdash; Advisory Rubric Calculator. Scores 1–4. Total /20: 19–20 Completion with Commendation &nbsp;|&nbsp; 12–18 Completion &nbsp;|&nbsp; 7–11 Participation &nbsp;|&nbsp; &lt;7 Enrolment')
  .appendTo('#dash')

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreBadge(score) {
  var valid = score >= 1 && score <= 4
  return $('<span>').addClass('score-badge').addClass(valid ? 'score-' + score : 'score-na').text(valid ? score : '?')
}

function scoreFromThresholds(value, thresholds) {
  for (var i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i][0]) return thresholds[i][1]
  }
  return 1
}

// ── API ───────────────────────────────────────────────────────────────────────
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

// Year level for the KATs Year 10 exam exclusion. Always resolves (to '' on
// failure or if no year-level field is present), so a lookup problem never
// blocks the KATs score. It just falls back to the old behaviour (exams counted).
function getYearLevel(user) {
  var d = $.Deferred()
  compassPost("/Services/User.svc/GetUserDetailsBlobByUserId", {
    targetUserId: user, targetSchoolId: Compass.schoolId, page: 1, start: 0, limit: 25
  }).done(function(r) {
    var b = (r && r.d) || {}
    d.resolve(b.userYearLevel || b.yearLevel || b.yearLevelName || b.userYearLevelShortName || '')
  }).fail(function() { d.resolve('') })
  return d.promise()
}

function isYear10(yearLevel) {
  return /^(Year|Yr)?\s*10\b/i.test(String(yearLevel || '').trim())
}

function getGPA(user) {
  return compassPost("/Services/Gpa.svc/GetOverallGraphData", { userId: user }, { user: user })
}

// Updated 5 Aug 2026: corrected from GetUserChronicleFeed (was 404)
function getStudentChronicle(userId) {
  return compassPost("/Services/ChronicleV2.svc/GetUserChronicleFeedThin", {
    targetUserId: userId, startDate: startDate, endDate: endDate,
    start: 0, pageSize: 200, asParent: false, page: 1, limit: 200
  }, { user: userId })
}

function getEvents(userId) {
  return compassPost("/Services/Activities/Events.svc/GetEventsByUserId", {
    userId: userId, startDate: startDate, endDate: endDate, page: 1, start: 0, limit: 200
  }, { user: userId })
}

// ── Load errors ───────────────────────────────────────────────────────────────
// A failed Compass request used to leave its cell blank with no message, and
// the Total stayed blank too (it needs all five scores). Now the cell says
// what failed, and the Total says why it's missing.
function showLoadError(user, column, label, xhr, e) {
  var status = xhr ? (xhr.status ? 'HTTP ' + xhr.status : 'no response') : 'unexpected data'
  if (window.console) console.error('[Rubric Calculator] ' + label + ' failed for user ' + user + ' (' + status + ')', xhr || e)
  var el = $('.dash' + user + ' .' + column)
  el.empty()
  el.append(scoreBadge('?'))
  el.append($('<span>').addClass('detail-text-danger').text('Could not load ' + label + ' (' + status + ')'))
  var total = $('.dash' + user + ' .total')
  if (!total.children().length) total.empty().append($('<span>').addClass('detail-text-danger').text('Incomplete'))
}

function loadInto(request, user, column, label, handle) {
  request
    .done(function(data) {
      try { handle(data) } catch (e) { showLoadError(user, column, label, null, e) }
    })
    .fail(function(xhr) { showLoadError(user, column, label, xhr) })
}

// ── Load students ─────────────────────────────────────────────────────────────
function loadStudents(students) {
  students.d.sort((a, b) => a.uii.localeCompare(b.uii))

  $.each(students.d, function() {
    var user = this.uid

    $('<tr>').addClass('dash' + user).addClass(this.uii).appendTo('#dash tbody')
    $.each(Object.keys(headers), function(i, name) {
      var colClass = name.replace(/ /g, '-').replace('/', '').toLowerCase()
      var td = $('<td>').addClass(colClass).attr('title', headers[name])
      if (name === 'Total /20') td.addClass('total')
      td.appendTo('.dash' + user)
    })

    $('<a>', { href: '/Records/User.aspx?userId=' + user, text: this.un })
      .addClass('extra-info-link sel-student-name')
      .attr('data-action-tip-uid', user)
      .attr('id', user)
      .appendTo('.dash' + user + ' .name')

    loadInto(getAllAttendance(user), user, 'attendance', 'attendance', function(data) { loadAllAttendance(data, user) })
    var yearLevelPromise = getYearLevel(user)
    loadInto(getTasks(user), user, 'kats', 'learning tasks', function(tasks) {
      yearLevelPromise.always(function(yearLevel) {
        try { loadTasks(tasks, user, yearLevel) } catch (e) { showLoadError(user, 'kats', 'learning tasks', null, e) }
      })
    })
    loadInto(getGPA(user), user, 'gpa', 'GPA', function(data) { loadGPA.call({ user: user }, data) })
    loadInto(getEvents(user), user, 'extra-curricular', 'events', function(data) { loadEvents(data, user) })
    loadInto(getStudentChronicle(user), user, 'behaviour', 'Chronicle', function(data) { loadChronicleForStudent(data, user) })
  })
}

// ── Attendance ────────────────────────────────────────────────────────────────
function loadAllAttendance(classes, user) {
  var im = 0, npu = 0
  $.each(classes.d, function() { im += this.im; npu += this.npu })
  var pct = im > 0 ? Math.round((im - npu) / im * 100) : 0
  var score = scoreFromThresholds(pct, [[98, 4], [95, 3], [91, 2]])
  var el = $('.dash' + user + ' .attendance')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(pct + '%'))
  recordScore(user, 'attendance', score)
}

// ── KATs ──────────────────────────────────────────────────────────────────────
function loadTasks(tasks, user, yearLevel) {
  var total = 0, submitted = 0, ontime = 0, overdue = 0, late = 0, pending = 0
  // Year 10 only: Semester Exams don't count towards work completed
  var excludeExams = isYear10(yearLevel)
  var examsExcluded = 0

  $.each(tasks.d.data, function() {
    if (this.includeInSemesterReports) {
      var isExam = /^Semester Exam/i.test(this.name || '')
      if (isExam && excludeExams) { examsExcluded++; return }
      var status = this.students[0].submissionStatus
      // Pending (not submitted, not yet overdue) isn't counted either way;
      // the Total is flagged instead so it's clear the score may change.
      if (status === 1) { pending++; return }
      total++
      if (isExam) {
        switch (status) {
          case 2: submitted++; ontime++; break
          case 3: submitted++; ontime++; break
          case 4: submitted++; ontime++; break
        }
      } else {
        switch (status) {
          case 2: overdue++;             break
          case 3: submitted++; ontime++; break
          case 4: submitted++; late++;   break
        }
      }
    }
  })

  var score
  if (total === 0) { score = 4 }
  else {
    var pct = submitted / total
    if (pct < 0.5)                    score = 1
    else if (pct < 1.0)               score = 2
    else if (late > 0 || overdue > 0) score = 3
    else                              score = 4
  }

  var parts = []
  if (ontime  > 0) parts.push(ontime  + ' on time')
  if (late    > 0) parts.push(late    + ' late')
  if (overdue > 0) parts.push(overdue + ' overdue')
  var detail = total > 0 ? parts.join(', ') + ' of ' + total : (pending > 0 ? 'No tasks due yet' : 'No tasks')
  if (pending > 0) detail += ' (' + pending + ' pending, not counted)'
  if (examsExcluded > 0) {
    detail += ' (' + examsExcluded + ' exam' + (examsExcluded !== 1 ? 's' : '') + ' excluded, Yr 10)'
  }

  var el = $('.dash' + user + ' .kats')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(detail))
  if (!scoreTracker[user]) scoreTracker[user] = {}
  scoreTracker[user].pendingTasks = pending
  recordScore(user, 'kats', score)
}

// ── GPA ───────────────────────────────────────────────────────────────────────
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
var COMMENDATION_CATEGORY = 'REAL Commendation'
var NEGATIVE_CATEGORIES = [
  'Attitude/Behaviour', 'Out of Class', 'REAL Behaviour Not Shown',
  'Non Negotiable Behaviour', 'Detention', 'Suspension'
]

function loadChronicleForStudent(feed, user) {
  var d = { detentions: 0, suspensions: 0, ocwe: 0, negPoints: 0, commendations: 0 }

  $.each(feed.d.data || feed.d || [], function() {
    var catName = this.category || this.categoryName || ''
    var points  = Number(this.points) || 0

    if (catName === 'Detention') {
      d.detentions++
      if (points < 0) d.negPoints += Math.abs(points)
    } else if (catName === 'Suspension') {
      d.suspensions++
      if (points < 0) d.negPoints += Math.abs(points)
    } else if (catName === 'Out of Class') {
      d.ocwe++
      if (points < 0) d.negPoints += Math.abs(points)
    } else if (NEGATIVE_CATEGORIES.includes(catName)) {
      if (points < 0) d.negPoints += Math.abs(points)
    } else if (catName === COMMENDATION_CATEGORY) {
      if (points > 0) d.commendations += points
    }
  })

  var score
  if (d.detentions >= 1 || d.suspensions >= 1) {
    score = (d.detentions >= 2 || d.suspensions >= 2 || d.negPoints >= 15) ? 1 : 2
  } else if (d.negPoints >= 15) { score = 1
  } else if (d.negPoints >= 8)  { score = 2
  } else if (d.commendations >= 12 && d.negPoints <= 2 && d.ocwe === 0) { score = 4
  } else { score = 3 }

  var detail = []
  if (d.detentions)    detail.push(d.detentions + ' detention' + (d.detentions > 1 ? 's' : ''))
  if (d.suspensions)   detail.push(d.suspensions + ' suspension' + (d.suspensions > 1 ? 's' : ''))
  if (d.negPoints)     detail.push(d.negPoints + ' neg pts')
  if (d.commendations) detail.push(d.commendations + ' commendations')
  if (d.ocwe)          detail.push(d.ocwe + ' OCWE')

  var el = $('.dash' + user + ' .behaviour')
  el.empty()
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(detail.join(', ') || 'No entries'))
  recordScore(user, 'behaviour', score)
}

// ── Extra Curricular ──────────────────────────────────────────────────────────
// Score: excursions/incursions only — 1=0, 2=1, 3=2–3, 4=4+
// Cell: line 1 = total events | line 2 = score basis | line 3 = det/sus warning (if any)
function isDetentionOrSuspension(name, cat) {
  var n = (name || '').toLowerCase(), c = (cat || '').toLowerCase()
  return n.includes('detention') || n.includes('suspension') ||
         c.includes('detention') || c.includes('suspension')
}
function isExcursionOrIncursion(name, cat) {
  var n = (name || '').toLowerCase(), c = (cat || '').toLowerCase()
  return n.includes('excursion') || n.includes('incursion') ||
         c.includes('excursion') || c.includes('incursion')
}

function loadEvents(events, user) {
  var totalEvents = 0, excursionCount = 0, detSusCount = 0, excursionNames = []

  var list = (events && events.d && events.d.data) ? events.d.data
           : (events && events.d) ? events.d : []

  $.each(list, function() {
    var name = this.name || this.eventName || ''
    var cat  = this.categoryName || this.category || ''
    totalEvents++
    if (isDetentionOrSuspension(name, cat)) {
      detSusCount++
    } else if (isExcursionOrIncursion(name, cat)) {
      excursionCount++
      excursionNames.push(name)
    }
  })

  var score = scoreFromThresholds(excursionCount, [[4, 4], [2, 3], [1, 2]])
  var el = $('.dash' + user + ' .extra-curricular')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text')
    .text(totalEvents + ' total event' + (totalEvents !== 1 ? 's' : '')))
  el.append($('<span>').addClass('detail-text')
    .attr('title', excursionNames.join(', ') || 'None')
    .text(excursionCount + ' excursion' + (excursionCount !== 1 ? 's' : '') +
          '/incursion' + (excursionCount !== 1 ? 's' : '') + ' \u2192 score basis'))
  if (detSusCount > 0) {
    el.append($('<span>').addClass('detail-text-danger')
      .text(detSusCount + ' linked to detention/suspension'))
  }
  recordScore(user, 'extra-curricular', score)
}

// ── Kick off ──────────────────────────────────────────────────────────────────
getStudents(startDate, endDate, activityId).done(loadStudents)

})
