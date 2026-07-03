const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [400, 640, 768, 1024, 1200, 1600],
    imageSizes: [72, 128, 256, 400],
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: security },
      // Font files never change — safe to cache forever
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Template assets change rarely; 30 days + revalidation grace
      {
        source: '/popito-assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }],
      },
    ];
  },
  // Performance budget — targets match Google CWV "Good" thresholds
  // Measured via /api/vitals (web-vitals client component on every page)
  // Targets: LCP < 2500ms, CLS < 0.1, INP < 200ms, FCP < 1800ms, TTFB < 800ms
  // JS budget: keep total JS under 200kB gzipped for fast INP on mobile
  // Image budget: next/image serves AVIF/WebP automatically via /_next/image
};

export default nextConfig;
