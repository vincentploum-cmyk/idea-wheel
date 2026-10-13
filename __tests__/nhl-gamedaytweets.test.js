import { describe, expect, test } from '@jest/globals';
import { parseLinesPage, parseTweetDate, parseLineTweet, splitNames, rosterMatcher, latestTeamLines, linesToPlayers, decodeEntities, tweetTime, confirmsSameLines } from '../lib/nhl-data/gamedaytweets';
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
  test('blocks the page script has already marked for the embed widget still count', () => {
    // In a browser the newest blocks read class="tweet full-sized-tweet twitter-tweet" and the dash is a literal em dash.
    const rendered = NYR_PAGE.replace('<blockquote class="tweet full-sized-tweet">', '<blockquote class="tweet full-sized-tweet twitter-tweet">').replace('&mdash;', '—');
    const tweets = parseLinesPage(rendered);
    expect(tweets).toHaveLength(3);
    expect(tweets[0]).toMatchObject({ handle: 'ColinSNewsday', date: '2026-09-30' });
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
    expect(lines.defense).toHaveLength(3); // the practice extras pair never gets a slot
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
  test('the roster tells a pair from a short forward line; a hyphen-joined pair of surnames is not a first name', () => {
    // Florida vs Minnesota, 2026-10-10 (@JamesonCoop): Bennett and two Tkachuks on the first line once
    // read as the pair "Verhaeghe – Bennett-Tkachuk" (Brady, from "Bennett" taken for a first name).
    const FLA = [P(1, 'Carter Verhaeghe', 'C'), P(2, 'Sam Bennett', 'C'), P(3, 'Matthew Tkachuk', 'LW'), P(4, 'Brady Tkachuk', 'LW'),
      P(5, 'Eetu Luostarinen', 'LW'), P(6, 'Anton Lundell', 'C'), P(7, 'Sandis Vilmanis', 'RW'), P(8, 'Lars Eller', 'C'), P(9, 'Sam Reinhart', 'RW'),
      P(10, 'Bokondji Imama', 'LW'), P(11, 'Sam Lafferty', 'C'), P(12, 'Garnet Hathaway', 'RW'),
      P(13, 'Gustav Forsling', 'D'), P(14, 'Aaron Ekblad', 'D'), P(15, 'Niko Mikkola', 'D'), P(16, 'Seth Jones', 'D'), P(17, 'Dmitry Kulikov', 'D'), P(18, 'Radko Gudas', 'D')];
    const m = rosterMatcher(FLA);
    expect(m('Bennett-Tkachuk')).toBeNull();
    expect(m('B. Tkachuk').id).toBe(4);
    expect(m('Tkachuk', 'F')).toBeNull();
    const fla = parseLineTweet('#FlaPanthers lines vs. Wild 👇\nVerhaeghe - Bennett - Tkachuk\nLuostarinen - Lundell - Vilmanis\nB. Tkachuk - Eller - Reinhart\nImama - Lafferty - Hathaway\nForsling - Ekblad\nMikkola - Jones\nKulikov - Gudas\nMarkstrom\nSchmid', FLA);
    expect(fla.forwards.map((l) => l.map((p) => p.name))).toEqual([
      ['Carter Verhaeghe', 'Sam Bennett', 'Matthew Tkachuk'], ['Eetu Luostarinen', 'Anton Lundell', 'Sandis Vilmanis'],
      ['Brady Tkachuk', 'Lars Eller', 'Sam Reinhart'], ['Bokondji Imama', 'Sam Lafferty', 'Garnet Hathaway']]);
    // The bare "Tkachuk" is the one the tweet did not place elsewhere.
    expect(fla.forwards[0][2].id).toBe(3);
    expect(fla.defense.map((l) => l.map((p) => p.id))).toEqual([[13, 14], [15, 16], [17, 18]]);
    expect(linesToPlayers(fla)['carter verhaeghe']).toMatchObject({ pos: 'LW', line: 1 });
    expect(linesToPlayers(fla)['seth jones']).toMatchObject({ pos: 'D', line: 2 });
    // Tampa vs Minnesota, 2026-10-08 (@BenjaminJReport): 11 forwards and 7 defensemen, "Geekie-Viel" the
    // two-man fourth line, the seventh defenseman on his own; once read as four pairs with Geekie-Viel first.
    const TBL = [P(1, 'Gage Goncalves', 'C'), P(2, 'Brayden Point', 'C'), P(3, 'Nikita Kucherov', 'RW'), P(4, 'Brandon Hagel', 'LW'), P(5, 'Anthony Cirelli', 'C'),
      P(6, 'Jake Guentzel', 'LW'), P(7, 'Ilya Mikheyev', 'RW'), P(8, 'Zemgus Girgensons', 'C'), P(9, 'Pontus Holmberg', 'C'), P(10, 'Conor Geekie', 'C'), P(11, 'Jeffrey Viel', 'LW'),
      P(12, 'J.J. Moser', 'D'), P(13, 'John Carlson', 'D'), P(14, 'Ryan McDonagh', 'D'), P(15, 'Erik Cernak', 'D'), P(16, 'Victor Hedman', 'D'), P(17, 'Max Crozier', 'D'), P(18, 'Charle-Edouard D\'Astous', 'D')];
    const tbl = parseLineTweet('The #GoBolts warmup lines unchanged as they go 11 & 7, Hildeby gets his first start ⬇️\nGoncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nMikheyev-Girgensons-Holmberg\nGeekie-Viel\nMoser-Carlson\nMcDonagh-Cernak\nHedman-Crozier\nD\'Astous\n🥅: Hildeby', TBL);
    expect(tbl.forwards).toHaveLength(4);
    expect(tbl.forwards[3].map((p) => p.name)).toEqual(['Conor Geekie', 'Jeffrey Viel']);
    expect(tbl.defense.map((l) => l.map((p) => p.name))).toEqual([['J.J. Moser', 'John Carlson'], ['Ryan McDonagh', 'Erik Cernak'], ['Victor Hedman', 'Max Crozier']]);
    const players = linesToPlayers(tbl);
    expect(players['conor geekie']).toMatchObject({ pos: 'LW', line: 4 });
    expect(players['jeffrey viel']).toMatchObject({ pos: 'C', line: 4 });
    expect(players['max crozier']).toMatchObject({ pos: 'D', line: 3 });
    expect(players['charle edouard dastous']).toBeUndefined();
    // A fourth pair never gets a slot: three pairs at most.
    const four = parseLineTweet('Goncalves-Point-Kucherov\nHagel-Cirelli-Guentzel\nMikheyev-Girgensons-Holmberg\nMoser-Carlson\nMcDonagh-Cernak\nHedman-Crozier\nD\'Astous-Moser', TBL);
    expect(four.defense).toHaveLength(3);
  });
  test('latestTeamLines with a cutoff answers for the game, not the next practice', () => {
    // Sep 29 game at 23:00Z: the Sep 30 practice tweet (17:56Z) is after the game; the warm-ups tweet (23:37Z, inside the window) wins.
    const got = latestTeamLines(NYR_PAGE, NYR, { since: '2026-09-28', until: '2026-09-30T03:00:00.000Z' });
    expect(got.meta).toMatchObject({ handle: 'Peter_Baugh', date: '2026-09-29' });
    expect(got.players['gabe perreault']).toMatchObject({ pos: 'LW', line: 1 });
    expect(got.players['oliver bjorkstrand']).toMatchObject({ pos: 'LW', line: 2 });
    // A cutoff before the warm-ups: nothing usable in the window (the Sep 28 tweet is power play only).
    expect(latestTeamLines(NYR_PAGE, NYR, { since: '2026-09-28', until: '2026-09-29T20:00:00.000Z' })).toBeNull();
    // Without a cutoff the newest tweet still wins.
    expect(latestTeamLines(NYR_PAGE, NYR, { since: '2026-09-28' }).meta.date).toBe('2026-09-30');
  });
  test("gdtCutoffs: a team's tweets count until four hours after its game starts", () => {
    const { gdtCutoffs } = require('../lib/nhl-data/ingest');
    const c = gdtCutoffs([{ away: 'NYR', home: 'NJD', startTimeUTC: '2026-09-29T23:00:00Z' }, { away: 'BOS', home: 'MTL' }]);
    expect(c.NYR).toBe('2026-09-30T03:00:00.000Z');
    expect(c.NJD).toBe(c.NYR);
    expect(c.BOS).toBeNull();
    expect(c.TOR).toBeUndefined();
  });
  test('latestTeamLines skips power-play tweets and respects the date floor', () => {
    const got = latestTeamLines(NYR_PAGE, NYR, { since: '2026-09-29' });
    expect(got).toMatchObject({ forwards: 4, pairs: 3, meta: { handle: 'ColinSNewsday', date: '2026-09-30', source: 'gamedaytweets' } });
    expect(got.matched).toBe(18);
    expect(latestTeamLines(NYR_PAGE, NYR, { since: '2026-10-01' })).toBeNull();
  });
});

