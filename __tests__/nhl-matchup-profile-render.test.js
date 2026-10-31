/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchupProfile } from '../components/nhl/MatchupProfile';
import { matchupProfile } from '../lib/nhl-data/matchup-profile';
import { game, rates, pfTeams, shotpropz } from './fixtures/matchup-profile-mtl-dal';

// The card rendered the way the server first paints it, from the MTL @ DAL fixture. With
// MOCK_OUT=<dir> it is also written as a standalone page per theme (the site's CSS and fonts
// inlined) for the mock-up screenshots: tools/mock/screenshot-profile.mjs.
const profile = matchupProfile({ game, rates, pfTeams, shotpropz });
const mark = (abbr) => React.createElement('b', { className: 'nhlx-prof-mark' }, abbr);
const render = () => renderToStaticMarkup(React.createElement(MatchupProfile, { profile, renderTeam: mark }));

describe('MatchupProfile renders', () => {
  test('the heads, five rows, a word over one line, every source in the hover', () => {
    const html = render();
    expect(html).toContain('class="nhlx-prof"');
    expect(html).toContain('Matchup profile');
    expect(html).toContain('Average scoring · 6.0 goals');
    expect(html).toContain('Leaky defense away'); expect(html).toContain('Tight defense at home');
    expect(html).toContain('ShotPropz · 6 away games · Oct 30, 2026');
    for (const label of ['Shooting', 'Allows', 'Saves', 'Power play', 'Penalty kill', 'Last 10']) expect(html).toContain(`>${label}</div>`);
    expect((html.match(/class="nhlx-prof-row is-(?!head)/g) || []).length).toBe(6);
    expect(html).toContain('>Saves</div>');
    expect(html).toContain('~27 saves expected · 29.5 shots faced · Montembeault likely · .908 over 7 starts</span>');
    expect(html).toMatch(/nhlx-prof-word is-soft[^>]*>Strong</);
    expect(html).toMatch(/nhlx-prof-word is-tough is-very[^>]*>Elite</);
    expect(html).toContain('<span class="nhlx-prof-detail"><span>29.7 shots · 2.83 goals a game on the road (6 games) · </span><span>9th of 32 in shots</span></span>');
    expect(html).toContain('<b class="nhlx-prof-rank is-tough">31st of 32 most</b>');
    expect(html).toContain('<b class="nhlx-prof-rank is-soft">3rd of 32 softest</b>');
    expect(html).toContain('title="ShotPropz 2026-27, Oct 30, 2026 · ShotPropz on the road: 29.7 shots (9th of 32)');
    expect(html).not.toContain('role="tablist"');
  });
  test('without a snapshot the head says so', () => {
    const html = renderToStaticMarkup(React.createElement(MatchupProfile, { profile: matchupProfile({ game, rates, pfTeams }), renderTeam: mark }));
    expect(html).toContain('10 stored games · no ShotPropz snapshot yet');
    expect(html).toContain('PropFinder 2026-27</span>');
  });
  test('nothing without a profile', () => {
    expect(renderToStaticMarkup(React.createElement(MatchupProfile, { profile: null }))).toBe('');
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
    const head = '<div class="nhlx-mu-game-head"><b class="nhlx-prof-mark">MTL</b><b>MTL @ DAL</b><b class="nhlx-prof-mark">DAL</b><small>7:00 PM</small></div>';
    const numbers = '<details class="nhlx-mu-numbers"><summary>The numbers behind the reads</summary></details>';
    for (const theme of ['dark', 'light']) {
      const page = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Matchup profile</title><style>${css}
.nhlx-prof-mark { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 24px; padding: 0 6px; border-radius: 6px; background: var(--bg-tint); color: var(--heading); font-size: 13px; font-weight: 700; }
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><div class="nhlx-mu"><article class="nhlx-mu-game is-first">${head}${render()}${numbers}</article></div></main></body></html>`;
      fs.writeFileSync(path.join(out, `profile-${theme}.html`), page);
    }
    expect(fs.readdirSync(out).filter((f) => /^profile-(dark|light)\.html$/.test(f)).length).toBe(2);
  });
});
