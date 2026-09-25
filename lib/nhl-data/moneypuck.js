// Team-level data from MoneyPuck (moneypuck.com/data.htm): expected goals,
// shot quality and possession per situation, from the public CSVs. Stored as
// snapshots so every page reads Supabase, never MoneyPuck, at request time.
//   season summary  moneypuck/playerData/seasonSummary/<year>/regular/teams.csv
//   game by game    moneypuck/playerData/careers/gameByGame/regular/teams/<TEAM>.csv
// Data © MoneyPuck.com, shown with credit.
import { readJson, writeJson } from '../nhl-store';
import { TEAMS } from './teams';

const BASE = 'https://moneypuck.com/moneypuck/playerData';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)' };
export const MP_TEAMS = (year) => `data/moneypuck/teams-${year}.json`;
export const MP_GAMES = (year) => `data/moneypuck/games-${year}.json`;
export const SITUATIONS = ['all', '5on5', '5on4', '4on5'];
// MoneyPuck uses a few abbreviations of its own.
const MP_ABBR = { 'L.A': 'LAK', 'N.J': 'NJD', 'S.J': 'SJS', 'T.B': 'TBL', LA: 'LAK', NJ: 'NJD', SJ: 'SJS', TB: 'TBL', ARI: 'UTA', UTA: 'UTA' };
export const toAbbr = (t) => MP_ABBR[t] || (TEAMS[t] ? t : null);

/** Season start year for MoneyPuck (2025 = the 2025-26 season). */
export function mpYear(now = new Date()) {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** Minimal CSV → objects; numeric cells become numbers. */
export function parseCsv(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = split(l);
    const o = {};
    head.forEach((h, i) => {
      const v = cells[i] ?? '';
      o[h] = v !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
    });
    return o;
  });
}

async function fetchCsv(url) {
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return parseCsv(await res.text());
}

/** iceTime comes in seconds for teams; treat anything under ~10 minutes a game as minutes. */
function iceSeconds(row) {
  const t = Number(row.iceTime) || 0;
  const gp = Number(row.games_played) || 1;
  return t / gp > 600 ? t : t * 60;
}

const per60 = (v, secs) => (secs > 0 ? +((Number(v) || 0) * 3600 / secs).toFixed(2) : null);
const pct = (v) => (v == null || v === '' ? null : +(Number(v) * (Number(v) <= 1 ? 100 : 1)).toFixed(1));

/** One team-situation row → the metrics the site shows. */
export function summarize(row) {
  const secs = iceSeconds(row);
  const gp = Number(row.games_played) || 0;
  return {
    gp,
    minutes: +(secs / 60).toFixed(0),
    xgfPct: pct(row.xGoalsPercentage),
    cfPct: pct(row.corsiPercentage),
    ffPct: pct(row.fenwickPercentage),
    xgf60: per60(row.xGoalsFor, secs), xga60: per60(row.xGoalsAgainst, secs),
    gf60: per60(row.goalsFor, secs), ga60: per60(row.goalsAgainst, secs),
    sf60: per60(row.shotsOnGoalFor, secs), sa60: per60(row.shotsOnGoalAgainst, secs),
    cf60: per60(row.shotAttemptsFor, secs), ca60: per60(row.shotAttemptsAgainst, secs),
    hdsf60: per60(row.highDangerShotsFor, secs), hdsa60: per60(row.highDangerShotsAgainst, secs),
    hdxgf60: per60(row.highDangerxGoalsFor, secs), hdxga60: per60(row.highDangerxGoalsAgainst, secs),
    gf: Number(row.goalsFor) || 0, ga: Number(row.goalsAgainst) || 0,
    xgf: +(Number(row.xGoalsFor) || 0).toFixed(1), xga: +(Number(row.xGoalsAgainst) || 0).toFixed(1),
  };
}

export const METRICS = [
  ['xgfPct', 'xGF%', 'high'], ['cfPct', 'CF%', 'high'],
  ['xgf60', 'xGF/60', 'high'], ['xga60', 'xGA/60', 'low'],
  ['sf60', 'SF/60', 'high'], ['sa60', 'SA/60', 'low'],
  ['hdsf60', 'HD shots for/60', 'high'], ['hdsa60', 'HD shots against/60', 'low'],
  ['gf60', 'GF/60', 'high'], ['ga60', 'GA/60', 'low'],
];

