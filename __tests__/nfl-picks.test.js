import { describe, expect, test } from '@jest/globals';
import { statOf, clears, logRates, chanceOf, formOf, softSpot, mergeCandidates, buildBoard, actualFor } from '../lib/nfl/picks';

const game = (date, over) => ({ date, season: 2026, type: 'REG', opp: 'KC', passYds: over ? 280 : 200, passTd: over ? 2 : 1, rushYds: 10, recYds: 0, rec: 0, rushTd: 0, recTd: 0, retTd: 0 });
const LOGS = [true, true, false, true, true, true, false, true, true, true].map((o, i) => game(`2026-10-${String(19 - i).padStart(2, '0')}`, o)); // newest first: 4/5, 8/10

describe('NFL picks: the read', () => {
  test('stats and lines', () => {
    expect(statOf({ rushYds: 40, recYds: 30 }, 'rush_rec_yds')).toBe(70);
    expect(statOf({ rushTd: 1, recTd: 1, retTd: 0 }, 'anytime_td')).toBe(2);
    expect(statOf({ firstTd: 1 }, 'first_td')).toBe(1);
    expect(clears(250, 245.5, 'over')).toBe(true);
    expect(clears(240, 245.5, 'under')).toBe(true);
    expect(clears(245, 245, 'over')).toBe(false);
    expect(clears(1, 0.5, 'yes')).toBe(true);
  });
  test('hit rates over the logs, by window, and the chance shrunk toward the price', () => {
    const r = logRates(LOGS, { market: 'pass_yds', line: 245.5, side: 'over', season: 2026, opp: 'KC' });
    expect(r).toMatchObject({ l5: 0.8, l5N: 5, l10: 0.8, l10N: 10, season: 0.8, seasonN: 10, h2h: 0.75, h2hN: 4, n: 10 });
    const u = logRates(LOGS, { market: 'pass_yds', line: 245.5, side: 'under', season: 2026 });
    expect(u.season).toBeCloseTo(0.2, 5);
    // 0.8 blended, shrunk toward -115's 53.5% at 10 / 16.
    expect(chanceOf({ rates: r, n: 10, implied: 0.535 })).toBeCloseTo((10 * 0.8 + 6 * 0.535) / 16, 3);
    expect(chanceOf({ rates: { season: 0.7 }, n: 17, implied: null })).toBeCloseTo((17 * 0.7 + 3) / 23, 3);
    expect(chanceOf({ rates: { all: 0.6 }, n: 8 })).toBeCloseTo((8 * 0.6 + 3) / 14, 3);
    expect(chanceOf({ rates: {}, n: 8 })).toBeNull();
    // Early-season: this season's three games are padded with last season's.
    const early = [game('2026-09-20', true), game('2026-09-13', false), ...[true, true, true, false].map((o, i) => ({ ...game(`2025-12-${20 - i}`, o), season: 2025 }))];
    expect(logRates(early, { market: 'pass_yds', line: 245.5, side: 'over', season: 2026 })).toMatchObject({ seasonN: 6, season: 4 / 6 });
  });
  test('form and the soft spot are colour only', () => {
    expect(formOf({ l5: 0.8, l5N: 5, season: 0.6 })).toBe('hot');
    expect(formOf({ l5: 0.2, l5N: 5, season: 0.6 })).toBe('cold');
    expect(formOf({ l5: 0.8, l5N: 3, season: 0.6 })).toBeNull();
    expect(formOf({ l5: 0.8, l5N: 5, season: 0.9 })).toBeNull();
    const defense = { count: 3, teams: { KC: { WR: { recYds: 150 } } }, ranks: { KC: { WR: { recYds: 1, td: 3 } } } };
    expect(softSpot(defense, { opp: 'KC', pos: 'WR', market: 'rec_yds' })).toMatchObject({ rank: 1, soft: true, tough: false, key: 'recYds' });
    expect(softSpot(defense, { opp: 'KC', pos: 'WR', market: 'anytime_td' })).toMatchObject({ rank: 3, soft: false, tough: true, key: 'td' });
    expect(softSpot(defense, { opp: 'KC', pos: 'WR', market: 'rush_rec_yds' })).toBeNull();
    expect(softSpot(null, { opp: 'KC', pos: 'WR', market: 'rec_yds' })).toBeNull();
  });
  test('sheet rows and PropFinder lines merge on player + market + line + side', () => {
    const sheet = [{ player: 'Josh Allen', team: 'BUF', market: 'pass_yds', group: 'passing', line: 245.5, side: 'over', odds: null, hit: { l10: 0.7 }, file: 'a.csv' }, { player: 'Josh Allen', team: 'BUF', market: 'pass_yds', group: 'passing', line: 245.5, side: 'over', odds: -115, hit: { l5: 0.6 }, file: 'b.csv' }];
    const pf = [{ name: 'Josh Allen', key: 'josh allen', team: 'BUF', pos: 'QB', games: [], props: [{ market: 'pass_yds', line: 245.5, odds: -120, underOdds: 100 }, { market: 'pass_td', line: 1.5, odds: -140 }] }];
    const c = mergeCandidates(sheet, pf);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ market: 'pass_yds', odds: -115, underOdds: 100, hit: { l10: 0.7, l5: 0.6 }, sources: ['a.csv', 'b.csv', 'propfinder'] });
    expect(c[1]).toMatchObject({ market: 'pass_td', odds: -140, sources: ['propfinder'] });
  });
});

