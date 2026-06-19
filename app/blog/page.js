import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { BLOG_POSTS } from '@/lib/blog-posts';

export const metadata = {
  title: 'Blog — AI, Startups & Tools | IdeaReels',
  description: 'Practical articles on AI tools, startup validation, and how founders are building faster with AI in 2025 and beyond.',
  alternates: { canonical: 'https://ideareels.io/blog' },
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">The IdeaReels Blog</h3>
            <p className="fn__desc">Practical writing on AI tools, startup validation, and building faster as a solo founder.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '8px 0 60px' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, maxWidth: 1100, margin: '0 auto' }}>
              {BLOG_POSTS.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article className="fn__bold_item" style={{ overflow: 'hidden', padding: 0, transition: 'transform 0.15s', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                      <img
                        src={post.image}
                        alt={post.imageAlt}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <span style={{
                        position: 'absolute', top: 12, left: 12,
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
    </PopitoShell>
  );
}
