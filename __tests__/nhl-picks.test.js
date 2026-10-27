import { describe, expect, test } from '@jest/globals';
import { blendRates, project, fromModel, blendProjection, formOf, isSoftThird, FORM, poissonAtLeast, fairOdds, shotsAllowed, positionAllowed, isBackToBack, pickGame, notesFor, seasonYearOf, SHOTS_FLOOR, LEAGUE_POS, withActuals, hitOf } from '../lib/nhl-data/picks';

const game = (sog, icf = sog * 1.8, g = 0.3, iscf = 1.5, toi = 17) => ({ sog, icf, g, iscf, toi });

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
    // TOI blends at n / (n + 5); the last five games this season are the ice-time read.
    const t = blendRates([game(3, 5, 0, 1, 20), game(3, 5, 0, 1, 22)], Array.from({ length: 82 }, () => game(3, 5, 0.3, 1.5, 15)));
    expect(t.toi).toBeCloseTo((2 / 7) * 21 + (5 / 7) * 15, 3);
    expect(t.toiL5).toBe(21);
    expect(blendRates([], Array.from({ length: 82 }, () => game(3, 5, 0.3, 1.5, 15))).toiL5).toBe(15);
    // No base and too few games this season: no rate. Five games this season stand alone.
    expect(blendRates(cur, [])).toBeNull();
    expect(blendRates([...cur, game(2), game(3)], []).sog).toBe(4);
  });
  test('the projection is a multiplicative Poisson rate and the tails follow it', () => {
    const r = blendRates(Array.from({ length: 82 }, () => game(3.4, 6.5, 0.45, 2.3, 19)), Array.from({ length: 82 }, () => game(3.4, 6.5, 0.45, 2.3, 19)));
    const soft = { sog: 1.95, g: 0.26 }; const tough = { sog: 1.45, g: 0.17 };
    const p = project(r, { home: false, oppPos: soft, pos: 'C' });
    expect(p.lamS).toBeGreaterThan(3.1);
    expect(p.lamS).toBeLessThan(3.7);
    expect(p.p3).toBeCloseTo(poissonAtLeast(p.lamS, 3), 2);
    expect(p.p2).toBeGreaterThan(p.p3);
    expect(p.p3).toBeGreaterThan(p.p4);
    // A softer opponent, home ice and more ice time lift the rate; a back-to-back trims it; the top end does not run away.
    expect(project(r, { home: true, oppPos: soft, pos: 'C' }).lamS).toBeGreaterThan(p.lamS);
    expect(project(r, { home: false, oppPos: tough, pos: 'C' }).lamS).toBeLessThan(p.lamS);
    expect(project(r, { home: false, oppPos: tough, pos: 'C' }).p1g).toBeLessThan(p.p1g);
    expect(project(r, { home: false, oppPos: soft, pos: 'C', b2b: true }).lamS).toBeLessThan(p.lamS);
    expect(project(r, { home: false, oppPos: soft, pos: 'C', b2b: true }).lamG).toBeLessThan(p.lamG);
    expect(project({ ...r, toiL5: 22 }, { home: false, oppPos: soft, pos: 'C' }).lamS).toBeGreaterThan(p.lamS);
    // One standard deviation of the position read (~0.25 shots per skater) is worth about 10% of the rate.
    expect(project(r, { home: false, oppPos: { sog: 1.95, g: 0.2 }, pos: 'C' }).lamS / project(r, { home: false, oppPos: { sog: 1.7, g: 0.2 }, pos: 'C' }).lamS).toBeCloseTo(1.1, 1);
    // Without a read for the opponent the league figure for the position stands in.
    expect(project(r, { home: false, pos: 'RW' }).lamS).toBeCloseTo(project(r, { home: false, oppPos: LEAGUE_POS.RW, pos: 'RW' }).lamS, 6);
    const star = blendRates([], Array.from({ length: 80 }, () => game(4.4, 8, 0.66, 3.6, 21)));
    expect(project(star, { home: false, oppPos: LEAGUE_POS.C, pos: 'C' }).lamS).toBeLessThan(4.6);
    expect(project(star, { home: false, oppPos: LEAGUE_POS.C, pos: 'C' }).lamS).toBeGreaterThan(3.8);
    expect(project(star, { home: false, oppPos: LEAGUE_POS.C, pos: 'C' }).p1g).toBeGreaterThan(0.4);
    // A league-average top-six forward lands near the league's figures.
    const avg = blendRates([], Array.from({ length: 82 }, () => game(1.73, 3.1, 0.23, 1.2, 16.3)));
    expect(project(avg, { home: false, oppPos: LEAGUE_POS.C, pos: 'C' }).lamS).toBeCloseTo(1.73, 0);
    expect(project(avg, { home: false, oppPos: LEAGUE_POS.C, pos: 'C' }).lamG).toBeCloseTo(0.23, 0);
  });
  test('with a saved run the row carries the model’s own numbers, the study’s beside them', () => {
    const study = { lamS: 3.08, p3: 0.59, p4: 0.37, p1g: 0.4 };
    const row = fromModel({ sog: 4.1, g: 0.7, p2s: 0.93, p3s: 0.85, p4s: 0.78, p1g: 0.5 }, study);
    expect(row).toMatchObject({ lamS: 4.1, lamG: 0.7, p2: 0.93, p3: 0.85, p4: 0.78, p1g: 0.5, ladder: 'run', study: { p3: 0.59, p4: 0.37, p1g: 0.4 } });
    // The run's matchup goal λ rides along for the shuffle and the scorecard; null when the run lacks it.
    expect(row.lamGOpp).toBeNull();
    expect(fromModel({ sog: 4.1, g: 0.7, gOpp: 0.812 }).lamGOpp).toBe(0.81);
    // The run carries no 2+: it comes off the λ and never sits below the run's 3+.
    const noP2 = fromModel({ sog: 4.1, g: 0.7, p3s: 0.85, p4s: 0.78, p1g: 0.5 });
    expect(noP2).toMatchObject({ p3: 0.85, p4: 0.78, ladder: 'run' });
    expect(noP2.p2).toBeGreaterThanOrEqual(0.85);
    // An inverted pair (4+ above 3+) is read off the λ instead.
    const odd = fromModel({ sog: 0.16, g: 0.1, p3s: 0.2, p4s: 0.25, p1g: 0.1 });
    expect(odd.ladder).toBe('lambda');
    expect(odd.p3).toBeLessThan(0.01);
    expect(odd.p2).toBeGreaterThanOrEqual(odd.p3);
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
  test('what each team allows per skater at a position, this season blended into last season’s, with ranks', () => {
    const row = (opp, pos, sog, g, gameId) => ({ opp, pos, sog, g, gameId });
    // This season: BUF has given C skaters 2.5 shots a game over two games, CAR 1.0 over one.
    const cur = [row('BUF', 'C', 3, 1, 1), row('BUF', 'C', 2, 0, 1), row('BUF', 'C', 3, 0, 2), row('BUF', 'C', 2, 0, 2), row('CAR', 'C', 1, 0, 3), row('CAR', 'C', 1, 0, 3), row('BUF', 'D', 1, 0, 1)];
    // Last season: BUF 1.5 to C over 20 games, CAR 2.0 over 20; TOR only last season.
    const prev = [];
    for (let i = 0; i < 20; i++) { prev.push(row('BUF', 'C', 1.5, 0.2, 100 + i), row('CAR', 'C', 2, 0.3, 200 + i), row('TOR', 'C', 1.7, 0.25, 300 + i)); }
    const a = positionAllowed(cur, prev);
    // BUF C: 2 games → w = 2 / 17: 2.5 * 2/17 + 1.5 * 15/17
    expect(a.read('BUF', 'C').sog).toBeCloseTo(2.5 * (2 / 17) + 1.5 * (15 / 17), 2);
    expect(a.read('BUF', 'C').g).toBeCloseTo(0.25 * (2 / 42) + 0.2 * (40 / 42), 3);
    expect(a.read('BUF', 'C')).toMatchObject({ games: 2, prevGames: 20, curSog: 2.5, prevSog: 1.5 });
    expect(a.read('CAR', 'C').sog).toBeCloseTo(1 * (1 / 16) + 2 * (15 / 16), 2);
    // TOR: last season only; BUF D: this season only (no 10-game base last season).
    expect(a.read('TOR', 'C')).toMatchObject({ games: 0, sog: 1.7, prevSog: 1.7 });
    expect(a.read('BUF', 'D')).toMatchObject({ games: 1, sog: 1, prevSog: null });
    expect(a.read('BUF', 'LW')).toBeNull();
    expect(a.read('NYR', 'C')).toBeNull();
    // Ranks: 1 = allows the most to the position. CAR 1.94 > BUF 1.62 > ... TOR 1.7 sits between.
    expect(a.read('CAR', 'C').rankSog).toBe(1);
    expect(a.read('TOR', 'C').rankSog).toBe(2);
    expect(a.read('BUF', 'C').rankSog).toBe(3);
    expect(a.read('CAR', 'C').rankG).toBe(1);
    expect(a.teamCount).toBe(3);
  });
  test('a team is on a back-to-back when its last stored game was the day before', () => {
    const last = { BUF: '2026-10-14', CAR: '2026-10-13' };
    expect(isBackToBack(last, 'BUF', '2026-10-15')).toBe(true);
    expect(isBackToBack(last, 'CAR', '2026-10-15')).toBe(false);
    expect(isBackToBack(last, 'TOR', '2026-10-15')).toBe(false);
    expect(isBackToBack(last, 'BUF', '2026-11-01')).toBe(false);
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
    // Five over the floor: the top four, the fifth on the next line.
    const five = pickGame([c('A', 0.7, 0.5), c('B', 0.6, 0.5), c('C', 0.55, 0.5), c('D', 0.52, 0.5), c('E', 0.5, 0.5), c('F', 0.2, 0.1)]);
    expect(five.shots.map((x) => x.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(five.shots.every((x) => !x.under)).toBe(true);
    expect(five.nextShots.map((x) => x.name)).toEqual(['E', 'F']);
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

describe('grading the picks on the box score', () => {
  const cands = [{ id: 1, name: 'A', p3: 0.6 }, { id: 2, name: 'B', p3: 0.55 }, { id: 3, name: 'C', p3: 0.5 }];
  test('a stored game puts each skater’s shots and goals on his row; a missing row is DNP (null); before the game nothing is set', () => {
    const graded = withActuals(cands, [{ id: 1, sog: 4, g: 1 }, { id: 2, sog: '2', g: 0 }, { id: 99, sog: 7, g: 0 }]);
    expect(graded[0].actual).toEqual({ sog: 4, g: 1 });
    expect(graded[1].actual).toEqual({ sog: 2, g: 0 });
    expect(graded[2].actual).toBeNull();
    expect(withActuals(cands, undefined)[0].actual).toBeUndefined();
  });
  test('hitOf reads the market floor off the box score', () => {
    const [a, b, c] = withActuals(cands, [{ id: 1, sog: 4, g: 1 }, { id: 2, sog: 2, g: 0 }]);
    expect(hitOf(a, 'sog', 3)).toBe(true);
    expect(hitOf(a, 'sog', 4)).toBe(true);
    expect(hitOf(b, 'sog', 3)).toBe(false);
    expect(hitOf(b, 'sog', 2)).toBe(true);
    expect(hitOf(b, 'g', 1)).toBe(false);
    expect(hitOf(c, 'sog', 3)).toBeNull();
    expect(hitOf(cands[0], 'sog', 3)).toBeNull();
  });
  test('pickGame keeps the grade on the rows it picks', () => {
    const picked = pickGame(withActuals(cands.map((c) => ({ ...c, lamS: 3, p1g: 0.3, lamG: 0.3 })), [{ id: 1, sog: 3, g: 0 }]));
    expect(picked.shots[0]).toMatchObject({ id: 1, actual: { sog: 3, g: 0 } });
    expect(picked.shots[1].actual).toBeNull();
  });
});

describe('picks: blending the model with the study', () => {
  const model = fromModel({ sog: 3.0, g: 0.4, p3s: 0.6, p4s: 0.35, p1g: 0.33 });
  const study = { lamS: 2.0, lamG: 0.2, p3: 0.32, p4: 0.14, p1g: 0.18 };
  test('λ is the weighted mean, the odds its Poisson tails, both sides kept', () => {
    const b = blendProjection(model, study, 0.5);
    expect(b.lamS).toBe(2.5); expect(b.lamG).toBe(0.3); expect(b.blend).toBe(0.5); expect(b.ladder).toBe('blend');
    expect(b.p3).toBeCloseTo(poissonAtLeast(2.5, 3), 2); expect(b.p4).toBeCloseTo(poissonAtLeast(2.5, 4), 2); expect(b.p1g).toBeCloseTo(1 - Math.exp(-0.3), 2);
    expect(b.p2).toBeGreaterThanOrEqual(b.p3); expect(b.p3).toBeGreaterThanOrEqual(b.p4);
    expect(b.model).toMatchObject({ lamS: 3, p3: 0.6 }); expect(b.study).toMatchObject({ lamS: 2, p3: 0.32 });
    expect(blendProjection(model, study, 1).lamS).toBe(2); expect(blendProjection(model, study, 2).lamS).toBe(2);
    expect(blendProjection(fromModel({ sog: 3.0, g: 0.4, gOpp: 0.5 }), study, 0.5).lamGOpp).toBe(0.5);   // the matchup λ rides through the blend untouched
  });
  test('off without a weight, a study read or a model row', () => {
    expect(blendProjection(model, study, 0)).toBe(model);
    expect(blendProjection(model, null, 0.5)).toBe(model);
    expect(blendProjection(null, study, 0.5)).toBeNull();
  });
});

describe('picks: form flags and the soft third', () => {
  const g = (sog, goals) => ({ sog, g: goals, icf: sog + 2, iscf: 1, toi: 18 });
  test('shots: hot at 1.4x his rate over the last five, cold at 0.7x, five games needed', () => {
    const prev = Array.from({ length: 20 }, () => g(2, 0));
    const rates = blendRates([g(3, 0), g(4, 0), g(3, 0), g(3, 0), g(4, 0)], prev);
    const f = formOf([g(3, 0), g(4, 0), g(3, 0), g(3, 0), g(4, 0)], prev, rates);
    expect(f.sogL5).toBe(3.4); expect(f.sogRatio).toBeGreaterThanOrEqual(FORM.hotShots); expect(f.hotS).toBe(true); expect(f.coldS).toBe(false);
    const cold = formOf([g(1, 0), g(0, 0), g(1, 0), g(1, 0), g(0, 0)], prev, blendRates([g(1, 0), g(0, 0), g(1, 0), g(1, 0), g(0, 0)], prev));
    expect(cold.coldS).toBe(true); expect(cold.hotS).toBe(false);
    // the last five run across the season boundary
    const early = formOf([g(5, 0)], prev, blendRates([g(5, 0)], prev));
    expect(early.games).toBe(5); expect(early.sogL5).toBe((2 * 4 + 5) / 5);
    expect(formOf([], [], rates)).toBeNull();
    expect(formOf([g(2, 0)], [], rates).sogRatio).toBeNull();
  });
  test('goals: hot at three in the last five; cold = none in ten when his rate owed him one and a half', () => {
    const prev = Array.from({ length: 20 }, () => g(2, 0.3));
    const hot = formOf([g(2, 1), g(3, 0), g(2, 2), g(1, 0), g(2, 1)], prev, blendRates([g(2, 1), g(3, 0), g(2, 2), g(1, 0), g(2, 1)], prev));
    expect(hot.gL5).toBe(4); expect(hot.hotG).toBe(true); expect(hot.coldG).toBe(false);
    const dry = Array.from({ length: 10 }, () => g(2, 0));
    const cold = formOf(dry, prev, blendRates(dry, prev));
    expect(cold.gL10).toBe(0); expect(cold.coldG).toBe(true); expect(cold.hotG).toBe(false);
    // a 0.07-a-game defenseman is never cold
    const dprev = Array.from({ length: 20 }, () => g(1, 0.07));
    expect(formOf(dry, dprev, blendRates(dry, dprev)).coldG).toBe(false);
  });
  test('the soft third of a ranked table', () => {
    expect(isSoftThird(1, 32)).toBe(true); expect(isSoftThird(11, 32)).toBe(true); expect(isSoftThird(12, 32)).toBe(false);
    expect(isSoftThird(null, 32)).toBe(false); expect(isSoftThird(3, 0)).toBe(false);
  });
});
