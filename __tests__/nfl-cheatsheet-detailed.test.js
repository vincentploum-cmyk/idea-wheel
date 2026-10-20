import { describe, expect, test } from '@jest/globals';
import { fixLine, fixPrice, parseLines, resolveName, teamOf, headOf, pairTeams, rowsOf, parseColumn, parseDetailedPages } from '../lib/nfl/cheatsheet-detailed';
import { pdfImages } from '../lib/picks/ocr';
import { makeTextPdf } from '../lib/picks/pdf';
import page1 from './fixtures/ocr-nfl-detailed-page1.json';

const ROSTER = ['Drew Lock|SEA|QB', 'Jadarian Price|SEA|RB', 'Emanuel Wilson|SEA|RB', 'George Holani|SEA|RB', 'Jaxon Smith-Njigba|SEA|WR', 'AJ Barner|SEA|TE', 'Rashid Shaheed|SEA|WR', 'Cooper Kupp|SEA|WR', 'Tory Horton|SEA|WR', 'Elijah Arroyo|SEA|TE', 'Eric Saubert|SEA|TE',
  'Bo Nix|DEN|QB', 'Jonah Coleman|DEN|RB', 'J.K. Dobbins|DEN|RB', 'RJ Harvey|DEN|RB', 'Pat Bryant|DEN|WR', 'Jaylen Waddle|DEN|WR', 'Courtland Sutton|DEN|WR', 'Evan Engram|DEN|TE', 'Marvin Mims Jr.|DEN|WR', 'Troy Franklin|DEN|WR', 'Adam Trautman|DEN|TE', "Lil'Jordan Humphrey|DEN|WR", 'Nate Adkins|DEN|TE', 'Josh Allen|BUF|QB']
  .map((s) => { const [name, team, pos] = s.split('|'); return { name, team, pos }; });

