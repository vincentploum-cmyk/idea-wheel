import { describe, expect, test } from '@jest/globals';
import { parseLinesPage, parseTweetDate, parseLineTweet, splitNames, rosterMatcher, latestTeamLines, linesToPlayers, decodeEntities, tweetTime } from '../lib/nhl-data/gamedaytweets';
import { dueGames } from '../lib/nhl-data/ingest';
import { NYR_PAGE } from './fixtures/gamedaytweets';

const P = (id, name, pos) => ({ id, name, pos, team: 'NYR' });
const NYR = [
  P(1, 'Oliver Bjorkstrand', 'RW'), P(2, 'J.T. Miller', 'C'), P(3, 'Pavel Dorofeyev', 'LW'),
  P(4, 'Gabe Perreault', 'LW'), P(5, 'Mika Zibanejad', 'C'), P(6, 'Alexis Lafrenière', 'LW'),
  P(7, 'Will Cuylle', 'LW'), P(8, 'Noah Laba', 'C'), P(9, 'Eeli Tolvanen', 'LW'),
  P(10, 'Tanner Kartye', 'LW'), P(11, 'Joe Veleno', 'C'), P(12, 'Matt Rempe', 'RW'),
  P(13, 'Vladislav Gavrikov', 'D'), P(14, 'Adam Fox', 'D'), P(15, 'Elias Pettersson', 'D'), P(16, 'Sean Durzi', 'D'),
  P(17, 'Carter Šmits', 'D'), P(18, 'Braden Schneider', 'D'), P(19, 'Matthew Robertson', 'D'), P(20, 'Scott Morrow', 'D'),
  P(21, 'Igor Shesterkin', 'G'), P(22, 'Jonathan Korpisalo', 'G'),
];

describe('gamedaytweets page', () => {
  test('tweets come out newest first with handle, date and text', () => {
    const tweets = parseLinesPage(NYR_PAGE);
    expect(tweets).toHaveLength(3);
    expect(tweets[0]).toMatchObject({ handle: 'ColinSNewsday', date: '2026-09-30', id: '2105356143518273856' });
    expect(tweets[0].url).toBe('https://x.com/GameDayLines/status/2105356143518273856');
    expect(tweets[0].text.split('\n')[1]).toBe('Bjorkstrand-Miller-Dorofeyev');
    expect(tweets[2].text).toContain('Lafrenière');
    expect(tweets[1].text).toContain("I'm wondering");
  });
  test('a tweet id carries its posting time (snowflake)', () => {
    // Colin Stephenson's Rangers practice tweet from the fixture page: Sep 30, 2026, early afternoon ET.
    const at = tweetTime('2105356143518273856');
    expect(at.slice(0, 10)).toBe('2026-09-30');
    expect(parseLinesPage(NYR_PAGE)[0].at).toBe(at);
    expect(tweetTime('nope')).toBeNull();
    expect(new Date(tweetTime('2105079538430746826')).toISOString() < at).toBe(true); // Sep 29 < Sep 30
  });
  test('dueGames picks games starting within the window', () => {
    const now = Date.parse('2026-10-01T22:30:00Z');
    const sched = [{ id: 1, startTimeUTC: '2026-10-01T23:00:00Z' }, { id: 2, startTimeUTC: '2026-10-02T02:00:00Z' }, { id: 3, startTimeUTC: '2026-10-01T22:00:00Z' }];
    expect(dueGames(sched, 150, now).map((g) => g.id)).toEqual([1]);
    expect(dueGames(sched, 240, now).map((g) => g.id)).toEqual([1, 2]);
  });
  test('dates and entities', () => {
    expect(parseTweetDate('Sep 30, 2026')).toBe('2026-09-30');
    expect(parseTweetDate('Oct 7, 2026')).toBe('2026-10-07');
    expect(parseTweetDate('yesterday')).toBeNull();
    expect(decodeEntities('O&#39;Reilly &amp; Ekman&#x2011;Larsson &mdash; ok')).toBe("O'Reilly & Ekman‑Larsson — ok");
  });
});

