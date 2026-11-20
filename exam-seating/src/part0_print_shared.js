/* ===================== SHARED PRINT HELPERS =====================
   Used by the Exam Seating Manager (build.js puts this part first) AND by
   the Compass "Exam Rooms" tool (build_exam_rooms.js). Change with care:
   test.py checks the Manager's printed output is unchanged.
   ================================================================ */
var PRINT_CSS =
  '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
  'body { font-family: "DM Sans", Arial, sans-serif; color: #1a2540; margin: 0; padding: 10mm 8mm; }' +
  'h1 { font-family: "DM Serif Display", Georgia, serif; font-size: 15pt; color: #0d5c2e; margin: 0; }' +
  '.sub { font-size: 8pt; color: #666; margin: 2px 0 10px; }' +
  'table { border-collapse: collapse; width: 100%; table-layout: fixed; }' +
  'th { background: #0d5c2e; color: white; font-size: 6.5pt; padding: 3px 2px; }' +
  'td { border: 1px solid #ccc; font-size: 6.5pt; padding: 3px 2px; text-align: center; vertical-align: top; overflow: hidden; }' +
  'td .f { display: block; color: #777; font-size: 6pt; white-space: nowrap; overflow: hidden; }' +
  'td .l { display: block; font-weight: 700; text-transform: uppercase; font-size: 6.8pt; white-space: nowrap; overflow: hidden; }' +
  'th.rowhead { width: 34px; }' +
  'table.list td { text-align: left; font-size: 8.5pt; padding: 4px 6px; }' +
  'table.list th { text-align: left; font-size: 8pt; padding: 4px 6px; }';

/* Shrink a name's font so it fits its grid box. Width is measured with the
   print font on a canvas; names that already fit keep the normal size (so
   default output is unchanged). Returns '' or an inline style. */
var _fitCanvas = null;
function fitStyle(text, basePt, availPt, bold, upper, family) {
  if (!text) return '';
  try {
    _fitCanvas = _fitCanvas || document.createElement('canvas');
    var g = _fitCanvas.getContext('2d');
    g.font = (bold ? '700 ' : '400 ') + '100px ' + (family || '"DM Sans", Arial, sans-serif');
    var em = g.measureText(upper ? String(text).toUpperCase() : String(text)).width / 100;
    var fit = availPt / em * 0.92;                       // small safety margin
    if (fit >= basePt) return '';
    return ' style="font-size:' + Math.max(2.5, Math.floor(fit * 10) / 10) + 'pt"';
  } catch (e) { return ''; }
}
/* Usable width of one seat box on the printed grid, in points. */
function gridCellPt(r, portrait) {
  var pageMm = portrait ? 210 : 297;
  var cellMm = (pageMm - 12 - 16 - 9) / r.rows - 1.1;   // page margins, body padding, Seat column, cell padding
  return cellMm * 72 / 25.4;
}


/* Print a whole HTML document from a hidden iframe: works where
   window.open() is blocked (sandboxed previews, some SOE browsers). */
function printInHiddenFrame(doc, onError) {
  var frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(doc);
  frame.contentDocument.close();
  setTimeout(function () {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch (e) { if (onError) onError(e); }
    setTimeout(function () { frame.remove(); }, 4000);
  }, 600);
}
