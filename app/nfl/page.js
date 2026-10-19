import { gateSport } from '@/lib/gate';
import Locked from '@/components/nhl/Locked';
import NflApp from '@/components/nfl/NflApp';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NFL picks' };

export default async function NflPage() {
  const { user, admin } = await gateSport('/nfl');
  if (!admin) return <Locked email={user.email} />;
  return <NflApp email={user.email} />;
}
