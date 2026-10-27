import { describe, expect, test } from '@jest/globals';
import { etDate, asOf, gradeBoard, score, scorePriced, summarize, BUCKETS, EDGE_BUCKETS } from '../lib/picks/scorecard';
import { buildBoard, actualFor, statOf } from '../lib/nba/picks';
import { weekFromKey } from '../lib/nfl/store';

describe('the leak guard', () => {
  test('a game’s ET date', () => {
    expect(etDate('2026-10-21T23:30Z')).toBe('2026-10-21');
    expect(etDate('2026-10-22T02:00Z')).toBe('2026-10-21');   // a 10 PM ET tip is the next day in UTC
    expect(etDate('2026-10-21')).toBe('2026-10-21');
    expect(etDate(null)).toBeNull();
  });
  test('each player keeps the log rows before his team’s game and loses the rest', () => {
    const games = [{ id: 'g1', date: '2026-10-22T02:00Z', away: 'LAL', home: 'GS' }];
    const pf = { at: '2026-10-22T12:00:00Z', data: { players: [
      { key: 'a', team: 'LAL', games: [{ date: '2026-10-21', pts: 30 }, { date: '2026-10-19', pts: 20 }, { date: '2026-10-22', pts: 40 }] },
      { key: 'b', team: 'MIA', games: [{ date: '2026-10-21', pts: 10 }] },   // not on the slate: untouched
      { key: 'c', team: 'GS' },                                               // no logs: untouched
    ] } };
    const cut = asOf(pf, games);
    expect(cut.data.players[0].games.map((g) => g.date)).toEqual(['2026-10-19']);
    expect(cut.data.players[1].games).toHaveLength(1);
    expect(cut.data.players[2]).toEqual({ key: 'c', team: 'GS' });
    expect(pf.data.players[0].games).toHaveLength(3);   // the pull itself is untouched
    expect(asOf(null, games)).toBeNull();
  });
});

