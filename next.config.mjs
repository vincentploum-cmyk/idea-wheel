const nextConfig = {
  reactStrictMode: true,
  // Trust Render's reverse proxy headers so X-Forwarded-Host is used
  // This ensures request.url reflects the real public URL, not localhost
  experimental: {
    trustHostHeader: true,
  },
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
  // Performance budget — targets match Google CWV "Good" thresholds
  // Measured via /api/vitals (web-vitals client component on every page)
  // Targets: LCP < 2500ms, CLS < 0.1, INP < 200ms, FCP < 1800ms, TTFB < 800ms
  // JS budget: keep total JS under 200kB gzipped for fast INP on mobile
  // Image budget: next/image serves AVIF/WebP automatically via /_next/image
};

export default nextConfig;
