import { createClient } from '@/lib/supabase-server';
import ProfileClient from './profile-client';

export const metadata = {
  title: 'Profile',
  description: 'Sign in, claim your free credits, and manage your IdeaReels research and blueprints.',
};

export default async function ProfilePage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const error = searchParams?.error;
  return <ProfileClient user={user} error={error} />;
}
