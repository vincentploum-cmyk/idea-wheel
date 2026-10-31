import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { parseInjuries } from '../lib/nba/espn';
import { applyEspnInjuries, applyOverrides, applyBoxScores, absentByTeam, isOut } from '../lib/picks/injuries';
import { normName } from '../lib/nhl-data/names';

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
