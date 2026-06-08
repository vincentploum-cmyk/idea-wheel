// Single source of truth for credit packages.
// All UI surfaces (pricing page, in-app modal, profile) read from CREDIT_PACKS.
// `CREDIT_PACKAGES` is the legacy alias kept for IdeaWheel.jsx.

import { CREDIT_PACKS } from './credits';

export const CREDIT_PACKAGES = CREDIT_PACKS.map((pack) => ({
  key: pack.id,
  label: pack.label,
  credits: pack.credits,
  price: pack.price_display,
  per: `$${(pack.price_cents / pack.credits / 100).toFixed(2)}`,
  tagline: pack.tagline,
  highlight: pack.id === 'pro',
}));

export const CREDIT_PACKAGE_BY_KEY = Object.fromEntries(
  CREDIT_PACKAGES.map((pkg) => [pkg.key, pkg])
);

export { CREDIT_PACKS };
