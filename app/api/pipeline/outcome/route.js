import { NextResponse } from 'next/server';
import { ensureSessionId, recordOutcome } from '../../../../lib/moat-store';

export async function POST(request) {
  try {
    const body = await request.json();
    const { signal, modeName, action, workflow, industry, payload } = body;
    if (!signal) {
      return NextResponse.json({ error: 'Missing signal' }, { status: 400 });
    }

    const sessionId = ensureSessionId(body.sessionId);
    await recordOutcome({
      sessionId,
      signal,
      modeName,
      action,
      workflow,
      industry,
      payload: payload || null,
    });

    return NextResponse.json({ ok: true, sessionId });
  } catch (err) {
    console.error('[pipeline/outcome]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
