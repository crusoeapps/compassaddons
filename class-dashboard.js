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

  // Total badge colour
  var cls
  if      (total >= 19) cls = 'score-4'
  else if (total >= 12) cls = 'score-3'
  else if (total >= 7)  cls = 'score-2'
  else                  cls = 'score-1'

  var totalBadge = $('<span>').addClass('score-badge').addClass(cls).text(total)
  el.append(totalBadge)

  // Rating label
  var rating, ratingDetail
  if (total >= 19) {
    rating = 'Completion with Commendation'
    ratingDetail = 'Exceeds expected standard'
  } else if (total >= 12) {
    rating = 'Completion'
    ratingDetail = 'At expected standard'
  } else if (total >= 7) {
    rating = 'Participation'
    ratingDetail = 'Meeting with advisory teacher required'
  } else {
    rating = 'Enrolment'
    ratingDetail = 'Meeting with Community Leader required'
  }

  el.append($('<span>').addClass('detail-text').css('font-weight','600').text(rating))
  el.append($('<span>').addClass('detail-text').text(ratingDetail))
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
  'Behaviour':       'Behaviour & conduct (1–4). Based on detentions, suspensions, Compass points and OCWE posts.',
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

// ── Helper: render a score badge ─────────────────────────────────────────────
function scoreBadge(score) {
  var cls = (score >= 1 && score <= 4) ? 'score-' + score : 'score-na'
  var label = (score >= 1 && score <= 4) ? score : '?'
  return $('<span>').addClass('score-badge').addClass(cls).text(label)
}

// ── API calls ────────────────────────────────────────────────────────────────

function getStudents(startDate, endDate, activityId) {
  return $.ajax("/Services/Attendance.svc/GetUserSummariesByActivityWithFilter" + "?_dc=" + new Date().getTime(), {
    data: JSON.stringify({
      startDate: startDate,
      endDate: endDate,
      ActivityId: activityId,
      studentStatus: 1, inClass: [0,1], "overall": ["0","1"], okClass: [0,1],
      vce: [0,1], schl: [0,1], perspective: 0,
      totalWholeDayLimit: 0, totalPartialDayLimit: 0
    }),
    contentType: 'application/json; charset=utf-8',
    type: 'POST'
  })
}

function getAllAttendance(userId) {
  return $.ajax("/Services/Attendance.svc/GetAttendanceSummary" + "?_dc=" + new Date().getTime(), {
    data: JSON.stringify({
      startDate: startDate,
      endDate: endDate,
      userId: userId,
      studentStatus: 1, inClass: [0,1], okClass: [0,1],
      vce: [0,1], schl: [0,1], perspective: 0,
      totalWholeDayLimit: 0, totalPartialDayLimit: 0
    }),
    contentType: 'application/json; charset=utf-8',
    type: 'POST'
  })
}

function getTasks(user) {
  return $.ajax("/Services/Subjects.svc/GetAllAcademicGroups", {
    data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
    contentType: 'application/json',
    type: 'POST'
  }).then(function(cycles) {
    var currentCycle = cycles.d.filter(function(cycle) { return cycle.isRelevant })[0].id
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByUserId" + "?_dc=" + new Date().getTime(), {
      data: JSON.stringify({
        academicGroupId: currentCycle,
        userId: user,
        page: 1, start: 0, limit: 100
      }),
      contentType: 'application/json',
      type: 'POST',
      user: user
    })
  })
}

function getGPA(user) {
  return $.ajax("/Services/Gpa.svc/GetOverallGraphData" + "?_dc=" + new Date().getTime(), {
    data: JSON.stringify({ userId: user }),
    contentType: 'application/json',
    type: 'POST',
    user: user
  })
}

function getChronicle(activityId) {
  return $.ajax("/Services/ChronicleV2.svc/GetCategoryUsageCount" + "?_dc=" + new Date().getTime(), {
    data: JSON.stringify({ type: 1, id: activityId }),
    contentType: 'application/json',
    type: 'POST'
  })
}

