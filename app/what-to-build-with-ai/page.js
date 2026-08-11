import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { CheckIcon } from '@/components/popito/icons';

export const metadata = {
  // Kept short: the root layout appends ' | IdeaReels', and Google's ~600px
  // title cutoff lands around 60 characters total.
  title: 'What to Build With AI: 12 Projects People Pay For',
  description:
    'What to build with AI in 2026: four filters that separate paid products from ignored demos, plus twelve projects from weekend build to full startup.',
  alternates: { canonical: 'https://ideareels.io/what-to-build-with-ai' },
  openGraph: {
    title: 'What to Build With AI: 12 Projects People Pay For',
    description:
      'What to build with AI in 2026: four filters that separate paid products from ignored demos, plus twelve projects from weekend build to full startup.',
    url: 'https://ideareels.io/what-to-build-with-ai',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'What to build with AI, from IdeaReels' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'What to Build With AI: 12 Projects People Pay For',
    description: 'Four filters that separate paid AI products from ignored demos, plus twelve projects from weekend build to full startup.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
};

const FILTERS = [
  {
    title: 'Start from a workflow, not a model',
    text: '"What can GPT do?" produces demos. "What does a bookkeeper grind through every Friday?" produces products. Pick the recurring workflow first; the model is an implementation detail.',
  },
  {
    title: 'Boring beats impressive',
    text: 'The demo that wows Twitter and the product that gets a credit card are almost never the same thing. Invoice processing, intake forms, compliance checks — the unglamorous stuff is where the paying users are.',
  },
  {
    title: 'Name the buyer before you write code',
    text: 'If you can’t say who pays, where they hang out online, and roughly what this pain costs them per month, you’re building a portfolio piece. That’s fine — but know which one you’re doing.',
  },
  {
    title: 'Own something the model vendors can’t ship',
    text: 'Anything that is purely "model + prompt" gets absorbed into ChatGPT eventually. Durable AI products own a dataset, an integration surface, a compliance capability, or a distribution channel.',
  },
];

// Three tiers, ordered by ambition. Each project names the pain and who pays —
// the same discipline as /ai-startup-ideas, which covers the startup-scale
// version of this question in more depth.
const TIERS = [
  {
    heading: 'Weekend builds: learn the stack, prove you can ship',
    intro:
      'Goal: learning and a shipped artifact, not revenue. Pick something with one input, one output, and a user you can watch use it — ideally you. These are also the best first projects for testing an AI coding agent against a spec.',
    projects: [
      {
        name: 'Single-document explainer for one contract type',
        detail: 'Upload a residential lease (or NDA, or freelance contract) and get every clause explained in plain English with the unusual ones flagged. Narrow beats general: "lease explainer for NYC renters" is buildable in a weekend and actually findable.',
      },
      {
        name: 'Meeting-transcript to CRM updater',
        detail: 'Paste a sales-call transcript; get the CRM fields, next steps, and follow-up email drafted. Every salesperson does this by hand at 6pm. Building it teaches you structured extraction — the most commercially useful LLM skill.',
      },
      {
        name: 'Personal knowledge-base Q&A',
        detail: 'Retrieval over your own notes, bookmarks, and documents. The weekend version is a real education in embeddings and retrieval quality, and you are the always-available test user.',
      },
      {
        name: 'Job-application tailor for one profession',
        detail: 'Resume plus job posting in, tailored bullet points and a cover letter out — for one specific field, like nursing or data engineering, where you know the vocabulary well enough to judge output quality.',
      },
    ],
  },
  {
    heading: 'Micro-SaaS: small surface, real revenue',
    intro:
      'Goal: a few hundred to a few thousand dollars a month from a product you can run solo. The pattern is one niche, one painful recurring workflow, one clear before/after. Validate demand before building — at this tier the biggest risk is a month spent on a tool nobody wanted.',
    projects: [
      {
        name: 'Inbox triage and drafting for one profession',
        detail: 'Property managers, admissions consultants, wedding planners — pick one inbox-buried profession. Classify incoming mail, draft replies in their voice, escalate what matters. Deep-in-one-niche is the entire moat.',
      },
      {
        name: 'Listing optimizer for one marketplace',
        detail: 'Descriptions, pricing suggestions, and photo feedback for Etsy sellers, Airbnb hosts, or eBay resellers. Sellers measure revenue per listing, so the value connects straight to money.',
      },
      {
        name: 'Review-response manager for local businesses',
        detail: 'Multi-location businesses must answer every Google review; owners hate doing it. On-brand drafted responses, tone rules per location, one approve button. Sticky because it saves face, not just time.',
      },
      {
        name: 'Compliance pre-checker for regulated content',
        detail: 'Financial advisors, healthcare marketers, and supplement brands all publish under rules that make every post a legal question. A checker that flags problem phrasing before compliance review shortens a painful loop they already pay lawyers for.',
      },
    ],
  },
  {
    heading: 'Startup-scale: own a workflow end to end',
    intro:
      'Goal: a company. At this tier you’re not adding AI to a task — you’re rebuilding how a category of work gets done, with AI economics baked in. Expect integrations, sales, and a moat that compounds. We go deeper on this tier in the AI startup ideas guide.',
    projects: [
      {
        name: 'Vertical AI back office for one industry',
        detail: 'Scheduling, quoting, invoicing, and customer comms for one trade — say, independent HVAC. The AI advantage is doing four jobs with one product at a price the incumbent per-seat vendors can’t match.',
      },
      {
        name: 'AI-native replacement for a legacy document workflow',
        detail: 'RFP responses, insurance submissions, grant applications: categories where the incumbent tooling assumes humans write everything and AI flips the cost structure. The wedge is fluency in the formats the receiving side demands.',
      },
      {
        name: 'Proprietary-data play behind a free tool',
        detail: 'Ship a genuinely useful free tool that generates a dataset nobody else has (pricing quotes, claim outcomes, hiring signals), then sell the aggregated intelligence back to the industry. Slow to start, brutally hard to copy.',
      },
      {
        name: 'Quality and evaluation layer for AI outputs',
        detail: 'Thousands of companies now ship LLM features with no way to measure whether a prompt change made them better or worse. Domain-specific evals, regression alerts, and audit trails — selling confidence, which enterprises always buy.',
      },
    ],
  },
];

const AVOID = [
  {
    title: 'A general-purpose chatbot',
    text: 'You are competing with ChatGPT, Claude, and Gemini on their home turf, with their models. There is no version of this fight you win.',
  },
  {
    title: 'A thin wrapper where the model is the product',
    text: 'If your entire product is a prompt and a nicer interface, the next model release ships your roadmap for free. Wrappers survive only when they add data, integrations, or compliance the vendor won’t build.',
  },
  {
    title: 'An "AI assistant for everything"',
    text: 'Horizontal assistants have no reachable buyer and no wedge. Every durable AI product on this page is narrow. Narrow is not a compromise; it is the strategy.',
  },
  {
    title: 'Anything where you can’t name the buyer',
    text: 'If the answer to "who pays?" is "everyone" or "we’ll figure it out," it’s a demo. Demos are fine for the weekend tier — just don’t quit your job for one.',
  },
];

const FAQ = [
  {
    q: 'What should I build with AI as a beginner?',
    a: 'Start with a weekend-tier project that has one input and one output — a document explainer, a transcript-to-summary tool, a Q&A over your own notes. You’ll learn structured extraction and retrieval, the two skills nearly every commercial AI product is built on. Ship it, watch someone use it, then decide whether to aim at revenue.',
  },
  {
    q: 'What AI apps are actually profitable for small builders?',
    a: 'The profitable pattern is narrow and boring: one niche, one recurring workflow, priced against the time or risk it removes. Inbox triage for one profession, review responses for local businesses, compliance pre-checks for regulated content. Broad consumer AI apps are the hardest place to make money, not the easiest.',
  },
  {
    q: 'Do I need to train my own model to build something with AI?',
    a: 'No. Practically everything on this page is built on API models. Fine-tuning and custom training only matter in narrow cases (unusual formats, strict latency or cost constraints, on-premise requirements). Domain knowledge and distribution are the scarce ingredients — model training is rentable.',
  },
  {
    q: 'How do I know if my AI project idea is worth building before I start?',
    a: 'Check whether the pain is real, recurring, and already costing money: are people complaining about it in communities, paying for a manual version, or hiring for it? That check takes an afternoon by hand. The IdeaReels scorer compresses it to about a minute — paste the idea, get a verdict built from live Reddit, Google Trends, and competitor signals, free for your first score.',
  },
  {
    q: 'What tools do I need to build an AI app in 2026?',
    a: 'A model API (OpenAI, Anthropic, or Google), a standard web stack — Next.js plus a hosted Postgres like Supabase is the common default — Stripe for payments, and optionally an AI coding agent to accelerate the build. The IdeaReels MVP blueprint generates this exact stack recommendation per idea, scoped to what the first version actually needs.',
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

// ItemList of the 12 projects. BreadcrumbList intentionally absent —
// <Breadcrumbs/> in PopitoShell already emits it for this route.
const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'What to build with AI: 12 projects from weekend build to startup',
  description: 'Twelve concrete AI projects organized by ambition tier: weekend builds, micro-SaaS, and startup-scale products.',
  itemListOrder: 'https://schema.org/ItemListUnordered',
  numberOfItems: TIERS.reduce((n, t) => n + t.projects.length, 0),
  itemListElement: TIERS.flatMap((t) => t.projects).map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: p.name,
    description: p.detail,
  })),
};

