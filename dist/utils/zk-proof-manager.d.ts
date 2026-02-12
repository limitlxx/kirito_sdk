/**
 * Zero-Knowledge Proof Manager for Yield Claims
 * Handles ZK proof generation and verification for private yield claiming
 */
import { TokenId, ZKProof, ShieldedNote, KiritoSDKConfig } from '../types';
/**
 * Yield Claim Proof Data
 * Contains the private inputs needed to generate a yield claim proof
 */
export interface YieldClaimProofData {
    tokenId: TokenId;
    stakedAmount: bigint;
    rarityScore: number;
    yieldMultiplier: number;
    claimAmount: bigint;
    stakingNote: ShieldedNote;
    lastClaimTimestamp: number;
}
/**
 * Yield Eligibility Public Inputs
 * Public inputs that can be verified without revealing private data
 */
export interface YieldEligibilityPublicInputs {
    tokenId: TokenId;
    claimAmount: bigint;
    merkleRoot: string;
    nullifierHash: string;
    currentTimestamp: number;
}
/**
 * ZK Circuit for Yield Claims
 * Defines the zero-knowledge circuit logic for yield eligibility
 */
export interface YieldClaimCircuit {
    stakedAmount: bigint;
    rarityScore: number;
    yieldMultiplier: number;
    stakingSecret: Uint8Array;
    merkleProof: string[];
    tokenId: TokenId;
    claimAmount: bigint;
    merkleRoot: string;
    nullifierHash: string;
    minStakeThreshold: bigint;
    currentTimestamp: number;
}
/**
 * Zero-Knowledge Proof Manager
 * Handles proof generation and verification for yield claims
 */
export declare class ZKProofManager {
    private config;
    private usedNullifiers;
    constructor(config: KiritoSDKConfig);
    /**
     * Generate zero-knowledge proof for yield claim eligibility
     * Proves that the claimant is eligible for the yield without revealing:
     * - Actual staked amount
     * - Rarity score
     * - Yield multiplier
     * - Staking secret
     */
    generateYieldClaimProof(proofData: YieldClaimProofData): Promise<ZKProof>;
    /**
     * Verify zero-knowledge proof for yield claim
     * Verifies that the proof is valid without learning private information
     */
    verifyYieldClaimProof(tokenId: TokenId, claimAmount: bigint, proof: ZKProof): Promise<boolean>;
    /**
     * Generate proof for yield eligibility without claiming
     * Allows users to prove they are eligible for yield without actually claiming it
     */
    generateEligibilityProof(tokenId: TokenId, stakingNote: ShieldedNote, minimumYield: bigint): Promise<ZKProof>;
    /**
     * Batch verify multiple yield claim proofs
     * Efficiently verifies multiple proofs in a single operation
     */
    batchVerifyYieldClaims(claims: Array<{
        tokenId: TokenId;
        claimAmount: bigint;
        proof: ZKProof;
    }>): Promise<boolean[]>;
    /**
     * Get used nullifiers (for debugging/monitoring)
     */
    getUsedNullifiers(): string[];
    /**
     * Clear used nullifiers (for testing purposes)
     */
    clearUsedNullifiers(): void;
    private validateProofData;
    private generateNullifier;
    private deriveStakingSecret;
    private generateStakingMerkleProof;
    private generateCircuitProof;
    private verifyCircuitProof;
    private extractPublicInputs;
    private verifyMerkleRoot;
    private bigIntToBytes;
    private bytesToBigInt;
}
//# sourceMappingURL=zk-proof-manager.d.ts.map