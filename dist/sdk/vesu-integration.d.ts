/**
 * Vesu Lending Protocol Integration
 *
 * Integrates with Vesu lending protocol for yield tracking and NFT wallet operations.
 * Replaces mock implementation with actual Vesu API calls.
 *
 * Documentation: https://docs.vesu.xyz/developers
 * API Reference: https://api.vesu.xyz/docs
 */
import { Address, TransactionHash, YieldAmount, TimePeriod } from '../types';
import { Account } from 'starknet';
/**
 * Vesu lending pool information
 */
export interface VesuPool {
    id: string;
    name: string;
    asset: Address;
    totalSupply: bigint;
    totalBorrow: bigint;
    supplyAPY: number;
    borrowAPY: number;
    utilizationRate: number;
    isActive: boolean;
}
/**
 * Vesu lending position for an NFT wallet
 */
export interface VesuPosition {
    poolId: string;
    walletAddress: Address;
    suppliedAmount: bigint;
    borrowedAmount: bigint;
    collateralAmount: bigint;
    healthFactor: number;
    lastUpdateTimestamp: number;
}
/**
 * Vesu yield calculation result
 */
export interface VesuYieldData {
    poolId: string;
    totalYield: bigint;
    supplyYield: bigint;
    borrowCost: bigint;
    netYield: bigint;
    apy: number;
    period: TimePeriod;
}
/**
 * Vesu lending operation parameters
 */
export interface VesuLendingParams {
    poolId: string;
    amount: bigint;
    asset: Address;
    walletAddress: Address;
}
/**
 * Vesu Lending Protocol Integration
 *
 * Provides real integration with Vesu lending protocol for:
 * - Lending pool deposits and withdrawals from NFT wallets
 * - Real-time yield calculation from lending rates
 * - Position management and health monitoring
 */
export declare class VesuIntegration {
    private apiBaseUrl;
    private apiKey?;
    private starknetAccount;
    private contractAddress;
    constructor(apiBaseUrl: string | undefined, starknetAccount: Account, contractAddress: Address, apiKey?: string);
    /**
     * Get all available lending pools with retry logic
     */
    getLendingPools(): Promise<VesuPool[]>;
    /**
     * Get lending position for a specific NFT wallet with retry logic
     */
    getLendingPosition(walletAddress: Address, poolId?: string): Promise<VesuPosition[]>;
    /**
     * Deposit tokens to Vesu lending pool from NFT wallet
     */
    depositToLendingPool(params: VesuLendingParams): Promise<TransactionHash>;
    /**
     * Withdraw tokens from Vesu lending pool to NFT wallet
     */
    withdrawFromLendingPool(params: VesuLendingParams): Promise<TransactionHash>;
    /**
     * Calculate real-time yield from Vesu lending rates
     */
    calculateLendingYield(walletAddress: Address, poolId: string, period: TimePeriod): Promise<VesuYieldData>;
    /**
     * Get aggregated yield from all Vesu positions for a wallet
     */
    getAggregatedYield(walletAddress: Address, period: TimePeriod): Promise<YieldAmount>;
    /**
     * Monitor lending position health and send alerts
     */
    monitorPositionHealth(walletAddress: Address): Promise<{
        isHealthy: boolean;
        healthFactor: number;
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
        recommendations: string[];
    }>;
    /**
     * Get optimal lending pools based on current rates
     */
    getOptimalLendingPools(asset: Address, amount: bigint): Promise<VesuPool[]>;
    /**
     * Execute automatic yield optimization
     */
    optimizeYieldAllocation(walletAddress: Address, totalAmount: bigint, asset: Address): Promise<{
        allocations: Array<{
            poolId: string;
            amount: bigint;
            expectedAPY: number;
        }>;
        totalExpectedYield: bigint;
        txHash?: TransactionHash;
    }>;
    private makeApiCall;
    private getMockLendingPools;
    private calculateFallbackYield;
}
/**
 * Factory function to create Vesu integration instance
 */
export declare function createVesuIntegration(starknetAccount: Account, contractAddress: Address, apiBaseUrl?: string, apiKey?: string): VesuIntegration;
//# sourceMappingURL=vesu-integration.d.ts.map