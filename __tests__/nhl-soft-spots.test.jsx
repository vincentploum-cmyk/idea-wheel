/**
 * Soft spots (Vincent, 2026-11-10: "do 1 but the top 5 worst defenses ... mark the players in the rinks with the same
 * flame as players that are on a hot streak"): the regulars facing a top-5 defense at their position on Best bets, and
 * the hot flame on a rink chip for a top-5 spot.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from '@jest/globals';
import { topSpot, topSpotText, softSpotPlays, SOFT_TOP, SOFT_SPOT_MIN_SOG, SOFT_SPOT_MAX_LINE } from '@/lib/nhl-data/picks-pure';
import { flagsFor } from '@/components/nhl/flags';
import { Rink } from '@/components/nhl/Rink';

const tab = { key: 'l10', label: 'L10', text: 'its last 10 games', stored: false };
const pf = (rankSog, rankG = 20) => ({ source: 'propfinder', pos: 'LW', sog: 6.2, g: 0.71, gp: 10, rankSog, rankG, teams: 32, softSog: rankSog <= 11, softG: rankG <= 11, tab });
const sk = (o) => ({ id: 1, name: 'Mason Marchment', team: 'SJS', opp: 'NYI', venue: 'H', pos: 'LW', line: 1, rates: { sog: 1.74 }, p2: 0.55, p3: 0.27, p4: 0.11, lamS: 1.9, spot: pf(3), ...o });

describe('topSpot / topSpotText', () => {
  test('the opponent in the top five at his position, PropFinder’s table first, the stored table for a team without one', () => {
    expect(SOFT_TOP).toBe(5);
    expect(topSpot(sk(), 'sog')).toMatchObject({ rank: 3, value: 6.2, teams: 32, source: 'propfinder', tab });
    expect(topSpot(sk({ spot: pf(6) }), 'sog')).toBeNull();
    expect(topSpot(sk(), 'g')).toBeNull();
    expect(topSpot(sk({ spot: null, oppPos: { sog: 2.1, g: 0.3, rankSog: 5, rankG: 1, teams: 32 } }), 'g')).toMatchObject({ rank: 1, source: 'games' });
    expect(topSpot({ name: 'x' }, 'sog')).toBeNull();
    expect(topSpotText(sk(), 'sog')).toBe('NYI allows the 3rd most shots to LW over its last 10 games (6.20 a game, of 32) · PropFinder’s table above the rink, its L10 tab');
    expect(topSpotText(sk({ spot: pf(1) }), 'sog')).toContain('NYI allows the most shots to LW');
    expect(topSpotText(sk({ spot: null, oppPos: { sog: 2.1, g: 0.3, rankSog: 2, rankG: 9, teams: 32 } }), 'sog')).toBe('NYI allows the 2nd most shots per LW (2.10 a game, of 32) · the stored box scores, no PropFinder table for NYI');
  });
});

describe('softSpotPlays', () => {
  test('regulars only (1.5+ shots a game, line 1 or 2, no slot read lets him in), the board’s 3+ chance first', () => {
    expect([SOFT_SPOT_MIN_SOG, SOFT_SPOT_MAX_LINE]).toEqual([1.5, 2]);
    const rows = softSpotPlays([
      sk(),
      sk({ id: 2, name: 'Celebrini', pos: 'C', rates: { sog: 4.2 }, p3: 0.69, spot: pf(4) }),
      sk({ id: 3, name: 'Fourth-liner', line: 4, p3: 0.4 }),
      sk({ id: 4, name: 'Low volume', rates: { sog: 1.2 }, p3: 0.2 }),
      sk({ id: 5, name: 'Tough spot', spot: pf(18), p3: 0.5 }),
      sk({ id: 6, name: 'No lineup', line: null, p3: 0.3 }),
      sk({ id: 7, name: 'No chance', p3: null }),
      null,
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Celebrini', 'No lineup', 'Mason Marchment']);
    expect(rows[2].softSpot).toMatchObject({ rank: 3, source: 'propfinder' });
    expect(softSpotPlays(null)).toEqual([]);
  });
});

describe('the rinks: the top-spot badge, the flame for a hot streak only', () => {
  test('a chip in a top-5 spot carries a green "LW #3" badge with the read on its hover, for the rink’s metric', () => {
    const side = { team: 'SJS', opp: 'NYI', venue: 'H', source: 'preview', skaters: [{ ...sk(), number: 84, inLineup: true, line: 1 }], defense: null, propfinder: null, lines: null };
    const html = renderToStaticMarkup(<Rink side={side} teamCount={32} />);
    expect(html).toMatch(/<i class="nhlx-rk-slot is-soft nhlx-rk-top" title="Top-5 soft spot: NYI allows the 3rd most shots to LW over its last 10 games[^"]*"[^>]*>LW #3<\/i>/);
    expect(html).not.toContain('nhlx-pk-flag is-hot'); // not hot: no flame
    const goals = renderToStaticMarkup(<Rink side={side} teamCount={32} metric="g" />);
    expect(goals).not.toContain('nhlx-rk-top');
  });
  test('the flame is the hot streak alone; the line slot is an untinted label', () => {
    expect(flagsFor(sk(), 'sog').some((x) => x.kind === 'hot')).toBe(false);
    expect(flagsFor(sk({ heat: { hotS: true, sogL5: 3.2, games: 5, sogRatio: 1.8 } }), 'sog')[0].title).toMatch(/^Hot: 3.2 shots a game/);
    const lines = { sog: { gp: 13, cells: { LW1: { value: 1.1, rank: 30, of: 32, n: 13 } }, league: { LW1: 1.9 } } };
    const side = { team: 'SJS', opp: 'NYI', venue: 'H', source: 'preview', skaters: [{ ...sk(), number: 84, inLineup: true, line: 1 }], defense: null, propfinder: null, lines };
    const html = renderToStaticMarkup(<Rink side={side} teamCount={32} />);
    expect(html).toMatch(/<i class="nhlx-rk-slot" title="NYI gives up 1.1 shots a game to the LW1, #30 of 32[^"]*descriptive[^"]*">LW1<\/i>/);
  });
});

describe('Best bets: the Soft spots table', () => {
  // eslint-disable-next-line global-require
  const { SoftSpotsTable } = require('@/components/nhl/PicksPanel');
  test('the rows with the spot, his rate and the board’s chances; graded on 3+ once final; twelve then Show all', () => {
    const rows = softSpotPlays([sk({ gameId: 9 }), sk({ id: 2, name: 'Will Smith', pos: 'C', rates: { sog: 2.53 }, p3: 0.47, spot: pf(2), gameId: 9 })]);
    const html = renderToStaticMarkup(<SoftSpotsTable rows={rows} />);
    expect(html).toContain('<b>Soft spots</b>');
    expect(html).toContain('2 regulars facing a top-5 defense at his position on shots');
    expect(html).toMatch(/<b>#2<\/b><small>to C<\/small>/);
    expect(html).toContain('NYI allows the 2nd most shots to C over its last 10 games');
    expect(html).toMatch(/<b>1.74<\/b><small>a game<\/small>/);
    expect(html).toMatch(/<b>27%<\/b><small>\+270<\/small>/);
    expect(html).not.toContain('Show all');
    const done = rows.map((r, i) => ({ ...r, actual: { sog: i === 1 ? 4 : 1, g: 0 } }));
    const graded = renderToStaticMarkup(<SoftSpotsTable rows={done} />);
    expect(graded).toContain('3+ hit 1 of 2');
    expect(graded).toContain('>Got<');
    const many = Array.from({ length: 14 }, (_, i) => ({ ...rows[0], id: 100 + i }));
    expect(renderToStaticMarkup(<SoftSpotsTable rows={many} />)).toContain('Show all 14');
    expect(renderToStaticMarkup(<SoftSpotsTable rows={[]} />)).toBe('');
  });
});
