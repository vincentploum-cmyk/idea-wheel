import { describe, expect, test } from '@jest/globals';
import { nbaBoard, COCKTAIL, COCKTAIL_BEFORE_STAR_OUT, STAR_OUT } from '../lib/nba/picks';
import { applyLineupOuts } from '../lib/picks/injuries';
import { ladderBoard, tierBoard } from '../lib/picks/boards';
import { shuffleOf, statOf, actualFor } from '../lib/nba/picks';
import { nbaBigGames, nbaOutliers } from '../lib/nba/big';

// The star out (Vincent, 2026-11-09, Reaves's 43 the night Doncic sat; docs/audits/2026-11-09-nba-star-out.md): who sits
// from RotoWire's lineups, every out player of this season by his share of each teammate's memory, the ceiling on the lifts.
const row = (o) => ({ gp: 10, season: 2026, pts: 113, reb: 44, ast: 26, tpm: 13, tpa: 35, stl: 7.5, blk: 5, tov: 14, ftm: 17, ...o });
const totals = {};
['ATL', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GS', 'HOU', 'IND', 'LAC', 'MEM', 'MIA', 'MIL', 'MIN', 'NO', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SA', 'TOR', 'UTAH', 'WSH', 'SAC', 'NY', 'BOS'].forEach((t) => { totals[t] = { for: row(), against: row() }; });
totals.LAL = { for: row({ pts: 120 }), against: row() };
const leagueFor = { pts: 113, reb: 44, ast: 26, tpm: 13, tpa: 35, stl: 7.5, blk: 5, tov: 14, ftm: 17 };
const defense = { totals, leagueFor, count: 30, league: {}, teams: {}, ranks: {}, windows: {} };
const games = [{ id: 'g1', date: '2026-11-08T23:30Z', away: 'LAL', home: 'DET', final: false, state: 'pre' }];
// Ten team games this season (ids t1…t10, newest first), the star in `with` of them; the same rate every night.
const logs = (perMin, min, played = () => true, { starter = true } = {}) => {
  const g = [];
  for (let i = 0; i < 10; i++) if (played(i)) g.push({ date: new Date(Date.UTC(2026, 10, 7 - i)).toISOString().slice(0, 10), gameId: `t${i + 1}`, season: 2026, type: 'REG', opp: 'MIA', min, pts: perMin * min, reb: 0.15 * min, ast: 0.12 * min, tpm: 0.06 * min, starter: starter ? 1 : undefined });
  return g.map((x) => ({ ...x, pra: x.pts + x.reb + x.ast }));
};
const reaves = { id: 'r', name: 'Austin Reaves', key: 'austin reaves', team: 'LAL', pos: 'SG', games: logs(0.65, 36), props: [] };
// Doncic: 40 a game (1.08 a minute × 37), the last three team games missed.
const doncic = (played, injury) => ({ id: 'd', name: 'Luka Doncic', key: 'luka doncic', team: 'LAL', pos: 'PG', games: logs(1.08, 37, played), props: [], ...(injury ? { injury } : {}) });
const pfWith = (players, injuries = null) => ({ at: '2026-11-08T14:00:00Z', data: { players, defense, injuries } });
const out = { rows: [{ team: 'LAL', key: 'luka doncic', name: 'Luka Doncic', status: 'Out', pos: 'PG' }] };
const board = (ck, players, extra = {}) => nbaBoard({ ...ck, reach: 0 }).buildBoard({ date: '2026-11-08', season: 2026, games, sheets: [], pf: pfWith(players, extra.injuries || null), results: {}, lineups: extra.lineups || null });
const side = (b) => b.games[0].sides.LAL;

