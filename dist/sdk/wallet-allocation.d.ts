import { Address, TokenId, TokenMetadata } from '../types';
/**
 * Allocation factors for yield distribution
 */
export interface AllocationFactors {
    rarityWeight: number;
    stakeWeight: number;
    customMultipliers: Record<string, number>;
    baseAllocation: bigint;
}
/**
 * NFT allocation data
 */
export interface NFTAllocation {
    tokenId: TokenId;
    owner: Address;
    rarityScore: number;
    stakeAmount: bigint;
    yieldMultiplier: number;
    allocatedAmount: bigint;
    customFactors: Record<string, number>;
}
/**
 * Allocation preview for minting
 */
export interface AllocationPreview {
    tokenId: TokenId;
    rarityScore: number;
    stakeAmount: bigint;
    yieldMultiplier: number;
    estimatedDailyYield: bigint;
    estimatedMonthlyYield: bigint;
    estimatedAnnualYield: bigint;
    allocationBreakdown: AllocationBreakdown;
}
/**
 * Breakdown of allocation calculation
 */
export interface AllocationBreakdown {
    baseAllocation: bigint;
    rarityBonus: bigint;
    stakeBonus: bigint;
    customBonus: bigint;
    totalAllocation: bigint;
    allocationPercentage: number;
}
/**
 * Collection allocation summary
 */
export interface CollectionAllocation {
    totalYieldPool: bigint;
    totalAllocated: bigint;
    remainingPool: bigint;
    nftCount: number;
    averageAllocation: bigint;
    allocationDistribution: NFTAllocation[];
}
/**
 * Wallet Allocation Engine
 *
 * Handles allocation of yields to NFT wallets based on rarity scores,
 * stake amounts, and custom factors.
 */
export declare class WalletAllocationEngine {
    private allocationFactors;
    private allocations;
    constructor(allocationFactors: AllocationFactors);
    /**
     * Calculate allocation for a single NFT
     */
    calculateAllocation(tokenId: TokenId, owner: Address, metadata: TokenMetadata, stakeAmount: bigint): NFTAllocation;
    /**
     * Calculate proportional yield distribution for multiple NFTs
     */
    calculateProportionalDistribution(totalYieldPool: bigint, nftAllocations: NFTAllocation[]): CollectionAllocation;
    /**
     * Create allocation preview before minting
     */
    createAllocationPreview(tokenId: TokenId, metadata: TokenMetadata, stakeAmount: bigint, estimatedAnnualYield: bigint): AllocationPreview;
    /**
     * Update allocation factors
     */
    updateAllocationFactors(newFactors: Partial<AllocationFactors>): void;
    /**
     * Get allocation for specific NFT
     */
    getAllocation(tokenId: TokenId): NFTAllocation | undefined;
    /**
     * Get all allocations
     */
    getAllAllocations(): NFTAllocation[];
    /**
     * Calculate optimal allocation factors based on collection data
     */
    optimizeAllocationFactors(nftData: Array<{
        tokenId: TokenId;
        rarityScore: number;
        stakeAmount: bigint;
        metadata: TokenMetadata;
    }>, targetDistribution: 'equal' | 'rarity-weighted' | 'stake-weighted' | 'balanced'): AllocationFactors;
    /**
     * Simulate allocation distribution for testing
     */
    simulateDistribution(nftData: Array<{
        tokenId: TokenId;
        owner: Address;
        rarityScore: number;
        stakeAmount: bigint;
        metadata: TokenMetadata;
    }>, totalYieldPool: bigint): CollectionAllocation;
    /**
     * Private helper methods
     */
    private calculateYieldMultiplier;
    private calculateAllocatedAmount;
    private extractCustomFactors;
    private calculateAllocationBreakdown;
    private recalculateAllAllocations;
    private calculateRarityRange;
    private calculateStakeRange;
}
/**
 * Factory function to create wallet allocation engine
 */
export declare function createWalletAllocationEngine(allocationFactors: AllocationFactors): WalletAllocationEngine;
/**
 * Default allocation factors
 */
export declare const DEFAULT_ALLOCATION_FACTORS: AllocationFactors;
//# sourceMappingURL=wallet-allocation.d.ts.map