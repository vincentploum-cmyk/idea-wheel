import { authorize } from '@/lib/nhl-data/util';
import { loadShotpropz, refreshShotpropz, SPZ_SOURCE } from '@/lib/nhl-data/shotpropz';
import { mpYear } from '@/lib/nhl-data/moneypuck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Admin: the stored ShotPropz team boards (offense / defense × all / home / away × season to date / last ten).
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const year = Number(new URL(request.url).searchParams.get('year')) || mpYear();
  const spz = await loadShotpropz(year);
  return Response.json({ year, source: SPZ_SOURCE, snapshot: spz }, { headers: { 'Cache-Control': 'no-store' } });
}

// Admin or the sync token: read the twelve boards now and store the snapshot.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    return Response.json({ ok: true, result: await refreshShotpropz({ year: Number(url.searchParams.get('year')) || mpYear() }) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
