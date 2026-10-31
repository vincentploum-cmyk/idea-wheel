/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchupProfile, LAYOUTS } from '../components/nhl/MatchupProfile';
import { matchupProfile } from '../lib/nhl-data/matchup-profile';
import { game, moneypuck, ratios, profiles, rates, pfTeams, h2h, shotpropz } from './fixtures/matchup-profile-mtl-dal';

// The card rendered the way the server first paints it, in each layout, from the MTL @ DAL fixture.
// With MOCK_OUT=<dir> each layout is also written as a standalone page (the site's CSS and fonts
// inlined, the dark theme) for the mock-up screenshots: tools/mock/screenshot-profile.mjs.
const profile = matchupProfile({ game, moneypuck, ratios, profiles, rates, pfTeams, h2h, shotpropz });
const mark = (abbr) => React.createElement('b', { className: 'nhlx-prof-mark' }, abbr);
const render = (layout, showTabs = true) => renderToStaticMarkup(React.createElement(MatchupProfile, { profile, layout, renderTeam: mark, showTabs }));

describe('MatchupProfile renders', () => {
  test('the profile layout: the heads, the groups, a word over its rank line, the pills, the figures of the game rows', () => {
    const html = render('profile');
    expect(html).toContain('class="nhlx-prof is-profile"');
    expect(html).toContain('Matchup profile');
    expect(html).toContain('Average scoring · 6.0 goals');
    for (const g of ['Attack', 'Defense tonight', 'The game']) expect(html).toContain(`<div class="nhlx-prof-group">${g}</div>`);
    expect(html).toContain('Leaky defense away'); expect(html).toContain('Tight defense at home');
    expect(html).toContain('10 stored games 2026-27 · PropFinder 2026 · ShotPropz 6 away games, Oct 30, 2026');
    expect(html).toContain('>Power play</div>'); expect(html).toContain('>Penalty kill</div>');
    expect(html).toMatch(/nhlx-prof-word is-soft[^>]*>Strong</);
    expect(html).toContain('5th of 32 · 31.2 shots a game · over 10 stored games');
    expect(html).toMatch(/nhlx-prof-word is-tough is-very[^>]*>Elite</);
    expect(html).toContain('<b>LW</b><span>#30</span>');
    expect(html).toContain('<small>GA</small><b>3.0</b>');
    expect(html).toContain('<small>SOG</small><b>32.3</b>');
    // The layout tabs are drawn with the picked one pressed.
    for (const [, label] of LAYOUTS) expect(html).toContain(`>${label}</button>`);
    expect(html).toMatch(/aria-selected="true"[^>]*>Profile</);
    expect(render('profile', false)).not.toContain('role="tablist"');
  });
  test('the sources layout: every source’s figure with its rank in the cell, the word under them', () => {
    const html = render('sources');
    expect(html).toContain('class="nhlx-prof is-sources"');
    expect(html).toContain('<small>Rink</small><b>31.2</b><i>#5</i>');
    expect(html).toContain('<small>PF</small><b>25.1</b><i>#30</i>');
    expect(html).toContain('<small>Rink home</small><b>24.2</b><i>#31</i>');
    expect(html).toContain('<small>SPZ home</small><b>24.3</b><i>#31</i>');
    expect(html).toContain('<small>PK%</small><b>92.9</b><i>#32</i>');
    expect(html).toMatch(/nhlx-prof-word is-tough is-very is-small[^>]*>Elite</);
    // No rank line in the cell; it rides on the hover.
    expect(html).not.toContain('5th of 32 · 31.2 shots a game · over 10 stored games</span>');
    expect(html).toContain('title="5th of 32 · 31.2 shots a game · over 10 stored games · PropFinder 31.0 (6th) · MoneyPuck 30.1 per 60 (7th) · ShotPropz on the road 29.7 (9th of 32, 6 games) · last 10 32.4 (4th)"');
  });
  test('the tape layout: the figure first, the label in the middle, the away cell mirrored', () => {
    const html = render('tape');
    expect(html).toContain('class="nhlx-prof is-tape"');
    expect(html).toContain('<b class="nhlx-prof-value">31.2</b><small class="nhlx-prof-unit">shots/G</small>');
    expect(html).toMatch(/<div class="nhlx-prof-cell is-away" title="5th of 32[^"]*">.*?<div class="nhlx-prof-label" title="[^"]+">Shot volume<\/div>.*?<div class="nhlx-prof-cell is-home" title="17th of 32/s);
    expect(html).toContain('<div class="nhlx-prof-label is-head">at</div>');
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
    for (const [layout] of LAYOUTS) {
      for (const theme of ['dark', 'light']) {
        const page = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Matchup profile · ${layout}</title><style>${css}
.nhlx-prof-mark { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 24px; padding: 0 6px; border-radius: 6px; background: var(--bg-tint); color: var(--heading); font-size: 13px; font-weight: 700; }
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><div class="nhlx-mu"><article class="nhlx-mu-game is-first">${head}${render(layout)}${numbers}</article></div></main></body></html>`;
        fs.writeFileSync(path.join(out, `profile-${layout}-${theme}.html`), page);
      }
    }
    expect(fs.readdirSync(out).filter((f) => f.endsWith('.html')).length).toBeGreaterThanOrEqual(LAYOUTS.length * 2);
  });
});
