import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { parseInjuries } from '../lib/nba/espn';
import { parseInjuries as parseNflInjuries } from '../lib/nfl/espn';
import { applyEspnInjuries, applyOverrides, applyBoxScores, absentByTeam, isOut, statusOf, healthOf } from '../lib/picks/injuries';
import { normName } from '../lib/nhl-data/names';
import { fetchInjuries as fetchNflReport } from '../lib/nfl/propfinder-nfl';
import { fetchInjuries as fetchNbaReport } from '../lib/nba/propfinder-nba';

// ESPN's league injury feed as served on 2026-10-31 16:02Z, trimmed to IND, POR and UTA (the logos and links dropped).
const feedJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/espn-nba-injuries.json'), 'utf8'));

describe('ESPN’s league injury feed', () => {
  const feed = parseInjuries(feedJson);
  test('one row a listed player, the fantasy status as tonight’s word', () => {
    expect(feed.at).toBe('2026-10-31T16:02:34Z');
    expect(feed.rows).toHaveLength(14);
    const by = Object.fromEntries(feed.rows.map((r) => [r.name, r]));
    expect(by['Tyrese Haliburton']).toMatchObject({ team: 'IND', pos: 'G', status: 'Out', raw: 'Out', fantasy: 'OUT', detail: 'Hamstring Strain', date: '2026-10-28T21:30Z', returnDate: '2026-11-13' });
    expect(by['Obi Toppin']).toMatchObject({ team: 'IND', status: 'GTD', raw: 'Day-To-Day', fantasy: 'GTD' });   // listed day-to-day: a game-time decision, not out
    expect(by['Ivica Zubac']).toMatchObject({ team: 'IND', status: 'GTD', raw: 'Out', fantasy: 'GTD' });   // "Out" for his last game, a decision tonight
    expect(by['Ben Sheppard'].detail).toBe('Knee');   // a detail of "None" is dropped
    expect(feed.rows.find((r) => r.name === 'Andrew Nembhard')).toBeUndefined();   // not listed: he plays
    expect(feed.rows.every((r) => !('key' in r))).toBe(true);   // the key is the store's (espn.js is bundled by the client)
    expect(feed.rows.map((r) => r.team)).toEqual([...feed.rows.map((r) => r.team)].sort());
  });
  test('an empty or odd answer parses to no rows', () => {
    expect(parseInjuries(null).rows).toEqual([]);
    expect(parseInjuries({ injuries: [{ injuries: [{ athlete: {} }] }] }).rows).toEqual([]);
  });
});

