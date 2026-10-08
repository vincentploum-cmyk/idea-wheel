import { describe, expect, test } from '@jest/globals';
import {
  BUCKETS, PREDICTORS, boardPicks, compactRow, defaultFrom, exportRows, gradeRow, indexRun, marketReport,
  ownWindows, predictorReport, predictorValue, runForGame, seasonOf, slateReport, summarize,
} from '../lib/nhl-data/scorecard';
import { modelKey } from '../lib/nhl-data/model-runs';
import { bestBetLabel, poissonAtLeast } from '../components/nhl/model-core';

const row = (over = {}) => ({
  name: 'Evan Bouchard', team: 'Oilers', pos: 'D', todayLine: 1, gateOpen: true, signalScore: 61, attackScore: 70,
  lambdaS: 3.1, lambdaG: 0.22, lambdaP: 0.9, p3s: 0.6, p4s: 0.4, p5s: 0.2, p1g: 0.2, p2g: 0.03, p1p: 0.55, p2p: 0.15,
  shotsL5: 3.4, goalsL5: 0.2, shotsSeason: 2.9, goalsSeason: 0.18, ...over,
});

describe('scorecard: which run grades a game', () => {
  const runs = [
    { id: 'a', createdAt: '2026-10-08T14:00:00Z' },
    { id: 'b', createdAt: '2026-10-08T22:30:00Z' },
    { id: 'c', createdAt: '2026-10-09T13:00:00Z' }, // the morning after
  ];
  test('the newest run saved before puck drop', () => {
    expect(runForGame(runs, '2026-10-08T23:00:00Z', '2026-10-08').id).toBe('b');
    expect(runForGame(runs, '2026-10-08T21:00:00Z', '2026-10-08').id).toBe('a');
    expect(runForGame(runs, '2026-10-08T13:00:00Z', '2026-10-08')).toBeNull();
  });
  test('without a start time, runs up to 1 am ET the next day count and the morning-after run does not', () => {
    expect(runForGame(runs, null, '2026-10-08').id).toBe('b');
    expect(runForGame([runs[2]], null, '2026-10-08')).toBeNull();
    expect(runForGame([{ id: 'd', createdAt: 'nope' }], null, '2026-10-08')).toBeNull();
  });
});

describe('scorecard: rows', () => {
  test('a run row is compacted with the best bet, PropFinder rates and the team abbreviation', () => {
    const c = compactRow(row());
    expect(c).toMatchObject({ team: 'EDM', pos: 'D', line: 1, gate: true, lambdaS: 3.1, p3s: 0.6, pf5: { sog: 3.4, g: 0.2 }, pfSeason: { sog: 2.9, g: 0.18 } });
    expect(c.best).toEqual({ market: 's3', label: '3+ shots', prob: 0.6 });
    expect(bestBetLabel(row()).key).toBe('shots3');
    // 0 means "not in the file", never a rate of zero.
    expect(compactRow(row({ shotsL5: 0, shotsSeason: undefined })).pf5.sog).toBeNull();
    expect(compactRow(row({ shotsSeason: undefined })).pfSeason.sog).toBeNull();
    expect(compactRow({ team: 'EDM' })).toBeNull();
  });
  test('a run is indexed by model key', () => {
    const idx = indexRun([row(), row({ name: 'Connor McDavid', pos: 'C' }), null]);
    expect(idx.size).toBe(2);
    expect(idx.get(modelKey('EDM', 'Evan Bouchard')).pos).toBe('D');
  });
  test('own windows need the full window, the season window three games this season', () => {
    const hist = [];
    for (let i = 1; i <= 12; i += 1) hist.push({ date: `2026-04-${String(i).padStart(2, '0')}`, sog: i % 4, g: i % 2 });
    hist.push({ date: '2026-10-08', sog: 5, g: 1 }, { date: '2026-10-10', sog: 1, g: 0 }, { date: '2026-10-12', sog: 3, g: 0 });
    const w = ownWindows(hist, '2026-10-11');
    expect(w.own5.n).toBe(5);
    expect(w.own5.sog).toBeCloseTo((2 + 3 + 0 + 5 + 1) / 5); // Apr 10–12, then the two October games
    expect(w.own10.n).toBe(10);
    expect(w.own15).toBeNull();
    expect(w.ownSeason).toBeNull(); // two games this season before the 11th
    expect(ownWindows(hist, '2026-10-13').ownSeason).toEqual({ sog: 3, g: 1 / 3, n: 3 });
    expect(ownWindows(hist, '2026-10-13').own15.n).toBe(15);
    expect(ownWindows(undefined, '2026-10-13')).toEqual({ own5: null, own10: null, own15: null, ownSeason: null });
    // games on or after the date never count
    expect(ownWindows(hist, '2026-10-08').own5.sog).toBe((0 + 1 + 2 + 3 + 0) / 5);
  });
  test('seasons run July to June', () => {
    expect(seasonOf('2026-10-05')).toBe('20262027');
    expect(seasonOf('2027-04-05')).toBe('20262027');
    expect(defaultFrom('2027-02-01')).toBe('2026-09-01');
  });
});

