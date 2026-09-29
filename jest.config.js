module.exports = {
  testEnvironment: 'node',
  // unit: pruebas del desarrollador. acceptance: pruebas creadas desde los criterios de aceptación.
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/acceptance'],
  collectCoverageFrom: ['app/src/**/*.js', '!app/src/server.js'],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 80, branches: 80 },
  },
};
