// Current version at 21 June 2026
$(document).ready(function() {

  if (!window.single) {
    window.single = true
  } else {
    return
  }

  if ($('body #dash').length) {
    $('body #dash').remove()
  }

  // ── Request queue ─────────────────────────────────────────────────────────
  // Only this many classes fetch data from Compass at the same time.
  // Without this, a teacher with 25 classes fires 75 requests all at once,
  // which is what was causing the slow loading.
  var MAX_CONCURRENT = 4
  var queue = []
  var runningCount = 0

  function queueTask(fn) {
    queue.push(fn)
    runNext()
  }
  function runNext() {
    if (runningCount >= MAX_CONCURRENT || queue.length === 0) return
    runningCount++
    var fn = queue.shift()
    fn(function() {
      runningCount--
      runNext()
    })
  }

  // ── AEU state ──────────────────────────────────────────────────────────
  var aeuActive = false
  var AEU_EXEMPT_FIELDS = ['teacher comment', 'areas for improvement']

  function isAeuExempt(fieldName) {
    if (!aeuActive) return false
    return AEU_EXEMPT_FIELDS.some(function(f) {
      return fieldName.toLowerCase().includes(f)
    })
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

    /* ── Option C: two-column summary groups ── */
    #dash .rc-summary-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    #dash .rc-summary-group {
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      overflow: hidden;
    }
    #dash .rc-summary-group-hdr {
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 600;
    }
    #dash .rc-summary-group.lt .rc-summary-group-hdr {
      background: #eff6ff; border-bottom: 1px solid #bfdbfe; color: #1d40ae;
    }
    #dash .rc-summary-group.sem .rc-summary-group-hdr {
      background: #f0fdf4; border-bottom: 1px solid #bbf7d0; color: #15803d;
    }
    #dash .rc-summary-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      font-size: 11.5px;
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      user-select: none;
    }
    #dash .rc-summary-row:last-child { border-bottom: none; }
    #dash .rc-summary-row:hover { background: #f9fafb; }
    #dash .rc-summary-row-label { flex: 1; color: #374151; }
    #dash .rc-summary-count {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    #dash .rc-summary-count.error   { background: #fee2e2; color: #991b1b; }
    #dash .rc-summary-count.warning { background: #fef3c7; color: #92400e; }
    #dash .rc-summary-detail {
      display: none;
      padding: 6px 10px 8px 22px;
      background: #fafbfc;
      border-bottom: 1px solid #f3f4f6;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.7;
    }
    #dash .rc-summary-row.open + .rc-summary-detail { display: block; }
    #dash .rc-summary-chevron {
      font-size: 9px;
      color: #9ca3af;
      transition: transform 0.15s;
      flex-shrink: 0;
    }
    #dash .rc-summary-row.open .rc-summary-chevron { transform: rotate(90deg); }
    #dash .rc-summary-empty {
      padding: 10px;
      font-size: 11.5px;
      color: #9ca3af;
      text-align: center;
    }

    /* ── Excellence & Endeavour panel ── */
    #dash .rc-excend-panel {
      border: 1px solid #fde68a;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    #dash .rc-excend-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 600;
      background: #fffbeb;
      color: #92400e;
      cursor: pointer;
      user-select: none;
    }
    #dash .rc-excend-counts {
      font-size: 11px;
      font-weight: 500;
      color: #b45309;
    }
    #dash .rc-excend-body { background: #fffefb; }
    #dash .rc-excend-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 10px;
      font-size: 11.5px;
      border-bottom: 1px solid #fef3c7;
    }
    #dash .rc-excend-row:last-child { border-bottom: none; }
    #dash .rc-excend-tag {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 20px;
      margin-top: 1px;
    }
    #dash .rc-excend-tag.excellence { background: #dbeafe; color: #1d40ae; }
    #dash .rc-excend-tag.endeavour  { background: #dcfce7; color: #15803d; }
    #dash .rc-excend-names {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 4px 16px;
      color: #374151;
      line-height: 1.5;
    }
    #dash .rc-excend-names span { white-space: nowrap; }

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
      #dash .rc-summary-detail { display: block !important; }
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
    var rerendered = 0
    // Recompute every loaded activity's issues fresh
    $('.rc-activity').each(function() {
      var rerender = $(this).data('rerender')
      if (rerender) { rerender(); rerendered++ }
    })
    // Recompute stats bar and staff pills from scratch since error/warning
    // counts may have changed after re-rendering
    recomputeAllStats()
    // Brief on-screen confirmation so it's obvious the toggle actually did something
    var msg = aeuActive
      ? `AEU Industrial Action ON — re-checked ${rerendered} class${rerendered !== 1 ? 'es' : ''}, Teacher Comment & Areas for Improvement now exempt`
      : `AEU Industrial Action OFF — re-checked ${rerendered} class${rerendered !== 1 ? 'es' : ''}`
    var toast = $('<div>').css({
      position: 'fixed', top: '60px', right: '20px', zIndex: 10001,
      background: aeuActive ? '#d97706' : '#374151', color: 'white',
      padding: '8px 14px', borderRadius: '6px', fontSize: '12px',
      fontWeight: '500', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }).text(msg).appendTo('body')
    setTimeout(function() { toast.fadeOut(400, function() { toast.remove() }) }, 3000)
  })

  function recomputeAllStats() {
    stats = { complete: 0, warning: 0, error: 0, total: 0 }
    $('.rc-activity').each(function() {
      var dot = $(this).find('.rc-act-status-dot')
      stats.total++
      if (dot.hasClass('dot-red')) stats.error++
      else if (dot.hasClass('dot-amber')) stats.warning++
      else stats.complete++
    })
    updateStats()
    // Recompute each staff pill based on its activities' current dot colours
    $('.rc-staff-block').each(function() {
      var staffBody = $(this).find('.rc-staff-body')
      var dots = staffBody.find('.rc-act-status-dot')
      if (!dots.length) return
      var pill = $(this).find('.rc-staff-pill')
      var err = dots.filter('.dot-red').length
      var warn = dots.filter('.dot-amber').length
      if (err > 0) {
        pill.removeClass('loading warning complete').addClass('error').text('Errors')
      } else if (warn > 0) {
        pill.removeClass('loading error complete').addClass('warning').text('Warnings')
      } else {
        pill.removeClass('loading error warning').addClass('complete').text('Complete ✓')
      }
    })
  }

  $('<div>').addClass('rc-spacer').appendTo(topbar)

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

  // The single Progress Report cycle ID used for Excellence & Endeavour GPA.
  //
  // Why this exists: GetResultsByCycleAndActivity (the subject-specific GPA
  // endpoint) requires a Progress Report cycle id. Progress Report cycles
  // run on their own schedule, separate from Semester Report cycles, so
  // there's no reliable way to match them by date. Instead we just take
  // whichever Progress Report cycle started most recently — the same
  // "use the current one" approach Class Dashboard already uses for
  // Learning Tasks via its isRelevant flag.
  //
  // IMPORTANT: this must be loaded BEFORE any class tries to use it.
  // Earlier versions fetched this in the background while classes were
  // already loading, which was a race condition — fast-loading classes
  // would ask for the GPA before this had arrived, and silently get
  // "No Progress Report cycle found". Fixing the order, not just the
  // lookup, is what actually fixes the bug.
  var currentProgressCycleId = null

  function pickMostRecentCycle(cycles) {
    if (!cycles.d || !cycles.d.length) return null
    return cycles.d.reduce(function(latest, c) {
      return (!latest || new Date(c.start) > new Date(latest.start)) ? c : latest
    }, null)
  }

  // Load everything Reports Check needs up front, in the correct order:
  // 1. Semester Report cycles (populates the dropdown)
  // 2. Progress Report cycles (published + open, merged, pick most recent)
  // Only once BOTH are ready do we let the dropdown trigger loading classes.
  $.when(getCycles(), getProgress(), getOpenProgress()).done(function(cycles, published, open) {
    loadCycles(cycles[0])

    var publishedCycle = pickMostRecentCycle(published[0])
    var openCycle       = pickMostRecentCycle(open[0])
    var best = [publishedCycle, openCycle].filter(Boolean).sort(function(a, b) {
      return new Date(b.start) - new Date(a.start)
    })[0]
    currentProgressCycleId = best ? best.id : null

    selectCycle.change() // now safe to start loading classes
  })

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
    // selectCycle.change() is now called once, after Progress Report
    // cycles have also loaded — see the $.when() block above.
  }

  // Fetches both published and currently-open Progress Report cycles.
  // pickMostRecentCycle (above) decides which one to actually use.
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
    // FIX: .rc-issue-item no longer exists — the issue list was rebuilt
    // into the grouped Option C summary cards (.rc-summary-row +
    // .rc-summary-detail) but this function was never updated to match,
    // so Email always reported "no outstanding issues" regardless of the
    // real state. Read from the current structure instead.
    $(`#rc-cycle-${cycleId} .rc-summary-row`).each(function() {
      var label  = $(this).find('.rc-summary-row-label').text().trim()
      var detail = $(this).next('.rc-summary-detail').text().trim()
      lines.push(label + (detail ? ' — ' + detail : ''))
    })
    if (lines.length) {
      window.location.href = `mailto:${user.d.userEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
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
      var summaryCols = $('<div>').addClass('rc-summary-cols').appendTo(actBody)

      // ── Summary group factory (Option C) ──
      // Groups issues by FIELD/ISSUE TYPE rather than listing every student.
      // Each row shows a count badge; click to expand and see affected names.
      function makeSummaryGroup(colClass, label) {
        var grp = $('<div>').addClass(`rc-summary-group ${colClass}`).appendTo(summaryCols)
        $('<div>').addClass('rc-summary-group-hdr').text(label).appendTo(grp)
        var body = $('<div>').appendTo(grp)
        var rows = {} // key -> { row, detail, names: [], sev }
        return {
          grp: grp, body: body, rows: rows,
          totalCount: function() {
            return Object.keys(rows).reduce((sum, k) => sum + rows[k].names.length, 0)
          },
          add: function(key, name, sev) {
            if (!rows[key]) {
              var row = $('<div>').addClass('rc-summary-row').appendTo(body)
              $('<span>').addClass('rc-summary-chevron').text('▶').appendTo(row)
              $('<span>').addClass('rc-summary-row-label').text(key).appendTo(row)
              var count = $('<span>').addClass(`rc-summary-count ${sev}`).appendTo(row)
              var detail = $('<div>').addClass('rc-summary-detail').appendTo(body)
              row.click(function() { row.toggleClass('open') })
              rows[key] = { row: row, count: count, detail: detail, names: [], sev: sev }
            }
            var r = rows[key]
            if (name && !r.names.includes(name)) r.names.push(name)
            r.count.text(r.names.length + (r.names.length === 1 ? ' student' : ' students'))
            r.detail.text(r.names.join(', '))
          },
          renderEmptyIfNone: function() {
            if (Object.keys(rows).length === 0) {
              $('<div>').addClass('rc-summary-empty').text('No issues').appendTo(body)
            }
          }
        }
      }

      var ltGroup  = makeSummaryGroup('lt',  'Compass Learning Task issues')
      var semGroup = makeSummaryGroup('sem', 'Semester Reporting issues')

      // ── Excellence & Endeavour panel ──
      // Sits below the two issue groups since it's a recommendation list,
      // not an issue list. GPA comes from the Progress Report only (per
      // school decision — Andrew's original "Work Habits" fallback is
      // deliberately NOT used here).
      var excendPanel = $('<div>').addClass('rc-excend-panel').appendTo(actBody)
      var excendHdr   = $('<div>').addClass('rc-excend-hdr').appendTo(excendPanel)
      $('<span>').text('🏆 Excellence & Endeavour').appendTo(excendHdr)
      var excendCounts = $('<span>').addClass('rc-excend-counts').appendTo(excendHdr)
      var excendBody   = $('<div>').addClass('rc-excend-body').hide().appendTo(excendPanel)
      excendHdr.click(function() { excendBody.toggle() })

      function markSeverity(sev) {
        if (sev === 'error') {
          dot.removeClass('dot-blue dot-amber').addClass('dot-red')
          hasError = true
        } else if (sev === 'warning' && !dot.hasClass('dot-red')) {
          dot.removeClass('dot-blue').addClass('dot-amber')
          hasWarning = true
        }
      }

      var storedTaskData, storedReportData, storedEnrolments

      function renderIssues() {
        ltGroup.body.empty();  ltGroup.rows  = {}
        semGroup.body.empty(); semGroup.rows = {}
        excendBody.empty()
        dot.removeClass('dot-red dot-amber').addClass('dot-blue')
        katsDiv.empty(); elemDiv.empty()

        if (storedTaskData)   processTaskIssues(storedTaskData, storedEnrolments)
        if (storedReportData) processReportIssues(storedReportData, storedTaskData)
        if (storedReportData) processExcellenceEndeavour(storedReportData, storedTaskData, cycleId)

        if (!dot.hasClass('dot-red') && !dot.hasClass('dot-amber')) {
          dot.removeClass('dot-blue').addClass('dot-green')
        }
        ltGroup.renderEmptyIfNone()
        semGroup.renderEmptyIfNone()
      }

      actDiv.data('rerender', renderIssues)

      // ── Excellence & Endeavour calculation (rebuilt to school rules) ──
      //
      // EXCELLENCE — ALL of:
      //   1. Progress Report GPA for this subject ≥ 3.75
      //   2. EVERY task submissionStatus is exactly 3 (on time) — no late, no overdue, no pending
      //   3. EVERY task has a grade actually entered (results.length > 0)
      //   4. The Overall Assessment/Performance/Grading:Achievement field is
      //      "Working Above Expected Level" or "Working Well Above Expected Level"
      //
      // ENDEAVOUR — ALL of:
      //   1. Progress Report GPA for this subject ≥ 3.75
      //   2. EVERY task is submitted (status 3 on time, OR 4 late) — pending/overdue disqualifies
      //   3. EVERY task has a grade actually entered (results.length > 0)
      //   4. The grade field is anything OTHER than "Not Assessed" or "Not Submitted"
      //
      // Rule 3 is the one that matters most in practice: a student can look
      // perfect on paper (high GPA, good grade, all submitted) but still be
      // missing a result on one individual task — that alone disqualifies
      // them from any award until the missing grade is entered.
      //
      // A student can only receive one award — Excellence is checked first;
      // if they don't qualify for Excellence, Endeavour is checked next.
      function processExcellenceEndeavour(results, taskData, cycleId) {
        if (!currentProgressCycleId) {
          excendCounts.text('No Progress Report cycle found')
          return
        }
        var GPAcycleId = currentProgressCycleId

        // Build userId -> { allOnTime, allSubmitted, allGradesEntered } from Learning Task data.
        // allGradesEntered is the missing piece that let students through with
        // an empty grade on one task (e.g. Sophie Wardell missing KAT 2) — an
        // award should never be granted if any task has no result entered.
        var submissionByStudent = {}
        if (taskData && taskData.d && taskData.d.data) {
          $.each(taskData.d.data, function() {
            $.each(this.students, function() {
              var uid = this.userId
              if (!submissionByStudent[uid]) {
                submissionByStudent[uid] = { allOnTime: true, allSubmitted: true, allGradesEntered: true }
              }
              var rec = submissionByStudent[uid]
              if (this.submissionStatus !== 3) rec.allOnTime = false
              if (this.submissionStatus !== 3 && this.submissionStatus !== 4) rec.allSubmitted = false
              if (!this.results || !this.results.length) rec.allGradesEntered = false
            })
          })
        }

        getGPA(activityId, GPAcycleId).always(function(gpas) {
          var excellenceNames = []
          var endeavourNames  = []

          $.each(results.d.entities, function() {
            var studentName = this.name
            var studentId   = this.id

            var gradeField = null // the Overall Assessment / Performance / Grading: Achievement text
            $.each(this.results, function() {
              if (this.name == "Overall Assessment" || this.name == "Performance" || this.name == "Grading: Achievement") {
                gradeField = this.displayValue
              }
            })

            var gp  = loadGPA(gpas, studentId)
            var gpa = gp.length ? (gp.reduce((a, b) => a + b) / gp.length) : null
            if (gpa === null || gpa < 3.75) return // doesn't meet the GPA bar for either award

            var sub = submissionByStudent[studentId] || { allOnTime: false, allSubmitted: false, allGradesEntered: false }

            // ── Excellence check ──
            // Requires every task graded — a single missing grade disqualifies
            // the student from any award, regardless of how strong the rest
            // of their results look.
            var isExcellenceGrade = (gradeField == "Working Above Expected Level" || gradeField == "Working Well Above Expected Level")
            if (sub.allOnTime && sub.allGradesEntered && isExcellenceGrade) {
              excellenceNames.push(`${studentName} (GPA ${gpa.toFixed(2)})`)
              return // already awarded Excellence, don't also check Endeavour
            }

            // ── Endeavour check ──
            var isEndeavourGrade = (gradeField !== "Not Assessed" && gradeField !== "Not Submitted" && gradeField != null)
            if (sub.allSubmitted && sub.allGradesEntered && isEndeavourGrade) {
              endeavourNames.push(`${studentName} (GPA ${gpa.toFixed(2)})`)
            }
          })

          excendCounts.text(`${excellenceNames.length} Excellence, ${endeavourNames.length} Endeavour`)

          function renderAwardRow(label, sevClass, names) {
            var row  = $('<div>').addClass('rc-excend-row').appendTo(excendBody)
            $('<span>').addClass(`rc-excend-tag ${sevClass}`).text(label).appendTo(row)
            var grid = $('<div>').addClass('rc-excend-names').appendTo(row)
            names.forEach(function(name) {
              $('<span>').attr('title', name).text(name).appendTo(grid)
            })
          }

          if (excellenceNames.length) renderAwardRow('Excellence', 'excellence', excellenceNames)
          if (endeavourNames.length)  renderAwardRow('Endeavour',  'endeavour',  endeavourNames)
          if (!excellenceNames.length && !endeavourNames.length) {
            $('<div>').addClass('rc-summary-empty').text('No students currently qualify').appendTo(excendBody)
          }
        })
      }

      function processTaskIssues(tasks, classlist) {
        var katCount = 0
        $.each(tasks.d.data, function() {
          var t = this
          if (!(t.semesterReportCycles && t.semesterReportCycles.some(
            function(s) { return s.includeInSemesterReports === true && s.reportCycleId == cycleId }
          ))) return

          katCount++
          // Real task name on the pill, truncated so it doesn't blow out the row
          var shortName = t.name.length > 28 ? t.name.slice(0, 26) + '…' : t.name
          var kat = $('<div>').addClass('rc-kat').text(shortName).attr('title', t.name).appendTo(katsDiv)

          function ltErr(key)  { ltGroup.add(key, null, 'error');   ltGroup.rows[key].names = ['—']; ltGroup.rows[key].count.text('error'); ltGroup.rows[key].detail.text(key); if (!kat.hasClass('error')) kat.addClass('error'); markSeverity('error') }
          function ltWarn(key) { ltGroup.add(key, null, 'warning'); ltGroup.rows[key].names = ['—']; ltGroup.rows[key].count.text('warning'); ltGroup.rows[key].detail.text(key); if (!kat.hasClass('error') && !kat.hasClass('warning')) kat.addClass('warning'); markSeverity('warning') }

          if (t.activityType && t.activityType !== 1) {
            ltErr(`${shortName}: assigned to a Class not a Subject — reassign to the Subject`)
          }
          if (!t.semesterReportCycles || !t.semesterReportCycles.length) {
            ltErr(`${shortName}: not linked to a reporting cycle — add Semester Report Cycle`)
          }
          if (!t.taskReportDescription) {
            ltErr(`${shortName}: no description — add Task Summary Description`)
          }
          if (t.gradingItems && t.gradingItems.filter(function(g) { return g.includeInSemesterReport === true }).length < 1) {
            ltErr(`${shortName}: grading components disabled — tick Components`)
          }
          if (t.securityOptions && t.securityOptions.filter(function(g) { return g.gradingVisible === false }).length) {
            ltWarn(`${shortName}: grading not visible — tick Grading Visible`)
          }
          if (t.taskReportDescription && t.taskReportDescription.includes("\n\n")) {
            ltWarn(`${shortName}: extra blank line in description`)
          }
          if (!(t.name.startsWith("Key Assessment Task") || t.name.startsWith("Unit") || t.name.startsWith("Exam") || t.name.startsWith("SAC") || t.name.startsWith("Semester") || t.name.startsWith("Structured"))) {
            ltWarn(`${shortName}: does not follow naming format`)
          }
          if (!(t.taskTitleOnReport.startsWith("Key Assessment Task") || t.taskTitleOnReport.startsWith("Unit") || t.taskTitleOnReport.startsWith("Exam") || t.taskTitleOnReport.startsWith("SAC") || t.taskTitleOnReport.startsWith("Semester") || t.taskTitleOnReport.startsWith("Structured"))) {
            ltWarn(`${shortName}: title on report does not follow naming format`)
          }
          if (t.includeInOverall) {
            ltWarn(`${shortName}: is emphasised — untick Emphasise in Task Summary`)
          }
          if (t.showTaskDueDates) {
            ltWarn(`${shortName}: shows due date on report — untick Display Task Due Dates`)
          }
          if (t.name.includes(" : ") || t.taskTitleOnReport.includes(" : ")) {
            ltWarn(`${shortName}: space before colon in name`)
          }
          if (!t.dueDateTimestamp) {
            ltWarn(`${shortName}: no due date`)
          }

          $.each(t.students, function() {
            var student = this
            if (!student.results.length && classlist && classlist.includes(student.userId)) {
              ltGroup.add(`${shortName}: results missing`, student.userName, 'error')
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
          var key = `Only ${katCount} task${katCount !== 1 ? 's' : ''} found (${ctx})`
          ltGroup.add(key, null, 'warning')
          ltGroup.rows[key].names = ['—']
          ltGroup.rows[key].count.text('warning')
          ltGroup.rows[key].detail.text('Check Semester Report Cycles are added to existing tasks.')
          markSeverity('warning')
        }
      }

      function processReportIssues(results, taskData) {
        var elemPill = elemDiv.find('.rc-elem-pill')
        if (!elemPill.length) {
          elemPill = $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
        }

        // Build userId -> submissionStatus map from Learning Task data
        // (matches Andrew's loadGPA pattern: cross-reference by numeric id, not name)
        var submittedIds = {} // userId -> true if submitted (status 3 or 4) on ANY task
        if (taskData && taskData.d && taskData.d.data) {
          $.each(taskData.d.data, function() {
            $.each(this.students, function() {
              if (this.submissionStatus === 3 || this.submissionStatus === 4) {
                submittedIds[this.userId] = true
              }
            })
          })
        }

        $.each(results.d.entities, function() {
          var studentName = this.name
          var studentId   = this.id // numeric id — same space as Learning Task userId (per Andrew's loadGPA)

          $.each(this.results, function() {
            var fieldName    = this.name || ''
            var itemName     = this.itemName || ''
            var displayValue = this.displayValue || ''

            if (isAeuExempt(fieldName)) return
            if (fieldName === 'Classes Attended' || fieldName === 'Classes Not Present') return

            // ── Missing field check (existing) ──
            if (!this.value || (itemName == "Award" && this.value == "None")) {
              var key = `${fieldName} missing`
              semGroup.add(key, studentName, 'error')
              elemPill.removeClass('complete').addClass('error').text('Incomplete')
              markSeverity('error')
              return // skip the warning checks below if it's already missing
            }

            // ── "Absent" exam result — Learning Task issues, not Semester Reporting ──
            // (this reflects a task-grading outcome on a Semester Exam, same family as
            // Not Assessed and the submitted/Not Submitted mismatch below)
            if (displayValue === 'Absent' && itemName.toLowerCase().includes('semester exam')) {
              var k2 = `${fieldName}: 'Absent' exam result — confirm this is correct`
              ltGroup.add(k2, studentName, 'warning')
              markSeverity('warning')
            }

            // ── "Not Assessed" — Compass Learning Task issues ──
            // (this reflects a task-grading outcome, not a report-field issue)
            if (displayValue === 'Not Assessed') {
              var k1 = `${fieldName}: 'Not Assessed' — check Exemption list or change to Not Submitted`
              ltGroup.add(k1, studentName, 'warning')
              markSeverity('warning')
            }

            // ── Marked submitted on a task but report shows Not Submitted ──
            // (Compass Learning Task issues — this is a task/report mismatch)
            if (displayValue === 'Not Submitted' && submittedIds[studentId]) {
              var k3 = `${fieldName}: marked submitted on a task but report shows 'Not Submitted' — check for mismatch`
              ltGroup.add(k3, studentName, 'warning')
              markSeverity('warning')
            }
          })
        })
      }

      queueTask(function(done) {
        $.when(getReports(entityId, cycleId), getTasks(activityId), getEnrolments(activityId))
          .done(function(results, tasks, enrolments) {
            storedTaskData   = tasks[0]
            storedReportData = results[0]
            storedEnrolments = loadEnrolments(enrolments[0])

            $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
            renderIssues()
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
          }).always(function() {
            done() // tell the queue this class is finished, free up a slot
          })
      })
    })
  }

  // ── Enrolments ────────────────────────────────────────────────────────────
  function getEnrolments(activityId) {
    return $.ajax("/Services/Activity.svc/GetEnrolmentsByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 100 }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadEnrolments(results) { return results.d.map(s => s.uid) }

  // ── GPA (for Excellence & Endeavour) ────────────────────────────────────────
  // Pulls the subject-specific GPA from the Progress Report for this class —
  // NOT the school-wide overall GPA used in the Advisory Rubric Calculator.
  // Andrew's original script also had a "Work Habits" fallback method; per
  // a deliberate decision, this rebuild uses ONLY the Progress Report GPA.
  function getGPA(activityId, progressCycleId) {
    return $.ajax("/Services/Gpa.svc/GetResultsByCycleAndActivity", {
      data: JSON.stringify({ cycleId: progressCycleId, entityId: activityId, editing: false }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function loadGPA(results, userId) {
    try {
      return results.d.entities
        .filter(s => s.id == userId)[0] // match student by numeric id
        .results.map(r => [r.result, results.d.aoas.filter(a => a.id == r.id)])
        .map(a => a[1][0].options.filter(b => b.id == a[0]))
        .map(a => a[0].value)
        .filter(x => x)
    } catch {
      return false // no Progress Report GPA available for this student
    }
  }

  // ── Reports ───────────────────────────────────────────────────────────────
  function getReports(entityId, cycleId) {
    return $.ajax("/Services/Reports.svc/GetReportReviewerBlob", {
      data: JSON.stringify({ entityType: 1, entityId: entityId, cycleId: cycleId }),
      contentType: 'application/json', type: 'POST'
    })
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  function getTasks(activityId) {
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 2000 }),
      contentType: 'application/json', type: 'POST'
    })
  }

})
