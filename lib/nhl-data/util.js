import crypto from 'crypto';
import { readJson, writeJson, getSessionUser, isNhlAdmin } from '../nhl-store';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date on the US East Coast (NHL slates are dated in ET). */
export function todayET(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TOKEN_PATH = 'data/config/sync-token.json';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export async function createSyncToken() {
  const token = `nhl_${crypto.randomBytes(24).toString('hex')}`;
  await writeJson(TOKEN_PATH, { hash: sha(token), createdAt: new Date().toISOString() });
  return token;
}

export async function syncTokenInfo() {
  const t = await readJson(TOKEN_PATH);
  return t ? { createdAt: t.createdAt } : null;
}

export async function verifySyncToken(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return false;
  const t = await readJson(TOKEN_PATH);
  if (!t?.hash) return false;
  const a = Buffer.from(sha(token));
  const b = Buffer.from(t.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Admin session, or a valid sync token in `Authorization: Bearer ...`. */
export async function authorize(request, { allowToken = false } = {}) {
  const user = await getSessionUser();
  if (user && isNhlAdmin(user)) return { ok: true, via: 'session', user };
  if (allowToken) {
    const auth = request.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (await verifySyncToken(token)) return { ok: true, via: 'token' };
  }
  return { ok: false, response: Response.json({ error: user ? 'forbidden' : 'not_authenticated' }, { status: user ? 403 : 401 }) };
}
