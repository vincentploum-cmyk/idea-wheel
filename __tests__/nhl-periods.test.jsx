/**
 * The rink's 1 · 2 · 3 badges (Vincent, 2026-11-10: "a simple 1, 2, 3 next to the player on the board colored in
 * green / amber / red to define the match up (opposing team allows + own production)"): shots by period stamped
 * from the play-by-play, the opponent's shots allowed and the skater's own shots in each period, by third.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { periodShotsOf, stampPeriodShots } from '@/lib/nhl-data/game';
import { toRow, rowObj } from '@/lib/nhl-data/ingest';
import { periodBook, periodRead, thirdOf } from '@/lib/nhl-data/periods-pure';
import { PeriodBadges } from '@/components/nhl/Rink';

const shot = (id, period, type = 'shot-on-goal', periodType = 'REG') => ({ typeDescKey: type, periodDescriptor: { number: period, periodType }, details: type === 'goal' ? { scoringPlayerId: id } : { shootingPlayerId: id } });

test('shots and goals count per regulation period; misses, blocks, overtime and the shootout do not', () => {
  const plays = [shot(1, 1), shot(1, 1, 'goal'), shot(1, 2), shot(1, 3, 'missed-shot'), shot(1, 3, 'blocked-shot'), shot(2, 3), shot(1, 4, 'shot-on-goal', 'OT'), shot(2, 5, 'goal', 'SO')];
  expect(periodShotsOf(plays)).toEqual({ 1: [2, 1, 0], 2: [0, 0, 1] });
  const game = { skaters: [{ id: 1 }, { id: 2 }, { id: 3 }] };
  stampPeriodShots(game, plays);
  expect(game.skaters.map((s) => s.sp)).toEqual([[2, 1, 0], [0, 0, 1], [0, 0, 0]]);
});

test('the season rows carry the three periods; older rows read as missing', () => {
  const g = { date: '2026-11-01', id: 9 };
  const row = rowObj(toRow(g, { id: 1, name: 'A', sp: [2, 1, 0] }));
  expect([row.sp1, row.sp2, row.sp3]).toEqual([2, 1, 0]);
  expect(rowObj(toRow(g, { id: 1, name: 'A' })).sp1).toBeNull();
});

test('thirds: top third +1, bottom third -1', () => {
  expect([thirdOf(1, 9), thirdOf(3, 9), thirdOf(4, 9), thirdOf(6, 9), thirdOf(7, 9), thirdOf(null, 9)]).toEqual([1, 1, 0, 0, -1, 0]);
});

// Nine teams, five games each: team Tk allows k shots in the 1st and 10 - k in the 3rd, 5 in the 2nd. Each team
// faces a skater whose period rate rises with his number in the 1st.
function rowsFor() {
  const rows = [];
  for (let k = 1; k <= 9; k++) {
    for (let gm = 0; gm < 5; gm++) {
      rows.push({ date: `2026-10-${10 + gm}`, gameId: k * 100 + gm, playerId: k, pos: 'C', team: `S${k}`, opp: `T${k}`, sp1: k, sp2: k === 9 ? 5 : k % 2 ? 3 : 7, sp3: 10 - k });
    }
  }
  rows.push({ date: '2025-12-01', gameId: 1, playerId: 1, pos: 'C', opp: 'T1', sp1: 50, sp2: 50, sp3: 50 }); // last season: left out
  rows.push({ date: '2026-10-20', gameId: 2, playerId: 99, pos: 'C', opp: 'T1' }); // no periods: left out
  return rows;
}

test('the book: this season only, the league mean, ranks 1 = the most', () => {
  const b = periodBook(rowsFor(), 2026);
  expect(b.teams.T9).toMatchObject({ gp: 5, allowed: [9, 5, 1], of: 9 });
  expect(b.teams.T9.rank).toEqual([1, 5, 9]);
  expect(b.league).toEqual([5, 5, 5]);
  expect(b.skaters[9]).toMatchObject({ gp: 5, rate: [9, 5, 1], rank: [1, 5, 9], of: 9 });
  expect(b.skaters[99]).toBeUndefined();
});

test('green when both lean good, red when both lean bad, amber when they cancel', () => {
  const b = periodBook(rowsFor(), 2026);
  // Skater 9 (a top-third shooter in the 1st, bottom third in the 3rd) against T9 (allows the most in the 1st, the fewest in the 3rd).
  const r = periodRead(b, 9, 'T9');
  expect(r.map((x) => x.tone)).toEqual(['soft', 'mid', 'tough']);
  expect(r[0].text).toBe('Period 1: T9 allow 9.0 shots in the 1st, #1 of 9 (the league 5.0) · he takes 9.00 a game in the 1st, #1 of 9 forwards · this season');
  // Against T1 (the fewest in the 1st, the most in the 3rd) his strong 1st and weak 3rd cancel out.
  expect(periodRead(b, 9, 'T1').map((x) => x.tone)).toEqual(['mid', 'mid', 'mid']);
  // A skater without games: the opponent alone decides.
  expect(periodRead(b, 1234, 'T9').map((x) => x.tone)).toEqual(['soft', 'mid', 'tough']);
  expect(periodRead(b, 1234, 'T9')[0].text).toContain('no games of his with shots by period');
  // Neither side known: no badges.
  expect(periodRead(b, 1234, 'XXX')).toBeNull();
  expect(periodRead(periodBook([], 2026), 9, 'T9')).toBeNull();
});

test('the badges: 1 · 2 · 3 tinted, the read on the hover; nothing without a read', () => {
  const html = renderToStaticMarkup(<PeriodBadges periods={[{ period: 1, tone: 'soft', text: 'a' }, { period: 2, tone: 'mid', text: 'b' }, { period: 3, tone: 'tough', text: 'c' }]} />);
  expect(html).toBe('<span class="nhlx-rk-per" aria-label="matchup by period"><i class="nhlx-rk-per-b is-soft" title="a">1</i><i class="nhlx-rk-per-b is-mid" title="b">2</i><i class="nhlx-rk-per-b is-tough" title="c">3</i></span>');
  expect(renderToStaticMarkup(<PeriodBadges periods={null} />)).toBe('');
});

test('teamAllowsBook: this season, each row against its opponent, ranked 1 = the most once a team has 3 games', () => {
  const { teamAllowsBook, allowsOf } = require('@/lib/nhl-data/defense-board');
  const rows = [];
  const add = (opp, gameId, sog, g = 0, date = '2026-10-20') => rows.push({ date, gameId, opp, sog, g });
  for (let i = 0; i < 3; i++) { add('AAA', 10 + i, 20, 1); add('AAA', 10 + i, 12, 2); add('BBB', 20 + i, 25); add('CCC', 30 + i, 30, 1); }
  add('DDD', 40, 50); // one game: not ranked
  add('AAA', 1, 99, 0, '2025-11-01'); // last season: left out
  const b = teamAllowsBook(rows, 2026);
  expect(allowsOf(b, 'AAA')).toMatchObject({ gp: 3, sog: 32, g: 3, rank: { sog: 1, g: 1 }, of: 3 });
  expect(b.teams.BBB.rank).toEqual({ sog: 3, g: 3 });
  expect(b.teams.DDD.rank).toEqual({ sog: null, g: null });
  expect(b.league.sog).toBe(+((96 + 75 + 90 + 50) / 10).toFixed(2));
  expect(allowsOf(b, 'ZZZ')).toBeNull();
});
