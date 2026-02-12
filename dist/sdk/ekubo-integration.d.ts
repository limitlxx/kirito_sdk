/**
 * Ekubo DEX Integration
 *
 * Production-ready integration with Ekubo DEX for liquidity provision and yield tracking.
 *
 * Documentation: https://docs.ekubo.org/
 * API Reference: https://prod-api.ekubo.org/openapi.json
 *
 * Architecture:
 * - API calls: Read-only data (pools, positions, historical data)
 * - Contract calls: Write operations (add/remove liquidity, claim fees)
 *
 * Features:
 * - OpenAPI-based type-safe client
 * - Rate limit handling with exponential backoff
 * - Caching layer for frequently accessed data
 * - Accurate impermanent loss calculations
 * - Position health monitoring
 */
import { Address, TransactionHash, YieldAmount, TimePeriod } from '../types';
import { Account } from 'starknet';
/**
 * Ekubo liquidity pool information
 */
export interface EkuboPool {
    id: string;
    name: string;
    token0: Address;
    token1: Address;
    fee: number;
    totalLiquidity: bigint;
    volume24h: bigint;
    fees24h: bigint;
    apy: number;
    isActive: boolean;
}
/**
 * Ekubo liquidity position for an NFT wallet
 */
export interface EkuboPosition {
    poolId: string;
    walletAddress: Address;
    liquidity: bigint;
    token0Amount: bigint;
    token1Amount: bigint;
    unclaimedFees0: bigint;
    unclaimedFees1: bigint;
    tickLower: number;
    tickUpper: number;
    lastUpdateTimestamp: number;
}
/**
 * Ekubo yield calculation result
 */
export interface EkuboYieldData {
    poolId: string;
    totalYield: bigint;
    tradingFees: bigint;
    impermanentLoss: bigint;
    netYield: bigint;
    apy: number;
    period: TimePeriod;
}
/**
 * Ekubo liquidity operation parameters
 */
export interface EkuboLiquidityParams {
    poolId: string;
    token0Amount: bigint;
    token1Amount: bigint;
    token0: Address;
    token1: Address;
    walletAddress: Address;
    tickLower?: number;
    tickUpper?: number;
}
/**
 * Ekubo DEX Integration
 *
 * Provides production-ready integration with Ekubo DEX:
 * - Liquidity provision and removal
 * - Real-time yield calculation from trading fees
 * - Position management and impermanent loss tracking
 * - Rate limit handling and caching
 */
export declare class EkuboIntegration {
    private readonly apiBaseUrl;
    private readonly apiKey?;
    private readonly starknetAccount;
    private readonly contractAddress;
    private readonly cache;
    private readonly maxRetries;
    private readonly baseRetryDelay;
    constructor(starknetAccount: Account, contractAddress: Address, apiBaseUrl?: string, apiKey?: string);
    /**
     * Get all available liquidity pools with caching and rate limit handling
     */
    getLiquidityPools(): Promise<EkuboPool[]>;
    /**
     * Get liquidity position for a specific NFT wallet with caching
     */
    getLiquidityPosition(walletAddress: Address, poolId?: string): Promise<EkuboPosition[]>;
    /**
     * Add liquidity to Ekubo pool from NFT wallet
     */
    addLiquidity(params: EkuboLiquidityParams): Promise<TransactionHash>;
    /**
     * Remove liquidity from Ekubo pool to NFT wallet
     */
    removeLiquidity(params: EkuboLiquidityParams): Promise<TransactionHash>;
    /**
     * Claim trading fees from liquidity positions
     */
    claimTradingFees(walletAddress: Address, poolId: string): Promise<TransactionHash>;
    /**
     * Calculate real-time yield from Ekubo trading fees
     */
    calculateTradingYield(walletAddress: Address, poolId: string, period: TimePeriod): Promise<EkuboYieldData>;
    /**
     * Get aggregated yield from all Ekubo positions for a wallet
     */
    getAggregatedYield(walletAddress: Address, period: TimePeriod): Promise<YieldAmount>;
    /**
     * Monitor liquidity position health and calculate real impermanent loss
     */
    monitorPositionHealth(walletAddress: Address): Promise<{
        totalValue: bigint;
        impermanentLoss: bigint;
        impermanentLossPercentage: number;
        riskLevel: 'low' | 'medium' | 'high';
        recommendations: string[];
    }>;
    /**
     * Get optimal liquidity pools based on current APY
     */
    getOptimalLiquidityPools(token0: Address, token1: Address, minLiquidity: bigint): Promise<EkuboPool[]>;
    /**
     * Execute automatic liquidity optimization
     */
    optimizeLiquidityAllocation(walletAddress: Address, token0: Address, token1: Address, token0Amount: bigint, token1Amount: bigint): Promise<{
        allocations: Array<{
            poolId: string;
            token0Amount: bigint;
            token1Amount: bigint;
            expectedAPY: number;
        }>;
        totalExpectedYield: bigint;
        txHash?: TransactionHash;
    }>;
    private makeApiCall;
    private isRateLimitError;
    private getRetryAfter;
    private sleep;
    private getMockLiquidityPools;
    private calculateFallbackYield;
}
/**
 * Factory function to create Ekubo integration instance
 */
export declare function createEkuboIntegration(starknetAccount: Account, contractAddress: Address, apiBaseUrl?: string, apiKey?: string): EkuboIntegration;
//# sourceMappingURL=ekubo-integration.d.ts.map