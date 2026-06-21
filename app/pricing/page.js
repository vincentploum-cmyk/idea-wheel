import PopitoShell from '@/components/popito/PopitoShell';
import PricingPageClient from './pricing-page-client';

export const metadata = {
  title: 'Pricing — IdeaReels credits and shortcut packs',
  description: 'Start with 3 free credits, then top up only when you want deeper research, a full blueprint, or a shortcut into a ready-made idea.',
  alternates: { canonical: 'https://ideareels.io/pricing' },
};

export default function PricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <h3 className="fn__title">Pricing that matches how builders buy</h3>
            <p className="fn__desc">Start free. Pay only when a project feels real, or skip ahead with a ready-made idea unlock.</p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <PricingPageClient searchParams={searchParams} />
    </PopitoShell>
  );
}
