/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { teamProfile, gameProfile, rankIn, PROFILE_ROWS } from '../lib/nfl/profile';
import { MatchupProfile } from '../components/nhl/MatchupProfile';

// Sixteen teams: fourteen fillers near the average, KC strong, CAR weak.
const fillers = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`T${String(i).padStart(2, '0')}`, {
  for: { gp: 8, passYds: 225 + i, passTd: 1.5 + i * 0.02, passCmp: 22, passAtt: 34, rushYds: 115 + i * 0.5, rushTd: 0.9 + i * 0.01, rushAtt: 26, passInt: 0.8 + i * 0.01, td: 2.6 + i * 0.03 },
  against: { gp: 8, passYds: 225 + i * 0.5, rushYds: 115 + i, td: 2.6 + i * 0.02, passInt: 0.8 },
  l10: { against: { gp: 8, passYds: 225 + i, rushYds: 115 } },
}]));
const totals = {
  ...fillers,
  KC: { for: { gp: 8, passYds: 290, passTd: 2.4, passCmp: 27, passAtt: 38, rushYds: 130, rushTd: 1.2, rushAtt: 27, passInt: 0.4, td: 3.8 }, against: { gp: 8, passYds: 190, rushYds: 95, td: 1.6, passInt: 1.1 }, l10: { against: { gp: 8, passYds: 240, rushYds: 130 } } },
  CAR: { for: { gp: 8, passYds: 180, passTd: 0.9, passCmp: 19, passAtt: 33, rushYds: 90, rushTd: 0.6, rushAtt: 22, passInt: 1.4, td: 1.6 }, against: { gp: 8, passYds: 270, rushYds: 150, td: 3.4, passInt: 0.5 }, l10: { against: { gp: 8, passYds: 200, rushYds: 100 } } },
};
const defense = { count: 16, totals };
const cellOf = (rank, sheet = null) => ({ value: 70, rank, rankBlend: sheet != null ? Math.round((rank + sheet) / 2) : rank, sheet });
const sides = {
  KC: { team: 'KC', opp: 'CAR', teamProj: { td: 3.5 }, out: [],
    // What CAR gives up (KC attacks it): quarterbacks and tight ends in the soft third.
    allowed: { count: 16, from: 'propfinder', rows: { QB: { passYds: cellOf(2, 4) }, RB: { rushYds: cellOf(9) }, WR: { recYds: cellOf(8) }, TE: { recYds: cellOf(3) }, WR1: { recYds: cellOf(1) } } } },
  CAR: { team: 'CAR', opp: 'KC', teamProj: { td: 1.4 }, out: [{ name: 'Bryce Young' }],
    // What KC gives up: nothing soft, backs and receivers held.
    allowed: { count: 16, from: 'propfinder', rows: { QB: { passYds: cellOf(10) }, RB: { rushYds: cellOf(15) }, WR: { recYds: cellOf(14) }, TE: { recYds: cellOf(9) } } } },
};
const row = (p, key, team) => p.rows.find((r) => r.key === key)?.cells[team] || null;
const mark = (abbr) => React.createElement('b', { className: 'nhlx-prof-mark' }, abbr);

