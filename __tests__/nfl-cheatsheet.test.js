import { describe, expect, test } from '@jest/globals';
import * as XLSX from 'xlsx';
import { parseCheatSheet, classifyHeader, parsePlayerCell, parseSide, findHeader } from '../lib/nfl/cheatsheet';

const LONG = `Exported,2026-10-14
Week,7

Player,Team,Opp,Pos,Market,Line,Side,Odds,L5,L10,Season,H2H,Avg L5,Proj
Josh Allen QB,BUF,@ KC,QB,Passing Yards,245.5,Over,-115,3/5,7/10,70%,1/2,262.4,258
Josh Allen QB,BUF,@ KC,QB,Passing TDs,1.5,Over,-140,4/5,8/10,80%,,2.2,2.1
Patrick Mahomes,KC,vs BUF,QB,Pass Yds,270.5,Under,+100,2/5,4/10,45%,,,
Travis Kelce,KC,vs BUF,TE,Receptions,5.5,O,-120,4/5,6/10,60%,2/2,6.2,6
Isiah Pacheco,KC,vs BUF,RB,Anytime TD,,Yes,+110,3/5,5/10,50%,,,
James Cook (BUF),BUF,@ KC,RB,Rushing Yards,74.5,,-110,4/5,6/10,65%,,88,80
Total,,,,,,,,,,,,,
`;

describe('Cheat sheet headers', () => {
  test('columns are recognised by role, window and market', () => {
    expect(classifyHeader('Player')).toEqual({ role: 'player' });
    expect(classifyHeader('Opp')).toEqual({ role: 'opp' });
    expect(classifyHeader('Market')).toEqual({ role: 'market' });
    expect(classifyHeader('Line')).toEqual({ role: 'line' });
    expect(classifyHeader('Over Odds')).toEqual({ role: 'odds' });
    expect(classifyHeader('Under Odds')).toEqual({ role: 'underOdds' });
    expect(classifyHeader('L5')).toEqual({ role: 'hit', window: 'l5' });
    expect(classifyHeader('Last 10 Hit %')).toEqual({ role: 'hit', window: 'l10' });
    expect(classifyHeader('2026 Hit Rate')).toEqual({ role: 'hit', window: 'season' });
    expect(classifyHeader('H2H')).toEqual({ role: 'hit', window: 'h2h' });
    expect(classifyHeader('Avg L5')).toEqual({ role: 'avg', window: 'l5' });
    expect(classifyHeader('Hit %')).toEqual({ role: 'hit', window: 'all' });
    expect(classifyHeader('Rec Yds')).toEqual({ role: 'wide', market: 'rec_yds', part: 'line' });
    expect(classifyHeader('Rec Yds Odds')).toEqual({ role: 'wide', market: 'rec_yds', part: 'odds' });
    expect(classifyHeader('Rec Yds L10 %')).toEqual({ role: 'wide', market: 'rec_yds', part: 'hit', window: 'l10' });
    expect(classifyHeader('')).toBeNull();
    expect(classifyHeader('Notes')).toBeNull();
  });
  test('player cells carry a position or a team', () => {
    expect(parsePlayerCell('Josh Allen QB')).toEqual({ name: 'Josh Allen', pos: 'QB', team: null });
    expect(parsePlayerCell('James Cook (BUF)')).toEqual({ name: 'James Cook', pos: null, team: 'BUF' });
    expect(parsePlayerCell('Ja\'Marr Chase - CIN - WR')).toEqual({ name: "Ja'Marr Chase", pos: 'WR', team: 'CIN' });
    expect(parsePlayerCell('Amon-Ra St. Brown')).toEqual({ name: 'Amon-Ra St. Brown', pos: null, team: null });
    expect(parseSide('Over')).toBe('over'); expect(parseSide('u')).toBe('under'); expect(parseSide('Yes')).toBe('yes'); expect(parseSide('')).toBeNull();
  });
});