describe('grading a slate', () => {
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: true, state: 'post', awayScore: 110, homeScore: 104, detail: 'Final' }];
  const log = (date, pts, reb, ast) => ({ date, season: 2026, type: 'REG', opp: 'NY', pts, reb, ast, tpm: 3, stl: 1, blk: 0, tov: 2, pra: pts + reb + ast, pr: pts + reb, pa: pts + ast, ra: reb + ast, stlBlk: 1, dd: reb >= 10 && pts >= 10 ? 1 : 0, td3: 0 });
  const logs = [[30, 8, 5], [25, 11, 6], [33, 7, 4], [28, 12, 8], [19, 6, 3], [31, 9, 5], [27, 10, 6], [35, 8, 7], [22, 9, 4], [29, 11, 6]].map(([p, r, a], i) => log(`2026-10-${String(20 - i).padStart(2, '0')}`, p, r, a));
  const sheets = [{ id: 's1', fileName: 'props-2026-10-21.csv', at: '2026-10-21T12:00:00Z', rows: [
    { player: 'Jayson Tatum', team: 'BOS', pos: 'SF', market: 'pts', group: 'points', line: 27.5, side: 'over', odds: -115, hit: { l10: 0.6 }, avg: {} },
    { player: 'Jalen Brunson', team: 'NY', pos: 'PG', market: 'ast', group: 'assists', line: 6.5, side: 'over', odds: -120, hit: { l5: 0.8, l10: 0.7, season: 0.7 }, avg: {} },
  ] }];
  const pf = { at: '2026-10-21T14:00:00Z', data: { players: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 27.5, odds: -115, underOdds: -105, isMain: true }, { market: 'reb', line: 8.5, odds: -110, underOdds: -110, isMain: true }] }], defense: { count: 3, teams: { NY: { SF: { pts: 28 } } }, ranks: { NY: { SF: { pts: 1 } } } } } };
  const results = { g1: { id: 'g1', final: true, players: [
    { name: 'Jayson Tatum', team: 'BOS', played: true, pts: 29, reb: 7, ast: 4, pra: 40, dd: 0, td3: 0 },
    { name: 'Jalen Brunson', team: 'NY', played: true, pts: 24, reb: 3, ast: 9, pra: 36, dd: 0, td3: 0 },
  ] } };
  const board = buildBoard({ date: '2026-10-21', season: 2026, games, sheets, pf, results });
  const actualOf = (g, p, market) => { const line = actualFor(results[g.id], p); return line === undefined ? undefined : line && line.played !== false ? statOf(line, market) : null; };
  const graded = gradeBoard(board, { key: '2026-10-21', label: 'Oct 21', actualOf });

  test('every graded play with its chance, price, edge and whether it made a table', () => {
    expect(graded).toMatchObject({ key: '2026-10-21', label: 'Oct 21', games: 1, finals: 1, graded: 1 });
    const pts = graded.plays.find((x) => x.key === 'jayson tatum' && x.market === 'pts');
    expect(pts).toMatchObject({ slate: '2026-10-21', game: 'g1', team: 'BOS', opp: 'NY', venue: 'A', pos: 'SF', line: 27.5, side: 'over', hit: 1, actual: 29, third: 'soft', source: 'confirmed', onBoard: true, odds: -115 });
    expect(pts.implied).toBeCloseTo(115 / 215, 3);
    expect(pts.edge).toBeCloseTo(pts.p - pts.implied, 3);
    const reb = graded.plays.find((x) => x.key === 'jayson tatum' && x.market === 'reb');
    expect(reb).toMatchObject({ hit: 0, actual: 7, source: 'propfinder', third: 'none' });
    const ast = graded.plays.find((x) => x.key === 'jalen brunson');
    expect(ast).toMatchObject({ hit: 1, actual: 9, source: 'sheet', pfBacked: false });
    expect(ast.onBoard).toBe(false);   // a sheet-only fill-in behind PropFinder's plays
  });
  test('every ladder rung against his figure, the three reads side by side', () => {
    const rungs = graded.rungs.filter((r) => r.key === 'jayson tatum' && r.market === 'pts');
    expect(rungs.length).toBeGreaterThanOrEqual(5);
    for (const r of rungs) { expect(r.hit).toBe(29 > r.line ? 1 : 0); expect(r.model).toBeGreaterThanOrEqual(0); expect(r.emp).not.toBeNull(); }
    expect(rungs.find((r) => r.main)).toMatchObject({ line: 27.5, priced: true, odds: -115, hit: 1 });
    // No ladder for a player without a box-score line.
    const noResult = gradeBoard(board, { key: 'x', actualOf: () => undefined });
    expect(noResult.rungs).toEqual([]);
    // Without actualOf a rung grades off the player's plays of that market.
    const fromPlays = gradeBoard(board, { key: 'x' });
    expect(fromPlays.rungs.filter((r) => r.market === 'pts').length).toBe(rungs.length);
  });
  test('scores: said, hit, diff, Brier, and the book’s implied and flat return', () => {
    expect(score([])).toEqual({ n: 0, said: null, hit: null, diff: null, brier: null });
    const s = score([{ p: 0.6, hit: 1 }, { p: 0.6, hit: 0 }, { p: 0.4, hit: 1 }, { p: 0.4, hit: 0 }]);
    expect(s).toEqual({ n: 4, said: 0.5, hit: 0.5, diff: 0, brier: 0.26 });
    const priced = scorePriced([{ p: 0.6, hit: 1, odds: -110, implied: 0.524 }, { p: 0.5, hit: 0, odds: 150, implied: 0.4 }, { p: 0.5, hit: 1, odds: null, implied: null }]);
    expect(priced).toMatchObject({ n: 3, priced: 2, implied: 0.462 });
    expect(priced.ret).toBeCloseTo((0.909 - 1) / 2, 2);
  });
  test('the summary over slates', () => {
    const report = summarize([graded], { from: '2026-10-01', to: '2026-10-21', markets: ['pts', 'reb', 'ast', 'tpm'] });
    expect(report).toMatchObject({ slates: 1, games: 1, graded: 1, plays: graded.plays.length, boardPlays: graded.plays.filter((x) => x.onBoard).length });
    expect(report.all.n).toBe(graded.plays.length);
    expect(report.all.hit).toBeCloseTo(graded.plays.filter((x) => x.hit).length / graded.plays.length, 3);
    expect(report.markets.map((m) => m.key)).toEqual(['pts', 'reb', 'ast']);   // the sport's order, the markets with calls
    expect(report.markets[0]).toMatchObject({ label: 'Points', group: 'points' });
    expect(report.buckets).toHaveLength(BUCKETS.length);
    expect(report.buckets.reduce((s, b) => s + b.all.n, 0)).toBe(graded.plays.length);
    expect(report.edges).toHaveLength(EDGE_BUCKETS.length);
    expect(report.thirds.find((t) => t.key === 'soft').all.n).toBe(1);
    expect(report.sources.map((s) => [s.key, s.all.n])).toEqual([['confirmed', 1], ['propfinder', 1], ['sheet', 1]]);
    const lad = report.ladders.find((l) => l.key === 'pts');
    expect(lad.n).toBeGreaterThanOrEqual(5);
    expect(lad.common).toBe(lad.n);
    for (const k of ['model', 'emp', 'blend']) { expect(lad[k].n).toBe(lad.n); expect(lad[k].brier).toBeGreaterThanOrEqual(0); expect(lad[k].brier).toBeLessThanOrEqual(1); }
    expect(lad.main).toMatchObject({ n: 1, hit: 1 });
    expect(report.bySlate).toEqual([expect.objectContaining({ key: '2026-10-21', label: 'Oct 21', finals: 1, graded: 1, plays: graded.plays.length })]);
    // A slate with nothing finished adds nothing.
    expect(summarize([{ key: 'x', label: 'x', games: 2, finals: 0, graded: 0, plays: [], rungs: [] }]).slates).toBe(1);
    expect(summarize([]).all).toMatchObject({ n: 0, said: null, ret: null });
  });
});

