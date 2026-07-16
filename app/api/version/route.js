import { SCORE_POLICY } from '../../../lib/score-policy';
import { RUBRIC_VERSION } from '../../../lib/scoring';

// Public build identity, so an artifact (PDF) can be tied deterministically to
// the exact code that produced it. Auditors can hit this instead of guessing
// whether a deploy matches the repo.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    commit: process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown',
    branch: process.env.RENDER_GIT_BRANCH || 'unknown',
    scorePolicy: {
      blueprintMin: SCORE_POLICY.blueprintMin,
      visibleMin: SCORE_POLICY.visibleMin,
      catalogMin: SCORE_POLICY.catalogMin,
      premiumMin: SCORE_POLICY.premiumMin,
      version: SCORE_POLICY.version,
    },
    rubricVersion: RUBRIC_VERSION,
    enforcement: {
      // Declares what the build API actually enforces before charging credits.
      serverSideBlueprintGate: true,
      requiresCurrentScoreVersion: true,
      clientSuppliedScoreIgnored: true,
    },
    generatedAt: new Date().toISOString(),
  });
}
