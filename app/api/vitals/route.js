export async function POST(request) {
  try {
    const metric = await request.json();
    // In production: forward to your analytics provider (e.g. Vercel Analytics, PostHog, GA4)
    // console.log('[vitals]', metric);
    console.log(`[vitals] ${metric.name}=${Math.round(metric.value)} rating=${metric.rating} page=${metric.page}`);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
