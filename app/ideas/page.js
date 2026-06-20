import PopitoShell from '@/components/popito/PopitoShell';
import IdeasClient from './ideas-client';
import { createClient } from '@/lib/supabase-server';
import { hasUnlockedIdeas, hasUnlockedCatalogBlueprint } from '@/lib/credits';
import { getAllCatalogData, getUnlockCounts } from '@/lib/catalog-store';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';

export const metadata = {
  title: 'Ideas From the Engine — IdeaReels',
  description: 'Real startup ideas surfaced by IdeaReels — specific, validated, and built around genuine market pain.',
  alternates: { canonical: 'https://ideareels.io/ideas' },
};

export const revalidate = 3600; // Revalidate catalog data once per hour

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const unlocked = user ? await hasUnlockedIdeas(user.id) : false;

  // Fetch pre-generated catalog data (research + blueprints) and unlock counts
  const premiumSlugs = IDEA_EXAMPLES.filter(i => i.score >= 80).map(i => i.slug);
  const [catalogData, unlockCounts] = await Promise.all([
    getAllCatalogData().catch(() => ({})),
    getUnlockCounts(premiumSlugs).catch(() => ({ researchCount: 0, blueprintCounts: {} })),
  ]);

  // Check which blueprints this user has unlocked (per-idea)
  let blueprintUnlocks = {};
  if (user && unlocked) {
    const checks = await Promise.all(
      IDEA_EXAMPLES
        .filter(i => i.score >= 80)
        .map(async i => [i.slug, await hasUnlockedCatalogBlueprint(user.id, i.slug).catch(() => false)])
    );
    blueprintUnlocks = Object.fromEntries(checks);
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
        unlocked={unlocked}
        catalogData={catalogData}
        blueprintUnlocks={blueprintUnlocks}
        unlockCounts={unlockCounts}
      />
    </PopitoShell>
  );
}
