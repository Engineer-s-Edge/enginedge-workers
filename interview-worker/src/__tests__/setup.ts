/**
 * Global Test Setup File
 * Runs before all tests to initialize mocks, connections, and test infrastructure
 */

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-v4'),
}));

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Suppress console output during tests (unless DEBUG_TESTS is set)
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

if (!process.env.DEBUG_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
});

// Global test teardown
afterAll(async () => {
  // Cleanup after all tests
  jest.clearAllMocks();
});

// Restore console output after tests
afterAll(() => {
  if (!process.env.DEBUG_TESTS) {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
});

// Utility functions for tests
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockHealthResponse = (overrides?: object) => ({
  status: 'healthy',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  dependencies: {
    mongodb: { status: 'connected' },
  },
  ...overrides,
});
