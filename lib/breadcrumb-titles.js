// Slim slug→display-title map used by <Breadcrumbs/>.
// Kept separate from lib/blog-posts.js (60KB) and the *-data.js files (~30KB
// each) so the client bundle for every page doesn't ship the full content
// just to render a breadcrumb label. When a blog post's slug or title changes,
// update it here too.

export const BREADCRUMB_TITLES_BY_PATH = {
  // /blog/[slug] — mirror BLOG_POSTS titles.
  '/blog/how-to-validate-a-startup-idea': 'How to validate a startup idea',
  '/blog/how-ai-validates-startup-ideas': 'How AI validates startup ideas',
  '/blog/5-ai-tools-for-solo-founders': '5 AI tools for solo founders',
  '/blog/from-idea-to-blueprint-with-ai': 'From idea to blueprint',
  '/blog/rise-of-ai-native-startups': 'Rise of AI-native startups',
  '/blog/how-to-find-niche-startup-ideas': 'Find a niche startup idea',
  '/blog/blueprint-to-first-paying-customer': 'From blueprint to first customer',
  '/blog/best-startup-idea-validation-tools-2026': 'Best validation tools 2026',

  // /tools/*
  '/tools/rate-my-startup-idea': 'Rate my startup idea',
};
