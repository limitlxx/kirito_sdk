import { Address, TokenId, TransactionHash, ShieldedNote, EncryptedBalance, YieldAmount, TimePeriod, ZKProof, KiritoSDKConfig, StakingInfo, AggregatedYield, StakingStatistics } from '../types';
import { ShieldedPoolManager, YieldDistributor, YieldSource } from '../interfaces';
import { ZKProofManager } from '../utils/zk-proof-manager';
import { DeFiYieldAggregator } from './defi-yield-aggregator';
import { Account } from 'starknet';
/**
 * Shielded Pool Manager SDK Implementation
 * Provides TypeScript implementation for privacy-preserving staking using Tongo protocol
 */
export declare class ShieldedPoolManagerSDK implements ShieldedPoolManager {
    private config;
    private yieldDistributor;
    private tongoIntegration;
    private starknetAccount;
    constructor(config: KiritoSDKConfig, starknetAccount: Account);
    /**
     * Initialize the shielded pool manager
     */
    initialize(tongoPrivateKey: string): Promise<void>;
    /**
     * Deposit tokens into shielded pool using Tongo fund operation
     */
    deposit(amount: bigint, token: Address): Promise<ShieldedNote>;
    /**
     * Withdraw tokens from shielded pool using Tongo withdraw operation
     */
    withdraw(note: ShieldedNote, amount: bigint): Promise<TransactionHash>;
    /**
     * Transfer within shielded pool using Tongo transfer operation
     */
    transfer(from: ShieldedNote, to: Address, amount: bigint): Promise<ShieldedNote>;
    /**
     * Get encrypted balance using real Tongo SDK with enhanced display
     */
    getShieldedBalance(note: ShieldedNote): Promise<EncryptedBalance>;
    /**
     * Get encrypted balance display for UI
     */
    getEncryptedBalanceDisplay(tokenAddress: Address): Promise<{
        hasBalance: boolean;
        encryptedDisplay: string;
        canDecrypt: boolean;
        decryptedDisplay?: string;
        lastUpdated: number;
    }>;
    /**
     * Generate proof of balance ownership without revealing amount
     */
    generateBalanceProof(tokenAddress: Address, minimumAmount?: bigint): Promise<{
        proof: Uint8Array;
        publicInputs: Uint8Array[];
        canProveOwnership: boolean;
    }>;
    /**
     * Query all encrypted balances for the current account
     */
    queryAllBalances(): Promise<Map<Address, {
        encryptedBalance: string;
        canDecrypt: boolean;
        decryptedAmount?: bigint;
    }>>;
    /**
     * Generate viewing key for balance auditing
     */
    generateViewingKey(tokenAddress: Address): Promise<{
        viewingKey: string;
        expiresAt?: number;
    }>;
    /**
     * Verify note validity (simplified for Tongo integration)
     */
    verifyNote(note: ShieldedNote): Promise<boolean>;
    /**
     * Get yield distributor instance
     */
    getYieldDistributor(): YieldDistributor;
    private generateCommitment;
    private generateNullifier;
    private createEncryptedAmount;
}
/**
 * Yield Calculation Engine
 * Core engine for calculating proportional yields based on stake and rarity
 */
export declare class YieldCalculationEngine {
    private config;
    private yieldSources;
    private stakingData;
    private totalStakedAmount;
    private totalRarityWeight;
    private defiAggregator?;
    constructor(config: KiritoSDKConfig);
    /**
     * Calculate proportional yield for a specific NFT based on stake and rarity
     */
    calculateProportionalYield(tokenId: TokenId, stakingAmount: bigint, rarityScore: number, yieldMultiplier: number, totalYieldPool: bigint): Promise<bigint>;
    /**
     * Aggregate yields from multiple sources with weighted distribution
     * Uses the unified DeFi aggregator for better yield optimization
     */
    aggregateMultiSourceYields(period: TimePeriod): Promise<AggregatedYield>;
    /**
     * Update staking information for yield calculations
     */
    updateStakingInfo(tokenId: TokenId, stakingInfo: StakingInfo): void;
    /**
     * Add or update yield source
     */
    addYieldSource(source: YieldSource): void;
    /**
     * Remove yield source
     */
    removeYieldSource(sourceId: string): boolean;
    /**
     * Get all yield sources
     */
    getYieldSources(): YieldSource[];
    /**
     * Get DeFi aggregator instance for advanced operations
     */
    getDeFiAggregator(): DeFiYieldAggregator | undefined;
    /**
     * Get staking statistics
     */
    getStakingStatistics(): StakingStatistics;
    private fetchYieldFromSource;
    private fetchDeFiYield;
    private fetchRWAYield;
    private fetchGenericYield;
}
/**
 * Yield Distributor SDK Implementation
 * Handles yield calculation and distribution for shielded pools
 */
export declare class YieldDistributorSDK implements YieldDistributor {
    private config;
    private yieldEngine;
    private zkProofManager;
    constructor(config: KiritoSDKConfig);
    /**
     * Calculate yield for specific NFT using the enhanced yield engine
     */
    calculateYield(tokenId: TokenId, period: TimePeriod): Promise<YieldAmount>;
    /**
     * Distribute yields to multiple recipients
     */
    distributeYields(recipients: TokenId[], amounts: YieldAmount[]): Promise<TransactionHash>;
    /**
     * Claim yield with zero-knowledge proof
     * Verifies eligibility without revealing private staking information
     */
    claimYield(tokenId: TokenId, proof: ZKProof): Promise<TransactionHash>;
    /**
     * Generate zero-knowledge proof for yield claim
     * Creates a proof that the user is eligible for the specified yield amount
     */
    generateYieldClaimProof(tokenId: TokenId, claimAmount: bigint, stakingNote: ShieldedNote): Promise<ZKProof>;
    /**
     * Verify yield eligibility without claiming
     * Allows users to check if they are eligible for yield without actually claiming
     */
    verifyYieldEligibility(tokenId: TokenId, stakingNote: ShieldedNote, minimumYield: bigint): Promise<boolean>;
    /**
     * Batch claim yields for multiple NFTs
     * Efficiently processes multiple yield claims in a single transaction
     */
    batchClaimYields(claims: Array<{
        tokenId: TokenId;
        proof: ZKProof;
    }>): Promise<TransactionHash>;
    /**
     * Get ZK proof manager instance for advanced operations
     */
    getZKProofManager(): ZKProofManager;
    /**
     * Get total yield available using the yield engine
     */
    getTotalYield(period: TimePeriod): Promise<YieldAmount>;
    /**
     * Add yield source using the yield engine
     */
    addYieldSource(source: YieldSource): Promise<void>;
    /**
     * Get all yield sources from the yield engine
     */
    getYieldSources(): YieldSource[];
    /**
     * Remove yield source using the yield engine
     */
    removeYieldSource(sourceId: string): void;
    /**
     * Get staking statistics from the yield engine
     */
    getStakingStatistics(): StakingStatistics;
    /**
     * Get yield engine instance for advanced operations
     */
    getYieldEngine(): YieldCalculationEngine;
    private initializeDefaultYieldSources;
    private getStakingAmount;
    private extractClaimAmountFromProof;
    private executeYieldClaim;
    private executeBatchYieldClaim;
    private bytesToBigInt;
    private getNFTMetadata;
    private verifyYieldProof;
    private testYieldSourceConnectivity;
    private executeContractCall;
    private hexToUint8Array;
}
//# sourceMappingURL=shielded-pool.d.ts.map