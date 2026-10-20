// OCR for an image PDF (a cheat sheet rendered as pictures, one JPEG a page): the page images
// pulled straight out of the file (no renderer needed), each page split into its two team
// columns, inverted (light text on dark), scaled up three times and binarised, then read by
// tesseract.js into words with their boxes in the page's own pixels. The layout parser
// (lib/nfl/cheatsheet-detailed.js) turns the words into prop rows.
import os from 'os';
import path from 'path';

const SCALE = 3;
const THRESHOLD = 150;

/** The JPEG images embedded in a PDF (DCTDecode XObjects), in file order: [{ width, height, data }]. */
export function pdfImages(buffer) {
  const b = Buffer.from(buffer);
  const out = [];
  let i = 0;
  for (;;) {
    const m = b.indexOf('/Subtype /Image', i);
    if (m < 0) break;
    const dictEnd = b.indexOf('>>', m);
    if (dictEnd < 0) break;
    const dict = b.slice(b.lastIndexOf('<<', m), dictEnd).toString('latin1');
    const len = Number((dict.match(/\/Length\s+(\d+)/) || [])[1]);
    const width = Number((dict.match(/\/Width\s+(\d+)/) || [])[1]);
    const height = Number((dict.match(/\/Height\s+(\d+)/) || [])[1]);
    const s = b.indexOf('stream', dictEnd);
    if (s > 0 && /DCTDecode/.test(dict) && len) {
      const start = b[s + 6] === 0x0d ? s + 8 : s + 7;
      out.push({ width, height, data: b.slice(start, start + len) });
    }
    i = dictEnd + 2;
  }
  return out;
}

let sharpMod = null;
async function sharp() {
  if (!sharpMod) sharpMod = (await import('sharp')).default;
  return sharpMod;
}

/** One column of a page, prepared for the reader: inverted, grey, scaled, binarised PNG. */
export async function prepareColumn(jpeg, { left, width, height }) {
  const s = await sharp();
  return s(jpeg).extract({ left, top: 0, width, height }).negate({ alpha: false }).grayscale().resize({ width: width * SCALE, kernel: 'lanczos3' }).normalise().threshold(THRESHOLD).png().toBuffer();
}

/**
 * A reader for a job: one tesseract worker, reused page after page. `langPath` / `cachePath`
 * default to the temp dir (the English data is fetched once per instance).
 */
export async function createReader({ logger = null } = {}) {
  const { createWorker } = await import('tesseract.js');
  const cachePath = path.join(os.tmpdir(), 'tesseract-cache');
  const worker = await createWorker('eng', 1, { cachePath, logger: logger || (() => {}) });
  await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
  return {
    /** The words of an image already prepared at SCALE, back in page pixels: [{ text, x, x1, y, y1, conf }]. */
    async read(png, { offsetX = 0 } = {}) {
      const { data } = await worker.recognize(png);
      return (data.words || []).filter((w) => w.text && w.text.trim()).map((w) => ({
        text: w.text, x: Math.round(w.bbox.x0 / SCALE) + offsetX, x1: Math.round(w.bbox.x1 / SCALE) + offsetX, y: Math.round(w.bbox.y0 / SCALE), y1: Math.round(w.bbox.y1 / SCALE), conf: Math.round(w.confidence),
      }));
    },
    async close() { await worker.terminate(); },
  };
}

/**
 * Every page of an image PDF as two columns of words: [{ page, width, height, left: [...words], right: [...words] }].
 * `onPage(n, pages)` reports progress; `maxPages` bounds the work.
 */
export async function ocrPdf(buffer, { onPage = null, maxPages = 40, reader = null } = {}) {
  const images = pdfImages(buffer).slice(0, maxPages);
  if (!images.length) return [];
  const own = !reader;
  const r = reader || await createReader();
  const out = [];
  try {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const half = Math.floor(img.width / 2);
      const left = await r.read(await prepareColumn(img.data, { left: 0, width: half, height: img.height }));
      const right = await r.read(await prepareColumn(img.data, { left: half, width: img.width - half, height: img.height }), { offsetX: 0 });
      out.push({ page: i + 1, width: img.width, height: img.height, half, left, right });
      if (onPage) await onPage(i + 1, images.length);
    }
  } finally {
    if (own) await r.close();
  }
  return out;
}
