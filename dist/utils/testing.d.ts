/**
 * Testing Infrastructure Utilities
 * Provides mock services and test helpers for SDK testing
 */
import { NetworkConfig, KiritoSDKConfig } from '../types';
/**
 * Mock network configurations for testing
 */
export declare const MOCK_SEPOLIA: NetworkConfig;
export declare const MOCK_MAINNET: NetworkConfig;
/**
 * Default test configuration
 */
export declare const TEST_CONFIG: KiritoSDKConfig;
/**
 * Mock fetch responses for testing
 */
export declare const mockFetchResponses: {
    starknetChainId: {
        jsonrpc: string;
        result: string;
        id: number;
    };
    ipfsVersion: {
        Version: string;
        Commit: string;
        Repo: string;
    };
    tongoHealth: {
        status: string;
        version: string;
    };
    semaphoreHealth: {
        status: string;
        version: string;
    };
};
/**
 * Setup mock fetch for tests
 */
export declare function setupMockFetch(): jest.MockedFunction<typeof fetch>;
/**
 * Generate random test data
 */
export declare const testDataGenerators: {
    address: () => string;
    tokenId: () => string;
    hash: () => string;
    ipfsHash: () => string;
    networkConfig: (overrides?: Partial<NetworkConfig>) => NetworkConfig;
};
/**
 * Test assertion helpers
 */
export declare const testAssertions: {
    isValidAddress: (address: string) => boolean;
    isValidChainId: (chainId: string) => boolean;
    isValidUrl: (url: string) => boolean;
    isValidIPFSHash: (hash: string) => boolean;
};
/**
 * Cleanup test environment
 */
export declare function cleanupTestEnvironment(): void;
//# sourceMappingURL=testing.d.ts.map