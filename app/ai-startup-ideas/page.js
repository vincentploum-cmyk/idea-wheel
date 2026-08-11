import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { CheckIcon } from '@/components/popito/icons';

export const metadata = {
  // Kept short: the root layout appends ' | IdeaReels', and Google's ~600px
  // title cutoff lands around 60 characters total.
  title: 'AI Startup Ideas Worth Building in 2026',
  description:
    'Fifteen AI startup ideas with the pain, the buyer, and the wedge spelled out for each — plus how to validate any of them against real market data first.',
  alternates: { canonical: 'https://ideareels.io/ai-startup-ideas' },
  openGraph: {
    title: 'AI Startup Ideas Worth Building in 2026',
    description:
      'Fifteen AI startup ideas with the pain, the buyer, and the wedge spelled out for each — plus how to validate any of them against real market data first.',
    url: 'https://ideareels.io/ai-startup-ideas',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'AI startup ideas worth building, from IdeaReels' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Startup Ideas Worth Building in 2026',
    description: '15 AI startup ideas with the pain, the buyer, and the wedge spelled out — plus how to validate them before you build.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
};

// Each idea states the pain, the buyer, and the wedge explicitly — the three
// things generic "100 AI ideas" listicles leave out, and the three inputs the
// scorer needs anyway if a reader takes one of these to /wheel.
const IDEA_GROUPS = [
  {
    heading: 'Boring-industry automation: where the easiest money is',
    intro:
      'The least crowded AI startup ideas are stuck inside industries software forgot. These buyers have real budgets, painful paperwork, and almost no AI-native competition — the opposite of the developer-tools space everyone else is fighting over.',
    ideas: [
      {
        name: 'Client intake agent for law firms',
        pain: 'Paralegals burn hours turning intake calls and web forms into structured case summaries, conflict checks, and follow-up lists.',
        buyer: 'Small and mid-size firms in one practice area — immigration, personal injury, family law — that already pay for practice-management software.',
        wedge: 'Pick a single practice area and integrate with the one or two practice-management tools that dominate it. Depth in one vertical beats a generic legal chatbot.',
      },
      {
        name: 'Permit and compliance copilot for contractors',
        pain: 'General contractors lose days per project assembling permit applications and tracking municipality-specific requirements that change without notice.',
        buyer: 'Residential and light-commercial contractors, who feel every lost day as carrying cost on an idle crew.',
        wedge: 'Start with one metro area where you can hand-verify the requirements, then expand city by city. The messy local data is the moat.',
      },
      {
        name: 'Photo-to-quote engine for field services',
        pain: 'HVAC, roofing, and restoration companies quote slowly because someone senior has to review photos and write the estimate — and the slowest quote usually loses the job.',
        buyer: 'Owner-operators and small field-service fleets where the estimator is the bottleneck.',
        wedge: 'Photos plus job notes in, itemized draft estimate out, priced from the company’s own historical quotes so it matches how they actually bid.',
      },
      {
        name: 'Insurance claim packager for restoration companies',
        pain: 'Water, fire, and storm restoration firms compile photo evidence, scope notes, and line-item estimates into carrier-ready claim packages by hand, and mistakes delay payment for months.',
        buyer: 'Restoration contractors whose cash flow depends on how fast carriers approve claims.',
        wedge: 'Generate documentation in the exact formats the major carriers expect. Format fluency is the product.',
      },
    ],
  },
  {
    heading: 'Vertical AI copilots: one industry, owned end to end',
    intro:
      'Horizontal AI assistants compete with every model vendor at once. A copilot that speaks one industry’s language, plugs into its systems of record, and automates its specific weekly grind competes with almost nobody.',
    ideas: [
      {
        name: 'Tenant-communications AI for property managers',
        pain: 'Property managers drown in tenant emails and maintenance requests: triaging urgency, drafting replies, and dispatching vendors eats their entire day.',
        buyer: 'Independent property managers and small firms managing 50–500 units — big enough to hurt, too small for enterprise tooling.',
        wedge: 'Triage and draft inside their existing inbox and property-management system rather than asking them to switch tools.',
      },
      {
        name: 'Invoice intelligence for independent restaurants',
        pain: 'Ingredient prices move weekly, but supplier invoices sit unread in a drawer, so margin erosion is only discovered at month end.',
        buyer: 'Independent restaurants and small groups without a purchasing department.',
        wedge: 'Photograph or forward invoices, get ingredient-level price tracking and margin alerts. One clear insight per week beats a dashboard nobody opens.',
      },
      {
        name: 'Front-desk AI for independent clinics',
        pain: 'Dental, veterinary, and physio front desks juggle appointment prep, insurance verification summaries, and patient intake — high-turnover work that gates revenue.',
        buyer: 'Practice owners, who lose billable time whenever the front desk falls behind.',
        wedge: 'Start with one workflow (intake summarization or verification prep), one specialty, and the scheduling system that dominates it.',
      },
      {
        name: 'Month-end close assistant for small accounting firms',
        pain: 'Bookkeeping firms run the same close checklist for every client every month: chasing documents, categorizing exceptions, drafting client queries.',
        buyer: 'Firms serving 20–200 small-business clients, where each hour saved per client multiplies across the roster.',
        wedge: 'Automate the chase-and-categorize loop inside the ledger tools they already use. Accountants pay for time, not for another dashboard.',
      },
    ],
  },
  {
    heading: 'Content and sales ops: automate the grind around the craft',
    intro:
      'Generic AI writing tools are a bloodbath. The survivors pick one professional niche, learn its constraints (compliance, voice, format), and automate the repeatable grind around the work rather than the work itself.',
    ideas: [
      {
        name: 'Compliance-safe content repurposer for regulated professionals',
        pain: 'Financial advisors and insurance agents want a content presence, but every post has to survive compliance review, so most publish nothing.',
        buyer: 'Advisors and the marketing teams at their broker-dealers.',
        wedge: 'One long-form input (a call, a webinar, a note) becomes a month of posts and newsletters pre-checked against the compliance rules of their specific regulator.',
      },
      {
        name: 'SOP generator from screen recordings',
        pain: 'Agencies and ops teams know they should document processes, but writing step-by-step SOPs with screenshots is so tedious it never happens — until the person who knew the process quits.',
        buyer: 'Agencies, ops leads, and franchises that live or die on repeatable process.',
        wedge: 'Record the task once; get a formatted SOP with annotated screenshots. Sell the outcome (a living process library), not the editor.',
      },
      {
        name: 'Proposal writer trained on past wins',
        pain: 'Agencies and consultancies rebuild every proposal from scratch even though their best material already exists in decks and docs from deals they won.',
        buyer: 'Small agencies where the founder still writes every proposal at 11pm.',
        wedge: 'Ingest past proposals and a discovery-call transcript; draft the new proposal in the firm’s own voice with their real case studies. The private corpus is the moat.',
      },
    ],
  },
  {
    heading: 'Data and monitoring: sell the signal, not the model',
    intro:
      'Models are commodities; curated signal is not. These AI business ideas use models as a processing layer over data that is public but painful to collect, and charge for the distilled answer.',
    ideas: [
      {
        name: 'Review-mining engine for product teams',
        pain: 'Competitor weaknesses are documented in public — G2, app stores, Reddit — but no PM has time to read ten thousand reviews.',
        buyer: 'Product and marketing teams at B2B software companies.',
        wedge: 'Continuous mining of competitor reviews into feature-gap and churn-driver reports. Start as a productized report, grow into a subscription.',
      },
      {
        name: 'Regulation-change monitor for one licensed niche',
        pain: 'Childcare centers, food producers, and cannabis operators face state and local rule changes that arrive as dense PDFs, where missing one costs a license.',
        buyer: 'Owners and compliance leads in a single licensed industry.',
        wedge: 'Watch the sources, translate changes into plain-English "here’s what changes for you" alerts. Boring, sticky, priced like insurance.',
      },
      {
        name: 'Local pricing intelligence for the trades',
        pain: 'A plumber setting rates has no idea what competitors charge; they guess, and either leave money on the table or lose bids.',
        buyer: 'Trades and local service businesses in competitive metros.',
        wedge: 'Aggregate public quotes, directories, and marketplace data into a simple "here’s the going rate in your zip code" report, one trade at a time.',
      },
      {
        name: 'Evaluation harness for teams shipping AI features',
        pain: 'Every company bolting AI onto its product discovers it has no way to tell whether outputs got better or worse after a prompt or model change.',
        buyer: 'Engineering teams at the thousands of non-AI companies now shipping LLM features.',
        wedge: 'Domain-specific eval templates and regression alerts for one industry’s use cases — narrower and more opinionated than the general eval platforms.',
      },
    ],
  },
];

const PICK_FILTERS = [
  {
    title: 'Can you reach the buyer without a sales team?',
    text: 'The best AI startup idea is worthless if the buyer only purchases through six-month enterprise cycles. Solo founders should pick buyers who congregate somewhere reachable — a subreddit, a trade association, a Facebook group — and who can swipe a card.',
  },
  {
    title: 'Does the pain recur weekly?',
    text: 'One-off pains make one-off sales. Every idea on this list targets a weekly or monthly grind, because recurring pain is what people pay for on a recurring basis.',
  },
  {
    title: 'Is there willingness-to-pay evidence already?',
    text: 'Look for money already moving: existing tools with bad reviews, agencies charging for the manual version, job posts for the role that does this by hand. If nobody pays anything adjacent today, be suspicious.',
  },
  {
    title: 'Would the incumbent have to break itself to copy you?',
    text: 'A wedge survives when copying it is awkward for the incumbent — it undercuts their pricing, their sales channel, or their architecture. "We also added AI" from an incumbent kills thin wrappers, not workflow-deep products.',
  },
];

const FAQ = [
  {
    q: 'What makes a good AI startup idea in 2026?',
    a: 'Three things: a painful recurring workflow (not a novelty), a buyer with budget you can actually reach, and a wedge where AI changes the economics of the work rather than just decorating it. The ideas that fail are model-first ("what can GPT do?"); the ones that work are workflow-first ("what does this buyer grind through every week?").',
  },
  {
    q: 'How do I come up with startup ideas with AI?',
    a: 'Work backwards from market signals instead of brainstorming in a vacuum. Look at what people complain about on Reddit and in review sites, what agencies charge to do manually, and what roles companies keep hiring for. Tools like the IdeaReels wheel automate this: they combine an action, workflow, and industry into a concrete concept and immediately score it against live demand signals so you start from evidence, not vibes.',
  },
  {
    q: 'Are "ChatGPT wrapper" startups still viable?',
    a: 'Thin wrappers — a prompt behind a paywall — are dead, because the model vendors ship that feature themselves. But most successful vertical AI products are technically wrappers. What makes them defensible is everything around the model: proprietary data, integrations with an industry’s systems of record, compliance handling, and workflow depth an incumbent can’t bolt on in a sprint.',
  },
  {
    q: 'Which AI startup ideas work for a solo founder with no ML background?',
    a: 'Almost all of the good ones. Every idea on this page can be built on top of API models — no training required. The scarce skills are domain understanding and distribution, not machine learning. A solo founder who deeply knows property management will beat an ML PhD at building a property-management copilot.',
  },
  {
    q: 'How do I validate an AI startup idea before building it?',
    a: 'Check three signals before writing code: community demand (are real people describing this pain in their own words?), competitive pressure (is the space empty because it’s a bad market, or genuinely underserved?), and willingness to pay (does money already move on this problem?). You can run that check manually in an afternoon, or paste the idea into the free IdeaReels scorer and get a verdict with the reasoning shown in about a minute.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

// ItemList of the 15 ideas — the structure Google prefers for list-style
// results. BreadcrumbList is intentionally absent: <Breadcrumbs/> in
// PopitoShell already emits it for this route.
const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'AI startup ideas worth building in 2026',
  description: 'Fifteen AI startup ideas with the pain point, buyer, and wedge identified for each.',
  itemListOrder: 'https://schema.org/ItemListUnordered',
  numberOfItems: IDEA_GROUPS.reduce((n, g) => n + g.ideas.length, 0),
  itemListElement: IDEA_GROUPS.flatMap((g) => g.ideas).map((idea, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: idea.name,
    description: idea.pain,
  })),
};

const linkStyle = { color: '#111', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 };

export default function AiStartupIdeasPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">AI startup ideas worth building in 2026</h1>
            <p className="fn__desc">
              Not another list of &ldquo;build a chatbot.&rdquo; Fifteen concrete AI startup ideas with the pain point,
              the buyer, and the wedge spelled out for each — and a way to check any of them against real market
              signals before you commit a weekend to the wrong one.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '32px 0 56px' }}>
          <div className="container" style={{ maxWidth: 860 }}>

            {/* Framing */}
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 14px' }}>
              Most AI idea lists fail you in the same way: they name a technology (&ldquo;AI meal planner!&rdquo;) and
              skip the three questions that decide whether anyone pays — who exactly hurts, how often, and why an
              incumbent won&rsquo;t just add the same feature next quarter. So the list below is organized around
              those questions. Every idea names the pain, the buyer, and the wedge.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 14px' }}>
              One honest caveat before the list: an idea on a page — this page included — is a starting point, not
              validation. Markets shift monthly. Before building any of these, run the demand check described at the
              bottom, or let the{' '}
              <Link href="/tools/rate-my-startup-idea" style={linkStyle}>free idea scorer</Link>{' '}
              pull live Reddit, Google Trends, and competitor signals on the specific version you&rsquo;d build.
            </p>

            {/* Idea groups */}
            {IDEA_GROUPS.map((group) => (
              <div key={group.heading}>
                <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '48px 0 12px', letterSpacing: '-0.01em' }}>
                  {group.heading}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 20px' }}>{group.intro}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {group.ideas.map((idea) => (
                    <div key={idea.name} className="fn__bold_item" style={{ padding: '22px 24px' }}>
                      <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: '0 0 10px' }}>{idea.name}</h3>
                      <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.85, margin: '0 0 8px' }}>
                        <strong style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>The pain: </strong>{idea.pain}
                      </p>
                      <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.85, margin: '0 0 8px' }}>
                        <strong style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>Who pays: </strong>{idea.buyer}
                      </p>
                      <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.85, margin: 0 }}>
                        <strong style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900 }}>The wedge: </strong>{idea.wedge}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Mid-page CTA */}
            <div className="fn__bold_item" style={{ marginTop: 40, padding: '32px 32px', background: '#FFE000', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 10px' }}>
                Want ideas generated from live market signals instead?
              </h2>
              <p style={{ margin: '0 0 20px', opacity: 0.75, fontSize: 15 }}>
                Spin the wheel to generate specific startup concepts and score them against live demand data on the
                spot, or browse the pre-researched ideas library with the evidence already attached.
              </p>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/auth/register?next=%2Fwheel" className="fn__btn"><span>Spin an idea free</span></Link>
                <Link href="/ideas" className="fn__btn medium"><span>Browse the ideas library</span></Link>
              </div>
            </div>

            {/* How to pick */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 12px', letterSpacing: '-0.01em' }}>
              How to pick one (instead of collecting all fifteen)
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 20px' }}>
              Idea collecting is procrastination with better branding. Run each candidate through four filters and
              keep whichever survives all of them:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              {PICK_FILTERS.map((f) => (
                <div key={f.title} className="fn__bold_item" style={{ padding: '22px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 8px' }}>{f.title}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>{f.text}</p>
                </div>
              ))}
            </div>

            {/* Validate section */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 12px', letterSpacing: '-0.01em' }}>
              Then validate it before you build it
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 14px' }}>
              Whichever idea survives the filters, resist opening the code editor for one more hour. Check community
              demand, competitive pressure, and willingness-to-pay evidence first — the manual process is in our
              guide to{' '}
              <Link href="/blog/how-to-validate-a-startup-idea" style={linkStyle}>validating a startup idea</Link>,
              and the fast version is the{' '}
              <Link href="/tools/rate-my-startup-idea" style={linkStyle}>free AI idea scorer</Link>, which runs the
              same checks against live data and shows its reasoning.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: 0 }}>
              Still deciding what kind of thing to build in the first place — a weekend project, a micro-SaaS, or a
              venture-scale product? Start with the decision framework in{' '}
              <Link href="/what-to-build-with-ai" style={linkStyle}>what to build with AI</Link>, or dig into{' '}
              <Link href="/blog/how-to-find-micro-saas-ideas-with-real-demand" style={linkStyle}>finding micro-SaaS ideas with real demand</Link>.
            </p>

            {/* FAQ */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 20px', letterSpacing: '-0.01em' }}>
              AI startup ideas: frequently asked questions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FAQ.map((f) => (
                <div key={f.q} className="fn__bold_item" style={{ padding: '20px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15.5, margin: '0 0 8px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <CheckIcon width={14} height={14} /> {f.q}
                  </p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>{f.a}</p>
                </div>
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="fn__bold_item" style={{ marginTop: 48, padding: '32px 36px', background: '#FFE000', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 10px' }}>
                Found one worth a closer look?
              </h2>
              <p style={{ margin: '0 0 20px', opacity: 0.75, fontSize: 15 }}>
                Get a free AI market score on your version of it — demand, competition, willingness to pay — before
                you spend a single evening building.
              </p>
              <Link href="/auth/register?next=%2Fwheel" className="fn__btn"><span>Score the idea free</span></Link>
              <p style={{ margin: '14px 0 0', fontSize: 13, opacity: 0.65 }}>
                No credit card · Deeper research and MVP blueprints from $3.99 · No subscription
              </p>
            </div>
          </div>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </PopitoShell>
  );
}
