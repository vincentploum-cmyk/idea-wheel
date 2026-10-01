import { describe, expect, test } from '@jest/globals';
import { inspectPropfinderCsv, parsePlayerCell, parseRanked, parseStatsCsv, statKey, fileInfo, seasonYear } from '../lib/nhl-data/propfinder-csv';
import { nameResolver } from '../lib/nhl-data/names';
import { PROPFINDER_SEED } from '../lib/nhl-data/seed/propfinder-2025';
import { seedSnapshots, propfinderDefenseTabs } from '../lib/nhl-data/propfinder';

const SKATERS = `Position,All
Strength,All
Split,All
Count Window,2025
Rate,Per Game
Quarter,Full

PLAYER,GP,TOI/G,G/G,SOG/G,ISF/G,ICF/G,IFF/G,ISCF/G,IHDCF/G
Nathan MacKinnon C,80,22.26,0.66,4.38,4.38,7.49,5.86,3.61,1.24
Mackie Samoskevich RW IR,77,14.47,0.16,2.09,2.09,4.31,3.32,2.45,1.09
Zack MacEwen RW,3,6.33,0.00,1.33,1.33,2.33,2.33,1.33,1.00
`;

const TEAMS = `Stats Type,Team
Season,2025
Window,Full Season

TEAM,GP,G,A,PTS,SOG,SH%,HIT,BLK,TK,GV,FO%,PP%,PK%,SC,HDC,HDG
Avalanche,82,3.63 #1,6.37 #1,10.00 #1,33.73 #1,10.8% #19,16.59 #31,12.67 #27,4.50 #18,15.79 #11,51.2% #8,17.1% #27,84.6% #1,12.26 #2,4.90 #3,0.60 #3
Golden Knights,82,3.22 #14,5.59 #12,8.80 #12,28.99 #8,11.1% #16,20.89 #14,14.38 #18,4.43 #25,16.12 #8,51.0% #10,24.5% #6,81.4% #6,10.48 #17,4.24 #21,0.57 #5
`;