const GAMES = [
  { id: 'g1', date: '2026-10-25T17:00Z', away: 'BUF', home: 'KC', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 1:00 PM' },
  { id: 'g2', date: '2026-10-25T20:25Z', away: 'DAL', home: 'PHI', final: false, state: 'pre', awayScore: null, homeScore: null, detail: 'Sun 4:25 PM' },
];
const row = (player, team, market, line, odds, hit, extra = {}) => ({ player, team, pos: 'WR', market, group: { pass_yds: 'passing', pass_td: 'passing', rec_yds: 'receiving', receptions: 'receiving', rush_yds: 'rushing', anytime_td: 'touchdowns' }[market], line, side: market === 'anytime_td' ? 'yes' : 'over', odds, hit, avg: {}, ...extra });

describe('NFL picks: the board', () => {
  const sheets = [{ id: 's1', fileName: 'props-wk7.csv', at: '2026-10-21T12:00:00Z', rows: [
    row('Josh Allen', 'BUF', 'pass_yds', 245.5, -115, { l5: 0.8, l10: 0.8, season: 0.8 }, { pos: 'QB' }),
    row('Patrick Mahomes', 'KC', 'pass_yds', 270.5, -110, { l5: 0.4, l10: 0.4, season: 0.4 }, { pos: 'QB' }),
    row('Josh Allen', 'BUF', 'pass_td', 1.5, -140, { l5: 0.8, l10: 0.7, season: 0.75 }, { pos: 'QB' }),
    row('Travis Kelce', 'KC', 'rec_yds', 62.5, -110, { l5: 0.6, l10: 0.6, season: 0.6 }, { pos: 'TE' }),
    row('Khalil Shakir', 'BUF', 'rec_yds', 48.5, 100, { l5: 1, l10: 0.9, season: 0.85 }),
    row('Keon Coleman', 'BUF', 'receptions', 3.5, -120, { l5: 0.2, l10: 0.3, season: 0.3 }),
    row('Isiah Pacheco', 'KC', 'anytime_td', 0.5, 110, { l5: 0.6, l10: 0.5, season: 0.5 }, { pos: 'RB' }),
    row('James Cook', 'BUF', 'anytime_td', 0.5, -130, { l5: 0.8, l10: 0.7, season: 0.65 }, { pos: 'RB' }),
    row('CeeDee Lamb', 'DAL', 'rec_yds', 80.5, -110, { l5: 0.6, l10: 0.6, season: 0.6 }),
  ] }];
  const pf = { at: '2026-10-21T13:00:00Z', data: { players: [
    { id: 'p1', name: 'Josh Allen', key: 'josh allen', team: 'BUF', pos: 'QB', games: LOGS, props: [{ market: 'pass_yds', line: 245.5, odds: -120, underOdds: 100 }, { market: 'rush_yds', line: 30.5, odds: -110, underOdds: -110 }] },
  ], defense: { count: 3, teams: { KC: { QB: { passYds: 260 }, TE: {} }, BUF: { TE: { recYds: 70 }, RB: { td: 0.9 } }, PHI: {} }, ranks: { KC: { QB: { passYds: 1 } }, BUF: { TE: { recYds: 3 }, RB: { td: 1 } } } } } };

  test('tables per game and group, over the floor first, fill-ins and a next line; prices, edge, form and soft spots', () => {
    const b = buildBoard({ season: 2026, week: 7, games: GAMES, sheets, pf, results: {} });
    expect(b.plays).toBe(10); // 9 sheet rows (pass_yds Allen merged with PF) + PF rush yards
    const g1 = b.games[0];
    expect(g1).toMatchObject({ id: 'g1', awayName: 'Bills', homeName: 'Chiefs', plays: 9, tally: null });
    const passing = g1.tables.passing;
    // Allen's logs clear both lines 8 of 10; the TD line's shorter price pulls its chance higher.
    expect(passing.rows.map((r) => [r.player, r.label, r.under || false])).toEqual([['Josh Allen', 'Pass TDs', false], ['Josh Allen', 'Pass yards', false], ['Patrick Mahomes', 'Pass yards', true]]);
    // PropFinder first: Allen's plays are backed by its logs and confirmed by the sheet; Mahomes is sheet-only, a fill-in.
    expect(passing.rows[0]).toMatchObject({ pfBacked: true, confirmed: true, sheetFiles: ['props-wk7.csv'] });
    expect(passing.rows[2]).toMatchObject({ pfBacked: false, sheetOnly: true, under: true });
    expect(passing.pfFirst).toBe(true);
    const allen = passing.rows[1];
    // The logs win over the sheet's columns: 4/5, 8/10, 8/10 against -115.
    expect(allen.rates).toMatchObject({ l5: 0.8, l10: 0.8, season: 0.8, n: 10, from: 'logs' });
    expect(allen.p).toBeCloseTo((10 * 0.8 + 6 * (115 / 215)) / 16, 3);
    expect(allen).toMatchObject({ odds: -115, fair: expect.stringMatching(/^-\d+$/), venue: 'A', opp: 'KC', form: null, sources: ['props-wk7.csv', 'propfinder'] });
    expect(allen.edge).toBeCloseTo(allen.p - 115 / 215, 3);
    expect(allen.spot).toMatchObject({ rank: 1, soft: true, key: 'passYds' });
    expect(allen.avg).toEqual({ l5: 264, l10: 264, season: 264 });
    // Mahomes is under the 55% floor: a fill-in, marked.
    expect(passing.rows[2].p).toBeLessThan(0.55);
    expect(passing.fallback).toBe(false);
    const receiving = g1.tables.receiving;
    expect(receiving.rows.map((r) => r.player)).toEqual(['Khalil Shakir', 'Travis Kelce', 'Keon Coleman']);
    expect(receiving.rows[0]).toMatchObject({ form: 'hot', rates: { from: 'sheet' } });
    expect(receiving.rows[2].under).toBe(true);
    expect(receiving.rows[1].spot).toMatchObject({ rank: 3, soft: false, tough: true });
    const td = g1.tables.touchdowns;
    expect(td.rows.map((r) => r.player)).toEqual(['James Cook', 'Isiah Pacheco']);
    expect(td.rows[1].spot).toMatchObject({ soft: true, key: 'td' });
    expect(g1.tables.rushing.rows.map((r) => [r.player, r.sources])).toEqual([['Josh Allen', ['propfinder']]]);
    expect(g1.tables.rushing.rows[0]).toMatchObject({ pfBacked: true, confirmed: false, onSheet: false });
    // Receiving has no PropFinder play: the sheet's rows fill in, marked sheet-only.
    expect(receiving.rows.map((r) => r.sheetOnly)).toEqual([true, true, true]);
    expect(b.notes.join(' ')).toMatch(/PropFinder first: 2 plays over the floor from its logs and lines, 2 of them also on a cheat sheet \(✓\); 5 sheet-only plays listed behind them/);
    expect(g1.tables.rushing.rows[0].rates.from).toBe('logs');
    // Game 2 has one receiving row and nothing else; the notes say so.
    expect(b.games[1].plays).toBe(1);
    expect(b.games[1].tables.passing.rows).toEqual([]);
    expect(b.notes.join(' ')).toMatch(/Richest game: BUF @ KC/);
    expect(b.notes.join(' ')).toMatch(/Softest spots: KC to QBs/);
    expect(b.notes.join(' ')).toMatch(/Running hot: Khalil Shakir/);
    expect(b.notes.join(' ')).toMatch(/Sources: 1 cheat sheet \(props-wk7.csv\); PropFinder pulled/);
    expect(b.sources).toMatchObject({ sheets: [{ id: 's1', rows: 9 }], propfinder: { players: 1, withProps: 1, withGames: 1 }, results: 0 });
  });
  test('a finished game grades every row against its box score', () => {
    const results = { g1: { id: 'g1', final: true, players: [
      { name: 'Josh Allen', team: 'BUF', passYds: 301, passTd: 1, rushYds: 44, recYds: 0, rec: 0, rushTd: 0, recTd: 0, retTd: 0 },
      { name: 'Khalil Shakir', team: 'BUF', recYds: 31, rec: 4, rushYds: 0, rushTd: 0, recTd: 1, retTd: 0 },
      { name: 'James Cook', team: 'BUF', rushYds: 90, recYds: 12, rec: 2, rushTd: 1, recTd: 0, retTd: 0 },
    ] } };
    const games = [{ ...GAMES[0], final: true, state: 'post', awayScore: 27, homeScore: 24, detail: 'Final' }, GAMES[1]];
    const b = buildBoard({ season: 2026, week: 7, games, sheets, pf, results });
    const g1 = b.games[0];
    const find = (group, player, label) => g1.tables[group].rows.find((r) => r.player === player && (!label || r.label === label));
    expect(find('passing', 'Josh Allen', 'Pass yards')).toMatchObject({ actual: 301, hit: true });
    expect(find('passing', 'Josh Allen', 'Pass TDs')).toMatchObject({ actual: 1, hit: false });
    expect(find('rushing', 'Josh Allen')).toMatchObject({ actual: 44, hit: true });
    expect(find('receiving', 'Khalil Shakir')).toMatchObject({ actual: 31, hit: false });
    expect(find('touchdowns', 'James Cook')).toMatchObject({ actual: 1, hit: true });
    // No box-score line: did not play.
    expect(find('receiving', 'Travis Kelce')).toMatchObject({ actual: null, hit: null });
    expect(find('passing', 'Patrick Mahomes')).toMatchObject({ actual: null });
    // The tally counts the rows over the floor that have a line: Allen's two passing plays, Shakir, Cook (his rushing fill-in hit, but was under the floor).
    expect(find('rushing', 'Josh Allen').under).toBe(true);
    expect(g1.tally).toEqual({ hit: 2, of: 4 });
    expect(actualFor(results.g1, { player: 'josh allen', key: 'josh allen', team: 'BUF' })).toMatchObject({ passYds: 301 });
    expect(actualFor(results.g1, { player: 'Nobody', key: 'nobody' })).toBeNull();
    expect(actualFor(null, { key: 'x' })).toBeUndefined();
  });
  test('an empty week says what to do', () => {
    const b = buildBoard({ season: 2026, week: 7, games: GAMES, sheets: [], pf: null, results: {} });
    expect(b.plays).toBe(0);
    expect(b.notes).toEqual([expect.stringMatching(/No plays yet in BUF @ KC, DAL @ PHI/), expect.stringMatching(/No data yet for this slate/)]);
  });
});
