<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Compass Tools — Crusoe College</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #f4f6f9; --surface: #ffffff; --border: #e4e7ed; --text: #111827;
      --muted: #6b7280; --accent: #0057d9; --green: #16a34a; --amber: #d97706;
      --purple: #7c3aed; --radius: 12px;
    }
    body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; -webkit-font-smoothing: antialiased; }
    .topbar { background: white; border-bottom: 1px solid var(--border); padding: 0 2rem; height: 54px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 50; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .topbar-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--accent); text-decoration: none; }
    .topbar-sep { width: 1px; height: 18px; background: var(--border); }
    .topbar-label { font-size: 13px; font-weight: 500; color: var(--muted); }
    .topbar-badge { margin-left: auto; font-size: 11.5px; font-weight: 600; background: #e8f0fe; color: var(--accent); padding: 3px 10px; border-radius: 20px; }
    .page { max-width: 900px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
    .hero { margin-bottom: 2.5rem; }
    .hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 10px; }
    .hero h1 { font-size: 28px; font-weight: 700; line-height: 1.2; margin-bottom: 12px; }
    .hero p { font-size: 14px; color: var(--muted); max-width: 46ch; line-height: 1.7; }
    .howto { display: flex; align-items: flex-start; gap: 14px; background: #eef4ff; border: 1px solid #c5d8fb; border-radius: var(--radius); padding: 14px 18px; margin-bottom: 2.5rem; }
    .howto-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
    .howto-body { font-size: 13px; color: #1e3a8a; line-height: 1.65; }
    .howto-body strong { font-weight: 600; }
    .howto-body kbd { font-family: inherit; font-size: 11px; background: white; border: 1px solid #c5d8fb; border-radius: 4px; padding: 1px 5px; color: #1e3a8a; }
    .section-label { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
    .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 2.5rem; }
    .tool-card { background: white; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.18s ease, transform 0.18s ease; }
    .tool-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.09); transform: translateY(-2px); }
    .tool-card-stripe { height: 4px; flex-shrink: 0; }
    .tool-card.stable .tool-card-stripe { background: var(--green); }
    .tool-card.testing .tool-card-stripe { background: var(--amber); }
    .tool-card.exp .tool-card-stripe { background: var(--purple); }
    .tool-card-body { padding: 18px 18px 14px; flex: 1; }
    .tool-card-name { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .tool-card-desc { font-size: 13px; color: var(--muted); line-height: 1.55; margin-bottom: 12px; }
    .tool-card-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; border-radius: 20px; padding: 3px 9px; }
    .tool-card-tag.stable { background: #dcfce7; color: #15803d; }
    .tool-card-tag.testing { background: #fef3c7; color: #92400e; }
    .tool-card-tag::before { content: '●'; font-size: 7px; }
    .tool-card-drag { padding: 12px 18px 14px; background: #f8fafc; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
    .drag-hint-text { font-size: 11px; color: var(--muted); line-height: 1.4; }
    .drag-hint-text strong { display: block; color: #374151; font-weight: 600; font-size: 11.5px; margin-bottom: 1px; }
    .bookmarklet { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 16px; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 600; color: white; background: linear-gradient(135deg, #0057d9 0%, #1a6bff 100%); border: none; text-decoration: none; cursor: grab; user-select: none; white-space: nowrap; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,87,217,0.35), 0 1px 2px rgba(0,87,217,0.2); transition: box-shadow 0.15s, transform 0.15s, background 0.15s; }
    .bookmarklet:hover { box-shadow: 0 4px 16px rgba(0,87,217,0.45), 0 2px 4px rgba(0,87,217,0.25); transform: translateY(-1px); background: linear-gradient(135deg, #004ec7 0%, #0f5df0 100%); }
    .bookmarklet:active { cursor: grabbing; transform: translateY(0); }
    .bookmarklet-arrow { font-size: 16px; animation: bounce 1.6s ease-in-out infinite; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    .drag-tooltip { display: none; position: fixed; top: 0; left: 0; right: 0; background: var(--accent); color: white; text-align: center; font-size: 13px; font-weight: 500; padding: 9px 1rem; z-index: 200; pointer-events: none; box-shadow: 0 2px 8px rgba(0,87,217,0.3); }
    .drag-tooltip.show { display: block; }
    .legend { display: flex; gap: 18px; margin-bottom: 2rem; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--muted); }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
    .legend-dot.stable { background: var(--green); }
    .legend-dot.testing { background: var(--amber); }
    .legend-dot.exp { background: var(--purple); }
    .coming-soon { background: white; border: 1px dashed var(--border); border-radius: var(--radius); padding: 18px 20px; margin-bottom: 2.5rem; }
    .coming-soon h3 { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 10px; }
    .coming-soon-pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .coming-soon-pill { font-size: 12px; font-weight: 500; color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; }
    footer { margin-top: 3rem; padding-top: 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
    footer a { color: var(--muted); text-decoration: underline; }
    @media (max-width: 520px) { .topbar { padding: 0 1rem; } .tool-grid { grid-template-columns: 1fr; } .howto { flex-direction: column; } .hero h1 { font-size: 22px; } }
  </style>
</head>
<body>

<div class="drag-tooltip" id="dragTooltip">☝️ Drag this button to your Bookmarks Bar — then click it when you're on a Compass class page</div>

<div class="topbar">
  <a href="https://compass.education" class="topbar-logo">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="22" height="22">
      <path fill="#0057d9" d="M89.82,62.55a47.57,47.57,0,1,0,47.57,47.57A47.62,47.62,0,0,0,89.82,62.55Zm0,81.62a34.06,34.06,0,1,1,34.06-34A34.08,34.08,0,0,1,89.82,144.17Z"/>
      <path fill="#0057d9" d="M97.65,117l.14-.16.14-.16.13-.17.13-.17.12-.17c0-.06.08-.12.12-.17a1.88,1.88,0,0,0,.12-.18l.12-.18.11-.18.11-.19.1-.18a1.74,1.74,0,0,0,.1-.19l.1-.19.09-.19.09-.2a1.19,1.19,0,0,0,.08-.2l.09-.2c0-.06,0-.13.07-.2l.08-.2.06-.21a1.59,1.59,0,0,0,.07-.2l.06-.21.06-.21s0,0,0-.06l4.78-17.44L87.21,100h0l-.2,0-.22.06-.2.07-.21.07-.2.07-.2.08-.2.08-.2.09-.19.09-.2.09-.18.1-.2.1-.18.1-.18.11-.18.12-.18.11-.18.12-.17.12-.17.13a1.09,1.09,0,0,0-.17.13l-.16.13-.17.14-.16.14-.16.14-.15.14-.15.15-.15.16-.14.15a1.07,1.07,0,0,0-.14.16l-.15.16a1.83,1.83,0,0,1-.13.16l-.13.17a1.83,1.83,0,0,0-.13.16l-.13.18-.12.17-.12.18-.11.18a1.74,1.74,0,0,0-.11.18l-.11.18-.11.19-.09.19a1.14,1.14,0,0,0-.1.19l-.09.19-.09.2-.09.19c0,.07,0,.14-.08.2s0,.14-.08.2,0,.14-.07.21,0,.13-.07.2l-.06.21-.06.21-.06.21a.43.43,0,0,1,0,0L74.91,125l17.52-4.8h0l.21-.06.21-.06.21-.06.21-.07.2-.08.2-.07.2-.09.2-.08.19-.09.19-.1.19-.09.19-.1.19-.11.18-.11.18-.11.18-.11.17-.12.18-.13.17-.12.17-.13.16-.13.17-.14.15-.14.16-.14.16-.15.15-.15.15-.15.14-.15Z"/>
      <path fill="#0057d9" d="M89.8,55.77c-.62,0-1.23,0-1.85,0h-.27c-.54,0-1.08,0-1.61.09h-.2c-1.26.1-2.5.23-3.74.4h0c-1.63.23-3.24.53-4.83.91a1.87,1.87,0,0,1-.4,0A1.7,1.7,0,0,1,75.26,56l-2.6-9.73a1.71,1.71,0,0,1,1.24-2.1,66.92,66.92,0,0,1,7.48-1.35h0l.39,0,1.41-.15.65-.06,1.34-.1.68-.05,1.36-.06.64,0h.26l1.69,0h0c.57,0,1.13,0,1.69,0h.27l.63,0,1.36.06.68.05,1.34.1.65.06,1.41.15.39,0h0a66.52,66.52,0,0,1,7.48,1.35,1.71,1.71,0,0,1,1.25,2.1L104.34,56a1.7,1.7,0,0,1-1.64,1.26,1.72,1.72,0,0,1-.39,0c-1.6-.38-3.21-.68-4.84-.91h0c-1.24-.17-2.48-.3-3.73-.4h-.2l-1.62-.09h-.27c-.62,0-1.23,0-1.85,0Z"/>
    </svg>
    Compass
  </a>
  <div class="topbar-sep"></div>
  <span class="topbar-label">Power Tools</span>
  <div class="topbar-badge">Updated — Semester 1 2026</div>
</div>

<div class="page">

  <div class="hero">
    <div class="hero-eyebrow">Crusoe College</div>
    <h1>Compass Reporting Add Ons</h1>
    <p>Browser bookmarklets that run inside Compass using your existing login. All data stays between your browser and Compass — nothing is sent anywhere else.</p>
  </div>

  <div class="howto">
    <div class="howto-icon">📌</div>
    <div class="howto-body">
      <strong>How to use:</strong> Drag a blue button below to your Bookmarks Bar. Then open a class page in Compass and click the bookmark.
      If your bar isn't visible: <kbd>Menu</kbd> → <kbd>Bookmarks</kbd> → <kbd>Show Bookmarks Bar</kbd>.
    </div>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-dot stable"></div> Stable — ready to use</div>
    <div class="legend-item"><div class="legend-dot testing"></div> In testing — may have rough edges</div>
  </div>

  <div class="section-label">Stable tools</div>
  <div class="tool-grid">

    <div class="tool-card stable">
      <div class="tool-card-stripe"></div>
      <div class="tool-card-body">
        <div class="tool-card-name">Reports Check 2.0</div>
        <div class="tool-card-desc">Checks reports for missing elements, task naming, grading setup, and Excellence & Endeavour recommendations. Grouped into Setup Issues and Task Results Missing.</div>
        <div class="tool-card-tag stable">Stable</div>
      </div>
      <div class="tool-card-drag">
        <a href="javascript:(function(){document.body.appendChild(document.createElement('script')).src='https://crusoeapps.github.io/compassaddons/reports-check.js?v=4';})();" class="bookmarklet">
          <span class="bookmarklet-arrow">⇧</span> Reports Check 2.0
        </a>
        <div class="drag-hint-text"><strong>Drag to bookmarks</strong>then click on any Compass page</div>
      </div>
    </div>

    <div class="tool-card testing">
      <div class="tool-card-stripe"></div>
      <div class="tool-card-body">
        <div class="tool-card-name">Class Dashboard</div>
        <div class="tool-card-desc">View summary attendance, GPA, tasks and chronicle data for a class. Original version — being reviewed for an update.</div>
        <div class="tool-card-tag testing">In testing</div>
      </div>
      <div class="tool-card-drag">
        <a href="javascript:(function(){document.body.appendChild(document.createElement('script')).src='https://compass.learnding.au/class-dashboard.js';})();" class="bookmarklet">
          <span class="bookmarklet-arrow">⇧</span> Class Dashboard
        </a>
        <div class="drag-hint-text"><strong>Drag to bookmarks</strong>then click on a class page</div>
      </div>
    </div>

  </div>

  <div class="coming-soon">
    <h3>More tools being reviewed for Crusoe College</h3>
    <div class="coming-soon-pills">
      <span class="coming-soon-pill">Mixer-upper-er</span>
      <span class="coming-soon-pill">Guess Who?</span>
      <span class="coming-soon-pill">Birthdays</span>
      <span class="coming-soon-pill">Lesson Presenter</span>
      <span class="coming-soon-pill">Attendance Summary</span>
      <span class="coming-soon-pill">Attendance by Class</span>
      <span class="coming-soon-pill">Unmarked Rolls</span>
      <span class="coming-soon-pill">Certificate Creator</span>
      <span class="coming-soon-pill">Graduation Certificates</span>
    </div>
  </div>

  <footer>
    <span>Crusoe College — Compass Power Tools — Semester 1, 2026</span>
    <span>MIT License · <a href="https://github.com/crusoeapps/compassaddons" target="_blank">github.com/crusoeapps/compassaddons</a></span>
  </footer>

</div>

<script>
  var tooltip = document.getElementById('dragTooltip')
  document.querySelectorAll('.bookmarklet').forEach(function(btn) {
    btn.addEventListener('mouseenter', function() { tooltip.classList.add('show') })
    btn.addEventListener('mouseleave', function() { tooltip.classList.remove('show') })
    btn.addEventListener('click', function(e) {
      e.preventDefault()
      tooltip.classList.remove('show')
      alert('Drag this button to your Bookmarks Bar, then click it when you\'re on a Compass class page.')
    })
  })
</script>
</body>
</html>
