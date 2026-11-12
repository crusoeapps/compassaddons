// Advisory Rubric Calculator — class-dashboard.js
// Crusoe College | crusoeapps.github.io/compassaddons
// Updated: 11 November 2026
// Changes: Total /20 now fills in (it never got its 'total' class); a failed
//          Compass lookup now says so in its cell instead of staying blank;
//          KATs no longer counts pending tasks, and Total flags them;
//          Extra Curricular counts events from attendance (Events.svc was
//          a 404); Behaviour sends category ids, falls back to class counts;
//          Extra Curricular now scores calendar events in counted groups,
//          never counting Compass activity type 10
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
#dash .event-groups { margin: 16px 0; padding: 12px 16px; background: #fff; border: 1px solid #e2e6ee; border-radius: 8px; font-size: 13px; }
#dash .event-groups:empty { display: none; }
#dash .event-groups h3 { margin: 0 0 8px; font-size: 14px; }
#dash .event-groups table { width: 100%; border-collapse: collapse; box-shadow: none; }
#dash .event-groups td, #dash .event-groups th { padding: 4px 8px; border-bottom: 1px solid #eef0f4; text-align: left; vertical-align: top; font-size: 12px; }
#dash .ec-calendar { display: block; font-size: 11px; color: #555; margin-top: 2px; }
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
  #dash .event-groups { display: none !important; }
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
  'Behaviour':       "Behaviour & conduct (1–4) across ALL classes. Based on: Detention, Suspension, Attitude/Behaviour, Out of Class, REAL Behaviour Not Shown, Non Negotiable Behaviour, and REAL Commendation. Marked 'this class only' when Compass won't return the student's whole Chronicle.",
  'Extra Curricular':'Events this year in the counted groups: Excursion, Incursion, Camp, Sport, Performance/arts, Leadership/student voice (1=none, 2=one, 3=two–three, 4=four+). Falls back to the attendance Events count if the calendar can\'t load.',
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

$('<div>').attr('id', 'event-groups').addClass('event-groups').appendTo('#dash')

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

// Per-student Chronicle feed (all classes). Without filterCategoryIds this
// returned HTTP 500 (Nov 2026), so every category id is sent. If Compass
// still rejects it, Behaviour falls back to the class-level counts below.
// Body copied from the request Compass's own profile page sends (Nov 2026):
// filterCategoryIds [-1] = all categories; paging is start + pageSize
// (a 'limit' field is ignored, which returned 0 entries); dates cover the
// whole school year.
var feedYear = new Date().getFullYear()
function getStudentChronicle(userId, start, pageSize) {
  return compassPost("/Services/ChronicleV2.svc/GetUserChronicleFeedThin", {
    targetUserId: userId,
    startDate: new Date(Date.UTC(feedYear, 0, 1)).toISOString(),
    endDate: new Date(Date.UTC(feedYear, 11, 31, 12, 59, 59)).toISOString(),
    filterCategoryIds: [-1], asParent: false,
    start: start, pageSize: pageSize, sortOrder: 0
  }, { user: userId })
}

// The feed comes back as GROUPS (d.data[]), each holding the actual entries
// in chronicleEntries[], with d.total = number of groups. Fetch every page
// and return the flat list of entries.
function getAllChronicleEntries(userId) {
  var result = $.Deferred(), entries = [], groupsSeen = 0, calls = 0, PAGE = 50
  function next() {
    calls++
    getStudentChronicle(userId, groupsSeen, PAGE).done(function(feed) {
      try {
        var d = feed && feed.d
        var groups = (d && (d.data || d)) || []
        if (!Array.isArray(groups)) throw new Error('feed is not a list')
        var total = (d && typeof d.total === 'number') ? d.total : groups.length
        groups.forEach(function(g) {
          if (Array.isArray(g.chronicleEntries)) entries.push.apply(entries, g.chronicleEntries)
          else entries.push(g)
        })
        groupsSeen += groups.length
        if (groups.length && groupsSeen < total && calls < 40) next()
        else result.resolve(entries)
      } catch (e) { result.reject(null, e.message) }
    }).fail(function(xhr) { result.reject(xhr) })
  }
  next()
  return result.promise()
}

