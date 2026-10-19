import { authorize } from '@/lib/nhl-data/util';
import { syncTokenInfo } from '@/lib/nhl-data/util';
import { resolveWeek, statusFor, weeksWithData } from '@/lib/nfl/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Where the week's data stands: schedule, box scores, cheat sheets, the PropFinder pull.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const wk = await resolveWeek({ season: url.searchParams.get('season'), week: url.searchParams.get('week'), type: url.searchParams.get('type') });
  const [status, weeks, token] = await Promise.all([statusFor(wk), weeksWithData(wk.season), syncTokenInfo()]);
  return Response.json({ ...status, weeks, syncToken: token }, { headers: { 'Cache-Control': 'private, no-store' } });
}
