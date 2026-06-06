import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing',
  description: 'Buy IdeaReels credits and unlock full blueprints.',
};

export default function PricingPage({ searchParams }) {
  return <PricingPageClient searchParams={searchParams} />;
}
