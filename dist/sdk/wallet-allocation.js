"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ALLOCATION_FACTORS = exports.WalletAllocationEngine = void 0;
exports.createWalletAllocationEngine = createWalletAllocationEngine;
/**
 * Wallet Allocation Engine
 *
 * Handles allocation of yields to NFT wallets based on rarity scores,
 * stake amounts, and custom factors.
 */
class WalletAllocationEngine {
    constructor(allocationFactors) {
        this.allocationFactors = allocationFactors;
        this.allocations = new Map();
    }
    /**
     * Calculate allocation for a single NFT
     */
    calculateAllocation(tokenId, owner, metadata, stakeAmount) {
        const rarityScore = metadata.rarityScore || 0;
        const customFactors = this.extractCustomFactors(metadata);
        // Calculate yield multiplier based on factors
        const yieldMultiplier = this.calculateYieldMultiplier(rarityScore, stakeAmount, customFactors);
        // Calculate allocated amount
        const allocatedAmount = this.calculateAllocatedAmount(stakeAmount, yieldMultiplier);
        const allocation = {
            tokenId,
            owner,
            rarityScore,
            stakeAmount,
            yieldMultiplier,
            allocatedAmount,
            customFactors
        };
        // Store allocation
        this.allocations.set(tokenId, allocation);
        return allocation;
    }
    /**
     * Calculate proportional yield distribution for multiple NFTs
     */
    calculateProportionalDistribution(totalYieldPool, nftAllocations) {
        // Calculate total allocation weight
        const totalWeight = nftAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0n);
        if (totalWeight === 0n) {
            throw new Error('No valid allocations found');
        }
        // Calculate proportional distribution
        const distributedAllocations = nftAllocations.map(allocation => {
            const proportionalAmount = (allocation.allocatedAmount * totalYieldPool) / totalWeight;
            return {
                ...allocation,
                allocatedAmount: proportionalAmount
            };
        });
        const totalAllocated = distributedAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0n);
        return {
            totalYieldPool,
            totalAllocated,
            remainingPool: totalYieldPool - totalAllocated,
            nftCount: distributedAllocations.length,
            averageAllocation: totalAllocated / BigInt(distributedAllocations.length),
            allocationDistribution: distributedAllocations
        };
    }
    /**
     * Create allocation preview before minting
     */
    createAllocationPreview(tokenId, metadata, stakeAmount, estimatedAnnualYield) {
        const rarityScore = metadata.rarityScore || 0;
        const customFactors = this.extractCustomFactors(metadata);
        const yieldMultiplier = this.calculateYieldMultiplier(rarityScore, stakeAmount, customFactors);
        // Calculate allocation breakdown
        const breakdown = this.calculateAllocationBreakdown(stakeAmount, rarityScore, customFactors);
        // Estimate yields based on annual yield and multiplier
        const adjustedAnnualYield = (estimatedAnnualYield * BigInt(Math.floor(yieldMultiplier * 10000))) / 10000n;
        const dailyYield = adjustedAnnualYield / 365n;
        const monthlyYield = adjustedAnnualYield / 12n;
        return {
            tokenId,
            rarityScore,
            stakeAmount,
            yieldMultiplier,
            estimatedDailyYield: dailyYield,
            estimatedMonthlyYield: monthlyYield,
            estimatedAnnualYield: adjustedAnnualYield,
            allocationBreakdown: breakdown
        };
    }
    /**
     * Update allocation factors
     */
    updateAllocationFactors(newFactors) {
        this.allocationFactors = {
            ...this.allocationFactors,
            ...newFactors
        };
        // Recalculate existing allocations
        this.recalculateAllAllocations();
    }
    /**
     * Get allocation for specific NFT
     */
    getAllocation(tokenId) {
        return this.allocations.get(tokenId);
    }
    /**
     * Get all allocations
     */
    getAllAllocations() {
        return Array.from(this.allocations.values());
    }
    /**
     * Calculate optimal allocation factors based on collection data
     */
    optimizeAllocationFactors(nftData, targetDistribution) {
        const rarityRange = this.calculateRarityRange(nftData);
        const stakeRange = this.calculateStakeRange(nftData);
        let optimizedFactors;
        switch (targetDistribution) {
            case 'equal':
                optimizedFactors = {
                    rarityWeight: 0,
                    stakeWeight: 0,
                    customMultipliers: {},
                    baseAllocation: this.allocationFactors.baseAllocation
                };
                break;
            case 'rarity-weighted':
                optimizedFactors = {
                    rarityWeight: 0.8,
                    stakeWeight: 0.2,
                    customMultipliers: this.allocationFactors.customMultipliers,
                    baseAllocation: this.allocationFactors.baseAllocation
                };
                break;
            case 'stake-weighted':
                optimizedFactors = {
                    rarityWeight: 0.2,
                    stakeWeight: 0.8,
                    customMultipliers: this.allocationFactors.customMultipliers,
                    baseAllocation: this.allocationFactors.baseAllocation
                };
                break;
            case 'balanced':
            default:
                optimizedFactors = {
                    rarityWeight: 0.4,
                    stakeWeight: 0.4,
                    customMultipliers: this.allocationFactors.customMultipliers,
                    baseAllocation: this.allocationFactors.baseAllocation
                };
                break;
        }
        return optimizedFactors;
    }
    /**
     * Simulate allocation distribution for testing
     */
    simulateDistribution(nftData, totalYieldPool) {
        // Calculate allocations for all NFTs
        const allocations = nftData.map(nft => this.calculateAllocation(nft.tokenId, nft.owner, nft.metadata, nft.stakeAmount));
        // Calculate proportional distribution
        return this.calculateProportionalDistribution(totalYieldPool, allocations);
    }
    /**
     * Private helper methods
     */
    calculateYieldMultiplier(rarityScore, stakeAmount, customFactors) {
        // Normalize rarity score (0-100 to 0-1)
        const normalizedRarity = Math.min(rarityScore / 100, 1);
        // Normalize stake amount (use log scale for large amounts)
        const stakeNumber = Number(stakeAmount);
        const normalizedStake = Math.min(Math.log10(stakeNumber + 1) / 10, 1);
        // Calculate custom factor bonus
        const customBonus = Object.values(customFactors).reduce((sum, factor) => sum + factor, 0);
        const normalizedCustom = Math.min(customBonus, 1);
        // Calculate weighted multiplier
        const rarityComponent = normalizedRarity * this.allocationFactors.rarityWeight;
        const stakeComponent = normalizedStake * this.allocationFactors.stakeWeight;
        const customComponent = normalizedCustom * 0.2; // 20% weight for custom factors
        // Base multiplier of 1.0 plus weighted bonuses
        return 1.0 + rarityComponent + stakeComponent + customComponent;
    }
    calculateAllocatedAmount(stakeAmount, yieldMultiplier) {
        const baseAmount = this.allocationFactors.baseAllocation + stakeAmount;
        const multipliedAmount = (baseAmount * BigInt(Math.floor(yieldMultiplier * 10000))) / 10000n;
        return multipliedAmount;
    }
    extractCustomFactors(metadata) {
        const customFactors = {};
        // Extract factors from metadata attributes
        if (metadata.attributes) {
            for (const attribute of metadata.attributes) {
                const multiplierKey = `${attribute.trait_type}_multiplier`;
                if (this.allocationFactors.customMultipliers[multiplierKey]) {
                    customFactors[multiplierKey] = this.allocationFactors.customMultipliers[multiplierKey];
                }
                // Special handling for rare traits
                if (attribute.trait_type === 'Background' && attribute.value === 'Legendary') {
                    customFactors['legendary_bonus'] = 0.5;
                }
                if (attribute.trait_type === 'Eyes' && attribute.value === 'Diamond') {
                    customFactors['diamond_eyes_bonus'] = 0.3;
                }
            }
        }
        return customFactors;
    }
    calculateAllocationBreakdown(stakeAmount, rarityScore, customFactors) {
        const baseAllocation = this.allocationFactors.baseAllocation;
        // Calculate bonuses
        const rarityBonus = (baseAllocation * BigInt(Math.floor(rarityScore * this.allocationFactors.rarityWeight))) / 100n;
        const stakeNumber = Number(stakeAmount);
        const stakeMultiplier = Math.log10(stakeNumber + 1) / 10;
        const stakeBonus = (baseAllocation * BigInt(Math.floor(stakeMultiplier * this.allocationFactors.stakeWeight * 100))) / 100n;
        const customMultiplier = Object.values(customFactors).reduce((sum, factor) => sum + factor, 0);
        const customBonus = (baseAllocation * BigInt(Math.floor(customMultiplier * 100))) / 100n;
        const totalAllocation = baseAllocation + rarityBonus + stakeBonus + customBonus;
        // Calculate percentage (simplified to avoid floating point in production)
        const allocationPercentage = Number(totalAllocation) / Number(baseAllocation);
        return {
            baseAllocation,
            rarityBonus,
            stakeBonus,
            customBonus,
            totalAllocation,
            allocationPercentage
        };
    }
    recalculateAllAllocations() {
        const currentAllocations = Array.from(this.allocations.values());
        this.allocations.clear();
        for (const allocation of currentAllocations) {
            // Recalculate with new factors (simplified - would need metadata)
            const yieldMultiplier = this.calculateYieldMultiplier(allocation.rarityScore, allocation.stakeAmount, allocation.customFactors);
            const allocatedAmount = this.calculateAllocatedAmount(allocation.stakeAmount, yieldMultiplier);
            this.allocations.set(allocation.tokenId, {
                ...allocation,
                yieldMultiplier,
                allocatedAmount
            });
        }
    }
    calculateRarityRange(nftData) {
        const scores = nftData.map(nft => nft.rarityScore);
        return {
            min: Math.min(...scores),
            max: Math.max(...scores),
            avg: scores.reduce((sum, score) => sum + score, 0) / scores.length
        };
    }
    calculateStakeRange(nftData) {
        const stakes = nftData.map(nft => nft.stakeAmount);
        const min = stakes.reduce((min, stake) => stake < min ? stake : min, stakes[0] || 0n);
        const max = stakes.reduce((max, stake) => stake > max ? stake : max, stakes[0] || 0n);
        const sum = stakes.reduce((sum, stake) => sum + stake, 0n);
        const avg = stakes.length > 0 ? sum / BigInt(stakes.length) : 0n;
        return { min, max, avg };
    }
}
exports.WalletAllocationEngine = WalletAllocationEngine;
/**
 * Factory function to create wallet allocation engine
 */
function createWalletAllocationEngine(allocationFactors) {
    return new WalletAllocationEngine(allocationFactors);
}
/**
 * Default allocation factors
 */
exports.DEFAULT_ALLOCATION_FACTORS = {
    rarityWeight: 0.3,
    stakeWeight: 0.7,
    customMultipliers: {
        'legendary_background': 0.5,
        'diamond_eyes': 0.3,
        'rare_trait': 0.2
    },
    baseAllocation: 1000000000000000000n // 1 token base allocation
};
//# sourceMappingURL=wallet-allocation.js.map