import { createClient } from '@/lib/supabase-server';
import PopitoShell from '@/components/popito/PopitoShell';
import ProfileClient from './profile-client';

export const metadata = {
  title: 'My Account',
  description: 'Your IdeaReels profile, saved ideas, and available credits.',
};

export default async function ProfilePage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const error = searchParams?.error;
  const welcome = searchParams?.welcome === '1';
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">My Account</h3>
            {!user && <p className="fn__desc">Sign in, claim your 3 free credits, and save your best ideas.</p>}
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <ProfileClient user={user} error={error} welcome={welcome} />
    </PopitoShell>
  );
}
