import { notFound } from 'next/navigation';
import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { CheckIcon } from '@/components/popito/icons';
import { ALTERNATIVES_PAGES, getAlternativesPage } from '@/lib/alternatives-data';

export async function generateStaticParams() {
  return ALTERNATIVES_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const page = getAlternativesPage(params.slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: `https://ideareels.io/alternatives/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `https://ideareels.io/alternatives/${page.slug}`,
      images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: page.title }],
    },
  };
}

// Renders plain text with [label](url) inline links
function InlineLinks({ text }) {
  const parts = text.split(/\[([^\]]+)\]\(([^)]+)\)/g);
  if (parts.length === 1) return text;
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) { if (parts[i]) out.push(parts[i]); }
    else if (i % 3 === 1) {
      const label = parts[i];
      const href = parts[i + 1] ?? '#';
      const isInternal = href.startsWith('/');
      const style = { color: '#111', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 };
      out.push(isInternal
        ? <Link key={i} href={href} style={style}>{label}</Link>
        : <a key={i} href={href} style={style} target="_blank" rel="noopener noreferrer">{label}</a>);
    }
  }
  return out;
}

// Plain text for JSON-LD: [label](url) → label
function stripMd(text) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}

const h2Style = { fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '48px 0 16px', letterSpacing: '-0.01em' };
const pStyle = { fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 16px' };

export default function AlternativesPage({ params }) {
  const page = getAlternativesPage(params.slug);
  if (!page) notFound();

  const c = page.competitorSummary;

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: stripMd(f.a) },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ideareels.io' },
      { '@type': 'ListItem', position: 2, name: 'Alternatives', item: 'https://ideareels.io/alternatives' },
      { '@type': 'ListItem', position: 3, name: page.title, item: `https://ideareels.io/alternatives/${page.slug}` },
    ],
  };

  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">{page.title}</h1>
            <p className="fn__desc">{page.metaDescription}</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '24px 0 56px' }}>
          <div className="container" style={{ maxWidth: 820 }}>

            {page.intro.map((para, i) => (
              <p key={i} style={pStyle}><InlineLinks text={para} /></p>
            ))}
            <p style={{ ...pStyle, fontSize: 13.5, opacity: 0.55 }}>
              Disclosure: IdeaReels is our product. Pricing for other tools was checked in July 2026 and may have changed — every tool is linked so you can verify.
            </p>

            <h2 style={h2Style}>What {c.name} does well — and where it falls short</h2>
            <div className="fn__bold_item" style={{ padding: '24px 26px', marginBottom: 8 }}>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 6px' }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: '#111', textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 }}>{c.name}</a>
                <span style={{ fontWeight: 700, opacity: 0.6 }}> · {c.pricing}</span>
              </p>
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Strengths</p>
              {c.strengths.map((s, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.65, opacity: 0.8, margin: '0 0 6px', display: 'flex', gap: 8 }}>
                  <CheckIcon width={13} height={13} /> <span>{s}</span>
                </p>
              ))}
              <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Where it falls short</p>
              {c.weaknesses.map((w, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.65, opacity: 0.8, margin: '0 0 6px' }}>— {w}</p>
              ))}
            </div>

            <h2 style={h2Style}>The alternatives, compared</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {page.alternatives.map((alt) => (
                <div key={alt.name} className="fn__bold_item" style={{ padding: '22px 24px', background: alt.ours ? '#FFE000' : '#fff' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 4px' }}>
                    <a href={alt.url} target={alt.ours ? undefined : '_blank'} rel={alt.ours ? undefined : 'noopener noreferrer'} style={{ color: '#111', textDecoration: 'underline', textDecorationColor: alt.ours ? '#111' : '#FFE000', textUnderlineOffset: 3 }}>{alt.name}</a>
                    {alt.ours && <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 10, border: '2px solid #111', borderRadius: 4, padding: '1px 8px' }}>Our product</span>}
                  </p>
                  <p style={{ fontSize: 13.5, fontWeight: 700, opacity: 0.65, margin: '0 0 10px', fontFamily: 'Nunito, sans-serif' }}>{alt.pricing} · Best for: {alt.bestFor}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.85, margin: 0 }}><InlineLinks text={alt.note} /></p>
                </div>
              ))}
            </div>

            <h2 style={h2Style}>IdeaReels vs {c.name}, feature by feature</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Roboto, sans-serif', fontSize: 14, border: '2px solid #111' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#fff', border: '1px solid #111', padding: '10px 12px', textAlign: 'left', fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}></th>
                    <th style={{ background: '#FFE000', border: '1px solid #111', padding: '10px 12px', textAlign: 'left', fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>IdeaReels</th>
                    <th style={{ background: '#fff', border: '1px solid #111', padding: '10px 12px', textAlign: 'left', fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.comparisonRows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ border: '1px solid #111', padding: '10px 12px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, verticalAlign: 'top' }}>{row.feature}</td>
                      <td style={{ border: '1px solid #111', padding: '10px 12px', verticalAlign: 'top', lineHeight: 1.5 }}>{row.ideareels}</td>
                      <td style={{ border: '1px solid #111', padding: '10px 12px', verticalAlign: 'top', lineHeight: 1.5 }}>{row.competitor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 style={h2Style}>The verdict</h2>
            {page.verdict.map((para, i) => (
              <p key={i} style={pStyle}><InlineLinks text={para} /></p>
            ))}

            <h2 style={h2Style}>Frequently asked questions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {page.faq.map((f) => (
                <div key={f.q} className="fn__bold_item" style={{ padding: '18px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, margin: '0 0 8px' }}>{f.q}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}><InlineLinks text={f.a} /></p>
                </div>
              ))}
            </div>

            <div className="fn__bold_item" style={{ marginTop: 44, padding: '30px 34px', background: '#FFE000', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 21, margin: '0 0 10px' }}>
                Try the free score before you pick anything.
              </h3>
              <p style={{ margin: '0 0 18px', opacity: 0.75, fontSize: 15 }}>
                Your first market score is free — see the demand signals for yourself, then decide.
              </p>
              <Link href="/tools/rate-my-startup-idea" className="fn__btn"><span>Rate my startup idea</span></Link>
            </div>
          </div>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </PopitoShell>
  );
}
