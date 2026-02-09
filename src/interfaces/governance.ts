import {
  ProposalId,
  VoteId,
  GroupId,
  Proposal,
  VoteResults,
  Signal,
  SemaphoreProof,
  Commitment,
  Identity
} from '../types';

/**
 * Anonymous Governance Interface
 * Handles Semaphore-based anonymous voting and signaling
 */
export interface AnonymousGovernance {
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
}

/**
 * Semaphore Manager Interface
 * Handles Semaphore protocol operations
 */
export interface SemaphoreManager {
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
}