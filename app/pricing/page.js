import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels credits',
  description: 'Start with 3 free credits, then top up only when you want deeper research or a full build blueprint.',
};

export default function PricingPage({ searchParams }) {
  return <PricingPageClient searchParams={searchParams} />;
}