describe('line parsing', () => {
  test('bare and spaced dashes both split into names; goalies and prose do not', () => {
    expect(splitNames('Bjorkstrand-Miller-Dorofeyev')).toEqual(['Bjorkstrand', 'Miller', 'Dorofeyev']);
    expect(splitNames('Stamkos - O\'Reilly - Kerfoot')).toEqual(['Stamkos', "O'Reilly", 'Kerfoot']);
    expect(splitNames('Ekman-Larsson - Stecher')).toEqual(['Ekman-Larsson', 'Stecher']);
    expect(splitNames('Carcone/O’Brien - Stenlund - But/Yamamoto')).toEqual(['Carcone', 'Stenlund', 'But']);
    expect(splitNames('(Del Mastro-Korchinski)')).toEqual(['Del Mastro', 'Korchinski']);
    expect(splitNames('Allen | Daws')).toBeNull();
    expect(splitNames('Lines from practice — defensive pairs have been shuffling')).toBeNull();
  });
  test('roster matcher: last names, initials, diacritics, position group breaks ties', () => {
    const m = rosterMatcher([...NYR, P(30, 'Jack Hughes', 'C'), P(31, 'Luke Hughes', 'D'), P(32, 'Aliaksei Protas', 'LW'), P(33, 'Ilya Protas', 'C')]);
    expect(m('Lafreniere').id).toBe(6);
    expect(m('Šmits').id).toBe(17);
    expect(m('Smits').id).toBe(17);
    expect(m('Hughes', 'F').id).toBe(30);
    expect(m('Hughes', 'D').id).toBe(31);
    expect(m('Hughes')).toBeNull();
    expect(m('A. Protas').id).toBe(32);
    expect(m('I Protas').id).toBe(33);
    expect(m('Nobody')).toBeNull();
  });
  test('a practice tweet becomes four lines and pairs; PP tweets do not qualify', () => {
    const tweets = parseLinesPage(NYR_PAGE);
    const lines = parseLineTweet(tweets[0].text, NYR);
    expect(lines.forwards).toHaveLength(4);
    expect(lines.defense).toHaveLength(4);
    expect(lines.forwards[0].map((p) => p.name)).toEqual(['Oliver Bjorkstrand', 'J.T. Miller', 'Pavel Dorofeyev']);
    expect(lines.defense[2].map((p) => p.id)).toEqual([17, 18]);
    expect(parseLineTweet(tweets[1].text, NYR)).toBeNull();
    const players = linesToPlayers(lines);
    expect(players['pavel dorofeyev']).toMatchObject({ pos: 'RW', line: 1, id: 3 });
    expect(players['matt rempe']).toMatchObject({ pos: 'RW', line: 4 });
    expect(players['adam fox']).toMatchObject({ pos: 'D', line: 1 });
  });
  test('hyphenated last names are re-joined when the roster knows them', () => {
    const roster = [P(1, 'Oliver Ekman-Larsson', 'D'), P(2, 'Troy Stecher', 'D'), P(3, 'Jake McCabe', 'D'), P(4, 'Chris Tanev', 'D'),
      P(5, 'Matthew Knies', 'LW'), P(6, 'Auston Matthews', 'C'), P(7, 'William Nylander', 'RW'), P(8, 'Bobby McMann', 'LW'), P(9, 'John Tavares', 'C'), P(10, 'Max Domi', 'RW'),
      P(11, 'Nicholas Robertson', 'LW'), P(12, 'Scott Laughton', 'C'), P(13, 'Calle Järnkrok', 'RW')];
    const lines = parseLineTweet('Leafs lines\nKnies-Matthews-Nylander\nMcMann-Tavares-Domi\nRobertson-Laughton-Jarnkrok\nMcCabe-Tanev\nEkman-Larsson-Stecher', roster);
    expect(lines.forwards).toHaveLength(3);
    expect(lines.forwards[2][2].id).toBe(13);
    expect(lines.defense).toHaveLength(2);
    expect(lines.defense[1].map((p) => p.name)).toEqual(['Oliver Ekman-Larsson', 'Troy Stecher']);
  });
  test('latestTeamLines skips power-play tweets and respects the date floor', () => {
    const got = latestTeamLines(NYR_PAGE, NYR, { since: '2026-09-29' });
    expect(got).toMatchObject({ forwards: 4, pairs: 4, meta: { handle: 'ColinSNewsday', date: '2026-09-30', source: 'gamedaytweets' } });
    expect(got.matched).toBe(20);
    expect(latestTeamLines(NYR_PAGE, NYR, { since: '2026-10-01' })).toBeNull();
  });
});

describe('merging lineup reads', () => {
  test('a read that found nothing never erases lines captured earlier', async () => {
    const { mergeGdt } = await import('../lib/nhl-data/ingest');
    const prev = { NYR: { players: { a: 1 }, matched: 20 }, BUF: { none: true } };
    const fresh = { NYR: { error: 'gamedaytweets answered 403 for NYR' }, BUF: { players: { b: 1 } }, CBJ: { none: true } };
    expect(mergeGdt(prev, fresh)).toEqual({ NYR: prev.NYR, BUF: fresh.BUF, CBJ: fresh.CBJ });
    expect(mergeGdt(null, fresh)).toEqual(fresh);
  });
});
