import { requireNhlAdmin, isValidRunId, getRunFile, NHL_SLOTS } from '@/lib/nhl-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const gate = await requireNhlAdmin();
  if (gate.response) return gate.response;
  const slot = new URL(request.url).searchParams.get('slot');
  if (!isValidRunId(params?.id) || !NHL_SLOTS.includes(slot)) {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  const file = await getRunFile(params.id, slot);
  if (!file) return Response.json({ error: 'not_found' }, { status: 404 });
  return new Response(file.blob, {
    headers: {
      'Content-Type': file.blob.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
