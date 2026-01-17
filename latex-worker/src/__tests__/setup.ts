/**
 * Jest setup file
 * Polyfills and global test configuration
 */

import { randomUUID } from 'crypto';

// Polyfill crypto.randomUUID for tests
if (typeof global.crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {
    randomUUID: randomUUID,
  };
} else if (typeof global.crypto.randomUUID === 'undefined') {
  global.crypto.randomUUID = randomUUID;
}

// Set test timeout
jest.setTimeout(10000);

// Clean up timers after each test
afterEach(() => {
  jest.clearAllTimers();
});