// Chronicle category names, fetched once. Proven endpoint (June 2026).
var chronicleCategoriesRequest = null
function getChronicleCategories() {
  if (!chronicleCategoriesRequest) {
    chronicleCategoriesRequest = $.get("/Services/ReferenceDataCache.svc/GetChronicleCategories")
      .then(function(r) { return (r && r.d) || [] })
  }
  return chronicleCategoriesRequest
}

// Chronicle counts for every student in THIS class, fetched once. Proven
// endpoint (June 2026). Used only if the per-student feed fails.
var classChronicleRequest = null
function getClassChronicleUsage() {
  if (!classChronicleRequest) {
    classChronicleRequest = compassPost("/Services/ChronicleV2.svc/GetCategoryUsageCount", { type: 1, id: activityId }, {})
      .then(function(r) { return (r && r.d) || [] })
  }
  return classChronicleRequest
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

    // Extra Curricular uses the same attendance response (its "Events" row).
    var attendance = getAllAttendance(user)
    loadInto(attendance, user, 'attendance', 'attendance', function(data) { loadAllAttendance(data, user) })
    loadInto(attendance, user, 'extra-curricular', 'events', function(data) { loadExtraCurricular(data, user) })
    loadEventGroups(user)
    var yearLevelPromise = getYearLevel(user)
    loadInto(getTasks(user), user, 'kats', 'learning tasks', function(tasks) {
      yearLevelPromise.always(function(yearLevel) {
        try { loadTasks(tasks, user, yearLevel) } catch (e) { showLoadError(user, 'kats', 'learning tasks', null, e) }
      })
    })
    loadInto(getGPA(user), user, 'gpa', 'GPA', function(data) { loadGPA.call({ user: user }, data) })
    loadBehaviour(user)
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
// Compass decorates category names with sorting symbols and stray spaces
// ("^REAL Commendation ", "Detention ", "><REAL Behaviours - Not Shown"), so
// categories are matched on a lowercase core phrase, never exact names.
function categoryKind(name) {
  var n = String(name || '').trim().toLowerCase()
  if (n.includes('detention'))         return 'detention'
  if (n.includes('suspension'))        return 'suspension'
  if (n.includes('out of class'))      return 'ocwe'
  if (n.includes('real commendation')) return 'commendation'
  if (['attitude', 'real behaviour', 'non negotiable', 'confiscation'].some(function(p) { return n.includes(p) })) return 'negative'
  return null
}

function blankBehaviour() { return { detentions: 0, suspensions: 0, ocwe: 0, negPoints: 0, commendations: 0 } }

// entries: number of Chronicle entries; points: signed points for them.
// The category decides whether points are good or bad; Compass may store
// negative behaviour as either -3 or 3, so the size of the points is used.
function tallyBehaviour(d, kind, entries, points) {
  if (!kind) return
  var size = Math.abs(Number(points) || 0)
  if (kind === 'commendation') { d.commendations += size; return }
  if (kind === 'detention')  d.detentions  += entries
  if (kind === 'suspension') d.suspensions += entries
  if (kind === 'ocwe')       d.ocwe        += entries
  d.negPoints += size
}

// Points for this student: an entry can cover several students, each with
// their own points in attendees[]; otherwise use the entry's points.
function entryPointsFor(e, user) {
  if (Array.isArray(e.attendees)) {
    for (var i = 0; i < e.attendees.length; i++) {
      var a = e.attendees[i]
      if (String(a.userIdAttendee) === String(user) && a.points != null) return Number(a.points) || 0
    }
  }
  return Number(e.points) || 0
}

function loadBehaviour(user) {
  getChronicleCategories().done(function(cats) {
    var nameById = {}
    cats.forEach(function(c) { if (c && c.id != null && c.name) nameById[c.id] = c.name })
    getAllChronicleEntries(user).done(function(list) {
      try {
        var d = blankBehaviour(), recognised = 0, unscored = {}
        list.forEach(function(e) {
          var name = e.categoryName || e.category || nameById[e.categoryId]
          if (!name) return
          recognised++
          var kind = categoryKind(name)
          if (!kind) unscored[String(name).trim()] = (unscored[String(name).trim()] || 0) + 1
          tallyBehaviour(d, kind, 1, entryPointsFor(e, user))
        })
        // Entries came back but none had a category we can read: don't
        // pretend that's a clean record, use the class counts instead.
        if (list.length && !recognised) throw new Error('entries have no category')
        // Say what was read, so a '3 / No entries' can be told apart from
        // a genuine clean record. Category names only, never entry text.
        var names = Object.keys(unscored)
        if (window.console) console.log('[Rubric Calculator] user ' + user + ': ' + list.length + ' Chronicle entries read; not scored: ' +
          (names.map(function(n) { return n + ' x' + unscored[n] }).join(', ') || 'none'))
        var note = list.length + ' entr' + (list.length === 1 ? 'y' : 'ies') + ' read'
        if (names.length) note += ', ' + names.reduce(function(t, n) { return t + unscored[n] }, 0) + ' in unscored categories'
        renderBehaviour(user, d, note, names.join(', '))
      } catch (e) {
        behaviourFromClass(user, e.message)
      }
    }).fail(function(xhr, reason) {
      behaviourFromClass(user, reason || ('HTTP ' + (xhr && xhr.status)))
    })
  }).fail(function(xhr) {
    showLoadError(user, 'behaviour', 'Chronicle categories', xhr)
  })
}

// Fallback: counts logged against THIS class only (GetCategoryUsageCount).
function behaviourFromClass(user, reason) {
  if (window.console) console.warn('[Rubric Calculator] Chronicle feed failed for user ' + user + ' (' + reason + '); using this class only')
  $.when(getChronicleCategories(), getClassChronicleUsage()).done(function(cats, usage) {
    try {
      var nameById = {}
      cats.forEach(function(c) { nameById[c.id] = c.name })
      var d = blankBehaviour()
      usage.forEach(function(u) {
        var kind = categoryKind(nameById[u.categoryId])
        if (!kind || !u.counts) return
        u.counts.forEach(function(c) {
          if (String(c.StudentId) !== String(user)) return
          var entries = (c.Grey || 0) + (c.Green || 0) + (c.Amber || 0) + (c.Red || 0)
          var pts = Math.abs(Number(c.TotalPoints) || 0)
          tallyBehaviour(d, kind, entries, kind === 'commendation' ? pts : -pts)
        })
      })
      renderBehaviour(user, d, 'this class only (whole-school feed: ' + reason + ')')
    } catch (e) {
      showLoadError(user, 'behaviour', 'Chronicle', null, e)
    }
  }).fail(function(xhr) {
    showLoadError(user, 'behaviour', 'Chronicle', xhr)
  })
}

function renderBehaviour(user, d, scopeNote, noteTitle) {
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
  if (scopeNote) el.append($('<span>').addClass('detail-text-warning').text(scopeNote).attr('title', noteTitle || ''))
  recordScore(user, 'behaviour', score)
}

// ── Extra Curricular ──────────────────────────────────────────────────────────
// Events attended this year, read from the "Events" row of the attendance
// summary already fetched for the Attendance column (proven source, June
// 2026). The Events.svc/GetEventsByUserId endpoint used in August doesn't
// exist (HTTP 404). Score: 1=none, 2=one, 3=two-three, 4=four+.
// Groups that count towards the Extra Curricular score (decided Nov 2026).
var COUNTED_EVENT_GROUPS = ['Excursion', 'Incursion', 'Camp', 'Sport', 'Performance / arts', 'Leadership / student voice']
// Compass activity types never counted, whatever the title says (Nov 2026: type 10).
var EXCLUDED_ACTIVITY_TYPES = [10]
var excludedTypeLabels = {} // Compass type label -> true, for the class summary

var extraCurricular = {} // user -> { attended, attendanceReady, groups, calendarReady, calendarFailed }
function ecState(user) { return extraCurricular[user] || (extraCurricular[user] = {}) }

function loadExtraCurricular(classes, user) {
  var attended = 0
  $.each((classes && classes.d) || [], function() {
    if (String(this.sn || '').trim().toLowerCase() === 'events') attended = Number(this.ta) || 0
  })
  var st = ecState(user)
  st.attended = attended
  st.attendanceReady = true
  renderExtraCurricular(user)
}

// Score from the calendar groups; if the calendar couldn't load, fall back
// to the attendance "Events" count and say so.
function renderExtraCurricular(user) {
  var st = ecState(user)
  var el = $('.dash' + user + ' .extra-curricular')
  var score
  if (st.calendarReady) {
    var counted = 0, countedParts = [], otherParts = []
    Object.keys(st.groups).sort(function(a, b) { return st.groups[b] - st.groups[a] }).forEach(function(g) {
      if (COUNTED_EVENT_GROUPS.indexOf(g) >= 0) { counted += st.groups[g]; countedParts.push(g + ' ' + st.groups[g]) }
      else otherParts.push(g + ' ' + st.groups[g])
    })
    score = scoreFromThresholds(counted, [[4, 4], [2, 3], [1, 2]])
    el.empty()
    el.append(scoreBadge(score))
    el.append($('<span>').addClass('detail-text').text(counted + ' counted event' + (counted !== 1 ? 's' : '') + (countedParts.length ? ' (' + countedParts.join(', ') + ')' : '')))
    if (otherParts.length) el.append($('<span>').addClass('ec-calendar').text('Not counted: ' + otherParts.join(', ')))
  } else if (st.calendarFailed && st.attendanceReady) {
    score = scoreFromThresholds(st.attended, [[4, 4], [2, 3], [1, 2]])
    el.empty()
    el.append(scoreBadge(score))
    el.append($('<span>').addClass('detail-text').text(st.attended + ' event' + (st.attended !== 1 ? 's' : '') + ' attended (attendance count)'))
    el.append($('<span>').addClass('detail-text-warning').text('Calendar unavailable (' + st.calendarFailed + '): groups not checked'))
  } else {
    return // wait for the calendar (or for attendance, if the calendar failed)
  }
  recordScore(user, 'extra-curricular', score)
}

// ── Event groups (calendar) ───────────────────────────────────────────────────
// Lists each student's events this year, grouped by type, so staff can see
// what the Extra Curricular count is made of and choose which groups should
// count. The score counts COUNTED_EVENT_GROUPS (see renderExtraCurricular).
// Request body copied from Compass's own profile page (Nov 2026).
function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) }
function getUserEvents(userId) {
  var now = new Date()
  return compassPost("/Services/Calendar.svc/GetEventsByUser", {
    userId: userId, homePage: true, activityId: null, subjectId: null, locationId: null, staffIds: null,
    startDate: now.getFullYear() + '-01-01', endDate: ymd(now), page: 1, start: 0, limit: 5000
  }, { user: userId })
}

