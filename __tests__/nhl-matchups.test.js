import { describe, expect, test } from '@jest/globals';
import { parseLineupRows, applyFrozenPositions, frozenPos } from '../lib/nhl-data/positions';
import { defenseByPosition, playerBaselines } from '../lib/nhl-data/defense';
import { groupStandings, mapStandingRow, shotLeaders } from '../lib/nhl-data/league';
import { scoreSkater } from '../lib/nhl-data/slate';
import { lineupRows } from '../lib/nhl-data/lineups';
import { rowObj } from '../lib/nhl-data/ingest';
import { PREVIEW_MD } from './fixtures/nhl';

describe('frozen positions', () => {
  test('lineup rows become LW/C/RW by slot, D by pair, G', () => {
    const teams = parseLineupRows(lineupRows(PREVIEW_MD));
    expect(Object.keys(teams).sort()).toEqual(['ANA', 'OTT']);
    expect(teams.ANA['chris kreider']).toMatchObject({ pos: 'LW', line: 1 });
    expect(teams.ANA['leo carlsson']).toMatchObject({ pos: 'C', line: 1 });
    expect(teams.ANA['cutter gauthier']).toMatchObject({ pos: 'RW', line: 1 });
    expect(teams.ANA['jacob trouba']).toMatchObject({ pos: 'D', line: 1 });
    expect(teams.ANA['lukas dostal']).toMatchObject({ pos: 'G', line: 1 });
    expect(teams.OTT['tim stutzle'].pos).toBe('C');
    // Scratches and status text never become players.
    expect(teams.ANA['frank vatrano']).toBeUndefined();
  });

  test('a skater keeps the frozen position when the game is stored', () => {
    const snap = { games: { 7: { teams: { OTT: { players: { 'brady tkachuk': { name: 'Brady Tkachuk', pos: 'LW', line: 1 } } } } } } };
    expect(frozenPos(snap, 7, 'OTT', 'Brady Tkachuk')).toBe('LW');
    expect(frozenPos(snap, 7, 'OTT', 'Nobody')).toBeNull();
    const games = [{ id: 7, skaters: [{ name: 'Brady Tkachuk', team: 'OTT', pos: 'C' }, { name: 'X', team: 'OTT', pos: 'D' }] }];
    expect(applyFrozenPositions(games, snap)).toBe(1);
    expect(games[0].skaters[0]).toMatchObject({ pos: 'LW', boxPos: 'C' });
    expect(games[0].skaters[1].pos).toBe('D');
  });
});

// date, gameId, playerId, name, team, opp, venue, pos, toi, g, a, sog, hits, blk, icf, iff, isf, iscf, ihdcf, result
const row = (date, gameId, pid, team, opp, venue, pos, g, sog, iscf = 1) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, pos, 15, g, 0, sog, 0, 0, sog + 2, sog + 1, sog, iscf, 0, 'W']);

describe('defense by position', () => {
  const rows = [
    // Game 1: ANA at OTT. OTT (home) allows to LW: 5 SOG; to C: 2.
    row('2026-01-01', 1, 1, 'ANA', 'OTT', 'A', 'LW', 1, 5), row('2026-01-01', 1, 2, 'ANA', 'OTT', 'A', 'C', 0, 2),
    row('2026-01-01', 1, 3, 'OTT', 'ANA', 'H', 'LW', 0, 1),
    // Game 2: OTT at ANA. ANA (home) allows LW 3; OTT (away) allows LW 7.
    row('2026-01-03', 2, 3, 'OTT', 'ANA', 'A', 'LW', 2, 3),
    row('2026-01-03', 2, 1, 'ANA', 'OTT', 'H', 'LW', 0, 7),
  ];
  test('splits what a team allows by its own venue and ranks 1 = most', () => {
    const d = defenseByPosition(rows);
    expect(d.teams.OTT.H.LW).toMatchObject({ gp: 1, sog: 5, g: 1 });
    expect(d.teams.OTT.A.LW).toMatchObject({ gp: 1, sog: 7 });
    expect(d.teams.OTT.ALL.LW).toMatchObject({ gp: 2, sog: 6 });
    expect(d.teams.ANA.H.LW).toMatchObject({ gp: 1, sog: 3 });
    expect(d.teams.ANA.A.LW).toMatchObject({ gp: 1, sog: 1 });
    expect(d.ranks.OTT.ALL.LW.sog).toBe(1);
    expect(d.ranks.ANA.ALL.LW.sog).toBe(2);
    expect(d.league.ALL.LW.sog).toBe(4);
  });
  test('lastN keeps only the newest team-games', () => {
    const d = defenseByPosition(rows, { lastN: 1 });
    expect(d.teams.OTT.ALL.LW).toMatchObject({ gp: 1, sog: 7 });
  });
  test('player baselines average the window with venue splits and hit rates', () => {
    const b = playerBaselines(rows, { window: 20 });
    expect(b[1]).toMatchObject({ team: 'ANA', lastPos: 'LW' });
    expect(b[1].all).toMatchObject({ gp: 2, sog: 6, g: 0.5 });
    expect(b[1].H.sog).toBe(7);
    expect(b[1].hit.s3).toBe(1);
  });
  test('scoreSkater scales the player rate by the defense ratio', () => {
    const base = { all: { gp: 10, sog: 3, g: 0.4, iscf: 2, toi: 17 }, H: { gp: 2 }, l5: { sog: 4 }, hit: {} };
    const s = scoreSkater(base, 'H', { ratio: 1.2 }, { ratio: 0.5 }, { ratio: 1.4 });
    expect(s.projSog).toBe(3.6);
    expect(s.projG).toBe(0.2);
    expect(s.shotEdge).toBe(20);
    expect(s.goalEdge).toBe(-50);
    expect(s.shotScore).toBe(3.96);
    expect(scoreSkater(null, 'H')).toBeNull();
  });
});

describe('league tables', () => {
  test('standings rows group by conference and division in rank order', () => {
    const api = (abbr, conf, div, seq, pts) => ({ teamAbbrev: { default: abbr }, teamCommonName: { default: abbr }, teamName: { default: abbr }, conferenceName: conf, divisionName: div, divisionSequence: seq, points: pts, wins: 1, losses: 0, otLosses: 0, gamesPlayed: 1, pointPctg: 1, l10Wins: 1, l10Losses: 0, l10OtLosses: 0, streakCode: 'W', streakCount: 1 });
    const rows = [api('OTT', 'Eastern', 'Atlantic', 2, 90), api('TOR', 'Eastern', 'Atlantic', 1, 100), api('EDM', 'Western', 'Pacific', 1, 95)].map(mapStandingRow);
    expect(rows[0]).toMatchObject({ abbrev: 'OTT', l10: '1-0-0', streak: 'W1', logo: expect.stringContaining('OTT') });
    const g = groupStandings(rows);
    expect(g.map((c) => c.name)).toEqual(['Eastern', 'Western']);
    expect(g[0].divisions[0].teams.map((t) => t.abbrev)).toEqual(['TOR', 'OTT']);
  });
  test('shot leaders come from our rows', () => {
    const rows = [row('2026-01-01', 1, 1, 'ANA', 'OTT', 'A', 'LW', 1, 5), row('2026-01-03', 2, 1, 'ANA', 'OTT', 'H', 'LW', 0, 7), row('2026-01-01', 1, 2, 'ANA', 'OTT', 'A', 'C', 0, 2)];
    const top = shotLeaders(rows, { minGp: 1 });
    expect(top[0]).toMatchObject({ id: 1, gp: 2, sog: 12, sogPerGame: 6 });
  });
});
