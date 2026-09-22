import { getSessionUser } from '@/lib/nhl-store';
import { isNhlAdmin } from '@/lib/nhl-admin';
import Landing from '@/components/nhl/Landing';
import Locked from '@/components/nhl/Locked';
import NhlApp from '@/components/nhl/NhlApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  if (!isNhlAdmin(user)) return <Locked email={user.email} />;
  return <NhlApp email={user.email} />;
}
