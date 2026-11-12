/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { softSpots, topSpot, isRegular, playerTopSpot, topSpotText, SOFT_TOP, REGULAR_MIN, SOFT_SHOWN } from '../lib/nba/soft-spots';
import NbaSoftSpots from '../components/nba/NbaSoftSpots';
import CourtPair from '../components/nba/NbaCourt';

// The NBA's Soft spots (Vincent, 2026-11-10, the NHL's list on Best bets: "We should do the same with nba"): the regulars
// facing one of the five defenses that give up the most at their position, on the season table the board reads.
const cell = (rank, value, sheet = null) => ({ value, rank, ...(sheet != null ? { sheet } : {}) });
const range = (exp, line = null, p = null, odds = null) => ({ exp, floor: Math.floor(exp * 0.7), ceiling: Math.ceil(exp * 1.3), line, p, odds });
const player = (key, name, envPos, minutes, ranges, extra = {}) => ({ key, player: name, pos: envPos, envPos, minutes: minutes == null ? null : { tonight: minutes }, ranges, ladders: {}, plays: [], own: {}, out: false, health: 'In', ...extra });

function fixture({ final = false } = {}) {
  const white = player('dw', 'Derrick White', 'SG', 32, { pts: range(17.2, 15.5, 0.6, -120), reb: range(4.1) }, {
    ladders: { pts: [{ line: 13.5, p: 0.74 }, { line: 15.5, p: 0.62, odds: -110, main: true }] },
    plays: [{ market: 'pts', line: 15.5, side: 'over', main: true, p: 0.62, odds: -110, form: 'hot', rates: { l5: 0.8 }, ...(final ? { actual: 19, hit: true } : {}) }],
  });
  return {
    date: '2026-11-10',
    best: [{ game: 'g1', key: 'dw', market: 'pts', side: 'over', line: 15.5, p: 0.62, odds: -110, edge: 0.096 }],
    games: [{
      id: 'g1', away: 'BOS', home: 'NY', date: '2026-11-11T00:30:00Z', final,
      sides: {
        BOS: {
          team: 'BOS', opp: 'NY', venue: 'A', out: [],
          allowed: { count: 30, from: 'propfinder', league: { SG: { pts: 20.3 } }, rows: {
            SG: { pts: cell(2, 24.1, 4), reb: cell(12, 5) },
            PG: { ast: cell(5, 8.8), tpm: cell(6, 3.1) },
            C: { reb: cell(1, 14.2) },
          } },
          players: [
            white,
            player('jh', 'Jrue Holiday', 'PG', 30, { ast: range(6.1), tpm: range(1.8) }),
            player('starter', 'No Minutes Read', 'PG', null, { ast: range(5.2, 4.5, 0.55, 110) }, { depth: 1, slot: 'PG' }),
            player('bench', 'Luke Kornet', 'C', 14, { reb: range(5) }),
            player('hurt', 'Hurt Guard', 'SG', 30, { pts: range(15) }, { out: true }),
            player('idle', 'Two Way', 'SG', 30, { pts: range(3) }, { idle: true }),
          ],
        },
        NY: {
          team: 'NY', opp: 'BOS', venue: 'H', out: [],
          allowed: { count: 30, from: 'propfinder', rows: { PF: { pts: cell(3, 21.9) }, PG: { pts: cell(18, 22) } } },
          players: [
            player('ka', 'Karl-Anthony Towns', 'PF', 35, { pts: range(22, 21.5, 0.52, -130) }, final ? { plays: [{ market: 'pts', line: 21.5, side: 'over', p: 0.52, odds: -130, actual: 18, hit: false }] } : {}),
            player('jb', 'Jalen Brunson', 'PG', 36, { pts: range(27) }),
          ],
        },
      },
    }],
  };
}

