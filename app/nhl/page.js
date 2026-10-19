import { gateSport } from '@/lib/gate';
import Locked from '@/components/nhl/Locked';
import NhlApp from '@/components/nhl/NhlApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NHL picks' };

export default async function NhlPage() {
  const { user, admin } = await gateSport('/nhl');
  if (!admin) return <Locked email={user.email} />;
  return <NhlApp email={user.email} />;
}
