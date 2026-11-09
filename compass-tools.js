// Compass Tools launcher - compass-tools.js
// Crusoe College | crusoeapps.github.io/compassaddons
//
// The bookmark staff drag to their bar loads THIS file and never changes.
// This file then loads the current version of whichever tool is chosen, so
// updating a tool is just a push to the repo. Nobody re-drags a bookmark.
//
// To add a tool: add an entry to TOOLS below. It appears in everyone's menu
// within about 10 minutes (GitHub Pages cache).
//
// Privacy: the launcher only loads scripts from this repo. Each tool runs in
// the teacher's own browser, using their existing Compass login, and talks
// only to Compass.

(function () {
  var BASE = 'https://crusoeapps.github.io/compassaddons/'

  // needsClass: tool only works on a class page (#activity/... or #session/...)
  var TOOLS = [
    { file: 'class-dashboard.js', name: 'Advisory Rubric Calculator', desc: 'KATs, GPA, attendance, behaviour, extra-curricular', needsClass: true },
    { file: 'reports-check.js',   name: 'Reports Check',              desc: 'Missing report elements, task setup, Excellence & Endeavour', needsClass: false }
  ]

  var PANEL_ID = 'crusoe-compass-tools'
  var existing = document.getElementById(PANEL_ID)
  if (existing) { existing.remove(); return }   // clicking again closes the menu

  var onClassPage = /^#(activity|session)\//.test(window.location.hash)

  // Changes every 5 minutes, so tools are re-fetched fresh but repeat clicks
  // within a few minutes can use the browser's cached copy.
  function freshness() { return Math.floor(Date.now() / 300000) }

  function loadTool(tool) {
    panel.remove()
    var s = document.createElement('script')
    s.charset = 'utf-8'
    s.src = BASE + tool.file + '?t=' + freshness()
    s.onerror = function () { alert('Could not load ' + tool.name + '. Check your connection and try again.') }
    document.body.appendChild(s)
  }

  var panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.setAttribute('style', [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647', 'width:300px',
    'background:#fff', 'color:#1f2937', 'border:1px solid #d1d5db', 'border-radius:10px',
    'box-shadow:0 10px 30px rgba(0,0,0,.2)', 'font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
    'padding:12px'
  ].join(';'))

  var head = document.createElement('div')
  head.setAttribute('style', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px')
  var title = document.createElement('strong')
  title.textContent = 'Compass Tools'
  var close = document.createElement('button')
  close.textContent = '\u00d7'
  close.setAttribute('aria-label', 'Close')
  close.setAttribute('style', 'border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#6b7280')
  close.onclick = function () { panel.remove() }
  head.appendChild(title)
  head.appendChild(close)
  panel.appendChild(head)

  TOOLS.forEach(function (tool) {
    var ok = !tool.needsClass || onClassPage
    var btn = document.createElement('button')
    btn.setAttribute('style', [
      'display:block', 'width:100%', 'text-align:left', 'margin:6px 0', 'padding:8px 10px',
      'border:1px solid #e5e7eb', 'border-radius:8px', 'background:' + (ok ? '#f9fafb' : '#f3f4f6'),
      'cursor:' + (ok ? 'pointer' : 'not-allowed'), 'color:inherit', 'font:inherit'
    ].join(';'))
    var n = document.createElement('div')
    n.setAttribute('style', 'font-weight:600' + (ok ? '' : ';color:#9ca3af'))
    n.textContent = tool.name
    var d = document.createElement('div')
    d.setAttribute('style', 'font-size:12px;color:#6b7280')
    d.textContent = ok ? tool.desc : 'Open a class page first'
    btn.appendChild(n)
    btn.appendChild(d)
    btn.disabled = !ok
    btn.onclick = function () { loadTool(tool) }
    panel.appendChild(btn)
  })

  document.body.appendChild(panel)
})()
