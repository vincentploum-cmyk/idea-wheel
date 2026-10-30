import { describe, expect, test } from '@jest/globals';
import { calibrationOf, fitChecked, playChance, playKey, rungFit, calibrated, appliedOf, sameCalibration, asStated, CHECK_NIGHTS, CHECK_MIN } from '../lib/picks/calibration';
import { calibrate } from '../lib/nhl-data/calibration-pure';
import { buildBoard, shuffleOf } from '../lib/nba/picks';
import { readAt, heightsOf } from '../lib/picks/shuffle';
import { SHUFFLE_MARKETS } from '../lib/nba/markets';

const logit = (p) => Math.log(p / (1 - p));
const sigma = (z) => 1 / (1 + Math.exp(-z));
function rng(seed = 5) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const night = (i) => `2026-10-${String(20 + i).padStart(2, '0')}`;

/** Graded slates (gradeBoard's shape): plays and rungs whose truth is σ(a + b · logit(stated)). */
function slates({ nights = 10, perNight = 400, a = -0.3, b = 0.6, market = 'pts', seed = 5 } = {}) {
  const r = rng(seed);
  return Array.from({ length: nights }, (_, i) => {
    const draw = () => { const p = Math.round((0.1 + 0.85 * r()) * 1000) / 1000; return { p, hit: r() < sigma(a + b * logit(p)) ? 1 : 0 }; };
    return {
      key: night(i), finals: 1,
      plays: Array.from({ length: perNight }, () => ({ market, side: 'over', ...draw() })),
      rungs: Array.from({ length: perNight }, () => ({ market, ...draw() })),
    };
  });
}

describe('the picks calibration: the fit', () => {
  test('an overconfident read is fitted per market and side, checked on the nights it never saw, and applied', () => {
    const cal = calibrationOf(slates());
    expect(cal.nights).toBe(10);
    const f = cal.reads.plays.pts;
    expect(f.b).toBeLessThan(0.8);
    expect(f.check.from).toBe(night(10 - CHECK_NIGHTS));
    expect(f.check.n).toBeGreaterThanOrEqual(CHECK_MIN);
    expect(f.check.calibrated).toBeLessThan(f.check.stated);
    expect(f.use).toBe(true);
    expect(cal.reads.rungs.pts.use).toBe(true);
    // A stated 80% prints near what such calls landed.
    expect(playChance(cal, 'pts', 'over', 0.8)).toBeCloseTo(sigma(-0.3 + 0.6 * logit(0.8)), 1);
    // The under side is its own key, and has no fit here: as stated.
    expect(playKey('pts', 'under')).toBe('pts:under');
    expect(playChance(cal, 'pts', 'under', 0.8)).toBe(0.8);
  });

  test('without nights to check it on, a fit is kept but not applied; a thin market has none', () => {
    const few = calibrationOf(slates({ nights: CHECK_NIGHTS, perNight: 400 }));
    expect(few.reads.plays.pts.check).toBeNull();
    expect(few.reads.plays.pts.use).toBe(false);
    expect(playChance(few, 'pts', 'over', 0.8)).toBe(0.8);
    const thin = calibrationOf(slates({ nights: 10, perNight: 20 }));
    expect(thin.reads.plays.pts).toBeUndefined();
    expect(fitChecked([], [])).toBeNull();
  });

  test('a fit that does worse on the unseen nights stays off the board', () => {
    // Overconfident on the first nights, honest after: the early fit over-corrects the late ones.
    const early = slates({ nights: 7, a: -0.6, b: 0.5, seed: 9 });
    const late = slates({ nights: 3, a: 0, b: 1, seed: 13 }).map((g, i) => ({ ...g, key: night(7 + i) }));
    const cal = calibrationOf([...early, ...late]);
    expect(cal.reads.plays.pts.check.calibrated).toBeGreaterThan(cal.reads.plays.pts.check.stated);
    expect(cal.reads.plays.pts.use).toBe(false);
  });

  test('the fit reads the chance as stated when the record carries it, and says the same calibration twice', () => {
    const g = slates({ nights: 10 });
    const shifted = g.map((s) => ({ ...s, plays: s.plays.map((x) => ({ ...x, p: 0.5, raw: x.p })) }));
    expect(calibrationOf(shifted).reads.plays).toEqual(calibrationOf(g).reads.plays);
    const a = calibrationOf(g); const b = { ...calibrationOf(g), at: 'later' };
    expect(sameCalibration(a, b)).toBe(true);
    expect(sameCalibration(a, calibrationOf(g.slice(1)))).toBe(false);
    expect(appliedOf(a)).toMatchObject({ nights: 10, plays: ['pts'], rungs: ['pts'] });
    expect(asStated(0.734)).toMatch(/73% as the model states it/);
    expect(asStated(null)).toBe('');
  });
});

