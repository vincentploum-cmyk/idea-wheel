import PopitoShell from '@/components/popito/PopitoShell';
import IdeasClient from './ideas-client';
import { createClient } from '@/lib/supabase-server';
import { hasUnlockedIdea, getBalance } from '@/lib/credits';
import { getAllCatalogData, getUnlockCounts } from '@/lib/catalog-store';
import { IDEA_EXAMPLES } from '@/lib/idea-examples';
import { listVettedCandidates } from '@/lib/idea-candidates';

export const metadata = {
  title: 'Startup Ideas Library: Pre-Validated with AI Market Research',
  description: 'Browse pre-validated startup ideas with AI market research, competitor analysis, and technical MVP blueprints included. B2B and consumer tracks, scored for viability.',
  alternates: { canonical: 'https://ideareels.io/ideas' },
  openGraph: {
    title: 'Startup Ideas Library: Pre-Validated with AI Market Research',
    description: 'Browse pre-validated startup ideas with AI market research and MVP blueprints. Every idea scored for viability.',
    url: 'https://ideareels.io/ideas',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels Startup Ideas Library' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Startup Ideas Library: Pre-Validated with AI Market Research',
    description: 'Browse pre-validated startup ideas with AI market research and MVP blueprints. Every idea scored for viability.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
};

export const revalidate = 3600;

export default async function IdeasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const premiumSlugs = IDEA_EXAMPLES.filter(i => i.score >= 80).map(i => i.slug);

  const [fullCatalog, unlockCounts, vetted] = await Promise.all([
    getAllCatalogData().catch(() => ({})),
    getUnlockCounts(premiumSlugs).catch(() => ({})),
    // The pre-scored pool (Option C): canonical ideas real users have validated
    // at 60+. Empty until the idea-candidates migration runs and validations flow.
    listVettedCandidates({ limit: 12 }).catch(() => []),
  ]);

  // Per-idea unlock state for this user
  let ideaUnlocks = {};
  let creditBalance = 0;
  if (user) {
    creditBalance = await getBalance(user.id).catch(() => 0);
    const checks = await Promise.all(
      premiumSlugs.map(async slug => [slug, await hasUnlockedIdea(user.id, slug).catch(() => false)])
    );
    ideaUnlocks = Object.fromEntries(checks);
  }

  // Never ship the paid research/blueprint of a LOCKED idea to the browser.
  // Locked premium ideas get only the public teaser line (all that the locked
  // card renders); full content is delivered by /api/catalog-idea-unlock once
  // the user is entitled. Unlocked ideas get their full content as before.
  const catalogData = {};
  for (const slug of premiumSlugs) {
    const entry = fullCatalog[slug];
    if (!entry) continue;
    catalogData[slug] = ideaUnlocks[slug]
      ? entry
      : { research: { teaserLine: entry.research?.teaserLine ?? '' } };
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Pre-Validated Startup Ideas Library',
    description: 'Curated startup ideas with AI market research, competitor analysis, and technical MVP blueprints. Scored for viability across B2B and Consumer tracks.',
    url: 'https://ideareels.io/ideas',
    numberOfItems: 5339,
  };

  return (
    <PopitoShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Startup Ideas Library</h1>
            <p className="fn__desc">Pre-validated startup ideas with AI market research and MVP blueprints included. Each one targets a specific problem, real demand, and a clear angle for building.</p>
            <p className="fn__desc" style={{ marginTop: 12, opacity: 0.7 }}>Every idea in this library has been scored for viability. We only surface combinations that clear a 75+ threshold across industry fit, workflow friction, and market specificity. It spans both B2B and consumer ideas, or you can use the wheel to generate your own.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <IdeasClient
        user={user}
        catalogData={catalogData}
        ideaUnlocks={ideaUnlocks}
        creditBalance={creditBalance}
        unlockCounts={unlockCounts}
        vetted={vetted}
      />
    </PopitoShell>
  );
}
