/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/fixtures/'],
  transformIgnorePatterns: ['/node_modules/'],
  transform: {
    // The components rendered in tests (react-dom/server) go through Next's own SWC transformer
    // (the Babel preset next ships does not accept the Babel 8 core installed here): every .jsx,
    // and the components folder as a whole, where a few .js files carry JSX (media.js). Order
    // matters: the first pattern that matches a file wins.
    '^.+/components/.+\\.jsx?$': ['next/dist/build/swc/jest-transformer', {}],
    '^.+\\.jsx$': ['next/dist/build/swc/jest-transformer', {}],
    '^.+\\.[jt]s$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
};
