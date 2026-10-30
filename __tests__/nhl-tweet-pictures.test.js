import { describe, expect, test, jest } from '@jest/globals';
import { latestTeamLines, parseLineTweet } from '../lib/nhl-data/gamedaytweets';
import {
  syndicationToken, photosOf, fetchTweetPhotos, pictureCandidates, transcriptionText, rosterPrompt,
  readPhoto, readTweetPicture, pictureLinesFor, picturesEnabled, SYNDICATION_URL, MAX_PICTURE_TWEETS,
} from '../lib/nhl-data/tweet-pictures';

// The Devils of 2026-10-30 (the notebook page @NJDevils posted before the game at VGK).
const P = (id, name, pos) => ({ id, name, pos, team: 'NJD' });
const NJD = [
  P(1, 'Timo Meier', 'RW'), P(2, 'Nico Hischier', 'C'), P(3, 'Angus Evangelista', 'RW'),
  P(4, 'Arseny Gritsyuk', 'LW'), P(5, 'Jack Hughes', 'C'), P(6, 'Jesper Bratt', 'RW'),
  P(7, 'Anthony Mantha', 'LW'), P(8, 'Evan Rodrigues', 'C'), P(9, 'Jesper Boqvist', 'C'),
  P(10, 'Dawson Mercer', 'C'), P(11, 'Cody Glass', 'C'), P(12, 'Connor Brown', 'RW'), P(13, 'Lenni Hameenaho', 'RW'),
  P(14, 'Luke Hughes', 'D'), P(15, 'Brett Pesce', 'D'), P(16, 'Jonas Siegenthaler', 'D'), P(17, 'Dougie Hamilton', 'D'),
  P(18, 'Declan Chisholm', 'D'), P(19, 'Johnathan Kovacevic', 'D'), P(20, 'Brenden Dillon', 'D'),
  P(21, 'Connor Hellebuyck', 'G'), P(22, 'Jake Allen', 'G'),
];
// The model's answer for the notebook, as the prompt asks for it.
const NOTEBOOK = 'Meier - Hischier - Evangelista\nGritsyuk - Hughes - Bratt\nMantha - Rodrigues - Boqvist\nLombardi - Glass - Brown\nHughes - Pesce\nSiegenthaler - Hamilton\nChisholm - Kovacevic';

// Ids are X snowflakes, so each block carries its posting time: 2026-10-30 ~21:42Z, 10-28, 10-27, 10-17.
const ID_PIC = '2116284670182920405';
const ID_PIC2 = '2115607504541585604';
const ID_PIC3 = '2115229451504189441';
const ID_TEXT = '2111500000000000000';
const block = (handle, id, dateText, text) => `<blockquote class="tweet full-sized-tweet"><p lang="" dir="ltr"><a class="handle" href="https://twitter.com/${handle}" target="_blank">@${handle}</a><br> ${text.replace(/\n/g, '<br>')}</p> &mdash; NHL Game Day Lines (@GameDayLines) <a href="https://x.com/GameDayLines/status/${id}">${dateText}</a></blockquote>`;
const TEXT_LINES = 'Devils lines at practice:\nMeier-Hischier-Evangelista\nGritsyuk-Hughes-Bratt\nMantha-Rodrigues-Mercer\nLombardi-Glass-Brown\nHughes-Pesce\nSiegenthaler-Hamilton\nChisholm-Kovacevic';
const PAGE = `<html><body>${[
  block('NJDevils', ID_PIC, 'Oct 30, 2026', 'We’re all in. https://t.co/c2PfvmgX8w'),
  block('NJDevils', ID_PIC2, 'Oct 28, 2026', 'Let’s ride. https://t.co/jZM96gZ7XZ'),
  block('NJDevils', ID_PIC3, 'Oct 27, 2026', 'How ’bout dem lines? https://t.co/K9FpnVFNKN'),
  block('TomGulittiNHL', ID_TEXT, 'Oct 17, 2026', TEXT_LINES),
].join('\n')}</body></html>`;

const syndication = (photos) => ({ __typename: 'Tweet', text: 'We’re all in. https://t.co/c2PfvmgX8w', user: { screen_name: 'NJDevils' }, photos, mediaDetails: photos.map((p) => ({ type: 'photo', media_url_https: p.url })) });
const PHOTO = { url: 'https://pbs.twimg.com/media/HV6Nh7AWwAAS4ES.jpg', width: 2048, height: 1614 };

