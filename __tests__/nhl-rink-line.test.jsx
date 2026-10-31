/**
 * The rink head's by-line read (Vincent, 2026-10-31, of PIT: "leaks most to the C3" on a #7 rank at 1.8 shots while
 * the C1 took 2.9 a game): the line says rank, names the slot the opponent gives the most to beside it when that is
 * another slot, and the skater at the softest slot tonight.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rink } from '@/components/nhl/Rink';

const text = (html) => html.match(/<small class="nhlx-rk-line"[^>]*>(.*?)<\/small>/)[1].replace(/<[^>]+>/g, '');
const sideWith = (lines) => ({ team: 'MTL', opp: 'PIT', venue: 'H', source: 'preview', skaters: [{ id: 7, name: 'Phillip Danault', pos: 'C', line: 3, inLineup: true, opp: 'PIT', venue: 'H' }], defense: null, propfinder: null, lines });
const soft = { slot: 'C3', value: 1.8, n: 13, rank: 7, of: 32, ratio: 1.15 };

test('rank first, the raw leader beside it, the skater at the softest slot', () => {
  const html = renderToStaticMarkup(<Rink side={sideWith({ sog: { gp: 13, cells: {}, softest: soft, most: { slot: 'C1', value: 2.9, n: 13, rank: 3, of: 32, ratio: 1.24 }, league: {} } })} teamCount={32} />);
  expect(text(html)).toBe('PIT ranks #7 of 32 against the C3 · 1.8 shots a game · most shots to the C1, 2.9 · tonight Danault');
  expect(html).not.toContain('leaks most');
  expect(html).toContain('a first line shoots the most against everyone, so the rank is the read');
});

test('one slot when the softest slot is also the busiest; goals read as goals', () => {
  const html = renderToStaticMarkup(<Rink side={sideWith({ sog: { gp: 13, cells: {}, softest: soft, most: { ...soft }, league: {} }, g: { gp: 13, cells: {}, softest: { slot: 'C3', value: 0.31, n: 13, rank: 2, of: 32 }, most: { slot: 'C1', value: 0.38, n: 13, rank: 9, of: 32 }, league: {} } })} teamCount={32} />);
  expect(text(html)).toBe('PIT ranks #7 of 32 against the C3 · 1.8 shots a game · tonight Danault');
  const goals = renderToStaticMarkup(<Rink side={sideWith({ g: { gp: 13, cells: {}, softest: { slot: 'C3', value: 0.31, n: 13, rank: 2, of: 32 }, most: { slot: 'C1', value: 0.38, n: 13, rank: 9, of: 32 }, league: {} } })} teamCount={32} metric="g" />);
  expect(text(goals)).toBe('PIT ranks #2 of 32 against the C3 · 0.31 goals a game · most goals to the C1, 0.38 · tonight Danault');
});
