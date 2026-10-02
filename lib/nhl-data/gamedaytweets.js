// Beat-writer line combinations from gamedaytweets.com/lines, the collection
// of "@GameDayLines" tweets. NHL.com's projected lineup usually appears only a
// few hours before puck drop; the writers post practice lines and warm-up
// lines much earlier. This reads the per-team page (…/lines?team=NYR), finds
// the newest tweet that reads like a full set of lines, and maps the last
// names onto the team's roster so the rink gets real players.
//
// Tweets are free text ("Bjorkstrand-Miller-Dorofeyev", "A. Protas-I. Protas-
// Kyrou", "Ekman-Larsson - Stecher"), so the parser is roster-aware: a group of
// three names is a forward line, two is a pair, and hyphenated last names are
// re-joined when the roster says so. robots.txt allows this page.
import { normName } from './names';

export const GDT_URL = 'https://www.gamedaytweets.com/lines';
// A plain browser request: the site answers 403 to anything that looks like a bot
// when several pages are asked for at once.
const UA = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FWD = ['LW', 'C', 'RW'];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// Lines that are never a five-on-five unit.
const SKIP_LINE = /\b(pp\d?|pk|power ?play|penalty|kill|unit|extras?|scratch|not on the ice|starter|net|injur|ir|lineup|lines|pairs?|practice|skate|warm)\b/i;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** X status ids are snowflakes: the top bits are milliseconds since 2010-11-04T01:42:54.657Z. */
export function tweetTime(id) {
  if (!/^\d{15,20}$/.test(String(id || ''))) return null;
  const ms = Number(BigInt(id) >> 22n) + 1288834974657;
  return Number.isFinite(ms) && ms > 1.4e12 ? new Date(ms).toISOString() : null;
}

/** "Sep 30, 2026" → "2026-09-30". */
export function parseTweetDate(text) {
  const m = String(text || '').trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!m || !MONTHS[m[1].toLowerCase()]) return null;
  return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

/** The tweets on one lines page, newest first: { id, url, handle, date, text }. */
export function parseLinesPage(html) {
  const out = [];
  // The page's script adds "twitter-tweet" to the newest blocks once it runs (as it does in
  // a real browser), so the class list may carry more than the two names.
  const re = /<blockquote class="tweet full-sized-tweet[^"]*">([\s\S]*?)<\/blockquote>/g;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const block = m[1];
    const handle = block.match(/class="handle"[^>]*>\s*@?([^<\s]+)\s*</)?.[1] || null;
    const link = block.match(/href="(https?:\/\/(?:x|twitter)\.com\/[^/"]+\/status\/(\d+))"[^>]*>([^<]+)</);
    const p = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
    if (!p) continue;
    const text = decodeEntities(p[1]
      .replace(/<a class="handle"[^>]*>[\s\S]*?<\/a>/, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''))
      .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    out.push({ id: link?.[2] || null, url: link?.[1] || null, handle, date: link ? parseTweetDate(link[3]) : null, at: tweetTime(link?.[2]), text });
  }
  return out;
}

const split = (n) => { const parts = normName(n).split(' '); return { first: parts[0] || '', last: parts.slice(1).join(' ') }; };

/**
 * Roster-aware last-name matcher for one team. Handles "A. Protas" / "N Foligno"
 * initials, multi-word last names ("Eriksson Ek", "Del Mastro") and picks between
 * same-surname players by the slot's position group (forward line vs pair).
 */
export function rosterMatcher(roster) {
  const byLast = {};
  const byFull = {};
  for (const p of roster || []) {
    const { last } = split(p.name);
    if (!last) continue;
    (byLast[last] = byLast[last] || []).push(p);
    byFull[normName(p.name)] = p;
  }
  const isF = (p) => ['C', 'LW', 'RW', 'L', 'R', 'F'].includes(p.pos);
  return (token, group) => {
    const n = normName(token);
    if (!n) return null;
    if (byFull[n]) return byFull[n];
    let initial = null;
    let last = n;
    const im = n.match(/^([a-z]) (.+)$/);
    if (im) { initial = im[1]; last = im[2]; }
    let cands = byLast[last] || [];
    if (!cands.length && !im) {
      // "Jack Hughes" written in full but with a different spelling of the first name.
      const { first, last: l2 } = split(token);
      cands = (byLast[l2] || []).filter((p) => split(p.name).first[0] === first[0]);
    }
    if (initial) cands = cands.filter((p) => split(p.name).first[0] === initial);
    if (cands.length > 1 && group) cands = cands.filter((p) => (group === 'F' ? isF(p) : p.pos === 'D'));
    return cands.length === 1 ? cands[0] : null;
  };
}

