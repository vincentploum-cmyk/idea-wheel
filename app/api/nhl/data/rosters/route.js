import { updateRosters } from '@/lib/nhl-data/rosters';
import { authorize } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Admin: pull all 32 current rosters now and log any changes.
export async function POST(request) {
  const auth = await authorize(request, { allowToken: true });
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ ok: true, result: await updateRosters() });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
