import { NextResponse } from 'next/server';
import { buildAdaptiveGeneratorConfig } from '../../../../lib/generator-config';
import { loadGeneratorTrainingData } from '../../../../lib/moat-store';

export async function GET() {
  try {
    const trainingData = await loadGeneratorTrainingData(600);
    const config = buildAdaptiveGeneratorConfig(trainingData);
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