describe('propfinder csv', () => {
  test('preamble, header and rows split apart', () => {
    const { meta, head, rows } = parseStatsCsv(SKATERS);
    expect(meta).toMatchObject({ Strength: 'All', 'Count Window': '2025', Rate: 'Per Game' });
    expect(head[0]).toBe('PLAYER');
    expect(rows).toHaveLength(3);
  });
  test('player cells carry position and status tags', () => {
    expect(parsePlayerCell('Nathan MacKinnon C')).toEqual({ name: 'Nathan MacKinnon', pos: 'C', status: null });
    expect(parsePlayerCell('Mackie Samoskevich RW IR')).toEqual({ name: 'Mackie Samoskevich', pos: 'RW', status: 'IR' });
    expect(parsePlayerCell('Jean-Gabriel Pageau C')).toEqual({ name: 'Jean-Gabriel Pageau', pos: 'C', status: null });
  });
  test('ranked cells and column keys', () => {
    expect(parseRanked('3.63 #1')).toEqual({ value: 3.63, rank: 1 });
    expect(parseRanked('10.8% #19')).toEqual({ value: 10.8, rank: 19 });
    expect(parseRanked('82')).toEqual({ value: 82, rank: null });
    expect(['TOI/G', 'SH%', 'ISCF/G', 'GP'].map(statKey)).toEqual(['toi', 'shPct', 'iscf', 'gp']);
  });
  test('season and date come from the file name', () => {
    expect(fileInfo('nhl-skater-stats-All-All-All-2025-2026-09-30.csv')).toEqual({ season: 2025, date: '2026-09-30' });
    expect(fileInfo('nhl-team-stats-Team-2025-2026-09-30.csv')).toEqual({ season: 2025, date: '2026-09-30' });
    expect(fileInfo('whatever.csv')).toEqual({ season: null, date: null });
    expect(seasonYear(new Date('2026-09-30T00:00:00Z'))).toBe(2025 + 1);
    expect(seasonYear(new Date('2026-03-01T00:00:00Z'))).toBe(2025);
  });
  test('skater export → per-game rates per player', () => {
    const info = inspectPropfinderCsv(SKATERS, 'nhl-skater-stats-All-All-All-2025-2026-09-30.csv');
    expect(info).toMatchObject({ kind: 'skaters', season: 2025, date: '2026-09-30', error: null });
    expect(info.players).toHaveLength(3);
    expect(info.players[0]).toMatchObject({ name: 'Nathan MacKinnon', pos: 'C', gp: 80, toi: 22.26, g: 0.66, sog: 4.38, isf: 4.38, icf: 7.49, iff: 5.86, iscf: 3.61, ihdcf: 1.24 });
    expect(info.players[1]).toMatchObject({ name: 'Mackie Samoskevich', status: 'IR', sog: 2.09 });
  });
  test('a "Count Window" of 5 is a last-five table with the season from the export date', () => {
    const info = inspectPropfinderCsv(SKATERS.replace('Count Window,2025', 'Count Window,5'), 'nhl-skater-stats-All-All-All-5-2026-09-30.csv');
    expect(info).toMatchObject({ kind: 'skaters', windowGames: 5, season: 2026, date: '2026-09-30', error: null });
    expect(info.players[0].gp).toBe(80);
  });
  test('per-position opponent exports carry the position from the file name', () => {
    const opp = TEAMS.replace('Stats Type,Team', 'Stats Type,Opponent');
    expect(inspectPropfinderCsv(opp, 'nhl-team-stats-Opponent-2025-2026-09-30-lw.csv')).toMatchObject({ statsType: 'opponent', position: 'LW', season: 2025, date: '2026-09-30' });
    expect(inspectPropfinderCsv(opp, 'nhl-team-stats-Opponent-2025-2026-09-30d.csv').position).toBe('D');
    expect(inspectPropfinderCsv(opp, 'nhl-team-stats-Opponent-2025-2026-09-30_all.csv').position).toBe('All');
    expect(inspectPropfinderCsv(opp, 'nhl-team-stats-Opponent-2025-2026-09-30.csv').position).toBe('All');
    expect(inspectPropfinderCsv(opp, 'x-2025-2026-09-30.csv').windowGames).toBeNull();
    expect(inspectPropfinderCsv(opp.replace('Window,Full Season', 'Window,Last 10 Games'), 'nhl-team-stats-Opponent-2025-2026-09-30-d.csv')).toMatchObject({ position: 'D', windowGames: 10 });
    expect(inspectPropfinderCsv(opp.replace('Window,Full Season', 'Window,L5'), 'x-2025-2026-09-30-c.csv').windowGames).toBe(5);
    // Hand-named exports: "nhl-team-stats-Opponent-2025-L10-2026-09-30_D_L10.csv".
    const l10 = inspectPropfinderCsv(opp.replace('Window,Full Season', 'Window,Last 10'), 'nhl-team-stats-Opponent-2025-L10-2026-09-30_D_L10.csv');
    expect(l10).toMatchObject({ statsType: 'opponent', position: 'D', windowGames: 10, season: 2025, date: '2026-09-30' });
    expect(inspectPropfinderCsv(opp.replace('Window,Full Season', 'Window,Last 10'), 'nhl-team-stats-Opponent-2025-L10-2026-09-30_all_l10.csv').position).toBe('All');
    expect(fileInfo('nhl-team-stats-Opponent-2025-L10-2026-09-30_RW_L10.csv')).toEqual({ season: 2025, date: '2026-09-30' });
    expect(inspectPropfinderCsv(opp.replace('Window,Full Season', 'Window,Last 5\nSplit,Home'), 'x-2025-2026-09-30-d.csv')).toMatchObject({ position: 'D', windowGames: 5, split: 'H' });
  });
  test('a 5-on-5 or totals export is refused instead of mixed in', () => {
    expect(inspectPropfinderCsv(SKATERS.replace('Strength,All', 'Strength,5v5'), 'x-2025-2026-09-30.csv').error).toMatch(/Strength/);
    expect(inspectPropfinderCsv(SKATERS.replace('Rate,Per Game', 'Rate,Total'), 'x-2025-2026-09-30.csv').error).toMatch(/Rate/);
    expect(inspectPropfinderCsv(SKATERS.replace('Split,All', 'Split,Neutral'), 'x-2025-2026-09-30.csv').error).toMatch(/Split/);
    const home = inspectPropfinderCsv(SKATERS.replace('Split,All', 'Split,Home').replace('Count Window,2025', 'Count Window,5'), 'nhl-skater-stats-All-All-Home-5-2026-09-30_home_last_5.csv');
    expect(home).toMatchObject({ kind: 'skaters', split: 'H', windowGames: 5, season: 2026, date: '2026-09-30', error: null });
    expect(inspectPropfinderCsv(SKATERS.replace('Split,All', 'Split,Away'), 'x-2025-2026-09-30.csv').split).toBe('A');
    expect(inspectPropfinderCsv(SKATERS, 'x-2025-2026-09-30.csv').split).toBeNull();
    expect(inspectPropfinderCsv('a,b\n1,2\n', 'x.csv')).toMatchObject({ kind: null });
  });
  test('team export → values and PropFinder ranks per team', () => {
    const info = inspectPropfinderCsv(TEAMS, 'nhl-team-stats-Team-2025-2026-09-30.csv');
    expect(info).toMatchObject({ kind: 'teams', season: 2025, window: 'Full Season', error: null });
    expect(info.teams.map((t) => t.abbr)).toEqual(['COL', 'VGK']);
    expect(info.teams[0]).toMatchObject({ name: 'Avalanche', gp: 82 });
    expect(info.teams[0].values).toMatchObject({ g: 3.63, shPct: 10.8, pkPct: 84.6, hdg: 0.6, gv: 15.79 });
    expect(info.teams[0].ranks).toMatchObject({ g: 1, shPct: 19, pkPct: 1, hit: 31 });
    expect(inspectPropfinderCsv(TEAMS.replace('Avalanche', 'Whalers'), 'x-2025-2026-01-01.csv').error).toMatch(/Whalers/);
    expect(info.statsType).toBe('team');
  });
  test('the Opponent export is the same table as what each team allowed', () => {
    const info = inspectPropfinderCsv(TEAMS.replace('Stats Type,Team', 'Stats Type,Opponent'), 'nhl-team-stats-Opponent-2025-2026-09-30.csv');
    expect(info).toMatchObject({ kind: 'teams', statsType: 'opponent', season: 2025, error: null });
    expect(info.teams[0].values.g).toBe(3.63);
  });
  test('the bundled 2025-26 exports parse cleanly', () => {
    const parsed = PROPFINDER_SEED.files.map((f) => inspectPropfinderCsv(f.text, f.name));
    const skaters = parsed.find((p) => p.kind === 'skaters');
    const teams = parsed.find((p) => p.kind === 'teams' && p.statsType === 'team');
    const opponents = parsed.find((p) => p.kind === 'teams' && p.statsType === 'opponent' && p.position === 'All');
    const l5 = parsed.find((p) => p.kind === 'skaters' && p.windowGames === 5 && !p.split);
    const l5Home = parsed.find((p) => p.kind === 'skaters' && p.windowGames === 5 && p.split === 'H');
    const l5Away = parsed.find((p) => p.kind === 'skaters' && p.windowGames === 5 && p.split === 'A');
    expect(l5Home.players.length).toBeGreaterThan(100);
    expect(l5Away.players.find((p) => p.name === 'Quinton Byfield')).toMatchObject({ pos: 'C', sog: 4.4, g: 0.8 });
    const byPos = parsed.filter((p) => p.kind === 'teams' && p.statsType === 'opponent' && p.position !== 'All' && !p.windowGames);
    expect(l5.players.length).toBeGreaterThan(100);
    expect(byPos.map((p) => p.position).sort()).toEqual(['C', 'D', 'LW', 'RW']);
    expect(byPos.every((p) => p.teams.length === 32 && !p.error)).toBe(true);
    // Last-10 tables: the Kings allowed the 3rd-most shots to D over their last 10 (green on Colorado's rink).
    const dL10 = parsed.find((p) => p.kind === 'teams' && p.statsType === 'opponent' && p.position === 'D' && p.windowGames === 10);
    expect(dL10.teams.find((t) => t.abbr === 'LAK').ranks.sog).toBe(3);
    expect(parsed.filter((p) => p.windowGames === 10 && p.statsType === 'opponent').map((p) => p.position).sort()).toEqual(['All', 'C', 'D', 'LW', 'RW']);
    expect(PROPFINDER_SEED.season).toBe(2025);
    expect(skaters).toMatchObject({ season: 2025, date: '2026-09-30', error: null });
    expect(skaters.players.length).toBeGreaterThan(100);
    expect(skaters.players.every((p) => p.pos && p.gp > 0)).toBe(true);
    expect(teams).toMatchObject({ season: 2025, error: null });
    expect(teams.teams).toHaveLength(32);
    expect(new Set(teams.teams.map((t) => t.abbr)).size).toBe(32);
    expect(opponents).toMatchObject({ season: 2025, error: null });
    expect(opponents.teams).toHaveLength(32);
    expect(opponents.teams.find((t) => t.abbr === 'COL').ranks.g).toBe(32); // fewest goals allowed
  });
});

