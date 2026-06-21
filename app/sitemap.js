import { BLOG_POSTS } from '@/lib/blog-posts';

export default function sitemap() {
  const blogUrls = BLOG_POSTS.map((post) => ({
    url: `https://ideareels.io/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.65,
  }));

  return [
    { url: 'https://ideareels.io', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://ideareels.io/wheel', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://ideareels.io/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.85 },
    { url: 'https://ideareels.io/ideas', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://ideareels.io/blog', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: 'https://ideareels.io/faq', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...blogUrls,
  ];
}
