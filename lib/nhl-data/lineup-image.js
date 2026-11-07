// Lineup graphics: the beat writers who post their lines as a picture (@sound_hockey's "Kraken
// lineup" card, SEA vs NYR 2026-11-07: "Is the Catton line now the second line? My COLUMN: … Otherwise,
// nothing changes from last game." with the four lines, three pairs, extras and injured in the image
// alone). gamedaytweets.com shows the tweet's text and a t.co link, so the text parser reads nothing;
// the picture is found through X's embed endpoint (the same one its embedded tweets use), read by OCR
// and laid out here against the team's roster.
//
// `parseLineupImage` is pure: words with their boxes → { forwards, defense } in the shape
// parseLineTweet returns. The graphic's own section heads decide who is out (EXTRAS, SCRATCHES,
// INJURED, GOALIES …): a player belongs to the nearest head above him that does not start to his
// right. The roster decides forward or defense; the rows of the picture decide the lines
// (left to right: LW, C, RW), a column layout read the same way turned on its side.
import { normName } from './model-key';
import { similarity } from '../picks/ocr-layout';
import { parseLinesPage, parseLineTweet, tweetTime } from './gamedaytweets';

const FORWARD_POS = new Set(['C', 'LW', 'RW', 'L', 'R', 'F']);
const OUT_HEAD = /^(extras?|scratch(es|ed)?|healthy|injur(ed|ies|y)|ir|ltir|out|reserves?|spares?|goalies?|goaltenders?|netminders?|starters?|backups?|bench|unavailable)$/;
const IN_HEAD = /^(forwards?|defen[cs]e(men)?|lines?|pairs|pairings|lineup|skaters)$/;