/** A fetch that answers the syndication endpoint and the photo; `calls` records every URL asked for. */
function fakeFetch({ photosById = {}, calls = [] } = {}) {
  return async (url) => {
    calls.push(String(url));
    if (String(url).startsWith(SYNDICATION_URL)) {
      const id = new URL(url).searchParams.get('id');
      const photos = photosById[id];
      if (photos === undefined) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, status: 200, text: async () => JSON.stringify(syndication(photos)) };
    }
    if (/pbs\.twimg\.com/.test(String(url))) return { ok: true, status: 200, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer };
    throw new Error(`unexpected fetch ${url}`);
  };
}

/** A stand-in for the SDK client: answers in order, records each request. */
function fakeClient(answers) {
  const requests = [];
  let i = 0;
  return {
    requests,
    messages: { create: async (req) => { requests.push(req); const a = answers[Math.min(i++, answers.length - 1)]; return typeof a === 'string' ? { model: req.model, stop_reason: 'end_turn', content: [{ type: 'text', text: a }], usage: { input_tokens: 1500, output_tokens: 60 } } : a; } },
  };
}

describe('the syndication endpoint', () => {
  test('the token is the id over 1e15 times π in base 36 without zeros or the point', () => {
    const t = syndicationToken(ID_PIC);
    expect(t).toBe(((Number(ID_PIC) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''));
    expect(t).not.toMatch(/[0.]/);
  });
  test('photos come from photos and mediaDetails without doubles, a quoted tweet’s after the tweet’s own', () => {
    const json = { photos: [PHOTO], mediaDetails: [{ type: 'photo', media_url_https: PHOTO.url }, { type: 'video', media_url_https: 'https://pbs.twimg.com/ext_tw_video_thumb/1.jpg' }], quotedTweet: { photos: [{ url: 'https://pbs.twimg.com/media/Q.jpg?name=small', width: 10, height: 10 }] } };
    expect(photosOf(json)).toEqual([PHOTO, { url: 'https://pbs.twimg.com/media/Q.jpg', width: 10, height: 10 }]);
    expect(photosOf({})).toEqual([]);
  });
  test('fetchTweetPhotos reads the payload; a gone tweet and a bad id answer with no photos', async () => {
    const calls = [];
    const got = await fetchTweetPhotos(ID_PIC, { fetchImpl: fakeFetch({ photosById: { [ID_PIC]: [PHOTO] }, calls }) });
    expect(got).toMatchObject({ photos: [PHOTO], user: 'NJDevils', status: 200 });
    expect(calls[0]).toBe(`${SYNDICATION_URL}?id=${ID_PIC}&token=${syndicationToken(ID_PIC)}`);
    expect(await fetchTweetPhotos(ID_PIC2, { fetchImpl: fakeFetch() })).toMatchObject({ photos: [], status: 404 });
    expect(await fetchTweetPhotos('abc', { fetchImpl: fakeFetch() })).toMatchObject({ photos: [], status: 'bad id' });
  });
});

describe('picture candidates on a page', () => {
  test('the picture tweets newer than the newest text lines tweet, newest first, three at most', () => {
    const c = pictureCandidates(PAGE, NJD, { since: '2026-10-01' });
    expect(c.map((t) => t.id)).toEqual([ID_PIC, ID_PIC2, ID_PIC3]);
    expect(MAX_PICTURE_TWEETS).toBe(3);
    const many = `<html>${[1, 2, 3, 4, 5].map((i) => block('NJDevils', `21162846701829204${String(i).padStart(2, '0')}`, 'Oct 30, 2026', `Pic ${i} https://t.co/x${i}`)).join('')}</html>`;
    expect(pictureCandidates(many, NJD, { since: '2026-10-01' })).toHaveLength(3);
  });
  test('a text lines tweet on top leaves nothing to read; the date floor and the game cutoff hold', () => {
    const textOnTop = `<html>${block('TomGulittiNHL', '2116300000000000000', 'Oct 30, 2026', TEXT_LINES)}${block('NJDevils', ID_PIC, 'Oct 30, 2026', 'We’re all in. https://t.co/c2PfvmgX8w')}</html>`;
    expect(pictureCandidates(textOnTop, NJD, { since: '2026-10-01' })).toEqual([]);
    expect(pictureCandidates(PAGE, NJD, { since: '2026-10-31' })).toEqual([]);
    // Posted after the cutoff (the game plus four hours): the newest is left out, the older two stand.
    expect(pictureCandidates(PAGE, NJD, { since: '2026-10-01', until: '2026-10-29T12:00:00.000Z' }).map((t) => t.id)).toEqual([ID_PIC2, ID_PIC3]);
  });
  test('a tweet without a link is no picture; a confirmation reaches back past the floor', () => {
    const page = `<html>${block('amandacstein', '2116300000000000000', 'Oct 30, 2026', 'Same lineup tonight, Hellebuyck starts.')}${block('NJDevils', ID_PIC2, 'Oct 28, 2026', 'Let’s ride. https://t.co/jZM96gZ7XZ')}${block('NJDevils', '2115000000000000000', 'Oct 27, 2026', 'Game day in Vegas.')}</html>`;
    expect(pictureCandidates(page, NJD, { since: '2026-10-29' }).map((t) => t.id)).toEqual([ID_PIC2]);
  });
});

describe('the model’s answer as text for the parser', () => {
  test('fences, bullets, numbering and unit prefixes go; goalie and special-teams rows go; NONE is null', () => {
    const raw = '```\nForwards:\n1. Meier - Hischier - Evangelista\n- L2: Gritsyuk - Hughes - Bratt\n**Mantha - Rodrigues - Boqvist**\nLine 4) Lombardi - Glass - Brown\nDefense\nPair 1: Hughes - Pesce\nD2 - Siegenthaler - Hamilton\nChisholm - Kovacevic\nGoalies: Hellebuyck, Allen\nPP1: Hughes - Bratt - Meier - Hischier - Hamilton\n```';
    expect(transcriptionText(raw)).toBe(NOTEBOOK);
    expect(transcriptionText('NONE')).toBeNull();
    expect(transcriptionText('None — the photo shows a goalie warming up.')).toBeNull();
    expect(transcriptionText('')).toBeNull();
  });
  test('a unit written with commas or slashes is joined with dashes, and the parser accepts the result', () => {
    const text = transcriptionText('Meier, Hischier, Evangelista\nGritsyuk / Hughes / Bratt\nMantha, Rodrigues, Boqvist\nHughes, Pesce');
    expect(text).toBe('Meier - Hischier - Evangelista\nGritsyuk - Hughes - Bratt\nMantha - Rodrigues - Boqvist\nHughes - Pesce');
    const lines = parseLineTweet(text, NJD);
    expect(lines.forwards).toHaveLength(3);
    expect(lines.defense[0].map((p) => p.name)).toEqual(['Luke Hughes', 'Brett Pesce']);
  });
  test('the notebook parses with the shared surname placed by elimination and the unknown name kept', () => {
    const lines = parseLineTweet(NOTEBOOK, NJD);
    expect(lines.forwards.map((r) => r.map((p) => p.name))).toEqual([
      ['Timo Meier', 'Nico Hischier', 'Angus Evangelista'], ['Arseny Gritsyuk', 'Jack Hughes', 'Jesper Bratt'],
      ['Anthony Mantha', 'Evan Rodrigues', 'Jesper Boqvist'], ['Lombardi', 'Cody Glass', 'Connor Brown'],
    ]);
    expect(lines.defense[0].map((p) => p.id)).toEqual([14, 15]);
  });
  test('the roster rides on the prompt by position group with the tweet’s words, links dropped', () => {
    const p = rosterPrompt(NJD, 'We’re all in. https://t.co/c2PfvmgX8w');
    expect(p).toMatch(/^Roster:\nForwards: Timo Meier, Nico Hischier/);
    expect(p).toMatch(/\nDefense: Luke Hughes, .*\nGoalies: Connor Hellebuyck, Jake Allen\n\nThe tweet's text: We’re all in\.$/);
    expect(p).not.toContain('t.co');
  });
});

describe('reading a photo', () => {
  test('readPhoto sends the image and the roster and normalises the answer; a refusal reads as nothing', async () => {
    const client = fakeClient(['Meier - Hischier - Evangelista\nGoalies: Hellebuyck']);
    const got = await readPhoto({ data: Buffer.from('jpg'), mediaType: 'image/jpeg' }, NJD, { tweetText: 'We’re all in.', client, model: 'claude-opus-5-5' });
    expect(got).toMatchObject({ text: 'Meier - Hischier - Evangelista', model: 'claude-opus-5-5' });
    const req = client.requests[0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from('jpg').toString('base64') } });
    expect(req.messages[0].content[1].text).toContain('Forwards: Timo Meier');
    expect(req.system).toContain('answer NONE');
    const refused = fakeClient([{ model: 'm', stop_reason: 'refusal', content: [] }]);
    expect(await readPhoto({ data: Buffer.from('x'), mediaType: 'image/jpeg' }, NJD, { client: refused })).toMatchObject({ text: null, refused: true });
  });
  test('readTweetPicture reads the photos until one gives lines the roster accepts, within the budget', async () => {
    const two = [PHOTO, { url: 'https://pbs.twimg.com/media/second.jpg', width: 1, height: 1 }];
    const client = fakeClient(['NONE', NOTEBOOK]);
    const budget = { reads: 5 };
    const rec = await readTweetPicture({ id: ID_PIC, url: 'u', handle: 'NJDevils', text: 'We’re all in.' }, NJD, { fetchImpl: fakeFetch({ photosById: { [ID_PIC]: two } }), client, budget, now: Date.parse('2026-10-30T22:00:00Z') });
    expect(rec).toMatchObject({ id: ID_PIC, status: 'lines', text: NOTEBOOK, photo: 'https://pbs.twimg.com/media/second.jpg', photos: 2, reads: 2, at: '2026-10-30T22:00:00.000Z' });
    expect(budget.reads).toBe(3);
    // An answer the roster rejects is 'none' with the raw answer kept; no photo is 'nophoto'; an empty budget stops before the call.
    const none = await readTweetPicture({ id: ID_PIC, text: '' }, NJD, { fetchImpl: fakeFetch({ photosById: { [ID_PIC]: [PHOTO] } }), client: fakeClient(['Smith - Jones - Brown\nA - B - C\nD - E - F']), budget: { reads: 2 } });
    expect(none).toMatchObject({ status: 'none', reads: 1 });
    expect(none.raw).toContain('Smith');
    expect(await readTweetPicture({ id: ID_PIC2, text: '' }, NJD, { fetchImpl: fakeFetch(), client })).toMatchObject({ status: 'nophoto', detail: 404, reads: 0 });
    expect(await readTweetPicture({ id: ID_PIC, text: '' }, NJD, { fetchImpl: fakeFetch({ photosById: { [ID_PIC]: [PHOTO] } }), client, budget: { reads: 0 } })).toMatchObject({ status: 'budget', reads: 0 });
    // A failing fetch is an error record, never a throw.
    const broken = await readTweetPicture({ id: ID_PIC, text: '' }, NJD, { fetchImpl: async () => { throw new Error('ECONNRESET'); }, client });
    expect(broken).toMatchObject({ status: 'error', error: 'ECONNRESET' });
  });
});

