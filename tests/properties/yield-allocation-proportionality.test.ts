import { describe, it, expect, beforeEach } from '@jest/globals';
import fc from 'fast-check';
import { WalletAllocationEngine, AllocationFactors, DEFAULT_ALLOCATION_FACTORS } from '../../src/sdk/wallet-allocation';
import { TokenMetadata, Address, TokenId } from '../../src/types';

/**
 * Property-Based Tests for Yield Allocation Proportionality
 * 
 * Feature: kirito-sdk, Property 21: Yield Allocation Proportionality
 * Validates: Requirements 3.1, 3.2
 * 
 * Tests that yield allocation is proportional to stake amounts and rarity scores,
 * ensuring fair distribution across all NFTs in a collection.
 */

describe('Yield Allocation Proportionality Properties', () => {
  let allocationEngine: WalletAllocationEngine;

  beforeEach(() => {
    allocationEngine = new WalletAllocationEngine(DEFAULT_ALLOCATION_FACTORS);
  });

  /**
   * Property 21: Yield Allocation Proportionality
   * For any collection of NFTs with varying stakes and rarity scores,
   * yield allocation should be proportional to the combination of stake amount and rarity multiplier.
   */
  it('should allocate yields proportionally to stake and rarity', () => {
    fc.assert(
      fc.property(
        // Generate collection of NFTs with varying properties
        fc.array(
          fc.record({
            tokenId: fc.string({ minLength: 1, maxLength: 20 }),
            owner: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}` as Address),
            rarityScore: fc.integer({ min: 0, max: 100 }),
            stakeAmount: fc.bigInt({ min: 1n, max: 1000000000000000000000n }), // 1 to 1000 tokens
            attributes: fc.array(
              fc.record({
                trait_type: fc.constantFrom('Background', 'Eyes', 'Mouth', 'Hat'),
                value: fc.string({ minLength: 1, maxLength: 10 })
              }),
              { minLength: 1, maxLength: 5 }
            )
          }),
          { minLength: 2, maxLength: 20 }
        ),
        fc.bigInt({ min: 1000000000000000000n, max: 100000000000000000000n }), // Total yield pool
        (nftData, totalYieldPool) => {
          // Ensure unique token IDs
          const uniqueNfts = nftData.filter((nft, index, arr) => 
            arr.findIndex(n => n.tokenId === nft.tokenId) === index
          );
          
          if (uniqueNfts.length < 2) return; // Need at least 2 NFTs for meaningful test

          // Create metadata for each NFT
          const nftsWithMetadata = uniqueNfts.map(nft => ({
            ...nft,
            metadata: {
              name: `NFT ${nft.tokenId}`,
              description: 'Test NFT',
              image: 'ipfs://test',
              attributes: nft.attributes,
              rarityScore: nft.rarityScore,
              yieldMultiplier: 1.0
            } as TokenMetadata
          }));

          // Calculate allocations for all NFTs
          const allocations = nftsWithMetadata.map(nft => 
            allocationEngine.calculateAllocation(
              nft.tokenId as TokenId,
              nft.owner,
              nft.metadata,
              nft.stakeAmount
            )
          );

          // Calculate proportional distribution
          const distribution = allocationEngine.calculateProportionalDistribution(
            totalYieldPool,
            allocations
          );

          // Property 1: Total allocated should equal total yield pool (within rounding)
          const totalAllocated = distribution.allocationDistribution.reduce(
            (sum, alloc) => sum + alloc.allocatedAmount,
            0n
          );
          const difference = totalYieldPool > totalAllocated 
            ? totalYieldPool - totalAllocated 
            : totalAllocated - totalYieldPool;
          
          // Allow for small rounding differences (less than number of NFTs)
          expect(difference).toBeLessThanOrEqual(BigInt(allocations.length));

          // Property 2: Higher stake + rarity should get proportionally more yield
          for (let i = 0; i < distribution.allocationDistribution.length; i++) {
            for (let j = i + 1; j < distribution.allocationDistribution.length; j++) {
              const alloc1 = distribution.allocationDistribution[i];
              const alloc2 = distribution.allocationDistribution[j];
              
              // If NFT1 has higher allocated weight, it should get more yield
              if (alloc1.allocatedAmount > alloc2.allocatedAmount) {
                expect(allocations[i].allocatedAmount).toBeGreaterThanOrEqual(
                  allocations[j].allocatedAmount
                );
              }
            }
          }

          // Property 3: Allocation should be deterministic
          const secondCalculation = allocationEngine.calculateProportionalDistribution(
            totalYieldPool,
            allocations
          );
          
          expect(secondCalculation.totalAllocated).toBe(distribution.totalAllocated);
          expect(secondCalculation.allocationDistribution.length).toBe(
            distribution.allocationDistribution.length
          );

          // Property 4: No NFT should receive more than the total pool
          distribution.allocationDistribution.forEach(alloc => {
            expect(alloc.allocatedAmount).toBeLessThanOrEqual(totalYieldPool);
          });

          // Property 5: Allocation should be monotonic with respect to stake
          const sortedByStake = [...allocations].sort((a, b) => 
            a.stakeAmount > b.stakeAmount ? 1 : -1
          );
          
          for (let i = 1; i < sortedByStake.length; i++) {
            const prev = sortedByStake[i - 1];
            const curr = sortedByStake[i];
            
            // If stake is significantly higher and rarity is not much lower,
            // allocated weight should be higher
            if (curr.stakeAmount > prev.stakeAmount * 2n && 
                curr.rarityScore >= prev.rarityScore - 10) {
              expect(curr.allocatedAmount).toBeGreaterThanOrEqual(prev.allocatedAmount);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Allocation factors consistency
   * For any allocation factors, changing weights should predictably affect allocations.
   */
  it('should consistently apply allocation factors', () => {
    fc.assert(
      fc.property(
        fc.record({
          rarityWeight: fc.float({ min: 0, max: 1 }),
          stakeWeight: fc.float({ min: 0, max: 1 }),
          baseAllocation: fc.bigInt({ min: 1000000000000000000n, max: 10000000000000000000n })
        }),
        fc.record({
          tokenId: fc.string({ minLength: 1, maxLength: 20 }),
          owner: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}` as Address),
          rarityScore: fc.integer({ min: 0, max: 100 }),
          stakeAmount: fc.bigInt({ min: 1000000000000000000n, max: 100000000000000000000n }),
          attributes: fc.array(
            fc.record({
              trait_type: fc.string({ minLength: 1, maxLength: 10 }),
              value: fc.string({ minLength: 1, maxLength: 10 })
            }),
            { minLength: 0, maxLength: 3 }
          )
        }),
        (factors, nftData) => {
          const allocationFactors: AllocationFactors = {
            rarityWeight: factors.rarityWeight,
            stakeWeight: factors.stakeWeight,
            customMultipliers: {},
            baseAllocation: factors.baseAllocation
          };

          const engine = new WalletAllocationEngine(allocationFactors);
          
          const metadata: TokenMetadata = {
            name: `NFT ${nftData.tokenId}`,
            description: 'Test NFT',
            image: 'ipfs://test',
            attributes: nftData.attributes,
            rarityScore: nftData.rarityScore,
            yieldMultiplier: 1.0
          };

          const allocation = engine.calculateAllocation(
            nftData.tokenId as TokenId,
            nftData.owner,
            metadata,
            nftData.stakeAmount
          );

          // Property: Allocation should include base allocation
          expect(allocation.allocatedAmount).toBeGreaterThanOrEqual(factors.baseAllocation);

          // Property: Higher rarity weight should increase impact of rarity
          if (factors.rarityWeight > 0.5 && nftData.rarityScore > 50) {
            const lowRarityEngine = new WalletAllocationEngine({
              ...allocationFactors,
              rarityWeight: 0.1
            });
            
            const lowRarityAllocation = lowRarityEngine.calculateAllocation(
              nftData.tokenId as TokenId,
              nftData.owner,
              metadata,
              nftData.stakeAmount
            );

            expect(allocation.allocatedAmount).toBeGreaterThan(lowRarityAllocation.allocatedAmount);
          }

          // Property: Yield multiplier should be at least 1.0
          expect(allocation.yieldMultiplier).toBeGreaterThanOrEqual(1.0);

          // Property: Allocation should be deterministic
          const secondAllocation = engine.calculateAllocation(
            nftData.tokenId as TokenId,
            nftData.owner,
            metadata,
            nftData.stakeAmount
          );

          expect(secondAllocation.allocatedAmount).toBe(allocation.allocatedAmount);
          expect(secondAllocation.yieldMultiplier).toBe(allocation.yieldMultiplier);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Custom factors impact
   * For any NFT with custom factors, the allocation should reflect those factors.
   */
  it('should properly apply custom allocation factors', () => {
    fc.assert(
      fc.property(
        fc.record({
          tokenId: fc.string({ minLength: 1, maxLength: 20 }),
          owner: fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}` as Address),
          rarityScore: fc.integer({ min: 0, max: 100 }),
          stakeAmount: fc.bigInt({ min: 1000000000000000000n, max: 100000000000000000000n }),
          hasLegendaryBackground: fc.boolean(),
          hasDiamondEyes: fc.boolean(),
          hasRareTrait: fc.boolean()
        }),
        (nftData) => {
          const customMultipliers: Record<string, number> = {
            'legendary_background': 0.5,
            'diamond_eyes': 0.3,
            'rare_trait': 0.2
          };

          const allocationFactors: AllocationFactors = {
            ...DEFAULT_ALLOCATION_FACTORS,
            customMultipliers
          };

          const engine = new WalletAllocationEngine(allocationFactors);

          // Create attributes based on boolean flags
          const attributes = [];
          if (nftData.hasLegendaryBackground) {
            attributes.push({ trait_type: 'Background', value: 'Legendary' });
          }
          if (nftData.hasDiamondEyes) {
            attributes.push({ trait_type: 'Eyes', value: 'Diamond' });
          }
          if (nftData.hasRareTrait) {
            attributes.push({ trait_type: 'Special', value: 'Rare' });
          }

          const metadata: TokenMetadata = {
            name: `NFT ${nftData.tokenId}`,
            description: 'Test NFT',
            image: 'ipfs://test',
            attributes,
            rarityScore: nftData.rarityScore,
            yieldMultiplier: 1.0
          };

          const allocation = engine.calculateAllocation(
            nftData.tokenId as TokenId,
            nftData.owner,
            metadata,
            nftData.stakeAmount
          );

          // Create same NFT without custom traits for comparison
          const baseMetadata: TokenMetadata = {
            ...metadata,
            attributes: []
          };

          const baseAllocation = engine.calculateAllocation(
            `${nftData.tokenId}_base` as TokenId,
            nftData.owner,
            baseMetadata,
            nftData.stakeAmount
          );

          // Property: NFTs with custom factors should have higher allocation
          if (nftData.hasLegendaryBackground || nftData.hasDiamondEyes || nftData.hasRareTrait) {
            expect(allocation.yieldMultiplier).toBeGreaterThan(baseAllocation.yieldMultiplier);
            expect(allocation.allocatedAmount).toBeGreaterThan(baseAllocation.allocatedAmount);
          } else {
            // Without custom factors, allocations should be equal
            expect(allocation.yieldMultiplier).toBe(baseAllocation.yieldMultiplier);
          }

          // Property: More custom factors should mean higher multiplier
          const customFactorCount = [
            nftData.hasLegendaryBackground,
            nftData.hasDiamondEyes,
            nftData.hasRareTrait
          ].filter(Boolean).length;

          if (customFactorCount > 1) {
            // Create NFT with only one custom factor
            const singleFactorMetadata: TokenMetadata = {
              ...metadata,
              attributes: [attributes[0]] // Take first attribute only
            };

            const singleFactorAllocation = engine.calculateAllocation(
              `${nftData.tokenId}_single` as TokenId,
              nftData.owner,
              singleFactorMetadata,
              nftData.stakeAmount
            );

            expect(allocation.yieldMultiplier).toBeGreaterThanOrEqual(
              singleFactorAllocation.yieldMultiplier
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Allocation preview consistency
   * For any NFT configuration, the allocation preview should match actual allocation.
   */
  it('should provide consistent allocation previews', () => {
    fc.assert(
      fc.property(
        fc.record({
          tokenId: fc.string({ minLength: 1, maxLength: 20 }),
          rarityScore: fc.integer({ min: 0, max: 100 }),
          stakeAmount: fc.bigInt({ min: 1000000000000000000n, max: 100000000000000000000n }),
          estimatedAnnualYield: fc.bigInt({ min: 1000000000000000000n, max: 10000000000000000000n }),
          attributes: fc.array(
            fc.record({
              trait_type: fc.string({ minLength: 1, maxLength: 10 }),
              value: fc.string({ minLength: 1, maxLength: 10 })
            }),
            { minLength: 0, maxLength: 5 }
          )
        }),
        (data) => {
          const metadata: TokenMetadata = {
            name: `NFT ${data.tokenId}`,
            description: 'Test NFT',
            image: 'ipfs://test',
            attributes: data.attributes,
            rarityScore: data.rarityScore,
            yieldMultiplier: 1.0
          };

          const preview = allocationEngine.createAllocationPreview(
            data.tokenId as TokenId,
            metadata,
            data.stakeAmount,
            data.estimatedAnnualYield
          );

          // Property: Preview should have consistent yield calculations
          expect(preview.estimatedDailyYield * 365n).toBeCloseTo(
            Number(preview.estimatedAnnualYield),
            -15 // Allow for some precision loss in bigint calculations
          );

          expect(preview.estimatedMonthlyYield * 12n).toBeCloseTo(
            Number(preview.estimatedAnnualYield),
            -15
          );

          // Property: Yield multiplier should be positive
          expect(preview.yieldMultiplier).toBeGreaterThan(0);

          // Property: Allocation breakdown should sum correctly
          const breakdown = preview.allocationBreakdown;
          const calculatedTotal = breakdown.baseAllocation + 
                                breakdown.rarityBonus + 
                                breakdown.stakeBonus + 
                                breakdown.customBonus;

          expect(breakdown.totalAllocation).toBe(calculatedTotal);

          // Property: Allocation percentage should be reasonable
          expect(breakdown.allocationPercentage).toBeGreaterThanOrEqual(1.0);
          expect(breakdown.allocationPercentage).toBeLessThanOrEqual(100.0); // Reasonable upper bound
        }
      ),
      { numRuns: 100 }
    );
  });
});