describe('the feed over PropFinder’s report (applyEspnInjuries)', () => {
  const feed = parseInjuries(feedJson);
  const P = (name, team, extra = {}) => ({ id: `pf-${name}`, name, key: normName(name), team, pos: 'G', games: [], props: [], ...extra });
  const pf = { at: '2026-10-31T13:00:00Z', data: { players: [
    P('Andrew Nembhard', 'IND', { injury: 'Out', injuryDetail: 'shoulder', injuryFrom: 'report', injuryDate: null }),      // PropFinder's stale Out: ESPN does not list him
    P('Pascal Siakam', 'IND'),                                                                                                 // nothing anywhere
    P('Tyrese Haliburton', 'IND', { injury: 'Out', injuryDetail: 'hamstring', injuryFrom: 'report', injuryDate: '2026-10-28' }),   // both say Out: PropFinder's word stands
    P('Obi Toppin', 'IND', { injury: 'Out', injuryDetail: 'back', injuryFrom: 'depth' }),                                    // the depth chart's Out, ESPN says GTD tonight
    P('Ivica Zubac', 'IND'),                                                                                                   // PropFinder has nothing, ESPN GTD
    P('T.J. McConnell', 'IND'),                                                                                                // PropFinder has nothing, ESPN Out
    P('Lauri Markkanen', 'UTAH', { injury: 'Questionable', injuryDetail: 'wrist', injuryFrom: 'report', injuryDate: '2026-10-30' }),   // Questionable vs GTD: the same class, PropFinder's stands
    P('Ja Morant', 'POR', { injury: 'Active', injuryFrom: 'report', injuryDate: '2026-10-31T18:00Z' }),                  // PropFinder's word dated after ESPN's entry: it stands
    P('Jayson Tatum', 'BOS', { injury: 'Out', injuryDetail: 'Achilles', injuryFrom: 'report', injuryDate: '2026-10-31T17:00Z' }),   // dated after the feed: stands though ESPN's trimmed feed lacks BOS
  ], injuries: { source: 'v2', rows: [
    { id: 'pf-Andrew Nembhard', name: 'Andrew Nembhard', key: 'andrew nembhard', team: 'IND', status: 'Out', detail: 'shoulder', date: null },
    { id: 'pf-Tyrese Haliburton', name: 'Tyrese Haliburton', key: 'tyrese haliburton', team: 'IND', status: 'Out', detail: 'hamstring', date: '2026-10-28' },
  ] } } };
  test('the newer word wins: a stale Out cleared, ESPN’s Out and GTD added, the same word left to PropFinder', () => {
    const out = applyEspnInjuries(pf, feed);
    expect(out).not.toBe(pf);
    expect(pf.data.players[0].injury).toBe('Out');   // the stored pull untouched
    const by = Object.fromEntries(out.data.players.map((p) => [p.name, p]));
    expect(by['Andrew Nembhard']).toMatchObject({ injury: null, injuryFrom: 'espn', injuryListed: { status: 'Out', detail: 'shoulder', from: 'report' } });
    expect(by['Pascal Siakam'].injury).toBeUndefined();
    expect(by['Pascal Siakam'].injuryFrom).toBeUndefined();
    expect(by['Tyrese Haliburton']).toMatchObject({ injury: 'Out', injuryFrom: 'report' });
    expect(by['Obi Toppin']).toMatchObject({ injury: 'GTD', injuryFrom: 'espn', injuryDetail: 'Back Soreness', injuryListed: { status: 'Out', from: 'depth' } });
    expect(isOut(by['Obi Toppin'].injury)).toBe(false);
    expect(by['Ivica Zubac']).toMatchObject({ injury: 'GTD', injuryFrom: 'espn', injuryRaw: 'Out', injuryEspn: { fantasy: 'GTD', returnDate: '2026-11-01' } });
    expect(by['Ivica Zubac'].injuryListed).toBeUndefined();
    expect(by['T.J. McConnell']).toMatchObject({ injury: 'Out', injuryFrom: 'espn', injuryDetail: 'Hamstring Strain' });
    expect(by['Lauri Markkanen']).toMatchObject({ injury: 'Questionable', injuryFrom: 'report' });
    expect(by['Ja Morant']).toMatchObject({ injury: 'Active', injuryFrom: 'report' });
    expect(by['Jayson Tatum']).toMatchObject({ injury: 'Out', injuryFrom: 'report' });
    // The report's rows follow: Nembhard's marked stale, ESPN's rows added, Haliburton's as it was.
    const rows = out.data.injuries.rows;
    expect(rows.find((r) => r.key === 'andrew nembhard').stale).toMatchObject({ espn: true });
    expect(rows.find((r) => r.key === 'tyrese haliburton').stale).toBeUndefined();
    expect(rows.find((r) => r.key === normName('T.J. McConnell'))).toMatchObject({ status: 'Out', source: 'espn', team: 'IND', detail: 'Hamstring Strain' });
    expect(rows.find((r) => r.key === 'obi toppin')).toMatchObject({ status: 'GTD', source: 'espn' });
    expect(out.data.injuries.espnAt).toBe('2026-10-31T16:02:34Z');
    // absentByTeam reads the corrected pull: Haliburton and McConnell out for IND, Nembhard and Toppin not.
    expect(absentByTeam(out).IND.map((a) => a.name).sort()).toEqual(['T.J. McConnell', 'Tyrese Haliburton']);
    expect(absentByTeam(out).BOS.map((a) => a.name)).toEqual(['Jayson Tatum']);
  });
  test('the same object back without a feed or when nothing changes; a second pass is a no-op', () => {
    expect(applyEspnInjuries(pf, null)).toBe(pf);
    expect(applyEspnInjuries(pf, { at: 'x', rows: [] })).not.toBe(pf);   // an empty feed clears the stale Out: the league lists nobody
    expect(applyEspnInjuries(null, feed)).toBeNull();
    const once = applyEspnInjuries(pf, feed);
    expect(applyEspnInjuries(once, feed)).toBe(once);
    const quiet = { ...pf, data: { ...pf.data, players: [P('Pascal Siakam', 'IND')], injuries: { rows: [] } } };
    expect(applyEspnInjuries(quiet, feed)).toBe(quiet);
  });
  test('the hand beats the feed, the box score beats both', () => {
    const withEspn = applyEspnInjuries(pf, feed);
    // The admin marks McConnell playing: the override stands over ESPN's Out.
    const byHand = applyOverrides(withEspn, { [`IND|${normName('T.J. McConnell')}`]: { status: 'Active', at: '2026-10-31T20:00Z' } });
    expect(byHand.data.players.find((p) => p.name === 'T.J. McConnell')).toMatchObject({ injury: 'Active', injuryFrom: 'override' });
    // The game stored: Haliburton played after all, Siakam sat.
    const games = [{ id: 'g1', date: '2026-10-31T23:00Z', away: 'IND', home: 'MIA' }];
    const results = { g1: { players: [{ name: 'Tyrese Haliburton', team: 'IND', played: true, min: 30 }, { name: 'Pascal Siakam', team: 'IND', played: false }] } };
    const final = applyBoxScores(byHand, games, results);
    expect(final.data.players.find((p) => p.name === 'Tyrese Haliburton')).toMatchObject({ injury: null, injuryFrom: 'boxscore' });
    expect(final.data.players.find((p) => p.name === 'Pascal Siakam')).toMatchObject({ injury: 'Out', injuryFrom: 'boxscore' });
  });
});

