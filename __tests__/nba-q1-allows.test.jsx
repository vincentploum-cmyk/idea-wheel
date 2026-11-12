/**
 * The NBA courts' twin of the NHL rink's reads (Vincent, 2026-11-10: "build the court headline verdict plus a Q1 badge"):
 * the head says whether tonight's opponent gives up the court's stat, and every chip carries a Q1 badge for it.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sideAllows } from '@/lib/nba/profile';
import { q1Book, q1Read, withQ1Reads, groupOf, thirdOf } from '@/lib/nba/quarter';
import { AllowsLine, Q1Badge } from '@/components/nba/NbaCourt';

const totals = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`T${i + 1}`, { against: { gp: 10, pts: 110 + i, reb: 40 + i, ast: 25, tpm: 12 } }]));
totals.OLD = { against: { held: true, pts: 130 } };

test('sideAllows: the opponent per stat, ranked 1 = the most over the pull, the league mean, the source', () => {
  const a = sideAllows({ totals }, 'T9');
  expect(a.pts).toMatchObject({ value: 118, rank: 2, of: 10, src: '10 games' });
  expect(a.reb).toMatchObject({ value: 48, rank: 1, of: 9 });
  expect(a.ast).toMatchObject({ rank: 1, of: 9 });   // ties share the better rank
  expect(a.stl).toBeUndefined();
  expect(sideAllows({ totals }, 'OLD').pts).toMatchObject({ rank: 1, src: 'last season’s row' });
  expect(sideAllows({ totals }, 'XXX')).toBeNull();
});

test('the headline: a lot of / an average number of / few, tinted by third; nothing without a rank', () => {
  const html = (allows, metric = 'pts') => renderToStaticMarkup(<AllowsLine side={{ opp: 'MEM', allows }} metric={metric} />);
  const lot = html({ pts: { value: 121.4, rank: 2, of: 30, league: 114.2, src: '12 games' } });
  expect(lot.replace(/<[^>]+>/g, '')).toBe('MEM gives up a lot of points · 121.4 a game · #2 of 30');
  expect(lot).toContain('nhlx-rk-verdict is-soft');
  expect(lot).toContain('the league 114.2');
  expect(html({ reb: { value: 44, rank: 15, of: 30, league: 44 } }, 'reb')).toContain('gives up an average number of rebounds');
  expect(html({ tpm: { value: 11, rank: 29, of: 30, league: 13 } }, 'tpm')).toContain('is-tough');
  expect(html({ pts: { value: 1, rank: 1, of: 30 } }, 'reb')).toBe('');
  expect(html(null)).toBe('');
});

test('groups and thirds', () => {
  expect(['PG', 'G', 'SF', 'F', 'G-F', 'C', 'F-C', null].map(groupOf)).toEqual(['G', 'G', 'F', 'F', 'F', 'C', 'F', 'G']);
  expect([thirdOf(1, 9), thirdOf(4, 9), thirdOf(9, 9), thirdOf(null, 9)]).toEqual([1, 0, -1, 0]);
});

// Nine teams, five nights: on each night team Ak plays team Bk; Bk's guard scores k in the 1st quarter, so team Ak gives
// up k points in the 1st, and the same the other way round. A night stored before the lines were parsed is skipped.
function results() {
  const out = [];
  for (let n = 0; n < 5; n++) {
    for (let k = 1; k <= 9; k++) {
      out.push({ date: `2026-11-0${n + 1}`, final: true, away: `A${k}`, home: `B${k}`, players: [
        { espnId: `b${k}`, name: `Guard B${k}`, team: `B${k}`, pos: 'PG', played: true, min: 30, q1Pts: k, q1Reb: 1, q1Ast: 0, q1Tpm: 0 },
        { espnId: `a${k}`, name: `Guard A${k}`, team: `A${k}`, pos: 'SG', played: true, min: 30, q1Pts: k, q1Reb: 1, q1Ast: 0, q1Tpm: 0 },
      ] });
    }
  }
  out.push({ date: '2026-10-25', final: true, away: 'A1', home: 'B1', players: [{ espnId: 'b1', team: 'B1', pos: 'PG', played: true, min: 30, pts: 40, q1Pts: null }] });
  out.push({ date: '2026-11-10', final: true, away: 'A1', home: 'B1', players: [{ espnId: 'b1', team: 'B1', pos: 'PG', played: true, min: 30, q1Pts: 99, q1Reb: 0, q1Ast: 0, q1Tpm: 0 }] });   // the slate's own night: left out
  return out;
}

test('q1Book: what each team gives up in the 1st and each player gets, ranked; nights before the slate with lines only', () => {
  const b = q1Book(results(), { through: '2026-11-10' });
  expect(b.teams.A9).toMatchObject({ gp: 5, allowed: { pts: 9, reb: 1 }, of: 18 });
  expect(b.teams.A9.rank.pts).toBe(1);
  expect(b.teams.B1).toMatchObject({ allowed: { pts: 1 }, rank: { pts: 17 } });
  expect(b.players.b9).toMatchObject({ gp: 5, group: 'G', rate: { pts: 9 }, rank: { pts: 1 }, of: 18 });
  expect(b.players['n:guard b9']).toBe(b.players.b9);
});

test('q1Read: green when both lean good, red when both lean bad, the read named on the hover', () => {
  const b = q1Book(results(), { through: '2026-11-10' });
  // B9's guard (the most in the 1st) against A9 (gives up the most in the 1st).
  const hot = q1Read(b, { espnId: 'b9' }, 'A9');
  expect(hot.pts.tone).toBe('soft');
  expect(hot.pts.text).toBe('1st quarter points: A9 allow 9.0 points in the 1st quarter, #1 of 18 (the league 5.0) · he gets 9.0 in the 1st, #1 of 18 guards · this season');
  // A1's guard (the fewest in the 1st) against B1 (gives up the fewest in the 1st): red.
  expect(q1Read(b, { espnId: 'a1' }, 'B1').pts.tone).toBe('tough');
  // Found by name when the id is not on the board.
  expect(q1Read(b, { name: 'Guard B9' }, 'A9').pts.tone).toBe('soft');
  expect(q1Read(b, { espnId: 'zzz' }, 'XXX')).toBeNull();
});

test('withQ1Reads puts the read on every side player, the board left untouched; the badge follows the court’s stat', () => {
  const b = q1Book(results(), { through: '2026-11-10' });
  const board = { games: [{ id: 1, sides: { B9: { team: 'B9', opp: 'A9', players: [{ key: 'k', player: 'Guard B9', espnId: 'b9' }] } } }] };
  const next = withQ1Reads(board, b);
  expect(next.games[0].sides.B9.players[0].q1.pts.tone).toBe('soft');
  expect(board.games[0].sides.B9.players[0].q1).toBeUndefined();
  const p = next.games[0].sides.B9.players[0];
  expect(renderToStaticMarkup(<Q1Badge p={p} metric="pts" />)).toMatch(/^<i class="nhlx-rk-per-b ir-q1 is-soft" title="1st quarter points: A9 allow/);
  expect(renderToStaticMarkup(<Q1Badge p={p} metric="stl" />)).toBe('');
});

test('on the Games tab: the Q1 badge beside the name follows the stat; the soft spots list shows no edge and no price', () => {
  const { tierRows } = require('@/components/nba/NbaGames');
  const board = { games: [{ id: 'g', away: 'B9', home: 'A9', sides: { B9: { team: 'B9', opp: 'A9', players: [{ key: 'k', player: 'Guard B9', q1: { pts: { tone: 'soft', text: 'x' } } }] } } }] };
  const rows = [{ team: 'B9', key: 'k', player: 'Guard B9', proj: 20 }];
  jest.spyOn(require('@/lib/picks/boards'), 'ladderBoard').mockReturnValue(rows);
  expect(tierRows(board, null, 'pts')[0].q1).toEqual({ tone: 'soft', text: 'x' });
  expect(tierRows(board, null, 'pra')[0].q1).toBeNull();
});
