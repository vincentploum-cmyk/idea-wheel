import { gateSport } from '@/lib/gate';
import Locked from '@/components/nhl/Locked';
import NbaApp from '@/components/nba/NbaApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NBA picks' };

export default async function NbaPage() {
  const { user, admin } = await gateSport('/nba');
  if (!admin) return <Locked email={user.email} />;
  return <NbaApp email={user.email} />;
}
