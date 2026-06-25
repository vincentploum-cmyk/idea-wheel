import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import ReviewForm from '@/components/ReviewForm';
import { LANDING_STEPS, FAQS } from '@/lib/content';
import { CREDIT_PACKAGES } from '@/lib/pricing';
import { createClient } from '@/lib/supabase-server';

const PACK_FEATURES = {
  starter: [
    '5 credits — spin ideas and run blueprints',
    '1 credit for deep research',
    '2 credits for the full blueprint',
    'First-pass verdict before you spend more',
  ],
  pro: [
    'Unlock 1 pre-researched idea from the library',
    'Skip the spin — go straight to the blueprint',
    'Best for builders who want to move tonight',
    'Includes deep research',
  ],
  power: [
    'Unlock 2 pre-researched ideas from the library',
    'Compare two strong directions fast',
    'Choose the one worth pursuing',
    'Best for builders who want optionality',
  ],
};

const TESTIMONIALS = [
  {
    quote: "First spin flagged zero real competitors in the niche I picked. Bought credits that night, had the blueprint by morning. Shipped the MVP that weekend. No wasted days.",
    name: 'Marcus D.',
    role: 'Solo founder',
    badge: 'Starter pack',
  },
  {
    quote: "I handed the blueprint straight to my developer. He said it was the clearest brief he’d ever gotten from a non-technical founder. Working prototype was live in under two weeks.",
    name: 'Sophie T.',
    role: 'Solo founder',
    badge: 'Pro pack',
  },
  {
    quote: "Sunday night ritual now. Spin a few ideas, see what the research says, kill the weak ones fast. At $3.99 a pack it’s cheaper than the coffee I used to drink while convincing myself bad ideas were good.",
    name: 'Ryan K.',
    role: 'Vibe coder',
    badge: 'Starter pack',
  },
];