describe('a tweet that confirms the lines without repeating them', () => {
  // A page of two tweets: the game-day "same lineup" note, then the previous day's practice lines.
  const snowflake = (iso) => String((BigInt(Date.parse(iso)) - 1288834974657n) << 22n);
  const block = (handle, id, dateText, text) => `<blockquote class="tweet full-sized-tweet"><div><a class="handle" href="https://x.com/${handle}">@${handle}</a></div><p><a class="handle" href="https://x.com/${handle}">@${handle}</a>${text.replace(/\n/g, '<br>')}</p><a href="https://x.com/${handle}/status/${id}">${dateText}</a></blockquote>`;
  const practice = 'Rangers practice lines:\nPerreault-Miller-Bjorkstrand\nCuylle-Zibanejad-Dorofeyev\nLafreniere-Laba-Tolvanen\nKartye-Veleno-Rempe\nGavrikov-Fox\nPettersson-Durzi\nSmits-Schneider';
  const page = `<html><body>${block('smclaughlin9', snowflake('2026-10-10T15:47:00Z'), 'Oct 10, 2026', 'Sturm: Same lineup, Swayman in net.')}${block('A_Fantucchio', snowflake('2026-10-09T15:49:00Z'), 'Oct 9, 2026', practice)}</body></html>`;
  test('the phrases that count as a confirmation', () => {
    for (const t of ['Sturm: Same lineup, Swayman in net.', 'No changes to the lines from Tuesday', 'Lines unchanged.', 'Same group as last game', 'Running it back tonight']) expect(confirmsSameLines(t)).toBe(true);
    for (const t of ['Perreault-Miller-Bjorkstrand', 'Swayman starts', 'Lines at practice:', 'PP1: Fox, Miller, Zibanejad']) expect(confirmsSameLines(t)).toBe(false);
  });
  test('the confirmation stands for the previous lines tweet, with its own time and link', () => {
    const got = latestTeamLines(page, NYR, { since: '2026-10-10', until: '2026-10-11T03:00:00.000Z' });
    expect(got).not.toBeNull();
    expect(got.forwards).toBe(4);
    expect(got.players['gabe perreault']).toMatchObject({ pos: 'LW', line: 1 });
    expect(got.players['carter smits']).toMatchObject({ pos: 'D', line: 3 });
    // Game-day in every way the site reads it: the time, date and link are the confirmation's.
    expect(got.meta).toMatchObject({ handle: 'smclaughlin9', date: '2026-10-10', at: '2026-10-10T15:47:00.000Z', confirmed: true });
    expect(got.meta.linesFrom).toMatchObject({ handle: 'A_Fantucchio', date: '2026-10-09' });
    // Without the confirmation in the window, the floor still applies and the practice tweet is before it.
    expect(latestTeamLines(page, NYR, { since: '2026-10-10', until: '2026-10-10T15:00:00.000Z' })).toBeNull();
    // Yesterday's read: the practice lines on their own.
    expect(latestTeamLines(page, NYR, { since: '2026-10-09', until: '2026-10-10T03:00:00.000Z' }).meta).toMatchObject({ handle: 'A_Fantucchio', date: '2026-10-09' });
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

describe('a tweet that changes some lines without reposting them', () => {
  const { parseLineChanges, applyLineChanges } = require('../lib/nhl-data/gamedaytweets');
  const D = (id, name, pos) => ({ id, name, pos, team: 'NJD' });
  const NJD = [
    D(1, 'Timo Meier', 'LW'), D(2, 'Nico Hischier', 'C'), D(3, 'Stefan Noesen', 'RW'),
    D(4, 'Jesper Bratt', 'LW'), D(5, 'Jack Hughes', 'C'), D(6, 'Anthony Mantha', 'RW'),
    D(7, 'Arseny Gritsyuk', 'LW'), D(8, 'Evgenii Rodrigues', 'C'), D(9, 'Dawson Mercer', 'RW'),
    D(10, 'Nolan Lombardi', 'LW'), D(11, 'Cody Glass', 'C'), D(12, 'Jesper Boqvist', 'RW'),
    D(13, 'Luke Hughes', 'D'), D(14, 'Dougie Hamilton', 'D'), D(15, 'Jonas Siegenthaler', 'D'),
    D(16, 'Brett Pesce', 'D'), D(17, 'Brenden Dillon', 'D'), D(18, 'Simon Nemec', 'D'), D(19, 'Jacob Markstrom', 'G'),
  ];
  const snowflake = (iso) => String((BigInt(Date.parse(iso)) - 1288834974657n) << 22n);
  const block = (handle, id, dateText, text) => `<blockquote class="tweet full-sized-tweet"><div><a class="handle" href="https://x.com/${handle}">@${handle}</a></div><p><a class="handle" href="https://x.com/${handle}">@${handle}</a>${text.replace(/\n/g, '<br>')}</p><a href="https://x.com/${handle}/status/${id}">${dateText}</a></blockquote>`;
  const full = 'Devils lines at morning skate:\nMeier-Hischier-Noesen\nBratt-Hughes-Mantha\nGritsyuk-Rodrigues-Mercer\nLombardi-Glass-Boqvist\nL. Hughes-Hamilton\nSiegenthaler-Pesce\nDillon-Nemec';
  const change = '#NJDevils line changes:\n\nArseny Gritsyuk is headed up to the Jack Hughes line with Jesper Bratt tonight.\n\nMercer up with Timo and Nico.\n\nMantha with Rodrigues and Noesen.';
  const page = `<html><body>${block('amandacstein', snowflake('2026-10-13T21:35:00Z'), 'Oct 13, 2026', change)}${block('amandacstein', snowflake('2026-10-13T15:10:00Z'), 'Oct 13, 2026', full)}</body></html>`;

  test('the sentences become groups of roster players, first names included', () => {
    const groups = parseLineChanges(change, NJD);
    expect(groups.map((g) => g.players.map((p) => p.name))).toEqual([
      ['Arseny Gritsyuk', 'Jack Hughes', 'Jesper Bratt'],
      ['Dawson Mercer', 'Timo Meier', 'Nico Hischier'],
      ['Anthony Mantha', 'Evgenii Rodrigues', 'Stefan Noesen'],
    ]);
    // No cue, a confirmation, or only the power play: not a change tweet.
    expect(parseLineChanges('Markstrom starts tonight.', NJD)).toBeNull();
    expect(parseLineChanges('No changes to the lines tonight.', NJD)).toBeNull();
    expect(parseLineChanges('Line changes: PP1 with Hughes, Bratt and Meier', NJD)).toBeNull();
  });

  test('the groups land on the lines they share players with; stayers keep their slots, the vacated slots fill in the order named', () => {
    const lines = applyLineChanges(parseLineTweet(full, NJD), parseLineChanges(change, NJD));
    expect(lines.forwards.map((row) => row.map((p) => p.name))).toEqual([
      ['Timo Meier', 'Nico Hischier', 'Dawson Mercer'],
      ['Jesper Bratt', 'Jack Hughes', 'Arseny Gritsyuk'],
      ['Anthony Mantha', 'Evgenii Rodrigues', 'Stefan Noesen'],
      ['Nolan Lombardi', 'Cody Glass', 'Jesper Boqvist'],
    ]);
    expect(lines.defense).toHaveLength(3);
  });

  test('a lone move is a swap: the newcomer takes the slot and the player he pushed off takes his', () => {
    const lines = applyLineChanges(parseLineTweet(full, NJD), parseLineChanges('Lineup change: Mercer moves up with Hischier and Meier.', NJD));
    expect(lines.forwards[0].map((p) => p.name)).toEqual(['Timo Meier', 'Nico Hischier', 'Dawson Mercer']);
    expect(lines.forwards[2].map((p) => p.name)).toEqual(['Arseny Gritsyuk', 'Evgenii Rodrigues', 'Stefan Noesen']);
  });

  test('latestTeamLines applies the change tweet to the full lines before it, with the change tweet\'s time and link', () => {
    const got = latestTeamLines(page, NJD, { since: '2026-10-13', until: '2026-10-14T03:00:00.000Z' });
    expect(got.players['arseny gritsyuk']).toMatchObject({ pos: 'RW', line: 2 });
    expect(got.players['dawson mercer']).toMatchObject({ pos: 'RW', line: 1 });
    expect(got.players['anthony mantha']).toMatchObject({ pos: 'LW', line: 3 });
    expect(got.players['stefan noesen']).toMatchObject({ pos: 'RW', line: 3 });
    expect(got.players['luke hughes']).toMatchObject({ pos: 'D', line: 1 });
    expect(got.forwards).toBe(4);
    expect(got.meta).toMatchObject({ handle: 'amandacstein', at: '2026-10-13T21:35:00.000Z', changed: 1 });
    expect(got.meta.linesFrom.at).toBe('2026-10-13T15:10:00.000Z');
    // Read before the change was posted: the morning lines as they were.
    expect(latestTeamLines(page, NJD, { since: '2026-10-13', until: '2026-10-13T20:00:00.000Z' }).players['dawson mercer']).toMatchObject({ pos: 'RW', line: 3 });
  });
});
