// Team logos and player headshots, copied from the NHL's CDN into Supabase
// Storage so the site never depends on a hotlink that can go stale.
import { readJson, writeJson, writeBlob, readBlob } from '../nhl-store';
import { loadPlayers } from './rosters';
import { teamLogo, TEAMS } from './teams';

export const MEDIA_INDEX = 'data/media/index.json';
export const logoPath = (abbr) => `data/media/logos/${abbr}.svg`;
export const headshotPath = (id) => `data/media/headshots/${id}.png`;

const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)' };

async function download(url) {
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get('content-type') || 'application/octet-stream';
  return { buf: Buffer.from(await res.arrayBuffer()), type: type.split(';')[0] };
}

/** Which files are missing, so the sync can pick up where it stopped. */
export async function mediaTodo() {
  const [index, ref] = await Promise.all([readJson(MEDIA_INDEX), loadPlayers()]);
  const have = index || { logos: {}, headshots: {} };
  const logos = Object.keys(TEAMS).filter((a) => !have.logos[a]).map((a) => ({ kind: 'logo', id: a, url: teamLogo(a) }));
  const heads = Object.values(ref.players)
    .filter((p) => p.onRoster && p.headshot && !have.headshots[p.id])
    .map((p) => ({ kind: 'headshot', id: p.id, url: p.headshot }));
  return { index: have, todo: [...logos, ...heads] };
}

/** Download up to `limit` missing files (a few hundred fit in one request). */
export async function syncMedia({ limit = 300, concurrency = 6 } = {}) {
  const { index, todo } = await mediaTodo();
  const batch = todo.slice(0, limit);
  const failed = [];
  let done = 0;
  const queue = [...batch];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        const { buf, type } = await download(item.url);
        const path = item.kind === 'logo' ? logoPath(item.id) : headshotPath(item.id);
        await writeBlob(path, new Blob([buf], { type }), type);
        (item.kind === 'logo' ? index.logos : index.headshots)[item.id] = { at: new Date().toISOString(), type, bytes: buf.length };
        done += 1;
      } catch (err) {
        failed.push(`${item.kind}:${item.id}`);
      }
    }
  }));
  index.updatedAt = new Date().toISOString();
  await writeJson(MEDIA_INDEX, index);
  return { downloaded: done, failed, remaining: todo.length - batch.length + failed.length, logos: Object.keys(index.logos).length, headshots: Object.keys(index.headshots).length };
}

/** Stored file (blob + type) or null. */
export async function readMedia(kind, id) {
  const index = await readJson(MEDIA_INDEX);
  const entry = kind === 'logo' ? index?.logos?.[id] : index?.headshots?.[id];
  if (!entry) return null;
  const blob = await readBlob(kind === 'logo' ? logoPath(id) : headshotPath(id), { cache: true });
  return blob ? { blob, type: entry.type || blob.type || 'application/octet-stream' } : null;
}