describe('the picks calibration on the NBA board', () => {
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: false, state: 'pre' }];
  const log = (date, pts, reb) => ({ date, season: 2026, type: 'REG', opp: 'NY', pts, reb, ast: 5, tpm: 3, stl: 1, blk: 0, tov: 2, pra: pts + reb + 5 });
  const logs = [[30, 8], [25, 11], [33, 7], [28, 12], [19, 6], [31, 9], [27, 10], [35, 8]].map(([p, r], i) => log(`2026-10-${String(20 - i).padStart(2, '0')}`, p, r));
  const pf = { at: '2026-10-21T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'reb', line: 8.5, odds: -110, underOdds: -110 }, { market: 'pts', line: 27.5, odds: -110, underOdds: -110 }] }], defense: null } };
  const fit = { a: -0.4, b: 0.6, n: 2000, hits: 900, check: { from: '2026-10-18', n: 500, stated: 0.25, calibrated: 0.24 }, use: true };
  const cal = { at: '2026-10-21T10:00:00Z', from: '2026-10-08', to: '2026-10-20', nights: 12, plays: 4000, rungs: 30000, reads: { plays: { reb: fit, 'reb:under': { ...fit, use: false } }, rungs: { pts: fit } } };

  test('a play prints calibrated with the stated chance beside it, the edge on the printed one', () => {
    const plain = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {}, calibration: cal });
    const before = plain.games[0].sides.BOS.players[0].plays.find((x) => x.market === 'reb' && x.side === 'over');
    const play = b.games[0].sides.BOS.players[0].plays.find((x) => x.market === 'reb' && x.side === 'over');
    expect(play.raw).toBe(before.p);
    expect(play.p).toBeCloseTo(calibrate(fit, before.p), 3);
    expect(play.edge).toBeCloseTo(play.p - (before.p - before.edge), 2);
    // A key whose check failed prints as stated; the board without a calibration carries no raw.
    const under = b.games[0].sides.BOS.players[0].plays.find((x) => x.market === 'reb' && x.side === 'under');
    if (under) expect(under.raw).toBeNull();
    expect(before.raw).toBeNull();
    expect(b.calibration).toMatchObject({ nights: 12, plays: ['reb'], rungs: ['pts'] });
    expect(plain.calibration).toBeNull();
  });

  test('the ladder, the range and the shuffle print the board’s read calibrated; a window reads as stated', () => {
    const plain = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {}, calibration: cal });
    const was = plain.games[0].sides.BOS.players[0].ladders.pts;
    const lad = b.games[0].sides.BOS.players[0].ladders.pts;
    lad.forEach((r, i) => { expect(r.raw).toBe(was[i].p); expect(r.p).toBeCloseTo(calibrate(fit, was[i].p), 3); });
    for (let i = 1; i < lad.length; i++) expect(lad[i].p).toBeLessThanOrEqual(lad[i - 1].p);
    expect(b.games[0].sides.BOS.players[0].ranges.pts).toMatchObject({ p: lad.find((r) => r.main).p, raw: lad.find((r) => r.main).raw });
    expect(b.games[0].sides.BOS.players[0].ladders.reb.every((r) => r.raw == null)).toBe(true);   // no rung fit for rebounds
    const sh = shuffleOf({ market: 'pts', board: b, pf, season: 2026 });
    expect(sh.calibrated).toMatchObject({ a: -0.4, b: 0.6 });
    const heights = heightsOf(SHUFFLE_MARKETS.find((m) => m.market === 'pts'));
    const row = sh.players[0];
    const h = heights.find((x, i) => row.at[i]);
    const read = readAt(row, heights, h, 'blend');
    expect(read.raw).not.toBeNull();
    expect(read.p).toBeCloseTo(calibrated(rungFit(cal, 'pts'), read.raw), 3);
    expect(readAt(row, heights, h, 'l10').raw).toBeNull();
    expect(shuffleOf({ market: 'pts', board: plain, pf, season: 2026 }).calibrated).toBeNull();
  });
});
