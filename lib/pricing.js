// Single source of truth for pricing packages used across the public site.

import { CREDIT_PACKS } from './credits';

export const CREDIT_PACKAGES = CREDIT_PACKS.map((pack) => {
  const unitCount = pack.type === 'idea' ? pack.ideaCredits : pack.credits;
  const unitLabel = pack.type === 'idea'
    ? `${unitCount} idea unlock${unitCount === 1 ? '' : 's'}`
    : `${unitCount} credit${unitCount === 1 ? '' : 's'}`;

  return {
    key: pack.id,
    label: pack.label,
    type: pack.type,
    credits: pack.credits,
    ideaCredits: pack.ideaCredits || 0,
    unitCount,
    unitLabel,
    price: pack.price_display,
    per: `$${(pack.price_cents / Math.max(unitCount, 1) / 100).toFixed(2)}`,
    perSuffix: pack.type === 'idea' ? '/unlock' : '/credit',
    tagline: pack.tagline,
    highlight: pack.id === 'starter',
  };
});

export const CREDIT_PACKAGE_BY_KEY = Object.fromEntries(
  CREDIT_PACKAGES.map((pkg) => [pkg.key, pkg])
);

export { CREDIT_PACKS };
