/**
 * Unified DeFi Yield Aggregator
 *
 * Aggregates yields from multiple DeFi protocols (Vesu, Ekubo) with
 * weighted distribution, health monitoring, and yield optimization.
 *
 * Note: Atomiq is a cross-chain swap protocol and is NOT included as a yield source.
 */
import { Address, TransactionHash, TimePeriod, KiritoSDKConfig } from '../types';
import { Account } from 'starknet';
/**
 * DeFi protocol types
 */
export declare enum DeFiProtocol {
    VESU = "vesu",
    EKUBO = "ekubo"
}
/**
 * Protocol configuration
 */
export interface ProtocolConfig {
    protocol: DeFiProtocol;
    weight: number;
    isActive: boolean;
    contractAddress: Address;
    apiEndpoint: string;
    apiKey?: string;
    healthThreshold: number;
}
/**
 * Aggregated yield data from all protocols
 */
export interface AggregatedDeFiYield {
    totalYield: bigint;
    protocolBreakdown: ProtocolYieldBreakdown[];
    period: TimePeriod;
    aggregationTimestamp: number;
    healthScore: number;
}
/**
 * Individual protocol yield breakdown
 */
export interface ProtocolYieldBreakdown {
    protocol: DeFiProtocol;
    protocolName: string;
    rawYield: bigint;
    weightedYield: bigint;
    weight: number;
    healthScore: number;
    isHealthy: boolean;
    token: Address;
    apy: number;
}
/**
 * Protocol health status
 */
export interface ProtocolHealth {
    protocol: DeFiProtocol;
    isHealthy: boolean;
    healthScore: number;
    issues: string[];
    recommendations: string[];
    lastChecked: number;
}
/**
 * Yield optimization recommendation
 */
export interface YieldOptimization {
    currentAPY: number;
    optimizedAPY: number;
    rebalanceRecommendations: Array<{
        protocol: DeFiProtocol;
        currentWeight: number;
        recommendedWeight: number;
        reason: string;
    }>;
    estimatedGasForRebalance: bigint;
    estimatedTimeToBreakeven: number;
}
/**
 * Unified DeFi Yield Aggregator
 *
 * Combines yields from Vesu and Ekubo with intelligent weighting,
 * health monitoring, and automatic optimization recommendations.
 *
 * Note: Atomiq is NOT included as it's a cross-chain swap protocol, not a yield source.
 */
export declare class DeFiYieldAggregator {
    private config;
    private starknetAccount;
    private protocols;
    private integrations;
    private healthCache;
    private healthCacheExpiry;
    constructor(config: KiritoSDKConfig, starknetAccount: Account);
    /**
     * Add or update protocol configuration
     */
    addProtocol(protocolConfig: ProtocolConfig): void;
    /**
     * Remove protocol from aggregation
     */
    removeProtocol(protocol: DeFiProtocol): boolean;
    /**
     * Get aggregated yield from all active and healthy protocols
     */
    getAggregatedYield(walletAddress: Address, period: TimePeriod): Promise<AggregatedDeFiYield>;
    /**
     * Monitor health of all protocols
     */
    monitorProtocolHealth(): Promise<Map<DeFiProtocol, ProtocolHealth>>;
    /**
     * Get yield optimization recommendations
     */
    getYieldOptimizationRecommendations(walletAddress: Address, period: TimePeriod): Promise<YieldOptimization>;
    /**
     * Execute automatic rebalancing based on optimization recommendations
     */
    executeRebalancing(walletAddress: Address, optimization: YieldOptimization): Promise<TransactionHash[]>;
    /**
     * Get protocol configurations
     */
    getProtocolConfigurations(): Map<DeFiProtocol, ProtocolConfig>;
    /**
     * Update protocol weights
     */
    updateProtocolWeights(weights: Map<DeFiProtocol, number>): void;
    private initializeDefaultProtocols;
    private initializeIntegrations;
    private initializeProtocolIntegration;
    private getProtocolYield;
    private checkProtocolHealth;
    private getProtocolAPY;
    private getProtocolName;
    private executeRebalanceTransaction;
}
/**
 * Factory function to create DeFi yield aggregator
 */
export declare function createDeFiYieldAggregator(config: KiritoSDKConfig, starknetAccount: Account): DeFiYieldAggregator;
//# sourceMappingURL=defi-yield-aggregator.d.ts.map