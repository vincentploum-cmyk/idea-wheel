/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // test/integration/ = embedded-postgres, its own runner
  // test/e2e/         = Playwright, its own runner
  // Both live in nested packages with different runtimes; jest must skip them.
  testPathIgnorePatterns: ['/node_modules/', '/test/integration/', '/test/e2e/'],
  transformIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.[jt]s$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
};
