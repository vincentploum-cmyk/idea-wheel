// League tables from the NHL API: standings by division and the scoring
// leaders. Stored as snapshots so the League tab never waits on the NHL.
import { fetchStandings, fetchLeaders } from './api';
import { readJson, writeJson } from '../nhl-store';
import { teamLogo } from './teams';

export const STANDINGS_PATH = 'data/league/standings.json';
export const LEADERS_PATH = 'data/league/leaders.json';
export const LEADER_CATEGORIES = ['points', 'goals', 'assists'];

const n = (v) => Number(v) || 0;

/** One standings row from the API's /standings/now shape. */
export function mapStandingRow(s) {
  const abbrev = s.teamAbbrev?.default;
  return {
    abbrev,
    name: s.teamCommonName?.default || abbrev,
    full: s.teamName?.default || abbrev,
    logo: teamLogo(abbrev),
    conference: s.conferenceName || null,
    division: s.divisionName || null,
    gp: n(s.gamesPlayed), w: n(s.wins), l: n(s.losses), otl: n(s.otLosses), pts: n(s.points),
    pct: +(n(s.pointPctg)).toFixed(3),
    gf: n(s.goalFor), ga: n(s.goalAgainst), diff: n(s.goalDifferential),
    l10: `${n(s.l10Wins)}-${n(s.l10Losses)}-${n(s.l10OtLosses)}`,
    streak: s.streakCode && s.streakCount ? `${s.streakCode}${s.streakCount}` : '',
    home: `${n(s.homeWins)}-${n(s.homeLosses)}-${n(s.homeOtLosses)}`,
    road: `${n(s.roadWins)}-${n(s.roadLosses)}-${n(s.roadOtLosses)}`,
    divisionRank: n(s.divisionSequence), conferenceRank: n(s.conferenceSequence), leagueRank: n(s.leagueSequence),
    wildcardRank: n(s.wildcardSequence),
  };
}

export function mapLeader(p) {
  return {
    id: p.id,
    name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
    team: p.teamAbbrev,
    pos: p.position,
    number: p.sweaterNumber ?? null,
    headshot: p.headshot || null,
    value: n(p.value),
  };
}

export async function refreshLeague() {
  const at = new Date().toISOString();
  const [standings, leaders] = await Promise.all([fetchStandings(), fetchLeaders(LEADER_CATEGORIES)]);
  const rows = (standings?.standings || []).map(mapStandingRow).filter((r) => r.abbrev);
  const cats = Object.fromEntries(LEADER_CATEGORIES.map((c) => [c, (leaders?.[c] || []).map(mapLeader)]));
  if (rows.length) await writeJson(STANDINGS_PATH, { updatedAt: at, rows });
  if (Object.values(cats).some((l) => l.length)) await writeJson(LEADERS_PATH, { updatedAt: at, ...cats });
  return { at, teams: rows.length, leaders: Object.fromEntries(Object.entries(cats).map(([c, l]) => [c, l.length])) };
}

export async function loadLeague() {
  const [standings, leaders] = await Promise.all([readJson(STANDINGS_PATH), readJson(LEADERS_PATH)]);
  return { standings, leaders };
}

/** Standings grouped Conference → Division, in division order. */
export function groupStandings(rows) {
  const out = [];
  for (const r of rows || []) {
    let conf = out.find((c) => c.name === r.conference);
    if (!conf) { conf = { name: r.conference || 'League', divisions: [] }; out.push(conf); }
    let div = conf.divisions.find((d) => d.name === r.division);
    if (!div) { div = { name: r.division || 'All', teams: [] }; conf.divisions.push(div); }
    div.teams.push(r);
  }
  for (const c of out) for (const d of c.divisions) d.teams.sort((a, b) => (a.divisionRank || 99) - (b.divisionRank || 99) || b.pts - a.pts);
  return out;
}

/** Shot leaders from our own skater-game rows for a season (the NHL feed has no shots category). */
export function shotLeaders(rows, { limit = 30, minGp = 3 } = {}) {
  const by = {};
  for (const r of rows) {
    const p = (by[r.playerId] = by[r.playerId] || { id: r.playerId, name: r.name, team: r.team, pos: r.pos, gp: 0, sog: 0, g: 0, iscf: 0, lastDate: '' });
    p.gp += 1; p.sog += n(r.sog); p.g += n(r.g); p.iscf += n(r.iscf);
    if (r.date >= p.lastDate) { p.lastDate = r.date; p.team = r.team; p.pos = r.pos; p.name = r.name; }
  }
  return Object.values(by)
    .filter((p) => p.gp >= minGp)
    .map((p) => ({ ...p, sogPerGame: +(p.sog / p.gp).toFixed(2), gPerGame: +(p.g / p.gp).toFixed(2) }))
    .sort((a, b) => b.sog - a.sog || b.sogPerGame - a.sogPerGame)
    .slice(0, limit);
}
