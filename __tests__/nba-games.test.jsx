/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NbaGames, NbaStatList, tierRows, spreadFor } from '../components/nba/NbaGames';

// The NBA page in the NFL's layout (Vincent, 2026-11-01: "for nba, I need the same layout as nfl with as addition the
// propfinder tables for each game when clicking on the game"): the games as a sportsbook lists them, an opened game on
// PropFinder's tables for both teams and the players' strong / lean / thin ladders, the same ladders across the night.

const table = (pts) => ({ count: 30, rows: { PG: { gp: 6, pts: { value: pts, rank: 3, sheet: 4 }, reb: { value: 5.1, rank: 20 } }, C: { gp: 6, pts: { value: 18.2, rank: 25 }, reb: { value: 14.4, rank: 2 } } }, league: { PG: { pts: 21.0, reb: 5.5 }, C: { pts: 19.0, reb: 12.0 } },
  windows: { l10: { count: 30, rows: { PG: { gp: 6, pts: { value: pts + 1, rank: 2 } }, C: { gp: 6, pts: { value: 17, rank: 27 } } } } } });
const player = (key, name, pos, exp, lines) => ({ key, player: name, pos, envPos: pos, ranges: { pts: { exp, floor: exp - 5, ceiling: exp + 5 } }, ladders: { pts: lines.map(([line, p]) => ({ line, p })) } });
const board = {
  date: '2026-11-01', season: 2026,
  games: [{
    id: 'g1', away: 'LAL', home: 'DEN', date: '2026-11-01T23:00:00Z', final: false, state: 'pre', odds: { spread: 'DEN -2.5', total: 228.5 },
    sides: {
      LAL: { team: 'LAL', opp: 'DEN', venue: 'A', out: [{ name: 'Gabe Vincent', status: 'Out' }], allowed: table(24.1), players: [player('austin reaves', 'Austin Reaves', 'PG', 21.4, [[17.5, 0.72], [21.5, 0.5], [24.5, 0.38]])] },
      DEN: { team: 'DEN', opp: 'LAL', venue: 'H', out: [], allowed: table(22.0), players: [player('nikola jokic', 'Nikola Jokic', 'C', 29.6, [[24.5, 0.75], [27.5, 0.6], [31.5, 0.42]])] },
    },
  }],
};
// The shuffle's payload for points (heights 10 … 35; a height h clears the line h − 0.5), the chance at each height.
const heights = Array.from({ length: 26 }, (_, i) => i + 10);
const chance = (exp) => heights.map((h) => ({ p: Math.max(0.02, Math.min(0.98, 0.5 + (exp - h) * 0.06)) }));
const shuffles = { pts: { market: 'pts', heights, players: [
  { key: 'austin reaves', player: 'Austin Reaves', team: 'LAL', opp: 'DEN', venue: 'A', game: 'g1', pos: 'PG', health: 'In', exp: 21.4, at: chance(21.4) },
  { key: 'nikola jokic', player: 'Nikola Jokic', team: 'DEN', opp: 'LAL', venue: 'H', game: 'g1', pos: 'C', health: 'In', exp: 29.6, at: chance(29.6) },
  { key: 'out man', player: 'Out Man', team: 'DEN', opp: 'LAL', venue: 'H', game: 'g1', pos: 'SG', health: 'Out', exp: 12, at: chance(12) },
] } };

describe('the NBA games, the NFL’s layout', () => {
  test('the spread as the book writes it on each row', () => {
    expect(spreadFor({ spread: 'DEN -2.5' }, 'DEN')).toBe('-2.5');
    expect(spreadFor({ spread: 'DEN -2.5' }, 'LAL')).toBe('+2.5');
    expect(spreadFor({ spread: 'UTAH -6' }, 'UTAH')).toBe('-6');
    expect(spreadFor({ spread: 'EVEN' }, 'DEN')).toBe('PK');
    expect(spreadFor({}, 'DEN')).toBeNull();
  });
  test('the ladders: round marks off the shuffle at 70 / 55 / 40%, the highest projection first, the out left off', () => {
    const rows = tierRows(board, shuffles, 'pts', 'g1');
    expect(rows.map((r) => r.player)).toEqual(['Nikola Jokic', 'Austin Reaves']);
    const j = rows[0];
    // Points by 5: at 29.6 projected, 25+ clears 70% (0.5 + 4.6 × 0.06 = 0.776), 30+ 55% no (0.476) …
    expect([j.strong?.mark, j.lean?.mark, j.thin?.mark]).toEqual(['25+', undefined, '30+']);
    expect(j.envPos).toBe('C');
    // Before the shuffle loads, the book's rungs stand in.
    const book = tierRows(board, {}, 'pts', 'g1');
    expect(book.find((r) => r.player === 'Nikola Jokic').strong).toMatchObject({ mark: '25+', p: 0.75 });
  });
  test('an opened game: the sportsbook rows, PropFinder’s table for both teams opening on L10, the players’ ladders', () => {
    const html = renderToStaticMarkup(<NbaGames board={board} shuffles={shuffles} openFirst />);
    expect(html).toContain('Lakers');
    expect(html).toContain('Nuggets');
    expect(html).toMatch(/>-2\.5</);
    expect(html).toMatch(/>\+2\.5</);
    expect(html).toContain('O 228.5');
    expect(html).toContain('What DEN gives up per game, by position');
    expect(html).toContain('What LAL gives up per game, by position');
    expect(html).toMatch(/aria-selected="true"[^>]*>L10</);
    expect(html).toContain('Gabe Vincent');
    expect(html).toContain('Nikola Jokic');
    expect(html).toContain('25+ pts');
    expect(html).toContain('Strong');
    expect(html).not.toContain('Out Man');
    expect(html).not.toMatch(/\bEV\b|edge|juice/i);
    // With MOCK_OUT=<dir> the opened game is written as standalone pages (dark, light) for a screenshot at 1440 and 390.
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `games-nba-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NBA games</title><style>${css}
.mock-page { max-width: 1360px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}</section></main></body></html>`);
    }
  });
  test('closed by default; the stat tab lists the night', () => {
    const closed = renderToStaticMarkup(<NbaGames board={board} shuffles={shuffles} />);
    expect(closed).not.toContain('What DEN gives up');
    const list = renderToStaticMarkup(<NbaStatList board={board} shuffles={shuffles} market="pts" />);
    expect(list.indexOf('Nikola Jokic')).toBeLessThan(list.indexOf('Austin Reaves'));
    expect(list).toContain('@ DEN');
    expect(list).toContain('vs LAL');
  });
});
