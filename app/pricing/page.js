import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels Credits & Plans',
  description: 'Start free with 3 credits. Unlock market validation reports and full blueprints covering product design, go-to-market, infrastructure, and prototype generation. No subscription required.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Credits & Pricing</h3>
            <p className="fn__desc">Market validation is always free. Credits unlock deep research and full blueprints.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <PricingPageClient searchParams={searchParams} />
    </PopitoShell>
  );
}
