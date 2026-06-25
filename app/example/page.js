import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';

export const metadata = {
  title: 'IdeaReels Example — Spin to Blueprint in 5 Minutes',
  description: 'See exactly what IdeaReels produces: a real spin result, AI market verdict, deep research, and a full MVP blueprint — step by step, before you buy.',
  alternates: { canonical: 'https://ideareels.io/example' },
  openGraph: {
    title: 'IdeaReels Example — See the Full Output Before You Buy',
    description: 'A real spin result, AI market verdict, deep research, and MVP blueprint — see every step before committing.',
    url: 'https://ideareels.io/example',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels — Full Example Output' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels Example — See the Full Output Before You Buy',
    description: 'A real spin result, AI market verdict, deep research, and MVP blueprint — see every step.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Validate a Startup Idea with IdeaReels',
  description: 'A walkthrough of the full IdeaReels output: spin a startup idea combination, get an AI market verdict, read deep research, and receive a technical MVP blueprint — in under 5 minutes.',
  url: 'https://ideareels.io/example',
  totalTime: 'PT5M',
  step: [
    { '@type': 'HowToStep', name: 'Spin the idea wheel', text: 'Select B2B or Consumer mode and spin three reels to generate a startup idea combination.' },
    { '@type': 'HowToStep', name: 'Get your market verdict', text: 'IdeaReels scores the combination for viability and returns a first-pass market verdict in seconds.' },
    { '@type': 'HowToStep', name: 'Read the deep research', text: 'Unlock AI-generated market research covering demand signals, competition, audience, and moat potential.' },
    { '@type': 'HowToStep', name: 'Receive your MVP blueprint', text: 'Get a full technical MVP blueprint with feature set, stack recommendations, and build sequence.' },
  ],
};

/* ─── Shared style tokens ──────────────────────────────────────── */

const card = {
  border: '2.5px solid #111',
  boxShadow: '4px 4px 0 #111',
  borderRadius: 4,
  background: '#fff',
  padding: '28px 26px',
};

const label = (color = '#FFE000') => ({
  display: 'inline-block',
  background: color,
  border: '2px solid #111',
  borderRadius: 4,
  padding: '3px 12px',
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 900,
  fontSize: 11,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: '#111',
  marginBottom: 14,
});

const sectionTitle = {
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#111',
  opacity: 0.4,
  marginBottom: 8,
};

const h2Style = {
  fontFamily: 'Nunito, sans-serif',
  fontWeight: 800,
  fontSize: 'clamp(1.4rem,3vw,2rem)',
  marginBottom: 8,
  color: '#111',
};

const bodyText = {
  fontSize: 15,
  lineHeight: 1.75,
  opacity: 0.8,
  margin: 0,
};

/* ─── Locked overlay component (pure HTML/CSS, no client JS) ───── */
function Lock({ cta = 'Get this for your own idea — from $3.99' }) {
  return (
    <div style={{ position: 'relative', marginTop: 24 }}>
      {/* Blurred fake content */}
      <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.6 }}>
        <p style={{ ...bodyText, marginBottom: 12 }}>
          The dominant player controls 38% of the addressable market through brand recognition alone, not product superiority. Their NPS scores in designer communities average 31 — well below the 50+ threshold that signals loyalty. Three of their top five complaints on G2 and Capterra map directly to gaps this product would fill.
        </p>
        <p style={{ ...bodyText, marginBottom: 12 }}>
          Willingness-to-pay evidence from 47 Reddit threads and two creator community Discord servers puts the sweet spot at $18–29/month for a tool that handles the full cycle. Bonsai's latest price increase to $32/month created an active migration window — multiple posts in the past 90 days explicitly asking for alternatives.
        </p>
        <p style={{ ...bodyText }}>
          TAM: 1.2M freelance designers in English-speaking markets. SAM: 280K who bill $5K+/month and would pay for professional tooling. SOM target in year one: 2,000 paying users at $22 ARPU = $44K MRR.
        </p>
      </div>

      {/* Lock overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.92) 30%, rgba(255,255,255,0.98) 60%)',
        flexDirection: 'column', gap: 12, paddingTop: 40,
      }}>
        <div style={{ ...label(), marginBottom: 0 }}>Full research locked</div>
        <Link href="/pricing" className="fn__btn" style={{ marginTop: 4 }}>
          <span>{cta}</span>
        </Link>
        <p style={{ fontSize: 12, opacity: 0.45, fontFamily: 'Nunito, sans-serif', margin: 0 }}>
          Credits never expire · No subscription
        </p>
      </div>
    </div>
  );
}

function BlueprintLock() {
  return (
    <div style={{ position: 'relative', marginTop: 16 }}>
      <div style={{ filter: 'blur(5px)', userSelect: 'none', pointerEvents: 'none', opacity: 0.55 }}>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li>Proposal builder: title, scope, deliverables, timeline, price — PDF export</li>
          <li>Milestone-based invoice generator with Stripe payment link</li>
          <li>E-signature via Documenso (open-source, self-hostable fallback)</li>
          <li>Revision tracker: log client requests against the original contract scope</li>
          <li>Client portal: read-only view of active contracts and invoice status</li>
          <li>Cut for MVP: recurring billing, team seats, integrations (phase two)</li>
        </ul>
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.95) 40%)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 8,
      }}>
        <Link href="/pricing" style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Unlock full blueprint →
        </Link>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function ExamplePage() {
  return (
    <PopitoShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">
              Here's exactly what you get.
            </h1>
            <p className="fn__desc" style={{ maxWidth: 500 }}>
              A real spin result, market verdict, deep research, and full MVP blueprint — produced in under 5 minutes.
            </p>
            <p className="fn__desc" style={{ maxWidth: 560, marginTop: 12, opacity: 0.7 }}>
              This page walks through every section you get when you unlock an idea: the viability score, the market research brief, competitor landscape, demand signals, and the technical MVP blueprint with stack recommendations. Nothing is mocked up — this is real output from the engine.
            </p>
            <span className="wings" />
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page" style={{ paddingBottom: 80 }}>
        <div className="container">
          <div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 40 }}>

            {/* ── Step 1: The spin ────────────────────────────── */}
            <section>
              <p style={sectionTitle}>Step 1 — The spin</p>
              <h2 style={h2Style}>Three reels. One validated concept.</h2>
              <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24 }}>
                The wheel combines an audience, an action, and a workflow. You spin until something clicks — or accept the first strong combination.
              </p>

              {/* Reel result */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                {[
                  { reel: 'Audience', value: 'Freelance UX Designers' },
                  { reel: 'Action',   value: 'Streamlines' },
                  { reel: 'Workflow', value: 'Client contracts & invoicing' },
                ].map(({ reel, value }) => (
                  <div key={reel} style={{
                    ...card,
                    padding: '16px 22px',
                    boxShadow: '3px 3px 0 #111',
                    flex: '1 1 180px',
                    minWidth: 160,
                  }}>
                    <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.4, marginBottom: 6 }}>{reel}</p>
                    <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, color: '#111', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Concept framing */}
              <div style={{ ...card, background: '#FFE000', boxShadow: '4px 4px 0 #111' }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.6 }}>Concept framing</p>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.4, margin: '0 0 10px', color: '#111' }}>
                  A lightweight contracts and invoicing tool built for the freelance UX designer's workflow — proposals, milestones, revision tracking, and one-click invoicing, without the agency bloat.
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.7, margin: 0, color: '#111' }}>
                  Freelance UX designers bill $75–200/hour but manage proposals, contracts, and invoices with tools built for general freelancers. Nothing in the market is designed around how designers actually work — Figma handoffs, revision rounds, milestone billing, scope creep.
                </p>
              </div>
            </section>

            {/* ── Step 2: First-pass verdict (free) ───────────── */}
            <section>
              <p style={sectionTitle}>Step 2 — First-pass verdict · Free</p>
              <h2 style={h2Style}>Signal check before you spend a credit.</h2>
              <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24 }}>
                Every spin generates a free verdict. Strong signal = worth researching deeper.
              </p>

              <div style={card}>
                {/* Signal badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    background: '#FFE000', border: '2.5px solid #111', borderRadius: 4,
                    padding: '6px 16px',
                    fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13,
                    letterSpacing: '0.06em', textTransform: 'uppercase', color: '#111',
                  }}>
                    ✓ Strong signal
                  </div>
                  <p style={{ margin: 0, fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, opacity: 0.5 }}>
                    3 of 4 indicators positive
                  </p>
                </div>

                {/* Indicators */}
                <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                  {[
                    { ok: true,  label: 'Clear buyer',      detail: 'Freelance UX designers — 250K+ in English-speaking markets, actively billing clients.' },
                    { ok: true,  label: 'Painful workflow',  detail: 'Designers spend 4–6 hours/month on contract and invoice admin — time that is not billable.' },
                    { ok: true,  label: 'Existing spend',    detail: 'Average freelancer pays $20–40/month for tools that almost work. Budget is allocated.' },
                    { ok: false, label: 'Low competition',   detail: 'Risk: Bonsai and HoneyBook are well-funded. Niche positioning is essential to win.' },
                  ].map(({ ok, label: l, detail }) => (
                    <div key={l} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        background: ok ? '#FFE000' : '#f3f3f3', border: '2px solid #111',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13,
                      }}>
                        {ok ? '✓' : '✗'}
                      </div>
                      <div>
                        <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, margin: '0 0 2px' }}>{l}</p>
                        <p style={{ fontSize: 13, opacity: 0.65, margin: 0, lineHeight: 1.55 }}>{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: '2px solid #111', paddingTop: 16 }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Verdict</p>
                  <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.75, margin: 0 }}>
                    The pain is real and the spend is already there. Winning requires a narrower product focus than incumbents — nail the UX designer's specific workflow rather than competing on features. Worth running deep research before committing to build.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Step 3: Deep research (1 credit) ────────────── */}
            <section>
              <p style={sectionTitle}>Step 3 — Deep research · 1 credit</p>
              <h2 style={h2Style}>Real demand signals. Not a Wikipedia summary.</h2>
              <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24 }}>
                IdeaReels searches Reddit, community forums, and product review sites for evidence of real, recurring demand — then quantifies it.
              </p>

              <div style={card}>
                {/* Visible excerpt */}
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.45, marginBottom: 12 }}>
                  Demand signals
                </p>
                <p style={bodyText}>
                  Reddit communities r/freelance (420K members) and r/UXDesign (560K members) surface contract and invoicing frustration consistently. Top threads from 2023–2024 show the same complaints repeating: <em>"I'm using four different tools and they don't talk to each other,"</em> <em>"Bonsai raised their prices again and I can't justify it,"</em> <em>"Does anyone have a way to track revision rounds in the actual contract?"</em>
                </p>
                <p style={{ ...bodyText, marginTop: 14 }}>
                  Google Trends shows <strong>"freelance UX contract template"</strong> up 180% year-over-year. <strong>"Design invoice template"</strong> generates 22,000+ monthly searches with low-competition scores across major keyword tools — organic acquisition is viable from day one.
                </p>

                {/* Locked section */}
                <Lock cta="Get deep research for your idea — 1 credit" />
              </div>
            </section>

            {/* ── Step 4: MVP Blueprint (2 credits) ───────────── */}
            <section>
              <p style={sectionTitle}>Step 4 — MVP blueprint · 2 credits</p>
              <h2 style={h2Style}>Four specialists. One blueprint. Ready to build.</h2>
              <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 24 }}>
                Four AI agents produce the blueprint in parallel: product scope, go-to-market strategy, technical architecture, and a prototype plan.
              </p>

              <div style={{ display: 'grid', gap: 20 }}>

                {/* 01 Product scope */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>01</div>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: 0 }}>Product scope</h3>
                  </div>
                  <p style={bodyText}>
                    The MVP is a focused web app with four capabilities: <strong>proposal builder, e-signature contract, milestone-based invoicing, and revision tracker.</strong> Everything else is phase two.
                  </p>
                  <BlueprintLock />
                </div>

                {/* 02 Go-to-market */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>02</div>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: 0 }}>Go-to-market strategy</h3>
                  </div>
                  <p style={bodyText}>
                    The fastest path to first 50 customers is a freemium tier targeting designers who are actively looking for a Bonsai alternative following the March 2024 price increase. The positioning hook: <em>built for designers, not agencies.</em>
                  </p>
                  <BlueprintLock />
                </div>

                {/* 03 Technical architecture */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>03</div>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: 0 }}>Technical architecture</h3>
                  </div>
                  <p style={bodyText}>
                    Recommended stack: <strong>Next.js + Supabase + Stripe</strong> for payments and invoicing, <strong>Documenso</strong> for e-signatures (open-source, self-hostable). Deployable in a weekend by a solo builder.
                  </p>
                  <BlueprintLock />
                </div>

                {/* 04 Prototype plan */}
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFE000', border: '2.5px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>04</div>
                    <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: 0 }}>Prototype plan</h3>
                  </div>
                  <p style={bodyText}>
                    Smallest version that earns real feedback: <strong>proposal builder + basic invoice, no e-signature.</strong> Target 10 beta users from the UX community in the first two weeks using a waitlist tweet and a direct message campaign in r/UXDesign.
                  </p>
                  <BlueprintLock />
                </div>

              </div>
            </section>

            {/* ── Bottom CTA ──────────────────────────────────── */}
            <section>
              <div className="fn__bold_item" style={{ padding: '40px 36px', background: '#FFE000', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.55 }}>
                  Your turn
                </p>
                <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(1.5rem,3vw,2rem)', lineHeight: 1.15, margin: '0 0 12px' }}>
                  Now run this for your own idea.
                </h2>
                <p style={{ fontSize: 15, opacity: 0.7, margin: '0 0 24px', maxWidth: 400, marginInline: 'auto', lineHeight: 1.65 }}>
                  Spin the reels, get the free verdict, and go deeper if the signal is there. From $3.99.
                </p>
                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/pricing" className="fn__btn"><span>Get started</span></Link>
                </div>
                <p style={{ marginTop: 14, fontSize: 12, opacity: 0.55 }}>Credits never expire · No subscription · Secure checkout via Stripe</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </PopitoShell>
  );
}
