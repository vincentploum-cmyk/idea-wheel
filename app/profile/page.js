import { createClient } from '@/lib/supabase-server';
import PopitoShell from '@/components/popito/PopitoShell';
import ProfileClient from './profile-client';

export const metadata = {
  title: 'My Account',
  description: 'Your IdeaReels profile and credits.',
};

export default async function ProfilePage({ searchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const error = searchParams?.error;
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <div className="fn__author_info">
              <div className="right_part">
                {user
                  ? <><p className="status"><span>Member</span></p><h1 className="title">My Account</h1></>
                  : <><h1 className="title">My Account</h1><p className="desc">Sign in to view your ideas and credits.</p></>}
              </div>
            </div>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <ProfileClient user={user} error={error} />
    </PopitoShell>
  );
}
