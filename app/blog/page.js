import Link from 'next/link';
import Image from 'next/image';
import PopitoShell from '@/components/popito/PopitoShell';
import { BLOG_POSTS } from '@/lib/blog-posts';

export const metadata = {
  title: 'Blog — Startup Validation, Market Research & MVP Planning',
  description: 'Practical guides on startup idea validation, AI market research, MVP planning, and how solo founders are building faster. Written for vibe coders and solo founders.',
  alternates: { canonical: 'https://ideareels.io/blog' },
  openGraph: {
    title: 'IdeaReels Blog — Startup Validation & AI Tools for Founders',
    description: 'Practical guides on startup idea validation, AI market research, and MVP planning for solo builders.',
    type: 'website',
    url: 'https://ideareels.io/blog',
  },
};


function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'IdeaReels Blog',
    description: 'Practical articles on AI startup validation, market research, and MVP planning for solo founders.',
    url: 'https://ideareels.io/blog',
    hasPart: (BLOG_POSTS ?? []).map((post) => ({
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      url: `https://ideareels.io/blog/${post.slug}`,
      datePublished: post.date,
      image: post.image,
    })),
  };

  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">The IdeaReels Blog</h1>
            <p className="fn__desc">Startup idea validation, AI market research, and MVP planning — practical guides for solo founders and vibe coders who want to build the right thing faster.</p>
            <p className="fn__desc" style={{ marginTop: 12, opacity: 0.7 }}>We write about the specific problems founders run into before they build: how to read demand signals, what makes a market defensible, how to scope an MVP that ships. No theory, no fluff — just the stuff that changes what you build next.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '8px 0 60px' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
              {BLOG_POSTS.map((post, i) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article className="fn__bold_item" style={{ overflow: 'hidden', padding: 0, transition: 'transform 0.15s', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                      <Image
                        src={post.image}
                        alt={post.imageAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 370px"
                        priority={i === 0}
                        style={{ objectFit: 'cover' }}
                      />
                      <span style={{
                        position: 'absolute', top: 12, left: 12, zIndex: 1,
                        background: '#FFE000', border: '2px solid #111',
                        borderRadius: '4px 999px 999px 4px',
                        padding: '3px 12px 3px 8px',
                        fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                        fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111',
                      }}>
                        {post.category}
                      </span>
                    </div>
                    <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.5, fontFamily: 'Nunito, sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {formatDate(post.date)} · {post.readTime}
                      </p>
                      <h2 style={{ margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                        {post.title}
                      </h2>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, opacity: 0.65 }}>
                        {post.description}
                      </p>
                      <span style={{ marginTop: 'auto', paddingTop: 12, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#111', letterSpacing: '0.04em' }}>
                        Read article <span style={{ opacity: 0.4 }}>//</span>
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Conversion CTA at bottom of blog listing */}
      <div style={{ background: '#FFE000', borderTop: '3px solid #111', padding: '48px 20px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.4rem,3vw,2rem)', margin: '0 0 12px' }}>
          Ready to validate your next idea?
        </h2>
        <p style={{ margin: '0 0 8px', opacity: 0.75, fontSize: 15 }}>
          AI market research + full MVP blueprint from $3.99. Credits never expire.
        </p>
        <p style={{ margin: '0 0 24px', opacity: 0.55, fontSize: 13 }}>No subscription. Buy only when the signal is worth pursuing.</p>
        <Link href="/pricing" className="fn__btn"><span>Get credits — from $3.99</span></Link>
      </div>
    </PopitoShell>
  );
}