describe('the teammates out, by his share of the memory (outRule overlap)', () => {
  test('a star out three games still lifts: the last-five rule lifted nobody', () => {
    const d = doncic((i) => i >= 3, 'Out');
    const before = side(board(COCKTAIL_BEFORE_STAR_OUT, [reaves, d], { injuries: out }));
    expect(before.outRead).toBeUndefined();
    const now = side(board(COCKTAIL, [reaves, d], { injuries: out }));
    expect(now.outRead.names).toEqual(['Luka Doncic']);
    const r = now.players.find((x) => x.key === 'austin reaves');
    // His memory (half-life 15) holds 7 of 10 games with Doncic; 40 × that share over LAL's 120, ^0.7.
    const dd = 0.5 ** (1 / 15); let w = 1; let ws = 0; let part = 0;
    for (let i = 0; i < 10; i++) { if (i >= 3) part += w; ws += w; w *= dd; }
    expect(r.ranges.pts.out).toBeCloseTo((1 + (40 * part) / ws / 120) ** STAR_OUT.pts, 2);
    expect(r.ranges.pts.out).toBeGreaterThan(1.1);
  });

  test('a player who never shared the floor with him gets nothing', () => {
    const d = doncic((i) => i >= 5, 'Out');
    const newcomer = { ...reaves, id: 'n', name: 'New Guy', key: 'new guy', games: logs(0.4, 25, (i) => i < 5) };
    const now = side(board(COCKTAIL, [reaves, newcomer, d], { injuries: out }));
    expect(now.players.find((x) => x.key === 'new guy').ranges.pts.out).toBeNull();
    expect(now.players.find((x) => x.key === 'austin reaves').ranges.pts.out).toBeGreaterThan(1);
  });
});

describe('who sits from RotoWire (applyLineupOuts)', () => {
  const bench = (n) => ({ id: n, name: n, key: n, team: 'LAL', pos: 'SF', games: logs(0.4, 24), props: [] });
  const five = ['austin reaves', 'b1', 'b2', 'b3', 'b4'];
  const pf = pfWith([reaves, doncic(() => true), bench('b1'), bench('b2'), bench('b3'), bench('b4')]);
  test('a confirmed five without a regular starter sits him', () => {
    const next = applyLineupOuts(pf, { teams: { LAL: { status: 'confirmed', starters: five.map((name) => ({ name })) } } }, { season: 2026 });
    const d = next.data.players.find((p) => p.key === 'luka doncic');
    expect(d).toMatchObject({ injury: 'Out', injuryFrom: 'lineup' });
    expect(d.injuryDetail).toMatch(/confirmed five/);
    expect(pf.data.players.find((p) => p.key === 'luka doncic').injury).toBeUndefined();
  });
  test('the admin’s override (marked in) stands', () => {
    const over = { ...pf, data: { ...pf.data, players: pf.data.players.map((p) => (p.key === 'luka doncic' ? { ...p, injury: null, injuryFrom: 'override' } : p)) } };
    expect(applyLineupOuts(over, { teams: { LAL: { status: 'confirmed', starters: five.map((name) => ({ name })) } } }, { season: 2026 })).toBe(over);
  });
  test('an expected five, or a five with a name the pull does not know, sits nobody', () => {
    expect(applyLineupOuts(pf, { teams: { LAL: { status: 'expected', starters: five.map((name) => ({ name })) } } }, { season: 2026 })).toBe(pf);
    expect(applyLineupOuts(pf, { teams: { LAL: { status: 'confirmed', starters: [...five.slice(0, 4), 'Somebody Else'].map((name) => ({ name })) } } }, { season: 2026 })).toBe(pf);
  });
  test('"MAY NOT PLAY" with OUT or a 0% chance sits him; GTD does not', () => {
    const lu = (status, play) => ({ teams: { LAL: { status: 'expected', starters: [], mayNotPlay: [{ name: 'Luka Doncic', status, ...(play != null ? { play } : {}) }] } } });
    expect(applyLineupOuts(pf, lu('OUT')).data.players.find((p) => p.key === 'luka doncic').injury).toBe('Out');
    expect(applyLineupOuts(pf, lu('GTD', 0)).data.players.find((p) => p.key === 'luka doncic').injury).toBe('Out');
    expect(applyLineupOuts(pf, lu('GTD', 50))).toBe(pf);
  });
  test('on the board: the lineup alone lifts his teammates', () => {
    const lineups = { teams: { LAL: { status: 'confirmed', starters: five.map((name) => ({ name })) } } };
    const s = side(board(COCKTAIL, [reaves, doncic(() => true), bench('b1'), bench('b2'), bench('b3'), bench('b4')], { lineups }));
    expect(s.out.map((x) => x.name)).toEqual(['Luka Doncic']);
    expect(s.players.find((x) => x.key === 'luka doncic').out).toBe(true);
    expect(s.players.find((x) => x.key === 'austin reaves').ranges.pts.out).toBeGreaterThan(1.2);
  });
});

