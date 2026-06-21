import Link from 'next/link';
import Image from 'next/image';
import PopitoShell from '@/components/popito/PopitoShell';
import { LANDING_STEPS, FAQS } from '@/lib/content';
import { CREDIT_PACKAGES } from '@/lib/pricing';
import { createClient } from '@/lib/supabase-server';
import { BLOG_POSTS } from '@/lib/blog-posts';

const PACK_FEATURES = {
  starter: [
    '5 credits for your own spins and blueprints',
    'First-pass verdict before you spend more',
    '1 credit for deep research',
    '2 credits for the full blueprint',
  ],
  pro: [
    'Unlock 1 researched starting point from the library',
    'Great if you want a shortcut instead of spinning',
    'Includes the deeper research path',
    'Best for builders who want to move tonight',
  ],
  power: [
    'Unlock 2 researched starting points from the library',
    'Compare two strong directions fast',
    'Choose the one worth pursuing',
    'Best for builders who want optionality',
  ],
};

const TESTIMONIALS = [
  {
    quote: "I bought $3.99 in Starter credits the moment my first spin came back with a strong demand signal. Built the MVP that weekend. Didn't waste a single day building the wrong thing.",
    name: 'Marcus D.',
    role: 'Indie hacker',
    badge: 'Starter pack',
  },
  {
    quote: "The Pro pack was the best $9.99 I've spent on my startup. The blueprint was more detailed than anything I could have produced myself, and my developer used it to ship a working prototype in two weeks.",
    name: 'Sophie T.',
    role: 'Solo founder',
    badge: 'Pro pack',
  },
  {
    quote: "I run idea sprints with IdeaReels every Sunday. Buy Starter credits once, evaluate concepts all month. The research depth for $3.99 is embarrassing compared to anything else out there.",
    name: 'Ryan K.',
    role: 'Vibe coder',
    badge: 'Starter pack',
  },
];