describe('Cheat sheet: long layout (one row per prop)', () => {
  test('rows after a preamble, every column read', () => {
    const { rows, warnings, sheets } = parseCheatSheet({ text: LONG, fileName: 'props-wk7.csv' });
    expect(warnings).toEqual([]);
    expect(sheets).toEqual([{ name: null, rows: 6, market: null, layout: 'long' }]);
    expect(rows).toHaveLength(6);
    const allen = rows[0];
    expect(allen).toMatchObject({ player: 'Josh Allen', team: 'BUF', opp: 'KC', venue: 'A', pos: 'QB', market: 'pass_yds', group: 'passing', line: 245.5, side: 'over', odds: -115, proj: 258 });
    expect(allen.hit).toEqual({ l5: 0.6, l5N: 5, l10: 0.7, l10N: 10, season: 0.7, h2h: 0.5, h2hN: 2 });
    expect(allen.avg).toEqual({ l5: 262.4 });
    expect(rows[2]).toMatchObject({ player: 'Patrick Mahomes', venue: 'H', side: 'under', odds: 100 });
    expect(rows[3]).toMatchObject({ market: 'receptions', side: 'over', odds: -120 });
    // A scorer market without a line is a yes at 0.5; an empty side is over.
    expect(rows[4]).toMatchObject({ market: 'anytime_td', group: 'touchdowns', line: 0.5, side: 'yes', odds: 110 });
    expect(rows[5]).toMatchObject({ player: 'James Cook', team: 'BUF', market: 'rush_yds', side: 'over', odds: -110, avg: { l5: 88 } });
  });
  test('a market in the cell text with its line, a tab-separated file, an unknown market warned', () => {
    const tsv = 'Player\tTeam\tProp\tOdds\nJosh Allen\tBUF\tOver 245.5 Passing Yards\t-115\nJosh Allen\tBUF\tFoo Bar 3.5\t-110\n';
    const { rows, warnings } = parseCheatSheet({ text: tsv, fileName: 'x.tsv' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ market: 'pass_yds', line: 245.5, side: 'over', odds: -115 });
    expect(warnings[0]).toMatch(/unknown market "Foo Bar 3.5"/);
  });
  test('the file name supplies the market when the sheet has none', () => {
    const csv = 'Player,Team,Opp,Line,Odds,L10\nJosh Allen,BUF,KC,245.5,-115,7/10\n';
    const { rows } = parseCheatSheet({ text: csv, fileName: 'passing-yards-cheatsheet-week-7.csv' });
    expect(rows[0]).toMatchObject({ market: 'pass_yds', line: 245.5, opp: 'KC' });
    const td = parseCheatSheet({ text: 'Player,Team,Opp,Odds,Season\nIsiah Pacheco,KC,BUF,+110,50%\n', fileName: 'anytime-td-wk7.csv' });
    expect(td.rows[0]).toMatchObject({ market: 'anytime_td', line: 0.5, side: 'yes', odds: 110, hit: { season: 0.5 } });
  });
  test('no header → a warning, no rows', () => {
    const { rows, warnings } = parseCheatSheet({ text: 'a,b\n1,2\n', fileName: 'x.csv' });
    expect(rows).toEqual([]);
    expect(warnings[0]).toMatch(/no header row/);
    expect(findHeader([['x'], ['Player', 'Line']])).toBe(1);
  });
});

describe('Cheat sheet: wide layout (one row per player, a column per market)', () => {
  test('an Excel workbook with market-named columns, odds and hit columns beside them; a sheet named after a market', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Week 7 receivers'], [],
      ['Player', 'Team', 'Matchup', 'Pos', 'Rec Yds', 'Rec Yds Odds', 'Rec Yds L10 %', 'Receptions', 'Receptions Odds', 'Season Hit %'],
      ['Travis Kelce', 'KC', 'BUF @ KC', 'TE', 62.5, '-110', '60%', 5.5, -120, '55%'],
      ['Khalil Shakir', 'BUF', 'BUF @ KC', 'WR', 48.5, '+100', '7/10', '', '', '50%'],
    ]), 'Receiving');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Player', 'Team', 'Opp', 'Odds', 'L5', 'L10'],
      ['Isiah Pacheco', 'KC', 'vs BUF', '+110', '3/5', '5/10'],
    ]), 'Anytime TD');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const { rows, warnings, sheets } = parseCheatSheet({ buffer, fileName: 'wk7-sheet.xlsx' });
    expect(warnings).toEqual([]);
    expect(sheets.map((s) => [s.name, s.rows, s.layout, s.market])).toEqual([['Receiving', 3, 'wide', null], ['Anytime TD', 1, 'long', 'anytime_td']]);
    expect(rows.find((r) => r.player === 'Travis Kelce' && r.market === 'rec_yds')).toMatchObject({ team: 'KC', opp: 'BUF', venue: 'H', line: 62.5, odds: -110, hit: { l10: 0.6, season: 0.55 } });
    expect(rows.find((r) => r.player === 'Travis Kelce' && r.market === 'receptions')).toMatchObject({ line: 5.5, odds: -120 });
    expect(rows.filter((r) => r.player === 'Khalil Shakir')).toHaveLength(1);
    expect(rows.find((r) => r.player === 'Khalil Shakir')).toMatchObject({ venue: 'A', market: 'rec_yds', odds: 100, hit: { l10: 0.7, season: 0.5 } });
    expect(rows.find((r) => r.player === 'Isiah Pacheco')).toMatchObject({ market: 'anytime_td', side: 'yes', line: 0.5, odds: 110, opp: 'BUF', venue: 'H', sheet: 'Anytime TD' });
  });
});
