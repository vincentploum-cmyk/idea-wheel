// Daily Faceoff's line combinations (https://www.dailyfaceoff.com/teams/<slug>/line-combinations): a team's even-strength
// lines and pairs as its editors last set them, with when ("updatedAt") and whose report they follow ("sourceName", a
// beat writer, and the post's link). Vincent, 2026-11-14: RotoWire's lineups page carries the goalie, the power-play
// units and the injuries but no lines, so the fallback for lines when no beat writer has tweeted and NHL.com has no
// projected lineup is this page, ahead of PropFinder's depth chart. The page is a Next.js build: everything read is in
// its __NEXT_DATA__ JSON (pageProps.combinations.players: positionIdentifier lw / c / rw / ld / rd, groupIdentifier
// f1–f4 / d1–d3, categoryIdentifier "ev"). Checked 2026-11-14: 200 to a browser user agent from the workspace; whether
// the site's own server is served is reported on every lineup read (`dailyfaceoff` in the refresh response).
import { normName } from './model-key';
import { getText } from '../picks/http';

export const DF_SLUGS = {
  ANA: 'anaheim-ducks', BOS: 'boston-bruins', BUF: 'buffalo-sabres', CGY: 'calgary-flames', CAR: 'carolina-hurricanes', CHI: 'chicago-blackhawks',
  COL: 'colorado-avalanche', CBJ: 'columbus-blue-jackets', DAL: 'dallas-stars', DET: 'detroit-red-wings', EDM: 'edmonton-oilers', FLA: 'florida-panthers',
  LAK: 'los-angeles-kings', MIN: 'minnesota-wild', MTL: 'montreal-canadiens', NSH: 'nashville-predators', NJD: 'new-jersey-devils', NYI: 'new-york-islanders',
  NYR: 'new-york-rangers', OTT: 'ottawa-senators', PHI: 'philadelphia-flyers', PIT: 'pittsburgh-penguins', SJS: 'san-jose-sharks', SEA: 'seattle-kraken',
  STL: 'st-louis-blues', TBL: 'tampa-bay-lightning', TOR: 'toronto-maple-leafs', UTA: 'utah-mammoth', VAN: 'vancouver-canucks', VGK: 'vegas-golden-knights',
  WSH: 'washington-capitals', WPG: 'winnipeg-jets',
};
export const dfUrl = (abbr) => (DF_SLUGS[abbr] ? `https://www.dailyfaceoff.com/teams/${DF_SLUGS[abbr]}/line-combinations` : null);
/** Lines older than this many days before the game are not used: a chart nobody has touched is no better than a guess. */
export const DF_MAX_AGE_DAYS = 5;

const POS = { lw: 'LW', c: 'C', rw: 'RW', ld: 'D', rd: 'D' };

/**
 * The page read: { team (the page's own code), at (ISO, when the lines were last set), by (whose report), url (the post),
 * players: { normName → { name, pos, line } } } — the even-strength skaters only, twelve forwards and six defensemen on
 * a full page; null when the page carries no line combinations.
 */
export function parseLineCombinations(html) {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html || ''));
  if (!m) return null;
  let c;
  try { c = JSON.parse(m[1])?.props?.pageProps?.combinations; } catch { return null; }
  if (!c || !Array.isArray(c.players)) return null;
  const players = {};
  for (const p of c.players) {
    if (p?.categoryIdentifier !== 'ev' || !p.name) continue;
    const pos = POS[p.positionIdentifier]; const g = /^([fd])([1-4])$/.exec(p.groupIdentifier || '');
    if (!pos || !g || (g[1] === 'd') !== (pos === 'D')) continue;
    const key = normName(p.name);
    if (key && !players[key]) players[key] = { name: p.name, pos, line: Number(g[2]) };
  }
  if (!Object.keys(players).length) return null;
  return { team: c.teamAbbreviation || null, at: c.updatedAt || null, by: c.sourceName || null, url: c.source || null, players };
}

/** One team's page: { players, meta: { at, date (ET), by, url, page } } or null (no page, or no lines on it). */
export async function fetchDfTeam(abbr) {
  const page = dfUrl(abbr);
  if (!page) return null;
  const read = parseLineCombinations(await getText(page, { tries: 2, timeoutMs: 12000 }));
  if (!read) return null;
  const date = read.at ? new Date(read.at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null;
  return { players: read.players, meta: { at: read.at, date, by: read.by, url: read.url, page } };
}

/** The teams' pages, one at a time with a gap: { ABBR: { players, meta } | { none } | { error } }, each stamped `fetchedAt`. */
export async function fetchDfLines(abbrs, fetchedAt = new Date().toISOString()) {
  const out = {};
  for (const abbr of abbrs || []) {
    if (Object.keys(out).length) await new Promise((r) => setTimeout(r, 400));
    try {
      const t = await fetchDfTeam(abbr);
      out[abbr] = t ? { ...t, meta: { ...t.meta, fetchedAt } } : { none: true, fetchedAt };
    } catch (err) {
      out[abbr] = { error: String(err?.message || err), fetchedAt };
    }
  }
  return out;
}

/** Re-read teams replace their entry; a read that failed never erases lines read earlier. */
export function mergeDf(prev, fresh) {
  const df = { ...(prev || {}) };
  for (const [abbr, v] of Object.entries(fresh || {})) if (v?.players || !df[abbr]?.players) df[abbr] = v;
  return df;
}

/**
 * Whether a stored read may stand for `date`'s game: lines set on or before the game day (ET) and no more than
 * DF_MAX_AGE_DAYS before it (a read made after a later game must not lend that game's lines to an earlier one).
 */
export function dfUsable(entry, date) {
  const d = entry?.players && entry.meta?.date;
  if (!d || d > date) return false;
  return (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 86400000 <= DF_MAX_AGE_DAYS;
}

/** { asked, withLines, errors } for the refresh response: says at once whether the server is being served. */
export function dfSummary(fresh) {
  const v = Object.values(fresh || {});
  return { asked: v.length, withLines: v.filter((x) => x.players).length, none: v.filter((x) => x.none).length, errors: [...new Set(v.filter((x) => x.error).map((x) => x.error.replace(/https?:\/\/\S+/g, '').trim()))].slice(0, 3) };
}
