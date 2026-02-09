/**
 * Testing Infrastructure Utilities
 * Provides mock services and test helpers for SDK testing
 */

import { NetworkConfig, KiritoSDKConfig } from '../types';

/**
 * Mock network configurations for testing
 */
export const MOCK_SEPOLIA: NetworkConfig = {
  name: 'mock-sepolia',
  rpcUrl: 'http://localhost:5050',
  chainId: '0x534e5f5345504f4c4941',
  contracts: {
    nftWallet: '0x1234567890abcdef1234567890abcdef12345678',
    shieldedPool: '0x2234567890abcdef1234567890abcdef12345678',
    mysteryBox: '0x3234567890abcdef1234567890abcdef12345678',
    governance: '0x4234567890abcdef1234567890abcdef12345678'
  }
};

export const MOCK_MAINNET: NetworkConfig = {
  name: 'mock-mainnet',
  rpcUrl: 'http://localhost:5051',
  chainId: '0x534e5f4d41494e',
  contracts: {
    nftWallet: '0x5234567890abcdef1234567890abcdef12345678',
    shieldedPool: '0x6234567890abcdef1234567890abcdef12345678',
    mysteryBox: '0x7234567890abcdef1234567890abcdef12345678',
    governance: '0x8234567890abcdef1234567890abcdef12345678'
  }
};

/**
 * Default test configuration
 */
export const TEST_CONFIG: KiritoSDKConfig = {
  network: MOCK_SEPOLIA,
  ipfs: {
    url: 'http://localhost:5001'
  },
  privacy: {
    tongoEndpoint: 'http://localhost:3001',
    semaphoreEndpoint: 'http://localhost:3002'
  }
};

/**
 * Mock fetch responses for testing
 */
export const mockFetchResponses = {
  starknetChainId: {
    jsonrpc: '2.0',
    result: '0x534e5f5345504f4c4941',
    id: 1
  },
  ipfsVersion: {
    Version: '0.20.0',
    Commit: 'test-commit',
    Repo: '12'
  },
  tongoHealth: {
    status: 'healthy',
    version: '1.0.0'
  },
  semaphoreHealth: {
    status: 'healthy',
    version: '1.0.0'
  }
};

/**
 * Setup mock fetch for tests
 */
export function setupMockFetch(): jest.MockedFunction<typeof fetch> {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  
  mockFetch.mockImplementation((url: string | URL | Request) => {
    const urlString = url.toString();
    
    if (urlString.includes('starknet_chainId')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFetchResponses.starknetChainId)
      } as Response);
    }
    
    if (urlString.includes('/api/v0/version')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFetchResponses.ipfsVersion)
      } as Response);
    }
    
    if (urlString.includes('/health')) {
      const response = urlString.includes('tongo') 
        ? mockFetchResponses.tongoHealth 
        : mockFetchResponses.semaphoreHealth;
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response)
      } as Response);
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as Response);
  });
  
  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Generate random test data
 */
export const testDataGenerators = {
  address: (): string => `0x${Math.random().toString(16).slice(2, 18).padStart(16, '0')}`,
  tokenId: (): string => Math.floor(Math.random() * 10000).toString(),
  hash: (): string => `0x${Math.random().toString(16).slice(2, 66).padStart(64, '0')}`,
  ipfsHash: (): string => `Qm${Math.random().toString(36).slice(2, 46)}`,
  
  networkConfig: (overrides?: Partial<NetworkConfig>): NetworkConfig => ({
    name: `test-network-${Math.random().toString(36).slice(2, 8)}`,
    rpcUrl: `https://test-rpc-${Math.random().toString(36).slice(2, 8)}.com`,
    chainId: `0x${Math.random().toString(16).slice(2, 18)}`,
    contracts: {},
    ...overrides
  })
};

/**
 * Test assertion helpers
 */
export const testAssertions = {
  isValidAddress: (address: string): boolean => {
    return /^0x[a-fA-F0-9]{16,64}$/.test(address);
  },
  
  isValidChainId: (chainId: string): boolean => {
    return /^0x[a-fA-F0-9]+$/.test(chainId) && chainId.length > 2;
  },
  
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  isValidIPFSHash: (hash: string): boolean => {
    return /^Qm[a-zA-Z0-9]{44}$/.test(hash) || /^0x[a-fA-F0-9]{64}$/.test(hash);
  }
};

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment(): void {
  // Reset global mocks
  if (global.fetch && jest.isMockFunction(global.fetch)) {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRestore();
  }
  
  // Clear any test data
  jest.clearAllMocks();
}