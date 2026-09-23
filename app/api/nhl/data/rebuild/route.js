import { rebuildGameIndexes, rebuildSlateIndexes } from '@/lib/nhl-data/rebuild';
import { authorize } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Admin: rebuild derived indexes (rows, seen players, defense, PropFinder names).
export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  try {
    const [games, slates] = await Promise.all([rebuildGameIndexes(), rebuildSlateIndexes()]);
    return Response.json({ ok: true, games, slates });
  } catch (err) {
    console.error('[nhl-data] rebuild failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
