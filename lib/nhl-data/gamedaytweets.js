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
  const byFirst = {};
  for (const p of roster || []) {
    const { first, last } = split(p.name);
    if (!last) continue;
    (byLast[last] = byLast[last] || []).push(p);
    (byFirst[first] = byFirst[first] || []).push(p);
    byFull[normName(p.name)] = p;
  }
  const isF = (p) => ['C', 'LW', 'RW', 'L', 'R', 'F'].includes(p.pos);
  // Every roster player a token could be, before the position group breaks a tie.
  const candidates = (token) => {
    const n = normName(token);
    if (!n) return [];
    if (byFull[n]) return [byFull[n]];
    let initial = null;
    let last = n;
    const im = n.match(/^([a-z]) (.+)$/);
    if (im) { initial = im[1]; last = im[2]; }
    let cands = byLast[last] || [];
    if (!cands.length && !im && /\s/.test(String(token).trim())) {
      // "Jack Hughes" written in full but with a different spelling of the first name. Only a
      // token with a real space: "Bennett-Tkachuk" is two surnames the hyphen split missed, not
      // a first name and a surname.
      const { first, last: l2 } = split(token);
      cands = (byLast[l2] || []).filter((p) => split(p.name).first[0] === first[0]);
    }
    if (initial) cands = cands.filter((p) => split(p.name).first[0] === initial);
    return cands;
  };
  const match = (token, group) => {
    let cands = candidates(token);
    if (cands.length > 1 && group) cands = cands.filter((p) => (group === 'F' ? isF(p) : p.pos === 'D'));
    return cands.length === 1 ? cands[0] : null;
  };
  match.candidates = candidates;
  // A first name on its own ("Timo", "Nico"): the one roster player who carries it.
  match.first = (token) => { const c = byFirst[normName(token)] || []; return c.length === 1 ? c[0] : null; };
  return match;
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
 * it does not read like a set of lines. `roster` is the team's players, and it decides
 * the group a row belongs to: a pair holds a defenseman; two forwards side by side are
 * a short forward line (an 11-forward, 7-defenseman night), never a pair; three names
 * are always a forward line. At most four lines and three pairs. A surname two roster
 * players share ("Tkachuk" with Brady and Matthew both dressed) is the one the tweet
 * did not place elsewhere ("B. Tkachuk - Eller - Reinhart" on another line).
 */
export function parseLineTweet(text, roster) {
  const match = rosterMatcher(roster);
  const forwards = [];
  const defense = [];
  const isD = (p) => p.pos === 'D';
  const row = (names, group) => names.map((n) => { const p = match(n, group); return p ? { name: p.name, id: p.id } : { name: n, id: null, token: n }; });
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
      forwards.push(row(pick.names, 'F'));
    } else if (pick.names.length === 2 && pick.hits >= 1) {
      const placed = pick.names.map((n) => match(n, 'D') || match(n, 'F')).filter(Boolean);
      if (placed.some(isD)) { if (defense.length < 3) defense.push(row(pick.names, 'D')); }
      else if (forwards.length < 4) forwards.push(row(pick.names, 'F'));
    }
  }
  if (forwards.length < 3) return null;
  // A shared surname the tweet left unresolved: the roster player not placed elsewhere in it.
  const taken = new Set([...forwards.flat(), ...defense.flat()].map((p) => p.id).filter((id) => id != null));
  for (const p of [...forwards.flat(), ...defense.flat()]) {
    if (p.id != null || !p.token) continue;
    const free = match.candidates(p.token).filter((c) => !taken.has(c.id));
    if (free.length === 1) { p.name = free[0].name; p.id = free[0].id; taken.add(free[0].id); }
  }
  for (const p of [...forwards.flat(), ...defense.flat()]) delete p.token;
  return { forwards, defense };
}

/** Parsed lines → the { normName → { name, id, pos, line } } shape the position snapshot stores. */
export function linesToPlayers(lines) {
  const players = {};
  lines.forwards.forEach((row, i) => row.forEach((p, k) => { players[normName(p.name)] = { name: p.name, id: p.id, pos: FWD[k], line: i + 1 }; }));
  lines.defense.forEach((row, i) => row.forEach((p) => { players[normName(p.name)] = { name: p.name, id: p.id, pos: 'D', line: i + 1 }; }));
  return players;
}

// A tweet that confirms the previous lines without repeating them ("Sturm: Same lineup,
// Swayman in net.", "No changes to the lines", "Lines unchanged from Tuesday").
const SAME_LINES = /\b(same (lineup|line-?up|lines|forward lines|group|combos?|d-?pairs?|pairs|pairings|look)|(lineup|lines|pairs|combos?) (is |are |remains? |stays? )?(the )?same|unchanged|no (lineup |line |line-?up )?changes?|no changes? to (the )?(lineup|lines)|running it back)\b/i;
export const confirmsSameLines = (text) => SAME_LINES.test(String(text || '').replace(/https?:\/\/\S+/g, ''));

