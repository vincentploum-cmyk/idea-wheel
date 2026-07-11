import Link from 'next/link';
import PopitoShell from '@/components/popito/PopitoShell';
import { CheckIcon } from '@/components/popito/icons';

export const metadata = {
  title: 'Rate My Startup Idea — Free AI Score in 60 Seconds',
  description:
    'Paste your startup idea and get a free AI market score built from live Reddit demand signals, Google Trends, and competitor data. No credit card — your first score is free.',
  alternates: { canonical: 'https://ideareels.io/tools/rate-my-startup-idea' },
  openGraph: {
    title: 'Rate My Startup Idea — Free AI Score in 60 Seconds',
    description:
      'Get a free AI market score for your startup idea from live Reddit signals, Google Trends, and competitor data. No credit card required.',
    url: 'https://ideareels.io/tools/rate-my-startup-idea',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels free startup idea scorer' }],
  },
};

const SCORE_SIGNALS = [
  {
    title: 'Community demand',
    text: 'We scan live Reddit threads in your niche for pain language, workaround posts, and buying intent — the signals that show people actually want the problem solved.',
  },
  {
    title: 'Trend trajectory',
    text: 'Google Trends tells us whether interest in the problem is growing, flat, or dying. Timing kills more startups than competition does.',
  },
  {
    title: 'Competitive pressure',
    text: 'We map who already serves this market and where the visible gaps are. No competitors usually means no market; three dominant players usually means no room.',
  },
  {
    title: 'Willingness to pay',
    text: 'Review sites, community threads, and pricing chatter reveal whether this audience spends money on software — before you bet months on it.',
  },
];

const FAQ = [
  {
    q: 'Is the startup idea score really free?',
    a: 'Yes. Your first market score is free — you sign up with an email (or Google/GitHub), paste your idea, and get the verdict. No credit card. Paid credits only come in if you want the deeper research report or the full MVP blueprint afterward.',
  },
  {
    q: 'What does the score actually measure?',
    a: 'Four things: live community demand (from Reddit), trend direction (from Google Trends), competitive pressure, and willingness-to-pay evidence. The output is a verdict — strong signal, weak signal, or crowded market — with the reasoning shown.',
  },
  {
    q: 'How is this different from asking ChatGPT to rate my idea?',
    a: 'ChatGPT reasons from static training data and tends to be encouraging by default. IdeaReels pulls live demand signals from Reddit and Google Trends at the moment you ask, and it will tell you plainly when the signal is weak.',
  },
  {
    q: 'What if my idea scores well?',
    a: 'Then you can go deeper: 1 credit ($0.80–$0.99 depending on pack) runs full market research with TAM/SAM/SOM sizing, and 2 credits generate a technical MVP blueprint you can hand to a developer or an AI coding agent. See a full sample report on the example page.',
  },
  {
    q: 'Do I need an idea already?',
    a: 'No. The idea wheel can generate startup ideas from live market signals, and the ideas library has pre-researched concepts with demand evidence attached.',
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

const appJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'IdeaReels Startup Idea Scorer',
  url: 'https://ideareels.io/tools/rate-my-startup-idea',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'First startup idea market score is free' },
  publisher: { '@type': 'Organization', name: 'IdeaReels', url: 'https://ideareels.io' },
};

export default function RateMyStartupIdeaPage() {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Rate my startup idea — free AI score in 60 seconds.</h1>
            <p className="fn__desc">
              Paste your idea and get an honest market verdict built from live Reddit demand signals, Google Trends,
              and competitor data. Your first score is free — no credit card, no subscription.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <div className="popito_fn_membership_page">
        <section style={{ padding: '32px 0 56px' }}>
          <div className="container" style={{ maxWidth: 860 }}>

            {/* Scorer CTA card */}
            <div className="fn__bold_item" style={{ padding: '36px 32px', background: '#FFE000', textAlign: 'center' }}>
              <p style={{
                fontFamily: 'Nunito, sans-serif', fontWeight: 900,
                fontSize: 'clamp(18px,2.6vw,24px)', margin: '0 0 8px', color: '#111',
              }}>
                &ldquo;An agent / website / app that&hellip;&rdquo;
              </p>
              <p style={{ margin: '0 0 22px', fontSize: 15, opacity: 0.8, color: '#111' }}>
                Finish that sentence, and the scorer does the rest: demand check, trend check, competitor scan, verdict.
              </p>
              <Link href="/auth/register?next=%2Fwheel" className="fn__btn"><span>Score my idea free</span></Link>
              <p style={{ margin: '14px 0 0', fontSize: 13, opacity: 0.65, color: '#111' }}>
                Free first score · email or Google/GitHub sign-in · no credit card
              </p>
            </div>

            {/* What the score checks */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 20px', letterSpacing: '-0.01em' }}>
              What the score actually checks
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
              {SCORE_SIGNALS.map((s) => (
                <div key={s.title} className="fn__bold_item" style={{ padding: '22px 22px' }}>
                  <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 16, margin: '0 0 8px' }}>{s.title}</p>
                  <p style={{ fontSize: 14.5, lineHeight: 1.7, opacity: 0.8, margin: 0 }}>{s.text}</p>
                </div>
              ))}
            </div>

            {/* Why not just ChatGPT */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 14px', letterSpacing: '-0.01em' }}>
              An honest score, not a pep talk
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: '0 0 14px' }}>
              Most idea validators — and most chats with ChatGPT — tell you your idea is promising, because being
              encouraging is easy. A useful validator has to be willing to say &ldquo;the demand signal is weak, here is
              why, move on.&rdquo; That is what the score is for: killing the ideas that would have eaten your next four
              months, so you can put real effort behind the one worth building.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.8, opacity: 0.85, margin: 0 }}>
              Want to see what the research looks like before you try it? Read a{' '}
              <Link href="/example" style={{ color: '#111', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 }}>
                full sample report
              </Link>{' '}
              — real demand signals, market sizing, and the MVP blueprint — or learn the manual process in our guide to{' '}
              <Link href="/blog/how-to-validate-a-startup-idea" style={{ color: '#111', fontWeight: 700, textDecoration: 'underline', textDecorationColor: '#FFE000', textUnderlineOffset: 3 }}>
                validating a startup idea before you write code
              </Link>.
            </p>

            {/* FAQ */}
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 'clamp(20px,3vw,26px)', margin: '52px 0 20px', letterSpacing: '-0.01em' }}>
              Frequently asked questions
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
              <h3 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 10px' }}>
                Find out if your idea is worth building.
              </h3>
              <p style={{ margin: '0 0 20px', opacity: 0.75, fontSize: 15 }}>
                Free first score. Go deeper only when the signal says go — credits from $3.99, no subscription.
              </p>
              <Link href="/auth/register?next=%2Fwheel" className="fn__btn"><span>Score my idea free</span></Link>
            </div>
          </div>
        </section>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }} />
    </PopitoShell>
  );
}
