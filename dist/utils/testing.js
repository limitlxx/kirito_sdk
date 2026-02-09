"use strict";
/**
 * Testing Infrastructure Utilities
 * Provides mock services and test helpers for SDK testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAssertions = exports.testDataGenerators = exports.mockFetchResponses = exports.TEST_CONFIG = exports.MOCK_MAINNET = exports.MOCK_SEPOLIA = void 0;
exports.setupMockFetch = setupMockFetch;
exports.cleanupTestEnvironment = cleanupTestEnvironment;
/**
 * Mock network configurations for testing
 */
exports.MOCK_SEPOLIA = {
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
exports.MOCK_MAINNET = {
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
exports.TEST_CONFIG = {
    network: exports.MOCK_SEPOLIA,
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
exports.mockFetchResponses = {
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
function setupMockFetch() {
    const mockFetch = jest.fn();
    mockFetch.mockImplementation((url) => {
        const urlString = url.toString();
        if (urlString.includes('starknet_chainId')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(exports.mockFetchResponses.starknetChainId)
            });
        }
        if (urlString.includes('/api/v0/version')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(exports.mockFetchResponses.ipfsVersion)
            });
        }
        if (urlString.includes('/health')) {
            const response = urlString.includes('tongo')
                ? exports.mockFetchResponses.tongoHealth
                : exports.mockFetchResponses.semaphoreHealth;
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(response)
            });
        }
        return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });
    });
    global.fetch = mockFetch;
    return mockFetch;
}
/**
 * Generate random test data
 */
exports.testDataGenerators = {
    address: () => `0x${Math.random().toString(16).slice(2, 18).padStart(16, '0')}`,
    tokenId: () => Math.floor(Math.random() * 10000).toString(),
    hash: () => `0x${Math.random().toString(16).slice(2, 66).padStart(64, '0')}`,
    ipfsHash: () => `Qm${Math.random().toString(36).slice(2, 46)}`,
    networkConfig: (overrides) => ({
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
exports.testAssertions = {
    isValidAddress: (address) => {
        return /^0x[a-fA-F0-9]{16,64}$/.test(address);
    },
    isValidChainId: (chainId) => {
        return /^0x[a-fA-F0-9]+$/.test(chainId) && chainId.length > 2;
    },
    isValidUrl: (url) => {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    },
    isValidIPFSHash: (hash) => {
        return /^Qm[a-zA-Z0-9]{44}$/.test(hash) || /^0x[a-fA-F0-9]{64}$/.test(hash);
    }
};
/**
 * Cleanup test environment
 */
function cleanupTestEnvironment() {
    // Reset global mocks
    if (global.fetch && jest.isMockFunction(global.fetch)) {
        global.fetch.mockRestore();
    }
    // Clear any test data
    jest.clearAllMocks();
}
//# sourceMappingURL=testing.js.map