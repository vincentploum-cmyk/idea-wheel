import { requireNhlAdmin, listNames } from '@/lib/nhl-store';
import { isSiteOwner } from '@/lib/nhl-admin';
import { accessReport } from '@/lib/site/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The access log: every signed-in user's devices this week and month, flagged when an account
// looks shared. The owner only (SITE_OWNER_EMAILS).
export async function GET() {
  const auth = await requireNhlAdmin();
  if (auth.response) return auth.response;
  if (!isSiteOwner(auth.user)) return Response.json({ error: 'forbidden' }, { status: 403 });
  return Response.json(await accessReport(listNames));
}
