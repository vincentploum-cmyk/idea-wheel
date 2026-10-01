import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    rules: {
      // Logos and headshots are served by our own admin-only /api/nhl/data/media route; next/image's optimizer isn't used on Render.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
