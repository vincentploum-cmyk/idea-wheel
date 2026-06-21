import PopitoShell from '@/components/popito/PopitoShell';
import OfferPricingClient from './offer-pricing-client';

export const metadata = {
  title: 'Limited Time Offer — 50% Off Shortcut Packs | IdeaReels',
  description: 'Sign up and get 50% off the Pro and Power shortcut packs for a limited time.',
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
            <h3 className="fn__title">50% off Pro &amp; Power</h3>
            <p className="fn__desc">
              Create an account, evaluate the workflow properly, then use the shortcut packs at half price if you want a researched starting point.
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
