import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { listSavedIdeas, saveValidatedIdea } from '../../../lib/saved-ideas';
import { hasUnlockedIdeas } from '../../../lib/credits';

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
  const user = await getUser();
  if (!user) return Response.json({ ideas: [], error: 'not_authenticated' }, { status: 200 });
  const ideas = await listSavedIdeas(user.id);
  return Response.json({ ideas });
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
  const { validationId, idea, comp } = await request.json();
  if (!validationId) return Response.json({ error: 'validationId required' }, { status: 400 });
  const result = await saveValidatedIdea({ userId: user.id, validationId, idea, comp });
  if (!result || result.error) {
    const msg = result?.error || 'save_failed';
    console.error('[POST /api/ideas] save failed:', msg, result?.code);
    return Response.json({ error: msg, code: result?.code }, { status: 500 });
  }
  return Response.json({ id: result.id });
}

// Save a catalog (preset) idea to the user's profile so it can go through
// the blueprint pipeline. Requires the user to have unlocked premium ideas.
export async function PUT(request) {
  const user = await getUser();
  if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });

  const { title, tag, description, score, action, workflow, industry } = await request.json();
  if (!title) return Response.json({ error: 'title required' }, { status: 400 });

  // Only premium ideas (score >= 80) need this flow; guard against free-riding
  if (score >= 80) {
    const unlocked = await hasUnlockedIdeas(user.id);
    if (!unlocked) return Response.json({ error: 'ideas_not_unlocked' }, { status: 403 });
  }

  // Stable validation_id derived from the idea title so re-clicks return the same row
  const validationId = `preset_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

  const comp = {
    title,
    verdict: description,
    plainSummary: description,
    score,
    verdictType: score >= 80 ? 'potential' : 'caution',
  };

  const idea = { action, workflow, industry, title };

  const result = await saveValidatedIdea({
    userId: user.id,
    validationId,
    idea,
    comp,
  });

  if (!result || result.error) {
    return Response.json({ error: result?.error || 'save_failed' }, { status: 500 });
  }
  return Response.json({ id: result.id });
}