describe('name resolver', () => {
  const players = {
    1: { id: 1, name: 'Alexander Romanov', team: 'NYI', pos: 'D' },
    2: { id: 2, name: 'Nathan MacKinnon', team: 'COL', pos: 'C' },
    3: { id: 3, name: 'Kiefer Sherwood', team: 'VAN', pos: 'LW' },
    4: { id: 4, name: 'Kole Sherwood', team: 'VAN', pos: 'RW' },
  };
  test('exact, then same last name with a matching first name', () => {
    const resolve = nameResolver(players);
    expect(resolve('Nathan MacKinnon').id).toBe(2);
    expect(resolve('Alex Romanov').id).toBe(1);
    expect(resolve('K. Sherwood')).toBeNull();
    expect(resolve('Nobody Here')).toBeNull();
  });
});

describe('propfinder defense tabs (the table above each rink)', () => {
  const pf = seedSnapshots();
  test('one tab per stored table: the season, then the recent-games windows', () => {
    const d = propfinderDefenseTabs(pf, 'LAK');
    expect(d.cols.map(([k]) => k)).toEqual(['g', 'a', 'sog', 'icf', 'iff', 'iscf']);
    expect(d.tabs.map((t) => t.key)).toEqual(['season-2025', 'l10']);
    const season = d.tabs[0];
    expect(season).toMatchObject({ label: '2025-26', kind: 'season', season: 2025, count: 32 });
    expect(Object.keys(season.rows)).toEqual(['All', 'LW', 'C', 'RW', 'D']);
    // The all-positions row comes from the Opponent export, ISCF from its SC column, with PropFinder's ranks.
    const all = pf.opponents.teams.LAK;
    expect(season.rows.All).toMatchObject({ gp: all.gp, g: all.g, a: all.a, sog: all.sog, iscf: all.sc, icf: null, iff: null });
    expect(season.rows.All.ranks).toMatchObject({ g: pf.opponents.ranks.LAK.g, sog: pf.opponents.ranks.LAK.sog, iscf: pf.opponents.ranks.LAK.sc, icf: null });
    expect(season.rows.C.sog).toBe(pf.opponentsByPos.C.teams.LAK.sog);
    const l10 = d.tabs[1];
    expect(l10).toMatchObject({ label: 'L10', kind: 'window', windowGames: 10, split: null });
    expect(l10.rows.D.ranks.sog).toBe(pf.opponentsByPosWindow.l10.D.ranks.LAK.sog);
  });
  test('last season rides along as its own tab when this season differs', () => {
    const prev = { opponents: { ...pf.opponents, season: 2024 }, opponentsByPos: {} };
    const d = propfinderDefenseTabs(pf, 'LAK', prev);
    expect(d.tabs.map((t) => t.key)).toEqual(['season-2025', 'season-2024', 'l10']);
    expect(d.tabs[1].rows.All.sog).toBe(pf.opponents.teams.LAK.sog);
    // The same season twice is one tab.
    expect(propfinderDefenseTabs(pf, 'LAK', pf).tabs.map((t) => t.key)).toEqual(['season-2025', 'l10']);
    expect(propfinderDefenseTabs(pf, 'XXX')).toBeNull();
  });
});