const clean = (text) => normName(String(text || '').replace(/[^A-Za-zÀ-ž'’\-. ]/g, ''));
const nameParts = (name) => { const parts = normName(name).split(' '); return { first: parts[0] || '', last: parts.slice(1).join(' ') }; };
const isForward = (p) => FORWARD_POS.has(p.pos);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** How close an OCR'd surname must read to a roster one: shorter names leave less room for a misread letter. */
const fuzzFloor = (len) => (len >= 7 ? 0.7 : 0.75);

/**
 * The roster players a cleaned word (or two words, for "Eriksson Ek") could be: an exact surname first, else the
 * closest surname within the misread allowance ("krkko" → Kakko, "samoskevigh" → Samoskevich), ties kept.
 */
function surnameCandidates(t, index) {
  if (!t || t.length < 2) return [];
  const exact = index.filter((r) => r.last === t);
  if (exact.length || t.length < 4) return exact.map((r) => r.p);
  let best = 0;
  const scored = index.map((r) => { const s = r.last.length >= 4 ? similarity(t, r.last) : 0; if (s > best) best = s; return { r, s }; });
  if (best < fuzzFloor(t.length)) return [];
  return scored.filter((x) => x.s >= best - 0.02).map((x) => x.r.p);
}

const overlapX = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x, b.x);
/** The word right above `w` (a first name stacked over a surname) or right before it on its line. */
function neighbourBefore(w, words) {
  const h = w.y1 - w.y;
  let best = null;
  for (const o of words) {
    if (o === w) continue;
    const above = o.y1 <= w.y + h * 0.3 && w.y - o.y1 < h * 1.2 && overlapX(o, w) > 0;
    const before = Math.abs((o.y + o.y1) / 2 - (w.y + w.y1) / 2) < h * 0.5 && o.x1 <= w.x + 2 && w.x - o.x1 < h * 1.5;
    if (!above && !before) continue;
    const d = above ? w.y - o.y1 : w.x - o.x1;
    if (!best || d < best.d) best = { o, d };
  }
  return best?.o || null;
}

/** The word right after `w`: below it (a surname under a first name) or next on its line. */
function neighbourAfter(w, words) {
  let best = null;
  for (const o of words) if (o !== w && neighbourBefore(o, words) === w) { const d = Math.abs(o.y - w.y) + Math.abs(o.x - w.x); if (!best || d < best.d) best = { o, d }; }
  return best?.o || null;
}

/**
 * The roster players a graphic names, each with its box: [{ p, box, word }]. A first name read beside its surname
 * settles a shared surname, and a word that is the first name of the player named next to it is never a player itself.
 */
export function playersInImage(words, roster) {
  const ws = (words || []).map((w) => ({ ...w, t: clean(w.text) })).filter((w) => w.t && /[a-z]{2}/.test(w.t));
  const index = (roster || []).map((p) => ({ p, ...nameParts(p.name) })).filter((r) => r.last);
  const hits = new Map(); // word → { p, box }
  for (const w of ws) {
    const prev = neighbourBefore(w, ws);
    let cands = surnameCandidates(w.t, index);
    // A two-word surname on one line ("Eriksson Ek", "van Riemsdyk").
    if (!cands.length && prev && Math.abs(prev.y - w.y) < (w.y1 - w.y) * 0.5) cands = surnameCandidates(`${prev.t} ${w.t}`, index);
    if (cands.length > 1 && prev) {
      const byFirst = cands.filter((p) => { const f = nameParts(p.name).first; return f && (similarity(prev.t, f) >= 0.6 || (prev.t.length === 1 && f[0] === prev.t)); });
      if (byFirst.length) cands = byFirst;
    }
    if (cands.length !== 1) continue;
    const box = prev && nameParts(cands[0].name).first && similarity(prev.t, nameParts(cands[0].name).first) >= 0.6
      ? { x: Math.min(prev.x, w.x), x1: Math.max(prev.x1, w.x1), y: Math.min(prev.y, w.y), y1: Math.max(prev.y1, w.y1) }
      : { x: w.x, x1: w.x1, y: w.y, y1: w.y1 };
    hits.set(w, { p: cands[0], box, word: w });
  }
  // "Ryan" over "Winterton" is Winterton's first name, not a player called Ryan.
  for (const [w, hit] of [...hits]) {
    const next = neighbourAfter(w, ws);
    const nextHit = next && hits.get(next);
    if (nextHit && nextHit.p.id !== hit.p.id && similarity(w.t, nameParts(nextHit.p.name).first) >= 0.75) hits.delete(w);
  }
  // One entry a player: the first read of him.
  const seen = new Set();
  return [...hits.values()].filter((h) => { const k = h.p.id ?? normName(h.p.name); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** The graphic's section heads: [{ out (true for extras, scratches, injured, goalies), x, x1, y, y1 }]. */
export function sectionHeads(words, players) {
  const named = new Set(players.map((h) => h.word));
  return (words || []).filter((w) => !named.has(w)).map((w) => {
    const t = clean(w.text);
    if (OUT_HEAD.test(t)) return { out: true, text: t, x: w.x, x1: w.x1, y: w.y, y1: w.y1 };
    if (IN_HEAD.test(t)) return { out: false, text: t, x: w.x, x1: w.x1, y: w.y, y1: w.y1 };
    return null;
  }).filter(Boolean);
}

/** The head a player sits under: above his name, not starting to the right of it, nearest by height then by indent. */
function headOf(box, heads) {
  let best = null;
  for (const h of heads) {
    if (h.y >= (box.y + box.y1) / 2 || h.x > box.x1) continue;
    const d = (box.y - h.y) + Math.abs(box.x - h.x) * 0.5;
    if (!best || d < best.d) best = { h, d };
  }
  return best?.h || null;
}

/** Entries grouped into rows along an axis ('y' = the picture's rows, 'x' = its columns), each row ordered across. */
function rowsAlong(entries, axis, size) {
  if (!entries.length) return [];
  const [a, a1, b] = axis === 'y' ? ['y', 'y1', 'x'] : ['x', 'x1', 'y'];
  const mid = (e) => (e.box[a] + e.box[a1]) / 2;
  const tol = median(entries.map((e) => (axis === 'y' ? e.word.y1 - e.word.y : e.word.x1 - e.word.x))) * (axis === 'y' ? 0.7 : 0.5);
  const sorted = [...entries].sort((p, q) => mid(p) - mid(q));
  const rows = [];
  for (const e of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(mid(e) - row.mid) <= tol) { row.items.push(e); row.mid = row.items.reduce((s, x) => s + mid(x), 0) / row.items.length; }
    else rows.push({ mid: mid(e), items: [e] });
  }
  // A row wider than a line (two blocks side by side) splits at its widest gaps.
  const out = [];
  for (const row of rows) {
    const items = row.items.sort((p, q) => p.box[b] - q.box[b]);
    const cuts = new Set();
    const pieces = Math.ceil(items.length / size);
    if (pieces > 1) {
      const gaps = items.slice(1).map((e, i) => ({ i: i + 1, g: e.box[b] - items[i].box[b] })).sort((p, q) => q.g - p.g);
      gaps.slice(0, pieces - 1).forEach((g) => cuts.add(g.i));
    }
    let cur = [];
    items.forEach((e, i) => { if (cuts.has(i)) { out.push(cur); cur = []; } cur.push(e); });
    out.push(cur);
  }
  return out;
}

const asRow = (row) => row.map((e) => ({ name: e.p.name, id: e.p.id }));

/**
 * A lineup graphic's words ([{ text, x, x1, y, y1 }], the image's pixels) → { forwards, defense } as
 * parseLineTweet returns them, or null when it does not read as a set of lines (three forward lines at least).
 */
export function parseLineupImage(words, roster) {
  const players = playersInImage(words, roster);
  if (players.length < 6) return null;
  const heads = sectionHeads(words, players);
  const dressed = players.filter((h) => { const head = headOf(h.box, heads); return !head?.out; });
  const fwd = dressed.filter((h) => isForward(h.p));
  const def = dressed.filter((h) => h.p.pos === 'D');
  const read = (axis) => {
    const forwards = rowsAlong(fwd, axis, 3).filter((r) => r.length >= 2).slice(0, 4);
    const defense = rowsAlong(def, axis, 2).filter((r) => r.length === 2).slice(0, 3);
    return { forwards, defense };
  };
  // Rows or columns: whichever gives more full lines and pairs (the picture's rows on a tie).
  const full = (r) => r.forwards.filter((row) => row.length === 3).length + r.defense.length + r.forwards.length / 10;
  const rows = read('y');
  const cols = read('x');
  const pick = full(cols) > full(rows) ? cols : rows;
  if (pick.forwards.length < 3) return null;
  return { forwards: pick.forwards.map(asRow), defense: pick.defense.map(asRow) };
}

// ── Finding and reading the pictures ─────────────────────────────────────────────────────────────

/** The token X's embed endpoint asks for with a tweet id (what its own embed script computes). */
export const syndicationToken = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

/** A tweet's photos (largest size) through X's embed endpoint: [url], [] for a tweet without one. */
export async function tweetPhotos(id, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const res = await fetchImpl(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(id)}&lang=en&token=${syndicationToken(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`tweet ${id}: embed endpoint answered ${res.status}`);
  const data = await res.json();
  const photos = (data?.photos || []).map((p) => p?.url).filter(Boolean);
  const media = (data?.mediaDetails || []).filter((m) => m?.type === 'photo').map((m) => m.media_url_https).filter(Boolean);
  return [...new Set([...photos, ...media])].slice(0, 4).map((u) => (/\?/.test(u) ? u : `${u}?name=large`));
}

const IMAGE_SCALE_TARGET = 2600; // the picture is scaled to about this many pixels across for the reader

/** One picture → its words in the picture's own pixels, through the cheat sheets' preparation (auto-inverted, scaled, binarised). */
export async function readImageWords(buffer, reader) {
  const sharp = (await import('sharp')).default;
  const { prepareColumn } = await import('../picks/ocr');
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) return [];
  const scale = Math.max(1, Math.min(3, Math.round(IMAGE_SCALE_TARGET / width)));
  const png = await prepareColumn(buffer, { left: 0, width, height, scale, invert: 'auto' });
  return reader.read(png, { scale });
}

/**
 * The tweets on a lines page worth a look at their pictures: newer than the newest tweet whose text reads as lines,
 * inside the date window, with a link (a photo shows on the page as a t.co link) and no lines in their text. Newest first.
 */
export function imageCandidates(html, roster, { since = null, until = null, max = 3 } = {}) {
  const untilDate = until ? String(until).slice(0, 10) : null;
  const out = [];
  for (const tw of parseLinesPage(html)) {
    if (since && tw.date && tw.date < since) break;
    if (until && (tw.at ? tw.at > until : tw.date && tw.date > untilDate)) continue;
    if (parseLineTweet(tw.text, roster)) break;
    if (tw.id && /https?:\/\/t(\.co|…|\.{3})|pic\.(x|twitter)\.com/i.test(tw.text)) out.push(tw);
    if (out.length >= max) break;
  }
  return out;
}

export const IMAGE_CACHE_PATH = 'data/lineups/gdt-images.json';
const KEEP_DAYS = 4;
const RETRY_MS = 30 * 60 * 1000;
const packWords = (words) => words.map((w) => [w.text, w.x, w.x1, w.y, w.y1, w.conf ?? null]);
const unpackWords = (rows) => (rows || []).map(([text, x, x1, y, y1, conf]) => ({ text, x, x1, y, y1, conf }));

/**
 * Lines read from the pictures of each team's lines page: { [abbr]: { [tweetId]: { lines, image } } }, for
 * latestTeamLines's `images`. A tweet's pictures are read once: their words are kept in the store
 * (IMAGE_CACHE_PATH, a few days) and laid out again against the roster on every read, so a call-up the roster
 * learns later still lands. At most `maxReads` new tweets a call (the post that brings the pages waits on them);
 * the rest wait for the next post. `deps` (readJson, writeJson, fetchImpl, createReader, readImageWords) for tests.
 */
export async function lineupImageLines(teams, { since = null, cutoffs = {}, maxReads = 6, now = Date.now(), deps = {} } = {}) {
  const { readJson, writeJson } = deps.readJson ? deps : await import('../nhl-store');
  const fetchImpl = deps.fetchImpl || fetch;
  const readWords = deps.readImageWords || readImageWords;
  const makeReader = deps.createReader || (async () => (await import('../picks/ocr')).createReader({ psm: '11' }));
  const cache = { ...((await readJson(IMAGE_CACHE_PATH).catch(() => null)) || {}) };
  const out = {};
  const log = [];
  let reader = null;
  let reads = 0;
  let dirty = false;
  try {
    for (const [abbr, { html, roster }] of Object.entries(teams || {})) {
      for (const tw of imageCandidates(html, roster, { since, until: cutoffs[abbr] || null })) {
        let entry = cache[tw.id];
        if (!entry || (entry.error && now - Date.parse(entry.readAt || 0) > RETRY_MS)) {
          if (reads >= maxReads) { log.push(`${abbr} ${tw.id}: deferred`); continue; }
          reads += 1;
          entry = { readAt: new Date(now).toISOString(), photos: [] };
          try {
            const urls = await tweetPhotos(tw.id, { fetchImpl });
            for (const url of urls) {
              const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
              if (!res.ok) throw new Error(`photo answered ${res.status}`);
              if (!reader) reader = await makeReader();
              const words = await readWords(Buffer.from(await res.arrayBuffer()), reader);
              entry.photos.push({ url, words: packWords(words) });
            }
          } catch (err) {
            entry.error = String(err?.message || err).slice(0, 200);
          }
          cache[tw.id] = entry;
          dirty = true;
        }
        for (const photo of entry.photos || []) {
          const lines = parseLineupImage(unpackWords(photo.words), roster);
          if (lines) { (out[abbr] = out[abbr] || {})[tw.id] = { lines, image: photo.url }; log.push(`${abbr} ${tw.id}: ${lines.forwards.length}F/${lines.defense.length}D from the picture`); break; }
        }
        if (out[abbr]?.[tw.id]) break; // the newest picture that reads is the one that counts
        log.push(`${abbr} ${tw.id}: ${entry.error ? `error: ${entry.error}` : entry.photos?.length ? 'picture holds no lines' : 'no picture'}`);
      }
    }
  } finally {
    if (reader) await reader.close().catch(() => {});
  }
  if (dirty) {
    // Old tweets drop out: a page only ever shows the last few days.
    const floor = now - KEEP_DAYS * 86400000;
    for (const id of Object.keys(cache)) { const at = tweetTime(id); if (at && Date.parse(at) < floor) delete cache[id]; }
    await writeJson(IMAGE_CACHE_PATH, cache).catch(() => {});
  }
  return { images: out, reads, log };
}
