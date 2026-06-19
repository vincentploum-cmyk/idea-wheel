export default function sitemap() {
  return [
    { url: 'https://ideareels.io', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://ideareels.io/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://ideareels.io/faq', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://ideareels.io/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://ideareels.io/wheel', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ];
}
