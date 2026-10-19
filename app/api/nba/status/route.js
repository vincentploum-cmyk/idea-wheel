import { authorize, syncTokenInfo } from '@/lib/nhl-data/util';
import { resolveSlate, statusFor, datesWithData } from '@/lib/nba/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Where the date's data stands: schedule, box scores, cheat sheets, the PropFinder pull.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const slate = await resolveSlate({ date: new URL(request.url).searchParams.get('date') });
  const [status, dates, token] = await Promise.all([statusFor(slate), datesWithData(), syncTokenInfo()]);
  return Response.json({ ...status, dates, syncToken: token }, { headers: { 'Cache-Control': 'private, no-store' } });
}
