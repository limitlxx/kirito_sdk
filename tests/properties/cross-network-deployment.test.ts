/**
 * Property-Based Test for Cross-Network Deployment
 * Feature: kirito-sdk, Property 15: Cross-Network Deployment
 * Validates: Requirements 6.2
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { KiritoSDK } from '../../src';
import { NetworkConfig, KiritoSDKConfig } from '../../src/types';
import { STARKNET_SEPOLIA, STARKNET_MAINNET } from '../../src/sdk/config';

describe('Property 15: Cross-Network Deployment', () => {
  let sdk: KiritoSDK;

  beforeEach(() => {
    // Reset SDK instance for each test
    sdk = new KiritoSDK();
  });

  /**
   * Property: For any smart contract deployment, the system should successfully 
   * deploy on both Starknet Sepolia testnet and mainnet with identical functionality.
   * 
   * This property tests that:
   * 1. SDK can be initialized with different network configurations
   * 2. Network switching works correctly
   * 3. All core functionality is available on both networks
   * 4. Network-specific configurations are properly applied
   */
  test('should deploy successfully on both Sepolia and Mainnet networks', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test configurations for both networks
        fc.record({
          sepoliaConfig: fc.constant(STARKNET_SEPOLIA),
          mainnetConfig: fc.constant(STARKNET_MAINNET),
          ipfsUrl: fc.webUrl({ validSchemes: ['https'] }),
          tongoEndpoint: fc.webUrl({ validSchemes: ['https'] }),
          semaphoreEndpoint: fc.webUrl({ validSchemes: ['https'] })
        }),
        async ({ sepoliaConfig, mainnetConfig, ipfsUrl, tongoEndpoint, semaphoreEndpoint }) => {
          // Test Sepolia deployment
          const sepoliaSDK = new KiritoSDK({
            network: sepoliaConfig,
            ipfs: { url: ipfsUrl },
            privacy: {
              tongoEndpoint,
              semaphoreEndpoint
            }
          });

          await sepoliaSDK.initialize();
          const sepoliaNetworkConfig = sepoliaSDK.getNetworkConfig();

          // Verify Sepolia configuration
          expect(sepoliaNetworkConfig.name).toBe('starknet-sepolia');
          expect(sepoliaNetworkConfig.chainId).toBe('0x534e5f5345504f4c4941');
          expect(sepoliaNetworkConfig.rpcUrl).toContain('sepolia');

          // Test Mainnet deployment
          const mainnetSDK = new KiritoSDK({
            network: mainnetConfig,
            ipfs: { url: ipfsUrl },
            privacy: {
              tongoEndpoint,
              semaphoreEndpoint
            }
          });

          await mainnetSDK.initialize();
          const mainnetNetworkConfig = mainnetSDK.getNetworkConfig();

          // Verify Mainnet configuration
          expect(mainnetNetworkConfig.name).toBe('starknet-mainnet');
          expect(mainnetNetworkConfig.chainId).toBe('0x534e5f4d41494e');
          expect(mainnetNetworkConfig.rpcUrl).toContain('mainnet');

          // Test network switching
          await sepoliaSDK.switchNetwork(mainnetConfig);
          const switchedConfig = sepoliaSDK.getNetworkConfig();
          expect(switchedConfig.chainId).toBe(mainnetConfig.chainId);

          // Verify both SDKs have identical interface structure
          const sepoliaHealthCheck = await sepoliaSDK.healthCheck();
          const mainnetHealthCheck = await mainnetSDK.healthCheck();

          // Both should have the same health check structure
          expect(Object.keys(sepoliaHealthCheck)).toEqual(Object.keys(mainnetHealthCheck));
          expect(sepoliaHealthCheck).toHaveProperty('network');
          expect(sepoliaHealthCheck).toHaveProperty('ipfs');
          expect(sepoliaHealthCheck).toHaveProperty('tongo');
          expect(sepoliaHealthCheck).toHaveProperty('semaphore');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should maintain consistent contract interface across networks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          networkName: fc.constantFrom('sepolia', 'mainnet'),
          contractAddress: fc.hexaString({ minLength: 64, maxLength: 64 }),
          rpcUrl: fc.webUrl({ validSchemes: ['https'] })
        }),
        async ({ networkName, contractAddress, rpcUrl }) => {
          const networkConfig: NetworkConfig = {
            name: `starknet-${networkName}`,
            rpcUrl,
            chainId: networkName === 'sepolia' ? '0x534e5f5345504f4c4941' : '0x534e5f4d41494e',
            contracts: {
              nftWallet: `0x${contractAddress}`,
              shieldedPool: `0x${contractAddress}`,
              mysteryBox: `0x${contractAddress}`,
              governance: `0x${contractAddress}`
            }
          };

          const testSDK = new KiritoSDK({
            network: networkConfig,
            ipfs: { url: 'https://ipfs.infura.io:5001' },
            privacy: {
              tongoEndpoint: 'https://api.tongo.dev',
              semaphoreEndpoint: 'https://api.semaphore.dev'
            }
          });

          await testSDK.initialize();
          const config = testSDK.getNetworkConfig();

          // Verify contract addresses are properly set
          expect(config.contracts).toBeDefined();
          expect(Object.keys(config.contracts)).toContain('nftWallet');
          expect(Object.keys(config.contracts)).toContain('shieldedPool');
          expect(Object.keys(config.contracts)).toContain('mysteryBox');
          expect(Object.keys(config.contracts)).toContain('governance');

          // Verify network-specific properties
          if (networkName === 'sepolia') {
            expect(config.chainId).toBe('0x534e5f5345504f4c4941');
          } else {
            expect(config.chainId).toBe('0x534e5f4d41494e');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle network configuration validation consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validNetwork: fc.constantFrom(STARKNET_SEPOLIA, STARKNET_MAINNET),
          invalidRpcUrl: fc.oneof(
            fc.constant(''),
            fc.constant('invalid-url'),
            fc.constant('ftp://invalid-protocol.com')
          ),
          invalidChainId: fc.oneof(
            fc.constant(''),
            fc.constant('invalid-chain-id'),
            fc.constant('123'), // Missing 0x prefix
            fc.constant('0x') // Only prefix, no value
          )
        }),
        async ({ validNetwork, invalidRpcUrl, invalidChainId }) => {
          // Valid network should work
          const validSDK = new KiritoSDK({ network: validNetwork });
          await expect(validSDK.initialize()).resolves.not.toThrow();

          // Invalid RPC URL should fail
          if (invalidRpcUrl !== 'http://localhost') { // localhost is allowed
            const invalidRpcConfig = { ...validNetwork, rpcUrl: invalidRpcUrl };
            expect(() => new KiritoSDK({ network: invalidRpcConfig })).toThrow();
          }

          // Invalid chain ID should fail
          const invalidChainConfig = { ...validNetwork, chainId: invalidChainId };
          expect(() => new KiritoSDK({ network: invalidChainConfig })).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should preserve functionality after network switching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom(STARKNET_SEPOLIA, STARKNET_MAINNET), { minLength: 2, maxLength: 5 }),
        async (networks) => {
          const testSDK = new KiritoSDK({ network: networks[0] });
          await testSDK.initialize();

          let previousNetwork = testSDK.getNetworkConfig();

          // Switch through all networks
          for (let i = 1; i < networks.length; i++) {
            await testSDK.switchNetwork(networks[i]);
            const currentNetwork = testSDK.getNetworkConfig();

            // Verify network actually changed
            expect(currentNetwork.chainId).toBe(networks[i].chainId);
            expect(currentNetwork.name).toBe(networks[i].name);

            // Verify health check still works after switching
            const healthCheck = await testSDK.healthCheck();
            expect(healthCheck).toHaveProperty('network');
            expect(healthCheck).toHaveProperty('ipfs');
            expect(healthCheck).toHaveProperty('tongo');
            expect(healthCheck).toHaveProperty('semaphore');

            previousNetwork = currentNetwork;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});