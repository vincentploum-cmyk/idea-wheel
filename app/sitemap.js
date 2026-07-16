import { BLOG_POSTS } from '@/lib/blog-posts';
import { ALTERNATIVES_PAGES } from '@/lib/alternatives-data';
import { VERSUS_PAGES } from '@/lib/versus-data';

export default function sitemap() {
  const blogUrls = BLOG_POSTS.map((post) => ({
    url: `https://ideareels.io/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.65,
  }));

  const alternativesUrls = ALTERNATIVES_PAGES.map((page) => ({
    url: `https://ideareels.io/alternatives/${page.slug}`,
    lastModified: new Date('2026-07-10'),
    changeFrequency: 'monthly',
    priority: 0.75,
  }));

  const versusUrls = VERSUS_PAGES.map((page) => ({
    url: `https://ideareels.io/versus/${page.slug}`,
    lastModified: new Date('2026-07-13'),
    changeFrequency: 'monthly',
    priority: 0.75,
  }));

  // /pricing/offer is intentionally absent: it's an unlinked promo page
  // (orphan URLs burn the crawl budget a new domain gets).
  return [
    { url: 'https://ideareels.io',                              lastModified: new Date('2026-07-10'), changeFrequency: 'weekly',  priority: 1 },
    { url: 'https://ideareels.io/tools/rate-my-startup-idea',   lastModified: new Date('2026-07-10'), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://ideareels.io/pricing',                      lastModified: new Date('2026-06-25'), changeFrequency: 'monthly', priority: 0.9 },
    { url: 'https://ideareels.io/ideas',                        lastModified: new Date('2026-06-25'), changeFrequency: 'weekly',  priority: 0.85 },
    { url: 'https://ideareels.io/example',                      lastModified: new Date('2026-06-25'), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://ideareels.io/alternatives',                 lastModified: new Date('2026-07-10'), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://ideareels.io/blog',                         lastModified: new Date('2026-07-10'), changeFrequency: 'weekly',  priority: 0.75 },
    { url: 'https://ideareels.io/faq',                          lastModified: new Date('2026-06-25'), changeFrequency: 'monthly', priority: 0.65 },
    { url: 'https://ideareels.io/contact',                      lastModified: new Date('2026-06-25'), changeFrequency: 'yearly',  priority: 0.4 },
    { url: 'https://ideareels.io/privacy',                      lastModified: new Date('2026-07-16'), changeFrequency: 'yearly',  priority: 0.2 },
    { url: 'https://ideareels.io/terms',                        lastModified: new Date('2026-07-16'), changeFrequency: 'yearly',  priority: 0.2 },
    { url: 'https://ideareels.io/status',                       lastModified: new Date('2026-07-16'), changeFrequency: 'daily',   priority: 0.3 },
    ...alternativesUrls,
    ...versusUrls,
    ...blogUrls,
  ];
}
