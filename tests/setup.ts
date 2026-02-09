// Test setup for Kirito SDK
import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock IPFS for tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.STARKNET_RPC_URL = 'http://localhost:5050';
process.env.IPFS_URL = 'http://localhost:5001';