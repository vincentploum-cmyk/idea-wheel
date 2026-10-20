const nextConfig = {
  reactStrictMode: true,
  // pdf-parse (PDF cheat sheets) is loaded by Node as is: its bundled pdf.js is not for the bundler.
  experimental: { serverComponentsExternalPackages: ['pdf-parse'] },
  env: {
    NEXT_PUBLIC_COMMIT_SHA: (process.env.RENDER_GIT_COMMIT || process.env.NEXT_PUBLIC_COMMIT_SHA || '').slice(0, 7),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
