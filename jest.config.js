module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@qiaomcfe/(.*)$': '<rootDir>/packages/$1/src',
  },
  testPathIgnorePatterns: [
    '/inpage-providers-hub/.*/universal/',
    '/node_modules/',
    '/__tests__/fixtures/',
  ],
};
