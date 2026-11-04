/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import NbaGuide, { GUIDE } from '../components/nba/NbaGuide';

// The NBA cheat sheet (Vincent, 2026-11-04: "Can we have this simplified in a cheat sheet somewhere on the site for nba").
describe('the NBA cheat sheet', () => {
  test('rebounds, assists and threes: what to look at, where on the Games tab, what to ignore', () => {
    const html = renderToStaticMarkup(<NbaGuide />);
    expect(GUIDE.map((g) => g.title)).toEqual(['Rebounds', 'Assists', 'Threes']);
    for (const t of ['Rebounds', 'Assists', 'Threes']) expect(html).toContain(`<h3>${t}</h3>`);
    expect(html).toContain('gives up X reb a game in all');
    expect(html).toContain('3PA allowed · X to PGs · Y in all');
    expect(html).toContain('Teammates out: the biggest lever.');
    expect((html.match(/>Ignore</g) || []).length).toBe(3);
    const out = process.env.MOCK_OUT;
    if (!out) return;
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    fs.mkdirSync(out, { recursive: true });
    for (const theme of ['dark', 'light']) fs.writeFileSync(path.join(out, `guide-nba-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NBA cheat sheet</title><style>${css}
.mock-page { max-width: 1360px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}</section></main></body></html>`);
  });
});
