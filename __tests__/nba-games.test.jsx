/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NbaGames, NbaStatList, DefenseBlock, tierRows, spreadFor } from '../components/nba/NbaGames';

// The NBA page in the NFL's layout (Vincent, 2026-11-01: "for nba, I need the same layout as nfl with as addition the
// propfinder tables for each game when clicking on the game"): the games as a sportsbook lists them, an opened game on
// PropFinder's tables for both teams and the players' strong / lean / thin ladders, the same ladders across the night.

const table = (pts) => ({ count: 30, rows: { PG: { gp: 6, pts: { value: pts, rank: 3, sheet: 4 }, reb: { value: 5.1, rank: 20 } }, C: { gp: 6, pts: { value: 18.2, rank: 25 }, reb: { value: 14.4, rank: 2 } } }, league: { PG: { pts: 21.0, reb: 5.5 }, C: { pts: 19.0, reb: 12.0 } },
  windows: { l10: { count: 30, rows: { PG: { gp: 6, pts: { value: pts + 1, rank: 2 } }, C: { gp: 6, pts: { value: 17, rank: 27 } } } } } });
const player = (key, name, pos, exp, lines) => ({ key, player: name, pos, envPos: pos, ranges: { pts: { exp, floor: exp - 5, ceiling: exp + 5 } }, ladders: { pts: lines.map(([line, p]) => ({ line, p })) } });
const board = {
  date: '2026-11-01', season: 2026,
  // RotoWire's lineups (lib/nba/rotowire.js): LAL's five confirmed, DEN's expected.
  lineups: { at: '2026-11-01T22:40:00Z', source: 'rotowire', teams: { LAL: { status: 'confirmed', starters: [{ pos: 'SF', name: 'LeBron James' }], mayNotPlay: [] }, DEN: { status: 'expected', starters: [], mayNotPlay: [] } } },
  games: [{
    id: 'g1', away: 'LAL', home: 'DEN', date: '2026-11-01T23:00:00Z', final: false, state: 'pre', odds: { spread: 'DEN -2.5', total: 228.5 },
    sides: {
      LAL: { team: 'LAL', opp: 'DEN', venue: 'A', teamProj: { pts: 114.2 }, out: [{ name: 'Gabe Vincent', status: 'Out' }], allowed: table(24.1), players: [player('austin reaves', 'Austin Reaves', 'PG', 21.4, [[17.5, 0.72], [21.5, 0.5], [24.5, 0.38]])] },
      DEN: { team: 'DEN', opp: 'LAL', venue: 'H', teamProj: { pts: 118.6 }, out: [], allowed: table(22.0), players: [player('nikola jokic', 'Nikola Jokic', 'C', 29.6, [[24.5, 0.75], [27.5, 0.6], [31.5, 0.42]])] },
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
  test('before the shuffle loads, a player with no rung at 40% stays listed on his projection (no ReferenceError)', () => {
    // 2026-11-07: /nba#reb on the previous night broke the page — the book's-rungs fallback (ladderBoard) read an
    // undefined `keepAll` whenever a player had no rung at the thin floor.
    const lb = JSON.parse(JSON.stringify(board));
    lb.games[0].final = true;
    lb.games[0].sides.LAL.players.push(player('bench guy', 'Bench Guy', 'SG', 3.1, [[9.5, 0.12]]));
    lb.games[0].sides.LAL.players.push({ key: 'no line', player: 'No Line', pos: 'SF', envPos: 'SF', ranges: { pts: { exp: 6.2 } }, ladders: {} });
    const rows = tierRows(lb, {}, 'pts');
    expect(rows.map((r) => r.player)).toEqual(['Nikola Jokic', 'Austin Reaves', 'No Line', 'Bench Guy']);
    expect(rows.find((r) => r.player === 'Bench Guy')).toMatchObject({ strong: null, lean: null, thin: null, proj: 3.1 });
    expect(() => renderToStaticMarkup(<NbaStatList board={lb} shuffles={{}} market="pts" />)).not.toThrow();
  });
  test('the w/o edge tag: the widest flagged line of the stat on his row, the record against the price', () => {
    const wb = JSON.parse(JSON.stringify(board));
    const reaves = wb.games[0].sides.LAL.players[0];
    reaves.plays = [
      { id: 'a', market: 'pts', line: 17.5, side: 'over', without: { names: ['Vincent'], edge: { rate: 0.8, hits: 16, n: 20, implied: 0.6, gap: 0.2 } } },
      { id: 'b', market: 'pts', line: 21.5, side: 'over', without: { names: ['Vincent'], edge: { rate: 0.76, hits: 19, n: 25, implied: 0.5, gap: 0.26 } } },
      { id: 'c', market: 'reb', line: 4.5, side: 'over', without: { names: ['Vincent'], edge: { rate: 0.9, hits: 18, n: 20, implied: 0.5, gap: 0.4 } } },
    ];
    const rows = tierRows(wb, shuffles, 'pts', 'g1');
    expect(rows.find((r) => r.player === 'Austin Reaves').woEdge).toMatchObject({ line: 21.5, side: 'over', rate: 0.76, implied: 0.5, names: ['Vincent'] });
    expect(rows.find((r) => r.player === 'Nikola Jokic').woEdge).toBeNull();
    const html = renderToStaticMarkup(<NbaGames board={wb} shuffles={shuffles} openFirst />);
    expect(html).toContain('w/o edge o21.5 · 76% vs 50%');
    expect(html).toContain('Without Vincent he cleared o21.5 in 19 of 25 games (76%)');
  });
  test('an opened game: the sportsbook rows, PropFinder’s table for both teams opening on L10, the players’ ladders', () => {
    const html = renderToStaticMarkup(<NbaGames board={board} shuffles={shuffles} openFirst />);
    expect(html).toContain('Lakers');
    expect(html).toContain('Nuggets');
    expect(html).toMatch(/>-2\.5</);
    expect(html).toMatch(/>\+2\.5</);
    expect(html).toContain('O 228.5');
    expect(html).toContain('Model: LAL 114 – DEN 119 · total 233');   // grey, information only: no green on the boxes
    expect(html).toContain('✓ Lineup confirmed');
    expect(html).toContain('Expected lineup');
    expect(html).toContain('What DEN gives up per game, by position');
    expect(html).toContain('What LAL gives up per game, by position');
    expect(html).toMatch(/aria-selected="true"[^>]*>L10</);
    expect(html).toContain('Gabe Vincent');
    expect(html).toContain('Nikola Jokic');
    expect(html).toContain('25+ pts');
    expect(html).toContain('Strong');
    expect(html).not.toContain('Out Man');
    expect(html).not.toMatch(/\bEV\b|edge|juice/i);
    // Each defense's table first, the players who face it under it (Vincent, 2026-11-01): DEN's table, LAL's players, then LAL's table, DEN's players.
    const at = (t) => html.indexOf(t);
    expect(at('What DEN gives up')).toBeLessThan(at('Austin Reaves'));
    expect(at('Austin Reaves')).toBeLessThan(at('What LAL gives up'));
    expect(at('What LAL gives up')).toBeLessThan(at('Nikola Jokic'));
    expect(html).toContain('Nuggets defense');
    for (const pos of ['All', 'PG', 'SG', 'SF', 'PF', 'C']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>${pos}<`));
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
  test('threes: the 3PA column in the table, the threes attempted allowed at the position and in all (Vincent, 2026-11-03)', () => {
    const threes = (tpm, tpa, rk) => ({ gp: 10, pts: { value: 22, rank: 10 }, tpm: { value: tpm, rank: rk }, tpa: { value: tpa, rank: rk } });
    const allowed = { count: 30, rows: { PG: threes(3.1, 8.4, 4), SG: threes(2.6, 7.1, 18), C: threes(0.6, 1.9, 22) }, league: { PG: { tpm: 2.7, tpa: 7.6 }, SG: { tpm: 2.5, tpa: 7.0 }, C: { tpm: 0.7, tpa: 2.1 } } };
    const side = { team: 'DEN', opp: 'LAL', venue: 'H', out: [], allowed, against: { gp: 10, stats: { tpm: { value: 14.2, rank: 6, count: 30, league: 13.1, l10: 14.8 }, tpa: { value: 39.5, rank: 3, count: 30, league: 35.2, l10: 40.1 } } }, players: [] };
    const html = renderToStaticMarkup(<DefenseBlock side={side} season={2026} market="tpm" pos="PG" onPos={() => {}} rows={[]} onOpen={() => {}} shuffled />);
    expect(html).toMatch(/<th class="is-on">3PM<\/th><th[^>]*>3PA<\/th>/);
    expect(html).toContain('LAL gives up 14.2 3PM a game in all · #6 of 30 · league 13.1');
    expect(html).toContain('3PA allowed · 8.4 to PGs (#4) · 39.5 in all (#3 of 30, league 35.2)');
    // Points: the figure in all positions, no 3PA line.
    const pts = renderToStaticMarkup(<DefenseBlock side={{ ...side, against: { gp: 10, stats: { pts: { value: 118.4, rank: 7, count: 30, league: 114.6 } } } }} season={2026} market="pts" pos={null} onPos={() => {}} rows={[]} onOpen={() => {}} shuffled />);
    expect(pts).toContain('LAL gives up 118.4 pts a game in all · #7 of 30 · league 114.6');
    expect(pts).not.toContain('3PA allowed');
    const out = process.env.MOCK_OUT;
    if (!out) return;
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    fs.mkdirSync(out, { recursive: true });
    for (const theme of ['dark', 'light']) fs.writeFileSync(path.join(out, `threes-nba-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NBA threes</title><style>${css}
.mock-page { max-width: 1360px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><section class="nhlx-pk">${html}</section></main></body></html>`);
  });
  test('a position picked: the table’s cell for it in a line, the players at that spot alone', () => {
    const rows = tierRows(board, shuffles, 'pts', 'g1');
    const den = board.games[0].sides.DEN;
    const c = renderToStaticMarkup(<DefenseBlock side={den} season={2026} market="pts" pos="C" onPos={() => {}} rows={rows} onOpen={() => {}} shuffled />);
    expect(c).toContain('LAL gives up 17.0 pts a game to Cs · #27 of 30 · L10 · league 19.0');
    expect(c).toContain('Nikola Jokic');
    expect(c).not.toContain('Austin Reaves');
    const pg = renderToStaticMarkup(<DefenseBlock side={den} season={2026} market="pts" pos="PG" onPos={() => {}} rows={rows} onOpen={() => {}} shuffled />);
    expect(pg).toContain('No PG of DEN on this ladder.');
  });
  test('a last-N tab a team is short of says how many games stand in', () => {
    const den = board.games[0].sides.DEN;
    const short = { ...den, allowed: { ...den.allowed, windows: { l10: { count: 30, season: 2026, rows: { PG: { gp: 8, short: true, pts: { value: 30, rank: 1 } } } } } } };
    const html = renderToStaticMarkup(<DefenseBlock side={short} season={2026} market="pts" pos={null} onPos={() => {}} rows={[]} onOpen={() => {}} shuffled />);
    expect(html).toContain('its last 10 games · LAL has played 8 games this season, all 8 here');
    expect(html).not.toContain('of last season');
  });
  test('every active player with a projection is listed, a mark or not (2026-11-02: IND listed two)', () => {
    const low = { key: 'big man', player: 'Big Man', team: 'DEN', opp: 'LAL', venue: 'H', game: 'g1', pos: 'C', health: 'In', exp: 0.3, at: heights.map(() => ({ p: 0.05 })) };
    const rows = tierRows(board, { pts: { ...shuffles.pts, players: [...shuffles.pts.players, low] } }, 'pts', 'g1');
    const big = rows.find((r) => r.player === 'Big Man');
    expect(big).toMatchObject({ proj: 0.3, strong: null, lean: null, thin: null, top: null });
    expect(rows.map((r) => r.player)).toEqual(['Nikola Jokic', 'Austin Reaves', 'Big Man']);
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