const linkStyle = { color: '#111', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 };

export default function WhatToBuildWithAiPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">What to build with AI (when you want users, not just a demo)</h1>
            <p className="fn__desc">
              &ldquo;What should I build with AI?&rdquo; has three honest answers depending on whether you want to
              learn, earn on the side, or start a company. Here are the four filters that separate paid products from
              ignored demos, and twelve concrete projects across all three tiers.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '32px 0 56px' }}>
          <div className="container" style={{ maxWidth: 860 }}>

            {/* The filters */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '8px 0 12px', letterSpacing: '-0.01em' }}>
              Four filters before you pick anything
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 20px' }}>
              The graveyard of AI side projects is full of impressive things nobody asked for. Whatever you build,
              run it through these four filters first — they are the difference between &ldquo;cool demo&rdquo; and
              &ldquo;here&rsquo;s my card.&rdquo;
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              {FILTERS.map((f) => (
                <div key={f.title} className="fn__bold_item" style={{ padding: '22px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 8px' }}>{f.title}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>{f.text}</p>
                </div>
              ))}
            </div>

            {/* Tiers */}
            {TIERS.map((tier) => (
              <div key={tier.heading}>
                <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '48px 0 12px', letterSpacing: '-0.01em' }}>
                  {tier.heading}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 20px' }}>{tier.intro}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {tier.projects.map((p) => (
                    <div key={p.name} className="fn__bold_item" style={{ padding: '22px 24px' }}>
                      <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 17, margin: '0 0 8px' }}>{p.name}</h3>
                      <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.85, margin: 0 }}>{p.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* What not to build */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 12px', letterSpacing: '-0.01em' }}>
              What not to build with AI
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 20px' }}>
              Four patterns account for most abandoned AI projects. If your current idea matches one, reshape it
              before you invest a weekend, not after.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              {AVOID.map((a) => (
                <div key={a.title} className="fn__bold_item" style={{ padding: '22px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 8px' }}>{a.title}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>{a.text}</p>
                </div>
              ))}
            </div>

            {/* From picking to shipping */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 12px', letterSpacing: '-0.01em' }}>
              From &ldquo;that one&rdquo; to shipped
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 14px' }}>
              Once something on this page (or off it) grabs you, the order of operations matters. Validate demand
              first — the manual checklist is in our guide to{' '}
              <Link href="/blog/how-to-validate-a-startup-idea" style={linkStyle}>validating a startup idea</Link>,
              and the{' '}
              <Link href="/tools/rate-my-startup-idea" style={linkStyle}>free AI scorer</Link>{' '}
              runs the same demand, competition, and willingness-to-pay checks in about a minute. Then scope the
              smallest version that produces feedback — the{' '}
              <Link href="/example" style={linkStyle}>sample MVP blueprint</Link>{' '}
              shows what that looks like: what to build first, what to cut from V1, and the stack that gets you live fastest.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: 0 }}>
              Hunting for the startup-scale version of this question? The{' '}
              <Link href="/ai-startup-ideas" style={linkStyle}>AI startup ideas guide</Link>{' '}
              maps fifteen of them with the pain, buyer, and wedge for each — and the{' '}
              <Link href="/ideas" style={linkStyle}>ideas library</Link>{' '}
              has pre-researched concepts with the demand evidence already attached.
            </p>

            {/* FAQ */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 20px', letterSpacing: '-0.01em' }}>
              What to build with AI: frequently asked questions
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
                Stop debating. Get a verdict.
              </h2>
              <p style={{ margin: '0 0 20px', opacity: 0.75, fontSize: 15 }}>
                Describe what you&rsquo;re thinking of building and get a free market score — demand signals,
                competition, and willingness to pay — before you commit the weekend.
              </p>
              <Link href="/auth/register?next=%2Fwheel" className="fn__btn"><span>Score my idea free</span></Link>
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
