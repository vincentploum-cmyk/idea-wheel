// RotoWire's NHL lineups page (https://www.rotowire.com/hockey/nhl-lineups.php): tonight's games, each team's goalie
// ("Confirmed" / "Expected"), its two power-play units (POWER PLAY #1, POWER PLAY #2: five names each, slots C LW RW LD
// RD — the slots are the unit's, a forward can sit at LD on a four-forward unit) and its injuries. Vincent, 2026-11-08:
// "we need to find out who is on the powerplay so we know which players will most likely get more minutes. Rotowire is
// the only website that gives insight in the powerplay lineups" (the rink's PP badge, lib/nhl-data/pp-units.js). The
// page is today's slate (ET) alone, its date in the head ("Starting NHL lineups for November 8, 2026"); `?date=tomorrow`
// builds its games in the browser and past nights are not served, so the read is stored per date
// (data/rotowire/<date>.json) by the lineup read (`ingestLineups`) and the slate reads the stored file.
// Checked 2026-11-08: 200 to the server's browser user agent, six games, twelve teams with both units.
import { teamAbbrFromText } from './teams';
import { readJson, writeJson } from '../nhl-store';
import { getText } from '../picks/http';

export const NHL_LINEUPS_URL = 'https://www.rotowire.com/hockey/nhl-lineups.php';
export const rotowirePath = (date) => `data/rotowire/${date}.json`;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// RotoWire's codes that are not the site's (the page has used the NHL's own so far: TBL, NJD, VGK on 2026-11-08).
const ALIAS = { TB: 'TBL', NJ: 'NJD', LA: 'LAK', SJ: 'SJS', WAS: 'WSH', MON: 'MTL', CLS: 'CBJ', UTAH: 'UTA', ARI: 'UTA' };

const text = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const teamOf = (s) => { const t = text(s).toUpperCase(); return ALIAS[t] || teamAbbrFromText(t); };

/** The page's date: "Starting NHL lineups for November 8, 2026" → '2026-11-08'; null when the head is missing. */
export function pageDate(html) {
  const m = String(html || '').match(/Starting (?:NHL )?lineups for\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1].toLowerCase());
  return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

/** The players of one part of a list: [{ pos, name, status? }] (`name` the link's full-name title, else its text). */
function playersIn(part) {
  return [...String(part || '').matchAll(/<li class="lineup__player[^"-]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
    const pos = text((m[1].match(/lineup__pos[^>]*>([\s\S]*?)<\/div>/) || [])[1]);
    const a = m[1].match(/<a[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const inj = text((m[1].match(/lineup__inj[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
    return { pos: pos || null, name: a ? text(a[1]) || text(a[2]) : text(m[1]), ...(inj ? { status: inj } : {}) };
  }).filter((p) => p.name);
}

/** One team's list (`<ul class="lineup__list is-visit|is-home">`): its goalie and his word, the two power-play units, the injuries. */
function sideOf(ul) {
  const s = String(ul || '');
  const hl = s.match(/lineup__player-highlight-name[^>]*>([\s\S]*?)<\/div>([\s\S]*?)<\/li>/);
  const goalie = hl ? { name: text(hl[1]), status: /is-confirmed|Confirmed/i.test(hl[2]) ? 'confirmed' : /is-expected|Expected|Likely/i.test(hl[2]) ? 'expected' : null } : null;
  // The sections, each from its title to the next: POWER PLAY #1, POWER PLAY #2, INJURIES.
  const titles = [...s.matchAll(/<li class="lineup__title[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => ({ at: m.index, end: m.index + m[0].length, title: text(m[1]).toUpperCase() }));
  const part = (re) => { const i = titles.findIndex((t) => re.test(t.title)); return i < 0 ? '' : s.slice(titles[i].end, titles[i + 1]?.at ?? s.length); };
  return { goalie, pp1: playersIn(part(/POWER PLAY\s*#?\s*1\b/)), pp2: playersIn(part(/POWER PLAY\s*#?\s*2\b/)), injuries: playersIn(part(/INJUR/)) };
}

/**
 * The page read: { date, games: [{ time, away, home }], teams: { ABBR: { opp, home, goalie: { name, status } | null,
 * pp1: [{ pos, name }], pp2: [...], injuries: [{ pos, name, status }] } } }. A team the page does not list is absent.
 */
export function parseNhlLineups(html) {
  const h = String(html || '');
  const out = { date: pageDate(h), games: [], teams: {} };
  for (const b of h.split(/<div class="lineup is-nhl[^"]*"/).slice(1)) {
    const abbrs = [...b.matchAll(/class="lineup__abbr">([^<]*)</g)].map((m) => teamOf(m[1]));
    if (abbrs.length < 2 || !abbrs[0] || !abbrs[1]) continue;
    const [away, home] = abbrs;
    const time = text((b.match(/lineup__time">([^<]*)</) || [])[1]) || null;
    const lists = {};
    for (const m of b.matchAll(/<ul class="lineup__list is-(visit|home)"[^>]*>([\s\S]*?)<\/ul>/g)) lists[m[1]] = sideOf(m[2]);
    out.games.push({ time, away, home });
    if (lists.visit) out.teams[away] = { opp: home, home: false, ...lists.visit };
    if (lists.home) out.teams[home] = { opp: away, home: true, ...lists.home };
  }
  return out;
}

/** Tonight's page from RotoWire, stamped { source, url, fetchedAt, ...parseNhlLineups }; null when it lists no games. */
export async function fetchNhlLineups() {
  const html = await getText(NHL_LINEUPS_URL);
  if (!html) return null;
  const read = parseNhlLineups(html);
  if (!read.games.length) return null;
  return { source: 'rotowire', url: NHL_LINEUPS_URL, fetchedAt: new Date().toISOString(), ...read };
}

/**
 * Read the page and store it for `date` when the page is that date's (the page serves today alone). A team the new read
 * lacks keeps its stored entry (a game that has started can drop off the page). Never throws: the lineup read must not
 * fail on it. → { ok, date, teams, withPP } or { ok: false, skipped | error }.
 */
export async function refreshRotowire(date) {
  try {
    const read = await fetchNhlLineups();
    if (!read) return { ok: false, skipped: 'the page lists no games' };
    if (read.date && read.date !== date) return { ok: false, skipped: `the page is for ${read.date}` };
    const prev = await readJson(rotowirePath(date)).catch(() => null);
    const teams = { ...(prev?.teams || {}), ...read.teams };
    const games = [...(prev?.games || []).filter((g) => !read.games.some((r) => r.away === g.away && r.home === g.home)), ...read.games];
    await writeJson(rotowirePath(date), { ...read, date, games, teams });
    return { ok: true, date, teams: Object.keys(read.teams).length, withPP: Object.values(read.teams).filter((t) => t.pp1.length).length };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
