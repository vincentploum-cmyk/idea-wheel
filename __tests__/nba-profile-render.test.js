/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GameProfile from '../components/nba/NbaProfile';
import { gameProfile } from '../lib/nba/profile';

// The NBA matchup profile as the server first paints it: the NHL card on the NBA's rows. With MOCK_OUT=<dir> it is
// also written as a standalone page (the site's CSS and fonts inlined) in both themes:
// node tools/mock/screenshot-profile.mjs <dir>
const teams = ['CHA', 'WSH', ...Array.from({ length: 28 }, (_, i) => `T${String(i).padStart(2, '0')}`)];
const totals = Object.fromEntries(teams.map((t, i) => [t, {
  for: { gp: 5, pts: 101 + i * 0.5, reb: 40 + (i * 7) % 9, ast: 20.6 + (i * 5) % 8, tpm: 9 + (i * 3) % 7, ftm: 15 + (i * 11) % 9, tov: 12 + (i * 3) % 6 },
  against: { gp: 5, pts: 108.2 + (i * 13) % 12 },
  l10: { against: { gp: 5, pts: 108.2 + (i * 17) % 12 } },
}]));
const defense = { count: 30, totals, leagueFor: { pts: 114.3 } };
const at = (rank) => ({ value: 20, rank, rankBlend: rank, sheet: null });
const sides = {
  CHA: { team: 'CHA', teamProj: { pts: 102 }, out: Array.from({ length: 5 }), allowed: { count: 30, from: 'propfinder', rows: { PG: { pts: at(12), reb: at(3), ast: at(6), tpm: at(20) }, SG: { pts: at(2), reb: at(6), ast: at(6), tpm: at(2) }, SF: { pts: at(15), reb: at(18), ast: at(14), tpm: at(16) }, PF: { pts: at(10), reb: at(3), ast: at(22), tpm: at(25) }, C: { pts: at(24), reb: at(20), ast: at(19), tpm: at(10) } } } },
  WSH: { team: 'WSH', teamProj: { pts: 110 }, out: Array.from({ length: 10 }), allowed: { count: 30, from: 'propfinder', rows: { PG: { pts: at(18), reb: at(13), ast: at(10), tpm: at(14) }, SG: { pts: at(20), reb: at(16), ast: at(21), tpm: at(17) }, SF: { pts: at(14), reb: at(11), ast: at(25), tpm: at(19) }, PF: { pts: at(5), reb: at(22), ast: at(17), tpm: at(23) }, C: { pts: at(26), reb: at(28), ast: at(12), tpm: at(4) } } } },
};
const g = { id: 'g1', away: 'CHA', home: 'WSH', sides, profile: gameProfile({ away: 'CHA', home: 'WSH' }, defense, sides) };
const sport = { teamLogo: () => `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#8899aa"/></svg>')}`, teamName: (t) => ({ CHA: 'Hornets', WSH: 'Wizards' }[t] || t) };
const render = () => renderToStaticMarkup(React.createElement(GameProfile, { g, sport }));

describe('the NBA matchup profile renders', () => {
  test('the NHL card: the expected points, the heads with the defense pill, five rows of a word over a toned line', () => {
    const html = render();
    expect(html).toContain('class="nhlx-prof"');
    expect(html).toContain('212 points expected · CHA 102 · WSH 110');
    expect(html).toContain('this season · green = more points likely, red = fewer');
    expect(html).toContain('5 games · 5 out · PropFinder');
    expect((html.match(/class="nhlx-prof-row is-(?!head)/g) || []).length).toBe(5);
    for (const label of ['Scoring', 'Rebounding', 'Playmaking', 'Allows', 'Soft spots']) expect(html).toContain(`>${label}</div>`);
    // CHA scores the least of thirty: Poor, red, the rank phrase red too.
    expect(html).toMatch(/nhlx-prof-word is-tough is-very[^>]*>Poor</);
    expect(html).toContain('<b class="nhlx-prof-rank is-tough">30th of 30</b>');
    // What CHA gives up: SG #2 on points and threes, PG and PF #3 on rebounds, in green.
    expect(html).toContain('<b class="nhlx-prof-rank is-soft">SG #2</b>');
    expect(html).not.toContain('role="tablist"');
  });
  test('mock-up pages (MOCK_OUT)', () => {
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => {
      const dir = path.join(root, 'node_modules', pkg);
      return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`);
    };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      const page = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NBA profile</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><div class="nhlx-mu-game">${render()}</div></main></body></html>`;
      fs.writeFileSync(path.join(out, `profile-nba-${theme}.html`), page);
    }
    expect(fs.readdirSync(out).filter((f) => f.startsWith('profile-nba-')).length).toBe(2);
  });
});
