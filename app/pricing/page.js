import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels credits and shortcut packs',
  description: 'Pricing for builders who want better ideas, faster validation, and a blueprint when something looks worth building.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Pricing that matches how builders buy</h3>
            <p className="fn__desc">You already have AI tools to build. Pay only when you want help finding, vetting, or blueprinting an idea worth chasing.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <PricingPageClient searchParams={searchParams} />
    </PopitoShell>
  );
}
