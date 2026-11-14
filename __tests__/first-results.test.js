import { describe, expect, test } from '@jest/globals';
import { gradeFirst, summarizeFirst, firstResultsPayload, firstNightUsable, FIRST_RESULTS_VERSION } from '../lib/picks/first-results';

// Vincent, 2026-11-14: "the season track record for all three" (first basket, first goal, first touchdown).
const c = (name, p, hit = false) => ({ name, team: 'AAA', p, hit });
describe('one game graded', () => {
  test('the scorer\'s place on our list, the chance we gave him, our first three', () => {
    const e = gradeFirst({ id: 1, date: '2026-11-01', game: 'AAA @ BBB', candidates: [c('B', 0.1), c('A', 0.2), c('C', 0.05, true), c('D', 0.02)], scorer: { name: 'C', team: 'AAA' } });
    expect(e).toMatchObject({ n: 4, rank: 3, said: 0.05, scorer: { name: 'C', team: 'AAA' } });
    expect(e.top.map((t) => [t.name, t.hit])).toEqual([['A', false], ['B', false], ['C', true]]);
    expect(e.cands).toEqual([[0.2, 0], [0.1, 0], [0.05, 1], [0.02, 0]]);
  });
  test('a scorer who was not on the list; nothing to grade', () => {
    expect(gradeFirst({ id: 2, date: 'd', game: 'g', candidates: [c('A', 0.2), c('B', 0.1)], scorer: { name: 'Z' } })).toMatchObject({ rank: null, said: null, n: 2 });
    expect(gradeFirst({ id: 3, candidates: [], scorer: { name: 'Z' } })).toBeNull();
    expect(gradeFirst({ id: 4, candidates: [c('A', 0.2)], scorer: null })).toBeNull();
  });
});

describe('the record', () => {
  const game = (id, date, hitAt) => gradeFirst({ id, date, game: `g${id}`, candidates: [0.2, 0.15, 0.1, 0.05, 0.05, 0.02].map((p, i) => c(`P${i}`, p, i === hitAt)), scorer: { name: hitAt == null ? 'Z' : `P${hitAt}` } });
  const es = [game(1, '2026-11-01', 0), game(2, '2026-11-01', 2), game(3, '2026-11-02', 5), game(4, '2026-11-03', null)];
  const s = summarizeFirst(es);
  test('the top pick, the top three and five, against what the list said and a pick at random', () => {
    expect(s.games).toBe(4); expect(s.listed).toBe(3);
    expect(s.top1).toEqual({ n: 4, hits: 1, rate: 0.25, said: 0.2, random: 0.167 });
    expect(s.top3).toMatchObject({ hits: 2, rate: 0.5, said: 0.45, random: 0.5 });
    expect(s.top5).toMatchObject({ hits: 2, said: 0.55 });
    expect(s.ranks).toEqual({ 1: 1, 2: 0, 3: 1, '4-5': 0, '6+': 1, off: 1 });
    expect(s.meanRank).toBe(3.3); expect(s.perGame).toBe(6);
    expect([s.first, s.last]).toEqual(['2026-11-01', '2026-11-03']);
  });
  test('every name by the chance we gave him: said against landed', () => {
    const top = s.bands.find((b) => b.lo === 0.2);
    expect(top).toEqual({ lo: 0.2, hi: 1, n: 4, said: 0.2, landed: 0.25 });
    expect(s.bands.reduce((a, b) => a + b.n, 0)).toBe(24);
  });
  test('the payload: the nights added up, the games newest first without their candidate lists', () => {
    const p = firstResultsPayload({ what: 'first basket', season: 2026, nights: [{ date: '2026-11-01', games: es.slice(0, 2) }, { date: '2026-11-02', games: [es[2]] }, { date: '2026-11-03', games: [es[3]] }, { date: '2026-11-04', games: [] }], missing: 2 });
    expect(p).toMatchObject({ what: 'first basket', nights: 3, missing: 2 });
    expect(p.summary.games).toBe(4);
    expect(p.log.map((e) => e.id)).toEqual([4, 3, 1, 2]);
    expect(p.log[0].cands).toBeUndefined();
    expect(summarizeFirst([]).games).toBe(0);
    expect(firstNightUsable({ version: FIRST_RESULTS_VERSION, games: [] })).toBe(true);
    expect(firstNightUsable({ version: 0, games: [] })).toBe(false);
  });
});
