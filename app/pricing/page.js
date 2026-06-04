import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing',
  description: 'Buy credits for Idea Generator blueprints.',
};

export default function PricingPage({ searchParams }) {
  return <PricingPageClient searchParams={searchParams} />;
}
