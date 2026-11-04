// RotoWire's NBA lineups page (https://www.rotowire.com/basketball/nba-lineups.php): tonight's games, each team's starting
// five with a status line — "Expected Lineup" (a yellow dot) until RotoWire confirms it, then "Confirmed Lineup" — and who
// may not play. Vincent, 2026-11-04: "Can we get a 'lineups confirmed' message next to the teams when the lineups are
// confirmed from rotowire / espn etc?" ESPN carries no starting five before tip (its box score's `starter` flag arrives with
// the game) and NBA.com answers 403 to the server; RotoWire's page is served (checked 2026-11-04: 200, the night's 14 games,
// every team "Expected Lineup" at 10 PM ET the night before). The page is today's slate (ET) alone, its date in the head
// ("Starting lineups for November 4, 2026"); `?date=tomorrow` builds its games in the browser and past nights are not served.
// The status is read off the status line's class and words, so "is-confirmed" / "Confirmed Lineup" both read as confirmed
// (no confirmed lineup had been seen when this was written: the first one confirms the spelling).
import { teamAbbrFromText } from './teams';
import { getText } from '../picks/http';

export const LINEUPS_URL = 'https://www.rotowire.com/basketball/nba-lineups.php';
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const text = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
/** "is-confirmed" / "Confirmed Lineup" → 'confirmed', "is-expected" / "Expected Lineup" → 'expected', else null. */
export function statusOf(cls, words) {
  const s = `${cls || ''} ${words || ''}`;
  if (/confirm/i.test(s)) return 'confirmed';
  if (/expect|project/i.test(s)) return 'expected';
  return null;
}
/** The page's date: "Starting lineups for November 4, 2026" → '2026-11-04'; null when the head is missing. */
export function pageDate(html) {
  const m = String(html || '').match(/Starting lineups for\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

/** One team's list (`<ul class="lineup__list is-visit|is-home">`): its status, the five starters, who may not play. */
function sideOf(ul) {
  const st = ul.match(/<li class="lineup__status\s*([^"]*)"[^>]*>([\s\S]*?)<\/li>/);
  const status = st ? statusOf(st[1], text(st[2])) : null;
  const starters = []; const mayNotPlay = [];
  // The players after "MAY NOT PLAY" (`lineup__title`) are the doubtful ones; the five before it start.
  const cut = ul.search(/lineup__title[^>]*>\s*MAY NOT PLAY/i);
  const head = cut >= 0 ? ul.slice(0, cut) : ul; const tail = cut >= 0 ? ul.slice(cut) : '';
  const players = (part) => [...part.matchAll(/<li class="lineup__player([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
    const pos = text((m[2].match(/lineup__pos[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    const a = m[2].match(/<a[^>]*title="([^"]*)"[^>]*>/);
    const inj = text((m[2].match(/lineup__inj[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
    const pct = (m[1].match(/is-pct-play-(\d+)/) || [])[1];
    return { pos: pos || null, name: a ? a[1] : text(m[2]), ...(inj ? { status: inj } : {}), ...(pct != null ? { play: Number(pct) } : {}) };
  }).filter((p) => p.name);
  starters.push(...players(head)); mayNotPlay.push(...players(tail));
  return { status, starters: starters.slice(0, 5), mayNotPlay };
}

/**
 * The page read: { date, games: [{ time, away, home }], teams: { ABBR: { status, starters: [{ pos, name, status?, play? }],
 * mayNotPlay, opp, home } } } with the site's team codes (WAS → WSH, NYK → NY …). A team the page does not list is absent.
 */
export function parseLineups(html) {
  const h = String(html || '');
  const out = { date: pageDate(h), games: [], teams: {} };
  const blocks = h.split(/<div class="lineup is-nba[^"]*"/).slice(1);
  for (const b of blocks) {
    const abbrs = [...b.matchAll(/class="lineup__abbr">([^<]*)</g)].map((m) => teamAbbrFromText(text(m[1])));
    if (abbrs.length < 2 || !abbrs[0] || !abbrs[1]) continue;
    const [away, home] = abbrs;
    const time = text((b.match(/lineup__time">([^<]*)</) || [])[1]) || null;
    const lists = {};
    for (const m of b.matchAll(/<ul class="lineup__list is-(visit|home)"[^>]*>([\s\S]*?)<\/ul>/g)) lists[m[1]] = sideOf(m[2]);
    out.games.push({ time, away, home });
    if (lists.visit) out.teams[away] = { ...lists.visit, opp: home, home: false };
    if (lists.home) out.teams[home] = { ...lists.home, opp: away, home: true };
  }
  return out;
}

/** Tonight's lineups from RotoWire, stamped { at, fetchedAt, source, url, ...parseLineups }; null when the page has no games. */
export async function fetchLineups() {
  const html = await getText(LINEUPS_URL);
  if (!html) return null;
  const read = parseLineups(html);
  if (!read.games.length) return null;
  const now = new Date().toISOString();
  return { source: 'rotowire', url: LINEUPS_URL, at: now, fetchedAt: now, ...read };
}
