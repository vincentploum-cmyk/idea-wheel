import PopitoShell from '@/components/popito/PopitoShell';
import IdeasClient from './ideas-client';
import { createClient } from '@/lib/supabase-server';
import { hasUnlockedIdea, getIdeaCreditBalance } from '@/lib/credits';
import { getAllCatalogData, getUnlockCounts } from '@/lib/catalog-store';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';

export const metadata = {
  title: 'Startup Ideas Library — IdeaReels',
  description: 'Pre-validated startup ideas with AI market research, competitor analysis, and technical MVP blueprints ready to unlock. Built for vibe coders and indie hackers.',
  alternates: { canonical: 'https://ideareels.io/ideas' },
};

export const revalidate = 3600;

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const premiumSlugs = IDEA_EXAMPLES.filter(i => i.score >= 80).map(i => i.slug);

  const [catalogData, unlockCounts] = await Promise.all([
    getAllCatalogData().catch(() => ({})),
    getUnlockCounts(premiumSlugs).catch(() => ({})),
  ]);

  // Per-idea unlock state for this user
  let ideaUnlocks = {};
  let ideaCreditBalance = 0;
  if (user) {
    ideaCreditBalance = await getIdeaCreditBalance(user.id).catch(() => 0);
    const checks = await Promise.all(
      premiumSlugs.map(async slug => [slug, await hasUnlockedIdea(user.id, slug).catch(() => false)])
    );
    ideaUnlocks = Object.fromEntries(checks);
  }

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
      <IdeasClient
        user={user}
        catalogData={catalogData}
        ideaUnlocks={ideaUnlocks}
        ideaCreditBalance={ideaCreditBalance}
        unlockCounts={unlockCounts}
      />
    </PopitoShell>
  );
}
