import PopitoShell from '@/components/popito/PopitoShell';
import OfferPricingClient from './offer-pricing-client';

export const metadata = {
  title: 'Limited Time Offer — 50% Off Pro & Power | IdeaReels',
  description: 'Sign up and get 50% off the Pro and Power credit packages for a limited time.',
};

export default function OfferPricingPage({ searchParams }) {
  return (
    <PopitoShell>
      <div className="popito_fn_pagetitle">
        <div className="container">
          <div className="pagetitle">
            <p style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12, opacity: 0.5 }}>
              Limited time offer
            </p>
            <h3 className="fn__title">50% off Pro &amp; Power credits</h3>
            <p className="fn__desc">
              Create a free account, spin your first idea, and get Pro or Power credits at half the regular price. This offer is available for a limited time only.
            </p>
            <span className="wings" />
            <span className="raleway"><span /><span /><span /><span /><span /></span>
          </div>
        </div>
      </div>
      <OfferPricingClient searchParams={searchParams} />
    </PopitoShell>
  );
}