describe('ESPN’s NFL injury feed', () => {
  // The feed as served on 2026-10-31 16:14Z, trimmed to SEA and DEN (the week 9 practice reports and reserve lists).
  const feed = parseNflInjuries(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/espn-nfl-injuries.json'), 'utf8')));
  test('practice reports and reserve lists read into the board’s spellings', () => {
    expect(feed.rows).toHaveLength(50);
    const by = Object.fromEntries(feed.rows.map((r) => [r.name, r]));
    expect(by['Talanoa Hufanga']).toMatchObject({ team: 'DEN', pos: 'S', status: 'Out', fantasy: 'OUT', detail: 'Ankle' });
    expect(by['Zach Allen']).toMatchObject({ team: 'DEN', status: 'Questionable', raw: 'Questionable' });
    expect(by['Tyler Badie']).toMatchObject({ team: 'DEN', status: 'IR', raw: 'Injured Reserve', fantasy: 'IR' });
    expect(by['Jadarian Price']).toMatchObject({ team: 'SEA', status: 'IR', fantasy: 'IR-R', detail: 'Chest' });   // designated to return: still IR this week
    expect(by['Charles Cross']).toMatchObject({ team: 'SEA', status: 'Doubtful' });
    expect(by['Connor O\'Toole']).toMatchObject({ team: 'SEA', status: 'Active', fantasy: null, detail: null });   // a full practice: listed active, reads In
    expect(healthOf(by['Connor O\'Toole'].status)).toBe('In');
    expect(by['Zach Charbonnet'].detail).toBe('Knee - ACL Surgery');
    for (const r of feed.rows) expect(['In', 'DTD', 'Out']).toContain(healthOf(statusOf(r.status)));
    expect(feed.rows.filter((r) => isOut(statusOf(r.status))).map((r) => r.name).sort()).toEqual(['Charles Cross', 'Jadarian Price', 'Jonah Elliss', 'RJ Harvey', 'Talanoa Hufanga', 'Tyler Badie']);
  });
  test('the NFL spellings the feed uses elsewhere', () => {
    const j = { timestamp: 't', injuries: [{ displayName: 'Buffalo Bills', injuries: [
      { athlete: { displayName: 'A One', team: { abbreviation: 'BUF' } }, status: 'Out', details: { fantasyStatus: { abbreviation: 'INACTIVE' } } },
      { athlete: { displayName: 'B Two', team: { abbreviation: 'BUF' } }, status: 'Out', details: { fantasyStatus: { abbreviation: 'PUP-R' }, type: 'Knee' } },
      { athlete: { displayName: 'C Three', team: { abbreviation: 'BUF' } }, status: 'Suspension', details: { fantasyStatus: { abbreviation: 'RESERVE-SUS' } } },
      { athlete: { displayName: 'D Four', team: { abbreviation: 'BUF' } }, status: 'Suspension', details: {} },
    ] }] };
    const rows = parseNflInjuries(j).rows;
    expect(rows.map((r) => [r.name, r.status, statusOf(r.status)])).toEqual([['A One', 'Out', 'Out'], ['B Two', 'PUP', 'PUP'], ['C Three', 'Suspended', 'Suspended'], ['D Four', 'Suspension', 'Suspended']]);
    expect(rows.every((r) => isOut(statusOf(r.status)))).toBe(true);
  });
  test('over PropFinder’s NFL report: Active clears a listing, Questionable stands in its class, IR comes in', () => {
    const P = (name, team, extra = {}) => ({ id: `pf-${name}`, name, key: normName(name), team, pos: 'WR', games: [], props: [], ...extra });
    const pf = { at: '2026-10-31T13:00:00Z', data: { players: [
      P('Leonard Williams', 'SEA', { injury: 'Questionable', injuryDetail: 'Achilles', injuryFrom: 'report', injuryDate: '2026-10-29' }),   // ESPN: a full practice Friday, Active
      P('Rashid Shaheed', 'SEA', { injury: 'Questionable', injuryDetail: 'knee', injuryFrom: 'report', injuryDate: '2026-10-29' }),        // both Questionable: PropFinder's stands
      P('Tyler Badie', 'DEN'),                                                                                                                  // PropFinder has nothing, ESPN IR
      P('Nobody Listed', 'DEN', { injury: 'Out', injuryDetail: 'hip', injuryFrom: 'report', injuryDate: null }),                              // not on ESPN's list: in
    ], injuries: { rows: [] } } };
    const out = applyEspnInjuries(pf, feed);
    const by = Object.fromEntries(out.data.players.map((p) => [p.name, p]));
    expect(by['Leonard Williams']).toMatchObject({ injury: 'Active', injuryFrom: 'espn', injuryListed: { status: 'Questionable' } });
    expect(healthOf(by['Leonard Williams'].injury)).toBe('In');
    expect(by['Rashid Shaheed']).toMatchObject({ injury: 'Questionable', injuryFrom: 'report' });
    expect(by['Tyler Badie']).toMatchObject({ injury: 'IR', injuryFrom: 'espn', injuryDetail: 'Thumb Fracture' });
    expect(by['Nobody Listed']).toMatchObject({ injury: null, injuryFrom: 'espn', injuryListed: { status: 'Out' } });
    expect(absentByTeam(out).DEN.map((a) => a.name)).toEqual(['Tyler Badie']);
    expect(absentByTeam(out).SEA).toBeUndefined();
  });
  test('the NFL asks PropFinder for no injury report: the pull lists everyone, ESPN’s feed says who is out', async () => {
    // PropFinder's NFL report answered 404 at /NFL/v2 and /injuries/nfl/<teamId> on every pull (2026-10-28 → 10-31).
    const calls = [];
    const get = async (p) => { calls.push(p); throw new Error('404'); };
    const teams = [{ id: 1, code: 'SEA' }, { id: 2, code: 'DEN' }];
    const byAbbr = { SEA: teams[0], DEN: teams[1] };
    expect(await fetchNflReport({ teams, byAbbr, slateAbbrs: ['SEA', 'DEN'], get })).toEqual({ rows: [], source: 'espn', keys: [], sample: null, errors: [] });
    expect(calls).toEqual([]);
    await fetchNbaReport({ teams, byAbbr, slateAbbrs: ['SEA'], get });   // the NBA still reads PropFinder's own report
    expect(calls[0]).toMatch(/^\/NBA\/v2\?sportsbooks=/);
    // The NFL pull's shape: every rostered player of both teams, no report rows, no flag; ESPN's feed over it.
    const roster = feed.rows.map((r) => ({ id: `pf-${normName(r.name)}`, name: r.name, key: normName(r.name), team: r.team, pos: r.pos, games: [], props: [] }));
    const pf = { at: '2026-10-31T13:00:00Z', data: { players: [...roster, { id: 'pf-x', name: 'Not Listed', key: 'not listed', team: 'SEA', pos: 'WR', games: [], props: [] }], injuries: { rows: [] } } };
    const absent = absentByTeam(applyEspnInjuries(pf, feed));
    const names = Object.values(absent).flat().map((a) => a.name).sort();
    expect(names).toEqual(['Charles Cross', 'Jadarian Price', 'Jonah Elliss', 'RJ Harvey', 'Talanoa Hufanga', 'Tyler Badie']);
    expect(absent.DEN.find((a) => a.name === 'Talanoa Hufanga')).toMatchObject({ status: 'Out', detail: 'Ankle' });
  });
});
