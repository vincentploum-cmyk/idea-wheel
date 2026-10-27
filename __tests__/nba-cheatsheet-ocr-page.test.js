import { describe, expect, test } from '@jest/globals';
import { parseNbaPages } from '../lib/nba/cheatsheet-ocr';
import page from './fixtures/ocr-nba-suns-okc.json';

// The 2026-10-26 sheet's Suns · Thunder page through the fixed reader (the soft mask composited
// in): every row of both tables, grey rows included, and the tiles by grid position.
const ROSTER = [
  ['Devin Booker', 'PHX', 'G'], ['Jamaree Bouyea', 'PHX', 'G'], ['Miles Bridges', 'PHX', 'F'], ['Dillon Brooks', 'PHX', 'F'], ['Ryan Dunn', 'PHX', 'F'], ['Rasheer Fleming', 'PHX', 'F'], ['Collin Gillespie', 'PHX', 'G'], ['Jordan Goodwin', 'PHX', 'G'], ['Jalen Green', 'PHX', 'G'], ['Oso Ighodaro', 'PHX', 'F'], ['Luke Kennard', 'PHX', 'G'], ['Khaman Maluach', 'PHX', 'C'], ['Koa Peat', 'PHX', 'F'], ['Duop Reath', 'PHX', 'C'], ['Pat Spencer', 'PHX', 'G'], ['Drew Timme', 'PHX', 'F'], ['Mark Williams', 'PHX', 'C'],
  ['Brooks Barnhizer', 'OKC', 'F'], ['Alex Caruso', 'OKC', 'G'], ['Josh Dix', 'OKC', 'G'], ['Shai Gilgeous-Alexander', 'OKC', 'G'], ['Isaiah Hartenstein', 'OKC', 'C'], ['Chet Holmgren', 'OKC', 'C'], ['Aday Mara', 'OKC', 'C'], ['Jared McCain', 'OKC', 'G'], ['Ajay Mitchell', 'OKC', 'G'], ['Otega Oweh', 'OKC', 'G'], ['Micah Peavy', 'OKC', 'G'], ['Thomas Sorber', 'OKC', 'C'], ['Bennett Stirtz', 'OKC', 'G'], ['Nikola Topic', 'OKC', 'G'], ['Cason Wallace', 'OKC', 'G'], ['Jalen Williams', 'OKC', 'G'], ['Jaylin Williams', 'OKC', 'F'], ['Kenrich Williams', 'OKC', 'G'],
].map(([name, team, pos]) => ({ name, team, pos }));

describe('a real NBA page, both tables whole', () => {
  const parsed = parseNbaPages(page.pages, { roster: ROSTER, schedule: [{ away: 'PHX', home: 'OKC' }] });
  test('the game is paired and every player of both columns is read, grey rows included', () => {
    expect(parsed.games).toEqual([{ page: 1, teams: ['PHX', 'OKC'] }]);
    expect(parsed.warnings).toEqual([]);
    const names = (team) => parsed.rows.filter((r) => r.team === team).map((r) => r.player);
    expect(names('PHX')).toEqual(['Devin Booker', 'Miles Bridges', 'Dillon Brooks', 'Collin Gillespie', 'Jalen Green', 'Luke Kennard', 'Oso Ighodaro', 'Pat Spencer']);
    expect(names('OKC')).toEqual(['Shai Gilgeous-Alexander', 'Chet Holmgren', 'Ajay Mitchell', 'Cason Wallace', 'Jaylin Williams', 'Isaiah Hartenstein', 'Alex Caruso', 'Brooks Barnhizer']);
    const row = (name) => parsed.rows.find((r) => r.player === name);
    expect(row('Devin Booker')).toMatchObject({ team: 'PHX', market: null, group: 'players', avg: { min: 27, pts: 20.4, reb: 3.1, ast: 4.7, tpm: 1.4 } });
    expect(row('Miles Bridges').avg).toMatchObject({ pts: 16.1, reb: 5.5, ast: 3, tpm: 1.8 });   // a grey row
    expect(row('Pat Spencer').avg).toMatchObject({ pts: 5.7, reb: 1.9, ast: 2.8, tpm: 0.7 });    // the last grey row
    expect(row('Shai Gilgeous-Alexander').avg).toMatchObject({ pts: 26.1, reb: 3.5, ast: 5.6, tpm: 1.4 });   // a name wrapped over two lines
    expect(row('Chet Holmgren')).toMatchObject({ pos: 'C' });
    expect(row('Brooks Barnhizer').avg).toMatchObject({ pts: 0.8, reb: 1, ast: 0.3, tpm: 0.1 });
  });
  test('the tiles: what each side’s opponent gives up, by position and stat', () => {
    const { oppRanks } = parsed.meta;
    // The Suns' column lists what Phoenix's defense allows: on the board that is the environment OKC's players play in, and the other way round.
    expect(oppRanks.PHX.PG).toEqual({ pts: 16, reb: 11, ast: 19, tpm: 14 });
    expect(oppRanks.PHX.C).toMatchObject({ pts: 18, reb: 14, tpm: 19 });   // the 9th tile is the one the reader dropped on this page
    expect(oppRanks.OKC.PG).toEqual({ pts: 30, reb: 26, ast: 29, tpm: 27 });
    expect(oppRanks.OKC.SF).toMatchObject({ pts: 20, reb: 8, ast: 21, tpm: 2 });
    const count = (t) => Object.values(oppRanks[t]).reduce((s, r) => s + Object.keys(r).length, 0);
    expect(count('PHX')).toBeGreaterThanOrEqual(19);
    expect(count('OKC')).toBeGreaterThanOrEqual(19);
  });
});
