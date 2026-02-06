module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/mocks/gas.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
};