describe('pictureLinesFor and latestTeamLines together', () => {
  const store = () => { const m = new Map(); return { m, get: async (id) => m.get(id) ?? null, set: async (id, rec) => { m.set(id, rec); } }; };
  test('the newest picture holding lines is read once, stored, and becomes the team’s lines with the tweet’s time', async () => {
    const cache = store();
    const client = fakeClient([NOTEBOOK]);
    const calls = [];
    const opts = { since: '2026-10-29', cache, client, fetchImpl: fakeFetch({ photosById: { [ID_PIC]: [PHOTO], [ID_PIC2]: [PHOTO] }, calls }) };
    const first = await pictureLinesFor(PAGE, NJD, opts);
    expect(Object.keys(first.pictures)).toEqual([ID_PIC]);
    expect(first.tried).toEqual([{ id: ID_PIC, handle: 'NJDevils', date: '2026-10-30', status: 'lines', photos: 1, reads: 1, cached: false }]);
    expect(client.requests).toHaveLength(1);
    expect(cache.m.get(ID_PIC)).toMatchObject({ status: 'lines', text: NOTEBOOK });

    const read = latestTeamLines(PAGE, NJD, { since: '2026-10-29', pictures: first.pictures });
    expect(read.meta).toMatchObject({ source: 'gamedaytweets', handle: 'NJDevils', date: '2026-10-30', at: '2026-10-30T21:42:38.696Z', url: `https://x.com/GameDayLines/status/${ID_PIC}`, picture: { photo: PHOTO.url, model: 'claude-opus-5-5', text: NOTEBOOK } });
    expect(read.forwards).toBe(4);
    expect(read.pairs).toBe(3);
    expect(read.matched).toBe(17);
    expect(read.players['jack hughes']).toMatchObject({ pos: 'C', line: 2, id: 5 });
    expect(read.players['luke hughes']).toMatchObject({ pos: 'D', line: 1, id: 14 });
    // Without the picture map the same page reads back to the text tweet of the 17th (or nothing inside the floor).
    expect(latestTeamLines(PAGE, NJD, { since: '2026-10-29' })).toBeNull();
    expect(latestTeamLines(PAGE, NJD, { since: '2026-10-01' }).meta.date).toBe('2026-10-17');

    // The second pass (the next 15-minute hop) comes from the store: no fetch, no model call.
    const again = await pictureLinesFor(PAGE, NJD, { ...opts, fetchImpl: async () => { throw new Error('no network expected'); } });
    expect(again.pictures[ID_PIC].text).toBe(NOTEBOOK);
    expect(again.tried[0]).toMatchObject({ status: 'lines', cached: true });
    expect(client.requests).toHaveLength(1);
  });
  test('a picture without lines is stored as none and the next picture is read; a picture with lines older than a confirmation still carries it', async () => {
    const cache = store();
    const client = fakeClient(['NONE', NOTEBOOK]);
    const got = await pictureLinesFor(PAGE, NJD, { since: '2026-10-26', cache, client, fetchImpl: fakeFetch({ photosById: { [ID_PIC]: [PHOTO], [ID_PIC2]: [PHOTO], [ID_PIC3]: [PHOTO] } }) });
    expect(got.tried.map((t) => t.status)).toEqual(['none', 'lines']);
    expect(Object.keys(got.pictures)).toEqual([ID_PIC2]);
    expect(cache.m.get(ID_PIC).status).toBe('none');
    const read = latestTeamLines(PAGE, NJD, { since: '2026-10-26', pictures: got.pictures });
    expect(read.meta.date).toBe('2026-10-28');

    const confirmPage = `<html>${block('amandacstein', '2116300000000000000', 'Oct 30, 2026', 'Same lineup as Tuesday for the Devils.')}${block('NJDevils', ID_PIC2, 'Oct 28, 2026', 'Let’s ride. https://t.co/jZM96gZ7XZ')}</html>`;
    const confirmed = latestTeamLines(confirmPage, NJD, { since: '2026-10-30', pictures: got.pictures });
    expect(confirmed.meta).toMatchObject({ confirmed: true, date: '2026-10-30', handle: 'amandacstein' });
    expect(confirmed.meta.linesFrom).toMatchObject({ date: '2026-10-28', picture: { text: NOTEBOOK } });
  });
  test('an error record is read again after ten minutes, a budget record at once; the budget stops the run', async () => {
    const cache = store();
    const now = Date.parse('2026-10-30T22:00:00Z');
    cache.m.set(ID_PIC, { id: ID_PIC, status: 'error', error: 'ECONNRESET', at: new Date(now - 60000).toISOString() });
    const client = fakeClient([NOTEBOOK]);
    const fetchImpl = fakeFetch({ photosById: { [ID_PIC]: [PHOTO] } });
    const fresh = await pictureLinesFor(PAGE, NJD, { since: '2026-10-30', cache, client, fetchImpl, now });
    expect(fresh.tried[0]).toMatchObject({ status: 'error', cached: true });
    expect(client.requests).toHaveLength(0);
    const later = await pictureLinesFor(PAGE, NJD, { since: '2026-10-30', cache, client, fetchImpl, now: now + 11 * 60000 });
    expect(later.tried[0]).toMatchObject({ status: 'lines', cached: false });
    expect(client.requests).toHaveLength(1);
    // Nothing left in the run's budget: the read is 'budget' and not stored, so the next run reads it.
    const cache2 = store();
    const out = await pictureLinesFor(PAGE, NJD, { since: '2026-10-29', cache: cache2, client: fakeClient([NOTEBOOK]), fetchImpl, budget: { reads: 0 } });
    expect(out.tried.map((t) => t.status)).toEqual(['budget']); // the floor of the 29th leaves the one picture of the 30th
    expect(out.pictures).toEqual({});
    expect(cache2.m.size).toBe(0);
  });
  test('the switch: a key turns it on, NHL_LINES_PICTURES=off turns it off', () => {
    expect(picturesEnabled({})).toBe(false);
    expect(picturesEnabled({ ANTHROPIC_API_KEY: 'k' })).toBe(true);
    expect(picturesEnabled({ ANTHROPIC_API_KEY: 'k', NHL_LINES_PICTURES: 'off' })).toBe(false);
  });
});
