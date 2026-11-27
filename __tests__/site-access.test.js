import { describe, expect, test, jest } from '@jest/globals';

// A fake bucket, as in nhl-store-cache.test.js.
const files = new Map();
const store = {
  async list(prefix) {
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    return { data: [...names].map((name) => ({ name })), error: null };
  },
  async download(path) {
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path);
    return { data: { text: async () => text }, error: null };
  },
  async upload(path, body) {
    files.set(path, await body.text());
    return { data: { path }, error: null };
  },
};

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }), headers: () => new Headers() }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }),
}));

const nhlStore = require('../lib/nhl-store');
const { isSiteOwner, DEFAULT_OWNER_EMAILS, DEFAULT_ADMIN_EMAILS } = require('../lib/nhl-admin');
const access = require('../lib/site/access');

const b64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (claims) => `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(claims))}.sig`;
const cookieValue = (sid) => `base64-${b64url(JSON.stringify({ access_token: jwt({ sub: 'u1', session_id: sid }), refresh_token: 'r' }))}`;

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

describe('access log', () => {
  test('reads the session id from the Supabase cookie, whole or chunked', () => {
    const v = cookieValue('sess-1');
    expect(access.sessionIdFromCookies([{ name: 'sb-abc-auth-token', value: v }])).toBe('sess-1');
    const cut = Math.floor(v.length / 2);
    expect(access.sessionIdFromCookies([
      { name: 'sb-abc-auth-token.1', value: v.slice(cut) },
      { name: 'sb-abc-auth-token-code-verifier', value: 'x' },
      { name: 'sb-abc-auth-token.0', value: v.slice(0, cut) },
    ])).toBe('sess-1');
    expect(access.sessionIdFromCookies([{ name: 'sb-abc-auth-token', value: 'garbage' }])).toBeNull();
    expect(access.sessionIdFromCookies([])).toBeNull();
  });

  test('names devices from the user agent', () => {
    expect(access.deviceOf(IPHONE)).toBe('Safari on iPhone');
    expect(access.deviceOf(MAC_CHROME)).toBe('Chrome on Mac');
    expect(access.deviceOf(WIN_EDGE)).toBe('Edge on Windows');
    expect(access.deviceOf('')).toBe('Browser on Unknown');
  });

  test('reads where a request came from through Cloudflare', () => {
    const h = new Headers({ 'cf-connecting-ip': '1.2.3.4', 'cf-ipcountry': 'US', 'cf-ipcity': 'Boston', 'user-agent': IPHONE });
    expect(access.originOf(h)).toEqual({ ip: '1.2.3.4', place: 'Boston, US', ua: IPHONE });
    expect(access.originOf(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })).ip).toBe('5.6.7.8');
  });

  test('folds sightings into one entry per session', () => {
    const t0 = Date.parse('2026-11-20T12:00:00Z');
    let log = access.foldSighting(null, { email: 'a@x.com', sessionId: 's1', ua: IPHONE, ip: '1.1.1.1', place: 'US' }, t0);
    log = access.foldSighting(log, { email: 'a@x.com', sessionId: 's1', ua: IPHONE, ip: '2.2.2.2', place: 'US' }, t0 + 60000);
    log = access.foldSighting(log, { email: 'a@x.com', sessionId: 's2', ua: MAC_CHROME, ip: '1.1.1.1', place: 'US' }, t0 + 120000);
    expect(Object.keys(log.sessions)).toEqual(['s2', 's1']);
    expect(log.sessions.s1).toMatchObject({ firstSeen: '2026-11-20T12:00:00.000Z', hits: 2, ips: ['1.1.1.1', '2.2.2.2'], places: ['US'], device: 'Safari on iPhone' });
  });

  test('flags too many devices, several countries and two devices at once', () => {
    const now = Date.parse('2026-11-27T12:00:00Z');
    const at = (minAgo) => new Date(now - minAgo * 60000).toISOString();
    const quiet = { email: 'q@x.com', sessions: { a: { firstSeen: at(9000), lastSeen: at(5), ips: ['1.1.1.1'], places: ['US'] } } };
    expect(access.summarizeUser(quiet, now, 3)).toMatchObject({ flags: [], activeNow: 1, devices7d: 1 });

    const shared = { email: 's@x.com', sessions: {
      a: { firstSeen: at(100), lastSeen: at(1), ips: ['1.1.1.1'], places: ['Boston, MA, US'] },
      b: { firstSeen: at(100), lastSeen: at(3), ips: ['9.9.9.9'], places: ['Toronto, ON, CA'] },
      c: { firstSeen: at(3000), lastSeen: at(2000), ips: ['3.3.3.3'], places: ['US'] },
      d: { firstSeen: at(4000), lastSeen: at(3000), ips: ['4.4.4.4'], places: ['US'] },
      old: { firstSeen: at(40000), lastSeen: at(30000), ips: ['5.5.5.5'], places: ['FR'] },
    } };
    const s = access.summarizeUser(shared, now, 3);
    expect(s.devices7d).toBe(4);
    expect(s.devices30d).toBe(5);
    expect(s.activeNow).toBe(2);
    expect(s.flags).toEqual([
      '4 devices this week (limit 3)',
      '2 countries this week (US, CA)',
      '2 devices active right now from 2 addresses',
    ]);
    expect(s.sessions[0].id).toBe('a');
    expect(s.sessions[0].ua).toBeUndefined();
  });

  test('records at most every ten minutes per session, and reports users flagged first', async () => {
    files.clear();
    const t0 = Date.parse('2026-11-27T12:00:00Z');
    const before = nhlStore.dataRevision();
    const origin = { ip: '1.1.1.1', place: 'US', ua: IPHONE };
    await access.recordAccess({ user: { id: 'u1', email: 'one@x.com' }, sessionId: 'S1', origin }, t0);
    expect(access.recordAccess({ user: { id: 'u1', email: 'one@x.com' }, sessionId: 'S1', origin }, t0 + 60000)).toBeNull();
    await access.recordAccess({ user: { id: 'u1', email: 'one@x.com' }, sessionId: 'S1', origin: { ...origin, ip: '2.2.2.2' } }, t0 + 11 * 60000);
    for (const [i, sid] of ['A', 'B', 'C', 'D'].entries()) {
      await access.recordAccess({ user: { id: 'u2', email: 'two@x.com' }, sessionId: sid, origin: { ip: `9.9.9.${i}`, place: 'US', ua: MAC_CHROME } }, t0 + i * 1000);
    }
    expect(JSON.parse(files.get('access/users/u1.json')).sessions.S1).toMatchObject({ hits: 2, ips: ['1.1.1.1', '2.2.2.2'] });
    // The log feeds no board: its writes leave the memos' data revision alone.
    expect(nhlStore.dataRevision()).toBe(before);

    const report = await access.accessReport(nhlStore.listNames, t0 + 12 * 60000);
    expect(report.users.map((u) => u.email)).toEqual(['two@x.com', 'one@x.com']);
    expect(report.users[0].flags[0]).toBe('4 devices this week (limit 3)');
    expect(report.users[1]).toMatchObject({ devices7d: 1, flags: [] });
  });

  test('only the owner reads the log, not every admin', () => {
    delete process.env.SITE_OWNER_EMAILS;
    delete process.env.NHL_ADMIN_EMAILS;
    const owner = DEFAULT_OWNER_EMAILS[0];
    const other = DEFAULT_ADMIN_EMAILS.find((e) => e !== owner);
    expect(isSiteOwner({ email: owner.toUpperCase() })).toBe(true);
    expect(isSiteOwner({ email: other })).toBe(false);
    expect(isSiteOwner({ email: 'someone@else.com' })).toBe(false);
    process.env.SITE_OWNER_EMAILS = other;
    expect(isSiteOwner({ email: other })).toBe(true);
    delete process.env.SITE_OWNER_EMAILS;
  });
});
