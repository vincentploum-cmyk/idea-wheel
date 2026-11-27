// Who is signed in, and on how many devices: the access log behind /access.
//
// Supabase keeps a user's sign-ins in auth.sessions, but no API lists them, so the site keeps
// its own record. Every verified request (getSessionUser in lib/nhl-store.js) reports the
// session it came with; each Supabase session is one sign-in on one browser, so a person on a
// phone and a laptop shows two. One file per user, `access/users/<userId>.json`:
//   { email, sessions: { <sessionId>: { firstSeen, lastSeen, device, ua, ips[], places[], hits } } }
// A session is written at most every WRITE_EVERY_MS, so the log costs one small write per
// device per ten minutes of use.
import { readJson, writeJson } from '../nhl-store';

export const ACCESS_PREFIX = 'access/users';
const WRITE_EVERY_MS = 10 * 60 * 1000;
const KEEP_SESSIONS = 200;
const KEEP_IPS = 20;
const DAY = 24 * 60 * 60 * 1000;

// More signed-in devices than this in a week flags the account (ACCESS_DEVICE_LIMIT overrides).
export const deviceLimit = () => Math.max(1, Number(process.env.ACCESS_DEVICE_LIMIT) || 3);

// ── The session id inside the Supabase cookie ──────────────────────────────
const SESSION_COOKIE_RE = /^sb-.+-auth-token(?:\.(\d+))?$/;

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** The Supabase session id (the access token's `session_id` claim) from the auth cookies, or null.
 *  The token was verified by getUser() on the same cookie; this only reads its claims. */
export function sessionIdFromCookies(cookies) {
  const parts = (cookies || [])
    .map((c) => ({ c, m: SESSION_COOKIE_RE.exec(c.name) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m[1] || 0) - Number(b.m[1] || 0));
  if (!parts.length) return null;
  try {
    let raw = parts.map((x) => x.c.value).join('');
    if (raw.startsWith('base64-')) raw = b64urlDecode(raw.slice(7));
    const session = JSON.parse(raw);
    const token = session?.access_token || (Array.isArray(session) ? session[0] : null);
    const claims = JSON.parse(b64urlDecode(String(token).split('.')[1]));
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

// ── A readable device name from the user agent ─────────────────────────────
export function deviceOf(ua = '') {
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  return `${browser} on ${os}`;
}

/** Where the request came from, as Cloudflare (in front of Render) reports it. */
export function originOf(headers) {
  const get = (k) => headers?.get?.(k) || '';
  const ip = get('cf-connecting-ip') || get('x-forwarded-for').split(',')[0].trim() || get('x-real-ip');
  const place = [get('cf-ipcity'), get('cf-region'), get('cf-ipcountry')].filter((s) => s && s !== 'XX').join(', ');
  return { ip, place, ua: get('user-agent') };
}

// ── Recording ──────────────────────────────────────────────────────────────
const lastWrite = new Map(); // sessionId → ms of the last write from this process
const chains = new Map();    // userId → the write under way, so one user's writes never overlap

/** Fold one sighting into a user's log (pure: returns the new log). */
export function foldSighting(log, { email, sessionId, ua, ip, place }, now = Date.now()) {
  const at = new Date(now).toISOString();
  const sessions = { ...(log?.sessions || {}) };
  const s = sessions[sessionId] || { firstSeen: at, hits: 0, ips: [], places: [] };
  const add = (list, v) => (v && !list.includes(v) ? [...list, v].slice(-KEEP_IPS) : list);
  sessions[sessionId] = {
    ...s, lastSeen: at, hits: (s.hits || 0) + 1,
    ua: ua || s.ua || '', device: deviceOf(ua || s.ua || ''),
    ips: add(s.ips || [], ip), places: add(s.places || [], place),
  };
  const kept = Object.entries(sessions).sort((a, b) => b[1].lastSeen.localeCompare(a[1].lastSeen)).slice(0, KEEP_SESSIONS);
  return { email: email || log?.email || '', updatedAt: at, sessions: Object.fromEntries(kept) };
}

/** Note that `user` was seen on `sessionId`; throttled, never throws. */
export function recordAccess({ user, sessionId, origin }, now = Date.now()) {
  if (!user?.id || !sessionId) return null;
  const last = lastWrite.get(sessionId);
  if (last && now - last < WRITE_EVERY_MS) return null;
  if (lastWrite.size > 2000) lastWrite.clear();
  lastWrite.set(sessionId, now);
  const path = `${ACCESS_PREFIX}/${user.id}.json`;
  const run = (chains.get(user.id) || Promise.resolve()).then(async () => {
    const log = await readJson(path, { fresh: true });
    await writeJson(path, foldSighting(log, { email: user.email, sessionId, ...origin }, now));
  }).catch((err) => {
    lastWrite.delete(sessionId);
    console.error('[access] record failed:', err?.message || err);
  });
  chains.set(user.id, run);
  run.finally(() => { if (chains.get(user.id) === run) chains.delete(user.id); });
  return run;
}

// ── The report ─────────────────────────────────────────────────────────────
/** One user's devices and the flags that suggest the account is shared (pure). */
export function summarizeUser(log, now = Date.now(), limit = deviceLimit()) {
  const sessions = Object.entries(log?.sessions || {})
    .map(([id, s]) => ({ id, ...s, ageMs: now - Date.parse(s.lastSeen) }))
    .sort((a, b) => a.ageMs - b.ageMs);
  const within = (ms) => sessions.filter((s) => s.ageMs <= ms);
  const week = within(7 * DAY);
  const ips = new Set(week.flatMap((s) => s.ips || []));
  const countries = new Set(week.flatMap((s) => (s.places || []).map((p) => p.split(', ').pop())).filter(Boolean));
  // Two different devices active within the same half hour from different addresses.
  const live = within(30 * 60 * 1000);
  const liveIps = new Set(live.map((s) => (s.ips || []).at(-1)).filter(Boolean));
  const flags = [];
  if (week.length > limit) flags.push(`${week.length} devices this week (limit ${limit})`);
  if (countries.size > 1) flags.push(`${countries.size} countries this week (${[...countries].join(', ')})`);
  if (live.length > 1 && liveIps.size > 1) flags.push(`${live.length} devices active right now from ${liveIps.size} addresses`);
  return {
    email: log?.email || '', flags,
    activeNow: live.length, devices7d: week.length, devices30d: within(30 * DAY).length, ips7d: ips.size,
    sessions: sessions.slice(0, 50).map(({ ageMs, ua, ...s }) => s),
  };
}

/** Every user in the log, flagged accounts first, then the most devices this week. */
export async function accessReport(listNames, now = Date.now()) {
  const names = (await listNames(ACCESS_PREFIX)).filter((n) => n.endsWith('.json'));
  const logs = await Promise.all(names.map((n) => readJson(`${ACCESS_PREFIX}/${n}`, { fresh: true }).catch(() => null)));
  const users = logs.filter(Boolean).map((l) => summarizeUser(l, now));
  users.sort((a, b) => (b.flags.length > 0) - (a.flags.length > 0) || b.devices7d - a.devices7d || a.email.localeCompare(b.email));
  return { generatedAt: new Date(now).toISOString(), limit: deviceLimit(), users };
}
