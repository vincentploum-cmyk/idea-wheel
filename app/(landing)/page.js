import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { LANDING_STEPS, FAQS } from '@/lib/content';
import { CREDIT_PACKAGES } from '@/lib/pricing';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'IdeaReels — Find a Startup Idea Worth Building',
  description: 'Generate sharper startup business ideas in seconds using real market signals. Get instant validation with competitor analysis, market size, and demand signals — then unlock a build-ready blueprint only when one is worth pursuing.',
  alternates: { canonical: 'https://ideareels.io' },
};

const IDEA_EXAMPLES = [
  {
    tag: 'B2B · Field service',
    title: 'CertWatch',
    idea: 'Tracks employee certifications, safety cards, and IDs — auto-sends reminders before expiry so field-service teams stop drowning in spreadsheets.',
    signal: '"We have 40 staff and manage all certs manually. Someone always slips through."',
  },
  {
    tag: 'B2B · Auto repair',
    title: 'ShopPing',
    idea: 'Auto-sends "waiting on part", "in progress", "ready for pickup" SMS updates for independent auto repair shops — cuts incoming calls by half.',
    signal: '"Customers call 5x a day asking if their car is ready. I lose an hour just answering."',
  },
  {
    tag: 'B2B · Amazon sellers',
    title: 'Listing Suppression Decoder',
    idea: "Scans a seller's full Amazon catalog, decodes why each listing is suppressed, and outputs the exact attribute fix — no more guessing at vague rejection codes.",
    signal: '"Amazon suppressed 12 of my listings with zero explanation. Support is useless."',
  },
];

function IdeaSnippet({ item, align = 'left' }) {
  return (
    <div style={{ padding: '0 0 48px' }}>
      <div className="container">
        <div style={{
          maxWidth: 540,
          margin: align === 'right' ? '0 0 0 auto' : align === 'center' ? '0 auto' : '0',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.4, marginBottom: 12 }}>
            ↳ From the engine
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.4 }}>{item.tag}</span>
            <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 19, margin: 0 }}>{item.title}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.65, opacity: 0.65, margin: 0 }}>{item.idea}</p>
            <blockquote style={{
              margin: '4px 0 0',
              padding: '9px 14px',
              borderLeft: '3px solid #FFE000',
              background: 'transparent',
              borderRadius: 4,
              fontSize: 13,
              fontStyle: 'italic',
              opacity: 0.68,
              lineHeight: 1.55,
            }}>{item.signal}</blockquote>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'IdeaReels',
        url: 'https://ideareels.io',
        description: 'IdeaReels generates startup ideas, validates them with market data, and produces build-ready blueprints for founders.',
        applicationCategory: 'BusinessApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: '3 free credits on signup',
        },
        featureList: [
          'Startup idea generation',
          'Market validation',
          'Competitor analysis',
          'Build-ready blueprints',
          'Product design recommendations',
          'Go-to-market strategy',
          'Infrastructure planning',
          'Prototype generation',
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is IdeaReels?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'IdeaReels is a startup idea generator and validator. It generates concrete startup concepts, runs a free market check with competitor analysis and demand signals, then unlocks a full build-ready blueprint only for ideas that clear the bar.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do credits work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Every new account starts with 3 free credits. A market check costs 1 credit and the full blueprint costs 2 credits. You can purchase more credits from the pricing page.',
            },
          },
          {
            '@type': 'Question',
            name: 'What does the blueprint include?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The full blueprint unlocks four AI specialists: product design, go-to-market strategy, infrastructure planning, and prototype generation — all in one click.',
            },
          },
        ],
      },
    ],
  };

  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle" style={{ minHeight: 0, padding: '40px 0 20px', display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
            <h3 className="fn__title" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', lineHeight: 1.15 }}>
              Find a startup idea<br />worth building.
            </h3>
            <p className="fn__desc" style={{ maxWidth: 520, margin: '0 auto 2rem' }}>
              Spin three reels to generate a concrete startup concept. Get an instant AI market verdict — free, every time. Unlock a full build blueprint only when the idea earns it.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {user ? <Link href="/wheel" className="fn__btn"><span>Spin a free idea</span></Link> : <Link href="/auth/register" className="fn__btn"><span>Get started</span></Link>}
            </div>
            <span className="wings" />
            <span className="raleway">
              <span /><span /><span /><span /><span />
            </span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <IdeaSnippet item={IDEA_EXAMPLES[0]} align="left" />

        <section id="how-it-works" style={{ padding: '8px 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                How it works
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>From first spin to a build-ready blueprint in three steps.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 28 }}>
              {LANDING_STEPS.map((step) => (
                <div key={step.number} className="fn__bold_item" style={{ padding: '32px 28px' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: '#FFE000', border: '3px solid #111',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                    fontSize: 18, color: '#111', letterSpacing: '0.02em',
                  }}>
                    {step.number}
                  </div>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>
                    {step.title}
                  </h3>
                  <p style={{ opacity: 0.65, lineHeight: 1.65, fontSize: 14 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <IdeaSnippet item={IDEA_EXAMPLES[1]} align="right" />

        <section id="price" style={{ padding: '0 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Simple pricing
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>Market validation is always free. Credits unlock the deeper analysis and the blueprint.</p>
            </div>
            <div className="fn__pricing_tables">
              <div className="pt_content">
                <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 32, listStyle: 'none', padding: 0, margin: 0 }}>
                  {CREDIT_PACKAGES.map((pkg) => (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`}>
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'nowrap' }}>
                            <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{pkg.price}</h3>
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>/ {pkg.credits} credits</span>
                          </div>
                          <div className="desc"><p>{pkg.tagline}</p></div>
                        </div>
                        <div className="item_content">
                          <ul>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">{pkg.credits} credits included</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">Free market validation</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">1 credit → deep research</span>
                            </li>
                            <li>
                              <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                              <span className="text">2 credits → full blueprint</span>
                            </li>
                          </ul>
                        </div>
                        <div className="item_footer">
                          <Link href="/pricing" className="fn__btn medium"><span>Get started</span></Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <IdeaSnippet item={IDEA_EXAMPLES[2]} align="center" />

        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Common questions
              </h2>
            </div>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              {FAQS.slice(0, 4).map((faq) => (
                <div key={faq.q} className="fn__bold_item" style={{ marginBottom: 16, padding: '20px 24px' }}>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{faq.q}</h3>
                  <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{faq.a}</p>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <Link href="/faq" className="fn__creative_link">See all questions<span className="suffix">//</span></Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </PopitoShell>
  );
}
