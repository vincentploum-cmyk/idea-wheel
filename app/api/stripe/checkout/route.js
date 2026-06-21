// Deprecated — all checkout calls now go to /api/credits/purchase
export async function POST() {
  return Response.json(
    { error: 'This endpoint is deprecated. Use /api/credits/purchase instead.', code: 'DEPRECATED' },
    { status: 410 }
  );
}
