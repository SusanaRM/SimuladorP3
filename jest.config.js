export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  // Ensure Jest looks for index.js files in folders, and resolves standard JS extensions
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  
  // Force Jest to transform the p3js directory outside your root
  transformIgnorePatterns: [
    'node_modules/(?!(p3js)/)'
  ],
  // Tell Jest where to look for modules if it gets confused by relative root paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  injectGlobals: true
};