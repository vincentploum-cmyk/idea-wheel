/**
 * The rink's tint (Vincent, 2026-11-12, graded in tools/predictors/shots_env.py): under Shots the opponent's Shots/G,
 * ICF/G and IFF/G ranks weighted 2 : 1 : 1 (ISCF/G added nothing to shots); under Goals its ISCF/G rank (Goals/G
 * predicted nothing), Goals/G only where a source has no ISCF.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Rink, tintRank } from '@/components/nhl/Rink';
import { shotsEnvRank, shotsEnvText, goalsEnvRank } from '@/lib/nhl-data/propfinder-csv';

const band = (rank) => ({ season: { gp: 10, sog: 7, g: 0.8, icf: 14, iff: 12, iscf: 7 }, rank, source: 'games', teamCount: 32 });

test('shotsEnvRank: Shots x2 + ICF + IFF over the ranks the source carries; goalsEnvRank: ISCF, else goals', () => {
  // The Blues' LW on their L10 tab, 2026-11-12: Shots #11, ICF #5, IFF #4, ISCF #13 → (22 + 5 + 4) / 4.
  expect(shotsEnvRank({ sog: 11, icf: 5, iff: 4, iscf: 13, g: 17 })).toBe(7.8);
  expect(shotsEnvRank({ sog: 30, g: 17 })).toBe(30);
  expect(shotsEnvRank({ icf: 6, iff: 8 })).toBe(7);
  expect(shotsEnvRank({ g: 3, iscf: 2 })).toBeNull();
  expect(shotsEnvRank(null)).toBeNull();
  expect(shotsEnvText({ sog: 11, icf: 5, iff: 4, iscf: 13 })).toBe('Shots #11 ×2 · ICF #5 · IFF #4');
  expect(goalsEnvRank({ g: 26, iscf: 28 })).toBe(28);
  expect(goalsEnvRank({ g: 26 })).toBe(26);
  expect(goalsEnvRank(null)).toBeNull();
});

test('tintRank: the shots blend under Shots, the ISCF rank under Goals', () => {
  expect(tintRank(band({ sog: 21, icf: 29, iff: 29, iscf: 28, g: 26 }), 'sog')).toBe(25);
  expect(tintRank(band({ sog: 21, icf: 29, iff: 29, iscf: 28, g: 26 }), 'g')).toBe(28);
});

test('the ice band is tinted by the shots environment and labelled with it', () => {
  // SOG #20 alone would read mid; with ICF #3 and IFF #1 the blend is (40 + 3 + 1) / 4 = #11, the soft third.
  const d = band({ sog: 20, icf: 3, iff: 1, iscf: 5, g: 17 });
  const defense = Object.fromEntries(['LW', 'C', 'RW', 'D'].map((z) => [z, { ...d, windows: { l10: d } }]));
  const side = { team: 'MTL', opp: 'STL', venue: 'H', source: 'preview', skaters: [], defense, propfinder: null, lines: null };
  const html = renderToStaticMarkup(<Rink side={side} teamCount={32} metric="sog" />);
  const zone = html.match(/<div class="nhlx-rk-zone is-(\w+)"[^>]*title="([^"]*)"[^>]*><b>LW<\/b><span>(.*?)<\/span>/);
  expect(zone[1]).toBe('soft');
  expect(zone[3].replace(/<[^>]+>/g, '')).toMatch(/^#11 shots · #5 ISCF/);
  expect(zone[2]).toContain('Shots #20 ×2 · ICF #3 · IFF #1');
  const goals = renderToStaticMarkup(<Rink side={side} teamCount={32} metric="g" />).match(/<div class="nhlx-rk-zone is-(\w+)"[^>]*><b>LW<\/b>/);
  expect(goals[1]).toBe('soft'); // ISCF #5, whatever the goals rank (#17)
});
