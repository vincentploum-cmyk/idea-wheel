/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MatchupProfile, traitsOf } from '../components/nhl/MatchupProfile';
import { matchupProfile } from '../lib/nhl-data/matchup-profile';
import { game, rates, pfTeams, shotpropz } from './fixtures/matchup-profile-mtl-dal';

// The card rendered the way the server first paints it, from the MTL @ DAL fixture. With
// MOCK_OUT=<dir> it is also written as a standalone page per theme (the site's CSS and fonts
// inlined) for the mock-up screenshots: tools/mock/screenshot-profile.mjs.
const profile = matchupProfile({ game, rates, pfTeams, shotpropz });
const mark = (abbr) => React.createElement('b', { className: 'nhlx-prof-mark' }, abbr);
const render = () => renderToStaticMarkup(React.createElement(MatchupProfile, { profile, renderTeam: mark }));

describe('MatchupProfile renders', () => {
  test('the heads, then each team\'s strengths and weaknesses: only the extremes, a badge on each line', () => {
    const html = render();
    expect(html).toContain('class="nhlx-prof nhlx-char"');
    expect(html).toContain('Matchup profile');
    expect(html).toContain('Average scoring · 6.0 goals');
    expect(html).toContain('Leaky defense away'); expect(html).toContain('Tight defense at home');
    expect(html).toContain('ShotPropz · 6 away games · Oct 30, 2026');
    expect(html).toContain('aria-label="MTL strengths"'); expect(html).toContain('aria-label="DAL weaknesses"');
    expect(html).not.toMatch(/nhlx-char-badge[^>]*>(Average|Steady)</);
    expect(html).not.toContain('Style of play');
    expect(html).toMatch(/Giving up a lot<small class="nhlx-prof-short">32.5 shots allowed a game<\/small><\/span><span class="nhlx-edge nhlx-char-badge is-tough is-very">Very leaky</);
    expect(html).toMatch(/Taking penalties<small class="nhlx-prof-short">gives 3.3 a game · ≈ 3.0 tonight<\/small><\/span><span class="nhlx-edge nhlx-char-badge is-tough">Undisciplined</);
    expect(html).toContain('Goaltending<small class="nhlx-prof-short">Montembeault .908 · ~26 saves tonight</small>');
    expect(html).toMatch(/Power play<small class="nhlx-prof-short">27.8% · ≈ 3.0 tonight<\/small><\/span><span class="nhlx-edge nhlx-char-badge is-soft">Strong</);
    expect(html).toContain('Nothing stands out'); // DAL has no weakness
    expect(html).toContain('title="32.5 shots · 3.17 goals allowed a game on the road · 3rd of 32 most · ShotPropz 2026-27, Oct 30, 2026');
    expect(html).not.toContain('role="tablist"');
  });
  test('traitsOf: elite / strong / rising a strength, weak / poor / falling a weakness, the most extreme first', () => {
    const mtl = traitsOf(profile.rows, 'MTL');
    expect(mtl.strengths.map((x) => x.key)).toEqual(['saves']);
    expect(mtl.weaknesses.map((x) => [x.key, x.word])).toEqual([['allows', 'Very leaky'], ['discipline', 'Undisciplined']]);
    const dal = traitsOf(profile.rows, 'DAL');
    expect(dal.strengths.map((x) => x.key)).toEqual(['allows', 'saves', 'powerplay', 'discipline']);
    expect(dal.weaknesses).toEqual([]);
    const rows = [{ key: 'last10', label: 'Last 10', cells: { A: { level: 'rising', word: 'Rising' }, B: { level: 'steady', word: 'Steady' } } }];
    expect(traitsOf(rows, 'A').strengths[0]).toMatchObject({ text: 'Shooting more lately (last 10)', word: 'Rising' });
    expect(traitsOf(rows, 'B')).toEqual({ strengths: [], weaknesses: [] });
  });
  test('without a snapshot the head says so', () => {
    const html = renderToStaticMarkup(React.createElement(MatchupProfile, { profile: matchupProfile({ game, rates, pfTeams }), renderTeam: mark }));
    expect(html).toContain('10 stored games · no ShotPropz snapshot yet');
    expect(html).toContain('PropFinder 2026-27');
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