// Keyword groups from the event title. First match wins.
var EVENT_KEYWORDS = [
  ['Excursion', /excursion/i],
  ['Incursion', /incursion/i],
  ['Camp', /\bcamps?\b/i],
  ['Sport', /sport|carnival|athletic|swimming|cross ?country|gala day|interschool|tournament|netball|football|basketball|volleyball|soccer/i],
  ['Performance / arts', /concert|performance|production|music|drama|showcase|art show|band/i],
  ['Assembly / ceremony', /assembly|ceremony|presentation|awards?/i],
  ['Leadership / student voice', /leader|\bSRC\b|student voice|captain/i],
  ['Meeting / interview', /meeting|interview|conference|parent.?teacher|student.?led/i],
  ['Exam / testing', /exam|naplan|\bpat\b|assessment|test/i]
]
function eventKeywordGroup(title) {
  for (var i = 0; i < EVENT_KEYWORDS.length; i++) if (EVENT_KEYWORDS[i][1].test(title || '')) return EVENT_KEYWORDS[i][0]
  return 'Other'
}

var classEventGroups = {} // "type | group" -> { students: {uid:1}, titles: {title:count} }

function loadEventGroups(user) {
  getUserEvents(user).done(function(r) {
    try {
      var list = r && r.d
      if (list && !Array.isArray(list)) list = list.data || list.events || []
      if (!Array.isArray(list)) list = []
      var now = Date.now(), seen = {}, counts = {}, total = 0
      list.forEach(function(e) {
        // Skip normal timetabled lessons (activityType 1 = class) and anything not yet started.
        if (e.activityType === 1) return
        var start = Date.parse(e.start)
        if (!isNaN(start) && start > now) return
        var title = String(e.title || e.longTitleWithoutTime || e.longTitle || '').trim()
        // A multi-day event appears once per day: count it once.
        var key = (e.activityId != null ? e.activityId : '') + '|' + title
        if (seen[key]) return
        seen[key] = 1
        var type = String(e.activityTypeName || ('Type ' + e.activityType)).trim()
        var excluded = EXCLUDED_ACTIVITY_TYPES.indexOf(Number(e.activityType)) >= 0
        if (excluded) excludedTypeLabels[type] = true
        // Excluded types get their own group so they never reach the count.
        var group = type + ' | ' + (excluded ? 'Type ' + e.activityType + ' (excluded)' : eventKeywordGroup(title))
        counts[group] = (counts[group] || 0) + 1
        total++
        var cg = classEventGroups[group] || (classEventGroups[group] = { students: {}, titles: {} })
        cg.students[user] = 1
        if (title) cg.titles[title] = (cg.titles[title] || 0) + 1
      })
      // Totals by keyword group (Compass type is shown in the class summary).
      var byGroup = {}
      Object.keys(counts).forEach(function(g) { var k = g.split(' | ')[1]; byGroup[k] = (byGroup[k] || 0) + counts[g] })
      var st = ecState(user)
      st.groups = byGroup
      st.calendarReady = true
      renderExtraCurricular(user)
      renderEventGroupSummary()
    } catch (e) {
      if (window.console) console.error('[Rubric Calculator] calendar events not understood for user ' + user, e)
      ecState(user).calendarFailed = 'unexpected data'
      renderExtraCurricular(user)
    }
  }).fail(function(xhr) {
    if (window.console) console.warn('[Rubric Calculator] calendar events failed for user ' + user + ' (HTTP ' + (xhr && xhr.status) + ')')
    ecState(user).calendarFailed = 'HTTP ' + (xhr && xhr.status)
    renderExtraCurricular(user)
  })
}

