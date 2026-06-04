export const CREDIT_PACKAGES = [
  {
    key: 'starter',
    label: 'Starter',
    credits: 10,
    price: '$9',
    per: '$0.90',
    highlight: false,
    priceEnvVar: 'STRIPE_PRICE_ID_STARTER',
  },
  {
    key: 'builder',
    label: 'Builder',
    credits: 50,
    price: '$29',
    per: '$0.58',
    highlight: true,
    priceEnvVar: 'STRIPE_PRICE_ID_BUILDER',
  },
  {
    key: 'studio',
    label: 'Studio',
    credits: 150,
    price: '$59',
    per: '$0.39',
    highlight: false,
    priceEnvVar: 'STRIPE_PRICE_ID_STUDIO',
  },
  {
    key: 'agency',
    label: 'Agency',
    credits: 500,
    price: '$149',
    per: '$0.30',
    highlight: false,
    priceEnvVar: 'STRIPE_PRICE_ID_AGENCY',
  },
];

export const CREDIT_PACKAGE_BY_KEY = Object.fromEntries(
  CREDIT_PACKAGES.map((pkg) => [pkg.key, pkg])
);
