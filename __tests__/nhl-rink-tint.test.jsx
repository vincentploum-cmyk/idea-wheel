/**
 * The rink's tint under Shots reads the shot attempts the opponent allows (ICF), not SOG (Vincent, 2026-11-12:
 * "the main driver for shots is ICF, not shots themselves"); SOG only where a source carries no ICF rank.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rink, tintKey } from '@/components/nhl/Rink';

const band = (rank) => ({ season: { gp: 10, sog: 7, g: 0.8, icf: 14 }, rank, source: 'games', teamCount: 32 });

test('tintKey: ICF under Shots, SOG without an ICF rank, goals under Goals', () => {
  expect(tintKey(band({ sog: 30, g: 17, icf: 3 }), 'sog')).toBe('icf');
  expect(tintKey(band({ sog: 30, g: 17 }), 'sog')).toBe('sog');
  expect(tintKey(band({ sog: 30, g: 17, icf: 3 }), 'g')).toBe('g');
  expect(tintKey(null, 'sog')).toBe('sog');
});

test('the ice band is tinted by the ICF rank and labelled with it', () => {
  // SOG #30 (tough) but ICF #3 (soft): the band reads soft.
  const d = band({ sog: 30, g: 17, icf: 3 });
  const defense = Object.fromEntries(['LW', 'C', 'RW', 'D'].map((z) => [z, { ...d, windows: { l10: d } }]));
  const side = { team: 'MTL', opp: 'STL', venue: 'H', source: 'preview', skaters: [], defense, propfinder: null, lines: null };
  const html = renderToStaticMarkup(<Rink side={side} teamCount={32} metric="sog" />);
  const zone = html.match(/<div class="nhlx-rk-zone is-(\w+)"[^>]*><b>LW<\/b><span>(.*?)<\/span>/);
  expect(zone[1]).toBe('soft');
  expect(zone[2].replace(/<[^>]+>/g, '')).toMatch(/^#3 ICF · #17 G/);
});
