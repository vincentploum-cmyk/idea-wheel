import { createClient } from '@/lib/supabase-server';
import PublicShell from '@/components/boostly/PublicShell';
import AuthPanel from '@/components/boostly/AuthPanel';

export const metadata = {
  title: 'Register',
  description: 'Create your IdeaReels account.',
};

export default async function RegisterPage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <PublicShell title="Register">
      <AuthPanel mode="register" user={user} error={searchParams?.error} />
    </PublicShell>
  );
}
