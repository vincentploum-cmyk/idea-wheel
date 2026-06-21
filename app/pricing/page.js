import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels: AI Market Research Starting at $3.99',
  description: 'Get AI-powered market research and a technical MVP blueprint before you commit to building. Credits start at $3.99, never expire, and cover 1 deep research + 1 full blueprint.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'IdeaReels Pricing Plans',
  description: 'AI-powered startup idea validation, market research, and technical MVP blueprint packages',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      item: {
        '@type': 'Product',
        name: 'Starter Pack — 5 Credits',
        description: '5 credits to evaluate your own startup concepts with AI market research and a full technical MVP blueprint. 1 credit for deep research, 2 credits for the full blueprint.',
        url: 'https://ideareels.io/pricing',
        brand: { '@type': 'Brand', name: 'IdeaReels' },
        offers: {
          '@type': 'Offer',
          price: '3.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: 'https://ideareels.io/pricing',
          priceValidUntil: '2027-12-31',
        },
      },
    },
    {
      '@type': 'ListItem',
      position: 2,
      item: {
        '@type': 'Product',
        name: 'Pro Pack — 1 Idea Unlock',
        description: 'Unlock 1 pre-validated startup idea from the IdeaReels library, including deep market research and a full technical MVP blueprint.',
        url: 'https://ideareels.io/pricing',
        brand: { '@type': 'Brand', name: 'IdeaReels' },
        offers: {
          '@type': 'Offer',
          price: '9.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: 'https://ideareels.io/pricing',
          priceValidUntil: '2027-12-31',
        },
      },
    },
    {
      '@type': 'ListItem',
      position: 3,
      item: {
        '@type': 'Product',
        name: 'Power Pack — 2 Idea Unlocks',
        description: 'Unlock 2 pre-validated startup ideas from the IdeaReels library. Compare two strong directions with full market research and MVP blueprints before committing to build.',
        url: 'https://ideareels.io/pricing',
        brand: { '@type': 'Brand', name: 'IdeaReels' },
        offers: {
          '@type': 'Offer',
          price: '19.99',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: 'https://ideareels.io/pricing',
          priceValidUntil: '2027-12-31',
        },
      },
    },
  ],
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h1 className="fn__title">Pricing that matches how builders buy</h1>
            <p className="fn__desc">You are about to commit months of your life to an idea. The market research check that tells you whether to build costs $3.99.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      {/* Cost of inaction bar */}
      <div style={{ background: '#FFE000', borderTop: '3px solid #111', borderBottom: '3px solid #111', padding: '16px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap', textAlign: 'center' }}>
            {[
              { label: 'Spinning is free', sub: 'No credit card required' },
              { label: 'Credits never expire', sub: 'Buy when you need them' },
              { label: 'Secure checkout', sub: 'Via Stripe' },
            ].map(({ label, sub }) => (
              <div key={label}>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 15, color: '#111' }}>{label}</div>
                <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#111', opacity: 0.6 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PricingPageClient searchParams={searchParams} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ideareels.io' },
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://ideareels.io/pricing' },
        ],
      }) }} />
    </PopitoShell>
  );
}
