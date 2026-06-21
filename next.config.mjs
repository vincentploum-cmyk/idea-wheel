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
};

export default nextConfig;
