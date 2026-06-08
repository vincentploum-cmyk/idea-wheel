import { NextResponse } from 'next/server';
import { buildAdaptiveGeneratorConfig } from '../../../../lib/generator-config';
import { loadGeneratorTrainingData } from '../../../../lib/moat-store';
import { loadOpportunityBank } from '../../../../lib/opportunity-bank';

export async function GET() {
  try {
    const trainingData = await loadGeneratorTrainingData(600);
    const opportunityBank = await loadOpportunityBank();
    const config = buildAdaptiveGeneratorConfig(trainingData, opportunityBank);
    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    console.error('[generator/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
