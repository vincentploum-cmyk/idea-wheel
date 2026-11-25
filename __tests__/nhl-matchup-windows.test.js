// The Matchups windows by metric (Vincent, 2026-11-25: "switch the team and goals reads to L15. Also, when I select
// shots, it should automatically select L10. If I select goals, L15 should be selected automatically").
const { defaultDefenseTab, teamDefenseTab, spotFromTabs, defenseCardFromTabs } = require('@/lib/nhl-data/propfinder-csv');
const { teamAllowsBook, allowsOf, ALLOWS_LAST_N } = require('@/lib/nhl-data/defense-board');
const { matchupTabOf } = require('@/lib/nhl-data/shuffle-pure');

const row = (sog, g, rank) => ({ gp: 10, sog, g, icf: sog * 2, iff: sog * 1.5, iscf: g * 5, ranks: { sog: rank, g: rank, icf: rank, iff: rank, iscf: rank } });
const tab = (key, kind, rank, extra = {}) => ({ key, kind, label: key.toUpperCase(), count: 32, windowGames: kind === 'window' ? Number(key.slice(1)) : null, rows: { All: row(30, 3, rank), LW: row(6, 0.6, rank) }, ...extra });
const season = tab('s2026', 'season', 20, { season: 2026 });
const l5 = tab('l5', 'window', 1); const l10 = tab('l10', 'window', 2); const l15 = tab('l15', 'window', 25);

test('shots open on L10, goals on L15 (else L10, else the season); the team read is L15', () => {
  expect(defaultDefenseTab([season, l5, l10, l15]).key).toBe('l10');
  expect(defaultDefenseTab([season, l5, l10, l15], 'sog').key).toBe('l10');
  expect(defaultDefenseTab([season, l5, l10, l15], 'g').key).toBe('l15');
  expect(defaultDefenseTab([season, l5, l10], 'g').key).toBe('l10');
  expect(defaultDefenseTab([season, l5], 'g').key).toBe('s2026');
  expect(teamDefenseTab([season, l10, l15]).key).toBe('l15');
  expect(defenseCardFromTabs([season, l10, l15], null, 'g').tab.key).toBe('l15');
  expect(defenseCardFromTabs([season, l10, l15], 'l10', 'g').tab.key).toBe('l10');   // a pressed tab wins
  expect(matchupTabOf(null, [season, l10, l15], 'g').key).toBe('l15');
  expect(matchupTabOf(null, [season, l10, l15], 'sog').key).toBe('l10');
});

test('the soft-spot flag: the shots half off L10, the goals half off L15', () => {
  const s = spotFromTabs(l10, l15, 'LW');
  expect(s).toMatchObject({ rankSog: 2, softSog: true, tab: { key: 'l10' }, rankG: 25, softG: false, tabG: { key: 'l15' } });
  expect(spotFromTabs(l10, l10, 'LW')).toMatchObject({ rankG: 2, softG: true, tabG: { key: 'l10' } });
  expect(spotFromTabs(null, null, 'LW')).toBeNull();
});

test('the rink head verdict reads each team\'s last 15 games this season', () => {
  expect(ALLOWS_LAST_N).toBe(15);
  const rows = [];
  // AAA: 5 old games at 40 shots, then 15 at 20; BBB: 20 games at 30; CCC: 3 games at 25 (all of them).
  for (let i = 0; i < 20; i++) rows.push({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, gameId: 100 + i, opp: 'AAA', sog: i < 5 ? 40 : 20, g: 1 });
  for (let i = 0; i < 20; i++) rows.push({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, gameId: 200 + i, opp: 'BBB', sog: 30, g: 2 });
  for (let i = 0; i < 3; i++) rows.push({ date: `2026-11-0${i + 1}`, gameId: 300 + i, opp: 'CCC', sog: 25, g: 3 });
  const b = teamAllowsBook(rows, 2026, { lastN: 15 });
  expect(allowsOf(b, 'AAA')).toMatchObject({ gp: 15, sog: 20, window: 15, rank: { sog: 3 } });
  expect(allowsOf(b, 'BBB')).toMatchObject({ gp: 15, sog: 30, rank: { sog: 1 } });
  expect(allowsOf(b, 'CCC')).toMatchObject({ gp: 3, sog: 25, window: null });
  // Season to date, the old way: AAA 25 a game.
  expect(teamAllowsBook(rows, 2026).teams.AAA.sog).toBe(25);
});

// The rink itself: the table above it and the stored-games picker follow the Shots / Goals switch.
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Rink } = require('@/components/nhl/Rink');
const band = (sog, g, rank) => ({ season: { gp: 15, sog, g }, rank: { sog: rank, g: rank }, source: 'games', teamCount: 32 });
const defense = Object.fromEntries(['LW', 'C', 'RW', 'D'].map((p) => [p, { windows: { l10: band(5, 0.5, 4), l15: band(5, 0.5, 6) } }]));
const side = (propfinder) => ({ team: 'MTL', opp: 'PIT', venue: 'H', source: 'preview', skaters: [], defense, propfinder, lines: null,
  allows: { gp: 15, window: 15, sog: 31.2, g: 3.4, rank: { sog: 2, g: 5 }, of: 32, league: { sog: 28, g: 3.1 } } });

test('the rink opens PropFinder\'s table on L10 under Shots and L15 under Goals', () => {
  const pf = { cols: [['sog', 'SOG'], ['g', 'G']], tabs: [season, l10, l15] };
  const shots = renderToStaticMarkup(React.createElement(Rink, { side: side(pf), teamCount: 32, metric: 'sog' }));
  const goals = renderToStaticMarkup(React.createElement(Rink, { side: side(pf), teamCount: 32, metric: 'g' }));
  expect(shots).toContain('PIT allows over the last 10 games');
  expect(goals).toContain('PIT allows over the last 15 games');
  // The verdict names its window.
  expect(shots).toContain('31.2 a game over its last 15');
});

test('from the stored games the picker opens on L10 under Shots and L15 under Goals', () => {
  const active = (html) => html.match(/aria-selected="true" class="nhlx-tab is-active"[^>]*>(L\d+)/g).map((m) => m.match(/>(L\d+)$/)[1]);
  const shots = renderToStaticMarkup(React.createElement(Rink, { side: side(null), teamCount: 32, metric: 'sog' }));
  const goals = renderToStaticMarkup(React.createElement(Rink, { side: side(null), teamCount: 32, metric: 'g' }));
  expect(active(shots)).toEqual(['L10']);
  expect(active(goals)).toEqual(['L15']);
});
