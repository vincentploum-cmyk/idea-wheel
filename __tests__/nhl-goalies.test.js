import { describe, expect, test } from '@jest/globals';
import { goalieRowsOf, goalieRowObj, goalieBook, likelyStarter, savesChance, savesRow, pickSaves, withSavesActuals, shrunkSv, normalCdf, teamShotBook, shotsAgainst, shotsAgainstText, GOALIE_ROW_FIELDS, SAVES_FLOOR, SAVES_LEAD, savesHit, SAVES_SD, STARTER_SHARE, LEAGUE_SHOTS } from '../lib/nhl-data/goalies-pure';

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
    // 27 saves projected, a spread of 6.8 saves (the study's miss in every band): 30+ about a third, 25+ about two thirds.
    expect(SAVES_SD).toBe(6.8);
    expect(savesChance(27, 30)).toBeCloseTo(1 - normalCdf(2.5 / 6.8), 3);
    expect(savesChance(27, 30)).toBeCloseTo(0.357, 2);
    expect(savesChance(27, 25)).toBeCloseTo(0.643, 2);
    expect(savesChance(60, 25)).toBe(1);
  });
  test('savesRow and pickSaves: the shots allowed × the starter’s share × the save percentage, the marks, the floor on 25+', () => {
    const starter = { goalie: { id: 2, name: 'A. Hill', team: 'VGK', starts: 7, gp: 7, pct: 0.929, svPct: 0.916, savesPerStart: 26, l5: { starts: 5, sv: 26, sa: 28, pct: 0.929 } }, reason: "7 of the team's last 10 starts", b2b: false, other: { id: 3, name: 'C. Hart', starts: 3 }, held: false };
    // 32.6 shots expected against VGK, 97% of them on Hill (31.6) × .916 = 29.0 saves; the board's λ sum rides beside it.
    const row = savesRow({ team: 'VGK', opp: 'NJD', venue: 'H', starter, shots: 32.6, shotsFrom: 'x', boardShots: 31.24 });
    expect(STARTER_SHARE).toBe(0.97);
    expect(row).toMatchObject({ id: 2, name: 'A. Hill', team: 'VGK', opp: 'NJD', venue: 'H', pos: 'G', starter: 'likely', starts: 7, svPct: 0.916, shots: 32.6, faced: 31.6, boardShots: 31.2, lam: 29, other: { name: 'C. Hart', starts: 3 } });
    expect(row.p30).toBeCloseTo(savesChance(29, 30), 6);
    expect(row.p25).toBeGreaterThan(row.p30); expect(row.p30).toBeGreaterThan(row.p35);
    const low = savesRow({ team: 'NJD', opp: 'VGK', venue: 'A', starter: { goalie: { id: 1, name: 'C. Hellebuyck', starts: 10, gp: 10, svPct: 0.905 }, reason: 'x' }, shots: 24, shotsFrom: 'x' });
    const table = pickSaves([low, row]);
    // Without a line the play is called on 25+ (SAVES_LEAD): Hill's 29 saves clear it at 72%, Hellebuyck's 24 × .97 × .905 = 21.1 do not.
    expect(SAVES_LEAD).toBe(25);
    expect(row.p25).toBeGreaterThan(0.7);
    expect(table.map((r) => [r.name, r.under])).toEqual([['A. Hill', false], ['C. Hellebuyck', true]]);
    expect(savesHit({ ...row, actual: { sv: 25, sa: 27 } })).toBe(true);
    expect(savesHit({ ...row, actual: { sv: 24, sa: 27 } })).toBe(false);
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

// Skater rows of three games this season: VGK 30 and 34 shots against NJD's 20 and 24; NJD 26 at BOS (BOS 30). Last season
// VGK–NJD 30–25 and NJD–BOS 35–29.
const sk = (date, gameId, team, opp, sog) => ({ date, gameId, team, opp, sog });
const shotRows = [
  sk('2025-11-01', 1, 'VGK', 'NJD', 30), sk('2025-11-01', 1, 'NJD', 'VGK', 25),
  sk('2025-11-02', 2, 'NJD', 'BOS', 35), sk('2025-11-02', 2, 'BOS', 'NJD', 29),
  sk('2026-10-20', 10, 'VGK', 'NJD', 18), sk('2026-10-20', 10, 'VGK', 'NJD', 12), sk('2026-10-20', 10, 'NJD', 'VGK', 20),
  sk('2026-10-22', 11, 'VGK', 'NJD', 34), sk('2026-10-22', 11, 'NJD', 'VGK', 24),
  sk('2026-10-24', 12, 'NJD', 'BOS', 26), sk('2026-10-24', 12, 'BOS', 'NJD', 30),
];

describe('goalies: the shots a team is expected to allow', () => {
  test('teamShotBook: shots for and against a game per team, this season and last; the league’s a team a game', () => {
    const book = teamShotBook(shotRows, 2026);
    expect(book.teams.VGK.cur).toEqual({ games: 2, sf: 32, sa: 22 });
    expect(book.teams.NJD.cur).toEqual({ games: 3, sf: 23.33, sa: 31.33 });
    expect(book.teams.VGK.prev).toEqual({ games: 1, sf: 30, sa: 25 });
    expect(book.league).toEqual({ cur: 27.33, prev: 29.75 });
    expect(teamShotBook(shotRows, 2026)).toBe(book); // memoised per rows array
  });
  test('shotsAgainst: the league plus both teams’ gaps, this season into last, home ice; the words behind it', () => {
    const book = teamShotBook(shotRows, 2026);
    const sa = shotsAgainst(book, 'VGK', 'NJD', 'H');
    // NJD's shots gap: (23.33 − 27.33) × 3 this season, (30 − 29.75) × 10 last → (−12 + 2.5) / 13 = −0.73.
    // VGK's allowed gap: (22 − 27.33) × 2, (25 − 29.75) × 10 → (−10.67 − 47.5) / 12 = −4.85. 27.33 + .89 × −0.73 + .87 × −4.85 − .53 = 21.9.
    expect(sa).toMatchObject({ shots: 21.9, league: 27.3, home: true, opp: { team: 'NJD', sf: 26.6, games: 3, prevGames: 2 }, team: { team: 'VGK', sa: 22.5, games: 2, prevGames: 1 } });
    // On the road the same matchup is 1.06 shots more.
    expect(shotsAgainst(book, 'VGK', 'NJD', 'A').shots).toBe(23);
    // BOS has no last season's game: its own this season alone; a team nobody knows reads the league's.
    expect(shotsAgainst(book, 'BOS', 'NJD', 'H').team).toMatchObject({ games: 1, prevGames: 1 });
    expect(shotsAgainst(book, 'ZZZ', 'YYY', 'A')).toMatchObject({ shots: 27.9, opp: { sf: 27.3, games: 0, prevGames: 0 } });
    expect(shotsAgainst(null, 'ZZZ', 'YYY', 'H').shots).toBe(27.5); // LEAGUE_SHOTS 28 − 0.53 at home
    expect(LEAGUE_SHOTS).toBe(28);
    expect(shotsAgainstText(sa)).toBe('NJD 26.6 shots a game (3 games + last season), VGK 22.5 allowed (2 games + last season), league 27.3, at home');
    expect(shotsAgainstText(shotsAgainst(book, 'ZZZ', 'YYY', 'A'))).toBe('YYY 27.3 shots a game (the league’s), ZZZ 27.3 allowed (the league’s), league 27.3, on the road');
  });
});

