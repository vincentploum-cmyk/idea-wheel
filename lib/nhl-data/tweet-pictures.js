// Lines posted as a picture. Most teams' own accounts (and some writers) tweet the game-day
// lineup as a photo — a handwritten notebook page (@NJDevils, "We're all in." + a picture),
// a whiteboard, a designed lineup graphic — with no text for the parser in gamedaytweets.js to
// read: on the Devils' page of 2026-10-30, 29 of the newest 50 tweets were pictures and 7 held
// text lines, the newest of those thirteen days old, so the rink showed NHL.com's preview or
// a carried lineup while the writers' lines sat in the photo.
//
// This reads them: the GameDayTweets block carries the status id, X's public syndication
// endpoint (what every embedded tweet loads) answers with the tweet's photos (and resolves a
// repost to the original), the photo is handed to Claude with the team's roster, and the
// answer — plain line combinations, "Meier - Hischier - Evangelista" a row — goes through the
// same roster-aware parser as a text tweet (parseLineTweet: three forward lines with two
// roster hits each at least, so a misread cannot put a stranger on the ice). Tesseract read
// the Devils' notebook as "© BUD, Gritsyus5-u ESE i=", so the OCR the cheat sheets use is not
// an option for handwriting. One model call per photo, each tweet read once and stored
// (ingest.js keeps the record at data/lineups/pictures/<id>.json), a budget per run.
//
// Needs ANTHROPIC_API_KEY on the server; without it nothing here runs and the lineups file
// says so. NHL_LINES_PICTURES=off turns it off, NHL_LINES_VISION_MODEL picks the model.
// No store import here: tools/lines-picture.mjs runs this file outside Next.
import Anthropic from '@anthropic-ai/sdk';
import { parseLinesPage, parseLineTweet, parseLineChanges, confirmsSameLines } from './gamedaytweets';

export const SYNDICATION_URL = 'https://cdn.syndication.twimg.com/tweet-result';
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MAX_PICTURE_TWEETS = 3;   // picture tweets read per team per pass, newest first, until one holds lines
export const MAX_PHOTOS = 2;           // photos read per tweet
export const MAX_READS_PER_RUN = 12;   // model calls one ingest may make across its teams
export const RETRY_ERROR_MS = 10 * 60 * 1000; // a failed read is tried again after this long
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;   // the API takes 5 MB an image; bigger photos are scaled down
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', Accept: '*/*' };

/** True when the server can read pictures: a key in the env and the switch not off. */
export function picturesEnabled(env = process.env) {
  return env.NHL_LINES_PICTURES !== 'off' && !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
}
export const visionModel = (env = process.env) => env.NHL_LINES_VISION_MODEL || DEFAULT_MODEL;

/** The syndication endpoint's `token` for a status id: the id over 1e15 times π in base 36, zeros and the point dropped. */
export function syndicationToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

const bareUrl = (u) => String(u || '').split('?')[0];

/** The photos of a syndication payload (own first, then a quoted tweet's), de-duplicated: [{ url, width, height }]. */
export function photosOf(json) {
  const out = [];
  const seen = new Set();
  const add = (p) => {
    const url = bareUrl(p?.url || p?.media_url_https);
    if (!url || seen.has(url) || !/^https:\/\/pbs\.twimg\.com\//.test(url)) return;
    seen.add(url);
    out.push({ url, width: p.width || p.original_info?.width || null, height: p.height || p.original_info?.height || null });
  };
  for (const t of [json, json?.quotedTweet].filter(Boolean)) {
    for (const p of t.photos || []) add(p);
    for (const m of t.mediaDetails || []) if (m?.type === 'photo') add(m);
  }
  return out;
}

/** A tweet's photos through the syndication endpoint: { photos, user, text, status }. A tweet gone or protected answers with no photos. */
export async function fetchTweetPhotos(id, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!/^\d{15,20}$/.test(String(id || ''))) return { photos: [], status: 'bad id' };
  const res = await fetchImpl(`${SYNDICATION_URL}?id=${id}&token=${syndicationToken(id)}`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 404) return { photos: [], status: 404 };
  if (!res.ok) throw new Error(`syndication answered ${res.status} for ${id}`);
  const text = await res.text();
  if (!text.trim()) return { photos: [], status: 'empty' };
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`syndication answered no JSON for ${id}`); }
  if (json?.tombstone || json?.__typename === 'TweetTombstone') return { photos: [], status: 'tombstone' };
  return { photos: photosOf(json), user: json?.user?.screen_name || null, text: json?.text || null, status: res.status };
}

