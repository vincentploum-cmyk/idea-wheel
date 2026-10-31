// Team offense and defense from ShotPropz (shotpropz.com, the free "Team Offensive / Defensive
// Stat Overview" boards): per game, goals and shots for and against, the power plays a team gets
// and gives, its PP% and PK%, each ranked over the league, for the season to date (YTD) or the
// last ten regular-season games, over all games or at home / away alone. Vincent, 2026-10-30:
// "whether the team is good at home in powerplay kill, how many powerplays they are getting,
// whether they shoot a lot, whether they allow a lot". The pages are server-rendered HTML (four
// tables a page, no login, robots allow), read with the browser agent and stored as one snapshot
// a season (data/shotpropz/<year>.json), so the site reads the store, never ShotPropz, at request
// time; the morning refresh pulls the twelve pages (2 boards × 3 locations × 2 spans).
import { readJson, writeJson, memoizeByInputs } from '../nhl-store';
import { TEAMS } from './teams';
import { mpYear } from './moneypuck';

const BASE = 'https://shotpropz.com/nhl';
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', Accept: 'text/html' };
export const SPZ_PATH = (year) => `data/shotpropz/${year}.json`;
export const SPZ_SOURCE = 'ShotPropz.com';
/** The two boards and their pages. */
export const BOARDS = { offense: 'team-offensive-stat-overview', defense: 'team-defensive-stat-overview' };
/** The page's filters: span (the season to date, the last ten) and location, as its selects spell them. */
export const SPANS = { ytd: 'YTD', l10: 'recent' };
export const LOCATIONS = { all: 'All', home: 'Home', away: 'Away' };
/** The table headings → the stat keys. Rank 1 = the most on the offense board, the softest on the defense board (the lowest PK%). */
export const STATS = {
  'Goals For/GP': 'gf', 'Shots For/GP': 'sf', 'Power Plays For/GP': 'ppo', 'Power Play %': 'ppPct',
  'Goals Against/GP': 'ga', 'Shots Against/GP': 'sa', 'Power Plays Against/GP': 'ppoa', 'Penalty Kill %': 'pkPct',
};
export const STAT_TEXT = { gf: 'goals a game', sf: 'shots a game', ppo: 'power plays a game', ppPct: 'power-play %', ga: 'goals allowed a game', sa: 'shots allowed a game', ppoa: 'power plays given a game', pkPct: 'penalty-kill %' };
const SPZ_ABBR = { ARI: 'UTA' };
const toAbbr = (t) => SPZ_ABBR[t] || (TEAMS[t] ? t : null);

/** The season key ShotPropz's season select uses: 2026 → "26_27". */
export const spzSeasonKey = (year) => `${String(year).slice(2)}_${String(year + 1).slice(2)}`;

const decode = (s) => String(s || '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

/**
 * One overview page's tables: { stats: { gf: { teams: { EDM: { gp, value, rank } }, count, heat: { min, mid, max } } }, updated,
 * season, span, location } — the selects' picked values say which page this is (the server echoes the
 * filters it applied, so a parameter it ignored shows here as the default). Throws on a page without
 * the tables (a layout change, a block page) so a refresh never stores an empty board.
 */
export function parseOverview(html) {
  const s = String(html || '');
  const stats = {};
  const tableRe = /<div class="spz-table-header"><h3>([^<]+)<\/h3><\/div><table([^>]*)>([\s\S]*?)<\/table>/g;
  let m;
  while ((m = tableRe.exec(s))) {
    const key = STATS[decode(m[1])];
    if (!key) continue;
    const attrs = m[2];
    const heat = (k) => { const h = new RegExp(`data-heat-${k}="([^"]+)"`).exec(attrs); return h ? Number(h[1]) : null; };
    const teams = {};
    const rowRe = /<tr[^>]*data-team="([A-Z]+)"[^>]*>([\s\S]*?)<\/tr>/g;
    let r;
    while ((r = rowRe.exec(m[3]))) {
      const abbr = toAbbr(r[1]);
      if (!abbr) continue;
      const cell = (cls) => { const c = new RegExp(`<td class="${cls}"[^>]*data-sort-value="([^"]*)"`).exec(r[2]); return c ? c[1] : null; };
      const rank = Number(cell('col-rk'));
      const gp = Number(cell('col-gp'));
      const value = Number(cell('value'));
      if (!Number.isFinite(value)) continue;
      teams[abbr] = { gp: Number.isFinite(gp) ? gp : null, value, rank: Number.isFinite(rank) && rank > 0 ? rank : null };
    }
    stats[key] = { teams, count: Object.keys(teams).length, heat: { min: heat('min'), mid: heat('mid'), max: heat('max') } };
  }
  if (!Object.keys(stats).length) throw new Error('ShotPropz page has no overview tables (layout changed or the page was not served)');
  const picked = (f) => { const sel = new RegExp(`<select[^>]*data-spz-f="${f}"[^>]*>([\\s\\S]*?)</select>`).exec(s); const o = sel && /<option value="([^"]*)"[^>]*selected/.exec(sel[1]); return o ? o[1] : null; };
  const upd = /Last updated:\s*([^<]+)</.exec(s);
  return { stats, updated: upd ? decode(upd[1]) : null, season: picked('season'), span: picked('span'), location: picked('location') };
}