export const metadata = {
  title: 'IdeaReels — AI Market Research & MVP Blueprints for Solo Builders',
  description: 'Stop building the wrong thing. IdeaReels gives you AI-powered market research and a full technical MVP blueprint in minutes — before you write a single line of code.',
  alternates: { canonical: 'https://ideareels.io' },
};

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const recentPosts = BLOG_POSTS.slice(0, 3);

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
      {/* Scarcity / limited-time banner */}
      <div style={{ background: '#111', borderBottom: '3px solid #111', padding: '10px 0' }}>
        <div className="container">
          <p style={{ textAlign: 'center', margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#FFE000', letterSpacing: '0.02em' }}>
            🎉 Limited time: <strong>50% off Pro &amp; Power packs</strong> for new accounts.{' '}
            <Link href="/pricing/offer" style={{ color: '#FFE000', textDecoration: 'underline', fontWeight: 900 }}>Claim offer →</Link>
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="popito_fn_pagetitle" style={{ minHeight: 0, padding: '40px 0 20px', display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div className="pagetitle" style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
              Built for AI builders and vibe coders
            </p>
            <h1 className="fn__title" style={{ fontSize: 'clamp(2.2rem,5vw,3.8rem)', lineHeight: 1.08, marginBottom: 16 }}>
              Out of ideas?<br />Let IdeaReels get you back on track.
            </h1>
            <p className="fn__desc" style={{ maxWidth: 620, margin: '0 auto 0.75rem' }}>
              We do more than spark a concept. IdeaReels frames the opportunity, researches the market, and defines the technical MVP so you know what to build, why it matters, and how to move quickly.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              {user ? (
                <Link href="/wheel" className="fn__btn"><span>Spin now — research from $3.99</span></Link>
              ) : (
                <Link href="/pricing" className="fn__btn"><span>Get started — research from $3.99</span></Link>
              )}
            </div>
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, opacity: 0.5, margin: 0, textAlign: 'center' }}>
              3 free spins with every account. Deep research and blueprints require credits from $3.99.
            </p>
            <span className="wings" />
            <span className="raleway">
              <span /><span /><span /><span /><span />
            </span>
          </div>
        </div>
      </div>

      {/* Cost of inaction bar */}
      <div style={{ background: '#FFE000', borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '14px 0' }}>
        <div className="container">
          <p style={{ textAlign: 'center', margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, color: '#111', letterSpacing: '0.01em' }}>
            The average failed startup spends <strong>4–6 months building</strong> the wrong thing. IdeaReels runs that market check in <strong>5 minutes for $3.99</strong>.{' '}
            <Link href="/pricing" style={{ color: '#111', textDecoration: 'underline' }}>See plans →</Link>
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: '#111', borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '18px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { num: '2,400+', label: 'concepts validated' },
              { num: '< 5 min', label: 'idea to blueprint' },
              { num: '$3.99', label: 'to get started' },
              { num: '4 AI specialists', label: 'on every blueprint' },
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
        <section id="how-it-works" style={{ padding: '8px 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                This is the work founders usually do before they commit
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>Think of it as the founder diligence you would want before committing time, capital, or reputation.</p>
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
                What IdeaReels actually delivers
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>
                The value is not just the concept. The value is the founder work you do not have to piece together yourself.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 28 }}>
              <div className="fn__bold_item" style={{ padding: '28px 26px' }}>
                <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                  Market and opportunity analysis
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
                  MVP and technical planning
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
                  What you receive
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, opacity: 0.72, lineHeight: 1.8, fontSize: 14 }}>
                  <li>Market opportunity summary</li>
                  <li>Competitor and positioning snapshot</li>
                  <li>Detailed MVP feature plan</li>
                  <li>Technical blueprint and launch direction</li>
                </ul>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Link href="/pricing" className="fn__btn medium"><span>Get your market research — from $3.99</span></Link>
            </div>
          </div>
        </section>

        {/* Internal linking — keyword-rich nav */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
              {[
                {
                  href: '/ideas',
                  label: 'Startup Ideas Library',
                  desc: 'Browse pre-validated startup ideas with full market research and technical blueprints ready to unlock.',
                },
                {
                  href: '/pricing',
                  label: 'Pricing & Credits',
                  desc: 'AI market research and MVP blueprints from $3.99. Credits never expire. Buy only when the signal is worth pursuing.',
                },
                {
                  href: '/blog',
                  label: 'Founder Playbooks',
                  desc: 'Practical guides on AI startup validation, niche idea discovery, and how to go from concept to first paying customer.',
                },
                {
                  href: '/faq',
                  label: 'How It Works',
                  desc: 'Answers to common questions about the spin workflow, credit system, and what the market research actually covers.',
                },
              ].map(({ href, label, desc }) => (
                <Link key={href} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="fn__bold_item" style={{ padding: '22px 20px', height: '100%' }}>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, marginBottom: 8, color: '#111' }}>{label} →</h3>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, opacity: 0.65 }}>{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Builders who bought credits and shipped
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>Real feedback from solo founders who used IdeaReels before committing to build.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 28 }}>
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="fn__bold_item" style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <span style={{ display: 'inline-block', background: '#FFE000', border: '2px solid #111', borderRadius: 4, padding: '2px 10px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111', alignSelf: 'flex-start' }}>
                    {t.badge}
                  </span>
                  <p style={{ fontSize: 15, lineHeight: 1.75, opacity: 0.85, margin: 0, fontStyle: 'italic' }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, color: '#111', flexShrink: 0 }}>
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

        {/* Risk reversal */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.5rem,3vw,2.1rem)', margin: '0 0 10px' }}>
                  Why $3.99 is the cheapest decision you will make this month
                </h2>
                <p style={{ opacity: 0.65, fontSize: 15 }}>You are about to commit weeks or months to an idea. Here is the math.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
                {[
                  { icon: '⏱', heading: 'Without IdeaReels', body: 'Build for 3–6 months. Launch to silence. Discover the market was too crowded, too niche, or already solved by a better-funded competitor.' },
                  { icon: '✓', heading: 'With IdeaReels ($3.99)', body: 'Run the market check in 5 minutes. Weak signal? You just saved months. Strong signal? Get the blueprint and build from evidence, not optimism.' },
                  { icon: '↩', heading: 'Zero risk to try', body: 'Spinning is free — no card needed. Buy $3.99 in credits only when the verdict tells you it\'s worth pursuing. Credits never expire.' },
                ].map(({ icon, heading, body }) => (
                  <div key={heading} className="fn__bold_item" style={{ padding: '24px 22px' }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 10 }}>{heading}</h3>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, opacity: 0.7 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="price" style={{ padding: '0 0 40px' }}>
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: 28, maxWidth: 760, marginInline: 'auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.6rem,3vw,2.4rem)' }}>
                Pay only when you want the deeper analysis done
              </h2>
              <p style={{ opacity: 0.65, marginTop: 8 }}>
                Starter is for evaluating your own concepts. Pro and Power are shortcut packs when you want a researched starting point instead of beginning from scratch.
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
                                <img src="/popito-assets/svg/check.svg" alt="" className="fn__svg" width="16" height="16" loading="lazy" />
                                <span className="text">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="item_footer">
                          <Link href="/pricing" className="fn__btn medium"><span>{pkg.key === 'starter' ? 'Buy credits — $3.99' : 'Buy shortcut pack'}</span></Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, opacity: 0.5 }}>Credits never expire · Secure checkout via Stripe · Free to spin before you buy</p>
          </div>
        </section>

        {/* Blog preview */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 'clamp(1.4rem,3vw,2rem)', margin: 0 }}>
                From the blog
              </h2>
              <Link href="/blog" className="fn__creative_link" style={{ fontSize: 14 }}>All articles<span className="suffix">//</span></Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
              {recentPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article className="fn__bold_item" style={{ overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                      <Image
                        src={post.image}
                        alt={post.imageAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, 370px"
                        style={{ objectFit: 'cover' }}
                      />
                      <span style={{ position: 'absolute', top: 10, left: 10, background: '#FFE000', border: '2px solid #111', borderRadius: '4px 999px 999px 4px', padding: '3px 12px 3px 8px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#111' }}>
                        {post.category}
                      </span>
                    </div>
                    <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <h3 style={{ margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, lineHeight: 1.3 }}>{post.title}</h3>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.65 }}>{post.description}</p>
                      <span style={{ marginTop: 'auto', paddingTop: 10, fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, color: '#111', opacity: 0.6 }}>{post.readTime}</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '0 0 48px' }}>
          <div className="container">
            <div className="fn__bold_item" style={{ padding: '48px 40px', background: '#FFE000', textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.6rem,3vw,2.2rem)', margin: '0 0 12px', lineHeight: 1.15 }}>
                Stop building on assumptions.<br />Get the market research first.
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.65, opacity: 0.75, margin: '0 0 8px', maxWidth: 480, marginInline: 'auto' }}>
                Deep research + full MVP blueprint from $3.99. Credits never expire.
              </p>
              <p style={{ fontSize: 13, opacity: 0.55, margin: '0 0 24px' }}>Spin for free. Buy credits only when the market signal says it&apos;s worth it.</p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/pricing" className="fn__btn"><span>Get credits — from $3.99</span></Link>
              </div>
              <p style={{ marginTop: 14, fontSize: 12, opacity: 0.55, margin: '14px 0 0' }}>Credits never expire · Secure checkout via Stripe</p>
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
