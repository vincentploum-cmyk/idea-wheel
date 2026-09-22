import { authorize, createSyncToken, syncTokenInfo } from '@/lib/nhl-data/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  return Response.json({ token: await syncTokenInfo() });
}

// Creates a new folder-sync token (replaces the old one). Shown once.
export async function POST(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  return Response.json({ token: await createSyncToken() }, { headers: { 'Cache-Control': 'no-store' } });
}
