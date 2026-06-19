$(document).ready(function() {

  if (!window.single) {
    window.single = true
  } else {
    return
  }

  if ($('body #dash').length) {
    $('body #dash').remove()
  }

  // ── AEU state (shared across all checks) ─────────────────────────────────
  var aeuActive = false
  var AEU_EXEMPT_FIELDS = ['teacher comment', 'areas for improvement']

  function isAeuExempt(fieldName) {
    if (!aeuActive) return false
    return AEU_EXEMPT_FIELDS.some(function(f) {
      return fieldName.toLowerCase().includes(f)
    })
  }

  // ── Year level & minimum task logic ──────────────────────────────────────
  var CORE_SUBJECTS = ['English', 'Mathematics', 'Humanities', 'Science', 'Physical Education']

  function detectYearLevel(subjectName, activityName) {
    // From subject name: "Year 7...", "Year 10..."
    var subjectMatch = subjectName.match(/^Year\s+(\d+)\b/i)
    if (subjectMatch) return parseInt(subjectMatch[1])
    // From activity code: "7A", "8MATA", "9ENG", "10SCI" etc.
    var activityMatch = activityName.match(/^(\d{1,2})[A-Z]/i)
    if (activityMatch) return parseInt(activityMatch[1])
    return null
  }

  var HIGH_TASKS_SUBJECTS = ['English', 'Mathematics']

  // Valid task-name prefixes — used to check both the task Name and its
  // Title on Report against the same naming convention.
  var VALID_TASK_PREFIXES = ['Key Assessment Task', 'Unit', 'Exam', 'SAC', 'Semester', 'Structured']
  function hasValidTaskPrefix(name) {
    return VALID_TASK_PREFIXES.some(function(prefix) { return name.startsWith(prefix) })
  }

  // Returns { min: <number>, context: <string for warning messages> }
  // so the count and its explanation always come from one place.
  function getMinTasks(subjectName, activityName) {
    if (/advisory/i.test(subjectName) || /advisory/i.test(activityName)) {
      return { min: 0, context: 'Advisory — no minimum' }
    }
    var yr = detectYearLevel(subjectName, activityName)
    if (yr !== 7 && yr !== 8) {
      return { min: 3, context: 'minimum is 3 tasks' }
    }
    var isHighTask = HIGH_TASKS_SUBJECTS.some(function(s) {
      return subjectName.toLowerCase().includes(s.toLowerCase())
    })
    if (isHighTask) {
      return { min: 4, context: `Year ${yr} English/Mathematics — minimum is 4 tasks` }
    }
    var isCore = CORE_SUBJECTS.some(function(core) {
      return subjectName.toLowerCase().includes(core.toLowerCase())
    })
    var min = isCore ? 3 : 2
    return { min: min, context: `Year ${yr} non-core subject — minimum is ${min} tasks` }
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

    /* ── Top bar ── */
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
    #dash .rc-topbar h1 {
      font-size: 15px;
      font-weight: 600;
      color: #1a1d23;
      white-space: nowrap;
    }
    #dash .rc-divider {
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

    /* AEU checkbox */
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
    #dash .rc-aeu.active {
      background: #d97706;
      border-color: #b45309;
      color: white;
    }
    #dash .rc-aeu input[type=checkbox] {
      width: 14px; height: 14px;
      accent-color: #d97706;
      cursor: pointer;
    }

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

    /* ── Scrollable body ── */
    #dash .rc-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px 40px;
    }

    /* ── Stats bar ── */
    #dash .rc-stats {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    #dash .rc-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      padding: 7px 13px;
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
    }
    #dash .rc-stat strong { font-size: 15px; font-weight: 700; color: #1a1d23; }
    #dash .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    #dash .dot-green  { background: #16a34a; }
    #dash .dot-amber  { background: #d97706; }
    #dash .dot-red    { background: #dc2626; }
    #dash .dot-blue   { background: #0057d9; }

    /* ── All-clear banner ── */
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

    /* ── Rule note ── */
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
      padding: 10px 14px;
      background: #fafbfc;
      border-bottom: 1px solid #e2e5ea;
      cursor: pointer;
      user-select: none;
    }
    #dash .rc-staff-header:hover { background: #f3f4f6; }
    #dash .rc-chevron {
      font-size: 9px;
      color: #9ca3af;
      transition: transform 0.15s;
      flex-shrink: 0;
    }
    #dash .rc-staff-block.open .rc-staff-header .rc-chevron { transform: rotate(90deg); }
    #dash .rc-staff-name { font-weight: 600; font-size: 13px; flex: 1; }
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
    }
    #dash .rc-email-btn:hover { background: #d1e3fc; }
    #dash .rc-staff-body { display: none; }
    #dash .rc-staff-block.open .rc-staff-body { display: block; }
    #dash .rc-progress-bar { height: 2px; background: #f0f2f5; }
    #dash .rc-progress-fill { height: 100%; background: #0057d9; width: 0%; transition: width 0.3s ease; }

    /* ── Activity row ── */
    #dash .rc-activity {
      border-bottom: 1px solid #f3f4f6;
    }
    #dash .rc-activity:last-child { border-bottom: none; }
    #dash .rc-activity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px 8px 26px;
      cursor: pointer;
      transition: background 0.1s;
    }
    #dash .rc-activity-header:hover { background: #f9fafb; }
    #dash .rc-act-status-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    #dash .rc-act-name {
      flex: 1;
      font-size: 12.5px;
    }
    #dash .rc-act-name a { color: #0057d9; text-decoration: none; font-weight: 500; }
    #dash .rc-act-name a:hover { text-decoration: underline; }
    #dash .rc-act-name .rc-act-subject { color: #9ca3af; font-weight: 400; }

    /* KAT pills row */
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
    #dash .rc-elem-pill {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      white-space: nowrap;
    }
    #dash .rc-elem-pill.complete { background: #dcfce7; color: #15803d; }
    #dash .rc-elem-pill.error    { background: #fee2e2; color: #991b1b; }

    #dash .rc-activity-body { display: none; padding: 0 14px 12px 26px; }
    #dash .rc-activity.open .rc-activity-body { display: block; }

    /* ── Issue groups ── */
    #dash .rc-issue-groups {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }
    #dash .rc-issue-group {
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      overflow: hidden;
    }
    #dash .rc-issue-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      cursor: pointer;
      user-select: none;
      font-size: 12px;
      font-weight: 600;
    }
    #dash .rc-issue-group.group-setup .rc-issue-group-header {
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      color: #1d40ae;
    }
    #dash .rc-issue-group.group-results .rc-issue-group-header {
      background: #fff7ed;
      border-bottom: 1px solid #fed7aa;
      color: #9a3412;
    }
    #dash .rc-issue-group.group-ok .rc-issue-group-header {
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
      color: #15803d;
    }
    #dash .rc-group-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 20px;
    }
    #dash .group-setup .rc-group-badge   { background: #dbeafe; color: #1d40ae; }
    #dash .group-results .rc-group-badge { background: #fed7aa; color: #9a3412; }
    #dash .group-ok .rc-group-badge      { background: #dcfce7; color: #15803d; }
    #dash .rc-issue-group-body { display: none; }
    #dash .rc-issue-group.open .rc-issue-group-body { display: block; }
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
    #dash .rc-issue-sev {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      flex-shrink: 0;
      margin-top: 2px;
      text-transform: uppercase;
    }
    #dash .rc-issue-sev.error   { background: #fee2e2; color: #991b1b; }
    #dash .rc-issue-sev.warning { background: #fef3c7; color: #92400e; }
    #dash .rc-issue-sev.info    { background: #f3f4f6; color: #6b7280; }

    /* ── Two-column issue summary (Option C) ── */
    #dash .rc-two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    #dash .rc-summary-group {
      border: 1px solid #e2e5ea;
      border-radius: 8px;
      overflow: hidden;
    }
    #dash .rc-summary-group-hdr {
      padding: 7px 12px;
      font-size: 11.5px;
      font-weight: 600;
      border-bottom: 1px solid #e2e5ea;
    }
    #dash .rc-summary-group.sg-lt .rc-summary-group-hdr {
      background: #eff6ff;
      border-bottom-color: #bfdbfe;
      color: #1d40ae;
    }
    #dash .rc-summary-group.sg-sem .rc-summary-group-hdr {
      background: #f0fdf4;
      border-bottom-color: #bbf7d0;
      color: #15803d;
    }
    #dash .rc-summary-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-bottom: 1px solid #f9fafb;
      font-size: 11.5px;
      cursor: pointer;
      transition: background 0.1s;
    }
    #dash .rc-summary-row:last-child { border-bottom: none; }
    #dash .rc-summary-row:hover { background: #f9fafb; }
    #dash .rc-summary-row-label {
      flex: 1;
      color: #374151;
      line-height: 1.4;
    }
    #dash .rc-summary-row-label .rc-sr-task {
      font-size: 10px;
      color: #9ca3af;
      display: block;
    }
    #dash .rc-summary-count {
      font-size: 10.5px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    #dash .rc-summary-count.cnt-r { background: #fee2e2; color: #991b1b; }
    #dash .rc-summary-count.cnt-w { background: #fef3c7; color: #92400e; }
    #dash .rc-summary-count.cnt-g { background: #dcfce7; color: #15803d; }
    #dash .rc-detail-panel {
      display: none;
      border-top: 1px solid #f3f4f6;
      background: #fafafa;
    }
    #dash .rc-detail-panel.open { display: block; }
    #dash .rc-detail-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 4px 10px 4px 16px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
    }
    #dash .rc-detail-item:last-child { border-bottom: none; }
    #dash .rc-detail-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #dc2626;
      flex-shrink: 0;
      margin-top: 4px;
    }

    /* Checkable detail items — tick to mark resolved */
    #dash .rc-detail-item.rc-detail-checkable {
      align-items: flex-start;
      cursor: default;
    }
    #dash .rc-detail-check {
      width: 13px;
      height: 13px;
      margin-top: 2px;
      flex-shrink: 0;
      cursor: pointer;
      accent-color: #16a34a;
    }
    #dash .rc-detail-check-text {
      flex: 1;
      transition: color 0.15s, text-decoration 0.15s;
    }
    #dash .rc-detail-item.resolved {
      background: #f0fdf4;
    }
    #dash .rc-detail-item.resolved .rc-detail-check-text {
      color: #15803d;
      text-decoration: line-through;
      text-decoration-color: #86efac;
    }

    /* ── Excend ── */
    #dash .rc-excend {
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    #dash .rc-excend-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      background: #f0fdf4;
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
      border-bottom: 1px solid #f0fdf4;
      font-size: 11.5px;
    }
    #dash .rc-excend-row:last-child { border-bottom: none; }
    #dash .rc-excend-name { width: 28%; font-weight: 500; flex-shrink: 0; }
    #dash .rc-excend-kats {
      flex: 1;
      font-size: 10.5px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #dash .rc-excend-gpa {
      font-size: 11px;
      color: #374151;
      font-weight: 500;
      flex-shrink: 0;
      white-space: nowrap;
    }
    #dash .rc-excend-award {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 20px;
      background: #dcfce7;
      color: #15803d;
      flex-shrink: 0;
    }
    #dash .rc-excend-disqualified {
      margin-left: auto;
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 20px;
      background: #f3f4f6;
      color: #9ca3af;
      flex-shrink: 0;
    }
    #dash .rc-excend-note {
      font-size: 11px;
      color: #92400e;
      background: #fffbeb;
      border-top: 1px solid #fde68a;
      padding: 8px 12px;
      line-height: 1.5;
    }
    #dash .rc-excend-note code {
      font-family: monospace;
      font-size: 10.5px;
      background: #fef3c7;
      border-radius: 3px;
      padding: 1px 5px;
    }

    /* ── Load all btn ── */
    #dash .rc-load-all {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 10px 0;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      background: #0057d9;
      color: white;
      border: none;
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
    // Show all-clear only when all classes loaded and none have errors/warnings
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

  // AEU checkbox
  var aeuLabel = $('<label>').addClass('rc-aeu').appendTo(topbar)
  var aeuCheck = $('<input>').attr('type', 'checkbox').appendTo(aeuLabel)
  aeuLabel.append(' ⚡ AEU Industrial Action')
  aeuCheck.on('change', function() {
    aeuActive = this.checked
    aeuLabel.toggleClass('active', aeuActive)
    // Re-render all visible activity issues
    $('.rc-activity').each(function() {
      var actDiv = $(this)
      var rerender = actDiv.data('rerender')
      if (rerender) rerender()
    })
  })

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

  // Stats
  var statsBar = $('<div>').addClass('rc-stats').appendTo(body)
  statsBar.append('<div class="rc-stat" id="rc-stat-total"><div class="dot dot-blue"></div><strong>0</strong>&nbsp;Classes</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-complete"><div class="dot dot-green"></div><strong>0</strong>&nbsp;Complete</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-warning"><div class="dot dot-amber"></div><strong>0</strong>&nbsp;Warnings</div>')
  statsBar.append('<div class="rc-stat" id="rc-stat-error"><div class="dot dot-red"></div><strong>0</strong>&nbsp;Errors</div>')

  // All-clear banner
  $('<div>').attr('id', 'rc-allclear').addClass('rc-allclear').html(
    '<span style="font-size:20px;flex-shrink:0">✅</span>' +
    '<div><strong>Reports Check 2.0 has no detectable errors.</strong>' +
    'Please download a report from each class in Compass and check the report looks how it should. ' +
    'Completed reports still require proofreading before publishing.</div>'
  ).appendTo(body)

  // Rule note
  $('<div>').addClass('rc-rule-note').html(
    '📋 <strong>Task minimums:</strong> Yr 7/8 English &amp; Mathematics = min <strong>4</strong> tasks. ' +
    'Yr 7/8 other core subjects (Humanities, Science, Physical Education) = min <strong>3</strong> tasks. ' +
    'Yr 7/8 non-core subjects = min <strong>2</strong> tasks. ' +
    'Yr 9 &amp; 10 = min <strong>3</strong> tasks (KATs + Semester Exam included). ' +
    'REAL classes and Advisory are excluded from all checks. ' +
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
      // Exclude admin/advisory subjects
      if (a.subjectName === "Advisory" || a.subjectName === "YDuties" || a.subjectName === "YDBUS") return false
      // Exclude REAL classes/subjects — no KATs or VC levels required
      if (/REAL/i.test(a.subjectName) || /REAL/i.test(a.activityName)) return false
      return true
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
      // ── Option C: two-column summary layout ──────────────────────────────
      var twoCol = $('<div>').addClass('rc-two-col').appendTo(actBody)

      // Left column: Compass Learning Task issues
      var ltGroup = $('<div>').addClass('rc-summary-group sg-lt').appendTo(twoCol)
      $('<div>').addClass('rc-summary-group-hdr').text('Compass Learning Task issues').appendTo(ltGroup)
      var ltRows = $('<div>').appendTo(ltGroup)

      // Right column: Semester Reporting issues
      var semGroup = $('<div>').addClass('rc-summary-group sg-sem').appendTo(twoCol)
      $('<div>').addClass('rc-summary-group-hdr').text('Semester Reporting issues').appendTo(semGroup)
      var semRows = $('<div>').appendTo(semGroup)

      // ── Summary row factory ──────────────────────────────────────────────
      // Creates a collapsible summary row showing field/task + count badge
      // that expands to list individual student/detail items
      function makeSummaryRow(container, label, subLabel, severity) {
        var row = $('<div>').addClass('rc-summary-row').appendTo(container)
        var labelDiv = $('<div>').addClass('rc-summary-row-label').appendTo(row)
        $('<span>').text(label).appendTo(labelDiv)
        if (subLabel) $('<span>').addClass('rc-sr-task').text(subLabel).appendTo(labelDiv)
        var cntClass = severity === 'error' ? 'cnt-r' : severity === 'warning' ? 'cnt-w' : 'cnt-g'
        var cnt = $('<span>').addClass('rc-summary-count ' + cntClass).text('0').appendTo(row)
        var detail = $('<div>').addClass('rc-detail-panel').appendTo(container)
        row.click(function() { detail.toggleClass('open') })
        var obj = {
          count: 0,
          activeCount: 0,
          cnt: cnt,
          cntClass: cntClass,
          detail: detail,
          add: function(text) {
            this.count++
            this.activeCount++
            cnt.text(this.activeCount)
            var item = $('<div>').addClass('rc-detail-item').appendTo(detail)
            $('<div>').addClass('rc-detail-dot').appendTo(item)
            $('<div>').text(text).appendTo(item)
            return item
          },
          // addCheckable: same as add, but renders a tick box.
          // Ticking it marks that item resolved, decrements the live count,
          // and turns the badge green once all items in this row are ticked.
          addCheckable: function(text) {
            var self = this
            this.count++
            this.activeCount++
            cnt.text(this.activeCount)
            var item = $('<div>').addClass('rc-detail-item rc-detail-checkable').appendTo(detail)
            var box = $('<input type="checkbox">').addClass('rc-detail-check').appendTo(item)
            var textDiv = $('<div>').addClass('rc-detail-check-text').text(text).appendTo(item)
            box.on('change', function() {
              if (this.checked) {
                item.addClass('resolved')
                self.activeCount--
              } else {
                item.removeClass('resolved')
                self.activeCount++
              }
              if (self.activeCount <= 0) {
                cnt.text('✓').removeClass('cnt-r cnt-w').addClass('cnt-g')
              } else {
                cnt.text(self.activeCount).removeClass('cnt-g').addClass(self.cntClass)
              }
            })
            return item
          }
        }
        return obj
      }

      // ── Adapters so existing code still works ────────────────────────────
      // setupGroup → LT issues column
      // resultsGroup → Semester reporting column
      // Each gets a .add(text, sev) that routes to a summary row per unique label

      var ltSummaryRows = {}   // keyed by label
      var semSummaryRows = {}

      var setupGroup = {
        count: 0,
        add: function(text, sev) {
          this.count++
          // Parse label from text: "Task X 'name': issue" → label=issue, sub=task name
          var taskMatch = text.match(/^(.+? '[^']+'):\s*(.+)/)
          var label, sub
          if (taskMatch) {
            sub  = taskMatch[1]
            label = taskMatch[2].split(' — ')[0].substring(0, 45)
          } else {
            label = text.split(' — ')[0].substring(0, 45)
            sub   = null
          }
          var key = label + '|' + (sub || '')
          if (!ltSummaryRows[key]) {
            ltSummaryRows[key] = makeSummaryRow(ltRows, label, sub, sev)
          }
          ltSummaryRows[key].add(text)
          markSeverity(sev)
        },
        // addCheckable: grading-result warnings that the teacher can tick off
        // once verified (incorrect grade / exam exemption checks)
        addCheckable: function(text, sev, groupLabel, sub) {
          this.count++
          var key = groupLabel + '|' + (sub || '')
          if (!ltSummaryRows[key]) {
            ltSummaryRows[key] = makeSummaryRow(ltRows, groupLabel, sub, sev)
          }
          ltSummaryRows[key].addCheckable(text)
          markSeverity(sev)
        }
      }

      var resultsGroup = {
        count: 0,
        add: function(text, sev) {
          this.count++
          var label, sub

          // Pattern: "<pill> '<name>': results missing for STUDENT"
          var missingMatch = text.match(/^(.+? '[^']+'):\s*results missing for (.+)/)

          if (missingMatch) {
            label = 'Results missing'
            sub   = missingMatch[1]
          } else {
            // Report field: "STUDENT — 'FIELD' is missing"
            var fieldMatch = text.match(/'([^']+)' is missing/)
            label = fieldMatch ? fieldMatch[1] + ' missing' : text.substring(0, 40)
            sub   = null
          }

          var key = label + '|' + (sub || '')
          if (!semSummaryRows[key]) {
            semSummaryRows[key] = makeSummaryRow(semRows, label, sub, sev)
          }
          semSummaryRows[key].add(text)
          markSeverity(sev)
        }
      }

      // Severity tracker
      function markSeverity(sev) {
        if (sev === 'error') {
          dot.removeClass('dot-blue dot-amber').addClass('dot-red')
          hasError = true
        } else if (sev === 'warning' && !dot.hasClass('dot-red')) {
          dot.removeClass('dot-blue').addClass('dot-amber')
          hasWarning = true
        }
      }

      // Stored data for AEU re-render
      var storedTaskData, storedReportData, storedEnrolments, storedElemDiv, storedExcBody

      function renderIssues() {
        // Clear summary rows
        ltRows.empty(); ltSummaryRows = {}; setupGroup.count = 0
        semRows.empty(); semSummaryRows = {}; resultsGroup.count = 0
        dot.removeClass('dot-red dot-amber').addClass('dot-blue')
        katsDiv.empty(); elemDiv.empty()

        if (storedTaskData)   processTaskIssues(storedTaskData, storedEnrolments)
        if (storedReportData) processReportIssues(storedReportData, storedExcBody)

        // Final dot colour
        if (!dot.hasClass('dot-red') && !dot.hasClass('dot-amber')) {
          dot.removeClass('dot-blue').addClass('dot-green')
        }
        // Hide empty columns
        ltGroup.toggle(setupGroup.count > 0)
        semGroup.toggle(resultsGroup.count > 0)
        // If both empty, hide the whole two-col container
        twoCol.toggle(setupGroup.count > 0 || resultsGroup.count > 0)
      }

      actDiv.data('rerender', renderIssues)

      // ── Task processing ──
      function processTaskIssues(tasks, classlist) {
        var katCount = 0
        $.each(tasks.d.data, function() {
          var t = this
          if (!(t.semesterReportCycles && t.semesterReportCycles.some(
            function(s) { return s.includeInSemesterReports === true && s.reportCycleId == cycleId }
          ))) return

          katCount++
          // Smart pill label: detect task type from name
          function getTaskLabel(name, num) {
            if (/^Structured Homework Program/i.test(name)) {
              var termMatch = name.match(/Term\s*(\d)/i)
              return termMatch ? 'HW T' + termMatch[1] : 'Homework'
            }
            if (/^Semester Exam/i.test(name)) return 'Exam: ' + name.replace(/^Semester Exam\s*/i, '').substring(0, 18).trim()
            if (/^Key Assessment Task/i.test(name)) {
              var rest = name.replace(/^Key Assessment Task\s*/i, '')
              return 'KAT: ' + rest.substring(0, 20).trim()
            }
            if (/^Unit/i.test(name)) return 'Unit: ' + name.replace(/^Unit\s*/i, '').substring(0, 20).trim()
            if (/^SAC/i.test(name)) return 'SAC: ' + name.replace(/^SAC\s*/i, '').substring(0, 20).trim()
            if (/^Structured/i.test(name)) return 'Struct: ' + name.replace(/^Structured\s*/i, '').substring(0, 18).trim()
            return name.substring(0, 22).trim()
          }
          var pillLabel = getTaskLabel(t.name, katCount)
          var kat = $('<div>').addClass('rc-kat').text(pillLabel).attr('title', t.name).appendTo(katsDiv)

          function setupErr(msg) {
            setupGroup.add(msg, 'error')
            if (!kat.hasClass('error')) kat.addClass('error')
            markSeverity('error')
          }
          function setupWarn(msg) {
            setupGroup.add(msg, 'warning')
            if (!kat.hasClass('error') && !kat.hasClass('warning')) kat.addClass('warning')
            markSeverity('warning')
          }
          function setupInfo(msg) {
            setupGroup.add(msg, 'info')
          }

          // Class vs Subject check
          if (t.activityType && t.activityType !== 1) {
            setupErr(`Task ${katCount} '${t.name}': assigned to a Class not a Subject — open the Learning Task and reassign to the Subject`)
          }
          // Reporting cycle linked
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
          if (!hasValidTaskPrefix(t.name)) {
            setupWarn(`Task ${katCount}: '${t.name}' does not follow naming format — edit Learning Task > Name`)
          }
          if (!hasValidTaskPrefix(t.taskTitleOnReport)) {
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

          // Detect task type for contextual checks
          var isExamTask = /^Semester Exam/i.test(t.name)
          var isKATtask  = /^Key Assessment Task/i.test(t.name)

          // Results missing / Not Assessed / Absent checks
          //
          // IMPORTANT: when a task is graded "Not Assessed" or "Absent",
          // Compass leaves student.results[] EMPTY — there is no separate
          // results entry carrying that value. So we must check the
          // headline grade fields FIRST, before concluding results[] being
          // empty means "genuinely missing".
          $.each(t.students, function() {
            var student = this
            if (!classlist || !classlist.includes(student.userId)) return

            // Headline grade can appear on a few different field names
            // depending on task/grading-scheme type — check defensively.
            var studentResults = student.results || []
            var headlineGrade = (
              student.result || student.grade || student.displayValue ||
              (studentResults[0] || {}).displayValue || ''
            ).toString().trim()

            // KAT graded "Not Assessed" — ERROR, checkable, left column (Learning Task issues)
            if (isKATtask && headlineGrade === 'Not Assessed') {
              setupGroup.addCheckable(
                `${student.userName}: incorrect grade unless formal approval granted by Reporting Leader`,
                'error',
                'Incorrect grade — Not Assessed',
                `${pillLabel} '${t.name}'`
              )
              if (!kat.hasClass('error')) kat.addClass('error')
              return
            }

            // Semester Exam graded "Absent" — WARNING, checkable, left column
            if (isExamTask && headlineGrade === 'Absent') {
              setupGroup.addCheckable(
                `${student.userName}: incorrect grade`,
                'warning',
                'Incorrect grade — Absent (Exam)',
                `${pillLabel} '${t.name}'`
              )
              if (!kat.hasClass('error') && !kat.hasClass('warning')) kat.addClass('warning')
              return
            }

            // Semester Exam graded "Not Assessed" — WARNING, checkable, left column
            if (isExamTask && headlineGrade === 'Not Assessed') {
              setupGroup.addCheckable(
                `${student.userName}: tick this box if you have marked this task as submitted AND the student is on the Exemptions list on A & R Hub`,
                'warning',
                'Not Assessed — check exam exemption',
                `${pillLabel} '${t.name}'`
              )
              if (!kat.hasClass('error') && !kat.hasClass('warning')) kat.addClass('warning')
              return
            }

            // Only NOW treat empty results as genuinely missing — i.e. no
            // headline grade at all (not Not Assessed, not Absent, nothing).
            if (!studentResults.length && !headlineGrade) {
              resultsGroup.add(`${pillLabel} '${t.name}': results missing for ${student.userName}`, 'error')
              if (!kat.hasClass('error')) kat.addClass('error')
              markSeverity('error')
              return
            }
          })
        })

        // Min tasks check — context string comes straight from getMinTasks,
        // so there is exactly one place that decides both the number and the wording.
        var taskMin = getMinTasks(subjectName, actName)
        if (katCount < taskMin.min) {
          setupGroup.add(
            `Only ${katCount} task${katCount !== 1 ? 's' : ''} found (${taskMin.context}) — edit Learning Tasks > Reporting and check Semester Report Cycles are added`,
            'warning'
          )
          markSeverity('warning')
        }
      }

      // ── Report field processing ──
      function processReportIssues(results, excBody) {
        var elemPill = elemDiv.find('.rc-elem-pill')
        if (!elemPill.length) {
          elemPill = $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
        }
        var GPAcycleId = $(`#dash select option[value="${cycleId}"]`).attr("data-progress")

        $.each(results.d.entities, function() {
          var studentName = this.name
          $.each(this.results, function() {
            var fieldName = this.name || ''
            // Skip AEU-exempt fields when industrial action is active
            if (isAeuExempt(fieldName)) return
            // Skip Classes Attended and Classes Not Present — auto-entered
            if (fieldName === 'Classes Attended' || fieldName === 'Classes Not Present') return

            if (!this.value || (this.itemName == "Award" && this.value == "None")) {
              resultsGroup.add(`${studentName} — '${fieldName}' is missing`, 'error')
              elemPill.removeClass('complete').addClass('error').text('Incomplete')
              markSeverity('error')
            }
          })
        })
      }

      // ── Main data fetch ──
      var excend  = $('<div>').addClass('rc-excend').appendTo(actBody)
      var exHdr   = $('<div>').addClass('rc-excend-header').click(function() { excend.toggleClass('open') }).appendTo(excend)
      $('<span>').text('Excellence & Endeavour').attr('title',
        'GPA is per-subject (this class\'s Report tab data, not whole-school).\n' +
        'Excellence: GPA 3.75+ AND all KATs submitted on time AND graded "Working Above Expected Level" or higher.\n' +
        'Endeavour: GPA 3.75+ AND all KATs submitted (timing/grade not required).\n' +
        'Not Assessed or Not Submitted on ANY KAT disqualifies both awards.\n' +
        'Excellence supersedes Endeavour.'
      ).appendTo(exHdr)
      $('<span>').text('▶').css({ fontSize: '9px' }).appendTo(exHdr)
      var excBody = $('<div>').addClass('rc-excend-body').appendTo(excend)

      $.when(getReports(entityId, cycleId), getTasks(activityId), getEnrolments(activityId))
        .done(function(results, tasks, enrolments) {
          storedTaskData   = tasks[0]
          storedReportData = results[0]
          storedEnrolments = loadEnrolments(enrolments[0])
          storedElemDiv    = elemDiv
          storedExcBody    = excBody

          $('<div>').addClass('rc-elem-pill complete').text('Complete').appendTo(elemDiv)
          renderIssues()
          loadExcend(results[0], tasks[0], entityId, cycleId, excBody)
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
  // Per-SUBJECT GPA, sourced from the Report tab data (Work Habits scores on
  // this specific class's semester report) — NOT the student's whole-school
  // overall GPA. Scoped to entityId (the class) + cycleId (the report cycle),
  // matching what staff see on the Report tab for this exact class.
  function getGPA(entityId, cycleId) {
    return $.ajax("/Services/Gpa.svc/GetResultsByCycleAndActivity", {
      data: JSON.stringify({ cycleId: cycleId, entityId: entityId, editing: false }),
      contentType: 'application/json', type: 'POST'
    })
  }
  function extractGPA(gpaResponse, userId) {
    try {
      var values = gpaResponse.d.entities
        .filter(s => s.id == userId)[0]
        .results.map(r => [r.result, gpaResponse.d.aoas.filter(a => a.id == r.id)])
        .map(a => a[1][0].options.filter(b => b.id == a[0]))
        .map(a => a[0].value)
        .filter(x => x)
      return values.length ? (values.reduce((a, b) => a + b) / values.length) : null
    } catch { return null }
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

  // ── Excellence & Endeavour ────────────────────────────────────────────────
  // Award criteria (per the school's published rubric):
  //
  //              | Excellence Award                | Endeavour Award
  //  ------------|----------------------------------|---------------------------
  //  GPA for     | 3.75 or more                     | 3.75 or more
  //  this class  |                                  |
  //  ------------|----------------------------------|---------------------------
  //  Key         | ALL KATs submitted ON TIME        | ALL KATs submitted
  //  Assessment  | AND graded "Working Above         | (timing/grade not
  //  Tasks       | Expected Level" or higher         | considered further)
  //
  // "Not Assessed" or "Not Submitted" on ANY KAT disqualifies a student from
  // BOTH awards outright, regardless of GPA or other tasks.
  // Excellence supersedes Endeavour — a student meeting both sets of
  // criteria is only ever awarded Excellence, never both.
  // GPA is per-SUBJECT (Report tab data for this class), not whole-school.

  var HIGH_GRADE_VALUES = ['Working Well Above Expected Level', 'Working Above Expected Level']
  var DISQUALIFYING_GRADES = ['Not Assessed', 'Not Submitted']

  function isHighGrade(displayValue) {
    return HIGH_GRADE_VALUES.includes((displayValue || '').trim())
  }
  function isDisqualifying(displayValue) {
    return DISQUALIFYING_GRADES.includes((displayValue || '').trim())
  }

  // KAT submission status codes (matches class-dashboard.js):
  // 1 = pending, 2 = overdue, 3 = on time, 4 = late
  function isOnTimeStatus(status) { return status === 3 }

  function loadExcend(results, tasks, entityId, cycleId, excBody) {
    // Build per-student KAT submission + grade summary from the same task
    // data already used for the Setup Issues / Results Missing checks —
    // no separate fetch needed. Also collects a printable list of each
    // KAT's result so staff can see exactly what drove the award decision.
    var katSummary = {} // userId -> { allSubmitted, allOnTime, allHighGrade, disqualified, total, taskResults: [] }

    $.each(tasks.d.data, function() {
      var t = this
      if (!t.includeInSemesterReports) return
      var isExamTask = /^Semester Exam/i.test(t.name)

      $.each(t.students, function() {
        var student = this
        var uid = student.userId
        if (!katSummary[uid]) {
          katSummary[uid] = {
            allSubmitted: true, allOnTime: true, allHighGrade: true,
            disqualified: false, total: 0, taskResults: []
          }
        }
        var s = katSummary[uid]
        s.total++

        // Same headline-grade lookup as the Setup Issues check, since
        // Not Assessed / Absent tasks leave results[] empty in Compass.
        var studentResults = student.results || []
        var headlineGrade = (
          student.result || student.grade || student.displayValue ||
          (studentResults[0] || {}).displayValue || ''
        ).toString().trim()

        s.taskResults.push({ name: t.name, grade: headlineGrade || '—' })

        if (isDisqualifying(headlineGrade)) {
          s.disqualified = true
        }

        var hasResult = studentResults.length > 0 || headlineGrade
        if (!hasResult) {
          s.allSubmitted = false
          s.allOnTime = false
          s.allHighGrade = false
          return
        }

        // Submission timing — Semester Exams use the same custom-due-date
        // tolerance as the Advisory Rubric Calculator (overdue/late treated
        // as on time, since the field doesn't reflect per-student due dates).
        var onTime = isExamTask ? true : isOnTimeStatus(student.submissionStatus)
        if (!onTime) s.allOnTime = false

        if (!isHighGrade(headlineGrade)) s.allHighGrade = false
      })
    })

    $.each(results.d.entities, function() {
      var studentName = this.name
      var userId = this.id
      var row = $('<div>').addClass('rc-excend-row').appendTo(excBody)
      $('<div>').addClass('rc-excend-name').text(studentName).appendTo(row)

      var summary = katSummary[userId] || {
        allSubmitted: false, allOnTime: false, allHighGrade: false,
        disqualified: false, total: 0, taskResults: []
      }
      var allKatsSubmitted = summary.total > 0 && summary.allSubmitted
      var allKatsOnTime    = allKatsSubmitted && summary.allOnTime
      var allKatsHighGrade = allKatsSubmitted && summary.allHighGrade

      // Printed KAT results — visible directly in the row, e.g.
      // "KAT1: Working Above Expected Level, KAT2: Working At Expected Level"
      var katText = summary.taskResults.length
        ? summary.taskResults.map(function(r, i) { return `KAT${i + 1}: ${r.grade}` }).join(', ')
        : 'No KATs'
      $('<div>').addClass('rc-excend-kats').attr('title', katText).text(katText).appendTo(row)

      var gpaCell = $('<div>').addClass('rc-excend-gpa').appendTo(row)

      getGPA(entityId, cycleId).always(function(gpaResponse) {
        var gpa = extractGPA(gpaResponse, userId)
        gpaCell.text(gpa !== null ? `GPA ${gpa.toFixed(2)}` : 'GPA NA')

        var gpaMeetsBar = gpa !== null && gpa >= 3.75
        var award = null

        // Not Assessed / Not Submitted on ANY KAT disqualifies both awards
        // outright, regardless of GPA or every other task's result.
        if (!summary.disqualified) {
          if (gpaMeetsBar && allKatsOnTime && allKatsHighGrade) {
            award = 'Excellence'
          } else if (gpaMeetsBar && allKatsSubmitted) {
            award = 'Endeavour'
          }
        }

        var awardCell = $('<div>').appendTo(row)
        if (award) {
          awardCell.addClass('rc-excend-award').text(award)
        } else if (summary.disqualified) {
          awardCell.addClass('rc-excend-disqualified').text('Not eligible').attr('title', 'Not Assessed/Not Submitted on at least one KAT')
        }
      })
    })

    // Staff note: until awards are confirmed and entered, this field should
    // be bulk-filled as EXCLUDED in Compass, then updated once finalised.
    $('<div>').addClass('rc-excend-note').html(
      '📌 <strong>Fill down with <code>EXCLUDED</code> in the Compass platform, then change to these awards when available.</strong>'
    ).appendTo(excBody)
  }

  function getTasks(activityId) {
    return $.ajax("/Services/LearningTasks.svc/GetAllLearningTasksByActivityId", {
      data: JSON.stringify({ activityId: activityId, page: 1, start: 0, limit: 2000 }),
      contentType: 'application/json', type: 'POST'
    })
  }

})