describe('Detailed NFL cheat sheet (OCR)', () => {
  test('lines get their decimal back, prices read as American odds', () => {
    expect(fixLine('66.5', [5, 200])).toBe(66.5);
    expect(fixLine('665', [5, 200])).toBe(66.5);
    expect(fixLine('95', [1, 90])).toBe(9.5);
    expect(fixLine('2025', [100, 420])).toBe(202.5);
    expect(fixLine('7135', [1, 120])).toBe(13.5);
    expect(fixLine('135', [1, 120])).toBe(13.5);
    expect(fixLine('', [1, 90])).toBeNull();
    expect(parseLines([{ text: '665/95' }], [[5, 200], [1, 90]])).toEqual([66.5, 9.5]);
    expect(parseLines([{ text: '66.5' }, { text: '/' }, { text: '9.5' }], [[5, 200], [1, 90]])).toEqual([66.5, 9.5]);
    expect(parseLines([{ text: '—' }], [[2, 160]])).toEqual([null]);
    expect(parseLines([{ text: '46.5' }], [[5, 200], [1, 90]])).toEqual([46.5, null]);
    expect(fixPrice('110')).toBe(110); expect(fixPrice('-205')).toBe(-205); expect(fixPrice('2200')).toBe(2200); expect(fixPrice('—')).toBeNull(); expect(fixPrice('45')).toBeNull();
  });
  test('names resolve against the roster, misreads included', () => {
    expect(resolveName(['Jaxon', 'Smith-', 'Njigba'], ROSTER, 'SEA')).toMatchObject({ name: 'Jaxon Smith-Njigba', matched: true, pos: 'WR' });
    expect(resolveName(['AJ', 'Bammer'], ROSTER, 'SEA')).toMatchObject({ name: 'AJ Barner', matched: true });
    expect(resolveName(['Coil', 'Holani'], ROSTER, 'SEA')).toMatchObject({ name: 'George Holani', matched: true });
    expect(resolveName(['oxy', 'Horton'], ROSTER, 'SEA')).toMatchObject({ name: 'Tory Horton', matched: true });
    expect(resolveName(['JK.', 'Dobbins'], ROSTER, 'DEN')).toMatchObject({ name: 'J.K. Dobbins', matched: true });
    expect(resolveName(['Nobody', 'Here'], ROSTER, 'SEA')).toEqual({ name: 'Nobody Here', matched: false });
    expect(resolveName(['Josh', 'Allen'], [], null)).toEqual({ name: 'Josh Allen', matched: false });
  });
  test('a misread head falls back to the snapshot line, and the other column', () => {
    const row = (y, ...words) => words.map((t, i) => ({ text: t, x: 30 + i * 60, x1: 80 + i * 60, y: y - 10, y1: y }));
    const lv = [...row(118, 'WL', 'ilmaien:', 'ACT', '63'), ...row(166, 'BUF', 'Defense', 'Snapshot', 'use', 'for', 'evaluating', "LV's", 'offensive', 'players:')];
    expect(headOf(rowsOf(lv))).toEqual({ team: 'LV', opp: 'BUF' });
    const chi = [...row(115, '-.', 'E', 'CHI', 'Sloczoern', 'ACT64'), ...row(166, 'ATL', 'Defense', 'Snapshot', 'ruse', 'for', 'evaluating', 'Chis', 'offensive', 'players,')];
    expect(headOf(rowsOf(chi))).toEqual({ team: 'CHI', opp: 'ATL' });
    // The head read the opponent's code: the snapshot's "evaluating" wins.
    const wrong = [...row(118, 'BUF', '63', 'players'), ...row(166, 'BUF', 'Defense', 'Snapshot', 'use', 'for', 'evaluating', 'LACs', 'offensive', 'players')];
    expect(teamOf(rowsOf(wrong))).toBe('LAC');
    expect(pairTeams({ team: 'BUF', opp: 'LV' }, { team: 'BUF', opp: 'BUF' })).toEqual(['BUF', 'LV']);
    expect(pairTeams({ team: null, opp: 'DEN' }, { team: 'DEN', opp: 'SEA' })).toEqual(['SEA', 'DEN']);
    expect(pairTeams({ team: 'SEA', opp: 'DEN' }, { team: 'DEN', opp: 'SEA' })).toEqual(['SEA', 'DEN']);
    // "SD" read beside "SF" on the head row: the current code wins; and the schedule settles a pair.
    const sf = [...row(118, 'SD', 'SF', 'Tozer', 'ACTT2'), ...row(166, 'WAS', 'Tefense', 'Snapshot', 'fuse', 'for', 'evaluating', 'SEs', 'offensive', 'slaves,')];
    expect(headOf(rowsOf(sf))).toEqual({ team: 'SF', opp: 'WSH' });
    const sched = [{ away: 'WSH', home: 'SF' }, { away: 'LAC', home: 'KC' }];
    expect(pairTeams({ team: 'WSH', opp: 'SF' }, { team: 'LAC', opp: 'WSH' }, sched)).toEqual(['WSH', 'SF']);
    expect(pairTeams({ team: 'LAC', opp: 'KC' }, { team: 'KC', opp: 'LAC' }, sched)).toEqual(['LAC', 'KC']);
  });
  test('page 1 of the week 6 sheet: both teams, every line and anytime-TD price', () => {
    expect(teamOf(rowsOf(page1.left))).toBe('SEA');
    expect(teamOf(rowsOf(page1.right))).toBe('DEN');
    const { rows, games, warnings } = parseDetailedPages([page1], { roster: ROSTER });
    expect(games).toEqual([{ page: undefined, teams: ['SEA', 'DEN'] }]);
    const find = (player, market) => rows.find((r) => r.player === player && r.market === market);
    const line = (player, market) => find(player, market)?.line;
    const atd = (player) => find(player, 'anytime_td')?.odds;
    // Seahawks.
    expect(line('Emanuel Wilson', 'rush_yds')).toBe(66.5); expect(line('Emanuel Wilson', 'rec_yds')).toBe(9.5); expect(atd('Emanuel Wilson')).toBe(110);
    expect(line('George Holani', 'rush_yds')).toBe(13.5); expect(line('George Holani', 'rec_yds')).toBe(8.5); expect(atd('George Holani')).toBe(370);
    expect(line('Jaxon Smith-Njigba', 'rec_yds')).toBe(89.5); expect(atd('Jaxon Smith-Njigba')).toBe(110);
    expect(line('AJ Barner', 'rec_yds')).toBe(19.5); expect(atd('AJ Barner')).toBe(400);
    expect(line('Rashid Shaheed', 'rec_yds')).toBe(22.5); expect(atd('Rashid Shaheed')).toBe(425);
    expect(line('Cooper Kupp', 'rec_yds')).toBe(20.5); expect(atd('Cooper Kupp')).toBe(425);
    expect(line('Tory Horton', 'rec_yds')).toBe(5.5); expect(atd('Tory Horton')).toBe(750);
    expect(find('Elijah Arroyo', 'rec_yds')).toBeUndefined(); expect(atd('Elijah Arroyo')).toBe(950);
    expect(atd('Eric Saubert')).toBe(2200);
    expect(find('Drew Lock', 'pass_yds')).toBeUndefined();
    // Broncos.
    expect(line('Bo Nix', 'pass_yds')).toBe(202.5); expect(line('Bo Nix', 'rush_yds')).toBe(13.5); expect(atd('Bo Nix')).toBe(450);
    expect(line('J.K. Dobbins', 'rush_yds')).toBe(46.5); expect(atd('J.K. Dobbins')).toBe(155);
    expect(line('RJ Harvey', 'rush_yds')).toBe(14.5); expect(line('RJ Harvey', 'rec_yds')).toBe(20.5); expect(atd('RJ Harvey')).toBe(280);
    expect(line('Jaylen Waddle', 'rec_yds')).toBe(49.5); expect(atd('Jaylen Waddle')).toBe(260);
    expect(line('Courtland Sutton', 'rec_yds')).toBe(30.5); expect(atd('Courtland Sutton')).toBe(270);
    expect(line('Evan Engram', 'rec_yds')).toBe(21.5); expect(atd('Evan Engram')).toBe(600);
    expect(line('Marvin Mims Jr.', 'rec_yds')).toBe(13.5); expect(atd('Marvin Mims Jr.')).toBe(850);
    expect(line('Troy Franklin', 'rec_yds')).toBe(16.5); expect(atd('Troy Franklin')).toBe(950);
    expect(atd('Adam Trautman')).toBe(1100); expect(atd("Lil'Jordan Humphrey")).toBe(1700); expect(atd('Nate Adkins')).toBe(2000);
    expect(rows.every((r) => r.team === 'SEA' || r.team === 'DEN')).toBe(true);
    expect(warnings.filter((w) => /no team head/.test(w))).toEqual([]);
  });
  test('the page images come straight out of the PDF', () => {
    // A one-page PDF with one JPEG XObject, the way jsPDF writes an image page.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /XObject << /I0 4 0 R >> >> >>'];
    let pdf = '%PDF-1.4\n';
    objects.forEach((o, i) => { pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const head = Buffer.from(pdf, 'latin1');
    const dict = Buffer.from(`4 0 obj\n<<\n/Type /XObject\n/Subtype /Image\n/Width 1188\n/Height 3352\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Length ${jpeg.length}\n/Filter /DCTDecode\n>>\nstream\n`, 'latin1');
    const tail = Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');
    const images = pdfImages(Buffer.concat([head, dict, jpeg, tail]));
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ width: 1188, height: 3352 });
    expect(images[0].data.equals(jpeg)).toBe(true);
    expect(pdfImages(makeTextPdf([{ x: 10, y: 10, text: 'hi' }]))).toEqual([]);
  });
});