/** A small graded sample: two slates, four player-games. */
function sample() {
  const own = { own5: { sog: 3, g: 0.2, n: 5 }, own10: { sog: 2.8, g: 0.3, n: 10 }, own15: { sog: 2.5, g: 0.2, n: 15 }, ownSeason: { sog: 2.6, g: 0.25, n: 4 } };
  const mk = (date, gameId, m, s, o = own) => gradeRow({ date, gameId, m: compactRow(row(m)), s: { id: 1, name: m.name || 'Evan Bouchard', team: 'EDM', opp: 'CGY', venue: 'H', pos: m.pos || 'D', line: m.todayLine ?? 1, toi: 22, ...s }, own: o });
  return [
    mk('2026-10-08', 1, { p3s: 0.7, p4s: 0.5, gateOpen: true }, { sog: 4, g: 1, a: 0 }),
    mk('2026-10-08', 1, { name: 'Connor McDavid', pos: 'C', p3s: 0.5, p4s: 0.3, p1g: 0.45, gateOpen: true, attackScore: 90 }, { sog: 2, g: 0, a: 2 }),
    mk('2026-10-09', 2, { p3s: 0.3, p4s: 0.1, gateOpen: false }, { sog: 3, g: 0, a: 0 }, { own5: null, own10: null, own15: null, ownSeason: null }),
    mk('2026-10-09', 2, { name: 'Zach Hyman', pos: 'LW', todayLine: 2, p3s: 0.9, p4s: 0.7, p1g: 0.35, shotsL5: 0, gateOpen: true }, { sog: 1, g: 0, a: 0 }),
  ];
}

