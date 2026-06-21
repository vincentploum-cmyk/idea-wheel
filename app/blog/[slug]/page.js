import { notFound } from 'next/navigation';
import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { BLOG_POSTS, getBlogPost } from '@/lib/blog-posts';

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  return {
    title: `${post.title} | IdeaReels Blog`,
    description: post.description,
    alternates: { canonical: `https://ideareels.io/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      images: [{ url: post.image, alt: post.imageAlt }],
      type: 'article',
      publishedTime: post.date,
    },
  };
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderBody(body) {
  const lines = body.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', marginTop: 40, marginBottom: 12, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '2px solid #111', margin: '36px 0', opacity: 0.12 }} />);
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} style={{ margin: '16px 0 4px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16 }}>
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.match(/^\*\*(.+?)\*\* —/)) {
      const parts = line.split(/\*\*(.+?)\*\*/);
      elements.push(
        <p key={i} style={{ margin: '16px 0 8px', lineHeight: 1.7, fontSize: 16 }}>
          <strong style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>{parts[1]}</strong>
          {parts[2]}
        </p>
      );
    } else if (line.trim() !== '') {
      elements.push(
        <p key={i} style={{ margin: '0 0 18px', lineHeight: 1.8, fontSize: 16, opacity: 0.85 }}>
          {line}
        </p>
      );
    }
    i++;
  }
  return elements;
}

export default function BlogPostPage({ params }) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const otherPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <PopitoShell>
      {/* Hero */}
      <div style={{ background: '#fff', borderBottom: '3px solid #111' }}>
        <div className="container" style={{ maxWidth: 800, padding: '48px 24px 0' }}>
          <Link href="/blog" style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#111', textDecoration: 'none', opacity: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ← Blog
          </Link>
          <div style={{ marginTop: 20 }}>
            <span style={{
              display: 'inline-block',
              background: '#FFE000', border: '2px solid #111',
              borderRadius: '4px 999px 999px 4px',
              padding: '3px 12px 3px 8px',
              fontFamily: 'Nunito, sans-serif', fontWeight: 900,
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111',
              marginBottom: 16,
            }}>
              {post.category}
            </span>
            <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.6rem,4vw,2.8rem)', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              {post.title}
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, opacity: 0.65, margin: '0 0 20px', maxWidth: 620 }}>
              {post.description}
            </p>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, opacity: 0.5, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 32px' }}>
              {formatDate(post.date)} · {post.readTime}
            </p>
          </div>
        </div>
        {/* Hero image */}
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <img
            src={post.image}
            alt={post.imageAlt}
            style={{ width: '100%', maxHeight: 420, objectFit: 'cover', display: 'block', borderTop: '3px solid #111' }}
          />
        </div>
      </div>

      {/* Article body */}
      <div className="popito_fn_membership_page">
        <section style={{ padding: '48px 0 60px' }}>
          <div className="container" style={{ maxWidth: 720 }}>
            <div style={{ fontFamily: 'Georgia, serif', color: '#111' }}>
              {renderBody(post.body)}
            </div>

            {/* CTA */}
            <div className="fn__bold_item" style={{ marginTop: 48, padding: '32px 36px', background: '#FFE000', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 10px' }}>
                Ready to evaluate the opportunity and define the MVP?
              </h3>
              <p style={{ margin: '0 0 20px', opacity: 0.75, fontSize: 15 }}>
                Get the market research and technical blueprint that tell you whether to build, and how to execute.
              </p>
              <Link href="/auth/register" className="fn__btn"><span>Get started</span></Link>
            </div>

            {/* More articles */}
            {otherPosts.length > 0 && (
              <div style={{ marginTop: 56 }}>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 24, letterSpacing: '-0.01em' }}>
                  More from the blog
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {otherPosts.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="fn__bold_item" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
                        <img src={p.image} alt={p.imageAlt} style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 6, border: '2px solid #111', flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: '0 0 4px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, lineHeight: 1.25 }}>{p.title}</p>
                          <p style={{ margin: 0, fontSize: 12, opacity: 0.5, fontFamily: 'Nunito, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.readTime}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </PopitoShell>
  );
}
