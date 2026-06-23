import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { FAQS } from '@/lib/content';

export const metadata = {
  title: 'FAQ — IdeaReels: Market Research & MVP Blueprint Tool',
  description: 'Answers to common questions about IdeaReels — how AI market validation works, what credits do, and how to go from concept to technical MVP blueprint.',
  alternates: { canonical: 'https://ideareels.io/faq' },
};

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Frequently Asked Questions</h1>
            <p className="fn__desc">Everything you need to know before you burn a night or weekend on the wrong idea.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <div className="popito_fn_membership_page">
        <div className="container" style={{ padding: '60px 20px 60px', maxWidth: 720, margin: '0 auto' }}>
          {FAQS.map((faq) => (
            <div key={faq.q} className="fn__bold_item" style={{ marginBottom: 16, padding: '22px 26px' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>{faq.q}</h2>
              <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{faq.a}</p>
            </div>
          ))}
          <div className="fn__bold_item" style={{ marginTop: 32, padding: '32px 36px', background: '#FFE000', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 20, margin: '0 0 10px' }}>
              Ready to validate your idea?
            </h2>
            <p style={{ margin: '0 0 8px', opacity: 0.75, fontSize: 14 }}>
              Get AI market research and a full technical MVP blueprint before you commit to building.
            </p>
            <p style={{ margin: '0 0 20px', opacity: 0.6, fontSize: 13 }}>
              Market research from $3.99. Credits never expire.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link href="/pricing" className="fn__btn"><span>Get credits — from $3.99</span></Link>
            </div>
          </div>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ideareels.io' },
          { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://ideareels.io/faq' },
        ],
      }) }} />
    </PopitoShell>
  );
}
