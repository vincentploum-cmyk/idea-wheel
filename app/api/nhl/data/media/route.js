import { authorize } from '@/lib/nhl-data/util';
import { readMedia, syncMedia } from '@/lib/nhl-data/media';
import { teamLogo } from '@/lib/nhl-data/teams';
import { loadPlayers } from '@/lib/nhl-data/rosters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Admin: a stored logo (?kind=logo&id=TOR) or headshot (?kind=headshot&id=8479318).
// Falls back to the NHL's own URL until the file has been copied.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id') || '';
  if (!['logo', 'headshot'].includes(kind) || !/^[A-Z0-9]{1,12}$/i.test(id)) return Response.json({ error: 'bad request' }, { status: 400 });
  const stored = await readMedia(kind, id);
  if (stored) {
    return new Response(stored.blob, { headers: { 'Content-Type': stored.type, 'Cache-Control': 'private, max-age=604800' } });
  }
  let fallback = kind === 'logo' ? teamLogo(id.toUpperCase()) : (await loadPlayers()).players[id]?.headshot;
  if (!fallback) return new Response(null, { status: 404 });
  return Response.redirect(fallback, 302);
}

// Admin: copy the next batch of missing logos / headshots from the NHL.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ ok: true, result: await syncMedia({ limit: 300 }) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
