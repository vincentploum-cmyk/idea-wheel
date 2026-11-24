import { describe, expect, test } from '@jest/globals';
import { calibrationOf, fitAnchor, anchored, playChance, rungAnchor, appliedOf, CHECK_NIGHTS, CHECK_MIN } from '../lib/picks/calibration';
import { impliedProb } from '../lib/nfl/odds';

// The book anchor (docs/audits/2026-11-20-why-picks-miss.md): where a chance carries a price, the printed chance reads
// the price and the stated chance together, so a read that adds nothing to the price stops calling plays.
const logit = (p) => Math.log(p / (1 - p));
const sigma = (z) => 1 / (1 + Math.exp(-z));
function rng(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const night = (i) => `2026-11-${String(1 + i).padStart(2, '0')}`;
const oddsOf = (q) => Math.round(q >= 0.5 ? (-100 * q) / (1 - q) : (100 * (1 - q)) / q);

/** Priced graded slates: truth = σ(a + logit(implied) + wModel · (logit(stated) − logit(implied))). */
function slates({ nights = 10, perNight = 400, a = -0.3, wModel = 0, market = 'reb', seed = 7 } = {}) {
  const r = rng(seed);
  return Array.from({ length: nights }, (_, i) => {
    const draw = () => {
      const implied = Math.round((0.35 + 0.35 * r()) * 1000) / 1000;
      const p = Math.round(Math.min(0.95, Math.max(0.05, implied + (r() - 0.3) * 0.4)) * 1000) / 1000;   // a read that leans over
      const truth = sigma(a + logit(implied) + wModel * (logit(p) - logit(implied)));
      return { p, implied, odds: oddsOf(implied), hit: r() < truth ? 1 : 0 };
    };
    return {
      key: night(i),
      plays: Array.from({ length: perNight }, () => { const d = draw(); return { market, side: 'over', p: d.p, implied: d.implied, odds: d.odds, hit: d.hit }; }),
      rungs: Array.from({ length: perNight }, () => { const d = draw(); return { market, p: d.p, odds: d.odds, hit: d.hit }; }),
    };
  });
}

describe('the book anchor', () => {
  test('a read that adds nothing to the price is learned as the price less its margin, checked on unseen nights, and applied', () => {
    const cal = calibrationOf(slates());
    const f = cal.reads.anchor.plays.reb;
    expect(f.wBook).toBe(1);
    expect(f.wModel).toBeLessThan(0.1);
    expect(f.a).toBeLessThan(-0.15);
    expect(f.check.from).toBe(night(10 - CHECK_NIGHTS));
    expect(f.check.n).toBeGreaterThanOrEqual(CHECK_MIN);
    expect(f.check.anchored).toBeLessThan(f.check.stated);
    expect(f.use).toBe(true);
    expect(rungAnchor(cal, 'reb')).toBeTruthy();
    // A stated 75% against a -122 price (55%) prints near the price less the margin: no edge, no best bet.
    const p = playChance(cal, 'reb', 'over', 0.75, 0.55);
    expect(p).toBeLessThan(0.55);
    expect(p).toBeCloseTo(sigma(-0.3 + logit(0.55)), 1);
    expect(appliedOf(cal).anchored.plays).toEqual(['reb']);
  });

  test('a read that does carry news keeps its weight off the price', () => {
    const f = fitAnchor(slates({ wModel: 0.6, a: 0 }).flatMap((s) => s.plays.map((x) => [x.p, x.implied, x.hit])));
    expect(f.wModel).toBeGreaterThan(0.4);
    expect(f.wModel).toBeLessThan(0.8);
  });

  test('a read pointing the wrong way is held at zero: the board never bets against its own read', () => {
    const f = fitAnchor(slates({ wModel: -0.5 }).flatMap((s) => s.plays.map((x) => [x.p, x.implied, x.hit])));
    expect(f.wModel).toBe(0);
  });

  test('without a price, or off, the play falls back to its stated-only calibration; thin markets have no anchor', () => {
    const cal = calibrationOf(slates());
    expect(playChance(cal, 'reb', 'over', 0.75, null)).toBe(playChance(cal, 'reb', 'over', 0.75));
    expect(anchored({ ...cal.reads.anchor.plays.reb, use: false }, 0.75, 0.55)).toBeNull();
    expect(fitAnchor([[0.6, 0.55, 1], [0.6, 0.55, 0]])).toBeNull();
    // A price past -400 teaches nothing (board.js STEEP_IMPLIED).
    const steep = slates({ nights: 4, perNight: 100 }).map((s) => ({ ...s, plays: s.plays.map((x) => ({ ...x, implied: 0.85 })) }));
    expect(calibrationOf(steep).reads.anchor.plays.reb).toBeUndefined();
  });

  test('rungs learn from their own prices', () => {
    const cal = calibrationOf(slates());
    expect(cal.reads.anchor.rungs.reb.n).toBeGreaterThanOrEqual(300);
    expect(impliedProb(oddsOf(0.6))).toBeCloseTo(0.6, 2);
  });
});

describe('the book anchor on the NBA board', () => {
  const { buildBoard } = require('../lib/nba/picks');
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  const log = (date, pts, reb) => ({ date, season: 2026, type: 'REG', opp: 'NY', pts, reb, ast: 5, tpm: 3, stl: 1, blk: 0, tov: 2, pra: pts + reb + 5 });
  const logs = [[30, 8], [25, 11], [33, 9], [28, 12], [19, 10], [31, 9], [27, 10], [35, 11]].map(([p, r], i) => log(`2026-10-${String(20 - i).padStart(2, '0')}`, p, r));
  const pf = { at: '2026-10-21T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110 }, { market: 'pts', line: 27.5, odds: -110, underOdds: -110 }] }], defense: null } };
  const anchor = { a: -0.2, wBook: 1, wModel: 0, n: 3000, hits: 1400, check: { from: '2026-10-18', n: 500, stated: 0.26, anchored: 0.24 }, use: true };
  const stated = { a: -0.4, b: 0.6, n: 2000, hits: 900, check: { from: '2026-10-18', n: 500, stated: 0.25, calibrated: 0.24 }, use: true };
  const cal = { at: '2026-10-21T10:00:00Z', from: '2026-10-08', to: '2026-10-20', nights: 12, plays: 4000, rungs: 30000, reads: { plays: { reb: stated }, rungs: { reb: stated }, anchor: { plays: { reb: anchor }, rungs: { reb: anchor } } } };

  test('a priced play and its priced rung print the anchored chance: the price less its margin, no edge, no best bet', () => {
    const plain = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {}, calibration: cal });
    const find = (bd) => bd.games[0].sides.BOS.players[0].plays.find((x) => x.market === 'reb' && x.side === 'over' && x.line === 8.5);
    const before = find(plain); const play = find(b);
    expect(before.p).toBeGreaterThan(0.6);
    expect(play.raw).toBe(before.p);
    expect(play.p).toBeCloseTo(sigma(-0.2 + logit(impliedProb(-110))), 2);
    expect(play.edge).toBeLessThan(0);
    expect(b.best.filter((x) => x.market === 'reb')).toEqual([]);
    const rung = b.games[0].sides.BOS.players[0].ladders.reb.find((r) => r.line === 8.5);
    expect(rung.anchored).toBe(true);
    expect(rung.p).toBeCloseTo(sigma(-0.2 + logit(impliedProb(-110))), 2);
    expect(rung.evUnder).toBeNull();   // no under read on an anchored rung
    expect(b.calibration.anchored).toEqual({ plays: ['reb'], rungs: ['reb'] });
  });
});