function getEvents(userId) {
  return $.ajax("/Services/Attendance.svc/GetAttendanceSummary" + "?_dc=" + new Date().getTime(), {
    data: JSON.stringify({
      startDate: startDate,
      endDate: endDate,
      userId: userId,
      studentStatus: 1, inClass: [0,1], okClass: [0,1],
      vce: [0,1], schl: [0,1], perspective: 0,
      totalWholeDayLimit: 0, totalPartialDayLimit: 0
    }),
    contentType: 'application/json; charset=utf-8',
    type: 'POST',
    user: userId
  })
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

  getChronicle(activityId).done(loadChronicle)
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
  var score
  switch (true) {
    case (pct >= 98): score = 4; break;
    case (pct >= 95): score = 3; break;
    case (pct >  90): score = 2; break;
    default:          score = 1;
  }
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
      switch (this.students[0].submissionStatus) {
        case 1: pending++;             break;
        case 2: overdue++;             break;
        case 3: submitted++; ontime++; break;
        case 4: submitted++; late++;   break;
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
  var score
  if      (latest > 3.75) score = 4
  else if (latest > 3.5)  score = 3
  else if (latest > 2.5)  score = 2
  else                    score = 1

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
// FIXED: now matches "Out of Class Without Explanation" correctly

var behaviourData = {}

function loadChronicle(chronicle) {
  $.get("/Services/ReferenceDataCache.svc/GetChronicleCategories", function(categories) {

    $.each(chronicle.d, function() {
      var catId    = this.categoryId
      var catName  = (categories.d.filter(c => c.id == catId)[0] || {}).name || ''
      var catLower = catName.toLowerCase()

      if (!this.counts) return

      $.each(this.counts, function() {
        var user = this.StudentId
        if (!behaviourData[user]) {
          behaviourData[user] = { detentions: 0, suspensions: 0, negPoints: 0, commendations: 0, ocwe: 0 }
        }
        var d = behaviourData[user]

        if (catLower.includes('detention')) {
          d.detentions += (this.Grey + this.Green + this.Amber + this.Red)
        }
        if (catLower.includes('suspension') || catLower.includes('suspend')) {
          d.suspensions += (this.Grey + this.Green + this.Amber + this.Red)
        }
        // FIXED: match "Out of Class Without Explanation"
        if (catLower.includes('without explanation') || catLower.includes('without permission') || catLower.includes('ocwe') || catLower.includes('cowp')) {
          d.ocwe += (this.Grey + this.Green + this.Amber + this.Red)
        }
        d.negPoints     += (this.Red + this.Amber)
        d.commendations += this.Green
      })
    })

    $.each(behaviourData, function(user, d) {
      var score
      if (d.detentions >= 2 || d.suspensions >= 2 || d.negPoints >= 15) {
        score = 1
      } else if (d.detentions >= 1 || d.suspensions >= 1 || d.negPoints >= 8) {
        score = 2
      } else if (d.commendations >= 12 && d.negPoints <= 2 && d.ocwe === 0) {
        // Score 4 requires ZERO OCWE posts per rubric
        score = 4
      } else {
        score = 3
      }

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
    })

    // Ensure every student gets a behaviour score, including those with no entries
    $('#dash tbody tr').each(function() {
      var rowClass = $(this).attr('class') || ''
      var match    = rowClass.match(/dash(\d+)/)
      if (!match) return
      var user = match[1]
      var el   = $('.dash' + user + ' .behaviour')
      if (!el.children().length) {
        el.append(scoreBadge(4))
        el.append($('<span>').addClass('detail-text').text('No entries'))
        recordScore(user, 'behaviour', 4)
      }
      // Force recordScore even if already rendered (idempotent — only fires total once all 5 are set)
      if (behaviourData[user]) {
        // already handled above in $.each(behaviourData)
      } else {
        // recorded as 4 above — good
      }
    })
  })
}

// ── Extra Curricular ──────────────────────────────────────────────────────────
// Score: 1=0 events, 2=1 event, 3=2–3 events, 4=4+ events
function loadEvents(classes, user) {
  var eventsAttended = 0
  $.each(classes.d, function() {
    if (this.sn === "Events") eventsAttended = this.ta
  })

  var score
  switch (true) {
    case (eventsAttended >= 4): score = 4; break;
    case (eventsAttended >= 2): score = 3; break;
    case (eventsAttended >= 1): score = 2; break;
    default:                    score = 1;
  }

  var el = $('.dash' + user + ' .extra-curricular')
  el.append(scoreBadge(score))
  el.append($('<span>').addClass('detail-text').text(eventsAttended + ' event' + (eventsAttended !== 1 ? 's' : '')))
  recordScore(user, 'extra-curricular', score)
}

// ── Kick off ──────────────────────────────────────────────────────────────────
getStudents(startDate, endDate, activityId).done(loadStudents)

})
