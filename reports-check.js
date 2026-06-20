$(document).ready(function() {

  if (!window.single) {
    window.single = true
  } else {
    return
  }

  if ($('body #dash').length) {
    $('body #dash').remove()
  }

  // ── AEU state ──────────────────────────────────────────────────────────
  var aeuActive = false
  var AEU_EXEMPT_FIELDS = ['teacher comments', 'areas for improvement']

  function isAeuExempt(fieldName) {
    if (!aeuActive) return false
    return AEU_EXEMPT_FIELDS.some(function(f) {
      return fieldName.toLowerCase().includes(f)
    })
  }

  // ── Progress Report CSV (master GPA source) ──────────────────────────────
  // Hosted at the same repo as this script. Auto-fetched once per session.
  // Used instead of the live Gpa.svc API, which is currently unreliable.
  var CSV_URL = 'https://crusoeapps.github.io/compassaddons/Progress_Report_-_Term_Two_2026.csv'
  var csvGpaLookup = {}     // key: "name|subject" -> gpa float
  var csvLoaded = false
  var csvLoadFailed = false

  function parseCsvLine(line) {
    var result = []
    var cur = ''
    var inQuotes = false
    for (var i = 0; i < line.length; i++) {
      var ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur)
    return result
  }

  function loadProgressCsv() {
    return $.get(CSV_URL).done(function(text) {
      var lines = text.split(/\r?\n/).filter(function(l) { return l.trim().length })
      var headers = parseCsvLine(lines[0]).map(function(h) { return h.trim() })
      var idxId      = headers.indexOf('Id')
      var idxSubject = headers.indexOf('Subject')
      var idxOverall = headers.indexOf('Overall')

      for (var i = 1; i < lines.length; i++) {
        var cols = parseCsvLine(lines[i])
        var id      = (cols[idxId]      || '').trim()
        var subject = (cols[idxSubject] || '').trim()
        var overall = (cols[idxOverall] || '').trim()
        if (!id || !subject || !overall) continue
        var key = id.toLowerCase() + '|' + subject.toLowerCase()
        csvGpaLookup[key] = parseFloat(overall)
      }
      csvLoaded = true
    }).fail(function() {
      csvLoadFailed = true
    })
  }

  function getCsvGpa(studentId, subjectCode) {
    var key = studentId.toLowerCase() + '|' + subjectCode.toLowerCase()
    return csvGpaLookup.hasOwnProperty(key) ? csvGpaLookup[key] : null
  }

  // ── Year level & minimum task logic ──────────────────────────────────────
  var HIGH_TASK_SUBJECTS = ['English', 'Mathematics']
  var CORE_SUBJECTS      = ['English', 'Mathematics', 'Humanities', 'Science', 'Physical Education']

  function detectYearLevel(subjectName, activityName) {
    var subjectMatch = subjectName.match(/^Year\s+([78])\b/i)
    if (subjectMatch) return parseInt(subjectMatch[1])
    var activityMatch = activityName.match(/^([78])[A-Z]/i)
    if (activityMatch) return parseInt(activityMatch[1])
    return null
  }

  function getMinTasks(subjectName, activityName) {
    var yr = detectYearLevel(subjectName, activityName)
    if (yr !== 7 && yr !== 8) return 3
    var isHighTask = HIGH_TASK_SUBJECTS.some(function(s) {
      return subjectName.toLowerCase().includes(s.toLowerCase())
    })
    if (isHighTask) return 4
    var isCore = CORE_SUBJECTS.some(function(core) {
      return subjectName.toLowerCase().includes(core.toLowerCase())
    })
    return isCore ? 3 : 2
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  $(`<div id="dash"><style>
    #dash * { box-sizing: border-box; margin: 0; padding: 0; }
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
      color: #1a1d23;
    }

    #dash .rc-topbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 20px;
      height: 52px;
      background: white;
      border-bottom: 1px solid #e2e5ea;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    #dash .rc-topbar h1 { font-size: 15px; font-weight: 600; white-space: nowrap; }
    #dash .rc-divider { width: 1px; height: 18px; background: #e2e5ea; flex-shrink: 0; }
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

    #dash .rc-aeu {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      font-size: 12px;
      font-weight: 500;
      color: #92400e;
      transition: background 0.15s;
    }
    #dash .rc-aeu:hover { background: #fde68a; }
    #dash .rc-aeu.active { background: #d97706; border-color: #b45309; color: white; }
    #dash .rc-aeu input[type=checkbox] { width: 14px; height: 14px; accent-color: #d97706; cursor: pointer; }

    #dash .rc-spacer { flex: 1; }
    #dash .rc-topbar-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
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
    #dash .rc-topbar-btn.primary { background: #0057d9; color: white; border-color: #0057d9; }
    #dash .rc-topbar-btn.primary:hover { background: #004ab5; }
    #dash .rc-topbar-btn.close-btn { background: #1a1d23; color: white; border-color: #1a1d23; }
    #dash .rc-topbar-btn.close-btn:hover { background: #374151; }

    #dash .rc-body { flex: 1; overflow-y: auto; padding: 16px 20px 40px; }

    #dash .rc-stats { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    #dash .rc-stat {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e2e5ea; border-radius: 8px;
      padding: 7px 13px; font-size: 12px; font-weight: 500; color: #6b7280;
    }
    #dash .rc-stat strong { font-size: 15px; font-weight: 700; color: #1a1d23; }
    #dash .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    #dash .dot-green  { background: #16a34a; }
    #dash .dot-amber  { background: #d97706; }
    #dash .dot-red    { background: #dc2626; }
    #dash .dot-blue   { background: #0057d9; }

    #dash .rc-allclear {
      display: none;
      align-items: flex-start;
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-left: 4px solid #16a34a;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #15803d;
      line-height: 1.6;
    }
    #dash .rc-allclear strong { font-weight: 600; display: block; margin-bottom: 2px; }

    #dash .rc-rule-note {
      font-size: 11.5px;
      color: #374151;
      background: #e8f0fe;
      border: 1px solid #c7d9fb;
      border-radius: 6px;
      padding: 7px 12px;
      margin-bottom: 12px;
      line-height: 1.6;
    }

    #dash .rc-staff-block {
      background: white;
      border: 1px solid #e2e5ea;
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    #dash .rc-staff-header {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px;
      background: #fafbfc;
      border-bottom: 1px solid #e2e5ea;
      cursor: pointer;
      user-select: none;
    }
    #dash .rc-staff-header:hover { background: #f3f4f6; }
    #dash .rc-chevron { font-size: 9px; color: #9ca3af; transition: transform 0.15s; flex-shrink: 0; }
    #dash .rc-staff-block.open .rc-staff-header .rc-chevron { transform: rotate(90deg); }
    #dash .rc-staff-name { font-weight: 600; font-size: 13px; flex: 1; }
    #dash .rc-staff-pill {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
    }
    #dash .rc-staff-pill.complete { background: #dcfce7; color: #15803d; }
    #dash .rc-staff-pill.warning  { background: #fef3c7; color: #92400e; }
    #dash .rc-staff-pill.error    { background: #fee2e2; color: #991b1b; }
    #dash .rc-staff-pill.loading  { background: #f3f4f6; color: #6b7280; }
    #dash .rc-email-btn {
      font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 5px;
      border: 1px solid #c7d9fb; background: #e8f0fe; color: #0057d9; cursor: pointer; white-space: nowrap;
    }
    #dash .rc-email-btn:hover { background: #d1e3fc; }
    #dash .rc-staff-body { display: none; }
    #dash .rc-staff-block.open .rc-staff-body { display: block; }
    #dash .rc-progress-bar { height: 2px; background: #f0f2f5; }
    #dash .rc-progress-fill { height: 100%; background: #0057d9; width: 0%; transition: width 0.3s ease; }

    #dash .rc-activity { border-bottom: 1px solid #f3f4f6; }
    #dash .rc-activity:last-child { border-bottom: none; }
    #dash .rc-activity-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px 8px 26px; cursor: pointer; transition: background 0.1s;
    }
    #dash .rc-activity-header:hover { background: #f9fafb; }
    #dash .rc-act-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    #dash .rc-act-name { flex: 1; font-size: 12.5px; }
    #dash .rc-act-name a { color: #0057d9; text-decoration: none; font-weight: 500; }
    #dash .rc-act-name a:hover { text-decoration: underline; }
    #dash .rc-act-name .rc-act-subject { color: #9ca3af; font-weight: 400; }

    #dash .rc-kats { display: flex; gap: 4px; flex-wrap: wrap; }
    #dash .rc-kat {
      font-size: 10.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
      background: #dcfce7; color: #15803d; white-space: nowrap; cursor: default;
    }
    #dash .rc-kat.warning { background: #fef3c7; color: #92400e; }
    #dash .rc-kat.error   { background: #fee2e2; color: #991b1b; }
    #dash .rc-elem-pill {
      font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
    }
    #dash .rc-elem-pill.complete { background: #dcfce7; color: #15803d; }
    #dash .rc-elem-pill.error    { background: #fee2e2; color: #991b1b; }

    #dash .rc-activity-body { display: none; padding: 0 14px 12px 26px; }
    #dash .rc-activity.open .rc-activity-body { display: block; }

    #dash .rc-issue-groups { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    #dash .rc-issue-group { border: 1px solid #e2e5ea; border-radius: 8px; overflow: hidden; }
    #dash .rc-issue-group-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 12px; cursor: pointer; user-select: none; font-size: 12px; font-weight: 600;
    }
    #dash .rc-issue-group.group-setup .rc-issue-group-header {
      background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1d40ae;
    }
    #dash .rc-issue-group.group-results .rc-issue-group-header {
      background: #fff7ed; border-bottom: 1px solid #fed7aa; color: #9a3412;
    }
    #dash .rc-group-badge { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; }
    #dash .group-setup .rc-group-badge   { background: #dbeafe; color: #1d40ae; }
    #dash .group-results .rc-group-badge { background: #fed7aa; color: #9a3412; }
    #dash .rc-issue-group-body { display: none; }
    #dash .rc-issue-group.open .rc-issue-group-body { display: block; }
    #dash .rc-issue-item {
      display: flex; align-items: flex-start; gap: 8px; padding: 6px 12px;
      border-bottom: 1px solid #f9fafb; font-size: 12px; color: #374151; line-height: 1.5;
    }
    #dash .rc-issue-item:last-child { border-bottom: none; }
    #dash .rc-issue-sev {
      font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
      flex-shrink: 0; margin-top: 2px; text-transform: uppercase;
    }
    #dash .rc-issue-sev.error   { background: #fee2e2; color: #991b1b; }
    #dash .rc-issue-sev.warning { background: #fef3c7; color: #92400e; }
    #dash .rc-issue-sev.info    { background: #f3f4f6; color: #6b7280; }

    #dash .rc-excend { border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden; margin-top: 8px; }
    #dash .rc-excend-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 12px; background: #f0fdf4; font-size: 12px; font-weight: 600; color: #15803d; cursor: pointer;
    }
    #dash .rc-excend-body { display: none; }
    #dash .rc-excend.open .rc-excend-body { display: block; }
    #dash .rc-excend-row {
      display: flex; align-items: center; gap: 8px; padding: 5px 12px;
      border-bottom: 1px solid #f0fdf4; font-size: 11.5px;
    }
    #dash .rc-excend-row:last-child { border-bottom: none; }
    #dash .rc-excend-name { width: 28%; font-weight: 500; flex-shrink: 0; }
    #dash .rc-excend-award {
      margin-left: auto; font-size: 11px; font-weight: 600; padding: 2px 7px;
      border-radius: 20px; background: #dcfce7; color: #15803d;
    }

    #dash .rc-load-all {
      display: inline-flex; align-items: center; gap: 6px; margin: 10px 0;
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;
      cursor: pointer; background: #0057d9; color: white; border: none;
    }
    #dash .rc-load-all:hover { background: #004ab5; }

    @media print {
      body > *:not(#dash) { display: none !important; }
      #dash { position: static !important; overflow: visible !important; height: auto !important; }
      #dash .rc-topbar-btn { display: none !important; }
      #dash .rc-staff-body,
      #dash .rc-activity-body,
      #dash .rc-issue-group-body,
      #dash .rc-excend-body { display: block !important; }
    }
  </style></div>`).appendTo('body')

  // ── Stat counters ─────────────────────────────────────────────────────────
  var stats = { complete: 0, warning: 0, error: 0, total: 0 }

  function updateStats() {
    $('#rc-stat-complete strong').text(stats.complete)
    $('#rc-stat-warning strong').text(stats.warning)
    $('#rc-stat-error strong').text(stats.error)
    $('#rc-stat-total strong').text(stats.total)
    if (stats.total > 0 && stats.complete === stats.total) {
      $('#rc-allclear').css('display', 'flex')
    } else {
      $('#rc-allclear').css('display', 'none')
    }
  }

  // ── Top bar ───────────────────────────────────────────────────────────────
  var topbar = $('<div>').addClass('rc-topbar').appendTo('#dash')
  $('<h1>').text('Reports Check 2.0').appendTo(topbar)
  $('<div>').addClass('rc-divider').appendTo(topbar)
  var selectCycle = $('<select>').addClass('rc-cycle-select').change(loadCycle).appendTo(topbar)
  $('<div>').addClass('rc-divider').appendTo(topbar)

  var aeuLabel = $('<label>').addClass('rc-aeu').appendTo(topbar)
  var aeuCheck = $('<input>').attr('type', 'checkbox').appendTo(aeuLabel)
  aeuLabel.append(' ⚡ AEU Industrial Action')
  aeuCheck.on('change', function() {
    aeuActive = this.checked
    aeuLabel.toggleClass('active', aeuActive)
    $('.rc-activity').each(function() {
      var rerender = $(this).data('rerender')
      if (rerender) rerender()
    })
  })

  $('<div>').addClass('rc-spacer').appendTo(topbar)

  var csvStatus = $('<div>').addClass('rc-topbar-btn').css({ cursor: 'default', color: '#9ca3af' }).text('Loading GPA data…').appendTo(topbar)
  loadProgressCsv().always(function() {
    if (csvLoadFailed) {
      csvStatus.text('⚠ GPA CSV failed to load').css({ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' })
    } else {
      csvStatus.text('✓ GPA data loaded (' + Object.keys(csvGpaLookup).length + ' records)').css({ background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' })
    }
  })

  if (Compass.organisationUserRoles.ReportsAdmin) {
    $('<div>').addClass('rc-topbar-btn').text('Expand all').click(function() {
      var isExpand = $(this).text() === 'Expand all'
      $(this).text(isExpand ? 'Collapse all' : 'Expand all')
      if (isExpand) {
        $('.rc-staff-block').addClass('open')
        $('.rc-activity').addClass('open')
        $('.rc-issue-group').addClass('open')
      } else {
        $('.rc-staff-block').removeClass('open')
        $('.rc-activity').removeClass('open')
      }
    }).appendTo(topbar)
  }

  $('<div>').addClass('rc-topbar-btn primary').html('🖨 Print').click(function() {
    window.print()
  }).appendTo(topbar)

  $('<div>').addClass('rc-topbar-btn close-btn').text('✕ Close').click(function() {
    window.single = false
    $('#dash').remove()
  }).appendTo(topbar)

  // ── Body ──────────────────────────────────────────────────────────────────
  var body = $('<div>').addClass('rc-body').appendTo('#dash')

  var statsBar = $('<div>').addClass('rc-stats').appendTo(body)
  statsBar.append('<div class="rc-stat" id="rc-stat-total"><div class="dot dot-blue"></div><strong>0</strong>&nbsp;Classes</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-complete"><div class="dot dot-green"></div><strong>0</strong>&nbsp;Complete</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-warning"><div class="dot dot-amber"></div><strong>0</strong>&nbsp;Warnings</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-error"><div class="dot dot-red"></div><strong>0</strong>&nbsp;Errors</div>')

  $('<div>').attr('id', 'rc-allclear').addClass('rc-allclear').html(
    '<span style="font-size:20px;flex-shrink:0">✅</span>' +
    '<div><strong>Reports Check 2.0 has no detectable errors.</strong>' +
    'Please download a report from each class in Compass and check the report looks how it should. ' +
    'Completed reports still require proofreading before publishing.</div>'
  ).appendTo(body)

  $('<div>').addClass('rc-rule-note').html(
    '📋 <strong>Task minimums:</strong> Yr 7/8 English &amp; Mathematics = min <strong>4</strong> tasks. ' +
    'Yr 7/8 other core subjects (Humanities, Science, Physical Education) = min <strong>3</strong> tasks. ' +
    'Yr 7/8 non-core subjects = min <strong>2</strong> tasks. Yr 9+ = min <strong>3</strong> tasks. ' +
    '&nbsp;|&nbsp; ⚠️ Tasks must be assigned to <strong>Subjects</strong>, not Classes.'
  ).appendTo(body)

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
      renderStaffBlock(cycle, Compass.organisationUserId, selectCycle.children('option:selected').text(), cycleId)
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
    var hdr = $('<div>').addClass('rc-staff-header').appendTo(block)
    $('<span>').addClass('rc-chevron').text('▶').appendTo(hdr)
    $('<div>').addClass('rc-staff-name').text(name).appendTo(hdr)
    var pill = $('<div>').addClass('rc-staff-pill loading').text('Loading…').appendTo(hdr)
    if (Compass.organisationUserRoles.ReportsAdmin) {
      $('<div>').addClass('rc-email-btn').text('✉ Email').click(function(e) {
        e.stopPropagation()
        getUser(userId).done((u) => emailUser(u, cycleId))
      }).appendTo(hdr)
    }
    hdr.click(function() { block.toggleClass('open') })
    var pb = $('<div>').addClass('rc-progress-bar').appendTo(block)
    var pf = $('<div>').addClass('rc-progress-fill').appendTo(pb)
    var staffBody = $('<div>').addClass('rc-staff-body').appendTo(block)
    getActivities(cycleId, userId).done(function(data) {
      loadActivities(data, userId, cycleId, staffBody, pill, pf)
    })
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
    $.each(users.d, function() { renderStaffBlock(container, this.id, this.n, cycleId) })
  }
  function getUser(userId) {
    return $.ajax("/Services/User.svc/GetUserDetailsBlobByUserId", {
      data: JSON.stringify({ targetUserId: userId, targetSchoolId: Compass.schoolId, page: 1, start: 0, limit: 25 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function emailUser(user, cycleId) {
    var subject = 'Reports Check — please action the following issues'
    var lines = []
    $(`#rc-cycle-${cycleId} .rc-issue-item`).each(function() {
      lines.push($(this).find('div:last').text().trim())
    })
    if (lines.length) {
      window.location.href = `mailto:${user.d.userEmail}?subject=${encodeURIComponent(subject)}&body=${lines.join('%0a')}`
    } else {
      alert((user.d.userDisplayName || 'This staff member') + ' has no outstanding issues.')
    }
  }

  // ── Activities ────────────────────────────────────────────────────────────
  function getActivities(cycleId, userId) {
    return $.ajax("/Services/Reports.svc/GetOpenCycleActivitiesByUserId", {
      data: JSON.stringify({ cycleId: cycleId, userId: userId }),
      contentType: 'application/json', type: 'POST'
    })
  }

  function loadActivities(data, userId, cycleId, staffBody, pill, pf) {
    var filtered = data.d.filter(function(a) {
      return !(a.subjectName === "Advisory" || a.subjectName === "YDuties" || a.subjectName === "YDBUS")
    })
    var total = filtered.length, count = 0
    var hasError = false, hasWarning = false

    if (total === 0) {
      $('<div>').css({ padding: '12px 14px', fontSize: '12px', color: '#9ca3af' }).text('No classes found for this cycle.').appendTo(staffBody)
      pill.removeClass('loading').addClass('complete').text('No classes')
      return
    }

    $.each(filtered, function() {
      var entityId    = this.id
      var activityId  = this.activityId
      var subjectName = this.subjectName
      var actName     = this.activityName

      stats.total++
      updateStats()

      var actDiv = $('<div>').addClass('rc-activity').appendTo(staffBody)
      var actHdr = $('<div>').addClass('rc-activity-header').click(function() {
        actDiv.toggleClass('open')
      }).appendTo(actDiv)

      var dot = $('<div>').addClass('rc-act-status-dot dot-blue').appendTo(actHdr)
      $('<div>').addClass('rc-act-name').html(
        `<a href="/Organise/Activities/Activity.aspx#activity/${activityId}" target="_blank">${actName}</a>` +
        ` <span class="rc-act-subject">— ${subjectName}</span>`
      ).appendTo(actHdr)
      var katsDiv  = $('<div>').addClass('rc-kats').appendTo(actHdr)
      var elemDiv  = $('<div>').appendTo(actHdr)

      var actBody  = $('<div>').addClass('rc-activity-body').appendTo(actDiv)
      var issueGrps = $('<div>').addClass('rc-issue-groups').appendTo(actBody)

      function makeGroup(id, type, label) {
        var grp = $('<div>').addClass(`rc-issue-group group-${type}`).attr('id', id).appendTo(issueGrps)
        var ghdr = $('<div>').addClass('rc-issue-group-header').click(function() {
          grp.toggleClass('open')
        }).appendTo(grp)
        $('<span>').text(label).appendTo(ghdr)
        var badge = $('<span>').addClass('rc-group-badge').text('0').appendTo(ghdr)
        var gbody = $('<div>').addClass('rc-issue-group-body').appendTo(grp)
        return {
          grp: grp, badge: badge, body: gbody, count: 0,
          add: function(text, sev) {
            this.count++
            badge.text(this.count)
            grp.addClass('open')
            var row = $('<div>').addClass('rc-issue-item').appendTo(gbody)
            $('<span>').addClass(`rc-issue-sev ${sev}`).text(sev).appendTo(row)
            $('<div>').text(text).appendTo(row)
          }
        }
      }

      var setupGroup   = makeGroup(`grp-setup-${entityId}`,   'setup',   'Setup Issues')
      var resultsGroup = makeGroup(`grp-results-${entityId}`, 'results', 'Task Results Missing')

      function markSeverity(sev) {
        if (sev === 'error') {
          dot.removeClass('dot-blue dot-amber').addClass('dot-red')
          hasError = true
        } else if (sev === 'warning' && !dot.hasClass('dot-red')) {
          dot.removeClass('dot-blue').addClass('dot-amber')
          hasWarning = true
        }
      }

      var storedTaskData, storedReportData, storedEnrolments, storedExcBody

      function renderIssues() {
        setupGroup.body.empty(); setupGroup.count = 0; setupGroup.badge.text('0')
        resultsGroup.body.empty(); resultsGroup.count = 0; resultsGroup.badge.text('0')
        dot.removeClass('dot-red dot-amber').addClass('dot-blue')
        katsDiv.empty(); elemDiv.empty()

        if (storedTaskData)   processTaskIssues(storedTaskData, storedEnrolments)
        if (storedReportData) processReportIssues(storedReportData)

        if (!dot.hasClass('dot-red') && !dot.hasClass('dot-amber')) {
          dot.removeClass('dot-blue').addClass('dot-green')
        }
        setupGroup.count === 0   ? setupGroup.grp.hide()   : setupGroup.grp.show()
        resultsGroup.count === 0 ? resultsGroup.grp.hide() : resultsGroup.grp.show()
      }

      actDiv.data('rerender', renderIssues)

      function processTaskIssues(tasks, classlist) {
        var katCount = 0
        $.each(tasks.d.data, function() {
          var t = this
          if (!(t.semesterReportCycles && t.semesterReportCycles.some(
            function(s) { return s.includeInSemesterReports === true && s.reportCycleId == cycleId }
          ))) return

          katCount++
          var kat = $('<div>').addClass('rc-kat').text(`Task ${katCount}`).attr('title', t.name).appendTo(katsDiv)

          function setupErr(msg)  { setupGroup.add(msg, 'error');   if (!kat.hasClass('error')) kat.addClass('error'); markSeverity('error') }
          function setupWarn(msg) { setupGroup.add(msg, 'warning'); if (!kat.hasClass('error') && !kat.hasClass('warning')) kat.addClass('warning'); markSeverity('warning') }
          function setupInfo(msg) { setupGroup.add(msg, 'info') }

          if (t.activityType && t.activityType !== 1) {
            setupErr(`Task ${katCount} '${t.name}': assigned to a Class not a Subject — open the Learning Task and reassign it to the Subject`)
          }
          if (!t.semesterReportCycles || !t.semesterReportCycles.length) {
            setupErr(`Task ${katCount} '${t.name}': not linked to a reporting cycle — edit Learning Task > Reporting and add Semester Report Cycle`)
          }
          if (!t.taskReportDescription) {
            setupErr(`Task ${katCount} '${t.name}': no description — edit Learning Task > Reporting > Task Summary Description`)
          }
          if (t.gradingItems && t.gradingItems.filter(function(g) { return g.includeInSemesterReport === true }).length < 1) {
            setupErr(`Task ${katCount} '${t.name}': grading components disabled — edit Learning Task > Reporting and tick Components`)
          }
          if (t.securityOptions && t.securityOptions.filter(function(g) { return g.gradingVisible === false }).length) {
            setupWarn(`Task ${katCount} '${t.name}': grading not visible — edit Learning Task > Basic and tick Grading Visible`)
          }
          if (t.taskReportDescription && t.taskReportDescription.includes("\n\n")) {
            setupWarn(`Task ${katCount} '${t.name}': extra blank line in description — edit Learning Task > Reporting > Task Summary Description`)
          }
          if (!(t.name.startsWith("Key Assessment Task") || t.name.startsWith("Unit") || t.name.startsWith("Exam") || t.name.startsWith("SAC") || t.name.startsWith("Semester") || t.name.startsWith("Structured"))) {
            setupWarn(`Task ${katCount}: '${t.name}' does not follow naming format — edit Learning Task > Name`)
          }
          if (!(t.taskTitleOnReport.startsWith("Key Assessment Task") || t.taskTitleOnReport.startsWith("Unit") || t.taskTitleOnReport.startsWith("Exam") || t.taskTitleOnReport.startsWith("SAC") || t.taskTitleOnReport.startsWith("Semester") || t.taskTitleOnReport.startsWith("Structured"))) {
            setupWarn(`Task ${katCount}: title on report '${t.taskTitleOnReport}' does not follow naming format — edit Learning Task > Reporting > Title on Report`)
          }
          if (t.includeInOverall) {
            setupWarn(`Task ${katCount} '${t.name}': is emphasised — edit Learning Task > Reporting and untick Emphasise in Task Summary`)
          }
          if (t.showTaskDueDates) {
            setupWarn(`Task ${katCount} '${t.name}': shows due date on report — edit Learning Task > Reporting and untick Display Task Due Dates`)
          }
          if (t.name.includes(" : ") || t.taskTitleOnReport.includes(" : ")) {
            setupInfo(`Task ${katCount}: space before colon — edit Learning Task and fix`)
          }
          if (!t.dueDateTimestamp) {
            setupInfo(`Task ${katCount} '${t.name}': no due date — edit Learning Task and add Due Date`)
          }

          $.each(t.students, function() {
            if (!this.results.length && classlist && classlist.includes(this.userId)) {
              resultsGroup.add(`Task ${katCount} '${t.name}': results missing for ${this.userName}`, 'error')
              if (!kat.hasClass('error')) kat.addClass('error')
              markSeverity('error')
            }
          })
        })

        var minTasks = getMinTasks(subjectName, actName)
        var yr       = detectYearLevel(subjectName, actName)
        if (katCount < minTasks) {
          var isHighTask = HIGH_TASK_SUBJECTS.some(function(s) {
            return subjectName.toLowerCase().includes(s.toLowerCase())
          })
          var ctx
          if (isHighTask && (yr === 7 || yr === 8)) {
            ctx = `Year ${yr} English/Mathematics — minimum is ${minTasks} tasks`
          } else if (yr === 7 || yr === 8) {
            ctx = `Year ${yr} non-core subject — minimum is ${minTasks} tasks`
          } else {
            ctx = `minimum is ${minTasks} tasks`
          }
          setupGroup.add(
            `Only ${katCount} task${katCount !== 1 ? 's' : ''} found (${ctx}) — edit Learning Tasks > Reporting and check Semester Report Cycles are added`,
            'warning'
          )
          markSeverity('warning')
        }
      }

      function processReportIssues(results) {
        var elemPill = elemDiv.find('.rc-elem-pill')
        if (!elemPill.length) {
          elemPill = $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
        }
        $.each(results.d.entities, function() {
          var studentName = this.name
          $.each(this.results, function() {
            var fieldName = this.name || ''
            if (isAeuExempt(fieldName)) return
            if (fieldName === 'Classes Attended' || fieldName === 'Classes Not Present') return

            if (!this.value || (this.itemName == "Award" && this.value == "None")) {
              setupGroup.add(`${studentName} — '${fieldName}' is missing`, 'error')
              elemPill.removeClass('complete').addClass('error').text('Incomplete')
              markSeverity('error')
            }
          })
        })
      }

      var excend  = $('<div>').addClass('rc-excend').appendTo(actBody)
      var exHdr   = $('<div>').addClass('rc-excend-header').click(function() { excend.toggleClass('open') }).appendTo(excend)
      $('<span>').text('Excellence & Endeavour').appendTo(exHdr)
      $('<span>').text('▶').css({ fontSize: '9px' }).appendTo(exHdr)
      var excBody = $('<div>').addClass('rc-excend-body').appendTo(excend)

      $.when(getReports(entityId, cycleId), getTasks(activityId), getEnrolments(activityId))
        .done(function(results, tasks, enrolments) {
          storedTaskData   = tasks[0]
          storedReportData = results[0]
          storedEnrolments = loadEnrolments(enrolments[0])

          $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
          renderIssues()
          loadExcend(results[0], activityId, cycleId, excBody, actName)
        }).done(function() {
          count++
          pf.css('width', (count / total * 100) + '%')

          if (dot.hasClass('dot-red')) {
            stats.error++
          } else if (dot.hasClass('dot-amber')) {
            stats.warning++
          } else {
            dot.removeClass('dot-blue').addClass('dot-green')
            stats.complete++
          }
          updateStats()

          if (count === total) {
            pf.css('width', '100%')
            if (hasError) {
              pill.removeClass('loading warning complete').addClass('error').text('Errors')
            } else if (hasWarning) {
              pill.removeClass('loading error complete').addClass('warning').text('Warnings')
            } else {
              pill.removeClass('loading error warning').addClass('complete').text('Complete ✓')
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

  function getEnrolments(activityId) {
    return $.ajax("/Services/Activity.svc/GetEnrolmentsByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 100 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadEnrolments(results) { return results.d.map(s => s.uid) }

  function getReports(entityId, cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportReviewerBlob", {
      data: JSON.stringify({ entityType: 1, entityId: entityId, cycleId: cycleId }),
      contentType: 'application/json', type: 'POST'
    })
  }

  function loadExcend(results, activityId, cycleId, excBody, subjectCode) {
    $.each(results.d.entities, function() {
      var studentName = this.name
      // Student ID as it appears in the CSV export — Compass exposes this as
      // 'uii' (user import identifier) on most entity payloads, e.g. "ABD0002"
      var studentId = this.uii || this.importIdentifier || this.code || ''
      var row = $('<div>').addClass('rc-excend-row').appendTo(excBody)
      $('<div>').addClass('rc-excend-name').text(studentName).appendTo(row)
      var ex = [], en = true
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
      })

      // GPA source: master CSV (matched by student ID + subject code)
      var csvGpa = studentId ? getCsvGpa(studentId, subjectCode) : null
      var gpa, gpaLabel, labelColor

      if (csvGpa !== null) {
        gpa = csvGpa
        gpaLabel = `GPA ${gpa.toFixed(2)}`
        labelColor = '#6b7280'
      } else if (!csvLoaded && !csvLoadFailed) {
        gpa = null
        gpaLabel = 'GPA loading…'
        labelColor = '#9ca3af'
      } else if (!studentId) {
        gpa = null
        gpaLabel = 'GPA — no student ID'
        labelColor = '#dc2626'
      } else {
        gpa = null
        gpaLabel = 'GPA — no CSV match'
        labelColor = '#dc2626'
      }

      $('<div>').text(gpaLabel).css({ fontSize: '11px', color: labelColor }).appendTo(row)

      if (gpa !== null && gpa >= 3.75 && en) {
        var award = (!ex.includes(false) && ex.length) ? "Excellence" : "Endeavour"
        $('<div>').addClass('rc-excend-award').text(award).appendTo(row)
      } else {
        $('<div>').appendTo(row)
      }
    })
  }

  function getTasks(activityId) {
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 2000 }),
      contentType: 'application/json', type: 'POST'
    })
  }

})