const cleanToken = (t) => t.replace(/[()*]/g, '').replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').split('/')[0].trim();
const looksLikeName = (t) => /^[A-Za-zÀ-ž'’.\- ]{2,32}$/.test(t) && t.split(' ').length <= 3 && !/^\d/.test(t);

/** Split one tweet line into name tokens: spaced dashes win, else bare dashes. */
export function splitNames(line) {
  const s = line.replace(/\s*[|]\s*/g, ' | ');
  if (s.includes(' | ')) return null; // "Allen | Daws" — goalies
  const spaced = /\s+[-–—]+\s+/;
  const parts = spaced.test(s) ? s.split(spaced) : s.split(/[-–—]+/);
  const tokens = parts.map(cleanToken).filter(Boolean);
  return tokens.length >= 2 && tokens.every(looksLikeName) ? tokens : null;
}

/**
 * Re-join tokens that a bare-hyphen split broke apart ("Ekman", "Larsson",
 * "Stecher" → "Ekman-Larsson", "Stecher") by trying every segmentation into
 * groups of one or two adjacent tokens and keeping the one the roster likes best.
 */
function segment(tokens, match, group) {
  let best = null;
  const walk = (i, acc) => {
    if (i === tokens.length) {
      if (acc.length < 2 || acc.length > 3) return;
      const hits = acc.filter((t) => match(t, group)).length;
      const score = hits * 10 - acc.length; // prefer more matches, then fewer names
      if (!best || score > best.score) best = { names: acc, hits, score };
      return;
    }
    walk(i + 1, [...acc, tokens[i]]);
    if (i + 1 < tokens.length) walk(i + 2, [...acc, `${tokens[i]}-${tokens[i + 1]}`]);
  };
  walk(0, []);
  return best;
}

/**
 * One tweet → { forwards: [[{name,id,pos}×3]…], defense: [[…×2]…] }, or null when
 * it does not read like a set of lines. `roster` is the team's players.
 */
export function parseLineTweet(text, roster) {
  const match = rosterMatcher(roster);
  const forwards = [];
  const defense = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || /https?:\/\//i.test(line) || /[#@:]/.test(line) || SKIP_LINE.test(line)) continue;
    const tokens = splitNames(line);
    if (!tokens || tokens.length > 6) continue;
    // Try the tokens as a forward line, then as a pair; the roster decides.
    const asF = tokens.length >= 3 ? segment(tokens, match, 'F') : null;
    const asD = segment(tokens, match, 'D');
    const pick = [asF, asD].filter(Boolean).sort((a, b) => b.score - a.score)[0];
    if (!pick) continue;
    if (pick.names.length === 3 && forwards.length < 4 && pick.hits >= 2) {
      forwards.push(pick.names.map((n) => { const p = match(n, 'F'); return p ? { name: p.name, id: p.id } : { name: n, id: null }; }));
    } else if (pick.names.length === 2 && defense.length < 4 && pick.hits >= 1) {
      defense.push(pick.names.map((n) => { const p = match(n, 'D'); return p ? { name: p.name, id: p.id } : { name: n, id: null }; }));
    }
  }
  return forwards.length >= 3 ? { forwards, defense } : null;
}

/** Parsed lines → the { normName → { name, id, pos, line } } shape the position snapshot stores. */
export function linesToPlayers(lines) {
  const players = {};
  lines.forwards.forEach((row, i) => row.forEach((p, k) => { players[normName(p.name)] = { name: p.name, id: p.id, pos: FWD[k], line: i + 1 }; }));
  lines.defense.forEach((row, i) => row.forEach((p) => { players[normName(p.name)] = { name: p.name, id: p.id, pos: 'D', line: i + 1 }; }));
  return players;
}

/**
 * Newest usable lines tweet for a team from an already-fetched page, dated `since` or later
 * and, with `until` (an ISO instant: the game's start plus a few hours), posted no later
 * than that: a page read after the game still answers with the lines for that game, not
 * the next day's practice. A tweet with no posting time is judged by its date.
 */
export function latestTeamLines(html, roster, { since = null, until = null } = {}) {
  const untilDate = until ? String(until).slice(0, 10) : null;
  for (const tw of parseLinesPage(html)) {
    if (since && tw.date && tw.date < since) break; // newest first
    if (until && (tw.at ? tw.at > until : tw.date && tw.date > untilDate)) continue; // posted after the game
    const lines = parseLineTweet(tw.text, roster);
    if (!lines) continue;
    return {
      players: linesToPlayers(lines),
      forwards: lines.forwards.length, pairs: lines.defense.length,
      matched: [...lines.forwards.flat(), ...lines.defense.flat()].filter((p) => p.id).length,
      meta: { source: 'gamedaytweets', handle: tw.handle, date: tw.date, at: tw.at, url: tw.url, text: tw.text },
    };
  }
  return null;
}

/** Fetch one team's lines page and return its newest usable lines, or null. */
const pageCache = new Map(); // abbr → { at, html }: a page is asked for at most once per PAGE_TTL_MS
const PAGE_TTL_MS = 10 * 60 * 1000;

export async function fetchTeamLines(abbr, roster, { since = null, until = null, timeoutMs = 10000, retryMs = 3000 } = {}) {
  const hit = pageCache.get(abbr);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return latestTeamLines(hit.html, roster, { since, until });
  const get = () => fetch(`${GDT_URL}?team=${encodeURIComponent(abbr)}`, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  let res = await get();
  if (res.status === 403 || res.status === 429) {
    // Refused as too many requests: one more try after a pause.
    await sleep(retryMs);
    res = await get();
  }
  if (!res.ok) {
    // Say who refused: Cloudflare's filter (cf-mitigated) or the site itself.
    const via = res.headers.get('cf-mitigated') ? `cloudflare ${res.headers.get('cf-mitigated')}` : res.headers.get('server') || 'site';
    const body = (await res.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    throw new Error(`gamedaytweets answered ${res.status} for ${abbr} (${via}${body ? `: ${body}` : ''})`);
  }
  const html = await res.text();
  pageCache.set(abbr, { at: Date.now(), html });
  return latestTeamLines(html, roster, { since, until });
}
