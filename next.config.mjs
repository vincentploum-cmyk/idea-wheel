const nextConfig = {
  reactStrictMode: true,
  // Trust Render's reverse proxy headers so X-Forwarded-Host is used
  // This ensures request.url reflects the real public URL, not localhost
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