async function fetchPage(url, { tries = 3, timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) { const err = new Error(`${res.status} ${url}`); err.status = res.status; throw err; }
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err.status === 404) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

/** The URL of one board for one season, span and location (the page's own query parameters). */
export function overviewUrl(board, { year, span = 'ytd', location = 'all' }) {
  const q = new URLSearchParams({ season: spzSeasonKey(year), span: SPANS[span] || span, location: LOCATIONS[location] || location });
  return `${BASE}/${BOARDS[board]}/?${q}`;
}

/** One board, one span and location, fetched and parsed. */
export async function fetchOverview(board, opts) {
  return parseOverview(await fetchPage(overviewUrl(board, opts)));
}

/**
 * Pull the twelve pages (offense and defense × all / home / away × YTD / last 10) and store the
 * snapshot: { updatedAt, year, source, pageUpdated, boards: { offense: { all: { ytd: { gf, sf, ppo, ppPct }, l10 },
 * home, away }, defense: { … ga, sa, ppoa, pkPct } }, failed: [...] }. A page that fails is left out and named;
 * the pull throws when nothing came back at all. One request at a time, a short pause between.
 */
export async function refreshShotpropz({ year = mpYear() } = {}) {
  const at = new Date().toISOString();
  const boards = { offense: {}, defense: {} };
  const failed = [];
  let pageUpdated = null;
  let pages = 0;
  for (const board of Object.keys(BOARDS)) {
    for (const location of Object.keys(LOCATIONS)) {
      boards[board][location] = {};
      for (const span of Object.keys(SPANS)) {
        try {
          const page = await fetchOverview(board, { year, span, location });
          // The server echoes the filters it applied: a page that came back on the defaults is not the one asked for.
          if (page.season && page.season !== spzSeasonKey(year)) throw new Error(`season ${page.season} served for ${spzSeasonKey(year)}`);
          if (page.location && page.location !== LOCATIONS[location]) throw new Error(`location ${page.location} served for ${LOCATIONS[location]}`);
          if ((page.span || 'YTD') !== SPANS[span]) throw new Error(`span ${page.span} served for ${SPANS[span]}`);
          boards[board][location][span] = page.stats;
          pageUpdated = page.updated || pageUpdated;
          pages += 1;
        } catch (err) {
          failed.push({ board, location, span, error: err.message });
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  if (!pages) throw new Error(`ShotPropz: no page could be read (${failed[0]?.error || 'unknown'})`);
  const file = { updatedAt: at, year, source: SPZ_SOURCE, pageUpdated, pages, failed, boards };
  await writeJson(SPZ_PATH(year), file);
  const teams = file.boards.offense.all?.ytd?.gf?.count || 0;
  return { ok: true, year, pages, teams, pageUpdated, failed };
}

/** The stored snapshot for the season (this season's, else last season's), or null. Memoised on the file. */
export const loadShotpropz = memoizeByInputs(
  async (year = mpYear()) => [await readJson(SPZ_PATH(year)), await readJson(SPZ_PATH(year - 1))],
  (cur, prev) => cur || prev || null,
);

// The pure readers the profile builder uses (client-safe, no store import) live in shotpropz-pure.js.
export { spzCell, spzTeamRead, spzSavePct, SPZ_MIN_VENUE_GAMES } from './shotpropz-pure';