describe('the NFL matchup profile', () => {
  test('rankIn', () => {
    expect(rankIn([1, 2, 3], 3)).toEqual({ rank: 1, n: 3 });
    expect(rankIn([1, 2, 3], 1, true)).toEqual({ rank: 1, n: 3 });
    expect(rankIn([2], null)).toBeNull();
  });
  test('each team’s cells: a word, the line as parts with the rank phrases toned, the hover', () => {
    const kc = teamProfile({ team: 'KC', defense, oppSide: sides.CAR });
    expect(kc.passing).toMatchObject({ word: 'Elite', level: 'elite', tone: 'is-soft', source: 'propfinder', text: '290.0 passing yards a game · 1st of 16 · 2.4 TD (1st)' });
    expect(kc.passing.parts[1]).toEqual({ t: '1st of 16', tone: 'is-soft' });
    expect(kc.passing.title).toBe("PropFinder's team row, 8 games: 290.0 passing yards a game, 1st of 16 · 2.4 passing touchdowns a game, 1st of 16 · 71% completed, 10.7 yards a completion");
    expect(kc.rushing).toMatchObject({ word: 'Elite', text: '130.0 rushing yards a game · 1st of 16 · 1.2 TD (1st)' });
    expect(kc.endzone).toMatchObject({ word: 'Elite', text: '3.8 touchdowns a game · 1st of 16 · 0.4 interceptions thrown (1st fewest)' });
    // Allows the fewest yards: 16th of 16 most → Elite, red; its last ten 370 allowed, the most of 16 → loosening.
    expect(kc.allows).toMatchObject({ word: 'Elite', tone: 'is-tough', trend: 'loosening', text: '285 yards allowed a game (190 passing, 95 rushing) · 16th of 16 most · 1.6 TD allowed (16th most) · last 8: 370 (1st most, loosening)' });
    expect(kc.allows.parts.filter((x) => x.tone != null).map((x) => x.tone)).toEqual(['is-tough', 'is-tough', 'is-soft']);
    // What KC gives up (CAR's allowed table): nothing in the soft third, two positions held of four → Average.
    expect(kc.spots).toMatchObject({ word: 'Average', tone: '', text: 'passing: none · rushing: none · receiving: none' });
    expect(kc.spots.title).toContain('receiving yards: TE #9, 70.0 a game, WR #14, 70.0 a game of 16');
    const car = teamProfile({ team: 'CAR', defense, oppSide: sides.KC });
    expect(car.passing).toMatchObject({ word: 'Poor', tone: 'is-tough' });
    expect(car.allows).toMatchObject({ word: 'Very leaky', tone: 'is-soft', trend: 'tightening' });
    expect(car.allows.text).toBe('420 yards allowed a game (270 passing, 150 rushing) · 1st of 16 most · 3.4 TD allowed (1st most) · last 8: 300 (16th most, tightening)');
    // What CAR gives up: QB #3 (PropFinder #2, the sheet #4) on passing, TE #3 on receiving; the WR1 slot row is not a position.
    expect(car.spots).toMatchObject({ word: 'Leaky', level: 'weak', tone: 'is-soft', text: 'passing to QB #3 · rushing: none · receiving to TE #3' });
    expect(car.spots.title).toContain('passing yards: QB #3 (PropFinder #2, sheet #4), 70.0 a game of 16');
    const t = teamProfile({ team: 'T07', defense, oppSide: null });
    expect(t.passing).toMatchObject({ word: 'Average', tone: '' });
    expect(t.spots).toBeUndefined();
    expect(teamProfile({ team: 'ZZZ', defense, oppSide: null })).toBeNull();
  });
  test('the game: the card’s shape — order, heads with the defense pill, the expected touchdowns, five rows', () => {
    const p = gameProfile({ away: 'KC', home: 'CAR' }, defense, sides);
    expect(p.order).toEqual(['KC', 'CAR']);
    expect(PROFILE_ROWS).toHaveLength(5);
    expect(p.rows.map((r) => r.key)).toEqual(['passing', 'rushing', 'endzone', 'allows', 'spots']);
    expect(p.teams.KC).toMatchObject({ venue: 'A', opp: 'CAR', games: 8, sub: '8 games · PropFinder', verdict: { headline: 'Tight defense', tier: 'tight' } });
    expect(p.teams.CAR).toMatchObject({ venue: 'H', sub: '8 games · 1 out · PropFinder', verdict: { headline: 'Leaky defense', tier: 'leaky' } });
    expect(p.total).toMatchObject({ headline: '4.9 touchdowns expected · KC 3.5 · CAR 1.4' });
    expect(row(p, 'allows', 'CAR').word).toBe('Very leaky');
    expect(gameProfile({ away: 'AAA', home: 'BBB' }, defense, {})).toBeNull();
    // Without expected touchdowns on the sides the card has no pill.
    expect(gameProfile({ away: 'KC', home: 'CAR' }, defense, { KC: { ...sides.KC, teamProj: null }, CAR: sides.CAR }).total).toBeNull();
  });
  test('renders through the shared card', () => {
    const p = gameProfile({ away: 'KC', home: 'CAR' }, defense, sides);
    const html = renderToStaticMarkup(React.createElement(MatchupProfile, { profile: p, renderTeam: mark }));
    expect(html).toContain('class="nhlx-prof"');
    expect(html).toContain('4.9 touchdowns expected · KC 3.5 · CAR 1.4');
    expect(html).toContain('this season · green = more yards and touchdowns likely, red = fewer');
    expect((html.match(/class="nhlx-prof-row is-(?!head)/g) || []).length).toBe(5);
    for (const label of ['Passing', 'Rushing', 'End zone', 'Allows', 'Soft spots']) expect(html).toContain(`>${label}</div>`);
    expect(html).toContain('<b class="nhlx-prof-rank is-soft">QB #3</b>');
    expect(html).toContain('<b class="nhlx-prof-rank is-tough">16th of 16 most</b>');
    const out = process.env.MOCK_OUT;
    if (!out) return;
    fs.mkdirSync(out, { recursive: true });
    const root = path.resolve(__dirname, '..');
    const fontCss = (pkg) => { const dir = path.join(root, 'node_modules', pkg); return fs.readFileSync(path.join(dir, 'index.css'), 'utf8').replace(/url\(\.\/files\//g, `url(file://${dir}/files/`); };
    const css = [fontCss('@fontsource-variable/schibsted-grotesk'), fontCss('@fontsource-variable/source-sans-3'), fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8')].join('\n');
    for (const theme of ['dark', 'light']) {
      fs.writeFileSync(path.join(out, `profile-nfl-${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>NFL profile</title><style>${css}
.nhlx-prof-mark { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 24px; padding: 0 6px; border-radius: 6px; background: var(--bg-tint); color: var(--heading); font-size: 13px; font-weight: 700; }
.mock-page { max-width: 1180px; margin: 0 auto; padding: 24px var(--gutter) 48px; }</style></head><body><main class="mock-page nhlx"><div class="nhlx-mu-game">${html}</div></main></body></html>`);
    }
  });
});
