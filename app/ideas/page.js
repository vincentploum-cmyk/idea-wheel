import PopitoShell from '@/components/popito/PopitoShell';
import IdeasClient from './ideas-client';
import { createClient } from '@/lib/supabase-server';
import { hasUnlockedIdeas } from '@/lib/credits';

export const metadata = {
  title: 'Ideas From the Engine — IdeaReels',
  description: 'Real startup ideas surfaced by IdeaReels — specific, validated, and built around genuine market pain.',
  alternates: { canonical: 'https://ideareels.io/ideas' },
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const unlocked = user ? await hasUnlockedIdeas(user.id) : false;

  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Ideas from the engine</h3>
            <p className="fn__desc">Real concepts surfaced by IdeaReels — specific problems, real market pain, and a clear angle for each one.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeasClient user={user} unlocked={unlocked} />
    </PopitoShell>
  );
}