describe('the soft spots: the regulars against a top-five defense at their position', () => {
  test('the cut, the regulars and the order: priced lines by edge, then the projections alone', () => {
    const rows = softSpots(fixture());
    expect(SOFT_TOP).toBe(5);
    expect(rows.map((r) => `${r.player} ${r.stat} #${r.rank}`)).toEqual([
      'Derrick White pts #2',          // edge +9.6
      'No Minutes Read ast #5',        // edge +7.4: no minutes read, the depth chart's starter
      'Karl-Anthony Towns pts #3',     // edge −4.5
      'Jrue Holiday ast #5',           // no line: the projection alone
    ]);
    // Out, idle, a bench minute count, a rank past five (PG threes #6, SG rebounds #12, NY's PG points #18): none listed.
    expect(rows.some((r) => ['bench', 'hurt', 'idle', 'jb'].includes(r.key))).toBe(false);
  });
  test('each row: the spot, the board’s projection, the main rung’s chance, the break-even price and the edge', () => {
    const [dw] = softSpots(fixture());
    expect(dw).toMatchObject({ team: 'BOS', opp: 'NY', venue: 'A', pos: 'SG', market: 'pts', rank: 2, count: 30, value: 24.1, league: 20.3, sheet: 4,
      exp: 17.2, line: 15.5, p: 0.62, odds: -110, implied: 0.524, fair: '-163', edge: 0.096, bet: { side: 'over', line: 15.5 }, final: false, hit: null });
    expect(dw.actual).toBeUndefined();
    const jh = softSpots(fixture()).find((r) => r.key === 'jh');
    expect(jh).toMatchObject({ exp: 6.1, line: null, p: null, odds: null, edge: null, fair: null });
  });
  test('graded once the game is final: over the line or not', () => {
    const rows = softSpots(fixture({ final: true }));
    expect(rows.find((r) => r.key === 'dw')).toMatchObject({ final: true, actual: 19, hit: true });
    expect(rows.find((r) => r.key === 'ka')).toMatchObject({ actual: 18, hit: false });
    expect(rows.find((r) => r.key === 'jh').hit).toBeNull();   // no line, no grade
  });
  test('the readers: a regular, the top spot and its words', () => {
    expect(REGULAR_MIN).toBe(24);
    expect(isRegular({ minutes: { tonight: 24 }, ranges: { pts: { exp: 10 } } }, 'pts')).toBe(true);
    expect(isRegular({ minutes: { tonight: 23.9 }, ranges: { pts: { exp: 10 } } }, 'pts')).toBe(false);
    expect(isRegular({ minutes: { tonight: 30 }, thin: true, ranges: { pts: { exp: 10 } } }, 'pts')).toBe(false);
    expect(isRegular({ minutes: { tonight: 30 }, ranges: {} }, 'pts')).toBe(false);   // no projection for the stat
    expect(isRegular({ lineup: { role: 'promoted' }, ranges: { pts: { exp: 10 } } }, 'pts')).toBe(true);
    const allowed = fixture().games[0].sides.BOS.allowed;
    expect(topSpot(allowed, 'SG', 'reb')).toBeNull();
    expect(topSpot(allowed, 'SG', 'reb', 12)).toMatchObject({ rank: 12 });
    const s = topSpot(allowed, 'SG', 'pts');
    expect(topSpotText(s, 'NY')).toBe("Soft spot: NY allows the 2nd most points to SG this season (24.1 a game, #2 of 30, the league 20.3; the cheat sheet's tile #4)");
    expect(playerTopSpot({ envPos: 'C', minutes: { tonight: 14 }, ranges: { reb: { exp: 5 } } }, allowed, 'reb')).toBeNull();   // a bench big: no flame
  });
});

describe('rendered', () => {
  const sport = { teamLogo: (t) => `/logo/${t}.png`, headshotUrl: (id) => `/head/${id}.png` };
  test('the list: the head, a row a spot with the rank, the chance and the break-even price; graded when final', () => {
    const html = renderToStaticMarkup(<NbaSoftSpots board={fixture()} sport={sport} onOpen={() => {}} />);
    expect(html).toContain('Soft spots');
    expect(html).toContain('NY #2');
    expect(html).toContain('2nd most PTS to SG');
    expect(html).toContain('62%');
    expect(html).toContain('-163');
    expect(html).toContain('best bet');
    expect(html).not.toContain('Luke Kornet');
    expect(html).not.toContain('Show all');   // four rows, under the cap
    expect(SOFT_SHOWN).toBe(12);
    const done = renderToStaticMarkup(<NbaSoftSpots board={fixture({ final: true })} sport={sport} />);
    expect(done).toContain('is-hit');
    expect(done).toContain('is-miss');
  });
  test('plain, on the Games tab (Vincent, 2026-11-01: no edge, no implied, no juice): the line and the chance, no price', () => {
    const html = renderToStaticMarkup(<NbaSoftSpots board={fixture()} sport={sport} onOpen={() => {}} plain />);
    expect(html).toContain('NY #2');
    expect(html).toContain('62%');
    expect(html).not.toMatch(/\bEV\b|edge|juice|implie|break/i);
    expect(html).not.toContain('-163');
  });
  test('the court: a green "SG #2" badge for a regular in a top-five spot, the flame for a hot streak only', () => {
    const g = fixture().games[0];
    const html = renderToStaticMarkup(<CourtPair g={g} metric="pts" onMetric={() => {}} sport={{ ...sport, teamName: (t) => t, groups: [] }} />);
    const flames = html.match(/nhlx-pk-flag is-hot" title="[^"]*"/g) || [];
    expect(flames).toHaveLength(1);   // White is hot
    expect(flames[0]).toContain('Hot: 80% of his last 5 over this line');
    expect(flames[0]).not.toContain('Soft spot');
    const badges = html.match(/<i class="nhlx-rk-slot is-soft nhlx-rk-top" title="[^"]*"[^>]*>[^<]*<\/i>/g) || [];
    expect(badges).toHaveLength(2);   // White and Towns
    expect(badges.find((b) => b.includes('>SG #2<'))).toContain('Soft spot: NY allows the 2nd most points to SG this season');
    expect(badges.find((b) => b.includes('>PF #3<'))).toContain('Soft spot: BOS allows the 3rd most points to PF this season');
  });
});