// Class-wide list of every group found, with example event titles.
function renderEventGroupSummary() {
  var groups = Object.keys(classEventGroups)
  if (!groups.length) return
  groups.sort(function(a, b) {
    return Object.keys(classEventGroups[b].titles).length - Object.keys(classEventGroups[a].titles).length
  })
  var box = $('#event-groups').empty()
  box.append($('<h3>').text('Event groups found for this class (calendar, 1 Jan to today)'))
  var t = $('<table>').appendTo(box)
  t.append($('<tr>').append($('<th>').text('Compass type'), $('<th>').text('Group'), $('<th>').text('Counts?'), $('<th>').text('Different events'), $('<th>').text('Students'), $('<th>').text('Examples')))
  groups.forEach(function(g) {
    var cg = classEventGroups[g], titles = Object.keys(cg.titles).sort(function(a, b) { return cg.titles[b] - cg.titles[a] })
    t.append($('<tr>').append(
      $('<td>').text(g.split(' | ')[0]), $('<td>').text(g.split(' | ')[1]),
      $('<td>').text(!excludedTypeLabels[g.split(' | ')[0]] && COUNTED_EVENT_GROUPS.indexOf(g.split(' | ')[1]) >= 0 ? 'Yes' : 'No'),
      $('<td>').text(titles.length), $('<td>').text(Object.keys(cg.students).length),
      $('<td>').text(titles.slice(0, 5).join('; ') + (titles.length > 5 ? '; …' : ''))))
  })
}

// ── Kick off ──────────────────────────────────────────────────────────────────
getStudents(startDate, endDate, activityId).done(loadStudents)

})