describe('the team ceiling sums the lifted rates (ceilingOut)', () => {
  test('a side whose lifted rates pass the team total is cut back to it', () => {
    // Five 30-point scorers, one out: the four left sum to 120 = the total; lifted, they pass it and the ceiling cuts.
    const scorer = (n) => ({ id: n, name: n, key: n, team: 'LAL', pos: 'SG', games: logs(30 / 36, 36), props: [] });
    const players = ['s1', 's2', 's3', 's4', 's5'].map(scorer); players[4] = { ...players[4], injury: 'Out' };
    const injuries = { rows: [{ team: 'LAL', key: 's5', name: 's5', status: 'Out', pos: 'SG' }] };
    const on = side(board(COCKTAIL, players, { injuries }));
    const off = side(board({ ...COCKTAIL, ceilingOut: false }, players, { injuries }));
    expect(off.scale.pts).toBeUndefined();
    expect(on.scale.pts).toBeLessThan(1);
    expect(on.scale.pts).toBeCloseTo(1 / on.players.find((x) => x.key === 's1').ranges.pts.out, 2);
  });
});

describe('who is not expected to play is off the lists (idle)', () => {
  // Ten team games; a deep-bench player with 2 minutes in one of the last five, a regular, a regular back from an absence.
  const p = (key, perMin, min, played, extra = {}) => ({ id: key, name: key, key, team: 'LAL', pos: 'SF', games: logs(perMin, min, played), props: [], ...extra });
  const roster = [p('r1', 0.5, 30, () => true), p('r2', 0.5, 30, () => true), p('r3', 0.5, 30, () => true),
    p('deep', 0.4, 2, (i) => i === 2), p('back', 0.5, 32, (i) => i >= 6), p('priced', 0.4, 2, (i) => i === 2, { props: [{ market: 'pts', line: 3.5, side: 'over', odds: -110, main: true }] })];
  test('the deep bench is idle; a regular back, a priced player and the five are not', () => {
    const s = side(board(COCKTAIL, roster));
    const idle = s.players.filter((x) => x.idle).map((x) => x.key);
    expect(idle).toEqual(['deep']);
    const five = { teams: { LAL: { status: 'expected', starters: ['r1', 'r2', 'r3', 'deep', 'back'].map((name) => ({ name })) } } };
    expect(side(board(COCKTAIL, roster, { lineups: five })).players.some((x) => x.idle)).toBe(false);
    expect(side(board(COCKTAIL_BEFORE_STAR_OUT, roster)).players.some((x) => x.idle)).toBe(false);
  });
  test('the Outliers and Big games lists leave him off too (2026-11-13: a released player listed at 27 minutes)', () => {
    // Kevin Porter Jr.'s case: no game this season (his preseason is not read), last season's at 27 minutes, still on the pull.
    const gone = { id: 'gone', name: 'gone', key: 'gone', team: 'LAL', pos: 'SG', props: [],
      games: Array.from({ length: 20 }, (_, i) => ({ date: new Date(Date.UTC(2026, 3, 10 - i)).toISOString().slice(0, 10), gameId: `l${i}`, season: 2025, type: 'REG', opp: 'MIA', min: 27, pts: 14, reb: 4, ast: 6 + (i % 5), tpm: 2, starter: 1, pra: 24 + (i % 5) })) };
    const b = board(COCKTAIL, [...roster, gone]);
    const g = side(b).players.find((x) => x.key === 'gone');
    const ctx = { pf: pfWith([...roster, gone]), results: {}, statOf, actualFor, season: 2026 };
    b.big = { ...nbaBigGames(b, ctx), outliers: nbaOutliers(b, ctx) };
    expect(g.idle).toBe(true);
    expect(g.minutes.tonight).toBeGreaterThanOrEqual(12);
    expect(Object.values(b.big.outliers.rows).map((r) => r.key)).not.toContain('gone');
    expect(Object.values(b.big.rows || {}).map((r) => r.key)).not.toContain('gone');
    expect(Object.values(b.big.outliers.rows).map((r) => r.key)).toContain('r1');
  });
  test('the Games tab, the boards and the shuffle leave him off', () => {
    const b = board(COCKTAIL, roster);
    expect(ladderBoard(b, { market: 'pts', keepAll: true }).map((r) => r.key)).not.toContain('deep');
    const sh = shuffleOf({ market: 'pts', board: b, pf: pfWith(roster), season: 2026, results: {} });
    expect(sh.players.map((r) => r.key)).not.toContain('deep');
    expect(sh.players.map((r) => r.key)).toContain('r1');
    expect(tierBoard(sh, { step: 5, keepAll: true }).map((r) => r.key)).not.toContain('deep');
  });
});
