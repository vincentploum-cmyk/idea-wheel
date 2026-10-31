import { describe, expect, test } from '@jest/globals';
import { goalieRowsOf, goalieRowObj, goalieBook, likelyStarter, savesChance, savesRow, pickSaves, withSavesActuals, shrunkSv, normalCdf, GOALIE_ROW_FIELDS, SAVES_FLOOR } from '../lib/nhl-data/goalies-pure';

const rec = (id, date, away, home, goalies) => ({ id, season: 20262027, date, away: { abbrev: away, score: 3 }, home: { abbrev: home, score: 2 }, goalies });
const gk = (id, name, team, venue, sa, sv, starter = true, toi = 60) => ({ id, name, team, venue, toi, sa, ga: sa - sv, sv, starter, decision: starter ? 'W' : null });

describe('goalies: the rows', () => {
  test('a game record’s goalies as rows, the opponent from the other side; the row back as an object', () => {
    const g = rec(2026020214, '2026-10-30', 'NJD', 'VGK', [gk(8476945, 'C. Hellebuyck', 'NJD', 'A', 21, 19), gk(8474596, 'J. Allen', 'NJD', 'A', 0, 0, false, 0), gk(8478499, 'A. Hill', 'VGK', 'H', 31, 27)]);
    const rows = goalieRowsOf(g);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['2026-10-30', 2026020214, 8476945, 'C. Hellebuyck', 'NJD', 'VGK', 'A', 60, 21, 2, 19, 1, 'W']);
    expect(rows[2].slice(4, 7)).toEqual(['VGK', 'NJD', 'H']);
    expect(goalieRowObj(rows[2])).toMatchObject({ playerId: 8478499, team: 'VGK', opp: 'NJD', sa: 31, sv: 27, ga: 4, starter: 1 });
    expect(GOALIE_ROW_FIELDS).toHaveLength(13);
  });
});

// A season: VGK's Hill starts seven of ten, Hart three; NJD's Hellebuyck every game; BOS last season only.
function season() {
  const games = [];
  for (let i = 0; i < 10; i++) {
    const date = `2026-10-${String(10 + i * 2).padStart(2, '0')}`;
    const hillStarts = i % 10 !== 3 && i % 10 !== 6 && i % 10 !== 9;
    games.push(rec(2026020100 + i, date, 'NJD', 'VGK', [
      gk(1, 'C. Hellebuyck', 'NJD', 'A', 30, 27),
      gk(2, 'A. Hill', 'VGK', 'H', hillStarts ? 28 : 0, hillStarts ? 26 : 0, hillStarts, hillStarts ? 60 : 0),
      gk(3, 'C. Hart', 'VGK', 'H', hillStarts ? 0 : 32, hillStarts ? 0 : 27, !hillStarts, hillStarts ? 0 : 60),
    ]));
  }
  games.push(rec(2025020900, '2026-03-01', 'BOS', 'NJD', [gk(4, 'J. Swayman', 'BOS', 'A', 35, 33), gk(1, 'C. Hellebuyck', 'NJD', 'H', 20, 18)]));
  return games.flatMap(goalieRowsOf).map(goalieRowObj);
}

describe('goalies: the book and the likely starter', () => {
  const rows = season();
  test('each team’s goalies this season with their lines, shrunk save percentages and recent starts; last season stands in for a team without a game', () => {
    const book = goalieBook(rows, 2026, { through: '2026-10-29' });
    const vgk = book.teams.VGK;
    expect(vgk.games).toBe(10);
    expect(vgk.goalies.map((g) => [g.name, g.starts, g.gp, g.startsRecent])).toEqual([['A. Hill', 7, 7, 7], ['C. Hart', 3, 3, 3]]);
    const hill = vgk.goalies[0];
    expect(hill).toMatchObject({ sa: 196, sv: 182, ga: 14, pct: 0.929, savesPerStart: 26, lastStart: '2026-10-26' });
    expect(hill.svPct).toBe(shrunkSv(182, 196, book.league.pct));
    expect(hill.l5).toMatchObject({ starts: 5, sv: 26, sa: 28 });
    expect(vgk.lastGame).toBe('2026-10-28'); expect(vgk.lastStarter).toBe(3);   // Hart started the tenth game
    expect(book.teams.NJD.goalies[0]).toMatchObject({ name: 'C. Hellebuyck', starts: 10, gp: 10 });
    // Under 2,000 shots this season the league's percentage is the constant.
    expect(book.league.pct).toBe(0.9);
    // BOS has no game this season: last season's row stands in, held.
    expect(book.teams.BOS).toMatchObject({ held: true });
    expect(book.teams.BOS.goalies[0].name).toBe('J. Swayman');
    // Through the date: a game on the date itself is tonight's, not a prior.
    expect(goalieBook(rows, 2026, { through: '2026-10-28' }).teams.VGK.games).toBe(9);
  });
  test('shrunkSv: a goalie’s own percentage leads from a few hundred shots', () => {
    expect(shrunkSv(0, 0)).toBe(0.9);
    expect(shrunkSv(95, 100)).toBe(0.92);          // (95 + 135) / 250
    expect(shrunkSv(930, 1000)).toBe(0.926);       // (930 + 135) / 1150
  });
  test('likelyStarter: the most recent starts, the other goalie on the second night of a back-to-back', () => {
    const book = goalieBook(rows, 2026, { through: '2026-10-29' });
    const vgk = likelyStarter(book, 'VGK', '2026-10-30');
    expect(vgk.goalie.name).toBe('A. Hill');
    expect(vgk.reason).toBe("7 of the team's last 10 starts");
    expect(vgk.b2b).toBe(false);
    expect(vgk.other.name).toBe('C. Hart');
    // VGK played on the 28th: on the 29th it is a back-to-back, and Hart started last night, so Hill still reads likely.
    expect(likelyStarter(goalieBook(rows, 2026, { through: '2026-10-29' }), 'VGK', '2026-10-29')).toMatchObject({ b2b: true, goalie: { name: 'A. Hill' } });
    // NJD on a back-to-back with Hellebuyck last night and no other starter: he stays, the reason says so.
    const njd = likelyStarter(book, 'NJD', '2026-10-29');
    expect(njd.goalie.name).toBe('C. Hellebuyck');
    expect(njd.reason).toContain('back to back, no other starter on record');
    // A team whose usual starter went last night hands the net to the other.
    const flipped = season().filter((r) => !(r.gameId === 2026020109 && r.team === 'VGK')).concat(goalieRowsOf(rec(2026020109, '2026-10-28', 'NJD', 'VGK', [gk(2, 'A. Hill', 'VGK', 'H', 28, 26), gk(3, 'C. Hart', 'VGK', 'H', 0, 0, false, 0)])).map(goalieRowObj));
    const b2b = likelyStarter(goalieBook(flipped, 2026, { through: '2026-10-29' }), 'VGK', '2026-10-29');
    expect(b2b.goalie.name).toBe('C. Hart');
    expect(b2b.reason).toBe('back to back: Hill started last night');
    expect(b2b.other.name).toBe('A. Hill');
    expect(likelyStarter(book, 'ZZZ', '2026-10-30')).toBeNull();
  });
});

