// OCR for an image PDF (a cheat sheet rendered as pictures, one image a page): the page images
// pulled straight out of the file (no renderer needed), each page split into its two team
// columns, inverted (light text on dark), scaled up and binarised, then read by tesseract.js
// into words with their boxes in the page's own pixels. The layout parsers
// (lib/nfl/cheatsheet-detailed.js, lib/nba/cheatsheet-ocr.js) turn the words into rows.
import os from 'os';
import path from 'path';
import zlib from 'zlib';

const TARGET_WIDTH = 1800;   // a column is scaled up to about this many pixels for the reader
const THRESHOLD = 150;

/** The reader's scale for a column: 3× a 594 px NFL column, 2× a 1040 px NBA one. */
export const scaleFor = (width) => Math.max(1, Math.min(3, Math.round(TARGET_WIDTH / width)));

/**
 * The page images embedded in a PDF, in file order: [{ width, height, data, raw }]. JPEGs
 * (DCTDecode) come out as they are; Flate-compressed RGB / grey images are inflated and carry
 * `raw: { channels }`. Soft masks (the alpha of another image) are left out.
 */
export function pdfImages(buffer) {
  const b = Buffer.from(buffer);
  const out = [];
  const masks = new Set();
  let i = 0;
  for (;;) {
    const m = b.indexOf('/Subtype', i);
    if (m < 0) break;
    const dictEnd = b.indexOf('>>', m);
    if (dictEnd < 0) break;
    const dictStart = b.lastIndexOf('<<', m);
    const dict = b.slice(dictStart, dictEnd).toString('latin1');
    i = dictEnd + 2;
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    const objHead = b.slice(Math.max(0, dictStart - 40), dictStart).toString('latin1').match(/(\d+)\s+\d+\s+obj\s*$/);
    const obj = objHead ? Number(objHead[1]) : null;
    const mask = dict.match(/\/SMask\s+(\d+)\s+\d+\s+R/);
    if (mask) masks.add(Number(mask[1]));
    const len = Number((dict.match(/\/Length\s+(\d+)/) || [])[1]);
    const width = Number((dict.match(/\/Width\s+(\d+)/) || [])[1]);
    const height = Number((dict.match(/\/Height\s+(\d+)/) || [])[1]);
    const s = b.indexOf('stream', dictEnd);
    if (s < 0 || !len || !width || !height) continue;
    const start = b[s + 6] === 0x0d ? s + 8 : s + 7;
    const data = b.slice(start, start + len);
    if (/DCTDecode/.test(dict)) out.push({ obj, width, height, data, raw: null });
    else if (/FlateDecode/.test(dict) && /\/BitsPerComponent\s+8/.test(dict)) {
      const channels = /DeviceRGB/.test(dict) ? 3 : /DeviceGray/.test(dict) ? 1 : 0;
      if (!channels) continue;
      let pixels;
      try { pixels = zlib.inflateSync(data); } catch { continue; }
      if (pixels.length < width * height * channels) continue;
      out.push({ obj, width, height, data: pixels.subarray(0, width * height * channels), raw: { width, height, channels } });
    }
  }
  return out.filter((img) => img.obj == null || !masks.has(img.obj)).map(({ obj, ...img }) => img);
}

let sharpMod = null;
async function sharp() {
  if (!sharpMod) sharpMod = (await import('sharp')).default;
  return sharpMod;
}

/** One column of a page image ({ data, raw }), prepared for the reader: inverted, grey, scaled, binarised PNG. */
export async function prepareColumn(image, { left, width, height, scale = scaleFor(width) }) {
  const s = await sharp();
  const src = image.raw ? s(image.data, { raw: image.raw }) : s(image.data || image);
  return src.extract({ left, top: 0, width, height }).negate({ alpha: false }).grayscale().resize({ width: width * scale, kernel: 'lanczos3' }).normalise().threshold(THRESHOLD).png().toBuffer();
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
    /** The words of an image prepared at `scale`, back in page pixels: [{ text, x, x1, y, y1, conf }]. */
    async read(png, { offsetX = 0, scale = 3 } = {}) {
      const { data } = await worker.recognize(png);
      return (data.words || []).filter((w) => w.text && w.text.trim()).map((w) => ({
        text: w.text, x: Math.round(w.bbox.x0 / scale) + offsetX, x1: Math.round(w.bbox.x1 / scale) + offsetX, y: Math.round(w.bbox.y0 / scale), y1: Math.round(w.bbox.y1 / scale), conf: Math.round(w.confidence),
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
      const scale = scaleFor(half);
      const left = await r.read(await prepareColumn(img, { left: 0, width: half, height: img.height, scale }), { scale });
      const right = await r.read(await prepareColumn(img, { left: half, width: img.width - half, height: img.height, scale }), { offsetX: 0, scale });
      out.push({ page: i + 1, width: img.width, height: img.height, half, left, right });
      if (onPage) await onPage(i + 1, images.length);
    }
  } finally {
    if (own) await r.close();
  }
  return out;
}
