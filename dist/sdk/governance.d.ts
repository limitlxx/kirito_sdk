import { ProposalId, VoteId, GroupId, Proposal, VoteResults, Signal, SemaphoreProof, Commitment, Identity, KiritoSDKConfig, SignalId, PrivateSignal, SignalType, SignalResults, AggregatedSignals } from '../types';
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
    private signals;
    private signalsByScope;
    private signalsByType;
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
    /**
     * Send anonymous signal for governance decisions
     */
    sendSignal(signal: PrivateSignal, proof: SemaphoreProof): Promise<SignalId>;
    /**
     * Aggregate signals by type and scope
     */
    aggregateSignals(signalType: SignalType, scope: string): Promise<AggregatedSignals>;
    /**
     * Get signal results for a specific scope
     */
    getSignalResults(scope: string): Promise<SignalResults>;
    /**
     * Verify signal authenticity
     */
    verifySignal(signalId: SignalId, proof: SemaphoreProof): Promise<boolean>;
    private generateSignalId;
    private encodeSignalMessage;
    private checkDuplicateSignal;
    private performAggregation;
    private aggregateYieldStrategySignals;
    private aggregateRevealTimingSignals;
    private aggregateCollectionDecisionSignals;
    private aggregateParameterAdjustmentSignals;
    private aggregateCustomSignals;
    private aggregateGenericSignals;
    private calculateConsensus;
    private recordSignalOnChain;
    private generateProposalId;
    private validateProposalType;
    private finalizeResultsByType;
    private finalizeBinaryResults;
    private finalizeMultipleChoiceResults;
    private finalizeWeightedResults;
    private finalizeRankedChoiceResults;
    private finalizeQuadraticResults;
    private generateVoteId;
    private parseVoteSignal;
    private checkDoubleVoting;
    private updateVoteResults;
    private getStakeWeight;
    private getRarityWeight;
    private registerProposalOnChain;
    private recordVoteOnChainWithProof;
    private recordVoteOnChain;
    private recordFinalResultsOnChain;
}
/**
 * Semaphore Manager SDK Implementation
 * Handles Semaphore protocol operations with Cairo contract integration
 */
export declare class SemaphoreManagerSDK implements SemaphoreManager {
    private config;
    private groups;
    private nullifiers;
    private contractAddress?;
    constructor(config: KiritoSDKConfig);
    /**
     * Add member to Semaphore group
     */
    addMember(groupId: GroupId, commitment: Commitment): Promise<void>;
    /**
     * Generate Semaphore proof with Cairo contract integration
     */
    generateProof(identity: Identity, signal: Signal, groupId: GroupId): Promise<SemaphoreProof>;
    /**
     * Verify Semaphore proof using Cairo contract
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
    private createGroupOnChain;
    private addMemberOnChain;
    private removeMemberOnChain;
    private verifyMembershipOnChain;
    private getGroupSizeFromContract;
    private getMerkleRootFromContract;
    private verifyProofOnChain;
    private markNullifierUsedOnChain;
    private generateZKProof;
    private verifyProofLocally;
    private validateProofStructure;
    private calculateMerkleRoot;
    private buildMerkleTree;
    private poseidonHash;
    private generateNullifierHash;
    private generateExternalNullifier;
    private registerGroupOnChain;
    private registerMemberOnChain;
}
//# sourceMappingURL=governance.d.ts.map