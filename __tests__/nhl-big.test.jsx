/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NHL_BIG, nhlBigGames, bigWhy } from '../lib/nhl-data/big-pure';
import { poissonAtLeast } from '../lib/nhl-data/picks-pure';
import { calibratedChance } from '../lib/nhl-data/calibration-pure';
import { HEIGHTS } from '../lib/nhl-data/shuffle-pure';
import { BigRows } from '../components/nhl/BigGamesPanel';

// The NHL's big games (Vincent, 2026-11-01: "Do the same big games study for the NHL"; docs/audits/2026-11-01-nhl-big-games.md):
// the board's own chance at 5+ / 6+ shots and 2+ goals, as the shuffle prints it.
const cleared = (sog, g, n) => ({ sog: HEIGHTS.sog.map((h) => sog.filter((x) => x >= h).length), g: HEIGHTS.g.map((h) => g.filter((x) => x >= h).length), n });
const skater = (id, name, lamS, lamG, extra = {}) => ({
  id, name, team: 'EDM', opp: 'CGY', venue: 'H', pos: 'C', line: 'C1', lamS, lamG,
  own: { cleared: { l10: cleared([6, 5, 2, 3, 4, 5, 1, 2, 3, 7], [2, 0, 1, 0, 0, 0, 1, 0, 0, 0], 10), season: cleared([6, 5, 2, 3, 4, 5, 1, 2, 3, 7, 4, 5], [2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1], 12) } },
  ...extra,
});
const payload = (extra = {}) => ({
  date: '2026-11-01',
  games: [{ id: 1, away: 'CGY', home: 'EDM', startTimeUTC: '2026-11-02T02:00:00Z', final: false, skaters: [skater(97, 'Connor McDavid', 3.9, 0.62), skater(29, 'Leon Draisaitl', 3.1, 0.55), skater(2, 'Depth Defenseman', 1.2, 0.05)] }],
  ...extra,
});

describe('NHL big games: the read', () => {
  test('the board’s chance at each mark, the likeliest first, a skater under the market’s λ floor left off', () => {
    const big = nhlBigGames(payload());
    expect(Object.keys(NHL_BIG)).toEqual(['sog', 'g']);
    const mc = big.rows['97|sog'];
    expect(mc.p[5]).toBeCloseTo(poissonAtLeast(3.9, 5), 3);
    expect(mc.p[6]).toBeLessThan(mc.p[5]);
    expect(mc.calibrated).toBe(false);
    expect(big.lists.sog).toEqual(['97|sog', '29|sog']);
    expect(big.rows['2|sog']).toBeUndefined();
    expect(big.rows['2|g']).toBeUndefined();
    expect(big.lists.g[0]).toBe('97|g');
    expect(big.rows['97|g'].p[2]).toBeCloseTo(poissonAtLeast(0.62, 2), 3);
    // How often he has done it: 5+ in 4 of his last 10, 5 of 12 this season.
    expect(bigWhy(mc)).toBe('5+ in 4 of his last 10 · 5 of 12 this season');
    expect(bigWhy(big.rows['97|g'])).toBe('2+ in 1 of his last 10 · 1 of 12 this season');
  });

  test('through the calibration the board prints with, the stated tail beside it', () => {
    const fits = { sog: { 5: { n: 5000, hits: 400, a: 0.2, b: 0.9 }, 6: { n: 5000, hits: 150, a: 0.25, b: 0.9 } }, g: { 2: { n: 5000, hits: 100, a: 0.1, b: 0.95 } } };
    const big = nhlBigGames(payload({ calibration: { fits } }));
    const mc = big.rows['97|sog'];
    expect(mc.calibrated).toBe(true);
    expect(mc.p[5]).toBeCloseTo(calibratedChance(fits, 'sog', 3.9, 5), 3);
    expect(mc.raw[5]).toBeCloseTo(poissonAtLeast(3.9, 5), 3);
    expect(mc.p[5]).not.toBeCloseTo(mc.raw[5], 3);
  });

  test('graded once final: hit at the mark or not, DNP for a skater without a row', () => {
    const p = payload();
    p.games[0].final = true;
    p.games[0].skaters[0].actual = { sog: 6, g: 1 };
    p.games[0].skaters[1].actual = null;
    const big = nhlBigGames(p);
    expect(big.rows['97|sog'].got).toEqual({ 5: true, 6: true });
    expect(big.rows['97|g'].got).toEqual({ 2: false });
    expect(big.rows['29|sog'].actual).toBeNull();
    expect(big.rows['29|sog'].got).toBeNull();
  });
});

describe('NHL big games: the table', () => {
  test('the marks, the projection, how often he has done it, the name opening his card', () => {
    const big = nhlBigGames(payload());
    const html = renderToStaticMarkup(<BigRows big={big} market="sog" onOpen={() => {}} />);
    expect(html).toContain('Connor McDavid');
    expect(html).toContain('>5+<');
    expect(html).toContain('>6+<');
    expect(html).toContain('3.9');
    expect(html).toContain('5+ in 4 of his last 10');
    expect(html.indexOf('Connor McDavid')).toBeLessThan(html.indexOf('Leon Draisaitl'));
    expect(html).not.toContain('Got');
    const empty = renderToStaticMarkup(<BigRows big={{ rows: {}, lists: { sog: [] } }} market="sog" onOpen={() => {}} />);
    expect(empty).toContain('No big-game candidate');
  });

  test('mock-up pages (MOCK_OUT)', () => {
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    const p = payload();
    const names = ['Nathan MacKinnon', 'Auston Matthews', 'David Pastrnak', 'Jack Eichel', 'Kirill Kaprizov', 'Nikita Kucherov', 'Brady Tkachuk', 'Matthew Tkachuk'];
    names.forEach((n, i) => p.games[0].skaters.push(skater(100 + i, n, 3.6 - i * 0.2, 0.5 - i * 0.03, { team: i % 2 ? 'CGY' : 'EDM', opp: i % 2 ? 'EDM' : 'CGY', venue: i % 2 ? 'A' : 'H', line: ['C1', 'RW1', 'LW1', 'C2'][i % 4] })));
    const big = nhlBigGames(p);
    const tabs = '<div class="nhlx-tabs is-pills is-small" role="tablist"><button class="nhlx-tab is-active">Shots<i>9</i></button><button class="nhlx-tab">Goals<i>8</i></button></div>';
    for (const theme of ['dark', 'light']) {
      const page = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Big games</title><style>${css}
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk"><div class="ir-overview">${tabs}${renderToStaticMarkup(<BigRows big={big} market="sog" onOpen={() => {}} />)}</div></section></main></body></html>`;
      fs.writeFileSync(path.join(out, `big-nhl-${theme}.html`), page);
    }
  });
});
