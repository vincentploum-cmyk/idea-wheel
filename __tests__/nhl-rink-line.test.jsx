/**
 * The rink head's by-line read (Vincent, 2026-10-31: the rank-based "softest line" read beside the raw leader confused,
 * and some teams give their most shots to a second or third line): the slot the opponent gives the most to, its figure,
 * its rank against the league at that slot, and this side's skater there tonight.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rink } from '@/components/nhl/Rink';

const text = (html) => html.match(/<small class="nhlx-rk-line"[^>]*>(.*?)<\/small>/)[1].replace(/<[^>]+>/g, '');
const skaters = [{ id: 7, name: 'Phillip Danault', pos: 'C', line: 3, inLineup: true, opp: 'PIT', venue: 'H' }, { id: 8, name: 'Oliver Kapanen', pos: 'C', line: 1, inLineup: true, opp: 'PIT', venue: 'H' }];
const sideWith = (lines, allows = null) => ({ allows, team: 'MTL', opp: 'PIT', venue: 'H', source: 'preview', skaters, defense: null, propfinder: null, lines });
const soft = { slot: 'C3', value: 1.8, n: 13, rank: 7, of: 32, ratio: 1.15 };
const most = { slot: 'C1', value: 2.9, n: 13, rank: 3, of: 32, ratio: 1.24 };

test('the raw leader with its rank, the skater at that slot; the rank-based softest slot is not named', () => {
  const html = renderToStaticMarkup(<Rink side={sideWith({ sog: { gp: 13, cells: {}, softest: soft, most, league: { C1: 2.35 } } })} teamCount={32} />);
  expect(text(html)).toBe('PIT gives the most shots to the C1 (2.9 a game, #3 at that slot) · tonight Kapanen');
  expect(html).not.toContain('leaks most');
  expect(html).not.toContain('ranks #7');
  expect(html).toContain('the league gives 2.4');
  expect(html).toContain('says where the shots went, not where they will go');
});

test('a second-line leader reads as such; goals read as goals', () => {
  const html = renderToStaticMarkup(<Rink side={sideWith({ sog: { gp: 13, cells: {}, softest: soft, most: { slot: 'C2', value: 3.2, n: 13, rank: 1, of: 32 }, league: {} } })} teamCount={32} />);
  expect(text(html)).toBe('PIT gives the most shots to the C2 (3.2 a game, #1 at that slot)');
  const goals = renderToStaticMarkup(<Rink side={sideWith({ g: { gp: 13, cells: {}, softest: { slot: 'C3', value: 0.31, n: 13, rank: 2, of: 32 }, most: { slot: 'C1', value: 0.38, n: 13, rank: 9, of: 32 }, league: {} } })} teamCount={32} metric="g" />);
  expect(text(goals)).toBe('PIT gives the most goals to the C1 (0.38 a game, #9 at that slot) · tonight Kapanen');
});

// Vincent, 2026-11-10: "rephrase the shooting headline for each team so that I can quickly see if the specific team
// allows shots or not": the verdict first, tinted by the opponent's third this season, then the slot.
const allows = (sog, rank, g = 3.1, rankG = 16) => ({ gp: 17, sog, g, rank: { sog: rank, g: rankG }, of: 32, league: { sog: 27, g: 3.0 } });

test('the verdict leads: a lot / an average number / few, tinted by third, then the slot', () => {
  const lines = { sog: { gp: 13, cells: {}, most, league: {} } };
  const lot = renderToStaticMarkup(<Rink side={sideWith(lines, allows(30.6, 3))} teamCount={32} />);
  expect(text(lot)).toBe('PIT allows a lot of shots · 30.6 a game · #3 of 32 · most to the C1 (2.9 a game, #3 at that slot) · tonight Kapanen');
  expect(lot).toContain('nhlx-rk-verdict is-soft');
  expect(lot).toContain('PIT allows 30.6 shots a game over its 17 games this season, #3 of 32');
  expect(text(renderToStaticMarkup(<Rink side={sideWith(lines, allows(27.1, 16))} teamCount={32} />))).toMatch(/^PIT allows an average number of shots · 27.1 a game · #16 of 32/);
  const few = renderToStaticMarkup(<Rink side={sideWith(lines, allows(24.0, 30))} teamCount={32} />);
  expect(text(few)).toMatch(/^PIT allows few shots · 24.0 a game · #30 of 32/);
  expect(few).toContain('nhlx-rk-verdict is-tough');
});

test('goals read as goals; the verdict stands alone without a slot record; nothing without either', () => {
  const g = renderToStaticMarkup(<Rink side={sideWith(null, allows(30, 3, 3.6, 2))} teamCount={32} metric="g" />);
  expect(text(g)).toBe('PIT allows a lot of goals · 3.60 a game · #2 of 32');
  const thin = { ...allows(30, 3), rank: { sog: null, g: null } };
  expect(renderToStaticMarkup(<Rink side={sideWith(null, thin)} teamCount={32} />)).not.toContain('class="nhlx-rk-line"');
});
