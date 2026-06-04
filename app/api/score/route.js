import { NextResponse } from 'next/server';
import { buildRetrievalContext } from '../../../lib/moat-retrieval';

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action;
    const workflow = body.experience || body.workflow;
    const industry = body.audience || body.industry;
    const modeName = body.mode === 'consumer' ? 'Consumer' : 'B2B';
    const heuristicScore = Number(body.heuristicScore || 50);

    if (!action || !workflow || !industry) {
      return NextResponse.json({ error: 'Missing action, workflow, industry' }, { status: 400 });
    }

    const retrieval = await buildRetrievalContext({ modeName, industry, action, workflow });
    const proof = retrieval.learning?.proof || {};
    const positiveSignals = (proof.shortlistRate || 0) + (proof.blueprintStarts || 0) * 2 + (proof.blueprintCompletions || 0) * 3 + (proof.shares || 0) * 2;
    const avoidCount = retrieval.learning?.verdictPatterns?.find((entry) => entry.label === 'avoid')?.count || 0;
    const warningCount = retrieval.learning?.verdictPatterns?.find((entry) => entry.label === 'warning')?.count || 0;

    const uplift = clamp(positiveSignals * 1.5, 0, 12);
    const penalty = clamp(avoidCount * 3 + warningCount * 1.5, 0, 16);
    const adjustedScore = clamp(Math.round(heuristicScore + uplift - penalty), 10, 96);
    const exactValidationCount = retrieval.learning?.exactMatchCounts?.validations || 0;
    const eurekaMoment = adjustedScore >= 84 && avoidCount === 0
      ? ((retrieval.prototypeMoments || [])[0] || retrieval.summary.moatAdvice)
      : null;

    return NextResponse.json({
      score: adjustedScore,
      insight: retrieval.summary.moatAdvice,
      angle: retrieval.summary.archetype,
      eureka: eurekaMoment,
      confidence: exactValidationCount ? 'learned' : 'cold-start',
      learning: retrieval.learning,
    });
  } catch (err) {
    console.error('[score]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