describe('NFL week keys', () => {
  test('a stored week folder back to its slate', () => {
    expect(weekFromKey(2026, 'w07')).toEqual({ season: 2026, week: 7, type: 2 });
    expect(weekFromKey('2026', 'p1')).toEqual({ season: 2026, week: 1, type: 3 });
    expect(weekFromKey(2026, 'calendar')).toBeNull();
  });
});

describe('the predictors', () => {
  const { gradePredictors, predictorReport, PREDICTORS } = require('../lib/picks/scorecard');
  const { ownWindows } = require('../lib/nba/picks');
  const { upperTail } = require('../lib/picks/projection');
  const games = [{ id: 'g1', date: '2026-10-21T23:30Z', away: 'BOS', home: 'NY', final: true, state: 'post', awayScore: 110, homeScore: 104, detail: 'Final' }];
  const logs = Array.from({ length: 12 }, (_, i) => ({ date: `2026-10-${String(20 - i).padStart(2, '0')}`, season: 2026, type: 'REG', opp: 'NY', pts: 30 - i, reb: 8, ast: 5, tpm: 2, pra: 43 - i }));
  const pf = { at: '2026-10-21T12:00:00Z', data: { players: [{ id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', games: logs, props: [{ market: 'pts', line: 27.5, odds: -115, underOdds: -105, isMain: true }] }], defense: { count: 2, teams: { NY: { SF: { pts: 24 } }, BOS: { SF: { pts: 20 } } }, ranks: { NY: { SF: { pts: 1 } }, BOS: { SF: { pts: 2 } } }, league: { SF: { pts: 22 } } } } };
  const results = { g1: { id: 'g1', final: true, players: [{ name: 'Jayson Tatum', team: 'BOS', played: true, pts: 29, reb: 7, ast: 4, pra: 40 }] } };
  const board = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results });
  const actualOf = (g, p, market) => { const line = actualFor(results[g.id], p); return line === undefined ? undefined : line && line.played !== false ? statOf(line, market) : null; };
  const rows = gradePredictors(board, pf, { key: '2026-10-21', season: 2026, actualOf, ownWindows });
  test('one row per player, market and box-score line: his figure beside every predictor', () => {
    const pts = rows.find((r) => r.market === 'pts');
    expect(pts).toMatchObject({ slate: '2026-10-21', key: 'jayson tatum', actual: 29, line: 27.5, own3: 29, own5: 28, own10: 25.5, ownSeason: 24.5, h2h: 28.5, h2hN: 4 });   // every log here is against NY: his last four meetings
    // The windows × the matchup: the centre the shuffle reads from (× env to 0.1), on every row that has the window.
    const x = (v) => Math.round(v * (pts.env ?? 1) * 10) / 10;
    expect([pts.own5x, pts.own10x, pts.ownSeasonx]).toEqual([x(28), x(25.5), x(24.5)]);
    expect(pts.own20).toBe(24.5);   // twelve games: the last twenty are all of them
    const lad = board.games[0].sides.BOS.players[0].ladders.pts;
    expect(pts.proj).toBe(lad[0].proj);
    expect(pts.sd).toBe(lad[0].sd);
    expect(pts.blend).toBeCloseTo(lad[0].proj / lad[0].env, 1);
    expect(rows.map((r) => r.market).sort()).toEqual(['ast', 'pra', 'pts', 'reb', 'tpm']);
    // No row without a box score.
    expect(gradePredictors(board, pf, { key: 'x', season: 2026, actualOf: () => undefined, ownWindows })).toEqual([]);
  });
  test('head to head: his last meetings with the opponent, two at least, scored without thinning the common rows', () => {
    const { ownWindows: ow } = require('../lib/nba/picks');
    const mixed = logs.map((g, i) => ({ ...g, opp: i % 3 === 0 ? 'NY' : 'LAL' }));   // vs NY on 10-20, 10-17, 10-14, 10-11: 30, 27, 24, 21
    expect(ow(mixed, { market: 'pts', season: 2026, opp: 'NY' })).toMatchObject({ h2h: 25.5, h2hN: 4 });
    expect(ow(mixed.slice(0, 2), { market: 'pts', season: 2026, opp: 'NY' })).toMatchObject({ h2h: null, h2hN: 1 });   // one meeting is a coin
    expect(ow(mixed, { market: 'pts', season: 2026 })).toMatchObject({ h2h: null, h2hN: 0 });
    expect(ow(mixed, { market: 'pts', season: 2026, opp: 'NY' }).l3).toBe(29);   // the plain windows unchanged
    // A second player who never met NY has no head-to-head row; the common rows still carry him.
    const pf2 = { ...pf, data: { ...pf.data, players: [...pf.data.players, { id: 'p2', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SF', games: logs.map((g) => ({ ...g, opp: 'LAL', pts: g.pts - 5 })), props: [{ market: 'pts', line: 22.5, odds: -110, underOdds: -110, isMain: true }] }] } };
    const res2 = { g1: { ...results.g1, players: [...results.g1.players, { name: 'Jaylen Brown', team: 'BOS', played: true, pts: 20, reb: 6, ast: 3, pra: 29 }] } };
    const b2 = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: pf2, results: res2 });
    const a2 = (g, p, market) => { const line = actualFor(res2[g.id], p); return line === undefined ? undefined : line && line.played !== false ? statOf(line, market) : null; };
    const r2 = gradePredictors(b2, pf2, { key: '2026-10-21', season: 2026, actualOf: a2, ownWindows: ow });
    expect(r2.filter((r) => r.market === 'pts').map((r) => [r.key, r.h2h, r.h2hN])).toEqual([['jayson tatum', 28.5, 4], ['jaylen brown', null, 0]]);
    const rep = predictorReport(r2, 'pts', 'Points');
    expect(rep.common.n).toBe(2);   // both rows carry every dense predictor
    const h2h = rep.common.predictors.find((p) => p.key === 'h2h');
    expect(h2h).toMatchObject({ sparse: true, n: 1, avg: 28.5, actual: 29, bias: -0.5 });
    expect(h2h.against.proj).toMatchObject({ n: 1, actual: 29 });   // the projection on the same row
    expect(h2h.against.blend).toMatchObject({ n: 1, actual: 29 });
    expect(rep.common.predictors.find((p) => p.key === 'proj').n).toBe(2);   // the dense ones on both rows
    expect(rep.common.predictors.find((p) => p.key === 'own5').against).toBeUndefined();
  });
  test('the report: bias, MAE, RMSE and the over-the-line read per predictor, on common rows', () => {
    const rep = predictorReport(rows, 'pts', 'Points');
    expect(rep).toMatchObject({ key: 'pts', label: 'Points', n: 1 });
    expect(rep.each.map((p) => p.key)).toEqual(PREDICTORS.map((p) => p.key));
    const own3 = rep.each.find((p) => p.key === 'own3');
    expect(own3).toMatchObject({ n: 1, avg: 29, actual: 29, bias: 0, mae: 0, rmse: 0, lined: 1, hit: 1 });
    expect(own3.said).toBeCloseTo(upperTail((27.5 - 29) / rows[0].sd), 3);
    expect(own3.brier).toBeCloseTo((own3.said - 1) ** 2, 3);
    const line = rep.each.find((p) => p.key === 'line');
    expect(line).toMatchObject({ n: 1, avg: 27.5, bias: -1.5, mae: 1.5, said: 0.5, hit: 1, brier: 0.25 });
    expect(rep.common.n).toBe(1);
    expect(rep.common.predictors.map((p) => p.key)).toEqual(PREDICTORS.map((p) => p.key));   // every predictor has its row here
    // A market no row carries.
    expect(predictorReport(rows, 'stl').common).toEqual({ n: 0, predictors: [] });
  });
  test('the summary carries the predictors per market in the sport’s order with its labels', () => {
    const graded = { ...gradeBoard(board, { key: '2026-10-21', actualOf }), pred: rows };
    const rep = summarize([graded], { markets: ['pts', 'reb', 'ast', 'tpm', 'pra', 'stl'], labels: { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: '3-pointers', pra: 'Pts + reb + ast' } });
    expect(rep.predictors.map((p) => [p.key, p.label, p.n])).toEqual([['pts', 'Points', 1], ['reb', 'Rebounds', 1], ['ast', 'Assists', 1], ['tpm', '3-pointers', 1], ['pra', 'Pts + reb + ast', 1]]);
    expect(summarize([gradeBoard(board, { key: 'x', actualOf })]).predictors).toEqual([]);
  });
});
