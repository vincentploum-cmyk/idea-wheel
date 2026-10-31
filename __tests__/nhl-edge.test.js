import { describe, expect, test } from '@jest/globals';
import { EDGE_BUCKETS, RELIABLE, markOf, decimalOf, flatReturn, chanceAtHeight, bookRead, bookRecord, edgeReport, reliableOf } from '../lib/nhl-data/edge-pure';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';
import { calibratedChance } from '../lib/nhl-data/calibration-pure';
import { summarize, gradeRow, exportRows } from '../lib/nhl-data/scorecard';

const prop = { sog: { line: 2.5, odds: -140, underOdds: 110, book: 'DraftKings', books: 2, lines: [{ line: 2.5, odds: -140 }, { line: 3.5, odds: 115 }] }, goal: { line: 0.5, odds: 120, book: 'FanDuel', books: 1 } };
const proj = { lamS: 3.4, lamG: 0.36, p2: 0.83, p3: 0.62, p4: 0.36, p1g: 0.3 };

describe('the edge over the book', () => {
  test('the mark a line asks for, the decimal price and a flat stake’s return', () => {
    expect(markOf(2.5)).toBe(3); expect(markOf(0.5)).toBe(1); expect(markOf(null)).toBeNull();
    expect(decimalOf(-140)).toBeCloseTo(1.714, 3); expect(decimalOf(120)).toBe(2.2); expect(decimalOf(null)).toBeNull();
    expect(flatReturn(120, 1)).toBeCloseTo(1.2, 6); expect(flatReturn(-140, 0)).toBe(-1); expect(flatReturn(null, 1)).toBeNull();
  });
  test('the chance at a height: the board’s own rung, else the λ through the fits, never above the rung below', () => {
    expect(chanceAtHeight(proj, 'sog', 3)).toBe(0.62);
    expect(chanceAtHeight(proj, 'sog', 5)).toBe(Math.round(Math.min(poissonAtLeast(3.4, 5), 0.36) * 1000) / 1000);
    const fits = { 4: { a: -0.7, b: 0.5 }, 5: { a: -1, b: 0.5 } };
    expect(chanceAtHeight(proj, 'sog', 5, fits)).toBe(Math.round(Math.min(calibratedChance({ sog: fits }, 'sog', 3.4, 5), 0.36) * 1000) / 1000);
    expect(chanceAtHeight(proj, 'g', 1)).toBe(0.3);
    expect(chanceAtHeight(proj, 'g', 2)).toBeLessThan(0.3);
    expect(chanceAtHeight({ lamS: 0 }, 'sog', 3)).toBeNull();
  });
  test('bookRead: the board’s chance at the book’s shots mark and for a goal against the prices', () => {
    const b = bookRead(proj, prop);
    expect(b.sog).toMatchObject({ line: 2.5, mark: 3, odds: -140, underOdds: 110, implied: 0.583, p: 0.62, edge: 0.037, book: 'DraftKings', books: 2 });
    expect(b.sog.lines).toHaveLength(2);
    expect(b.goal).toMatchObject({ odds: 120, implied: 0.455, p: 0.3, edge: -0.155, book: 'FanDuel' });
    expect(bookRead(proj, { sog: null, goal: prop.goal }).sog).toBeNull();
    expect(bookRead(proj, null)).toBeNull();
    expect(bookRead(proj, { sog: { line: 2.5, odds: null }, goal: null })).toBeNull();
  });
  test('bookRecord: the scorecard’s read on a graded row — the λ at the board’s weights through the calibration, the run’s figure beside it', () => {
    const row = { lamS: 3.4, lamG: 0.9, studyS: 3.0, studyG: 0.36, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61 };
    const cal = { reads: { board: { sog: { 3: { a: -0.28, b: 0.55 } }, g: { 1: { a: -0.1, b: 0.9 } } } } };
    const rec = bookRecord(row, prop, cal, { w: 0, wG: 1 });
    expect(rec.sog).toMatchObject({ mark: 3, odds: -140, implied: 0.583, raw: 0.66 });
    expect(rec.sog.p).toBeCloseTo(calibratedChance(cal.reads.board, 'sog', 3.4, 3), 3);
    expect(rec.sog.lines).toBeUndefined();
    expect(rec.goal.p).toBeCloseTo(calibratedChance(cal.reads.board, 'g', 0.36, 1), 3);   // the study's goal λ
    expect(rec.goal.raw).toBe(0.61);
    // Half the study in the shots: the λ moves.
    expect(bookRecord(row, prop, cal, { w: 0.5, wG: 1 }).sog.p).toBeCloseTo(calibratedChance(cal.reads.board, 'sog', 3.2, 3), 3);
    expect(bookRecord(row, null, cal)).toBeNull();
  });
  test('edgeReport: every priced play graded against the book, by edge, by the book’s ask and up the chance, with the reliable step', () => {
    // 60 shots plays: 30 with an edge that land 70% at -120 (asked 54.5%), 30 without that land 40% at -150; 30 goal plays at +150 landing 30%.
    const rows = [];
    // `landed` of every 10 plays hit (the first `landed` of each ten).
    const mk = (i, p, implied, odds, landed, stat = 'sog') => {
      const hit = (i - 1) % 10 < landed ? 1 : 0;
      const book = stat === 'sog' ? { sog: { line: 2.5, mark: 3, odds, implied, p, raw: p + 0.1, edge: Math.round((p - implied) * 1000) / 1000 }, goal: null } : { sog: null, goal: { odds, implied, p, raw: p, edge: Math.round((p - implied) * 1000) / 1000 } };
      rows.push({ date: '2026-10-20', book, actual: stat === 'sog' ? { sog: hit ? 3 : 1, g: 0 } : { sog: 1, g: hit } });
    };
    for (let i = 1; i <= 30; i++) mk(i, 0.62, 0.545, -120, 7);           // lands 70%
    for (let i = 1; i <= 30; i++) mk(i, 0.5, 0.6, -150, 4);               // lands 40%
    for (let i = 1; i <= 30; i++) mk(i, 0.35, 0.4, 150, 3, 'g');         // lands 30%
    const e = edgeReport(rows);
    expect(e.sog.n).toBe(60);
    expect(e.sog.plays.n).toBe(30); expect(e.sog.plays.hit).toBeCloseTo(0.7, 1); expect(e.sog.plays.implied).toBe(0.545); expect(e.sog.plays.ret).toBeGreaterThan(0);
    expect(e.sog.plays.raw).toBeCloseTo(0.72, 2);
    expect(e.sog.byEdge.find((b) => b.key === 'e_neg').n).toBe(30);
    expect(e.sog.byEdge.find((b) => b.key === 'e6').n).toBe(30);
    expect(e.sog.byImplied.find((b) => b.key === 'i50').n).toBe(30); expect(e.sog.byImplied.find((b) => b.key === 'i60').n).toBe(30);
    // From 50% both groups are in (landed 55% against 57% asked: not paid); from 60% the 30 edge plays alone pay.
    const at50 = e.sog.steps.find((s) => s.step === 0.5); const at60 = e.sog.steps.find((s) => s.step === 0.6);
    expect(at50.n).toBe(60); expect(at50.ok).toBe(false);
    expect(at60.n).toBe(30); expect(at60.ok).toBe(true);
    expect(e.sog.reliable).toMatchObject({ step: 0.55, n: 30 });   // the lowest step the 62% plays alone clear
    // The goals: 30 plays at +150 landing 30% against 40% asked lose; no reliable step.
    expect(e.g.n).toBe(30); expect(e.g.ret).toBeLessThan(0); expect(e.g.reliable).toBeNull();
    expect(reliableOf(e)).toEqual({ sog: e.sog.reliable, g: null });
    expect(reliableOf(null)).toBeNull();
    expect(RELIABLE.min).toBe(25); expect(EDGE_BUCKETS).toHaveLength(5);
    // Nothing priced: empty markets, no reliable step.
    expect(edgeReport([{ book: null, actual: { sog: 3, g: 0 } }]).sog).toMatchObject({ n: 0, reliable: null });
  });
  test('the scorecard carries the edge audit and exports the book’s figures', () => {
    const m = { name: 'Connor McDavid', team: 'EDM', pos: 'C', lambdaS: 3.4, lambdaG: 0.9, p3s: 0.66, p4s: 0.44, p5s: 0.26, p1g: 0.61, p2g: 0.24, p1p: 0.7, p2p: 0.3, pf5: {}, pfSeason: {} };
    const book = { sog: { line: 2.5, mark: 3, odds: -140, implied: 0.583, p: 0.55, raw: 0.66, edge: -0.033 }, goal: { odds: 120, implied: 0.455, p: 0.3, raw: 0.61, edge: -0.155 } };
    const row = gradeRow({ date: '2026-10-30', gameId: 1, m, s: { name: 'Connor McDavid', team: 'EDM', opp: 'NYI', venue: 'A', pos: 'C', line: 1, sog: 4, g: 1, a: 0 }, own: {}, study: { lamS: 3, lamG: 0.36 }, book });
    expect(row.book).toBe(book);
    const card = summarize([row], {}, { from: '2026-10-30', to: '2026-10-30' });
    expect(card.edges.sog).toMatchObject({ n: 1, hit: 1, said: 0.55, implied: 0.583 });
    expect(card.edges.g).toMatchObject({ n: 1, hit: 1 });
    expect(exportRows([row])[0]).toMatchObject({ sogLine: 2.5, sogOdds: -140, sogImplied: 0.583, sogBoard: 0.55, goalOdds: 120, goalImplied: 0.455, goalBoard: 0.3 });
    expect(exportRows([gradeRow({ date: '2026-10-30', gameId: 1, m, s: { name: 'x', team: 'EDM', sog: 0, g: 0 }, own: {} })])[0].sogLine).toBeNull();
  });
});