describe('goalies: the saves projection', () => {
  test('normalCdf and savesChance', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 4);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    // 27 saves projected, a spread of 6 × .92: 30+ is about a quarter, 25+ about two thirds.
    expect(savesChance(27, 30, 0.92)).toBeCloseTo(0.325, 2);
    expect(savesChance(27, 25, 0.92)).toBeCloseTo(0.675, 2);
    expect(savesChance(45, 25, 0.92)).toBe(1);
  });
  test('savesRow and pickSaves: the shots faced × the save percentage, the marks, the floor on 30+', () => {
    const starter = { goalie: { id: 2, name: 'A. Hill', team: 'VGK', starts: 7, gp: 7, pct: 0.929, svPct: 0.916, savesPerStart: 26, l5: { starts: 5, sv: 26, sa: 28, pct: 0.929 } }, reason: "7 of the team's last 10 starts", b2b: false, other: { id: 3, name: 'C. Hart', starts: 3 }, held: false };
    const row = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'the run’s λ over 18 NJD skaters' });
    expect(row).toMatchObject({ id: 2, name: 'A. Hill', team: 'VGK', opp: 'NJD', venue: 'H', pos: 'G', starter: 'likely', starts: 7, svPct: 0.916, shots: 32.6, lam: 29.9, other: { name: 'C. Hart', starts: 3 } });
    expect(row.p30).toBeCloseTo(savesChance(29.9, 30, 0.916), 6);
    expect(row.p25).toBeGreaterThan(row.p30); expect(row.p30).toBeGreaterThan(row.p35);
    const low = savesRow({ team: 'NJD', opp: 'VGK', venue: 'A', starter: { goalie: { id: 1, name: 'C. Hellebuyck', starts: 10, gp: 10, svPct: 0.905 }, reason: 'x' }, shots: 24, shotsFrom: 'x' });
    const table = pickSaves([low, row]);
    expect(table.map((r) => [r.name, r.under])).toEqual([['A. Hill', row.p30 < SAVES_FLOOR], ['C. Hellebuyck', true]]);
    expect(savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter: null, shots: 30 })).toBeNull();
    expect(savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: null })).toBeNull();
  });
  test('withSavesActuals: the goalie’s own line once the game is stored; another starter marks the row as the wrong man', () => {
    const rows = [{ id: 2, name: 'A. Hill', team: 'VGK', lam: 29.9 }, { id: 1, name: 'C. Hellebuyck', team: 'NJD', lam: 21 }];
    const goalies = [{ id: 3, name: 'C. Hart', team: 'VGK', sa: 31, sv: 27, ga: 4, starter: true }, { id: 2, name: 'A. Hill', team: 'VGK', sa: 0, sv: 0, ga: 0, starter: false }, { id: 1, name: 'C. Hellebuyck', team: 'NJD', sa: 21, sv: 19, ga: 2, starter: true }];
    const out = withSavesActuals(rows, goalies);
    expect(out[0]).toMatchObject({ played: false, startedBy: 'C. Hart', actual: { sv: 27, sa: 31, ga: 4, starter: true } });
    expect(out[1]).toMatchObject({ actual: { sv: 19, sa: 21, ga: 2, starter: true } });
    expect(out[1].played).toBeUndefined();
    expect(withSavesActuals(rows, null)).toBe(rows);
  });
});
