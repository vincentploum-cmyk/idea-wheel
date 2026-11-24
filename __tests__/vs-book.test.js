import { vsBookRows, vsBookOf } from '../lib/picks/store';

// The projections graded against the books' consensus line (Vincent, 2026-11-24: "start with saving the real book line").
describe('the board against the books', () => {
  const board = { games: [{ id: 'g1', final: true, sides: { OKC: { team: 'OKC', players: [
    { key: 'lead guard', ranges: { pts: { exp: 27 }, reb: { exp: 5 } } },
    { key: 'bench', ranges: { pts: { exp: 8 } } },
  ] } } }, { id: 'g2', final: false, sides: {} }] };
  const lines = { snapshots: [
    { at: '2026-11-24T15:00Z', beforeTip: true, players: [{ key: 'lead guard', team: 'OKC', markets: { pts: { consensus: { line: 29.5, books: 4, fairOver: 0.5 } } } }] },
    { at: '2026-11-24T23:30Z', beforeTip: true, players: [{ key: 'lead guard', team: 'OKC', markets: { pts: { consensus: { line: 30.5, books: 5, fairOver: 0.51 } }, reb: { consensus: null } } }] },
    { at: '2026-11-25T02:00Z', beforeTip: false, players: [{ key: 'lead guard', team: 'OKC', markets: { pts: { consensus: { line: 40.5, books: 5 } } } }] },
  ] };
  const got = { 'lead guard': { pts: 34, reb: 6 }, bench: { pts: 3 } };
  const actualOf = (g, p, m) => got[p.key]?.[m] ?? null;
  test('the latest snapshot before the first tip, the finished games, both a projection and a consensus line', () => {
    const rows = vsBookRows(board, lines, actualOf);
    expect(rows).toEqual([{ game: 'g1', key: 'lead guard', team: 'OKC', market: 'pts', proj: 27, line: 30.5, books: 5, fairOver: 0.51, actual: 34, at: '2026-11-24T23:30Z' }]);
  });
  test('the miss of each, got − said, and the board\'s side when it leans a point off the line', () => {
    const rows = [{ market: 'pts', proj: 27, line: 30.5, actual: 34 }, { market: 'pts', proj: 20, line: 18.5, actual: 22 }, { market: 'pts', proj: 15, line: 14.5, actual: 10 }];
    expect(vsBookOf(rows).pts).toEqual({ n: 3, board: 4.667, book: 3.833, half: 4.25, boardBias: 1.333, bookBias: 0.833, leans: 2, leanRight: 0.5 });
  });
});
