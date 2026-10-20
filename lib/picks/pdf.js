// A PDF cheat sheet as tables: every page's text runs, placed by their coordinates, rebuilt into
// rows (runs on one baseline) and cells (runs separated by more than a character's width), so
// the same parser that reads a CSV reads a PDF's table. Pure: a buffer in, tables out.
// pdf-parse's bundled pdf.js (a CommonJS build Node and Jest both load); its page renderer hook
// hands over each page's text items with their positions.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

/**
 * Text runs → rows of cells: runs within `rowTol` of a baseline share a row; a gap wider than
 * `gapChars` characters starts a cell. The cells are then placed on the page's columns (the
 * starts of cells clustered within `colTol` points), so a row whose cell is blank, which a PDF
 * simply does not draw, keeps its other cells in their columns.
 */
export function runsToRows(runs, { rowTol = 2.5, gapChars = 0.9, colTol = 14 } = {}) {
  return alignColumns(runsToCells(runs, { rowTol, gapChars }), { colTol });
}

/** Rows of positioned cells, [{ text, x, end }], in reading order. */
export function runsToCells(runs, { rowTol = 2.5, gapChars = 0.9 } = {}) {
  const items = runs.filter((r) => r.str && r.str.trim()).map((r) => ({ ...r, str: r.str.replace(/\s+/g, ' ') }));
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of items) {
    const row = rows.length && Math.abs(rows[rows.length - 1].y - it.y) <= rowTol ? rows[rows.length - 1] : null;
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  return rows.map((row) => {
    const sorted = row.items.sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = null;
    for (const it of sorted) {
      const charW = Math.max(3, (it.width || 0) / Math.max(1, it.str.length), (it.size || 10) * 0.5);
      if (cur && it.x - cur.end <= charW * gapChars) { cur.text += (it.x - cur.end > charW * 0.25 ? ' ' : '') + it.str; cur.end = it.x + (it.width || 0); }
      else { cur = { text: it.str, x: it.x, end: it.x + (it.width || 0) }; cells.push(cur); }
    }
    return cells.map((c) => ({ text: c.text.trim(), x: c.x, end: c.end }));
  });
}

/**
 * Cells placed on columns: every cell start on the page, sorted, clustered where the gap to the
 * next is under `colTol`; each cell lands on the nearest column (two in one column are joined),
 * and every row carries every column so the header's columns line up with the body's.
 */
export function alignColumns(cellRows, { colTol = 14 } = {}) {
  const xs = cellRows.flatMap((row) => row.map((c) => c.x)).sort((a, b) => a - b);
  const cols = [];
  for (const x of xs) {
    const last = cols[cols.length - 1];
    if (last && x - last.max <= colTol) { last.max = x; last.sum += x; last.n++; }
    else cols.push({ min: x, max: x, sum: x, n: 1 });
  }
  const centers = cols.map((c) => c.sum / c.n);
  if (!centers.length) return cellRows.map(() => []);
  return cellRows.map((row) => {
    const out = new Array(centers.length).fill('');
    for (const c of row) {
      let best = 0;
      for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - c.x) < Math.abs(centers[best] - c.x)) best = i;
      out[best] = out[best] ? `${out[best]} ${c.text}` : c.text;
    }
    // Trailing blanks go, so a title line stays one cell.
    while (out.length && !out[out.length - 1]) out.pop();
    return out;
  });
}

/** Every page of a PDF as a table: [{ sheet: 'Page 1', rows: [[cell, …], …] }]. */
export async function pdfTables(buffer, { maxPages = 400 } = {}) {
  const out = [];
  await pdfParse(Buffer.from(buffer), {
    max: maxPages,
    pagerender: async (page) => {
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const runs = content.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, size: Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10 }));
      out.push({ sheet: `Page ${page.pageIndex + 1}`, rows: runsToRows(runs) });
      return '';
    },
  });
  return out;
}

/**
 * A small PDF with text placed at coordinates (Helvetica), for tests and fixtures:
 * lines = [{ x, y, text, size }] in PDF points on one page.
 */
export function makeTextPdf(lines, { width = 612, height = 792 } = {}) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = lines.map((l) => `BT /F1 ${l.size || 10} Tf ${l.x} ${l.y} Td (${esc(l.text)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
