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

// The NBA game profile as the server first paints it: the Offense view, five rows, a word and one short figure a cell.
// With MOCK_OUT=<dir> it is also written as a standalone page (the site's CSS and fonts inlined) in both themes, for a
// look at 1440 and 390 wide: node tools/mock/screenshot-profile.mjs <dir>
const teams = ['CHA', 'WSH', ...Array.from({ length: 28 }, (_, i) => `T${String(i).padStart(2, '0')}`)];
const totals = Object.fromEntries(teams.map((t, i) => [t, {
  for: { gp: 5, pts: 101 + i * 0.5, reb: 40 + (i * 7) % 9, ast: 20.6 + (i * 5) % 8, tpm: 9 + (i * 3) % 7, ftm: 15 + (i * 11) % 9 },
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

describe('the NBA game profile renders', () => {
  test('the offense view first: the toggle, the expected points, five rows of a word and a short figure', () => {
    const html = render();
    expect(html).toMatch(/aria-selected="true"[^>]*>Offense</);
    expect(html).toContain('>Defense</button>');
    expect(html).toContain('212 points expected · CHA 102 · WSH 110');
    expect((html.match(/<th scope="row"/g) || []).length).toBe(5);
    for (const label of ['Scoring', 'Threes', 'Rebounding', 'Assists', 'Free throws']) expect(html).toContain(`>${label}</th>`);
    expect(html).toMatch(/class="ir-prof-word is-down is-very">Very weak<\/span><small>101\.0 a game · 30th<\/small>/);
    expect(html).not.toContain('Gives up points to');
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
    const views = { offense: render(), defense: renderToStaticMarkup(React.createElement(GameProfile, { g, sport, initial: 'defense' })) };
    for (const [view, body] of Object.entries(views)) {
      for (const theme of ['dark', 'light']) {
        const page = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NBA profile · ${view}</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><div class="nhlx-mu-game">${body}</div></main></body></html>`;
        fs.writeFileSync(path.join(out, `profile-nba-${view}-${theme}.html`), page);
      }
    }
    expect(fs.readdirSync(out).filter((f) => f.startsWith('profile-nba-')).length).toBe(4);
  });
});
