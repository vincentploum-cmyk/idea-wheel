import { describe, expect, test } from '@jest/globals';
import { runsToRows, pdfTables, makeTextPdf } from '../lib/picks/pdf';
import { parseCheatSheet as parseNfl } from '../lib/nfl/cheatsheet';

// A two-page-shaped table drawn as text at coordinates: a header row, then prop rows; the
// second page carries no header of its own.
const COLS = [40, 170, 230, 280, 400, 460, 510, 560];
const row = (y, cells, size = 10) => cells.map((text, i) => ({ x: COLS[i], y, text, size }));
const PAGE1 = [
  { x: 40, y: 760, text: 'NFL 2026 Week 6 cheat sheet', size: 16 },
  ...row(730, ['Player', 'Team', 'Opp', 'Market', 'Line', 'Odds', 'L10', 'Season'], 10),
  ...row(712, ['Josh Allen', 'BUF', '@ CAR', 'Passing Yards', '245.5', '-115', '7/10', '70%']),
  ...row(694, ['James Cook', 'BUF', '@ CAR', 'Rushing Yards', '74.5', '-110', '6/10', '65%']),
  ...row(676, ['Chuba Hubbard', 'CAR', 'vs BUF', 'Anytime TD', '', '+120', '4/10', '45%']),
];

describe('PDF cheat sheets', () => {
  test('text runs on one baseline become a row; a wide gap starts a cell, a narrow one joins', () => {
    const rows = runsToRows([
      { str: 'Josh', x: 40, y: 700, width: 22, size: 10 }, { str: 'Allen', x: 65, y: 700, width: 26, size: 10 },
      { str: 'BUF', x: 170, y: 700.8, width: 20, size: 10 }, { str: '245.5', x: 400, y: 699.5, width: 26, size: 10 },
      { str: 'Player', x: 40, y: 730, width: 30, size: 10 }, { str: '', x: 0, y: 0, width: 0, size: 10 },
    ]);
    // Three columns on the page: the title cell, then BUF's and the line's; the header row has only the first.
    expect(rows).toEqual([['Player'], ['Josh Allen', 'BUF', '245.5']]);
  });
  test('a generated PDF reads back as its table, through the NFL parser', async () => {
    const buffer = makeTextPdf(PAGE1);
    expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
    const tables = await pdfTables(buffer);
    expect(tables).toHaveLength(1);
    expect(tables[0].sheet).toBe('Page 1');
    expect(tables[0].rows[0]).toEqual(['NFL 2026 Week 6 cheat sheet']);
    expect(tables[0].rows[1]).toEqual(['Player', 'Team', 'Opp', 'Market', 'Line', 'Odds', 'L10', 'Season']);
    expect(tables[0].rows[2]).toEqual(['Josh Allen', 'BUF', '@ CAR', 'Passing Yards', '245.5', '-115', '7/10', '70%']);
    // The blank line cell of the anytime-TD row is not drawn; the odds still land in the odds column.
    expect(tables[0].rows[4]).toEqual(['Chuba Hubbard', 'CAR', 'vs BUF', 'Anytime TD', '', '+120', '4/10', '45%']);
    const { rows, warnings } = parseNfl({ buffer, fileName: 'NFL_2026_W6_detailed.pdf', tables });
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ player: 'Josh Allen', team: 'BUF', opp: 'CAR', venue: 'A', market: 'pass_yds', line: 245.5, odds: -115, hit: { l10: 0.7, l10N: 10, season: 0.7 } });
    expect(rows[2]).toMatchObject({ player: 'Chuba Hubbard', market: 'anytime_td', line: 0.5, side: 'yes', odds: 120 });
  });
  test('a page without a header reads under the previous page’s header; a repeated header row is not a player', () => {
    const tables = [
      { sheet: 'Page 1', rows: [['Player', 'Team', 'Opp', 'Market', 'Line', 'Odds'], ['Josh Allen', 'BUF', '@ CAR', 'Passing Yards', '245.5', '-115']] },
      { sheet: 'Page 2', rows: [['Player', 'Team', 'Opp', 'Market', 'Line', 'Odds'], ['James Cook', 'BUF', '@ CAR', 'Rushing Yards', '74.5', '-110']] },
      { sheet: 'Page 3', rows: [['Khalil Shakir', 'BUF', '@ CAR', 'Receiving Yards', '48.5', '+100'], ['Player', 'Team', 'Opp', 'Market', 'Line', 'Odds']] },
    ];
    const { rows, warnings, sheets } = parseNfl({ fileName: 'x.pdf', tables });
    expect(warnings).toEqual([]);
    expect(rows.map((r) => r.player)).toEqual(['Josh Allen', 'James Cook', 'Khalil Shakir']);
    expect(sheets.map((s) => s.rows)).toEqual([1, 1, 1]);
  });
});
