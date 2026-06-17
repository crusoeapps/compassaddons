$(document).ready(function() {

  if (!window.single) {
    window.single = true
  } else {
    return
  }

  if ($('body #dash').length) {
    $('body #dash').remove()
  }

  // ── Year 7 & 8 minimum task logic ────────────────────────────────────────
  // Core subjects (Year 7 & 8) require minimum 3 tasks.
  // All other Year 7 & 8 subjects require minimum 2 tasks.
  // Year 9+ always require minimum 3 tasks.
  var CORE_SUBJECTS = ['English', 'Mathematics', 'Humanities', 'Science', 'Physical Education']

  function getMinTasks(subjectName, activityName) {
    // Detect Year 7 or Year 8 from subject name (e.g. "Year 7 English", "Year 8 Science")
    var isYear7or8 = /^Year [78]\b/i.test(subjectName) || /^[78][A-Z]/i.test(activityName)
    if (!isYear7or8) return 3
    // Check if it's a core subject
    var isCore = CORE_SUBJECTS.some(function(core) {
      return subjectName.toLowerCase().includes(core.toLowerCase())
    })
    return isCore ? 3 : 2
  }

  var wrapper = $(`<div id="dash">
    <style type="text/css">
      #dash {
        position: fixed;
        box-sizing: border-box;
        top: 0;
        padding: 64px calc(50% - 560px);
        z-index: 100;
        background-color: #f0f2f5;
        width: 100%;
        height: 100%;
        overflow: scroll;
        -webkit-overflow-scrolling: touch;
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* ── Header ── */
      #dash .rc-header {
        display: flex;
        align-items: center;
        gap: 0.75em;
        flex-wrap: wrap;
        margin: 0 0 1.25em 0;
        padding: 1em 1.25em;
        background: white;
        border-radius: 0.75em;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
      #dash .rc-header h1 {
        font-size: 1.1em;
        font-weight: 600;
        color: #1a1d23;
        margin: 0;
        flex-shrink: 0;
      }
      #dash .rc-header select {
        font-family: inherit;
        font-size: 0.85em;
        padding: 0.35em 0.6em;
        border: 1px solid #e2e5ea;
        border-radius: 0.4em;
        background: #f8f9fa;
        color: #1a1d23;
        cursor: pointer;
      }
      #dash .rc-btn {
        display: inline-flex;
        align-items: center;
        padding: 0.35em 0.85em;
        border-radius: 0.4em;
        font-size: 0.85em;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid #e2e5ea;
        background: white;
        color: #6b7280;
        transition: background 0.15s;
        white-space: nowrap;
      }
      #dash .rc-btn:hover { background: #f0f2f5; }
      #dash .rc-btn.primary {
        background: #0057d9;
        color: white;
        border-color: #0057d9;
      }
      #dash .rc-btn.primary:hover { background: #004ab5; }
      #dash .rc-btn.close-btn { margin-left: auto; }

      /* ── Description strip ── */
      #dash .rc-desc {
        font-size: 0.82em;
        color: #6b7280;
        background: #e8f0fe;
        border: 1px solid #c7d9fb;
        border-radius: 0.6em;
        padding: 0.75em 1em;
        margin-bottom: 1.25em;
        line-height: 1.6;
      }

      /* ── Legend ── */
      #dash .rc-legend {
        display: flex;
        gap: 1em;
        flex-wrap: wrap;
        margin-bottom: 1em;
        font-size: 0.8em;
        color: #6b7280;
        font-weight: 500;
      }
      #dash .rc-legend span {
        display: flex;
        align-items: center;
        gap: 0.35em;
      }
      #dash .rc-legend .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      #dash .dot-green  { background: #16a34a; }
      #dash .dot-yellow { background: #d97706; }
      #dash .dot-red    { background: #dc2626; }

      /* ── Staff / activity cards ── */
      #dash details {
        background: white;
        border-radius: 0.6em;
        margin-bottom: 0.5em;
        border: 1px solid #e2e5ea;
        overflow: hidden;
      }
      #dash details details {
        border-radius: 0;
        margin: 0;
        border: none;
        border-top: 1px solid #f0f2f5;
      }
      #dash details details details {
        border-top: 1px solid #f0f2f5;
      }
      #dash summary {
        display: flex;
        align-items: center;
        padding: 0.75em 1em;
        cursor: pointer;
        list-style: none;
        gap: 0.5em;
        font-size: 0.9em;
      }
      #dash summary::-webkit-details-marker { display: none; }
      #dash summary::before {
        content: '▶';
        font-size: 0.65em;
        color: #9ca3af;
        transition: transform 0.15s;
        flex-shrink: 0;
      }
      #dash details[open] > summary::before { transform: rotate(90deg); }

      /* Staff-level summary */
      #dash details.staff > summary {
        font-weight: 600;
        font-size: 0.95em;
        color: #1a1d23;
        padding: 0.85em 1em;
        background: #fafbfc;
        border-bottom: 1px solid #e2e5ea;
      }
      #dash details.staff > summary > div:first-of-type { flex: 1; }

      /* Activity-level summary */
      #dash details.activity > summary {
        padding-left: 2em;
        background: white;
      }
      #dash details.activity > summary > div:first-of-type { flex: 1; }
      #dash details.activity > summary a {
        color: #0057d9;
        text-decoration: none;
        font-weight: 500;
      }
      #dash details.activity > summary a:hover { text-decoration: underline; }

      /* Issues level */
      #dash details.issues > summary {
        padding-left: 3.5em;
        font-size: 0.85em;
        font-weight: 600;
        color: #92400e;
        background: #fffbeb;
      }
      #dash details.issues p {
        margin: 0;
        padding: 0.5em 1em 0.5em 4.5em;
        font-size: 0.82em;
        color: #6b7280;
        border-top: 1px solid #f9fafb;
        line-height: 1.5;
      }
      #dash details.issues p:last-child { padding-bottom: 0.75em; }

      /* Excend level */
      #dash details.excend > summary {
        padding-left: 3.5em;
        font-size: 0.85em;
        font-weight: 500;
        color: #1a1d23;
        background: #f0fdf4;
      }
      #dash .excend > div {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.4em 1em 0.4em 4.5em;
        border-top: 1px solid #f0f2f5;
        font-size: 0.82em;
      }
      #dash .excend > div > div { padding: 0.2em 0.4em; }
      #dash .excend > div > div:first-child {
        font-weight: 600;
        width: 30%;
        flex-shrink: 0;
      }
      #dash .excend > div > div:last-child { margin-left: auto; }

      /* ── Status colours ── */
      #dash .complete > summary,
      #dash details.staff.complete > summary {
        border-left: 4px solid #16a34a;
      }
      #dash .warning > summary,
      #dash details.staff.warning > summary {
        border-left: 4px solid #d97706;
      }
      #dash .error > summary,
      #dash details.staff.error > summary {
        border-left: 4px solid #dc2626;
      }

      /* ── KAT pills ── */
      #dash .kats {
        display: flex;
        gap: 0.3em;
        flex-wrap: wrap;
        padding: 0;
      }
      #dash .kats > div {
        font-size: 0.72em;
        font-weight: 600;
        padding: 0.2em 0.5em;
        border-radius: 0.3em;
        background: #dcfce7;
        color: #15803d;
        white-space: nowrap;
      }
      #dash .kats > div.warning { background: #fef3c7; color: #92400e; }
      #dash .kats > div.error   { background: #fee2e2; color: #991b1b; }

      /* ── Elements pill ── */
      #dash .elements > div {
        font-size: 0.75em;
        font-weight: 600;
        padding: 0.25em 0.6em;
        border-radius: 2em;
        white-space: nowrap;
      }
      #dash .elements > div.complete { background: #dcfce7; color: #15803d; }
      #dash .elements > div.error    { background: #fee2e2; color: #991b1b; }

      /* ── Email button in summary ── */
      #dash .email-btn {
        font-size: 0.75em;
        padding: 0.2em 0.6em;
        border-radius: 0.35em;
        border: 1px solid #e2e5ea;
        background: white;
        color: #0057d9;
        cursor: pointer;
        flex-shrink: 0;
      }
      #dash .email-btn:hover { background: #e8f0fe; }

      /* ── Cycle wrapper ── */
      #dash .cycle { padding-bottom: 2em; }

      /* ── Note ── */
      #dash .note-footer {
        font-size: 0.78em;
        color: #9ca3af;
        text-align: center;
        padding: 1em 0 2em;
      }

      /* ── Progress bar on staff row ── */
      #dash details.staff > summary {
        background-size: 100%;
        transition: background 0.3s ease;
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
        #dash .rc-header .rc-btn { display: none !important; }
      }
    </style>
  </div>`).appendTo('body')

  // ── Header ───────────────────────────────────────────────────────────────
  var header = $('<div>').addClass('rc-header').appendTo('#dash')
  $('<h1>').text('Reports Check').appendTo(header)

  var selectCycle = $('<select>').change(loadCycle).appendTo(header)

  if (Compass.organisationUserRoles.ReportsAdmin) {
    $('<div>').addClass('rc-btn').text('Expand all').click(function() {
      if ($(this).text() === 'Expand all') {
        $(this).text('Collapse all')
        $('details.staff').attr('open', '')
      } else {
        $(this).text('Expand all')
        $('details.staff').removeAttr('open')
      }
    }).appendTo(header)
  }

  $('<div>').addClass('rc-btn primary close-btn').text('✕ Close').click(function() {
    window.single = false
    $('#dash').remove()
  }).appendTo(header)

  // ── Description ──────────────────────────────────────────────────────────
  $('<div>').addClass('rc-desc')
    .text('Checks reports for missing elements automatically. Click into colour-coded classes to see details of errors and warnings with instructions on how to fix them. Excellence & Endeavour award recommendations are also listed. Hover over task pills to see full task names. Click class names to open them directly in Compass.')
    .appendTo('#dash')

  // ── Legend ───────────────────────────────────────────────────────────────
  var legend = $('<div>').addClass('rc-legend').appendTo('#dash')
  legend.append('<span><div class="dot dot-green"></div> Complete</span>')
  legend.append('<span><div class="dot dot-yellow"></div> Warnings</span>')
  legend.append('<span><div class="dot dot-red"></div> Errors — action required</span>')
  legend.append('<span style="margin-left:auto;font-size:0.75em;color:#9ca3af;">Yr 7 & 8 core subjects: min 3 tasks &nbsp;|&nbsp; Yr 7 & 8 other subjects: min 2 tasks &nbsp;|&nbsp; Yr 9+: min 3 tasks</span>')

  getCycles().done(loadCycles)
  getProgress().done(loadProgress)
  getOpenProgress().done(loadProgress)

  // ── API: Cycles ───────────────────────────────────────────────────────────
  function getCycles() {
    return $.ajax("/Services/Reports.svc/GetCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadCycles(cycles) {
    $.each(cycles.d, function(i, n) {
      var option = $('<option>').attr('value', n.id)
        .attr('data-start', n.start)
        .text(n.name + ' ' + n.year)
        .appendTo(selectCycle)
      if (i === 0) option.attr('selected', 'selected')
    })
    selectCycle.change()
  }

  function getProgress() {
    return $.ajax("/Services/Gpa.svc/GetPublishedCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function getOpenProgress() {
    return $.ajax("/Services/Gpa.svc/GetOpenCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadProgress(cycles) {
    $.each(cycles.d, function(i, n) {
      var start = new Date(n.start)
      start = new Date(start - start.getTimezoneOffset() * -60 * 1000).toLocaleDateString("en-GB")
      $(`#dash select option[data-start="${start}"]`).attr("data-progress", n.id)
    })
  }

  // ── Cycle loading ─────────────────────────────────────────────────────────
  function loadCycle() {
    var cycleId = selectCycle.val()
    $('.cycle').hide()
    if ($(`#${cycleId}`).length) {
      $(`#${cycleId}`).show()
    } else {
      var cycle = $('<div>').attr('id', cycleId).addClass('cycle').appendTo('#dash')
      var userId = Compass.organisationUserId
      var user = $('<details>').addClass(`${userId} staff`).appendTo(`#${cycleId}.cycle`)
      var summary = $('<summary>').appendTo(user)
      $('<div>').text(selectCycle.children('option:selected').text()).appendTo(summary)
      $('<div>').appendTo(summary)
      user.attr('open', '')
      getActivities(cycleId, userId).done(function(data) {
        loadActivities(data, userId, cycleId)
      })
      if (Compass.organisationUserRoles.ReportsAdmin) {
        $('<div>').addClass('rc-btn primary').css({ margin: '0.75em 0' }).text('Load All Staff').click(function() {
          $(`#${cycleId} details`).remove()
          getStaff(cycleId).done((users) => loadStaff(users, cycleId))
          $(this).remove()
        }).appendTo(`#${cycleId}.cycle`)
      }
    }
  }

  // ── Staff ─────────────────────────────────────────────────────────────────
  function getStaff(cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportsStaff", {
      data: JSON.stringify({ cycleId: cycleId }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadStaff(users, cycleId) {
    users.d.sort(function(a, b) {
      return a.ln.localeCompare(b.ln) || a.fn.localeCompare(b.fn)
    })
    $.each(users.d, function() {
      var userId = this.id
      var user = $('<details>').addClass(`${userId} staff`).appendTo(`#${cycleId}.cycle`)
      var summary = $('<summary>').appendTo(user)
      $('<div>').text(this.n).appendTo(summary)
      $('<div>').addClass('email-btn').text('Email').click(function(event) {
        event.preventDefault()
        getUser(userId).done((user) => emailUser(user, cycleId))
      }).appendTo(summary)
      getActivities(cycleId, userId).done(function(data) {
        loadActivities(data, userId, cycleId)
      })
    })
  }

  function getUser(userId) {
    return $.ajax("/Services/User.svc/GetUserDetailsBlobByUserId", {
      data: JSON.stringify({
        targetUserId: userId,
        targetSchoolId: Compass.schoolId,
        page: 1, start: 0, limit: 25
      }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function emailUser(user, cycleId) {
    var subject = 'Please check the following reports (or mark Excluded)'
    var body = []
    $(`#${cycleId}.cycle .${user.d.userId}.staff details`).each(function() {
      var errors = $(this).find('p')
      if (errors.length) {
        body.push($(this).find('summary > div:first-child').text())
        body.push(errors.map(function() { return $(this).text() }).get().join('%0a') + '%0a')
      }
    })
    if (body.length) {
      window.location.href = `mailto:${user.d.userEmail}?subject=${subject}&body=${body.join('%0a')}`
    } else {
      alert($(`#${cycleId}.cycle .${user.d.userId}.staff > summary div:first-child`).text() + " has finished their reports.")
    }
  }

  // ── Activities ────────────────────────────────────────────────────────────
  function getActivities(cycleId, userId) {
    return $.ajax("/Services/Reports.svc/GetOpenCycleActivitiesByUserId", {
      data: JSON.stringify({ cycleId: cycleId, userId: userId }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadActivities(data, userId, cycleId) {
    var staff = $(`#${cycleId}.cycle .${userId}.staff`)
    var progress = $(`#${cycleId}.cycle .${userId}.staff > summary`)
    var total = data.d.length
    var count = 0
    $.each(data.d, function() {
      if (this.subjectName == "Advisory" || this.subjectName == "YDuties" || this.subjectName == "YDBUS") {
        total--
        return
      }
      var entityId    = this.id
      var activityId  = this.activityId
      var subjectName = this.subjectName
      var activityName = this.activityName

      var activity = $('<details>').addClass(`${entityId} activity`).appendTo(staff)
      var summary  = $('<summary>').appendTo(activity)
      $('<div>').html(`<a href="/Organise/Activities/Activity.aspx#activity/${activityId}" target="_blank">${activityName} — ${subjectName}</a>`).appendTo(summary)
      $('<div>').addClass('kats').appendTo(summary)
      $('<div>').addClass('elements').appendTo(summary)

      $.when(getReports(entityId, cycleId), getTasks(activityId), getEnrolments(activityId))
        .done(function(results, tasks, enrolments) {
          var issues   = $('<details>').addClass(`${entityId} issues`).hide().appendTo(activity)
          $('<summary>').text("Issues").appendTo(issues)
          var classlist = loadEnrolments(enrolments[0])
          loadTasks(tasks[0], entityId, userId, cycleId, classlist, subjectName, activityName)
          loadReports(results[0], activityId, entityId, userId, cycleId)
        }).done(function() {
          if (!staff.hasClass('complete')) staff.addClass('complete')
          count++
          var percent = count / total * 100
          progress.css({ background: `-webkit-linear-gradient(left, rgba(0,0,0,0), rgba(0,0,0,0) ${percent}%, white ${percent}%, white)` })
        })
    })
  }

  // ── GPA ───────────────────────────────────────────────────────────────────
  function getGPA(entityId, cycleId) {
    return $.ajax("/Services/Gpa.svc/GetResultsByCycleAndActivity", {
      data: JSON.stringify({ cycleId: cycleId, entityId: entityId, editing: false }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadGPA(results, userId) {
    try {
      return results.d.entities
        .filter(s => s.id == userId)[0]
        .results.map(r => [r.result, results.d.aoas.filter(a => a.id == r.id)])
        .map(a => a[1][0].options.filter(b => b.id == a[0]))
        .map(a => a[0].value)
        .filter(x => x)
    } catch {
      return false
    }
  }

  // ── Enrolments ────────────────────────────────────────────────────────────
  function getEnrolments(activityId) {
    return $.ajax("/Services/Activity.svc/GetEnrolmentsByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 100 }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadEnrolments(results) {
    return results.d.map(s => s.uid)
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  function getReports(entityId, cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportReviewerBlob", {
      data: JSON.stringify({ entityType: 1, entityId: entityId, cycleId: cycleId }),
      contentType: 'application/json',
      type: 'POST'
    })
  }
  function loadReports(results, activityId, entityId, userId, cycleId) {
    var activity  = $(`#${cycleId}.cycle .${userId}.staff .${entityId}.activity .elements`)
    var metadata  = activity.parent().parent()
    var issues    = $(`#${cycleId}.cycle .${userId}.staff .${entityId}.issues`)
    var staff     = metadata.parent()
    var elements  = $('<div>').text("Completed").addClass('complete').appendTo(activity)
    var excend    = $('<details>').addClass(`${entityId} excend`).appendTo(metadata)
    $('<summary>').text("Excellence & Endeavour recommendations").appendTo(excend)
    var GPAcycleId = $(`#dash select option[value="${cycleId}"]`).attr("data-progress")
    getGPA(activityId, GPAcycleId).always(function(gpas) {
      $.each(results.d.entities, function() {
        var studentName = this.name
        var student = $('<div>').appendTo(excend)
        $('<div>').text(studentName).appendTo(student)
        var gp = [], ex = [], en = true
        $.each(this.results, function() {
          if (this.name == "Overall Assessment" || this.name == "Performance" || this.name == "Grading: Achievement") {
            var abbr = (this.displayValue.match(/\b([A-Z])/g) || [this.displayValue]).join('')
            $('<div>').text(abbr).attr('title', this.displayValue).appendTo(student)
            ex.push(
              this.displayValue == "Working Well Above Expected Level" ||
              this.displayValue == "Working Above Expected Level" ||
              this.displayValue == "Working At Expected Level" ||
              this.displayValue == "Excellent" ||
              parseInt(this.displayValue) >= 50 ||
              (this.displayValue == "Absent" && this.itemName == "Semester Exam")
            )
          }
          if (this.displayValue == "Not Assessed" || this.displayValue == "Not Submitted") en = false
          if (this.itemName == "Work Habits") {
            switch (this.value) {
              case "Consistently": gp.push(4); break
              case "Usually":      gp.push(3); break
              case "Sometimes":    gp.push(2); break
              case "Rarely":       gp.push(1); break
            }
          }
          if (!this.value || (this.itemName == "Award" && this.value == "None")) {
            issues.show()
            var text = [studentName, this.name].join(' — ')
            $('<p>').text(text).appendTo(issues)
            issues.children('summary').text(`Issues (${issues.children('p').length})`)
            if (!elements.hasClass('error')) elements.addClass('error').text("Incomplete")
            if (!staff.hasClass('error')) staff.addClass('error')
          }
        })
        gp = gp.length ? gp : loadGPA(gpas, this.id)
        var gpa = gp.length ? (gp.reduce((a, b) => a + b) / gp.length).toFixed(2) : "NA"
        $('<div>').text(gpa).attr('title', 'Grade Point Average').appendTo(student)
        if (gpa >= 3.75 && en) {
          if (!ex.includes(false) && ex.length) {
            $('<div>').text("Excellence").addClass('complete').appendTo(student)
          } else {
            $('<div>').text("Endeavour").addClass('complete').appendTo(student)
          }
        } else {
          $('<div>').appendTo(student)
        }
      })
    })
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  function getTasks(activityId) {
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 2000 }),
      contentType: 'application/json',
      type: 'POST'
    })
  }

  // subjectName and activityName now passed in so we can apply min-task logic
  function loadTasks(tasks, entityId, userId, cycleId, classlist, subjectName, activityName) {
    var activity = $(`#${cycleId}.cycle .${userId}.staff .${entityId}.activity .kats`)
    var metadata = activity.parent().parent()
    var issues   = $(`#${cycleId}.cycle .${userId}.staff .${entityId}.issues`)
    var staff    = metadata.parent()

    var message = function(kat, type, count, text) {
      issues.show()
      $('<p>').text(`Task ${count}${text}`).appendTo(issues)
      issues.children('summary').text(`Issues (${issues.children('p').length})`)
      if (!kat.hasClass(type)) kat.addClass(type)
      if (!staff.hasClass(type)) staff.addClass(type)
    }

    var katCount = 0
    $.each(tasks.d.data, function() {
      if (this.semesterReportCycles && this.semesterReportCycles.some(task => task.includeInSemesterReports === true && task.reportCycleId == cycleId)) {
        katCount++
        var kat = $('<div>').text(`Task ${katCount}`).attr('title', this.name).addClass('complete').appendTo(activity)

        if (!this.taskReportDescription) {
          message(kat, 'error', katCount, " has no description (edit Learning Task > Reporting and add Task Summary Description)")
        }
        if (this.gradingItems && this.gradingItems.filter(grade => grade.includeInSemesterReport === true).length < 1) {
          message(kat, 'error', katCount, " grading components disabled (edit Learning Task > Reporting and check Components are ticked)")
        }
        $.each(this.students, function() {
          if (!this.results.length && classlist.includes(this.userId)) {
            message(kat, 'error', katCount, ` results missing for ${this.userName}`)
          }
        })
        if (this.taskReportDescription && this.taskReportDescription.includes("\n\n")) {
          message(kat, 'warning', katCount, " has extra text in description (edit Learning Task > Reporting and remove extra text from Task Summary Description)")
        }
        if (!(this.name.startsWith("Key Assessment Task") || this.name.startsWith("Unit") || this.name.startsWith("Exam") || this.name.startsWith("SAC") || this.name.startsWith("Semester") || this.name.startsWith("Structured"))) {
          message(kat, 'warning', katCount, `: '${this.name}' does not follow naming format (edit Learning Task and check Name)`)
        }
        if (!(this.taskTitleOnReport.startsWith("Key Assessment Task") || this.taskTitleOnReport.startsWith("Unit") || this.taskTitleOnReport.startsWith("Exam") || this.taskTitleOnReport.startsWith("SAC") || this.taskTitleOnReport.startsWith("Semester") || this.taskTitleOnReport.startsWith("Structured"))) {
          message(kat, 'warning', katCount, `: '${this.taskTitleOnReport}' does not follow naming format (edit Learning Task > Reporting and check Title on Report)`)
        }
        if (this.includeInOverall) {
          message(kat, 'warning', katCount, `: ${this.name} is emphasised (edit Learning Task > Reporting and untick Emphasise in Task Summary)`)
        }
        if (this.showTaskDueDates) {
          message(kat, 'warning', katCount, `: ${this.name} shows due date on report (edit Learning Task > Reporting and untick Display Task Due Dates)`)
        }
        if (this.securityOptions && this.securityOptions.filter(grade => grade.gradingVisible === false).length) {
          message(kat, 'warning', katCount, " grading not visible (edit Learning Task > Basic and check Grading Visible is ticked)")
        }
        if (this.name.includes(" : ") || this.taskTitleOnReport.includes(" : ")) {
          message(kat, 'info', katCount, " has incorrect colon use in name (edit Learning Task and remove space before colon)")
        }
        if (!this.dueDateTimestamp) {
          message(kat, 'info', katCount, `: ${this.name} is missing due date (edit Learning Task and add Due Date)`)
        }
      }
    })

    // ── Minimum task count check (school-specific logic) ──────────────────
    var minTasks = getMinTasks(subjectName, activityName)
    if (katCount < minTasks) {
      issues.show()
      var isYear7or8Other = minTasks === 2
      var msg = isYear7or8Other
        ? `Class has fewer than ${minTasks} tasks (Year 7/8 non-core subject minimum is 2 — edit Learning Tasks > Reporting and check Semester Report Cycles are added)`
        : `Class has fewer than ${minTasks} tasks (edit Learning Tasks > Reporting and check Semester Report Cycles are added)`
      $('<p>').text(msg).appendTo(issues)
      if (!staff.hasClass('warning')) staff.addClass('warning')
      issues.children('summary').text(`Issues (${issues.children('p').length})`)
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  $('<div>').addClass('note-footer')
    .text('Crusoe College — Reports Check — scores and recommendations are indicative only')
    .appendTo('#dash')

})