// A tweet that changes some lines without reposting them all ("#NJDevils line changes:
// Arseny Gritsyuk is headed up to the Jack Hughes line with Jesper Bratt tonight. Mercer up
// with Timo and Nico. Mantha with Rodrigues and Noesen."). It needs a change cue and at least
// one sentence naming two or three roster players.
const CHANGE_CUE = /\b(line ?changes?|changes? (to|on|up front|at forward|on d)|headed (up|down)|mov(es?|ing|ed) (up|down|to|onto)|(up|down) (with|alongside|beside|next to)|(back )?(with|alongside) [A-Z]|swap|flip|in for|replac|slots? in|drops? (to|down)|bump|promot|shuffl|new look|reunit|rejoin|joins?|skating with|slides? (up|down|to|in))\b/i;
const NAME_WORD = /^[A-ZÀ-Ž][A-Za-zÀ-ž'’.\-]*$/;
const FIRST_NAME_STOP = new Set(['will', 'max', 'mark', 'chase', 'jack', 'nick', 'drew', 'reid', 'cole', 'chance', 'rush']);

/** The roster players a prose sentence names, in order: full names, surnames, then lone first names. */
function sentencePlayers(sentence, match) {
  const words = sentence.replace(/[,;:()"“”]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  const take = (p) => { if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); } };
  for (let i = 0; i < words.length;) {
    let used = 0;
    for (const len of [3, 2]) {
      const run = words.slice(i, i + len);
      if (run.length === len && run.every((w) => NAME_WORD.test(w))) {
        const c = match.candidates(run.join(' '));
        if (c.length === 1) { take(c[0]); used = len; break; }
      }
    }
    if (!used && NAME_WORD.test(words[i])) {
      const c = match.candidates(words[i]);
      if (c.length === 1) take(c[0]);
      else if (!c.length && i > 0 && !FIRST_NAME_STOP.has(normName(words[i]))) take(match.first(words[i]));
      used = 1;
    }
    i += used || 1;
  }
  return out;
}

/**
 * One prose change tweet → [{ players: [{name,id,pos}×2-3] }…] (each sentence's named
 * group), or null when the tweet carries no change cue or no group. A sentence about the
 * power play, the penalty kill or the net never forms a group.
 */
export function parseLineChanges(text, roster) {
  const clean = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/[#@]\w+/g, ' ');
  if (!CHANGE_CUE.test(clean) || confirmsSameLines(clean)) return null;
  const match = rosterMatcher(roster);
  const groups = [];
  for (const sentence of clean.split(/(?<=[.!?])\s+|\n+/)) {
    const body = sentence.replace(/^[^:]{0,40}:\s*/, '');
    if (!body.trim() || SKIP_LINE.test(body) || /\b(pp|pk|power|penalty|net|goalie|starts?|starting)\b/i.test(body)) continue;
    const players = sentencePlayers(body, match);
    if (players.length < 2 || players.length > 3) continue;
    const dCount = players.filter((p) => p.pos === 'D').length;
    if (dCount && (dCount !== players.length || players.length !== 2)) continue; // a pair is two defensemen; a line holds no defenseman
    groups.push({ players: players.map((p) => ({ name: p.name, id: p.id, pos: p.pos })) });
  }
  return groups.length ? groups : null;
}

/**
 * Apply change groups to a full set of lines. Each group lands on the row it shares the most
 * players with: the players who stay keep their slots, the newcomers take the vacated slots
 * in the order named, and a player a newcomer left behind moves into the newcomer's old slot
 * when nothing else claims it (a swap). Rows the groups never touch stay as they were.
 */
export function applyLineChanges(lines, groups) {
  const forwards = lines.forwards.map((row) => row.map((p) => ({ ...p })));
  const defense = lines.defense.map((row) => row.map((p) => ({ ...p })));
  const idOf = (p) => p?.id ?? `name:${normName(p?.name || '')}`;
  const find = (rows, id) => { for (let r = 0; r < rows.length; r++) { const k = rows[r].findIndex((p) => p && idOf(p) === id); if (k >= 0) return { r, k }; } return null; };
  const displaced = [];
  for (const g of groups || []) {
    const isPair = g.players.every((p) => p.pos === 'D');
    const rows = isPair ? defense : forwards;
    if (!rows.length) continue;
    const ids = g.players.map(idOf);
    let best = null;
    rows.forEach((row, r) => { const shared = row.filter((p) => p && ids.includes(idOf(p))).length; if (shared && (!best || shared > best.shared)) best = { r, shared }; });
    if (!best) continue;
    const row = rows[best.r];
    const stay = new Set(row.filter((p) => p && ids.includes(idOf(p))).map(idOf));
    const incoming = g.players.filter((p) => !stay.has(idOf(p)));
    const vacated = row.map((p, k) => (p && !stay.has(idOf(p)) ? k : -1)).filter((k) => k >= 0);
    incoming.forEach((p, i) => {
      const slot = vacated[i];
      if (slot == null) return;
      const leaving = row[slot];
      const from = find(rows, idOf(p));
      row[slot] = { name: p.name, id: p.id };
      if (from && !(from.r === best.r && from.k === slot)) rows[from.r][from.k] = null;
      if (leaving) displaced.push({ p: leaving, rows });
    });
  }
  // Swaps: a player pushed off a row takes an empty slot, the one his replacement left first.
  for (const { p, rows } of displaced) {
    if (find(rows, idOf(p))) continue;
    const hole = (() => { for (let r = 0; r < rows.length; r++) { const k = rows[r].indexOf(null); if (k >= 0) return { r, k }; } return null; })();
    if (hole) rows[hole.r][hole.k] = { name: p.name, id: p.id };
  }
  const drop = (rows) => rows.map((row) => row.filter(Boolean)).filter((row) => row.length >= 2);
  return { forwards: drop(forwards), defense: drop(defense) };
}

/**
 * Newest usable lines tweet for a team from an already-fetched page, dated `since` or later
 * and, with `until` (an ISO instant: the game's start plus a few hours), posted no later
 * than that: a page read after the game still answers with the lines for that game, not
 * the next day's practice. A tweet with no posting time is judged by its date. A newer
 * tweet that only confirms the lines ("same lineup") stands for the lines tweet before it:
 * the lines are that older tweet's, the time and link are the confirmation's, so the read
 * counts as game-day and the chain knows the lineup is in. `pictures` (status id → { text,
 * photo, model }, from tweet-pictures.js) is what a tweet's photo said: a tweet whose text
 * holds no lines is read from that text instead, and the read carries `meta.picture`.
 */
export function latestTeamLines(html, roster, { since = null, until = null, pictures = null } = {}) {
  const untilDate = until ? String(until).slice(0, 10) : null;
  let confirm = null;
  const changes = []; // newest first; each applied, oldest first, to the full lines tweet before them
  for (const tw of parseLinesPage(html)) {
    if (!confirm && !changes.length && since && tw.date && tw.date < since) break; // newest first; a confirmation or a change may reach back past the floor
    if (until && (tw.at ? tw.at > until : tw.date && tw.date > untilDate)) continue; // posted after the game
    let lines = parseLineTweet(tw.text, roster);
    let picture = null;
    if (!lines && tw.id && pictures?.[tw.id]?.text) {
      lines = parseLineTweet(pictures[tw.id].text, roster);
      if (lines) picture = { photo: pictures[tw.id].photo || null, model: pictures[tw.id].model || null, text: pictures[tw.id].text };
    }
    if (!lines) {
      if (!confirm && !changes.length && confirmsSameLines(tw.text)) { confirm = tw; continue; }
      const groups = parseLineChanges(tw.text, roster);
      if (groups) changes.push({ tw, groups });
      continue;
    }
    const by = confirm || changes[0]?.tw || tw;
    if (changes.length) for (const c of [...changes].reverse()) lines = applyLineChanges(lines, c.groups);
    const from = { handle: tw.handle, date: tw.date, at: tw.at, url: tw.url, text: tw.text, ...(picture ? { picture } : {}) };
    return {
      players: linesToPlayers(lines),
      forwards: lines.forwards.length, pairs: lines.defense.length,
      matched: [...lines.forwards.flat(), ...lines.defense.flat()].filter((p) => p.id).length,
      meta: {
        source: 'gamedaytweets', handle: by.handle, date: by.date, at: by.at, url: by.url, text: by.text,
        ...(picture ? { picture } : {}),
        ...(confirm ? { confirmed: true } : {}),
        ...(changes.length ? { changed: changes.length } : {}),
        ...(confirm || changes.length ? { linesFrom: from } : {}),
      },
    };
  }
  return null;
}

/**
 * Fetch one team's lines page and return its newest usable lines, or null. `pictures` is
 * either the map latestTeamLines takes or an async function of the page's HTML that builds
 * it (tweet-pictures.js's pictureLinesFor, bound to the store by ingest.js).
 */
const pageCache = new Map(); // abbr → { at, html }: a page is asked for at most once per PAGE_TTL_MS
const PAGE_TTL_MS = 10 * 60 * 1000;

async function withPictures(html, roster, { since, until, pictures }) {
  const map = typeof pictures === 'function' ? (await pictures(html, roster, { since, until }))?.pictures || null : pictures;
  return latestTeamLines(html, roster, { since, until, pictures: map });
}

export async function fetchTeamLines(abbr, roster, { since = null, until = null, pictures = null, timeoutMs = 10000, retryMs = 3000 } = {}) {
  const hit = pageCache.get(abbr);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return withPictures(hit.html, roster, { since, until, pictures });
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
  return withPictures(html, roster, { since, until, pictures });
}
