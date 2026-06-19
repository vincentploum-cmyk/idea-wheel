export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/profile/'] },
    sitemap: 'https://ideareels.io/sitemap.xml',
  };
}
