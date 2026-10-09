import { describe, expect, test } from '@jest/globals';
import { blendRates, project, fromModel, poissonAtLeast, fairOdds, shotsAllowed, pickGame, notesFor, seasonYearOf, SHOTS_FLOOR } from '../lib/nhl-data/picks';

const game = (sog, icf = sog * 1.8, g = 0.3, iscf = 1.5) => ({ sog, icf, g, iscf });

describe('tonight’s picks', () => {
  test('seasons run July to June', () => {
    expect(seasonYearOf('2026-10-08')).toBe(2026);
    expect(seasonYearOf('2027-04-01')).toBe(2026);
  });
  test('rates blend this season into last season’s base by games played', () => {
    const prev = Array.from({ length: 82 }, () => game(3));
    const cur = [game(5), game(6), game(4)];
    const r = blendRates(cur, prev);
    // w = 3 / 21 for shots: 5 * 3/21 + 3 * 18/21
    expect(r.sog).toBeCloseTo(3.286, 2);
    expect(r.baseSog).toBe(3);
    expect(r.curSog).toBe(5);
    // No base and too few games this season: no rate. Five games this season stand alone.
    expect(blendRates(cur, [])).toBeNull();
    expect(blendRates([...cur, game(2), game(3)], []).sog).toBe(4);
  });
  test('the projection is a multiplicative Poisson rate and the tails follow it', () => {
    const r = blendRates(Array.from({ length: 82 }, () => game(3.4, 6.5, 0.45, 2.3)), Array.from({ length: 82 }, () => game(3.4, 6.5, 0.45, 2.3)));
    const p = project(r, { home: false, oppShotsAllowed: 30 });
    expect(p.lamS).toBeGreaterThan(3.1);
    expect(p.lamS).toBeLessThan(3.6);
    expect(p.p3).toBeCloseTo(poissonAtLeast(p.lamS, 3), 2);
    expect(p.p2).toBeGreaterThan(p.p3);
    expect(p.p3).toBeGreaterThan(p.p4);
    // A softer opponent and home ice lift the rate; the top end does not run away.
    expect(project(r, { home: true, oppShotsAllowed: 30 }).lamS).toBeGreaterThan(p.lamS);
    expect(project(r, { home: false, oppShotsAllowed: 24 }).lamS).toBeLessThan(p.lamS);
    const star = blendRates([], Array.from({ length: 80 }, () => game(4.4, 8, 0.66, 3.6)));
    expect(project(star, { home: false, oppShotsAllowed: 27 }).lamS).toBeLessThan(4.6);
    expect(project(star, { home: false, oppShotsAllowed: 27 }).p1g).toBeGreaterThan(0.4);
  });
  test('with a saved run the row carries the model’s own numbers, the study’s beside them', () => {
    const study = { lamS: 3.08, p3: 0.59, p4: 0.37, p1g: 0.4 };
    const row = fromModel({ sog: 4.1, g: 0.7, p2s: 0.93, p3s: 0.85, p4s: 0.78, p1g: 0.5 }, study);
    expect(row).toMatchObject({ lamS: 4.1, lamG: 0.7, p2: 0.93, p3: 0.85, p4: 0.78, p1g: 0.5, study: { p3: 0.59, p4: 0.37, p1g: 0.4 } });
    // A probability the run did not carry is read off its λ; no shots rate, no row.
    expect(fromModel({ sog: 3, g: 0.4 }).p3).toBeCloseTo(poissonAtLeast(3, 3), 2);
    expect(fromModel({ sog: 3, g: 0.4 }).p1g).toBeCloseTo(1 - Math.exp(-0.4), 2);
    expect(fromModel({ sog: 3, g: 0.4 }).study).toBeNull();
    expect(fromModel(null, study)).toBeNull();
    expect(fromModel({ sog: null, p3s: 0.6 }, study)).toBeNull();
  });
  test('poisson tails and break-even prices', () => {
    expect(poissonAtLeast(3, 3)).toBeCloseTo(0.5768, 3);
    expect(poissonAtLeast(1, 1)).toBeCloseTo(0.6321, 3);
    expect(fairOdds(0.68)).toBe('-213');
    expect(fairOdds(0.43)).toBe('+133');
    expect(fairOdds(0.5)).toBe('-100');
    expect(fairOdds(0)).toBe('—');
  });
  test('shots allowed per game and the rank, 1 = allows the most', () => {
    const rows = [
      { opp: 'BUF', gameId: 1, sog: 20 }, { opp: 'BUF', gameId: 1, sog: 15 }, { opp: 'BUF', gameId: 2, sog: 30 },
      { opp: 'CAR', gameId: 3, sog: 10 }, { opp: 'CAR', gameId: 3, sog: 12 },
    ];
    const a = shotsAllowed(rows);
    expect(a.teams.BUF).toEqual({ games: 2, sog: 32.5, rank: 1 });
    expect(a.teams.CAR).toEqual({ games: 1, sog: 22, rank: 2 });
    expect(a.league).toBe(27.25);
    expect(a.teamCount).toBe(2);
  });
  test('every skater over the floor is a pick; below it the best one is marked as a fallback', () => {
    const c = (name, p3, p1g) => ({ id: name, name, p3, p1g, lamS: p3 * 5, lamG: p1g });
    const g = pickGame([c('A', 0.7, 0.2), c('B', 0.55, 0.4), c('C', 0.4, 0.36), c('D', 0.3, 0.1), c('E', 0.2, 0.05), c('F', 0.1, 0.02)]);
    // Two over the floor, filled to three with the next best, marked under; then the next three.
    expect(g.shots.map((x) => [x.name, x.under])).toEqual([['A', false], ['B', false], ['C', true]]);
    expect(g.shotsFallback).toBe(false);
    expect(g.nextShots.map((x) => x.name)).toEqual(['D', 'E', 'F']);
    expect(g.goals.map((x) => [x.name, x.under])).toEqual([['B', false], ['C', false], ['A', true]]);
    expect(g.nextGoals.map((x) => x.name)).toEqual(['D', 'E', 'F']);
    // Five over the floor: all five.
    const five = pickGame([c('A', 0.7, 0.5), c('B', 0.6, 0.5), c('C', 0.55, 0.5), c('D', 0.52, 0.5), c('E', 0.5, 0.5), c('F', 0.2, 0.1)]);
    expect(five.shots.map((x) => x.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(five.shots.every((x) => !x.under)).toBe(true);
    expect(five.nextShots.map((x) => x.name)).toEqual(['F']);
    // Nobody over the floor: three rows, all under, and the fallback flag for the notes.
    const thin = pickGame([c('A', 0.43, 0.28), c('B', 0.4, 0.2), c('C', 0.3, 0.1), c('D', 0.2, 0.1)]);
    expect(thin.shots.map((x) => x.name)).toEqual(['A', 'B', 'C']);
    expect(thin.shots.every((x) => x.under)).toBe(true);
    expect(thin.shotsFallback).toBe(true);
    expect(thin.goalsFallback).toBe(true);
    expect(thin.nextShots.map((x) => x.name)).toEqual(['D']);
    // Fewer than three skaters: what there is.
    expect(pickGame([c('A', 0.43, 0.28)]).shots.map((x) => x.name)).toEqual(['A']);
    expect(SHOTS_FLOOR).toBe(0.5);
  });
  test('the notes read the picks: soft spots, the richest game, environment plays, near-ties, thin games, lineups', () => {
    const c = (name, opp, p3, p1g, sog, oppRank, under = false) => ({ name, opp, p3, p1g, rates: { sog }, oppRank, under });
    const allowed = { teamCount: 32, teams: { BUF: { sog: 33.1, rank: 32 }, PHI: { sog: 32, rank: 31 }, STL: { sog: 25, rank: 10 }, TBL: { sog: 29, rank: 25 } } };
    const games = [
      { away: 'DAL', home: 'BUF', shots: [c('Tage Thompson', 'BUF', 0.74, 0.48, 3.4, 32), c('Jason Robertson', 'BUF', 0.57, 0.49, 3.6, 32)], goals: [c('Jason Robertson', 'BUF', 0.57, 0.49, 3.6, 32), c('Tage Thompson', 'BUF', 0.74, 0.48, 3.4, 32)], shotsFallback: false, goalsFallback: false },
      // A fill-in under the floor (Eklund) is neither an environment play nor part of a near-tie.
      { away: 'PHI', home: 'OTT', shots: [c('Dylan Cozens', 'PHI', 0.56, 0.27, 2.5, 1), c('Tim Stutzle', 'PHI', 0.54, 0.36, 2.42, 1), c('William Eklund', 'PHI', 0.49, 0.2, 2.3, 1, true)], goals: [c('Tim Stutzle', 'PHI', 0.54, 0.36, 2.42, 1)], shotsFallback: false, goalsFallback: false },
      { away: 'SJS', home: 'STL', shots: [c('Dylan Holloway', 'SJS', 0.43, 0.28, 2.75, 20)], goals: [c('Dylan Holloway', 'SJS', 0.43, 0.28, 2.75, 20)], shotsFallback: true, goalsFallback: true },
      { away: 'MIN', home: 'TBL', shots: [c('A', 'TBL', 0.71, 0.48, 3, 25), c('B', 'MIN', 0.7, 0.46, 3.3, 31), c('C', 'MIN', 0.63, 0.56, 3.4, 31)], goals: [c('C', 'MIN', 0.63, 0.56, 3.4, 31), c('D', 'TBL', 0.5, 0.5, 3, 25), c('A', 'TBL', 0.71, 0.48, 3, 25)], shotsFallback: false, goalsFallback: false },
    ];
    const notes = notesFor(games, allowed, { total: 8, gamedaytweets: 6, roster: 2, carried: 1 });
    const kinds = notes.map((n) => n.kind);
    expect(kinds).toEqual(['soft', 'rich', 'env', 'tie', 'thin', 'lineups']);
    expect(notes[0].text).toContain('BUF has allowed the most shots in the league so far (33.1 a game, #32 of 32): Thompson and Robertson get that matchup.');
    expect(notes[0].text).toContain('PHI has allowed the second most shots');
    expect(notes[1].text).toBe('MIN @ TBL is the richest game: 3 shooters over 55% for 3+ and 3 scorers over 40%.');
    expect(notes[2].text).toContain('Cozens and Stutzle are environment plays: PHI allows the most shots in the league');
    expect(notes[3].text).toContain('A and B (3+ shots)');
    expect(notes[3].text).toContain('Robertson and Thompson (1+ goal)');
    expect(notes[4].text).toContain('SJS @ STL has no real pick either way: nobody is over 50% for 3+ shots or 35% for a goal, so the rows there are the best available.');
    expect(notes[5].text).toBe("Lineups: beat writers' lines for 6, the roster for 2 of 8 teams, with 1 slot carried from an earlier game. Check scratches before puck drop.");
  });
});
