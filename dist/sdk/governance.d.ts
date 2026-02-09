import { ProposalId, VoteId, GroupId, Proposal, VoteResults, Signal, SemaphoreProof, Commitment, Identity, KiritoSDKConfig } from '../types';
import { AnonymousGovernance, SemaphoreManager } from '../interfaces';
/**
 * Anonymous Governance SDK Implementation
 * Handles Semaphore-based anonymous voting and signaling
 */
export declare class AnonymousGovernanceSDK implements AnonymousGovernance {
    private config;
    private semaphoreManager;
    private proposals;
    private votes;
    private voteResults;
    constructor(config: KiritoSDKConfig);
    /**
     * Create new governance proposal
     */
    createProposal(proposal: Proposal, groupId: GroupId): Promise<ProposalId>;
    /**
     * Vote on proposal anonymously
     */
    vote(signal: Signal, proof: SemaphoreProof): Promise<VoteId>;
    /**
     * Verify group membership
     */
    verifyMembership(commitment: Commitment, groupId: GroupId): Promise<boolean>;
    /**
     * Tally votes for proposal
     */
    tallyVotes(proposalId: ProposalId): Promise<VoteResults>;
    /**
     * Get proposal details
     */
    getProposal(proposalId: ProposalId): Promise<Proposal>;
    /**
     * Check if proposal is active
     */
    isProposalActive(proposalId: ProposalId): Promise<boolean>;
    /**
     * Get all active proposals
     */
    getActiveProposals(): Promise<Proposal[]>;
    /**
     * Get Semaphore Manager instance
     */
    getSemaphoreManager(): SemaphoreManager;
    private generateProposalId;
    private generateVoteId;
    private parseVoteSignal;
    private checkDoubleVoting;
    private updateVoteResults;
    private getStakeWeight;
    private getRarityWeight;
    private registerProposalOnChain;
    private recordVoteOnChain;
    private recordFinalResultsOnChain;
}
/**
 * Semaphore Manager SDK Implementation
 * Handles Semaphore protocol operations
 */
export declare class SemaphoreManagerSDK implements SemaphoreManager {
    private config;
    private groups;
    private nullifiers;
    constructor(config: KiritoSDKConfig);
    /**
     * Add member to Semaphore group
     */
    addMember(groupId: GroupId, commitment: Commitment): Promise<void>;
    /**
     * Generate Semaphore proof
     */
    generateProof(identity: Identity, signal: Signal, groupId: GroupId): Promise<SemaphoreProof>;
    /**
     * Verify Semaphore proof
     */
    verifyProof(proof: SemaphoreProof, signal: Signal, groupId: GroupId): Promise<boolean>;
    /**
     * Create new Semaphore group
     */
    createGroup(groupId: GroupId): Promise<void>;
    /**
     * Get group size
     */
    getGroupSize(groupId: GroupId): Promise<number>;
    /**
     * Remove member from group
     */
    removeMember(groupId: GroupId, commitment: Commitment): Promise<void>;
    /**
     * Verify membership in group
     */
    verifyMembership(commitment: Commitment, groupId: GroupId): Promise<boolean>;
    /**
     * Get all groups
     */
    getAllGroups(): GroupId[];
    private calculateMerkleRoot;
    private generateNullifierHash;
    private generateExternalNullifier;
    private registerGroupOnChain;
    private registerMemberOnChain;
    private removeMemberOnChain;
}
//# sourceMappingURL=governance.d.ts.map