export const metadata = {
  title: 'Startup Idea Generator with AI Market Research & MVP Blueprint',
  description: 'IdeaReels is a startup idea generator for solo founders, vibe coders, and indie hackers. Spin an idea, get AI market research and a full MVP blueprint in under 5 minutes. From $3.99, no subscription.',
  alternates: { canonical: 'https://ideareels.io' },
  openGraph: {
    title: 'Startup Idea Generator with AI Market Research & MVP Blueprint',
    description: 'Spin a startup idea, get AI market research and a full MVP blueprint in under 5 minutes. Built for solo founders and vibe coders. No subscription.',
    url: 'https://ideareels.io',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — Startup Idea Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Startup Idea Generator with AI Market Research & MVP Blueprint',
    description: 'Spin a startup idea, get AI market research and a full MVP blueprint in under 5 minutes. No subscription.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'IdeaReels',
        url: 'https://ideareels.io',
        description: 'IdeaReels helps builders frame a strong concept, research the market, and define a technical MVP blueprint before they commit to building.',
        applicationCategory: 'BusinessApplication',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '3.99',
          highPrice: '19.99',
          priceCurrency: 'USD',
        },
        featureList: [
          'AI startup idea validation',
          'Market research and demand analysis',
          'Competitive landscape analysis',
          'Technical MVP blueprint',
          'Go-to-market strategy',
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  };

  return (
    <PopitoShell>
      {/* Hero */}
      <div className="popito_fn_pagetitle" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              For solo founders, vibe coders &amp; indie hackers
            </p>
            <h1 className="fn__title" style={{ fontSize: 'clamp(2.2rem,5vw,3.8rem)', lineHeight: 1.1, marginBottom: 14, textWrap: 'balance' }}>
              The startup idea generator that tells you if it&apos;s worth building.
            </h1>
            <p className="fn__desc" style={{ maxWidth: 560, margin: '0 auto 20px' }}>
              Spin three reels to generate a specific startup idea, then get AI market research and a full technical MVP blueprint — in under 5 minutes, from $3.99, no subscription.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              {user ? (
                <Link href="/wheel" className="fn__btn"><span>Get started!</span></Link>
              ) : (
                <Link href="/pricing" className="fn__btn"><span>Get started!</span></Link>
              )}
            </div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, opacity: 0.5, margin: 0 }}>
              Market research + MVP blueprint from $3.99. Credits never expire.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#111', borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '18px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 'clamp(20px,5vw,40px)', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { num: '< 5 min', label: 'idea to blueprint' },
              { num: '$3.99',  label: 'to get started' },
              { num: '4 AI agents', label: 'on every blueprint' },
            ].map(({ num, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, color: '#FFE000', lineHeight: 1 }}>{num}</div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 11, color: '#fff', opacity: 0.65, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">

        {/* How it works */}
        <section id="how-it-works" style={{ padding: '48px 0' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)', marginBottom: 8, textWrap: 'balance' }}>
                The founder diligence you should do before you commit
              </h2>
              <p style={{ opacity: 0.6, maxWidth: 520, margin: '0 auto' }}>
                Most builders skip this. IdeaReels does it in 5 minutes.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 24, marginBottom: 28 }}>
              {LANDING_STEPS.map((step) => (
                <div key={step.number} className="fn__bold_item" style={{ padding: '28px 24px' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: '#FFE000', border: '3px solid #111',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 14,
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 18, color: '#111',
                  }}>
                    {step.number}
                  </div>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
                    {step.title}
                  </h3>
                  <p style={{ opacity: 0.65, lineHeight: 1.65, fontSize: 14, margin: 0 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          <div style={{ textAlign: 'center' }}>
              <Link href="/example" className="fn__creative_link" style={{ fontSize: 14 }}>
                See a full example — spin to blueprint<span className="suffix">//</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)', textAlign: 'center', marginBottom: 32, textWrap: 'balance' }}>
              What founders say
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="fn__bold_item" style={{ padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span style={{ display: 'inline-block', background: '#FFE000', border: '2px solid #111', borderRadius: 4, padding: '2px 10px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111', alignSelf: 'flex-start' }}>
                    {t.badge}
                  </span>
                  <p style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.85, margin: 0, fontStyle: 'italic' }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: '#111', flexShrink: 0 }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14 }}>{t.name}</p>
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Leave a review */}
        <section style={{ padding: '0 0 56px' }}>
          <div className="container">
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)', textAlign: 'center', marginBottom: 28, textWrap: 'balance' }}>
              Tried it? Tell other founders.
            </h2>
            <ReviewForm />
          </div>
        </section>

        {/* Pricing */}
        <section id="price" style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 640, marginInline: 'auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)', marginBottom: 8, textWrap: 'balance' }}>
                Pay only when the signal says go
              </h2>
              <p style={{ opacity: 0.65 }}>
                No subscription. Credits never expire. Buy once, use whenever.
              </p>
            </div>
            <div className="fn__pricing_tables">
              <div className="pt_content">
                <ul className="pt_list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 28, listStyle: 'none', padding: 0, margin: 0 }}>
                  {CREDIT_PACKAGES.map((pkg) => (
                    <li key={pkg.key} className="pt_list_item" style={{ display: 'block', width: 'auto', padding: 0 }}>
                      <div className={`fn__pricing_table_item fn__bold_item${pkg.highlight ? ' active' : ''}`}>
                        <div className="item_header">
                          <div className="plan"><span>{pkg.label}</span></div>
                          <div className="pricing" style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'nowrap' }}>
                            <h3 className="price" style={{ fontSize: 36, whiteSpace: 'nowrap' }}>{pkg.price}</h3>
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>/ {pkg.unitLabel}</span>
                          </div>
                          <div className="desc"><p>{pkg.tagline}</p></div>
                        </div>
                        <div className="item_content">
                          <ul>
                            {(PACK_FEATURES[pkg.key] || []).map((feature) => (
                              <li key={feature}>
                                <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" width="16" height="16" loading="lazy" />
                                <span className="text">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="item_footer">
                          <Link href="/pricing" className="fn__btn medium">
                            <span>
                              {pkg.key === 'starter' ? 'Buy credits — $3.99' :
                               pkg.key === 'pro'     ? 'Buy Pro pack — $9.99' :
                                                       'Buy Power pack — $19.99'}
                            </span>
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, opacity: 0.5 }}>
              Credits never expire · No subscription · Secure checkout via Stripe
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)', textAlign: 'center', marginBottom: 28, textWrap: 'balance' }}>
              Questions we get a lot
            </h2>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              {FAQS.slice(0, 4).map((faq) => (
                <div key={faq.q} className="fn__bold_item" style={{ marginBottom: 14, padding: '18px 22px' }}>
                  <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{faq.q}</h3>
                  <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{faq.a}</p>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Link href="/faq" className="fn__creative_link">See all questions<span className="suffix">//</span></Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '0 0 56px' }}>
          <div className="container">
            <div className="fn__bold_item" style={{ padding: '48px 40px', background: '#FFE000', textAlign: 'center', maxWidth: 680, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.6rem,3vw,2.2rem)', margin: '0 0 12px', lineHeight: 1.15, textWrap: 'balance' }}>
                Assumptions cost weeks.<br />Research costs $3.99.
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.65, opacity: 0.7, margin: '0 0 24px', maxWidth: 420, marginInline: 'auto' }}>
                Market research + MVP blueprint in under 5 minutes. No subscription.
              </p>
              <Link href="/pricing" className="fn__btn"><span>Get credits — from $3.99</span></Link>
              <p style={{ marginTop: 14, fontSize: 12, opacity: 0.55 }}>Credits never expire · Secure checkout via Stripe</p>
            </div>
          </div>
        </section>

      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </PopitoShell>
  );
}
