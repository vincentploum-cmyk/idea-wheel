import { getSessionUser } from '@/lib/nhl-store';
import { isNhlAdmin } from '@/lib/nhl-admin';
import Landing from '@/components/nhl/Landing';
import Locked from '@/components/nhl/Locked';
import Start from '@/components/site/Start';

export const dynamic = 'force-dynamic';

// The start screen: the three sports. The NHL app lives at /nhl, the NFL board at /nfl, the NBA slot at /nba.
export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  if (!isNhlAdmin(user)) return <Locked email={user.email} />;
  return <Start email={user.email} />;
}