/** The photo's bytes at X's large size, scaled down through sharp when over the API's limit: { data, mediaType }. */
export async function fetchPhoto(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const full = /\?/.test(url) ? url : `${url}?name=large`;
  const res = await fetchImpl(full, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`photo answered ${res.status}`);
  let data = Buffer.from(await res.arrayBuffer());
  let mediaType = (res.headers.get('content-type') || '').split(';')[0].trim() || (/\.png$/i.test(bareUrl(url)) ? 'image/png' : 'image/jpeg');
  if (!/^image\/(jpeg|png|gif|webp)$/.test(mediaType)) mediaType = 'image/jpeg';
  if (data.length > MAX_IMAGE_BYTES) {
    const sharp = (await import('sharp')).default;
    data = await sharp(data).resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    mediaType = 'image/jpeg';
  }
  return { data, mediaType };
}

/**
 * The picture tweets worth reading on a page, newest first: inside the same date window
 * latestTeamLines reads (dated `since` or later, posted no later than `until`), carrying a
 * link (X writes a photo into the text as a t.co link), not readable as lines themselves,
 * and newer than the newest text tweet that is — an older picture can never win over it.
 * A confirmation or a change tweet reaches back past the date floor the way the reader does.
 */
export function pictureCandidates(html, roster, { since = null, until = null, max = MAX_PICTURE_TWEETS } = {}) {
  const untilDate = until ? String(until).slice(0, 10) : null;
  const out = [];
  let reach = false;
  for (const tw of parseLinesPage(html)) {
    if (!reach && since && tw.date && tw.date < since) break;
    if (until && (tw.at ? tw.at > until : tw.date && tw.date > untilDate)) continue;
    if (parseLineTweet(tw.text, roster)) break;
    if (confirmsSameLines(tw.text) || parseLineChanges(tw.text, roster)) reach = true;
    if (!tw.id || !/https?:\/\/t\.co\//.test(tw.text)) continue;
    out.push(tw);
    if (out.length >= max) break;
  }
  return out;
}

const NOT_A_UNIT = /\b(goalies?|goaltenders?|starter|starting|in net|pp\d?|power ?play|pk|penalty|extras?|scratch|injured|ir)\b/i;

/**
 * The model's answer as text parseLineTweet reads: fences, bullets, numbering and "L1:" /
 * "Pair 2:" / "Forwards:" prefixes stripped, a unit written with commas or slashes joined with
 * dashes, goalie and special-teams rows dropped. Null for NONE or nothing left.
 */
export function transcriptionText(raw) {
  const body = String(raw || '').replace(/```[a-z]*\n?/gi, '').trim();
  if (!body || /^\s*none\b/i.test(body)) return null;
  const rows = [];
  for (const line0 of body.split('\n')) {
    let line = line0.trim()
      .replace(/^[-•*·]\s+/, '')
      .replace(/^\(?\d{1,2}[.)]\s*/, '')
      .replace(/^(?:line|pair|forwards?|defen[cs]e(?:men)?|f|d|l|p)\s*\d*\s*(?:[:.)]|[-–—](?=\s))\s*/i, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim();
    if (!line || /^(forwards?|defen[cs]e(?:men)?|lines?|pairs?|goalies?)\s*:?$/i.test(line) || NOT_A_UNIT.test(line) || /:/.test(line)) continue;
    if (!/\s[-–—]\s|[-–—]/.test(line) && /[,/]/.test(line)) {
      const parts = line.split(/\s*[,/]\s*/).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 3) line = parts.join(' - ');
    }
    rows.push(line);
  }
  return rows.length ? rows.join('\n') : null;
}

const posGroup = (p) => (p.pos === 'D' ? 'D' : p.pos === 'G' ? 'G' : 'F');

/** The instruction the model reads once per photo; the roster rides on the user turn. */
export const SYSTEM_PROMPT = [
  'You read NHL line combinations off a photo for a lineup parser. The photo may show a handwritten page, a whiteboard, a team\'s lineup graphic or a screenshot; it may be photographed at an angle.',
  'Answer with the line combinations only: one unit a line, the names separated by " - ", forward lines as three names and defense pairs as two, the top line first, then the pairs. Last names are enough.',
  'Spell a name as the roster below spells it when the written name is clearly that player; keep a name that matches nobody as written. Leave out goalies, power-play units, scratches, headings and any other words.',
  'If the photo shows no line combinations, answer NONE.',
].join('\n');

/** The user turn's text beside the photo: the roster by position group and the tweet's own words. */
export function rosterPrompt(roster, tweetText) {
  const groups = { F: [], D: [], G: [] };
  for (const p of roster || []) if (p?.name) groups[posGroup(p)].push(p.name);
  const lines = [
    `Forwards: ${groups.F.join(', ') || '—'}`,
    `Defense: ${groups.D.join(', ') || '—'}`,
    `Goalies: ${groups.G.join(', ') || '—'}`,
  ];
  const text = String(tweetText || '').replace(/https?:\/\/\S+/g, '').trim();
  return `Roster:\n${lines.join('\n')}${text ? `\n\nThe tweet's text: ${text}` : ''}`;
}

let defaultClient = null;
/** One SDK client per process (the key from the env); tests pass their own. */
export function visionClient() {
  if (!defaultClient) defaultClient = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  return defaultClient;
}

/** One photo → { text, raw, model, usage }: the model's answer, normalised; text null when it saw no lineup. */
export async function readPhoto({ data, mediaType }, roster, { tweetText = '', client = null, model = visionModel() } = {}) {
  const api = client || visionClient();
  const response = await api.messages.create({
    model,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: Buffer.from(data).toString('base64') } },
        { type: 'text', text: rosterPrompt(roster, tweetText) },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') return { text: null, raw: null, model: response.model || model, refused: true };
  const raw = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { text: transcriptionText(raw), raw, model: response.model || model, usage: response.usage || null };
}

/**
 * One picture tweet read end to end: its photos, each read until one gives lines the roster
 * accepts. `budget.reads` counts the model calls left in this run. Returns the stored record:
 * { id, url, status: 'lines' | 'none' | 'nophoto' | 'budget' | 'error', text, photo, photos,
 * model, reads, at, error }.
 */
export async function readTweetPicture(tw, roster, { budget = { reads: MAX_READS_PER_RUN }, fetchImpl = fetch, client = null, model = visionModel(), now = Date.now() } = {}) {
  const base = { id: tw.id, url: tw.url || null, handle: tw.handle || null, at: new Date(now).toISOString(), reads: 0, photos: 0 };
  try {
    const { photos, status } = await fetchTweetPhotos(tw.id, { fetchImpl });
    base.photos = photos.length;
    if (!photos.length) return { ...base, status: 'nophoto', detail: status };
    let last = null;
    for (const photo of photos.slice(0, MAX_PHOTOS)) {
      if (budget.reads <= 0) return { ...base, status: 'budget', ...(last ? { raw: last.raw } : {}) };
      const image = await fetchPhoto(photo.url, { fetchImpl });
      budget.reads -= 1;
      base.reads += 1;
      const read = await readPhoto(image, roster, { tweetText: tw.text, client, model });
      last = read;
      if (read.text && parseLineTweet(read.text, roster)) return { ...base, status: 'lines', text: read.text, raw: read.raw, photo: photo.url, model: read.model };
    }
    return { ...base, status: 'none', raw: last?.raw ?? null, model: last?.model || model, ...(last?.refused ? { refused: true } : {}) };
  } catch (err) {
    return { ...base, status: 'error', error: String(err?.message || err).slice(0, 300) };
  }
}

/**
 * The picture reads a page needs for latestTeamLines: its candidates newest first, each taken
 * from `cache` (get(id) / set(id, record)) or read now, stopping at the first that holds
 * lines. Returns { pictures: { id → record } for latestTeamLines's `pictures`, tried: [{ id,
 * status, … }] for the lineups file }. A record in error is read again after RETRY_ERROR_MS;
 * a 'budget' record is not kept.
 */
export async function pictureLinesFor(html, roster, { since = null, until = null, cache = null, budget = { reads: MAX_READS_PER_RUN }, fetchImpl = fetch, client = null, model = visionModel(), now = Date.now() } = {}) {
  const pictures = {};
  const tried = [];
  for (const tw of pictureCandidates(html, roster, { since, until })) {
    let rec = cache ? await Promise.resolve(cache.get(tw.id)).catch(() => null) : null;
    const stale = rec && (rec.status === 'budget' || (rec.status === 'error' && !(Date.parse(rec.at || '') > now - RETRY_ERROR_MS)));
    let fromCache = !!rec && !stale;
    if (!fromCache) {
      rec = await readTweetPicture(tw, roster, { budget, fetchImpl, client, model, now });
      if (cache && rec.status !== 'budget') await Promise.resolve(cache.set(tw.id, rec)).catch(() => {});
    }
    tried.push({ id: tw.id, handle: tw.handle, date: tw.date, status: rec.status, photos: rec.photos ?? 0, reads: rec.reads ?? 0, cached: fromCache, ...(rec.error ? { error: rec.error } : {}) });
    if (rec.status === 'lines' && rec.text) { pictures[tw.id] = { text: rec.text, photo: rec.photo || null, model: rec.model || null }; break; }
  }
  return { pictures, tried };
}
