import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';
import TrustBar from '@/components/TrustBar';

export const metadata = {
  title: 'Pricing — IdeaReels: AI Market Research Starting at $3.99',
  description: 'AI market research + MVP blueprint before you build. Credits from $3.99 — no subscription, never expire. Validate your startup idea in under 5 minutes.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
  openGraph: {
    title: 'IdeaReels Pricing — Startup Validation from $3.99',
    description: 'AI market research + MVP blueprint. One-time credits from $3.99, no subscription, never expire.',
    url: 'https://ideareels.io/pricing',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630, alt: 'IdeaReels Pricing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaReels Pricing — Startup Validation from $3.99',
    description: 'AI market research + MVP blueprint. One-time credits from $3.99, no subscription, never expire.',
    images: [{ url: 'https://ideareels.io/og-image.png', width: 1200, height: 630 }],
  },
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
            <p className="fn__desc">AI startup idea validation and full MVP blueprints from $3.99. No subscription — buy credits when you need them, use them at your own pace.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>

      <TrustBar items={[
        { label: 'Spinning is free', sub: 'No credit card required' },
        { label: 'Credits never expire', sub: 'Buy when you need them' },
        { label: 'Secure checkout', sub: 'Via Stripe' },
      ]} />

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
