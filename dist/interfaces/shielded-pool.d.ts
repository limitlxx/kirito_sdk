import { Address, TokenId, TransactionHash, ShieldedNote, EncryptedBalance, YieldAmount, TimePeriod, ZKProof } from '../types';
/**
 * Shielded Pool Manager Interface
 * Handles privacy-preserving staking using Tongo protocol
 */
export interface ShieldedPoolManager {
    /**
     * Deposit tokens into shielded pool
     */
    deposit(amount: bigint, token: Address): Promise<ShieldedNote>;
    /**
     * Withdraw tokens from shielded pool
     */
    withdraw(note: ShieldedNote, amount: bigint): Promise<TransactionHash>;
    /**
     * Transfer within shielded pool
     */
    transfer(from: ShieldedNote, to: Address, amount: bigint): Promise<ShieldedNote>;
    /**
     * Get encrypted balance
     */
    getShieldedBalance(note: ShieldedNote): Promise<EncryptedBalance>;
    /**
     * Verify note validity
     */
    verifyNote(note: ShieldedNote): Promise<boolean>;
}
/**
 * Yield Distributor Interface
 * Handles yield calculation and distribution
 */
export interface YieldDistributor {
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
}
export interface YieldSource {
    id: string;
    name: string;
    endpoint: string;
    weight: number;
    isActive: boolean;
}
//# sourceMappingURL=shielded-pool.d.ts.map