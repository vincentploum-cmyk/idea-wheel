import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildAdaptiveGeneratorConfig } from '../../../../lib/generator-config';
import { loadGeneratorTrainingData } from '../../../../lib/moat-store';
import { loadOpportunityBank } from '../../../../lib/opportunity-bank';

// Read cookies + adaptive learning data on every request: never statically
// prerender or CDN-cache this. (Also required now that we gate on the session.)
export const dynamic = 'force-dynamic';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  // The wheel (the only legitimate caller) is signed-in only. Requiring auth here
  // stops anyone from scraping the opportunity intelligence without an account.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const trainingData = await loadGeneratorTrainingData(600);
    const opportunityBank = await loadOpportunityBank();
    const config = buildAdaptiveGeneratorConfig(trainingData, opportunityBank);
    return NextResponse.json(config, {
      headers: {
        // Per-user, must revalidate — never shared in a CDN/edge cache.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[generator/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
