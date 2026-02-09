/**
 * Property-Based Test for Multi-Source Yield Integration
 * Feature: kirito-sdk, Property 9: Multi-Source Yield Integration
 * Validates: Requirements 3.4, 3.5
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { YieldCalculationEngine, YieldDistributorSDK } from '../../src/sdk/shielded-pool';
import { 
  KiritoSDKConfig,
  TimePeriod,
  YieldSource,
  AggregatedYield
} from '../../src/types';

describe('Property 9: Multi-Source Yield Integration', () => {
  let yieldEngine: YieldCalculationEngine;
  let yieldDistributor: YieldDistributorSDK;
  let mockConfig: KiritoSDKConfig;

  beforeEach(() => {
    mockConfig = {
      network: {
        name: 'starknet-sepolia',
        rpcUrl: 'https://starknet-sepolia.infura.io/v3/test',
        chainId: '0x534e5f5345504f4c4941',
        contracts: {
          yieldDistributor: '0x123456789abcdef'
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
    
    yieldEngine = new YieldCalculationEngine(mockConfig);
    yieldDistributor = new YieldDistributorSDK(mockConfig);
  });

  /**
   * Property: For any combination of DeFi and RWA yield sources, the system should 
   * correctly aggregate yields and distribute them proportionally to eligible NFT holders.
   * 
   * This property tests that:
   * 1. Multiple yield sources are correctly aggregated with proper weighting
   * 2. Source weights are normalized if they don't sum to 1.0
   * 3. Failed sources don't prevent aggregation from working sources
   * 4. Total aggregated yield equals the sum of weighted individual yields
   * 5. Source breakdown provides accurate individual source contributions
   */
  test('should correctly aggregate yields from multiple sources with proper weighting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 20 }).map(s => `source_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 30 }),
              endpoint: fc.string({ minLength: 10, maxLength: 50 }).map(s => `https://api.${s.replace(/[^a-zA-Z0-9]/g, '')}.com`),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0), noNaN: true }),
              isActive: fc.boolean(),
              sourceType: fc.constantFrom('defi', 'rwa', 'generic')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }), // 2022-2023
            end: fc.integer({ min: 1672531200000, max: 1704067200000 }) // 2023-2024
          }).filter(p => p.end > p.start)
        }),
        async ({ sources, period }) => {
          // Ensure unique source IDs
          const uniqueIds = new Set(sources.map(s => s.id));
          fc.pre(uniqueIds.size === sources.length);

          // Ensure at least one active source
          const activeSources = sources.filter(s => s.isActive);
          fc.pre(activeSources.length > 0);

          // Create fresh yield engine for this test
          const freshEngine = new YieldCalculationEngine(mockConfig);

          // Add all sources to the engine
          sources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.sourceType === 'defi' ? `${source.id}_defi` : 
                  source.sourceType === 'rwa' ? `${source.id}_rwa` : source.id,
              name: source.name,
              endpoint: source.endpoint,
              weight: source.weight,
              isActive: source.isActive
            };
            freshEngine.addYieldSource(yieldSource);
          });

          // Aggregate yields
          const aggregatedYield = await freshEngine.aggregateMultiSourceYields(period);

          // Verify aggregation structure
          expect(aggregatedYield).toHaveProperty('totalYield');
          expect(aggregatedYield).toHaveProperty('sourceBreakdown');
          expect(aggregatedYield).toHaveProperty('period');
          expect(aggregatedYield).toHaveProperty('aggregationTimestamp');

          expect(aggregatedYield.totalYield).toBeGreaterThanOrEqual(0n);
          expect(Array.isArray(aggregatedYield.sourceBreakdown)).toBe(true);
          expect(aggregatedYield.period).toEqual(period);

          // Verify only active sources are included in breakdown
          const breakdownSourceIds = aggregatedYield.sourceBreakdown.map(sb => sb.sourceId);
          const expectedActiveSourceIds = sources
            .filter(s => s.isActive)
            .map(s => s.sourceType === 'defi' ? `${s.id}_defi` : 
                     s.sourceType === 'rwa' ? `${s.id}_rwa` : s.id);

          expect(breakdownSourceIds.length).toBe(expectedActiveSourceIds.length);
          breakdownSourceIds.forEach(id => {
            expect(expectedActiveSourceIds).toContain(id);
          });

          // Verify each source breakdown has required fields
          aggregatedYield.sourceBreakdown.forEach(sb => {
            expect(sb).toHaveProperty('sourceId');
            expect(sb).toHaveProperty('sourceName');
            expect(sb).toHaveProperty('rawYield');
            expect(sb).toHaveProperty('weightedYield');
            expect(sb).toHaveProperty('weight');
            expect(sb).toHaveProperty('token');

            expect(sb.rawYield).toBeGreaterThanOrEqual(0n);
            expect(sb.weightedYield).toBeGreaterThanOrEqual(0n);
            expect(sb.weight).toBeGreaterThan(0);
            expect(typeof sb.token).toBe('string');
            expect(sb.token.length).toBeGreaterThan(0);
          });

          // Verify total yield equals sum of weighted yields
          const sumOfWeightedYields = aggregatedYield.sourceBreakdown.reduce(
            (sum, sb) => sum + sb.weightedYield, 
            0n
          );
          expect(aggregatedYield.totalYield).toBe(sumOfWeightedYields);

          // Verify weights are positive and reasonable
          aggregatedYield.sourceBreakdown.forEach(sb => {
            expect(sb.weight).toBeGreaterThan(0);
            expect(sb.weight).toBeLessThanOrEqual(1.0);
          });

          // If there are multiple sources, verify weight distribution
          if (aggregatedYield.sourceBreakdown.length > 1) {
            const totalWeight = aggregatedYield.sourceBreakdown.reduce(
              (sum, sb) => sum + sb.weight, 
              0
            );
            
            // Total weight should be approximately 1.0 (allowing for normalization)
            expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.01);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Weight normalization should work correctly when source weights 
   * don't sum to 1.0
   */
  test('should normalize weights correctly when they do not sum to 1.0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 15 }).map(s => `src_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 25 }),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true }), // Intentionally allow > 1.0
              isActive: fc.constant(true) // All active for this test
            }),
            { minLength: 2, maxLength: 5 }
          ),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ sources, period }) => {
          // Ensure unique source IDs
          const uniqueIds = new Set(sources.map(s => s.id));
          fc.pre(uniqueIds.size === sources.length);

          // Calculate original total weight
          const originalTotalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
          
          // Skip if total weight is too close to 1.0 (no normalization needed)
          fc.pre(Math.abs(originalTotalWeight - 1.0) > 0.1);

          const freshEngine = new YieldCalculationEngine(mockConfig);

          // Add sources with non-normalized weights
          sources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: `https://api.${source.id}.com`,
              weight: source.weight,
              isActive: source.isActive
            };
            freshEngine.addYieldSource(yieldSource);
          });

          const aggregatedYield = await freshEngine.aggregateMultiSourceYields(period);

          // Verify normalization occurred
          const normalizedTotalWeight = aggregatedYield.sourceBreakdown.reduce(
            (sum, sb) => sum + sb.weight, 
            0
          );

          expect(Math.abs(normalizedTotalWeight - 1.0)).toBeLessThan(0.001);

          // Verify proportional relationships are maintained
          for (let i = 0; i < sources.length - 1; i++) {
            const source1 = sources[i];
            const source2 = sources[i + 1];
            
            const breakdown1 = aggregatedYield.sourceBreakdown.find(sb => sb.sourceId === source1.id);
            const breakdown2 = aggregatedYield.sourceBreakdown.find(sb => sb.sourceId === source2.id);
            
            if (breakdown1 && breakdown2) {
              const originalRatio = source1.weight / source2.weight;
              const normalizedRatio = breakdown1.weight / breakdown2.weight;
              
              // Ratios should be approximately equal (within 1% tolerance)
              expect(Math.abs(originalRatio - normalizedRatio) / originalRatio).toBeLessThan(0.01);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: System should handle source failures gracefully without 
   * affecting working sources
   */
  test('should handle source failures gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          workingSources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 15 }).map(s => `working_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 25 }),
              weight: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8), noNaN: true }),
              isActive: fc.constant(true)
            }),
            { minLength: 1, maxLength: 3 }
          ),
          failingSources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 15 }).map(s => `failing_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 25 }),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
              isActive: fc.constant(true)
            }),
            { minLength: 1, maxLength: 2 }
          ),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ workingSources, failingSources, period }) => {
          // Ensure unique source IDs across both arrays
          const allIds = [...workingSources.map(s => s.id), ...failingSources.map(s => s.id)];
          const uniqueIds = new Set(allIds);
          fc.pre(uniqueIds.size === allIds.length);

          const freshEngine = new YieldCalculationEngine(mockConfig);

          // Add working sources
          workingSources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: `https://api.${source.id}.com`,
              weight: source.weight,
              isActive: source.isActive
            };
            freshEngine.addYieldSource(yieldSource);
          });

          // Add failing sources (simulate by making them inactive or with bad endpoints)
          failingSources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: 'https://invalid-endpoint-that-will-fail.com',
              weight: source.weight,
              isActive: source.isActive
            };
            freshEngine.addYieldSource(yieldSource);
          });

          // Aggregate yields - should succeed despite some sources failing
          const aggregatedYield = await freshEngine.aggregateMultiSourceYields(period);

          // Verify aggregation succeeded
          expect(aggregatedYield.totalYield).toBeGreaterThanOrEqual(0n);
          expect(aggregatedYield.sourceBreakdown.length).toBeGreaterThan(0);

          // Verify only working sources are in the breakdown
          // (failing sources should be excluded or have zero yield)
          const workingSourceIds = workingSources.map(s => s.id);
          const breakdownSourceIds = aggregatedYield.sourceBreakdown
            .filter(sb => sb.weightedYield > 0n)
            .map(sb => sb.sourceId);

          // All breakdown sources with positive yield should be from working sources
          breakdownSourceIds.forEach(id => {
            expect(workingSourceIds).toContain(id);
          });

          // Verify total yield is positive if we have working sources
          if (workingSources.length > 0) {
            expect(aggregatedYield.totalYield).toBeGreaterThan(0n);
          }

          // Verify source breakdown contains information about successful sources
          aggregatedYield.sourceBreakdown.forEach(sb => {
            if (sb.weightedYield > 0n) {
              expect(workingSourceIds).toContain(sb.sourceId);
              expect(sb.rawYield).toBeGreaterThan(0n);
              expect(sb.weight).toBeGreaterThan(0);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different source types (DeFi, RWA, generic) should be handled 
   * correctly with appropriate yield calculations
   */
  test('should handle different source types with appropriate yield calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          defiSources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 10 }).map(s => `defi_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 20 }),
              weight: fc.float({ min: Math.fround(0.2), max: Math.fround(0.6), noNaN: true })
            }),
            { minLength: 1, maxLength: 3 }
          ),
          rwaSources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 10 }).map(s => `rwa_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 20 }),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.4), noNaN: true })
            }),
            { minLength: 1, maxLength: 2 }
          ),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ defiSources, rwaSources, period }) => {
          // Ensure unique source IDs
          const allIds = [...defiSources.map(s => s.id), ...rwaSources.map(s => s.id)];
          const uniqueIds = new Set(allIds);
          fc.pre(uniqueIds.size === allIds.length);

          const freshEngine = new YieldCalculationEngine(mockConfig);

          // Add DeFi sources
          defiSources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: `https://defi-api.${source.id}.com`,
              weight: source.weight,
              isActive: true
            };
            freshEngine.addYieldSource(yieldSource);
          });

          // Add RWA sources
          rwaSources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: `https://rwa-api.${source.id}.com`,
              weight: source.weight,
              isActive: true
            };
            freshEngine.addYieldSource(yieldSource);
          });

          const aggregatedYield = await freshEngine.aggregateMultiSourceYields(period);

          // Verify all source types are represented
          const defiBreakdown = aggregatedYield.sourceBreakdown.filter(sb => 
            sb.sourceId.includes('defi')
          );
          const rwaBreakdown = aggregatedYield.sourceBreakdown.filter(sb => 
            sb.sourceId.includes('rwa')
          );

          expect(defiBreakdown.length).toBe(defiSources.length);
          expect(rwaBreakdown.length).toBe(rwaSources.length);

          // Verify each source type produces reasonable yields
          defiBreakdown.forEach(sb => {
            expect(sb.rawYield).toBeGreaterThan(0n);
            expect(sb.weightedYield).toBeGreaterThan(0n);
            expect(sb.token).toBe('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'); // ETH for DeFi
          });

          rwaBreakdown.forEach(sb => {
            expect(sb.rawYield).toBeGreaterThan(0n);
            expect(sb.weightedYield).toBeGreaterThan(0n);
            expect(sb.token).toBe('0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8'); // USDC for RWA
          });

          // Verify total yield is sum of all weighted yields
          const expectedTotal = aggregatedYield.sourceBreakdown.reduce(
            (sum, sb) => sum + sb.weightedYield,
            0n
          );
          expect(aggregatedYield.totalYield).toBe(expectedTotal);

          // Verify period information is preserved
          expect(aggregatedYield.period).toEqual(period);
          expect(aggregatedYield.aggregationTimestamp).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Yield aggregation should be deterministic for the same inputs
   */
  test('should produce consistent results for identical inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sources: fc.array(
            fc.record({
              id: fc.string({ minLength: 3, maxLength: 10 }).map(s => `test_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
              name: fc.string({ minLength: 5, maxLength: 15 }),
              weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }),
              isActive: fc.constant(true)
            }),
            { minLength: 2, maxLength: 4 }
          ),
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }),
            end: fc.integer({ min: 1672531200000, max: 1704067200000 })
          }).filter(p => p.end > p.start)
        }),
        async ({ sources, period }) => {
          // Ensure unique source IDs
          const uniqueIds = new Set(sources.map(s => s.id));
          fc.pre(uniqueIds.size === sources.length);

          // Create two identical engines
          const engine1 = new YieldCalculationEngine(mockConfig);
          const engine2 = new YieldCalculationEngine(mockConfig);

          // Add identical sources to both engines
          sources.forEach(source => {
            const yieldSource: YieldSource = {
              id: source.id,
              name: source.name,
              endpoint: `https://api.${source.id}.com`,
              weight: source.weight,
              isActive: source.isActive
            };
            engine1.addYieldSource(yieldSource);
            engine2.addYieldSource({ ...yieldSource }); // Deep copy
          });

          // Get aggregated yields from both engines
          const result1 = await engine1.aggregateMultiSourceYields(period);
          const result2 = await engine2.aggregateMultiSourceYields(period);

          // Results should be identical (excluding timestamp)
          expect(result1.totalYield).toBe(result2.totalYield);
          expect(result1.sourceBreakdown.length).toBe(result2.sourceBreakdown.length);
          expect(result1.period).toEqual(result2.period);

          // Compare source breakdowns
          result1.sourceBreakdown.forEach((sb1, index) => {
            const sb2 = result2.sourceBreakdown[index];
            expect(sb1.sourceId).toBe(sb2.sourceId);
            expect(sb1.sourceName).toBe(sb2.sourceName);
            expect(sb1.rawYield).toBe(sb2.rawYield);
            expect(sb1.weightedYield).toBe(sb2.weightedYield);
            expect(Math.abs(sb1.weight - sb2.weight)).toBeLessThan(0.001);
            expect(sb1.token).toBe(sb2.token);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});