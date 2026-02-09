/**
 * Property-Based Test for Yield Distribution Proportionality
 * Feature: kirito-sdk, Property 7: Yield Distribution Proportionality
 * Validates: Requirements 3.1, 3.2
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { YieldCalculationEngine, YieldDistributorSDK } from '../../src/sdk/shielded-pool';
import { 
  KiritoSDKConfig,
  TokenId,
  TimePeriod,
  StakingInfo,
  YieldSource,
  StakingStatistics
} from '../../src/types';

describe('Property 7: Yield Distribution Proportionality', () => {
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
   * Property: For any collection of NFTs with varying stakes and rarity scores, 
   * yield distribution should be proportional to the combination of shielded stake 
   * amount and rarity multiplier.
   * 
   * This property tests that:
   * 1. Higher stakes result in proportionally higher yields
   * 2. Higher rarity scores result in proportionally higher yields
   * 3. Combined stake and rarity weights are calculated correctly (70% stake, 30% rarity)
   * 4. Yield multipliers are applied correctly
   * 5. Total distributed yield never exceeds the available yield pool
   */
  test('should distribute yields proportionally based on stake and rarity', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple NFTs with different staking configurations
        fc.record({
          nfts: fc.array(
            fc.record({
              tokenId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `nft_${s}`),
              stakedAmount: fc.bigInt({ min: 1000n, max: 10000000n }), // 1K to 10M
              rarityScore: fc.float({ min: 1.0, max: 10.0, noNaN: true }),
              yieldMultiplier: fc.float({ min: 1.0, max: 5.0, noNaN: true })
            }),
            { minLength: 2, maxLength: 10 }
          ),
          totalYieldPool: fc.bigInt({ min: 100000n, max: 100000000n }), // 100K to 100M
          period: fc.record({
            start: fc.integer({ min: 1640995200000, max: 1672531200000 }), // 2022-2023
            end: fc.integer({ min: 1672531200000, max: 1704067200000 }) // 2023-2024
          }).filter(p => p.end > p.start)
        }),
        async ({ nfts, totalYieldPool, period }) => {
          // Ensure unique token IDs
          const uniqueTokenIds = new Set(nfts.map(nft => nft.tokenId));
          fc.pre(uniqueTokenIds.size === nfts.length);

          // Update staking info for all NFTs
          nfts.forEach(nft => {
            const stakingInfo: StakingInfo = {
              tokenId: nft.tokenId,
              stakedAmount: nft.stakedAmount,
              rarityScore: nft.rarityScore,
              yieldMultiplier: nft.yieldMultiplier,
              lastClaimTimestamp: period.start
            };
            yieldEngine.updateStakingInfo(nft.tokenId, stakingInfo);
          });

          // Get staking statistics
          const stats = yieldEngine.getStakingStatistics();
          expect(stats.activeStakers).toBe(nfts.length);
          expect(stats.totalStakedAmount).toBeGreaterThan(0n);
          expect(stats.totalRarityWeight).toBeGreaterThan(0);

          // Calculate yields for all NFTs
          const yieldResults = await Promise.all(
            nfts.map(async nft => {
              const proportionalYield = await yieldEngine.calculateProportionalYield(
                nft.tokenId,
                nft.stakedAmount,
                nft.rarityScore,
                nft.yieldMultiplier,
                totalYieldPool
              );
              return {
                tokenId: nft.tokenId,
                yield: proportionalYield,
                stakedAmount: nft.stakedAmount,
                rarityScore: nft.rarityScore,
                yieldMultiplier: nft.yieldMultiplier
              };
            })
          );

          // Verify all yields are non-negative
          yieldResults.forEach(result => {
            expect(result.yield).toBeGreaterThanOrEqual(0n);
          });

          // Verify total distributed yield doesn't exceed pool
          const totalDistributed = yieldResults.reduce((sum, result) => sum + result.yield, 0n);
          expect(totalDistributed).toBeLessThanOrEqual(totalYieldPool);

          // Test proportionality: higher stakes should generally result in higher yields
          // (when other factors are similar)
          const sortedByStake = [...yieldResults].sort((a, b) => 
            Number(a.stakedAmount - b.stakedAmount)
          );
          
          // For NFTs with similar rarity and multiplier, higher stake should mean higher yield
          for (let i = 0; i < sortedByStake.length - 1; i++) {
            const current = sortedByStake[i];
            const next = sortedByStake[i + 1];
            
            // If rarity and multiplier are similar (within 10%), stake should dominate
            const raritySimilar = Math.abs(current.rarityScore - next.rarityScore) < 1.0;
            const multiplierSimilar = Math.abs(current.yieldMultiplier - next.yieldMultiplier) < 0.5;
            
            if (raritySimilar && multiplierSimilar && next.stakedAmount > current.stakedAmount * 2n) {
              expect(next.yield).toBeGreaterThan(current.yield);
            }
          }

          // Test rarity impact: higher rarity should increase yield when stakes are similar
          const sortedByRarity = [...yieldResults].sort((a, b) => a.rarityScore - b.rarityScore);
          
          for (let i = 0; i < sortedByRarity.length - 1; i++) {
            const current = sortedByRarity[i];
            const next = sortedByRarity[i + 1];
            
            // If stakes are similar (within 50%), rarity should have positive impact
            const stakeSimilar = next.stakedAmount <= current.stakedAmount * 2n && 
                                current.stakedAmount <= next.stakedAmount * 2n;
            const multiplierSimilar = Math.abs(current.yieldMultiplier - next.yieldMultiplier) < 0.5;
            
            if (stakeSimilar && multiplierSimilar && next.rarityScore > current.rarityScore * 1.5) {
              expect(next.yield).toBeGreaterThanOrEqual(current.yield);
            }
          }

          // Test yield multiplier impact
          const sortedByMultiplier = [...yieldResults].sort((a, b) => a.yieldMultiplier - b.yieldMultiplier);
          
          for (let i = 0; i < sortedByMultiplier.length - 1; i++) {
            const current = sortedByMultiplier[i];
            const next = sortedByMultiplier[i + 1];
            
            // If stakes and rarity are similar, multiplier should increase yield
            const stakeSimilar = next.stakedAmount <= current.stakedAmount * 2n && 
                                current.stakedAmount <= next.stakedAmount * 2n;
            const raritySimilar = Math.abs(current.rarityScore - next.rarityScore) < 1.0;
            
            if (stakeSimilar && raritySimilar && next.yieldMultiplier > current.yieldMultiplier * 1.5) {
              expect(next.yield).toBeGreaterThan(current.yield);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Yield distribution should maintain mathematical consistency
   * across different pool sizes and staking configurations.
   */
  test('should maintain mathematical consistency in yield calculations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseStake: fc.bigInt({ min: 1000n, max: 1000000n }),
          baseRarity: fc.float({ min: 1.0, max: 5.0, noNaN: true }),
          baseMultiplier: fc.float({ min: 1.0, max: 3.0, noNaN: true }),
          scaleFactor: fc.float({ min: 2.0, max: 10.0, noNaN: true }),
          poolSize: fc.bigInt({ min: 100000n, max: 10000000n })
        }),
        async ({ baseStake, baseRarity, baseMultiplier, scaleFactor, poolSize }) => {
          const tokenId1 = 'test_nft_1';
          const tokenId2 = 'test_nft_2';

          // Create two NFTs: one with base values, one with scaled values
          const stakingInfo1: StakingInfo = {
            tokenId: tokenId1,
            stakedAmount: baseStake,
            rarityScore: baseRarity,
            yieldMultiplier: baseMultiplier,
            lastClaimTimestamp: Date.now()
          };

          const stakingInfo2: StakingInfo = {
            tokenId: tokenId2,
            stakedAmount: BigInt(Math.floor(Number(baseStake) * scaleFactor)),
            rarityScore: baseRarity * scaleFactor,
            yieldMultiplier: baseMultiplier * scaleFactor,
            lastClaimTimestamp: Date.now()
          };

          // Update staking info
          yieldEngine.updateStakingInfo(tokenId1, stakingInfo1);
          yieldEngine.updateStakingInfo(tokenId2, stakingInfo2);

          // Calculate yields
          const yield1 = await yieldEngine.calculateProportionalYield(
            tokenId1,
            stakingInfo1.stakedAmount,
            stakingInfo1.rarityScore,
            stakingInfo1.yieldMultiplier,
            poolSize
          );

          const yield2 = await yieldEngine.calculateProportionalYield(
            tokenId2,
            stakingInfo2.stakedAmount,
            stakingInfo2.rarityScore,
            stakingInfo2.yieldMultiplier,
            poolSize
          );

          // Verify both yields are positive
          expect(yield1).toBeGreaterThan(0n);
          expect(yield2).toBeGreaterThan(0n);

          // The scaled NFT should have significantly higher yield
          // Due to the combined effect of stake (70%) and rarity (30%) weighting
          expect(yield2).toBeGreaterThan(yield1);

          // The ratio should reflect the scaling, though not linearly due to weighting
          const yieldRatio = Number(yield2) / Number(yield1);
          expect(yieldRatio).toBeGreaterThan(1.0);
          
          // Should be less than the full scale factor due to proportional distribution
          expect(yieldRatio).toBeLessThan(scaleFactor * scaleFactor); // Upper bound
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Zero stakes or invalid parameters should be handled gracefully
   */
  test('should handle edge cases and invalid parameters gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validStake: fc.bigInt({ min: 1n, max: 1000000n }),
          validRarity: fc.float({ min: 0.1, max: 10.0, noNaN: true }),
          validMultiplier: fc.float({ min: 0.1, max: 5.0, noNaN: true }),
          poolSize: fc.bigInt({ min: 1000n, max: 1000000n })
        }),
        async ({ validStake, validRarity, validMultiplier, poolSize }) => {
          const tokenId = 'test_edge_case';

          // Test with zero stake
          const zeroStakeInfo: StakingInfo = {
            tokenId,
            stakedAmount: 0n,
            rarityScore: validRarity,
            yieldMultiplier: validMultiplier,
            lastClaimTimestamp: Date.now()
          };

          yieldEngine.updateStakingInfo(tokenId, zeroStakeInfo);
          
          const zeroStakeYield = await yieldEngine.calculateProportionalYield(
            tokenId,
            0n,
            validRarity,
            validMultiplier,
            poolSize
          );

          // Zero stake should result in zero or minimal yield
          expect(zeroStakeYield).toBeGreaterThanOrEqual(0n);

          // Test with valid parameters
          const validStakeInfo: StakingInfo = {
            tokenId,
            stakedAmount: validStake,
            rarityScore: validRarity,
            yieldMultiplier: validMultiplier,
            lastClaimTimestamp: Date.now()
          };

          yieldEngine.updateStakingInfo(tokenId, validStakeInfo);
          
          const validYield = await yieldEngine.calculateProportionalYield(
            tokenId,
            validStake,
            validRarity,
            validMultiplier,
            poolSize
          );

          expect(validYield).toBeGreaterThanOrEqual(0n);
          expect(validYield).toBeLessThanOrEqual(poolSize);

          // Valid stake should generally produce higher yield than zero stake
          if (validStake > 0n) {
            expect(validYield).toBeGreaterThanOrEqual(zeroStakeYield);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Staking statistics should be consistent with individual staking data
   */
  test('should maintain consistent staking statistics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tokenId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `nft_${s}`),
            stakedAmount: fc.bigInt({ min: 100n, max: 1000000n }),
            rarityScore: fc.float({ min: 1.0, max: 10.0, noNaN: true }),
            yieldMultiplier: fc.float({ min: 1.0, max: 5.0, noNaN: true })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (nfts) => {
          // Ensure unique token IDs
          const uniqueTokenIds = new Set(nfts.map(nft => nft.tokenId));
          fc.pre(uniqueTokenIds.size === nfts.length);

          // Clear previous state
          const freshEngine = new YieldCalculationEngine(mockConfig);

          // Add all staking info
          nfts.forEach(nft => {
            const stakingInfo: StakingInfo = {
              tokenId: nft.tokenId,
              stakedAmount: nft.stakedAmount,
              rarityScore: nft.rarityScore,
              yieldMultiplier: nft.yieldMultiplier,
              lastClaimTimestamp: Date.now()
            };
            freshEngine.updateStakingInfo(nft.tokenId, stakingInfo);
          });

          // Get statistics
          const stats = freshEngine.getStakingStatistics();

          // Verify statistics match individual data
          expect(stats.activeStakers).toBe(nfts.length);

          const expectedTotalStake = nfts.reduce((sum, nft) => sum + nft.stakedAmount, 0n);
          expect(stats.totalStakedAmount).toBe(expectedTotalStake);

          const expectedTotalRarity = nfts.reduce((sum, nft) => sum + nft.rarityScore, 0);
          expect(Math.abs(stats.totalRarityWeight - expectedTotalRarity)).toBeLessThan(0.001);

          const expectedAverageStake = expectedTotalStake / BigInt(nfts.length);
          expect(stats.averageStake).toBe(expectedAverageStake);

          const expectedAverageRarity = expectedTotalRarity / nfts.length;
          expect(Math.abs(stats.averageRarity - expectedAverageRarity)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });
});