/** Ranks per situation and metric: 1 = best for the team ("low" metrics rank ascending). */
export function rankTeams(bySituation) {
  const ranks = {};
  for (const [sit, teams] of Object.entries(bySituation)) {
    ranks[sit] = {};
    const abbrs = Object.keys(teams);
    for (const [k, , dir] of METRICS) {
      const sorted = abbrs.filter((a) => teams[a][k] != null).sort((x, y) => (dir === 'low' ? teams[x][k] - teams[y][k] : teams[y][k] - teams[x][k]));
      sorted.forEach((a, i) => { (ranks[sit][a] = ranks[sit][a] || {})[k] = i + 1; });
    }
  }
  return ranks;
}

/** Aggregate game-by-game rows into team × situation × venue summaries. */
export function splitByVenue(rows) {
  const acc = {};
  const SUM = ['iceTime', 'xGoalsFor', 'xGoalsAgainst', 'goalsFor', 'goalsAgainst', 'shotsOnGoalFor', 'shotsOnGoalAgainst', 'shotAttemptsFor', 'shotAttemptsAgainst', 'highDangerShotsFor', 'highDangerShotsAgainst', 'highDangerxGoalsFor', 'highDangerxGoalsAgainst', 'unblockedShotAttemptsFor', 'unblockedShotAttemptsAgainst'];
  for (const r of rows) {
    const team = toAbbr(r.team);
    const sit = r.situation;
    const venue = String(r.home_or_away || '').toUpperCase().startsWith('H') ? 'H' : 'A';
    if (!team || !SITUATIONS.includes(sit)) continue;
    const key = `${team}|${sit}|${venue}`;
    const a = (acc[key] = acc[key] || { team, situation: sit, venue, games: new Set(), games_played: 0 });
    a.games.add(r.gameId);
    for (const k of SUM) a[k] = (a[k] || 0) + (Number(r[k]) || 0);
  }
  const out = {};
  for (const a of Object.values(acc)) {
    a.games_played = a.games.size;
    const s = summarize({ ...a, corsiPercentage: a.shotAttemptsFor + a.shotAttemptsAgainst ? a.shotAttemptsFor / (a.shotAttemptsFor + a.shotAttemptsAgainst) : null, xGoalsPercentage: a.xGoalsFor + a.xGoalsAgainst ? a.xGoalsFor / (a.xGoalsFor + a.xGoalsAgainst) : null, fenwickPercentage: a.unblockedShotAttemptsFor + a.unblockedShotAttemptsAgainst ? a.unblockedShotAttemptsFor / (a.unblockedShotAttemptsFor + a.unblockedShotAttemptsAgainst) : null });
    ((out[a.situation] = out[a.situation] || {})[a.venue] = out[a.situation][a.venue] || {})[a.team] = s;
  }
  return out;
}

/** Pull the season summary (and, when asked, every team's game log) and store snapshots. */
export async function refreshMoneyPuck({ year = mpYear(), games = true } = {}) {
  const at = new Date().toISOString();
  const rows = await fetchCsv(`${BASE}/seasonSummary/${year}/regular/teams.csv`);
  const bySituation = {};
  for (const r of rows) {
    const team = toAbbr(r.team);
    if (!team || !SITUATIONS.includes(r.situation)) continue;
    (bySituation[r.situation] = bySituation[r.situation] || {})[team] = summarize(r);
  }
  const teamsFile = { updatedAt: at, year, source: 'MoneyPuck.com', situations: bySituation, ranks: rankTeams(bySituation), teams: Object.keys(bySituation.all || {}).length };
  await writeJson(MP_TEAMS(year), teamsFile);

  let venue = null;
  if (games) {
    const all = [];
    const failed = [];
    const queue = Object.keys(TEAMS);
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const abbr = queue.shift();
        const mp = { LAK: 'L.A', NJD: 'N.J', SJS: 'S.J', TBL: 'T.B' }[abbr] || abbr;
        try {
          const log = await fetchCsv(`${BASE}/careers/gameByGame/regular/teams/${mp}.csv`);
          all.push(...log.filter((r) => Number(r.season) === year));
        } catch { failed.push(abbr); }
      }
    }));
    const byVenue = splitByVenue(all);
    venue = { updatedAt: at, year, source: 'MoneyPuck.com', byVenue, ranks: Object.fromEntries(Object.entries(byVenue).map(([sit, v]) => [sit, Object.fromEntries(Object.entries(v).map(([ven, teams]) => [ven, rankTeams({ x: teams }).x]))])), failed, rows: all.length };
    await writeJson(MP_GAMES(year), venue);
  }
  return { at, year, teams: teamsFile.teams, gameRows: venue?.rows ?? null, failed: venue?.failed || [] };
}

export async function loadMoneyPuck(year = mpYear()) {
  const [teams, games] = await Promise.all([readJson(MP_TEAMS(year)), readJson(MP_GAMES(year))]);
  return { teams, games };
}
