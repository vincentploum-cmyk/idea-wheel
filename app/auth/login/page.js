import { createClient } from '@/lib/supabase-server';
import PublicShell from '@/components/boostly/PublicShell';
import AuthPanel from '@/components/boostly/AuthPanel';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to IdeaReels.',
};

export default async function LoginPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <PublicShell title="Log In">
      <AuthPanel mode="login" user={user} error={searchParams?.error} />
    </PublicShell>
  );
}
