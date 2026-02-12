/**
 * Property-Based Test for Multi-Protocol Yield Consistency
 * Feature: kirito-sdk, Property 22: Multi-Protocol Yield Consistency
 * Validates: Requirements 3.4, 3.5
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { 
  DeFiYieldAggregator, 
  DeFiProtocol, 
  ProtocolConfig,
  createDeFiYieldAggregator 
} from '../../src/sdk/defi-yield-aggregator';
import { 
  KiritoSDKConfig,
  TimePeriod,
  Address
} from '../../src/types';
import { Account } from 'starknet';

describe('Property 22: Multi-Protocol Yield Consistency', () => {
  let mockConfig: KiritoSDKConfig;
  let mockAccount: Account;

  beforeEach(() => {
    mockConfig = {
      network: {
        name: 'starknet-sepolia',
        rpcUrl: 'https://starknet-sepolia.infura.io/v3/test',
        chainId: '0x534e5f5345504f4c4941',
        contracts: {
          yieldDistributor: '0x123456789abcdef',
          vesuLending: '0x234567890abcdef',
          ekuboDEX: '0x345678901abcdef',
          atomiqExchange: '0x456789012abcdef'
        }
      },
      ipfs: {
        url: 'https://ipfs.infura.io:5001',
        projectId: 'test-project',
        projectSecret: 'test-secret'
      },
      privacy: {
        tongoEndpoint: 'https://api.tongo.dev',
        semaphoreEndpoint: 'https://api.semaphore.dev'
      }
    };

    // Mock Starknet account
    mockAccount = {
      address: '0x123456789abcdef',
      execute: jest.fn().mockResolvedValue({ transaction_hash: '0xmocktxhash' })
    } as any;

    mockConfig.starknetAccount = mockAccount;
  });

  /**
   * Property: For any combination of DeFi protocols with valid configurations,
   * the aggregated yield should be consistent with individual protocol yields
   * and respect the configured weights.
   * 
   * This property tests that:
   * 1. Total aggregated yield equals sum of weighted individual protocol yields
   * 2. Protocol weights are properly normalized if they don't sum to 1.0
   * 3. Inactive protocols are excluded from aggregation
   * 4. Health thresholds are respected when filtering protocols
   * 5. Individual protocol yields are non-negative
   */
  test('should aggregate protocol yields consistently with proper weighting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          protocols: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
              isActive: fc.boolean(),
              healthThreshold: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true })
            }),
            { minLength: 2, maxLength: 3 }
          ),
          walletAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}`),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }), // 2022-2023
            end: fc.integer({ min: 1672531200000, max: 1704067200000 }) // 2023-2024
          }).filter(p => p.end > p.start)
        }),
        async ({ protocols, walletAddress, period }) => {
          // Ensure unique protocols
          const uniqueProtocols = protocols.filter((protocol, index, arr) => 
            arr.findIndex(p => p.protocol === protocol.protocol) === index
          );
          fc.pre(uniqueProtocols.length >= 2);

          // Ensure at least one active protocol
          const activeProtocols = uniqueProtocols.filter(p => p.isActive);
          fc.pre(activeProtocols.length > 0);

          // Create aggregator with test protocols
          const aggregator = createDeFiYieldAggregator(mockConfig, mockAccount);

          // Configure protocols
          uniqueProtocols.forEach(protocolData => {
            const config: ProtocolConfig = {
              protocol: protocolData.protocol,
              weight: protocolData.weight,
              isActive: protocolData.isActive,
              contractAddress: mockConfig.network.contracts[`${protocolData.protocol}Contract`] || '0x123456789abcdef',
              apiEndpoint: `https://api.${protocolData.protocol}.test`,
              healthThreshold: protocolData.healthThreshold
            };
            aggregator.addProtocol(config);
          });

          // Get aggregated yield
          const aggregatedYield = await aggregator.getAggregatedYield(walletAddress as Address, period);

          // Verify aggregation structure
          expect(aggregatedYield).toHaveProperty('totalYield');
          expect(aggregatedYield).toHaveProperty('protocolBreakdown');
          expect(aggregatedYield).toHaveProperty('period');
          expect(aggregatedYield).toHaveProperty('aggregationTimestamp');
          expect(aggregatedYield).toHaveProperty('healthScore');

          expect(aggregatedYield.totalYield).toBeGreaterThanOrEqual(0n);
          expect(Array.isArray(aggregatedYield.protocolBreakdown)).toBe(true);
          expect(aggregatedYield.period).toEqual(period);
          expect(aggregatedYield.healthScore).toBeGreaterThanOrEqual(0);
          expect(aggregatedYield.healthScore).toBeLessThanOrEqual(1);

          // Verify only active protocols are included in breakdown
          const breakdownProtocols = aggregatedYield.protocolBreakdown.map(pb => pb.protocol);
          const expectedActiveProtocols = activeProtocols.map(p => p.protocol);

          breakdownProtocols.forEach(protocol => {
            expect(expectedActiveProtocols).toContain(protocol);
          });

          // Verify each protocol breakdown has required fields
          aggregatedYield.protocolBreakdown.forEach(pb => {
            expect(pb).toHaveProperty('protocol');
            expect(pb).toHaveProperty('protocolName');
            expect(pb).toHaveProperty('rawYield');
            expect(pb).toHaveProperty('weightedYield');
            expect(pb).toHaveProperty('weight');
            expect(pb).toHaveProperty('healthScore');
            expect(pb).toHaveProperty('isHealthy');
            expect(pb).toHaveProperty('token');
            expect(pb).toHaveProperty('apy');

            expect(pb.rawYield).toBeGreaterThanOrEqual(0n);
            expect(pb.weightedYield).toBeGreaterThanOrEqual(0n);
            expect(pb.weight).toBeGreaterThan(0);
            expect(pb.weight).toBeLessThanOrEqual(1.0);
            expect(pb.healthScore).toBeGreaterThanOrEqual(0);
            expect(pb.healthScore).toBeLessThanOrEqual(1);
            expect(typeof pb.isHealthy).toBe('boolean');
            expect(typeof pb.token).toBe('string');
            expect(pb.token.length).toBeGreaterThan(0);
            expect(pb.apy).toBeGreaterThanOrEqual(0);
          });

          // Verify total yield equals sum of weighted yields
          const sumOfWeightedYields = aggregatedYield.protocolBreakdown.reduce(
            (sum, pb) => sum + pb.weightedYield, 
            0n
          );
          expect(aggregatedYield.totalYield).toBe(sumOfWeightedYields);

          // Verify weight normalization (total should be approximately 1.0)
          if (aggregatedYield.protocolBreakdown.length > 0) {
            const totalWeight = aggregatedYield.protocolBreakdown.reduce(
              (sum, pb) => sum + pb.weight, 
              0
            );
            expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.01);
          }

          // Verify weighted yield calculation
          aggregatedYield.protocolBreakdown.forEach(pb => {
            const expectedWeightedYield = BigInt(Math.floor(Number(pb.rawYield) * pb.weight));
            // Allow small rounding differences
            const difference = pb.weightedYield > expectedWeightedYield 
              ? pb.weightedYield - expectedWeightedYield
              : expectedWeightedYield - pb.weightedYield;
            expect(difference).toBeLessThanOrEqual(BigInt(1));
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Protocol health monitoring should correctly identify unhealthy
   * protocols and exclude them from yield aggregation when below threshold.
   */
  test('should respect health thresholds when aggregating yields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          protocols: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.2), max: Math.fround(0.6), noNaN: true }),
              isActive: fc.constant(true), // All active for this test
              healthThreshold: fc.float({ min: Math.fround(0.5), max: Math.fround(0.9), noNaN: true })
            }),
            { minLength: 2, maxLength: 3 }
          ),
          walletAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}`),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ protocols, walletAddress, period }) => {
          // Ensure unique protocols
          const uniqueProtocols = protocols.filter((protocol, index, arr) => 
            arr.findIndex(p => p.protocol === protocol.protocol) === index
          );
          fc.pre(uniqueProtocols.length >= 2);

          const aggregator = createDeFiYieldAggregator(mockConfig, mockAccount);

          // Configure protocols
          uniqueProtocols.forEach(protocolData => {
            const config: ProtocolConfig = {
              protocol: protocolData.protocol,
              weight: protocolData.weight,
              isActive: protocolData.isActive,
              contractAddress: mockConfig.network.contracts[`${protocolData.protocol}Contract`] || '0x123456789abcdef',
              apiEndpoint: `https://api.${protocolData.protocol}.test`,
              healthThreshold: protocolData.healthThreshold
            };
            aggregator.addProtocol(config);
          });

          // Monitor protocol health
          const healthResults = await aggregator.monitorProtocolHealth();

          // Verify health monitoring results
          expect(healthResults.size).toBeGreaterThan(0);
          expect(healthResults.size).toBeLessThanOrEqual(uniqueProtocols.length);

          // Verify each health result has required fields
          for (const [protocol, health] of healthResults) {
            expect(health).toHaveProperty('protocol');
            expect(health).toHaveProperty('isHealthy');
            expect(health).toHaveProperty('healthScore');
            expect(health).toHaveProperty('issues');
            expect(health).toHaveProperty('recommendations');
            expect(health).toHaveProperty('lastChecked');

            expect(health.protocol).toBe(protocol);
            expect(typeof health.isHealthy).toBe('boolean');
            expect(health.healthScore).toBeGreaterThanOrEqual(0);
            expect(health.healthScore).toBeLessThanOrEqual(1);
            expect(Array.isArray(health.issues)).toBe(true);
            expect(Array.isArray(health.recommendations)).toBe(true);
            expect(health.lastChecked).toBeGreaterThan(0);
          }

          // Get aggregated yield and verify health filtering
          const aggregatedYield = await aggregator.getAggregatedYield(walletAddress as Address, period);

          // Verify that protocols in breakdown meet health requirements
          aggregatedYield.protocolBreakdown.forEach(pb => {
            const protocolConfig = uniqueProtocols.find(p => p.protocol === pb.protocol);
            const protocolHealth = healthResults.get(pb.protocol);
            
            if (protocolConfig && protocolHealth) {
              // If protocol is included, it should either be healthy or above threshold
              expect(
                protocolHealth.isHealthy || protocolHealth.healthScore >= protocolConfig.healthThreshold
              ).toBe(true);
            }
          });

          // Verify overall health score is reasonable
          if (aggregatedYield.protocolBreakdown.length > 0) {
            const avgHealthScore = aggregatedYield.protocolBreakdown.reduce(
              (sum, pb) => sum + pb.healthScore, 0
            ) / aggregatedYield.protocolBreakdown.length;
            
            // Overall health score should be close to average of included protocols
            expect(Math.abs(aggregatedYield.healthScore - avgHealthScore)).toBeLessThan(0.1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Yield optimization recommendations should improve overall APY
   * while maintaining reasonable risk levels.
   */
  test('should generate valid yield optimization recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          protocols: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.2), max: Math.fround(0.5), noNaN: true }),
              isActive: fc.constant(true)
            }),
            { minLength: 2, maxLength: 3 }
          ),
          walletAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}`),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ protocols, walletAddress, period }) => {
          // Ensure unique protocols
          const uniqueProtocols = protocols.filter((protocol, index, arr) => 
            arr.findIndex(p => p.protocol === protocol.protocol) === index
          );
          fc.pre(uniqueProtocols.length >= 2);

          const aggregator = createDeFiYieldAggregator(mockConfig, mockAccount);

          // Configure protocols with normalized weights
          const totalWeight = uniqueProtocols.reduce((sum, p) => sum + p.weight, 0);
          const normalizedProtocols = uniqueProtocols.map(p => ({
            ...p,
            weight: p.weight / totalWeight
          }));

          normalizedProtocols.forEach(protocolData => {
            const config: ProtocolConfig = {
              protocol: protocolData.protocol,
              weight: protocolData.weight,
              isActive: protocolData.isActive,
              contractAddress: mockConfig.network.contracts[`${protocolData.protocol}Contract`] || '0x123456789abcdef',
              apiEndpoint: `https://api.${protocolData.protocol}.test`,
              healthThreshold: 0.5
            };
            aggregator.addProtocol(config);
          });

          // Get optimization recommendations
          const optimization = await aggregator.getYieldOptimizationRecommendations(
            walletAddress as Address, 
            period
          );

          // Verify optimization structure
          expect(optimization).toHaveProperty('currentAPY');
          expect(optimization).toHaveProperty('optimizedAPY');
          expect(optimization).toHaveProperty('rebalanceRecommendations');
          expect(optimization).toHaveProperty('estimatedGasForRebalance');
          expect(optimization).toHaveProperty('estimatedTimeToBreakeven');

          expect(optimization.currentAPY).toBeGreaterThanOrEqual(0);
          expect(optimization.optimizedAPY).toBeGreaterThanOrEqual(0);
          expect(Array.isArray(optimization.rebalanceRecommendations)).toBe(true);
          expect(optimization.estimatedGasForRebalance).toBeGreaterThan(0n);
          expect(optimization.estimatedTimeToBreakeven).toBeGreaterThan(0);

          // Verify rebalance recommendations
          expect(optimization.rebalanceRecommendations.length).toBe(normalizedProtocols.length);

          optimization.rebalanceRecommendations.forEach(rec => {
            expect(rec).toHaveProperty('protocol');
            expect(rec).toHaveProperty('currentWeight');
            expect(rec).toHaveProperty('recommendedWeight');
            expect(rec).toHaveProperty('reason');

            expect(Object.values(DeFiProtocol)).toContain(rec.protocol);
            expect(rec.currentWeight).toBeGreaterThanOrEqual(0);
            expect(rec.currentWeight).toBeLessThanOrEqual(1);
            expect(rec.recommendedWeight).toBeGreaterThanOrEqual(0);
            expect(rec.recommendedWeight).toBeLessThanOrEqual(1);
            expect(typeof rec.reason).toBe('string');
            expect(rec.reason.length).toBeGreaterThan(0);
          });

          // Verify recommended weights sum to 1.0
          const totalRecommendedWeight = optimization.rebalanceRecommendations.reduce(
            (sum, rec) => sum + rec.recommendedWeight, 0
          );
          expect(Math.abs(totalRecommendedWeight - 1.0)).toBeLessThan(0.01);

          // Verify optimization improves or maintains APY
          expect(optimization.optimizedAPY).toBeGreaterThanOrEqual(optimization.currentAPY * 0.95); // Allow 5% tolerance

          // Verify breakeven time is reasonable
          expect(optimization.estimatedTimeToBreakeven).toBeLessThan(365 * 2); // Less than 2 years
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Protocol weight updates should be properly validated and applied
   */
  test('should validate and apply protocol weight updates correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialWeights: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.8), noNaN: true })
            }),
            { minLength: 2, maxLength: 3 }
          ),
          newWeights: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.8), noNaN: true })
            }),
            { minLength: 2, maxLength: 3 }
          )
        }),
        async ({ initialWeights, newWeights }) => {
          // Ensure unique protocols for both arrays
          const uniqueInitial = initialWeights.filter((w, index, arr) => 
            arr.findIndex(p => p.protocol === w.protocol) === index
          );
          const uniqueNew = newWeights.filter((w, index, arr) => 
            arr.findIndex(p => p.protocol === w.protocol) === index
          );
          
          fc.pre(uniqueInitial.length >= 2 && uniqueNew.length >= 2);

          // Normalize weights to sum to 1.0
          const normalizeWeights = (weights: typeof uniqueInitial) => {
            const total = weights.reduce((sum, w) => sum + w.weight, 0);
            return weights.map(w => ({ ...w, weight: w.weight / total }));
          };

          const normalizedInitial = normalizeWeights(uniqueInitial);
          const normalizedNew = normalizeWeights(uniqueNew);

          const aggregator = createDeFiYieldAggregator(mockConfig, mockAccount);

          // Set initial protocol configurations
          normalizedInitial.forEach(weightData => {
            const config: ProtocolConfig = {
              protocol: weightData.protocol,
              weight: weightData.weight,
              isActive: true,
              contractAddress: '0x123456789abcdef',
              apiEndpoint: `https://api.${weightData.protocol}.test`,
              healthThreshold: 0.5
            };
            aggregator.addProtocol(config);
          });

          // Verify initial configurations
          const initialConfigs = aggregator.getProtocolConfigurations();
          expect(initialConfigs.size).toBe(normalizedInitial.length);

          normalizedInitial.forEach(weightData => {
            const config = initialConfigs.get(weightData.protocol);
            expect(config).toBeDefined();
            expect(Math.abs(config!.weight - weightData.weight)).toBeLessThan(0.001);
          });

          // Update weights
          const newWeightMap = new Map(normalizedNew.map(w => [w.protocol, w.weight]));
          
          // Only update weights for protocols that exist in both sets
          const commonProtocols = normalizedNew.filter(w => 
            normalizedInitial.some(i => i.protocol === w.protocol)
          );
          
          if (commonProtocols.length >= 2) {
            const commonWeightMap = new Map(commonProtocols.map(w => [w.protocol, w.weight]));
            
            // Should succeed with valid weights
            expect(() => {
              aggregator.updateProtocolWeights(commonWeightMap);
            }).not.toThrow();

            // Verify weights were updated
            const updatedConfigs = aggregator.getProtocolConfigurations();
            commonProtocols.forEach(weightData => {
              const config = updatedConfigs.get(weightData.protocol);
              expect(config).toBeDefined();
              expect(Math.abs(config!.weight - weightData.weight)).toBeLessThan(0.001);
            });
          }

          // Test invalid weight update (weights don't sum to 1.0)
          const invalidWeights = new Map([
            [DeFiProtocol.VESU, 0.3],
            [DeFiProtocol.EKUBO, 0.3] // Sum = 0.6, not 1.0
          ]);

          expect(() => {
            aggregator.updateProtocolWeights(invalidWeights);
          }).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Aggregated yields should be deterministic for identical inputs
   */
  test('should produce consistent results for identical protocol configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          protocols: fc.array(
            fc.record({
              protocol: fc.constantFrom(DeFiProtocol.VESU, DeFiProtocol.EKUBO, DeFiProtocol.ATOMIQ),
              weight: fc.float({ min: Math.fround(0.2), max: Math.fround(0.6), noNaN: true }),
              isActive: fc.constant(true)
            }),
            { minLength: 2, maxLength: 3 }
          ),
          walletAddress: fc.string({ minLength: 42, maxLength: 42 }).map(s => `0x${s.slice(2).padStart(40, '0')}`),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ protocols, walletAddress, period }) => {
          // Ensure unique protocols
          const uniqueProtocols = protocols.filter((protocol, index, arr) => 
            arr.findIndex(p => p.protocol === protocol.protocol) === index
          );
          fc.pre(uniqueProtocols.length >= 2);

          // Normalize weights
          const totalWeight = uniqueProtocols.reduce((sum, p) => sum + p.weight, 0);
          const normalizedProtocols = uniqueProtocols.map(p => ({
            ...p,
            weight: p.weight / totalWeight
          }));

          // Create two identical aggregators
          const aggregator1 = createDeFiYieldAggregator(mockConfig, mockAccount);
          const aggregator2 = createDeFiYieldAggregator(mockConfig, mockAccount);

          // Configure both aggregators identically
          normalizedProtocols.forEach(protocolData => {
            const config: ProtocolConfig = {
              protocol: protocolData.protocol,
              weight: protocolData.weight,
              isActive: protocolData.isActive,
              contractAddress: '0x123456789abcdef',
              apiEndpoint: `https://api.${protocolData.protocol}.test`,
              healthThreshold: 0.5
            };
            aggregator1.addProtocol(config);
            aggregator2.addProtocol({ ...config }); // Deep copy
          });

          // Get aggregated yields from both aggregators
          const result1 = await aggregator1.getAggregatedYield(walletAddress as Address, period);
          const result2 = await aggregator2.getAggregatedYield(walletAddress as Address, period);

          // Results should be identical (excluding timestamp)
          expect(result1.totalYield).toBe(result2.totalYield);
          expect(result1.protocolBreakdown.length).toBe(result2.protocolBreakdown.length);
          expect(result1.period).toEqual(result2.period);
          expect(Math.abs(result1.healthScore - result2.healthScore)).toBeLessThan(0.001);

          // Compare protocol breakdowns
          result1.protocolBreakdown.forEach((pb1, index) => {
            const pb2 = result2.protocolBreakdown.find(pb => pb.protocol === pb1.protocol);
            expect(pb2).toBeDefined();
            
            if (pb2) {
              expect(pb1.protocol).toBe(pb2.protocol);
              expect(pb1.protocolName).toBe(pb2.protocolName);
              expect(pb1.rawYield).toBe(pb2.rawYield);
              expect(pb1.weightedYield).toBe(pb2.weightedYield);
              expect(Math.abs(pb1.weight - pb2.weight)).toBeLessThan(0.001);
              expect(Math.abs(pb1.healthScore - pb2.healthScore)).toBeLessThan(0.001);
              expect(pb1.isHealthy).toBe(pb2.isHealthy);
              expect(pb1.token).toBe(pb2.token);
              expect(Math.abs(pb1.apy - pb2.apy)).toBeLessThan(0.001);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});