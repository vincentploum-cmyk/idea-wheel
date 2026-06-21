import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { LANDING_STEPS, FAQS } from '@/lib/content';
import { CREDIT_PACKAGES } from '@/lib/pricing';
import { createClient } from '@/lib/supabase-server';

const PACK_FEATURES = {
  starter: [
    '5 credits for your own spins and blueprints',
    'First-pass verdict before you spend more',
    '1 credit for deep research',
    '2 credits for the full blueprint',
  ],
  pro: [
    'Unlock 1 ready-made idea from the library',
    'Great if you want a shortcut instead of spinning',
    'Includes the deeper research path',
    'Best for builders who want to move tonight',
  ],
  power: [
    'Unlock 2 ready-made ideas from the library',
    'Compare two strong directions fast',
    'Pick the one worth your weekend',
    'Best for builders who want optionality',
  ],
};

export const metadata = {
  title: 'IdeaReels — Spin up your next weekend build',
  description: 'Out of ideas? IdeaReels helps you frame the concept, research the market, and generate the technical MVP blueprint before you commit to building.',
  alternates: { canonical: 'https://ideareels.io' },
};

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
        description: 'IdeaReels helps builders frame a strong concept, research the market, and generate a technical MVP blueprint before they commit to building.',
        applicationCategory: 'BusinessApplication',
        featureList: [
          'Concept framing',
          'Market research',
          'Competitive analysis',
          'Technical MVP blueprint',
          'Go-to-market starter',
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
      <div className="popito_fn_pagetitle" style={{ minHeight: 0, padding: '40px 0 20px', display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Built for AI builders and vibe coders
            </p>
            <h1 className="fn__title" style={{ fontSize: 'clamp(2.2rem,5vw,3.8rem)', lineHeight: 1.08, marginBottom: 16 }}>
              Out of ideas?<br />Let IdeaReels do the homework.
            </h1>
            <p className="fn__desc" style={{ maxWidth: 620, margin: '0 auto 1.5rem' }}>
              We do more than spark a concept. IdeaReels frames the opportunity, researches the market, and maps the technical MVP so you know what to build, why it matters, and how to move fast.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {user ? (
                <Link href="/wheel" className="fn__btn"><span>Spin now</span></Link>
              ) : (
                <Link href="/auth/register" className="fn__btn"><span>Get started</span></Link>
              )}
            </div>
            <span className="wings" />
            <span className="raleway">
              <span /><span /><span /><span /><span />
            </span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section id="how-it-works" style={{ padding: '8px 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                This is the work founders usually do before they commit
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>Think of it like the prep you would want before Shark Tank, compressed into a builder-friendly workflow.</p>
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

        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28, maxWidth: 820, marginInline: 'auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                What IdeaReels is actually doing under the hood
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>
                The value is not just the idea. The value is the founder work you do not have to piece together yourself.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 28 }}>
              <div className="fn__bold_item" style={{ padding: '28px 26px' }}>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                  We do the analysis
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.72, lineHeight: 1.8, fontSize: 14 }}>
                  <li>Frame the niche, buyer, pain point, and wedge</li>
                  <li>Scan demand signals and market timing</li>
                  <li>Map competitors, substitutes, and risks</li>
                  <li>Pressure-test whether the opportunity is real</li>
                </ul>
              </div>

              <div className="fn__bold_item" style={{ padding: '28px 26px' }}>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                  We compose the MVP
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.72, lineHeight: 1.8, fontSize: 14 }}>
                  <li>Define the MVP scope and what to leave out</li>
                  <li>Outline user flow, product logic, and key screens</li>
                  <li>Recommend stack, architecture, and integrations</li>
                  <li>Give you the build steps to move faster</li>
                </ul>
              </div>

              <div className="fn__bold_item" style={{ padding: '28px 26px' }}>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                  What you walk away with
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.72, lineHeight: 1.8, fontSize: 14 }}>
                  <li>Market opportunity summary</li>
                  <li>Competitor and positioning snapshot</li>
                  <li>Detailed MVP feature plan</li>
                  <li>Technical blueprint and launch direction</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="price" style={{ padding: '0 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28, maxWidth: 760, marginInline: 'auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Pay only when you want the deeper work done
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>
                Starter is for testing your own directions. Pro and Power are shortcut packs if you want a researched starting point instead of beginning from scratch.
              </p>
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
                            <span className="price_text" style={{ whiteSpace: 'nowrap' }}>/ {pkg.unitLabel}</span>
                          </div>
                          <div className="desc"><p>{pkg.tagline}</p></div>
                        </div>
                        <div className="item_content">
                          <ul>
                            {(PACK_FEATURES[pkg.key] || []).map((feature) => (
                              <li key={feature}>
                                <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" />
                                <span className="text">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="item_footer">
                          <Link href="/pricing" className="fn__btn medium"><span>{pkg.key === 'starter' ? 'Get credits' : 'See details'}</span></Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Common questions
              </h2>
            </div>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
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
