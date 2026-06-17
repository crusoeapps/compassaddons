$(document).ready(function() {

  if (!window.single) {
    window.single = true
  } else {
    return
  }

  if ($('body #dash').length) {
    $('body #dash').remove()
  }

  // ── Year level & minimum task logic ──────────────────────────────────────
  // Detects Year 7 or 8 from EITHER subject name OR activity/class name
  // Subject name: "Year 7 Multimedia", "Year 8 Art"
  // Activity name: "7MMEA", "8ART", "7A-ENG"
  var CORE_SUBJECTS = ['English', 'Mathematics', 'Humanities', 'Science', 'Physical Education']

  function detectYearLevel(subjectName, activityName) {
    // From subject name: "Year 7 ..." or "Year 8 ..."
    var subjectMatch = subjectName.match(/^Year\s+([78])\b/i)
    if (subjectMatch) return parseInt(subjectMatch[1])
    // From activity name: starts with 7 or 8 followed by a letter
    var activityMatch = activityName.match(/^([78])[A-Z]/i)
    if (activityMatch) return parseInt(activityMatch[1])
    return null // not Year 7 or 8
  }

  function getMinTasks(subjectName, activityName) {
    var yr = detectYearLevel(subjectName, activityName)
    if (yr !== 7 && yr !== 8) return 3
    var isCore = CORE_SUBJECTS.some(function(core) {
      return subjectName.toLowerCase().includes(core.toLowerCase())
    })
    return isCore ? 3 : 2
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  $(`<div id="dash"><style>
    #dash * { box-sizing: border-box; }
    #dash {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10000;
      background: #f0f2f5;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Top bar ── */
    #dash .rc-topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 20px;
      height: 52px;
      background: white;
      border-bottom: 1px solid #e2e5ea;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    #dash .rc-topbar h1 {
      font-size: 15px;
      font-weight: 600;
      color: #1a1d23;
      margin: 0;
      white-space: nowrap;
    }
    #dash .rc-topbar-divider {
      width: 1px; height: 18px;
      background: #e2e5ea;
      flex-shrink: 0;
    }
    #dash .rc-cycle-select {
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 5px 10px;
      border: 1px solid #e2e5ea;
      border-radius: 6px;
      background: #f8f9fa;
      color: #1a1d23;
      cursor: pointer;
      min-width: 180px;
    }
    #dash .rc-cycle-select:focus { outline: none; border-color: #0057d9; }
    #dash .rc-spacer { flex: 1; }
    #dash .rc-topbar-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid #e2e5ea;
      background: white;
      color: #374151;
      white-space: nowrap;
      transition: background 0.12s;
    }
    #dash .rc-topbar-btn:hover { background: #f3f4f6; }
    #dash .rc-topbar-btn.danger {
      background: #0057d9;
      color: white;
      border-color: #0057d9;
    }
    #dash .rc-topbar-btn.danger:hover { background: #004ab5; }
    #dash .rc-topbar-btn.close {
      background: #1a1d23;
      color: white;
      border-color: #1a1d23;
    }
    #dash .rc-topbar-btn.close:hover { background: #374151; }

    /* ── Scrollable body ── */
    #dash .rc-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 40px;
    }

    /* ── Stat bar ── */
    #dash .rc-stats {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    #dash .rc-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
    }
    #dash .rc-stat .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #dash .rc-stat strong {
      font-size: 16px;
      font-weight: 700;
      color: #1a1d23;
    }
    #dash .dot-green  { background: #16a34a; }
    #dash .dot-amber  { background: #d97706; }
    #dash .dot-red    { background: #dc2626; }
    #dash .dot-blue   { background: #0057d9; }

    /* ── Rule note ── */
    #dash .rc-rule-note {
      font-size: 11.5px;
      color: #6b7280;
      background: #e8f0fe;
      border: 1px solid #c7d9fb;
      border-radius: 6px;
      padding: 7px 12px;
      margin-bottom: 14px;
      line-height: 1.5;
    }

    /* ── Staff block ── */
    #dash .rc-staff-block {
      background: white;
      border: 1px solid #e2e5ea;
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    #dash .rc-staff-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      background: #fafbfc;
      border-bottom: 1px solid #e2e5ea;
      cursor: pointer;
      user-select: none;
    }
    #dash .rc-staff-header:hover { background: #f3f4f6; }
    #dash .rc-staff-chevron {
      font-size: 10px;
      color: #9ca3af;
      transition: transform 0.15s;
      flex-shrink: 0;
    }
    #dash .rc-staff-block.open .rc-staff-chevron { transform: rotate(90deg); }
    #dash .rc-staff-name {
      font-weight: 600;
      font-size: 13px;
      color: #1a1d23;
      flex: 1;
    }
    #dash .rc-staff-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      white-space: nowrap;
    }
    #dash .rc-staff-pill.complete { background: #dcfce7; color: #15803d; }
    #dash .rc-staff-pill.warning  { background: #fef3c7; color: #92400e; }
    #dash .rc-staff-pill.error    { background: #fee2e2; color: #991b1b; }
    #dash .rc-staff-pill.loading  { background: #f3f4f6; color: #6b7280; }
    #dash .rc-email-btn {
      font-size: 11px;
      font-weight: 500;
      padding: 3px 9px;
      border-radius: 5px;
      border: 1px solid #c7d9fb;
      background: #e8f0fe;
      color: #0057d9;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #dash .rc-email-btn:hover { background: #d1e3fc; }
    #dash .rc-staff-body { display: none; }
    #dash .rc-staff-block.open .rc-staff-body { display: block; }

    /* ── Progress bar ── */
    #dash .rc-progress-bar {
      height: 2px;
      background: #f0f2f5;
      overflow: hidden;
    }
    #dash .rc-progress-fill {
      height: 100%;
      background: #0057d9;
      width: 0%;
      transition: width 0.3s ease;
    }

    /* ── Activity rows ── */
    #dash .rc-activity {
      border-bottom: 1px solid #f3f4f6;
    }
    #dash .rc-activity:last-child { border-bottom: none; }
    #dash .rc-activity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px 8px 28px;
      cursor: pointer;
      transition: background 0.1s;
    }
    #dash .rc-activity-header:hover { background: #f9fafb; }
    #dash .rc-activity-status {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #dash .rc-activity-name {
      flex: 1;
      font-size: 12.5px;
    }
    #dash .rc-activity-name a {
      color: #0057d9;
      text-decoration: none;
      font-weight: 500;
    }
    #dash .rc-activity-name a:hover { text-decoration: underline; }
    #dash .rc-kats {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    #dash .rc-kat {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: #dcfce7;
      color: #15803d;
      white-space: nowrap;
      cursor: default;
    }
    #dash .rc-kat.warning { background: #fef3c7; color: #92400e; }
    #dash .rc-kat.error   { background: #fee2e2; color: #991b1b; }
    #dash .rc-element-pill {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      white-space: nowrap;
    }
    #dash .rc-element-pill.complete { background: #dcfce7; color: #15803d; }
    #dash .rc-element-pill.error    { background: #fee2e2; color: #991b1b; }
    #dash .rc-activity-body { display: none; }
    #dash .rc-activity.open .rc-activity-body { display: block; }

    /* ── Issue list ── */
    #dash .rc-issue-group {
      margin: 0 14px 10px 28px;
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      overflow: hidden;
    }
    #dash .rc-issue-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      background: #fffbeb;
      border-bottom: 1px solid #fde68a;
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
    }
    #dash .rc-issue-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid #f9fafb;
      font-size: 12px;
      color: #374151;
      line-height: 1.5;
    }
    #dash .rc-issue-item:last-child { border-bottom: none; }
    #dash .rc-issue-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }

    /* ── Excend section ── */
    #dash .rc-excend {
      margin: 0 14px 10px 28px;
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      overflow: hidden;
    }
    #dash .rc-excend-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
      font-size: 12px;
      font-weight: 600;
      color: #15803d;
      cursor: pointer;
    }
    #dash .rc-excend-body { display: none; }
    #dash .rc-excend.open .rc-excend-body { display: block; }
    #dash .rc-excend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      border-bottom: 1px solid #f9fafb;
      font-size: 11.5px;
      color: #374151;
    }
    #dash .rc-excend-row:last-child { border-bottom: none; }
    #dash .rc-excend-name { width: 28%; font-weight: 500; flex-shrink: 0; }
    #dash .rc-excend-award {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 20px;
    }
    #dash .rc-excend-award.complete { background: #dcfce7; color: #15803d; }

    /* ── Load all staff button ── */
    #dash .rc-load-all {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 10px 14px;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      background: #0057d9;
      color: white;
      border: none;
      transition: background 0.12s;
    }
    #dash .rc-load-all:hover { background: #004ab5; }

    /* ── Empty state ── */
    #dash .rc-empty {
      text-align: center;
      padding: 40px 20px;
      color: #9ca3af;
      font-size: 13px;
    }

    @media print {
      body > *:not(#dash) { display: none !important; }
      #dash { position: static !important; overflow: visible !important; height: auto !important; }
      #dash .rc-topbar .rc-topbar-btn { display: none !important; }
      #dash .rc-staff-body { display: block !important; }
      #dash .rc-activity-body { display: block !important; }
    }
  </style></div>`).appendTo('body')

  // ── Stat counters ─────────────────────────────────────────────────────────
  var stats = { complete: 0, warning: 0, error: 0, total: 0 }

  function updateStats() {
    $('#rc-stat-complete strong').text(stats.complete)
    $('#rc-stat-warning strong').text(stats.warning)
    $('#rc-stat-error strong').text(stats.error)
    $('#rc-stat-total strong').text(stats.total)
  }

  // ── Top bar ───────────────────────────────────────────────────────────────
  var topbar = $('<div>').addClass('rc-topbar').appendTo('#dash')
  $('<h1>').text('Reports Check').appendTo(topbar)
  $('<div>').addClass('rc-topbar-divider').appendTo(topbar)
  var selectCycle = $('<select>').addClass('rc-cycle-select').change(loadCycle).appendTo(topbar)
  $('<div>').addClass('rc-spacer').appendTo(topbar)

  if (Compass.organisationUserRoles.ReportsAdmin) {
    $('<div>').addClass('rc-topbar-btn').text('Expand all').click(function() {
      var isExpand = $(this).text() === 'Expand all'
      $(this).text(isExpand ? 'Collapse all' : 'Expand all')
      if (isExpand) {
        $('.rc-staff-block').addClass('open')
        $('.rc-activity').addClass('open')
      } else {
        $('.rc-staff-block').removeClass('open')
        $('.rc-activity').removeClass('open')
      }
    }).appendTo(topbar)
  }

  $('<div>').addClass('rc-topbar-btn danger').html('🖨 Print').click(function() {
    window.print()
  }).appendTo(topbar)

  $('<div>').addClass('rc-topbar-btn close').text('✕ Close').click(function() {
    window.single = false
    $('#dash').remove()
  }).appendTo(topbar)

  // ── Body ──────────────────────────────────────────────────────────────────
  var body = $('<div>').addClass('rc-body').appendTo('#dash')

  // Stats bar
  var statsBar = $('<div>').addClass('rc-stats').appendTo(body)
  statsBar.append('<div class="rc-stat" id="rc-stat-total"><div class="dot dot-blue"></div><strong>0</strong> Classes</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-complete"><div class="dot dot-green"></div><strong>0</strong> Complete</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-warning"><div class="dot dot-amber"></div><strong>0</strong> Warnings</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-error"><div class="dot dot-red"></div><strong>0</strong> Errors</div>')

  // Rule note
  $('<div>').addClass('rc-rule-note').html(
    '📋 <strong>Task minimums:</strong> Year 7 & 8 core subjects (English, Mathematics, Humanities, Science, Physical Education) require <strong>3</strong> tasks. ' +
    'All other Year 7 & 8 subjects require <strong>2</strong> tasks. Year 9 and above require <strong>3</strong> tasks. ' +
    '⚠️ Learning tasks must be assigned to <strong>Classes</strong>, not Subjects.'
  ).appendTo(body)

  // Cycle container
  var cycleContainer = $('<div>').attr('id', 'rc-cycles').appendTo(body)

  getCycles().done(loadCycles)
  getProgress().done(loadProgress)
  getOpenProgress().done(loadProgress)

  // ── API: Cycles ───────────────────────────────────────────────────────────
  function getCycles() {
    return $.ajax("/Services/Reports.svc/GetCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadCycles(cycles) {
    $.each(cycles.d, function(i, n) {
      var opt = $('<option>').val(n.id).attr('data-start', n.start).text(n.name + ' ' + n.year).appendTo(selectCycle)
      if (i === 0) opt.attr('selected', 'selected')
    })
    selectCycle.change()
  }
  function getProgress() {
    return $.ajax("/Services/Gpa.svc/GetPublishedCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function getOpenProgress() {
    return $.ajax("/Services/Gpa.svc/GetOpenCycles", {
      data: JSON.stringify({ page: 1, start: 0, limit: 25 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadProgress(cycles) {
    $.each(cycles.d, function(i, n) {
      var start = new Date(n.start)
      start = new Date(start - start.getTimezoneOffset() * -60 * 1000).toLocaleDateString("en-GB")
      $(`#dash select option[data-start="${start}"]`).attr("data-progress", n.id)
    })
  }

  // ── Cycle ─────────────────────────────────────────────────────────────────
  function loadCycle() {
    var cycleId = selectCycle.val()
    $('#rc-cycles .rc-cycle').hide()
    stats = { complete: 0, warning: 0, error: 0, total: 0 }
    updateStats()

    if ($(`#rc-cycle-${cycleId}`).length) {
      $(`#rc-cycle-${cycleId}`).show()
    } else {
      var cycle = $('<div>').addClass('rc-cycle').attr('id', `rc-cycle-${cycleId}`).appendTo(cycleContainer)
      var userId = Compass.organisationUserId
      renderStaffBlock(cycle, userId, selectCycle.children('option:selected').text(), cycleId)

      if (Compass.organisationUserRoles.ReportsAdmin) {
        $('<button>').addClass('rc-load-all').html('👥 Load All Staff').click(function() {
          cycle.empty()
          getStaff(cycleId).done((users) => loadStaff(users, cycleId, cycle))
          $(this).remove()
        }).appendTo(cycle)
      }
    }
  }

  function renderStaffBlock(container, userId, name, cycleId) {
    var block = $('<div>').addClass('rc-staff-block open').appendTo(container)

    // Header
    var hdr = $('<div>').addClass('rc-staff-header').appendTo(block)
    $('<span>').addClass('rc-staff-chevron').text('▶').appendTo(hdr)
    $('<div>').addClass('rc-staff-name').text(name).appendTo(hdr)
    var statusPill = $('<div>').addClass('rc-staff-pill loading').text('Loading…').appendTo(hdr)
    var progressBar = $('<div>').addClass('rc-progress-bar').appendTo(block)
    var progressFill = $('<div>').addClass('rc-progress-fill').appendTo(progressBar)

    // Email button (always visible for admins)
    if (Compass.organisationUserRoles.ReportsAdmin) {
      $('<div>').addClass('rc-email-btn').text('✉ Email').click(function(e) {
        e.stopPropagation()
        getUser(userId).done((user) => emailUser(user, userId, cycleId))
      }).appendTo(hdr)
    }

    hdr.click(function() { block.toggleClass('open') })

    var staffBody = $('<div>').addClass('rc-staff-body').appendTo(block)

    getActivities(cycleId, userId).done(function(data) {
      loadActivities(data, userId, cycleId, staffBody, statusPill, progressFill)
    })

    return block
  }

  // ── Staff ─────────────────────────────────────────────────────────────────
  function getStaff(cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportsStaff", {
      data: JSON.stringify({ cycleId: cycleId }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadStaff(users, cycleId, container) {
    users.d.sort(function(a, b) { return a.ln.localeCompare(b.ln) || a.fn.localeCompare(b.fn) })
    $.each(users.d, function() {
      renderStaffBlock(container, this.id, this.n, cycleId)
    })
  }

  function getUser(userId) {
    return $.ajax("/Services/User.svc/GetUserDetailsBlobByUserId", {
      data: JSON.stringify({ targetUserId: userId, targetSchoolId: Compass.schoolId, page: 1, start: 0, limit: 25 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function emailUser(user, userId, cycleId) {
    var subject = 'Please check the following reports (or mark Excluded)'
    var body = []
    $(`#rc-cycle-${cycleId} .rc-staff-block`).each(function() {
      // Find by matching data attribute
    })
    // Collect issues from the staff block
    var issues = []
    $(`#rc-cycle-${cycleId}`).find('.rc-issue-item').each(function() {
      issues.push($(this).text().trim())
    })
    if (issues.length) {
      var bodyStr = issues.join('%0a')
      window.location.href = `mailto:${user.d.userEmail}?subject=${encodeURIComponent(subject)}&body=${bodyStr}`
    } else {
      alert(user.d.userDisplayName + " has no outstanding issues.")
    }
  }

  // ── Activities ────────────────────────────────────────────────────────────
  function getActivities(cycleId, userId) {
    return $.ajax("/Services/Reports.svc/GetOpenCycleActivitiesByUserId", {
      data: JSON.stringify({ cycleId: cycleId, userId: userId }),
      contentType: 'application/json', type: 'POST'
    })
  }

  function loadActivities(data, userId, cycleId, staffBody, statusPill, progressFill) {
    var total = data.d.length
    var count = 0
    var hasError = false, hasWarning = false

    var filtered = data.d.filter(function(a) {
      return !(a.subjectName == "Advisory" || a.subjectName == "YDuties" || a.subjectName == "YDBUS")
    })
    total = filtered.length

    if (total === 0) {
      $('<div>').addClass('rc-empty').text('No classes found for this cycle.').appendTo(staffBody)
      statusPill.removeClass('loading').addClass('complete').text('No classes')
      return
    }

    $.each(filtered, function() {
      var entityId     = this.id
      var activityId   = this.activityId
      var subjectName  = this.subjectName
      var activityName = this.activityName

      stats.total++
      updateStats()

      var actDiv = $('<div>').addClass('rc-activity').appendTo(staffBody)
      var actHdr = $('<div>').addClass('rc-activity-header').click(function() {
        actDiv.toggleClass('open')
      }).appendTo(actDiv)

      var statusDot = $('<div>').addClass('rc-activity-status dot-blue').appendTo(actHdr)
      $('<div>').addClass('rc-activity-name').html(
        `<a href="/Organise/Activities/Activity.aspx#activity/${activityId}" target="_blank">${activityName}</a>` +
        `<span style="color:#9ca3af;font-weight:400;"> — ${subjectName}</span>`
      ).appendTo(actHdr)

      var katsDiv    = $('<div>').addClass('rc-kats').appendTo(actHdr)
      var elemDiv    = $('<div>').appendTo(actHdr)

      var actBody    = $('<div>').addClass('rc-activity-body').appendTo(actDiv)
      var issueGroup = $('<div>').addClass('rc-issue-group').hide().appendTo(actBody)
      var issueHdr   = $('<div>').addClass('rc-issue-group-header').appendTo(issueGroup)
      $('<span>').text('Issues').appendTo(issueHdr)
      var issueBadge = $('<span>').text('0').appendTo(issueHdr)
      var issueList  = $('<div>').appendTo(issueGroup)

      var excend     = $('<div>').addClass('rc-excend').appendTo(actBody)
      var excHdr     = $('<div>').addClass('rc-excend-header').click(function() {
        excend.toggleClass('open')
      }).appendTo(excend)
      $('<span>').text('Excellence & Endeavour').appendTo(excHdr)
      $('<span>').text('▶').css({ fontSize: '10px', transition: 'transform 0.15s' }).appendTo(excHdr)
      var excBody    = $('<div>').addClass('rc-excend-body').appendTo(excend)

      function addIssue(text, severity) {
        issueGroup.show()
        actDiv.addClass('open')
        var dotClass = severity === 'error' ? 'dot-red' : severity === 'warning' ? 'dot-amber' : 'dot-blue'
        var row = $('<div>').addClass('rc-issue-item').appendTo(issueList)
        $('<div>').addClass('rc-issue-dot ' + dotClass).appendTo(row)
        $('<div>').text(text).appendTo(row)
        var n = parseInt(issueBadge.text()) + 1
        issueBadge.text(n)
        issueHdr.find('span:first').text(`Issues (${n})`)
        if (severity === 'error') {
          statusDot.removeClass('dot-blue dot-amber').addClass('dot-red')
          hasError = true
        } else if (severity === 'warning' && !statusDot.hasClass('dot-red')) {
          statusDot.removeClass('dot-blue').addClass('dot-amber')
          hasWarning = true
        }
      }

      $.when(getReports(entityId, cycleId), getTasks(activityId), getEnrolments(activityId))
        .done(function(results, tasks, enrolments) {
          var classlist = loadEnrolments(enrolments[0])
          loadTasks(tasks[0], cycleId, subjectName, activityName, katsDiv, addIssue)
          loadReports(results[0], activityId, cycleId, elemDiv, addIssue, excBody)
        }).done(function() {
          count++
          progressFill.css('width', (count / total * 100) + '%')

          // Update activity status dot if no issues
          if (!statusDot.hasClass('dot-red') && !statusDot.hasClass('dot-amber')) {
            statusDot.removeClass('dot-blue').addClass('dot-green')
          }

          // Update stats
          if (statusDot.hasClass('dot-red')) {
            stats.error++
          } else if (statusDot.hasClass('dot-amber')) {
            stats.warning++
          } else {
            stats.complete++
          }
          updateStats()

          // Update staff pill when all done
          if (count === total) {
            progressFill.css('width', '100%')
            if (hasError) {
              statusPill.removeClass('loading warning complete').addClass('error').text(`${stats.error} Error${stats.error !== 1 ? 's' : ''}`)
            } else if (hasWarning) {
              statusPill.removeClass('loading error complete').addClass('warning').text(`Warnings`)
            } else {
              statusPill.removeClass('loading error warning').addClass('complete').text('Complete ✓')
            }
          }
        })
    })
  }

  // ── GPA ───────────────────────────────────────────────────────────────────
  function getGPA(entityId, cycleId) {
    return $.ajax("/Services/Gpa.svc/GetResultsByCycleAndActivity", {
      data: JSON.stringify({ cycleId: cycleId, entityId: entityId, editing: false }),
      contentType: 'application/json', type: 'POST'
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
    } catch { return false }
  }

  // ── Enrolments ────────────────────────────────────────────────────────────
  function getEnrolments(activityId) {
    return $.ajax("/Services/Activity.svc/GetEnrolmentsByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 100 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadEnrolments(results) { return results.d.map(s => s.uid) }

  // ── Reports ───────────────────────────────────────────────────────────────
  function getReports(entityId, cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportReviewerBlob", {
      data: JSON.stringify({ entityType: 1, entityId: entityId, cycleId: cycleId }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadReports(results, activityId, cycleId, elemDiv, addIssue, excBody) {
    var elemPill = $('<div>').addClass('rc-element-pill complete').text('Complete').appendTo(elemDiv)
    var GPAcycleId = $(`#dash select option[value="${cycleId}"]`).attr("data-progress")

    getGPA(activityId, GPAcycleId).always(function(gpas) {
      $.each(results.d.entities, function() {
        var studentName = this.name
        var row = $('<div>').addClass('rc-excend-row').appendTo(excBody)
        $('<div>').addClass('rc-excend-name').text(studentName).appendTo(row)
        var gp = [], ex = [], en = true

        $.each(this.results, function() {
          if (this.name == "Overall Assessment" || this.name == "Performance" || this.name == "Grading: Achievement") {
            var abbr = (this.displayValue.match(/\b([A-Z])/g) || [this.displayValue]).join('')
            $('<div>').text(abbr).attr('title', this.displayValue).css({ fontSize: '11px', color: '#6b7280' }).appendTo(row)
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
            addIssue(`${studentName} — ${this.name} is missing`, 'error')
            elemPill.removeClass('complete').addClass('error').text('Incomplete')
          }
        })

        gp = gp.length ? gp : loadGPA(gpas, this.id)
        var gpa = gp.length ? (gp.reduce((a, b) => a + b) / gp.length).toFixed(2) : "NA"
        $('<div>').text(`GPA ${gpa}`).css({ fontSize: '11px', color: '#6b7280' }).appendTo(row)

        if (gpa >= 3.75 && en) {
          var award = (!ex.includes(false) && ex.length) ? "Excellence" : "Endeavour"
          $('<div>').addClass('rc-excend-award complete').text(award).appendTo(row)
        } else {
          $('<div>').appendTo(row)
        }
      })
    })
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  function getTasks(activityId) {
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 2000 }),
      contentType: 'application/json', type: 'POST'
    })
  }

  function loadTasks(tasks, cycleId, subjectName, activityName, katsDiv, addIssue) {
    var katCount = 0

    $.each(tasks.d.data, function() {
      var task = this
      if (!(task.semesterReportCycles && task.semesterReportCycles.some(
        t => t.includeInSemesterReports === true && t.reportCycleId == cycleId
      ))) return

      katCount++
      var kat = $('<div>').addClass('rc-kat').text(`Task ${katCount}`).attr('title', task.name).appendTo(katsDiv)

      // ── NEW: Check if task is assigned to a Subject instead of a Class ──
      // activityId on the task should match a class (activity), not a subject
      // Compass stores subject-level tasks with activityType or no activityId
      if (task.activityType && task.activityType !== 1) {
        addIssue(`Task ${katCount}: '${task.name}' is assigned to a Subject, not a Class — open the Learning Task and reassign it to the specific class`, 'error')
        kat.addClass('error')
      }

      if (!task.taskReportDescription) {
        addIssue(`Task ${katCount}: no description — edit Learning Task > Reporting > Task Summary Description`, 'error')
        kat.addClass('error')
      }
      if (task.gradingItems && task.gradingItems.filter(g => g.includeInSemesterReport === true).length < 1) {
        addIssue(`Task ${katCount}: grading components disabled — edit Learning Task > Reporting and tick Components`, 'error')
        kat.addClass('error')
      }
      $.each(task.students, function() {
        if (!this.results.length) {
          addIssue(`Task ${katCount}: results missing for ${this.userName}`, 'error')
          kat.addClass('error')
        }
      })
      if (task.taskReportDescription && task.taskReportDescription.includes("\n\n")) {
        addIssue(`Task ${katCount}: extra blank line in description — edit Learning Task > Reporting > Task Summary Description`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (!(task.name.startsWith("Key Assessment Task") || task.name.startsWith("Unit") || task.name.startsWith("Exam") || task.name.startsWith("SAC") || task.name.startsWith("Semester") || task.name.startsWith("Structured"))) {
        addIssue(`Task ${katCount}: '${task.name}' does not follow naming format — edit Learning Task > Name`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (!(task.taskTitleOnReport.startsWith("Key Assessment Task") || task.taskTitleOnReport.startsWith("Unit") || task.taskTitleOnReport.startsWith("Exam") || task.taskTitleOnReport.startsWith("SAC") || task.taskTitleOnReport.startsWith("Semester") || task.taskTitleOnReport.startsWith("Structured"))) {
        addIssue(`Task ${katCount}: title on report '${task.taskTitleOnReport}' does not follow naming format — edit Learning Task > Reporting > Title on Report`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (task.includeInOverall) {
        addIssue(`Task ${katCount}: is emphasised — edit Learning Task > Reporting and untick Emphasise in Task Summary`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (task.showTaskDueDates) {
        addIssue(`Task ${katCount}: shows due date on report — edit Learning Task > Reporting and untick Display Task Due Dates`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (task.securityOptions && task.securityOptions.filter(g => g.gradingVisible === false).length) {
        addIssue(`Task ${katCount}: grading not visible — edit Learning Task > Basic and tick Grading Visible`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (task.name.includes(" : ") || task.taskTitleOnReport.includes(" : ")) {
        addIssue(`Task ${katCount}: space before colon in name — edit Learning Task and fix`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
      if (!task.dueDateTimestamp) {
        addIssue(`Task ${katCount}: '${task.name}' has no due date — edit Learning Task and add Due Date`, 'warning')
        if (!kat.hasClass('error')) kat.addClass('warning')
      }
    })

    // ── Minimum task count ────────────────────────────────────────────────
    var minTasks = getMinTasks(subjectName, activityName)
    var yr       = detectYearLevel(subjectName, activityName)
    if (katCount < minTasks) {
      var context = (yr === 7 || yr === 8)
        ? `Year ${yr} non-core subject — minimum is ${minTasks} tasks`
        : `minimum is ${minTasks} tasks`
      addIssue(
        `Only ${katCount} task${katCount !== 1 ? 's' : ''} found (${context}) — edit Learning Tasks > Reporting and check Semester Report Cycles are added`,
        'warning'
      )
    }
  }

})
