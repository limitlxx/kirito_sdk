import { Address, TokenId, TransactionHash, ShieldedNote, EncryptedBalance, YieldAmount, TimePeriod, ZKProof, KiritoSDKConfig } from '../types';
import { ShieldedPoolManager, YieldDistributor, YieldSource } from '../interfaces';
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
     * Get encrypted balance using Tongo SDK
     */
    getShieldedBalance(note: ShieldedNote): Promise<EncryptedBalance>;
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
 * Yield Distributor SDK Implementation
 * Handles yield calculation and distribution for shielded pools
 */
export declare class YieldDistributorSDK implements YieldDistributor {
    private config;
    private yieldSources;
    constructor(config: KiritoSDKConfig);
    /**
     * Calculate yield for specific NFT
     */
    calculateYield(tokenId: TokenId, period: TimePeriod): Promise<YieldAmount>;
    /**
     * Distribute yields to multiple recipients
     */
    distributeYields(recipients: TokenId[], amounts: YieldAmount[]): Promise<TransactionHash>;
    /**
     * Claim yield with zero-knowledge proof
     */
    claimYield(tokenId: TokenId, proof: ZKProof): Promise<TransactionHash>;
    /**
     * Get total yield available
     */
    getTotalYield(period: TimePeriod): Promise<YieldAmount>;
    /**
     * Add yield source
     */
    addYieldSource(source: YieldSource): Promise<void>;
    /**
     * Get all yield sources
     */
    getYieldSources(): YieldSource[];
    /**
     * Remove yield source
     */
    removeYieldSource(sourceId: string): void;
    private initializeDefaultYieldSources;
    private getNFTMetadata;
    private calculateProportionalYield;
    private verifyYieldProof;
    private getYieldFromSource;
    private testYieldSourceConnectivity;
    private executeContractCall;
}
//# sourceMappingURL=shielded-pool.d.ts.map