describe('scorecard: the report', () => {
  test('a market: calls, said, hit, Brier, buckets, gate, position, slot, best bets', () => {
    const m = marketReport(sample(), 's3');
    expect(m.n).toBe(4);
    expect(m.hit).toBe(0.5); // 4 and 3 reached, 2 and 1 did not
    expect(m.avg).toBeCloseTo((0.7 + 0.5 + 0.3 + 0.9) / 4);
    expect(m.brier).toBeCloseTo(((0.3) ** 2 + 0.5 ** 2 + 0.7 ** 2 + 0.9 ** 2) / 4, 4);
    expect(m.buckets.find((b) => b.key === 'b70')).toMatchObject({ n: 1, hit: 1 });
    expect(m.buckets.find((b) => b.key === 'b80')).toMatchObject({ n: 1, hit: 0 });
    expect(m.gate.open.n).toBe(3);
    expect(m.gate.closed).toMatchObject({ n: 1, hit: 1 });
    expect(m.byPos.D).toMatchObject({ n: 2, hit: 1 });
    expect(m.bySlot.LW2).toMatchObject({ n: 1, hit: 0 });
    expect(m.best.n).toBeGreaterThan(0);
    expect(BUCKETS[BUCKETS.length - 1].hi).toBeGreaterThan(1);
  });
  test('the boards are replayed per slate', () => {
    const p = boardPicks(sample());
    // Shots board: gate open and (4+ ≥ 40% or 3+ ≥ 60%): Bouchard on the 8th, Hyman on the 9th.
    expect(p.shots.n).toBe(2);
    expect(p.shots.s3).toMatchObject({ n: 2, hit: 0.5 });
    expect(p.shots.s4).toMatchObject({ n: 2, hit: 0.5 });
    // Goals board: 1+ G ≥ 18%: everyone but the 0.2 default rows... all four rows have p1g ≥ 0.18.
    expect(p.goals.n).toBe(4);
    expect(p.goals.g1).toMatchObject({ n: 4, hit: 0.25 });
  });
  test('the predictors score on their own rows and on the rows all of them cover', () => {
    const r = predictorReport(sample(), 'sog');
    const each = Object.fromEntries(r.each.map((p) => [p.key, p]));
    expect(each.model.n).toBe(4);
    expect(each.model.mae).toBeCloseTo((Math.abs(3.1 - 4) + Math.abs(3.1 - 2) + Math.abs(3.1 - 3) + Math.abs(3.1 - 1)) / 4);
    expect(each.own5.n).toBe(3);
    expect(each.pf5.n).toBe(3); // Hyman's 0 is "not in the file"
    expect(each.pfSeason.n).toBe(4);
    expect(r.common.n).toBe(2);
    const common = Object.fromEntries(r.common.predictors.map((p) => [p.key, p]));
    expect(common.own5).toMatchObject({ n: 2, avg: 3, actual: 3, bias: 0 });
    expect(common.model.prob).toBeCloseTo(poissonAtLeast(3.1, 3), 2);
    expect(common.model.hit).toBe(0.5);
    expect(PREDICTORS.map((p) => p.key)).toEqual(['model', 'own5', 'own10', 'own15', 'ownSeason', 'pf5', 'pfSeason']);
    expect(predictorValue(sample()[0], 'pfSeason', 'g')).toBe(0.18);
    expect(predictorReport([], 'g').common.predictors[0]).toMatchObject({ n: 0, mae: null });
    // A predictor nobody has yet (own season in October) does not empty the common set.
    const early = sample().map((r) => ({ ...r, own: r.own && { ...r.own, ownSeason: null } }));
    const e = predictorReport(early, 'sog');
    expect(e.common.n).toBe(2);
    expect(e.common.covered).toEqual(['model', 'own5', 'own10', 'own15', 'pf5', 'pfSeason']);
    expect(e.common.predictors.find((p) => p.key === 'ownSeason').n).toBe(0);
  });
  test('per slate and the whole report', () => {
    const meta = { '2026-10-08': { games: 3, missing: 2, runs: ['a'] }, '2026-10-09': { games: 1, missing: 0, runs: ['b'] }, '2026-10-10': { games: 2, missing: 0, runs: [] } };
    const slates = slateReport(sample(), meta);
    expect(slates.map((s) => s.date)).toEqual(['2026-10-10', '2026-10-09', '2026-10-08']);
    expect(slates[2]).toMatchObject({ games: 3, graded: 1, players: 2, missing: 2, runs: ['a'] });
    expect(slates[2].s3).toMatchObject({ n: 2, hit: 0.5 });
    expect(slates[0]).toMatchObject({ games: 2, graded: 0, players: 0 });
    const card = summarize(sample(), meta, { from: '2026-09-01', to: '2026-10-10' });
    expect(card).toMatchObject({ slates: 2, games: 2, players: 4, missing: 2, from: '2026-09-01' });
    expect(card.markets).toHaveLength(7);
    expect(card.predictors.g.stat).toBe('g');
    expect(exportRows(sample())[0]).toMatchObject({ date: '2026-10-08', name: 'Evan Bouchard', sog: 4, pts: 1, lambdaS: 3.1, own5: 3, pf5: 3.4, best: '3+ shots' });
  });
});
