import {
  ProposalId,
  VoteId,
  GroupId,
  Proposal,
  VoteResults,
  Signal,
  SemaphoreProof,
  Commitment,
  Identity,
  KiritoSDKConfig,
  VotingPowerType,
  Timestamp,
  Address
} from '../types';

import { AnonymousGovernance, SemaphoreManager } from '../interfaces';

/**
 * Anonymous Governance SDK Implementation
 * Handles Semaphore-based anonymous voting and signaling
 */
export class AnonymousGovernanceSDK implements AnonymousGovernance {
  private config: KiritoSDKConfig;
  private semaphoreManager: SemaphoreManagerSDK;
  private proposals: Map<ProposalId, Proposal> = new Map();
  private votes: Map<VoteId, { proposalId: ProposalId; signal: Signal; proof: SemaphoreProof }> = new Map();
  private voteResults: Map<ProposalId, VoteResults> = new Map();

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    this.semaphoreManager = new SemaphoreManagerSDK(config);
  }

  /**
   * Create new governance proposal
   */
  async createProposal(proposal: Proposal, groupId: GroupId): Promise<ProposalId> {
    try {
      // Validate proposal
      if (!proposal.title || !proposal.description || proposal.options.length === 0) {
        throw new Error('Invalid proposal: missing required fields');
      }

      // Verify group exists
      const groupSize = await this.semaphoreManager.getGroupSize(groupId);
      if (groupSize === 0) {
        throw new Error(`Semaphore group does not exist: ${groupId}`);
      }

      // Generate unique proposal ID
      const proposalId = this.generateProposalId();
      
      // Set proposal ID and group
      const fullProposal: Proposal = {
        ...proposal,
        id: proposalId,
        groupId
      };

      // Store proposal
      this.proposals.set(proposalId, fullProposal);

      // Initialize vote results
      const initialResults: VoteResults = {
        proposalId,
        totalVotes: 0,
        results: {},
        isFinalized: false
      };
      
      // Initialize results for each option
      proposal.options.forEach(option => {
        initialResults.results[option] = 0;
      });
      
      this.voteResults.set(proposalId, initialResults);

      // Register proposal on-chain
      const txHash = await this.registerProposalOnChain(fullProposal);
      
      console.log(`Governance proposal created: ${proposalId}, tx: ${txHash}`);
      return proposalId;
    } catch (error) {
      throw new Error(`Failed to create proposal: ${error}`);
    }
  }

  /**
   * Vote on proposal anonymously
   */
  async vote(signal: Signal, proof: SemaphoreProof): Promise<VoteId> {
    try {
      // Parse signal to extract proposal ID and vote choice
      const voteData = this.parseVoteSignal(signal);
      const proposalId = voteData.proposalId;
      const choice = voteData.choice;

      // Verify proposal exists and is active
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      const isActive = await this.isProposalActive(proposalId);
      if (!isActive) {
        throw new Error(`Proposal is not active: ${proposalId}`);
      }

      // Verify Semaphore proof using enhanced verification
      const isValidProof = await this.semaphoreManager.verifyProof(proof, signal, proposal.groupId);
      if (!isValidProof) {
        throw new Error('Invalid Semaphore proof');
      }

      // Check for double voting using nullifier (additional check)
      const hasVoted = await this.checkDoubleVoting(proof.nullifierHash, proposalId);
      if (hasVoted) {
        throw new Error('Double voting detected');
      }

      // Generate vote ID
      const voteId = this.generateVoteId();

      // Store vote
      this.votes.set(voteId, {
        proposalId,
        signal,
        proof
      });

      // Update vote results
      await this.updateVoteResults(proposalId, choice, proposal.votingPower);

      // Record vote on-chain with Semaphore proof
      const txHash = await this.recordVoteOnChainWithProof(voteId, proposalId, proof);
      
      console.log(`Anonymous vote cast: ${voteId} for proposal ${proposalId}, tx: ${txHash}`);
      return voteId;
    } catch (error) {
      throw new Error(`Failed to cast vote: ${error}`);
    }
  }

  /**
   * Verify group membership
   */
  async verifyMembership(commitment: Commitment, groupId: GroupId): Promise<boolean> {
    try {
      // Delegate to Semaphore manager
      return await this.semaphoreManager.verifyMembership(commitment, groupId);
    } catch (error) {
      console.error(`Failed to verify membership: ${error}`);
      return false;
    }
  }

  /**
   * Tally votes for proposal
   */
  async tallyVotes(proposalId: ProposalId): Promise<VoteResults> {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      // Get current vote results
      let results = this.voteResults.get(proposalId);
      if (!results) {
        throw new Error(`Vote results not found for proposal: ${proposalId}`);
      }

      // Check if proposal deadline has passed
      const currentTime = Date.now();
      const isExpired = currentTime > proposal.deadline;

      // Finalize results if deadline passed and not already finalized
      if (isExpired && !results.isFinalized) {
        results.isFinalized = true;
        this.voteResults.set(proposalId, results);
        
        // Record final results on-chain
        await this.recordFinalResultsOnChain(proposalId, results);
        console.log(`Proposal ${proposalId} results finalized`);
      }

      return { ...results }; // Return copy to prevent external modification
    } catch (error) {
      throw new Error(`Failed to tally votes: ${error}`);
    }
  }

  /**
   * Get proposal details
   */
  async getProposal(proposalId: ProposalId): Promise<Proposal> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }
    return { ...proposal }; // Return copy to prevent external modification
  }

  /**
   * Check if proposal is active
   */
  async isProposalActive(proposalId: ProposalId): Promise<boolean> {
    try {
      const proposal = this.proposals.get(proposalId);
      if (!proposal) {
        return false;
      }

      const currentTime = Date.now();
      return currentTime < proposal.deadline;
    } catch (error) {
      console.error(`Failed to check proposal status: ${error}`);
      return false;
    }
  }

  /**
   * Get all active proposals
   */
  async getActiveProposals(): Promise<Proposal[]> {
    const activeProposals: Proposal[] = [];
    const currentTime = Date.now();

    for (const proposal of this.proposals.values()) {
      if (currentTime < proposal.deadline) {
        activeProposals.push({ ...proposal });
      }
    }

    return activeProposals;
  }

  /**
   * Get Semaphore Manager instance
   */
  getSemaphoreManager(): SemaphoreManager {
    return this.semaphoreManager;
  }

  // Private helper methods

  private generateProposalId(): ProposalId {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `proposal_${timestamp}_${random}`;
  }

  private generateVoteId(): VoteId {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `vote_${timestamp}_${random}`;
  }

  private parseVoteSignal(signal: Signal): { proposalId: ProposalId; choice: string } {
    try {
      // Parse signal message to extract vote data
      const parts = signal.message.split('|');
      if (parts.length !== 2) {
        throw new Error('Invalid vote signal format');
      }

      return {
        proposalId: parts[0],
        choice: parts[1]
      };
    } catch (error) {
      throw new Error(`Failed to parse vote signal: ${error}`);
    }
  }

  private async checkDoubleVoting(nullifierHash: string, proposalId: ProposalId): Promise<boolean> {
    // Check if this nullifier has already been used for this proposal
    for (const vote of this.votes.values()) {
      if (vote.proposalId === proposalId && vote.proof.nullifierHash === nullifierHash) {
        return true;
      }
    }
    return false;
  }

  private async updateVoteResults(proposalId: ProposalId, choice: string, votingPower: VotingPowerType): Promise<void> {
    const results = this.voteResults.get(proposalId);
    if (!results) {
      throw new Error(`Vote results not found for proposal: ${proposalId}`);
    }

    // Calculate vote weight based on voting power type
    let voteWeight = 1;
    switch (votingPower) {
      case VotingPowerType.EQUAL:
        voteWeight = 1;
        break;
      case VotingPowerType.STAKE_WEIGHTED:
        voteWeight = await this.getStakeWeight();
        break;
      case VotingPowerType.RARITY_WEIGHTED:
        voteWeight = await this.getRarityWeight();
        break;
    }

    // Update vote count
    if (results.results[choice] !== undefined) {
      results.results[choice] += voteWeight;
      results.totalVotes += voteWeight;
    } else {
      throw new Error(`Invalid vote choice: ${choice}`);
    }

    this.voteResults.set(proposalId, results);
  }

  private async getStakeWeight(): Promise<number> {
    // Mock stake weight calculation
    return 1 + Math.random() * 4; // 1 to 5
  }

  private async getRarityWeight(): Promise<number> {
    // Mock rarity weight calculation
    return 1 + Math.random() * 2; // 1 to 3
  }

  private async registerProposalOnChain(proposal: Proposal): Promise<string> {
    // Mock on-chain proposal registration
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Registering proposal on-chain: ${proposal.id}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  private async recordVoteOnChainWithProof(voteId: VoteId, proposalId: ProposalId, proof: SemaphoreProof): Promise<string> {
    // Enhanced on-chain vote recording with Semaphore proof verification
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Recording anonymous vote on-chain with Semaphore proof: ${voteId} for proposal ${proposalId}`);
    console.log(`Proof nullifier: ${proof.nullifierHash}`);
    await new Promise(resolve => setTimeout(resolve, 150));
    return mockTxHash;
  }

  private async recordVoteOnChain(voteId: VoteId, proposalId: ProposalId, proof: SemaphoreProof): Promise<string> {
    // Delegate to enhanced method
    return await this.recordVoteOnChainWithProof(voteId, proposalId, proof);
  }

  private async recordFinalResultsOnChain(proposalId: ProposalId, results: VoteResults): Promise<string> {
    // Mock on-chain results recording
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Recording final results on-chain for proposal: ${proposalId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }
}

/**
 * Semaphore Manager SDK Implementation
 * Handles Semaphore protocol operations with Cairo contract integration
 */
export class SemaphoreManagerSDK implements SemaphoreManager {
  private config: KiritoSDKConfig;
  private groups: Map<GroupId, Set<string>> = new Map(); // GroupId -> Set of commitment values
  private nullifiers: Set<string> = new Set(); // Track used nullifiers
  private contractAddress?: Address; // Semaphore contract address

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    this.contractAddress = config.network.contracts?.['semaphore'];
  }

  /**
   * Add member to Semaphore group
   */
  async addMember(groupId: GroupId, commitment: Commitment): Promise<void> {
    try {
      // Get or create group locally
      let group = this.groups.get(groupId);
      if (!group) {
        group = new Set();
        this.groups.set(groupId, group);
      }

      // Check if member already exists locally
      if (group.has(commitment.value)) {
        console.log(`Member already exists in group ${groupId}`);
        return;
      }

      // Add member to local group
      group.add(commitment.value);

      // Register member on-chain if contract is available
      let txHash: string;
      if (this.contractAddress) {
        txHash = await this.addMemberOnChain(groupId, commitment);
      } else {
        txHash = await this.registerMemberOnChain(groupId, commitment);
      }
      
      console.log(`Member added to Semaphore group ${groupId}, tx: ${txHash}`);
    } catch (error) {
      throw new Error(`Failed to add member to group: ${error}`);
    }
  }

  /**
   * Generate Semaphore proof with Cairo contract integration
   */
  async generateProof(identity: Identity, signal: Signal, groupId: GroupId): Promise<SemaphoreProof> {
    try {
      // Verify identity is member of group
      const isMember = await this.verifyMembership(identity.commitment, groupId);
      if (!isMember) {
        throw new Error(`Identity is not a member of group: ${groupId}`);
      }

      console.log(`Generating Semaphore proof for group ${groupId}...`);
      
      // Simulate proof generation delay (in real implementation would use circom/snarkjs)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get Merkle tree root from contract or calculate locally
      const merkleTreeRoot = await this.getMerkleRootFromContract(groupId);
      
      // Generate nullifier hash using identity and external nullifier
      const externalNullifier = await this.generateExternalNullifier(signal.scope);
      const nullifierHash = await this.generateNullifierHash(identity, externalNullifier);
      
      // Generate mock zk-SNARK proof (in real implementation would use circom)
      const proof = await this.generateZKProof(
        identity,
        signal,
        merkleTreeRoot,
        nullifierHash,
        externalNullifier,
        groupId
      );

      return {
        merkleTreeRoot,
        nullifierHash,
        signal: signal.message,
        externalNullifier,
        proof
      };
    } catch (error) {
      throw new Error(`Failed to generate Semaphore proof: ${error}`);
    }
  }

  /**
   * Verify Semaphore proof using Cairo contract
   */
  async verifyProof(proof: SemaphoreProof, signal: Signal, groupId: GroupId): Promise<boolean> {
    try {
      console.log(`Verifying Semaphore proof for group ${groupId}...`);
      
      // Check if nullifier has been used locally
      if (this.nullifiers.has(proof.nullifierHash)) {
        console.log('Nullifier already used (double voting detected)');
        return false;
      }

      // Verify using Cairo contract if available
      if (this.contractAddress) {
        const isValid = await this.verifyProofOnChain(proof, signal, groupId);
        if (isValid) {
          // Mark nullifier as used locally
          this.nullifiers.add(proof.nullifierHash);
          // Mark nullifier as used on-chain
          await this.markNullifierUsedOnChain(proof.nullifierHash);
        }
        return isValid;
      }

      // Fallback to local verification
      return await this.verifyProofLocally(proof, signal, groupId);
    } catch (error) {
      console.error(`Failed to verify Semaphore proof: ${error}`);
      return false;
    }
  }

  /**
   * Create new Semaphore group
   */
  async createGroup(groupId: GroupId): Promise<void> {
    try {
      if (this.groups.has(groupId)) {
        throw new Error(`Group already exists: ${groupId}`);
      }

      // Create empty group locally
      this.groups.set(groupId, new Set());

      // Create group on-chain if contract is available
      let txHash: string;
      if (this.contractAddress) {
        txHash = await this.createGroupOnChain(groupId);
      } else {
        txHash = await this.registerGroupOnChain(groupId);
      }
      
      console.log(`Semaphore group created: ${groupId}, tx: ${txHash}`);
    } catch (error) {
      throw new Error(`Failed to create group: ${error}`);
    }
  }

  /**
   * Get group size
   */
  async getGroupSize(groupId: GroupId): Promise<number> {
    // Try to get from contract first
    if (this.contractAddress) {
      try {
        return await this.getGroupSizeFromContract(groupId);
      } catch (error) {
        console.warn(`Failed to get group size from contract: ${error}`);
      }
    }
    
    // Fallback to local storage
    const group = this.groups.get(groupId);
    return group ? group.size : 0;
  }

  /**
   * Remove member from group
   */
  async removeMember(groupId: GroupId, commitment: Commitment): Promise<void> {
    try {
      const group = this.groups.get(groupId);
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }

      if (!group.has(commitment.value)) {
        throw new Error(`Member not found in group: ${groupId}`);
      }

      // Remove member locally
      group.delete(commitment.value);

      // Remove member on-chain if contract is available
      let txHash: string;
      if (this.contractAddress) {
        txHash = await this.removeMemberOnChain(groupId, commitment);
      } else {
        txHash = await this.removeMemberOnChain(groupId, commitment);
      }
      
      console.log(`Member removed from Semaphore group ${groupId}, tx: ${txHash}`);
    } catch (error) {
      throw new Error(`Failed to remove member from group: ${error}`);
    }
  }

  /**
   * Verify membership in group
   */
  async verifyMembership(commitment: Commitment, groupId: GroupId): Promise<boolean> {
    // Try contract first
    if (this.contractAddress) {
      try {
        return await this.verifyMembershipOnChain(commitment, groupId);
      } catch (error) {
        console.warn(`Failed to verify membership on contract: ${error}`);
      }
    }
    
    // Fallback to local verification
    const group = this.groups.get(groupId);
    return group ? group.has(commitment.value) : false;
  }

  /**
   * Get all groups
   */
  getAllGroups(): GroupId[] {
    return Array.from(this.groups.keys());
  }

  // Cairo contract integration methods

  private async createGroupOnChain(groupId: GroupId): Promise<string> {
    if (!this.contractAddress) {
      throw new Error('Semaphore contract address not configured');
    }

    // Mock Cairo contract call
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Creating Semaphore group on Cairo contract: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockTxHash;
  }

  private async addMemberOnChain(groupId: GroupId, commitment: Commitment): Promise<string> {
    if (!this.contractAddress) {
      throw new Error('Semaphore contract address not configured');
    }

    // Mock Cairo contract call
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Adding member to Semaphore group on Cairo contract: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockTxHash;
  }

  private async removeMemberOnChain(groupId: GroupId, commitment: Commitment): Promise<string> {
    if (!this.contractAddress) {
      throw new Error('Semaphore contract address not configured');
    }

    // Mock Cairo contract call
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Removing member from Semaphore group on Cairo contract: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockTxHash;
  }

  private async verifyMembershipOnChain(commitment: Commitment, groupId: GroupId): Promise<boolean> {
    if (!this.contractAddress) {
      return false;
    }

    // Mock Cairo contract call
    console.log(`Verifying membership on Cairo contract for group: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check local storage as fallback
    const group = this.groups.get(groupId);
    return group ? group.has(commitment.value) : false;
  }

  private async getGroupSizeFromContract(groupId: GroupId): Promise<number> {
    if (!this.contractAddress) {
      throw new Error('Semaphore contract address not configured');
    }

    // Mock Cairo contract call
    console.log(`Getting group size from Cairo contract: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return local size as fallback
    const group = this.groups.get(groupId);
    return group ? group.size : 0;
  }

  private async getMerkleRootFromContract(groupId: GroupId): Promise<string> {
    if (!this.contractAddress) {
      return await this.calculateMerkleRoot(groupId);
    }

    // Mock Cairo contract call
    console.log(`Getting Merkle root from Cairo contract: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fallback to local calculation
    return await this.calculateMerkleRoot(groupId);
  }

  private async verifyProofOnChain(proof: SemaphoreProof, signal: Signal, groupId: GroupId): Promise<boolean> {
    if (!this.contractAddress) {
      return false;
    }

    // Mock Cairo contract call for proof verification
    console.log(`Verifying proof on Cairo contract for group: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Basic validation (in real implementation would call Cairo contract)
    return this.validateProofStructure(proof, signal);
  }

  private async markNullifierUsedOnChain(nullifierHash: string): Promise<string> {
    if (!this.contractAddress) {
      throw new Error('Semaphore contract address not configured');
    }

    // Mock Cairo contract call
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Marking nullifier as used on Cairo contract: ${nullifierHash}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  // Enhanced proof generation and verification methods

  private async generateZKProof(
    identity: Identity,
    signal: Signal,
    merkleTreeRoot: string,
    nullifierHash: string,
    externalNullifier: string,
    groupId: GroupId
  ): Promise<string[]> {
    // In a real implementation, this would use circom circuits and snarkjs
    // For now, generate a mock proof with proper structure
    
    console.log('Generating zk-SNARK proof...');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Generate 8 proof elements (typical for Groth16)
    const proof = Array.from({ length: 8 }, (_, i) => {
      const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
      return '0x' + randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    });
    
    return proof;
  }

  private async verifyProofLocally(proof: SemaphoreProof, signal: Signal, groupId: GroupId): Promise<boolean> {
    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify Merkle tree root matches current group state
    const currentRoot = await this.calculateMerkleRoot(groupId);
    if (proof.merkleTreeRoot !== currentRoot) {
      console.log('Invalid Merkle tree root');
      return false;
    }

    // Verify signal matches
    if (proof.signal !== signal.message) {
      console.log('Signal mismatch');
      return false;
    }

    // Verify external nullifier
    const expectedExternalNullifier = await this.generateExternalNullifier(signal.scope);
    if (proof.externalNullifier !== expectedExternalNullifier) {
      console.log('External nullifier mismatch');
      return false;
    }

    // Validate proof structure
    if (!this.validateProofStructure(proof, signal)) {
      return false;
    }

    // Mark nullifier as used locally
    this.nullifiers.add(proof.nullifierHash);

    console.log('Semaphore proof verified successfully');
    return true;
  }

  private validateProofStructure(proof: SemaphoreProof, signal: Signal): boolean {
    // Basic proof structure validation
    if (proof.proof.length !== 8) {
      console.log('Invalid proof structure - wrong length');
      return false;
    }

    // Check that all proof elements are valid hex strings
    for (const element of proof.proof) {
      if (!element.startsWith('0x') || element.length !== 66) {
        console.log('Invalid proof element format');
        return false;
      }
    }

    return true;
  }

  // Private helper methods (enhanced versions)

  private async calculateMerkleRoot(groupId: GroupId): Promise<string> {
    // Enhanced Merkle tree root calculation
    const group = this.groups.get(groupId);
    if (!group || group.size === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    // Build proper Merkle tree using Poseidon hash (compatible with Cairo)
    const commitments = Array.from(group).sort();
    return await this.buildMerkleTree(commitments);
  }

  private async buildMerkleTree(leaves: string[]): Promise<string> {
    if (leaves.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    
    if (leaves.length === 1) {
      return leaves[0];
    }

    // Build tree level by level using Poseidon-compatible hashing
    let currentLevel = leaves;
    
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          // Hash pair
          const left = currentLevel[i];
          const right = currentLevel[i + 1];
          const hash = await this.poseidonHash([left, right]);
          nextLevel.push(hash);
        } else {
          // Odd number, carry forward
          nextLevel.push(currentLevel[i]);
        }
      }
      
      currentLevel = nextLevel;
    }
    
    return currentLevel[0];
  }

  private async poseidonHash(inputs: string[]): Promise<string> {
    // Mock Poseidon hash (in real implementation would use proper Poseidon)
    const data = inputs.join('');
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async generateNullifierHash(identity: Identity, externalNullifier: string): Promise<string> {
    // Generate nullifier hash from identity private key and external nullifier
    const privateKeyHex = Array.from(identity.privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const data = privateKeyHex + externalNullifier;
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async generateExternalNullifier(scope: string): Promise<string> {
    // Generate external nullifier from scope (deterministic)
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(scope);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async registerGroupOnChain(groupId: GroupId): Promise<string> {
    // Mock on-chain group registration (fallback when no Cairo contract)
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Registering Semaphore group on-chain: ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  private async registerMemberOnChain(groupId: GroupId, commitment: Commitment): Promise<string> {
    // Mock on-chain member registration (fallback when no Cairo contract)
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Registering member on-chain for group ${groupId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }
}