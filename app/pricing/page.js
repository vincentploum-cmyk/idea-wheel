import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels credits and shortcut packs',
  description: 'Pricing for builders who want detailed market research and a technical MVP blueprint, not just another idea.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Pricing that matches how builders buy</h3>
            <p className="fn__desc">Pay only when you want the deeper market research and technical MVP blueprint that tell you whether to build, and how to build it fast.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <PricingPageClient searchParams={searchParams} />
    </PopitoShell>
  );
}
