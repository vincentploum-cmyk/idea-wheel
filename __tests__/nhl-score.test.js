import { describe, expect, test } from '@jest/globals';
import { SCORE, winProbability, sumSkaters, teamGoals, gameScore, gradeScores } from '../lib/nhl-data/score';
import { LEAGUE_POS } from '../lib/nhl-data/picks-pure';

const b = SCORE.blend;
const expected = ({ sum, own, opp, home, st = null }) => Math.exp(b.const + b.study * Math.log(sum) + b.ownGf * Math.log(own) + b.oppGa * Math.log(opp) + b.home * (home ? 1 : 0)
  + b.oppGives * Math.log(st?.ppFor?.oppGives?.ratio ?? 1) + b.oppDraws * Math.log(st?.ppAgainst?.oppDraws?.ratio ?? 1) + b.oppKillLeak * Math.log(st?.kill?.leak ?? 1));

describe('the predicted score', () => {
  test('winProbability: a Poisson race with the tie split; symmetric; clamped', () => {
    expect(winProbability(3, 3)).toBeCloseTo(0.5, 5);
    expect(winProbability(3.5, 2.5)).toBeGreaterThan(0.6);
    expect(winProbability(3.5, 2.5) + winProbability(2.5, 3.5)).toBeCloseTo(1, 6);
    expect(winProbability(9, 0.5)).toBe(0.99);
    expect(winProbability(0, 2)).toBeNull();
  });
  test('sumSkaters: the dressed skaters’ λ goals added, a skater without a read at the league’s figure for his position', () => {
    const s = sumSkaters([{ pos: 'C', lamG: 0.4 }, { pos: 'D', lamG: 0.1 }, { pos: 'LW', lamG: null }, { pos: 'D' }]);
    expect(s).toEqual({ sum: +(0.5 + LEAGUE_POS.LW.g + LEAGUE_POS.D.g).toFixed(3), n: 4, read: 2, filled: 2 });
    expect(sumSkaters([])).toEqual({ sum: 0, n: 0, read: 0, filled: 0 });
  });
  test('teamGoals: the blend of the skaters’ sum, the team reads shrunk toward the league, home ice and the special teams', () => {
    const side = { team: 'MTL', opp: { team: 'DAL', ga: 2.5, gp: 12 }, own: { gf: 3.15, gp: 13 }, league: 3.1, home: false, skaters: { sum: 3.3, n: 18, read: 18, filled: 0 } };
    const t = teamGoals(side);
    const w13 = 13 / (13 + SCORE.K); const w12 = 12 / (12 + SCORE.K);
    const own = w13 * (3.15 / 3.1) + (1 - w13); const opp = w12 * (2.5 / 3.1) + (1 - w12);
    expect(t.exp).toBeCloseTo(expected({ sum: 3.3, own, opp, home: false }), 2);
    expect(t.parts.own.ratio).toBeCloseTo(own, 3); expect(t.parts.opp.ratio).toBeCloseTo(opp, 3);
    expect(t.parts.skaters).toEqual({ sum: 3.3, n: 18, read: 18, filled: 0 });
    expect(t.text).toContain('MTL: ');
    // Home ice and a team without reads: the league stands in for the missing parts (ratio 1).
    const bare = teamGoals({ team: 'X', home: true, skaters: { sum: 2.8 } });
    expect(bare.exp).toBeCloseTo(expected({ sum: 2.8, own: 1, opp: 1, home: true }), 2);
    expect(bare.parts.own.ratio).toBe(1); expect(bare.parts.league).toBe(SCORE.leagueGoals);
    // The special teams enter through the opponent's given / drawn ratios and its kill leak.
    const st = { factor: { shots: 1.02, goals: 1.04 }, ppFor: { oppGives: { ratio: 1.2 } }, ppAgainst: { oppDraws: { ratio: 0.9 } }, kill: { leak: 1.1 } };
    expect(teamGoals({ ...side, st }).exp).toBeCloseTo(expected({ sum: 3.3, own, opp, home: false, st }), 2);
    expect(teamGoals({ ...side, st }).parts.st).toEqual({ shots: 1.02, goals: 1.04, oppGives: 1.2, oppDraws: 0.9, killLeak: 1.1 });
  });
  test('gameScore: both sides, the total, the win chances with fair prices, the hover; the final graded once stored', () => {
    const sides = {
      MTL: { team: 'MTL', opp: { team: 'DAL', ga: 2.5, gp: 12 }, own: { gf: 3.15, gp: 13 }, league: 3.1, skaters: { sum: 3.3, n: 18, read: 18, filled: 0 } },
      DAL: { team: 'DAL', opp: { team: 'MTL', ga: 2.92, gp: 13 }, own: { gf: 3.08, gp: 12 }, league: 3.1, skaters: { sum: 3.0, n: 18, read: 17, filled: 1 } },
    };
    const g = gameScore({ away: 'MTL', home: 'DAL', sides, moneypuck: { away: 3.1, home: 2.9, total: 6.0 } });
    expect(g.away).toBe('MTL'); expect(g.home).toBe('DAL');
    expect(g.exp.MTL).toBeCloseTo(teamGoals({ ...sides.MTL, home: false }).exp, 2);
    expect(g.exp.DAL).toBeCloseTo(teamGoals({ ...sides.DAL, home: true }).exp, 2);
    expect(g.total).toBeCloseTo(g.exp.MTL + g.exp.DAL, 1);
    expect(g.win.MTL + g.win.DAL).toBeCloseTo(1, 3);
    expect(g.win.DAL).toBeCloseTo(winProbability(g.exp.DAL, g.exp.MTL), 3);
    expect(g.fair.DAL).toMatch(/^[+-]\d+$/);
    expect(g.headline).toBe(`MTL ${g.exp.MTL.toFixed(1)} – ${g.exp.DAL.toFixed(1)} DAL`);
    expect(g.title).toContain('Projected score MTL'); expect(g.title).toContain("MoneyPuck's expected goals read MTL 3.1 – 2.9 DAL (6.0), a comparison only.");
    expect(g.totals[6]).toBeGreaterThan(g.totals[7]);
    expect(g.final).toBeNull();
    // Final 2–4: the errors per side and on the total, the winner and whether the better chance called it.
    const f = gameScore({ away: 'MTL', home: 'DAL', sides, final: { away: 2, home: 4 } });
    expect(f.final.score).toEqual({ MTL: 2, DAL: 4 }); expect(f.final.total).toBe(6);
    expect(f.final.err.MTL).toBeCloseTo(f.exp.MTL - 2, 2); expect(f.final.err.total).toBeCloseTo(f.total - 6, 1);
    expect(f.final.winner).toBe('DAL'); expect(f.final.picked).toBe(f.win.DAL >= 0.5 ? 'DAL' : 'MTL'); expect(f.final.called).toBe(f.final.picked === 'DAL');
    expect(gameScore({ away: 'MTL', home: 'DAL', sides: { MTL: sides.MTL } })).toBeNull();
    expect(gameScore(null)).toBeNull();
  });
  test('gradeScores: bias and miss per team, the total, the winner called and the Brier of the home chance', () => {
    const pairs = [
      { away: 'A', home: 'B', exp: { A: 2.5, B: 3.5 }, final: { away: 2, home: 4 } },
      { away: 'C', home: 'D', exp: { C: 3.1, D: 2.9 }, final: { away: 5, home: 1 } },
      { away: 'E', home: 'F', exp: { E: 2.8, F: 3.2 }, final: { away: 3, home: 3 } },
      { away: 'G', home: 'H', exp: null, final: { away: 1, home: 1 } },
    ];
    const g = gradeScores(pairs);
    expect(g.n).toBe(3);
    expect(g.team.n).toBe(6);
    expect(g.team.bias).toBeCloseTo((0.5 - 0.5 - 1.9 + 1.9 - 0.2 + 0.2) / 6, 3);
    expect(g.team.mae).toBeCloseTo((0.5 + 0.5 + 1.9 + 1.9 + 0.2 + 0.2) / 6, 3);
    expect(g.total).toMatchObject({ projected: 6, actual: 6, bias: 0 });
    expect(g.total.mae).toBeCloseTo((0 + 0 + 0) / 3, 3);
    // B called (home favoured, won); D: the away side favoured and it won, called; F favoured at home, the stored 3–3 (a shootout the home side lost) reads as the away side's: not called.
    expect(g.winner.n).toBe(3);
    expect(g.winner.called).toBeCloseTo(2 / 3, 3);
    expect(g.winner.brier).toBeGreaterThan(0); expect(g.winner.brier).toBeLessThan(0.3);
    expect(g.winner.homeWon).toBeCloseTo(1 / 3, 3);
    expect(gradeScores([])).toEqual({ n: 0 });
  });
});
