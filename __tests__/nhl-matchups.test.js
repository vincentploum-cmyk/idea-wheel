import { describe, expect, test } from '@jest/globals';
import { parseLineupRows, applyPositions, snapshotPos, fillFromLastLineup, lineupToRemember } from '../lib/nhl-data/positions';
import { defenseByPosition, defenseBySlot, firstGoalsAllowed, defenseVsTeam, rankAmong, playerBaselines } from '../lib/nhl-data/defense';
import { groupStandings, mapStandingRow, shotLeaders } from '../lib/nhl-data/league';
import { scoreSkater, h2hByOpponent, h2hHot, h2hShotsHot } from '../lib/nhl-data/slate';
import { lineupRows } from '../lib/nhl-data/lineups';
import { rowObj } from '../lib/nhl-data/ingest';
import { PREVIEW_MD } from './fixtures/nhl';

describe('lineup positions', () => {
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

  test('a stored skater takes the snapshot position; a newer snapshot replaces it or hands back the box code', () => {
    const snap = { games: { 7: { teams: { OTT: { players: { 'brady tkachuk': { name: 'Brady Tkachuk', pos: 'LW', line: 1 } } } } } } };
    expect(snapshotPos(snap, 7, 'OTT', 'Brady Tkachuk')).toBe('LW');
    expect(snapshotPos(snap, 7, 'OTT', 'Nobody')).toBeNull();
    const games = [{ id: 7, skaters: [{ name: 'Brady Tkachuk', team: 'OTT', pos: 'C' }, { name: 'X', team: 'OTT', pos: 'D' }] }];
    expect(applyPositions(games, snap)).toEqual({ applied: 1, changed: 2 });
    expect(games[0].skaters[0]).toMatchObject({ pos: 'LW', line: 1, boxPos: 'C', posSource: 'lineup' });
    expect(games[0].skaters[1]).toMatchObject({ pos: 'D', line: null, posSource: 'box' });
    // The same snapshot again changes nothing.
    expect(applyPositions(games, snap)).toEqual({ applied: 1, changed: 0 });
    // A read after the game moved him to the second line at centre: the stored game follows.
    const later = { games: { 7: { teams: { OTT: { players: { 'brady tkachuk': { name: 'Brady Tkachuk', pos: 'C', line: 2 }, x: { name: 'X', pos: 'D', line: 3 } } } } } } };
    expect(applyPositions(games, later)).toEqual({ applied: 2, changed: 2 });
    expect(games[0].skaters[0]).toMatchObject({ pos: 'C', line: 2, boxPos: 'C', posSource: 'lineup' });
    expect(games[0].skaters[1]).toMatchObject({ pos: 'D', line: 3, posSource: 'lineup' });
    // Dropped from the lineup altogether: back to the box-score code, no line.
    expect(applyPositions(games, { games: { 7: { teams: { OTT: { players: {} } } } } })).toEqual({ applied: 0, changed: 2 });
    expect(games[0].skaters[0]).toMatchObject({ pos: 'C', line: null, posSource: 'box' });
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
  test('defenseVsTeam: what a team allowed to each position against one opponent, by its venue', () => {
    // OTT vs ANA only: at home (game 1) 5 SOG to LW; away (game 2) 7 SOG to LW.
    const h = defenseVsTeam(rows, 'OTT', 'ANA');
    expect(h.H.LW).toMatchObject({ gp: 1, sog: 5, g: 1 });
    expect(h.A.LW).toMatchObject({ gp: 1, sog: 7 });
    expect(h.ALL.LW).toMatchObject({ gp: 2, sog: 6 });
    expect(h.H.C).toMatchObject({ gp: 1, sog: 2 });
    expect(defenseVsTeam(rows, 'OTT', 'BOS')).toBeNull();
    expect(defenseVsTeam(rows, 'OTT', 'ANA')).toBe(h); // memoised per rows array
    // A value's place among the league's values: 1 = the most.
    expect(rankAmong(6, [3, 7, 5, null, 6])).toBe(2);
    expect(rankAmong(8, [3, 7, 5])).toBe(1);
    expect(rankAmong(1, [3, 7, 5])).toBe(4);
    expect(rankAmong(null, [3])).toBeNull();
    expect(rankAmong(3, [])).toBeNull();
  });
  test('lastN keeps only the newest team-games, per venue', () => {
    const d = defenseByPosition(rows, { lastN: 1 });
    expect(d.teams.OTT.ALL.LW).toMatchObject({ gp: 1, sog: 7 });
    // OTT's newest game was away; its last home game is still game 1 (5 SOG allowed to LW).
    expect(d.teams.OTT.H.LW).toMatchObject({ gp: 1, sog: 5 });
    expect(d.teams.OTT.A.LW).toMatchObject({ gp: 1, sog: 7 });
  });
  test('defenseBySlot keeps an LW3 apart from an LW2 and skips rows without a line', () => {
    const slotRow = (gameId, pid, team, opp, venue, pos, line, sog) => rowObj([`2026-01-0${gameId}`, gameId, pid, `P${pid}`, team, opp, venue, pos, 15, 0, 0, sog, 0, 0, sog + 2, sog + 1, sog, 1, 0, 'W', 'lineup', pos, line]);
    const rows = [
      // OTT at home allows 2 SOG to ANA's LW2 and 6 to its LW3; one older row with no line is ignored.
      slotRow(1, 1, 'ANA', 'OTT', 'A', 'LW', 2, 2), slotRow(1, 2, 'ANA', 'OTT', 'A', 'LW', 3, 6), slotRow(1, 3, 'ANA', 'OTT', 'A', 'D', 1, 3),
      row('2026-01-01', 1, 4, 'ANA', 'OTT', 'A', 'LW', 0, 9),
      // Game 2 at OTT again: LW2 4, LW3 2.
      slotRow(2, 1, 'ANA', 'OTT', 'A', 'LW', 2, 4), slotRow(2, 2, 'ANA', 'OTT', 'A', 'LW', 3, 2),
    ];
    const d = defenseBySlot(rows);
    expect(d.teams.OTT.H.LW2).toMatchObject({ gp: 2, sog: 3 });
    expect(d.teams.OTT.H.LW3).toMatchObject({ gp: 2, sog: 4 });
    expect(d.teams.OTT.H.D1).toMatchObject({ gp: 2, sog: 1.5 });
    expect(d.teams.OTT.H.LW1).toMatchObject({ gp: 2, sog: 0 });
    // All = every slot (the no-line row's 9 SOG are not counted).
    expect(d.teams.OTT.H.All.sog).toBe(8.5);
    expect(d.teams.OTT.A.LW2.gp).toBe(0);
    expect(defenseBySlot(rows, { lastN: 1 }).teams.OTT.H.LW3.sog).toBe(2);
    // The per-position table is unchanged by the slot column.
    expect(defenseByPosition(rows).teams.OTT.H.LW.sog).toBe(11.5);
  });
  test('firstGoalsAllowed: who a team gives the first goal to, by venue, position and line', () => {
    const fgRow = (date, gameId, pid, team, opp, venue, pos, line, fg) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, pos, 15, fg, 0, 2, 0, 0, 2, 2, 2, 1, 0, 'W', 'lineup', pos, line, fg]);
    const rows = [
      // Game 1 at NJD: NYR's LW1 scores first. Game 2 at NJD: NYR's LW1 again. Game 3 at NJD: NJD scored first (its own C1).
      fgRow('2026-01-01', 1, 1, 'NYR', 'NJD', 'A', 'LW', 1, 1), fgRow('2026-01-01', 1, 2, 'NYR', 'NJD', 'A', 'C', 1, 0), fgRow('2026-01-01', 1, 9, 'NJD', 'NYR', 'H', 'C', 1, 0),
      fgRow('2026-01-05', 2, 1, 'NYR', 'NJD', 'A', 'LW', 1, 1), fgRow('2026-01-05', 2, 9, 'NJD', 'NYR', 'H', 'C', 1, 0),
      fgRow('2026-01-09', 3, 1, 'NYR', 'NJD', 'A', 'LW', 2, 0), fgRow('2026-01-09', 3, 9, 'NJD', 'NYR', 'H', 'C', 1, 1),
      // Game 4, NJD away at BOS: BOS's D2 scores first. Game 5: stored before the column existed (no fg anywhere) — not counted.
      fgRow('2026-01-12', 4, 5, 'BOS', 'NJD', 'H', 'D', 2, 1), fgRow('2026-01-12', 4, 9, 'NJD', 'BOS', 'A', 'C', 1, 0),
      row('2026-01-15', 5, 1, 'NYR', 'NJD', 'A', 'LW', 1, 3), row('2026-01-15', 5, 9, 'NJD', 'NYR', 'H', 'C', 0, 1),
    ];
    const f = firstGoalsAllowed(rows);
    expect(f.teams.NJD.H).toMatchObject({ games: 3, allowed: 2, share: 0.67, bySlot: { LW1: 2 } });
    expect(f.teams.NJD.H.byPos.LW).toEqual({ n: 2, share: 0.67 });
    expect(f.teams.NJD.H.byPos.C.n).toBe(0);
    expect(f.teams.NJD.A).toMatchObject({ games: 1, allowed: 1, bySlot: { D2: 1 } });
    expect(f.teams.NJD.ALL).toMatchObject({ games: 4, allowed: 3 });
    // NYR gave up the first goal once at home (game 3, to NJD's C1) and once away (game 4 is NJD vs BOS, not NYR's).
    expect(f.teams.NYR.A).toMatchObject({ games: 3, allowed: 1, bySlot: { C1: 1 } });
    expect(f.teams.BOS.H).toMatchObject({ games: 1, allowed: 0 }); // BOS was home for game 4 and scored first itself
    expect(f.ranks.NJD.H.LW).toBe(1);
    expect(f.ranks.NYR.A.LW).toBe(1); // the only team with a game at that venue slice ranks first
    expect(f.league.H.LW).toBeCloseTo(0.335, 1); // NJD 0.67 and BOS 0 at home
    // Last-N windows take the newest games per venue.
    expect(firstGoalsAllowed(rows, { lastN: 1 }).teams.NJD.H).toMatchObject({ games: 1, allowed: 0 });
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
  test('the head-to-head mark: more than a goal a game on the opponent, or 2+ in the one game stored', () => {
    const rows = [
      row('2026-01-01', 1, 1, 'ANA', 'OTT', 'A', 'LW', 2, 5), row('2026-01-10', 2, 1, 'ANA', 'OTT', 'H', 'LW', 1, 3), row('2026-01-20', 3, 1, 'ANA', 'BOS', 'H', 'LW', 2, 4),
      row('2026-01-01', 1, 2, 'ANA', 'OTT', 'A', 'C', 1, 2), row('2026-01-10', 2, 2, 'ANA', 'OTT', 'H', 'C', 1, 2),
      row('2026-01-01', 1, 3, 'ANA', 'OTT', 'A', 'RW', 1, 2),
    ];
    const h = h2hByOpponent(rows);
    expect(h['1|OTT']).toEqual({ gp: 2, g: 3, sog: 8 });
    expect(h['1|BOS']).toEqual({ gp: 1, g: 2, sog: 4 });
    expect(h2hHot(h['1|OTT'])).toBe(true); // 1.5 G/GP over 2 games
    expect(h2hHot(h['1|BOS'])).toBe(true); // one game, 2 goals
    expect(h2hHot(h['2|OTT'])).toBe(false); // exactly a goal a game is not more than one
    expect(h2hHot(h['3|OTT'])).toBe(false); // one game, one goal
    expect(h2hHot(h['9|OTT'])).toBe(false); // never faced them
    // Shots: 4+ a game over 2+ meetings, or 5+ in the one meeting stored.
    expect(h2hShotsHot(h['1|OTT'])).toBe(true); // 8 in 2
    expect(h2hShotsHot(h['2|OTT'])).toBe(false); // 4 in 2
    expect(h2hShotsHot(h['1|BOS'])).toBe(false); // 4 in 1
    expect(h2hShotsHot({ gp: 1, g: 0, sog: 5 })).toBe(true);
    expect(h2hShotsHot(null)).toBe(false);
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

describe('player profile', () => {
  const { playerProfile, formTag, hitRate } = require('../lib/nhl-data/profile');
  const mk = (i, g, sog, venue = i % 2 ? 'H' : 'A', opp = i % 3 ? 'OTT' : 'MTL') => row(`2026-01-${String(i + 1).padStart(2, '0')}`, 100 + i, 1, 'ANA', opp, venue, 'LW', g, sog);
  test('hit rates count games over the line', () => {
    const list = [{ sog: 3 }, { sog: 2 }, { sog: 5 }];
    expect(hitRate(list, 'sog', 2.5)).toEqual({ hits: 2, gp: 3, rate: 0.67 });
  });
  test('form: five straight 4+ shot games is hot, no goals in five is cold', () => {
    const hot = Array.from({ length: 5 }, (_, i) => mk(i, 0, 4));
    expect(formTag(hot, hot)).toMatchObject({ shots: 'Hot', goals: 'Cold' });
    const cold = Array.from({ length: 5 }, (_, i) => mk(i, 1, 1));
    expect(formTag(cold, cold)).toMatchObject({ shots: 'Cold', goals: 'Hot' });
  });
  test('profile splits by venue and opponent and reports lines', () => {
    const rows = Array.from({ length: 12 }, (_, i) => mk(i, i % 4 === 0 ? 1 : 0, 2 + (i % 3)));
    const p = playerProfile(rows, { opp: 'MTL', venue: 'H' });
    // Every game vs tonight's opponent rides along for the card's H2H histogram.
    expect(p.h2hGames.length).toBe(p.stats.h2h.gp);
    expect(p.h2hGames.every((g) => g.opp === 'MTL')).toBe(true);
    expect(p.gp).toBe(12);
    expect(p.stats.l5.gp).toBe(5);
    expect(p.stats.h2h.gp).toBe(4);
    expect(p.stats.tonight.gp).toBe(6);
    expect(p.hits.goals[0.5].season).toEqual({ hits: 3, gp: 12, rate: 0.25 });
    expect(p.hits.shots[2.5].season.hits).toBe(8);
    expect(p.games[p.games.length - 1].pts).toBe(0);
    expect(['Hot', 'Cold', 'Neutral']).toContain(p.form.shots);
  });
});

describe('position sources', () => {
  const { applyPositions } = require('../lib/nhl-data/positions');
  const { toRow, rowObj } = require('../lib/nhl-data/ingest');
  test('applied positions are tagged lineup, the rest box, and rows carry both', () => {
    const snap = { games: { 9: { teams: { BOS: { players: { 'david pastrnak': { name: 'David Pastrnak', pos: 'LW', line: 1 } } } } } } };
    const game = { id: 9, date: '2026-01-05', skaters: [
      { id: 1, name: 'David Pastrnak', team: 'BOS', opp: 'NYR', venue: 'H', pos: 'RW', sog: 5, g: 1, a: 0, toi: 18, hits: 0, blk: 0, icf: 7, iff: 6, isf: 5, iscf: 3, ihdcf: 1, result: 'W' },
      { id: 2, name: 'Charlie McAvoy', team: 'BOS', opp: 'NYR', venue: 'H', pos: 'D', sog: 2, g: 0, a: 1, toi: 22, hits: 0, blk: 0, icf: 3, iff: 3, isf: 2, iscf: 0, ihdcf: 0, result: 'W' },
    ] };
    expect(applyPositions([game], snap).applied).toBe(1);
    expect(game.skaters[0]).toMatchObject({ pos: 'LW', boxPos: 'RW', posSource: 'lineup', line: 1 });
    expect(game.skaters[1]).toMatchObject({ pos: 'D', boxPos: 'D', posSource: 'box', line: null });
    const r = rowObj(toRow(game, game.skaters[0]));
    expect(r).toMatchObject({ pos: 'LW', posSrc: 'lineup', boxPos: 'RW', opp: 'NYR', venue: 'H', sog: 5, line: 1 });
    expect(rowObj(toRow(game, game.skaters[1])).line).toBeNull();
    // Older rows without the new columns still parse.
    expect(rowObj(toRow(game, game.skaters[1]).slice(0, 20)).posSrc).toBeUndefined();
    expect(rowObj(toRow(game, game.skaters[1]).slice(0, 22)).line).toBeUndefined();
  });
  test('the line slot comes from the snapshot: forward line or defense pair, none for a box-score position', () => {
    const { snapshotSlot, slotLabel } = require('../lib/nhl-data/positions');
    const snap = { games: { 9: { teams: { BOS: { players: {
      'david pastrnak': { name: 'David Pastrnak', pos: 'RW', line: 1 },
      'morgan geekie': { name: 'Morgan Geekie', pos: 'LW', line: 3 },
      'charlie mcavoy': { name: 'Charlie McAvoy', pos: 'D', line: 2 },
      'scratch guy': { name: 'Scratch Guy', pos: 'C', line: null, inLineup: false },
    } } } } } };
    expect(snapshotSlot(snap, 9, 'BOS', 'Morgan Geekie')).toEqual({ pos: 'LW', line: 3 });
    expect(snapshotSlot(snap, 9, 'BOS', 'Charlie McAvoy')).toEqual({ pos: 'D', line: 2 });
    expect(snapshotSlot(snap, 9, 'BOS', 'Scratch Guy')).toBeNull();
    expect(snapshotSlot(snap, 9, 'BOS', 'Nobody')).toBeNull();
    expect(slotLabel('LW', 3)).toBe('LW3');
    expect(slotLabel('D', 2)).toBe('D2');
    expect(slotLabel('C', null)).toBeNull();
  });
});

describe('last known lineup', () => {
  const roster = Object.fromEntries(['Jesper Bratt', 'Ondrej Palat', 'Jack Hughes', 'Nico Hischier', 'Timo Meier', 'Dawson Mercer', 'Luke Hughes', 'Dougie Hamilton', 'Brett Pesce', 'New Guy']
    .map((n, i) => [n.toLowerCase(), { name: n, id: i + 1, team: 'NJD', pos: i < 2 ? 'LW' : i < 4 ? 'C' : i < 6 ? 'RW' : 'D', line: null, inLineup: false }]));
  const last = { date: '2026-09-30', source: 'lineup', players: {
    'jesper bratt': { name: 'Jesper Bratt', pos: 'LW', line: 1 }, 'ondrej palat': { name: 'Ondrej Palat', pos: 'LW', line: 2 },
    'jack hughes': { name: 'Jack Hughes', pos: 'C', line: 1 }, 'nico hischier': { name: 'Nico Hischier', pos: 'C', line: 2 },
    'timo meier': { name: 'Timo Meier', pos: 'RW', line: 1 }, 'traded away': { name: 'Traded Away', pos: 'RW', line: 2 },
    'luke hughes': { name: 'Luke Hughes', pos: 'D', line: 1 }, 'dougie hamilton': { name: 'Dougie Hamilton', pos: 'D', line: 1 }, 'brett pesce': { name: 'Brett Pesce', pos: 'D', line: 2 },
  } };
  test('no lineup today: every slot the last lineup can fill is filled, by players still on the roster', () => {
    const { players, carried } = fillFromLastLineup(roster, roster, last);
    expect(carried).toBe(8); // 9 placed last time, one has left the roster
    expect(players['ondrej palat']).toMatchObject({ pos: 'LW', line: 2, inLineup: true, carried: true, carriedFrom: '2026-09-30', id: 2, team: 'NJD' });
    expect(players['traded away']).toBeUndefined();
    expect(players['new guy']).toMatchObject({ inLineup: false });
  });
  test('a partial lineup keeps its own placements and fills only the holes', () => {
    const today = { ...roster, 'jesper bratt': { ...roster['jesper bratt'], pos: 'LW', line: 1, inLineup: true }, 'ondrej palat': { ...roster['ondrej palat'], pos: 'C', line: 1, inLineup: true } };
    const { players, carried } = fillFromLastLineup(today, roster, last);
    // Palat is C1 today, so his old LW2 slot stays open for nobody; Jack Hughes' old C1 is taken.
    expect(players['ondrej palat']).toMatchObject({ pos: 'C', line: 1 });
    expect(players['ondrej palat'].carried).toBeUndefined();
    expect(players['jack hughes']).toMatchObject({ inLineup: false });
    expect(players['nico hischier']).toMatchObject({ pos: 'C', line: 2, carried: true });
    expect(players['timo meier']).toMatchObject({ pos: 'RW', line: 1, carried: true });
    expect(carried).toBe(5); // C2, RW1, D1 ×2, D2
    expect(fillFromLastLineup(today, roster, null)).toEqual({ players: today, carried: 0 });
  });
  test('only a team’s own capture is remembered, never the carried slots or a bare roster', () => {
    const { players } = fillFromLastLineup(roster, roster, last);
    expect(lineupToRemember({ source: 'roster', players }, '2026-10-01', 1)).toBeNull();
    const own = { source: 'gamedaytweets', meta: { capturedAt: 'T' }, players: { ...players, 'new guy': { ...roster['new guy'], pos: 'RW', line: 2, inLineup: true } } };
    expect(lineupToRemember(own, '2026-10-01', 1)).toBeNull(); // one own placement is not a lineup
    const full = { source: 'lineup', players: Object.fromEntries(Object.entries(last.players).map(([k, v]) => [k, { ...v, inLineup: true }])) };
    const kept = lineupToRemember(full, '2026-10-01', 1);
    expect(kept).toMatchObject({ date: '2026-10-01', gameId: 1, source: 'lineup' });
    expect(Object.keys(kept.players)).toHaveLength(9);
  });
});
