import { NextResponse } from 'next/server';

// This route is deprecated — use /api/credits/purchase instead
// Kept for backwards compatibility
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  // Forward to the new endpoint
  const res = await fetch(new URL('/api/credits/purchase', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cookie': request.headers.get('cookie') || '' },
    body: JSON.stringify({ packId: body.packageKey || body.packId }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
