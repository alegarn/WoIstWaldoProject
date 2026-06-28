module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.after-env.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
