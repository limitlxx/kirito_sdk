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
  Address,
  SignalId,
  PrivateSignal,
  SignalType,
  SignalResults,
  AggregatedSignals,
  ProposalType
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
  private signals: Map<SignalId, { signal: PrivateSignal; proof: SemaphoreProof }> = new Map();
  private signalsByScope: Map<string, SignalId[]> = new Map();
  private signalsByType: Map<SignalType, SignalId[]> = new Map();

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

      // Validate proposal type-specific requirements
      this.validateProposalType(proposal);

      // Verify group exists
      const groupSize = await this.semaphoreManager.getGroupSize(groupId);
      if (groupSize === 0) {
        throw new Error(`Semaphore group does not exist: ${groupId}`);
      }

      // Generate unique proposal ID
      const proposalId = this.generateProposalId();
      
      // Set proposal ID, group, and default type if not specified
      const fullProposal: Proposal = {
        ...proposal,
        id: proposalId,
        groupId,
        proposalType: proposal.proposalType || 'binary' as any
      };

      // Store proposal
      this.proposals.set(proposalId, fullProposal);

      // Initialize vote results based on proposal type
      const initialResults: VoteResults = {
        proposalId,
        totalVotes: 0,
        results: {},
        isFinalized: false,
        proposalType: fullProposal.proposalType,
        metadata: {
          participationRate: 0,
          quorumMet: false
        }
      };
      
      // Initialize results for each option
      proposal.options.forEach(option => {
        initialResults.results[option] = 0;
      });
      
      this.voteResults.set(proposalId, initialResults);

      // Register proposal on-chain
      const txHash = await this.registerProposalOnChain(fullProposal);
      
      console.log(`Governance proposal created: ${proposalId} (type: ${fullProposal.proposalType}), tx: ${txHash}`);
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

      // Calculate participation rate
      const groupSize = await this.semaphoreManager.getGroupSize(proposal.groupId);
      const participationRate = groupSize > 0 ? (results.totalVotes / groupSize) * 100 : 0;

      // Check quorum if specified
      const quorum = proposal.metadata?.quorum || 0;
      const quorumMet = participationRate >= quorum;

      // Update metadata
      results.metadata = {
        ...results.metadata,
        participationRate,
        quorumMet
      };

      // Finalize results if deadline passed and not already finalized
      if (isExpired && !results.isFinalized) {
        results.isFinalized = true;
        
        // Apply proposal type-specific finalization
        results = await this.finalizeResultsByType(results, proposal);
        
        this.voteResults.set(proposalId, results);
        
        // Record final results on-chain
        await this.recordFinalResultsOnChain(proposalId, results);
        console.log(`Proposal ${proposalId} results finalized (type: ${proposal.proposalType})`);
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

  /**
   * Send anonymous signal for governance decisions
   */
  async sendSignal(signal: PrivateSignal, proof: SemaphoreProof): Promise<SignalId> {
    try {
      // Validate signal
      if (!signal.type || !signal.scope || !signal.groupId) {
        throw new Error('Invalid signal: missing required fields');
      }

      // Verify group exists
      const groupSize = await this.semaphoreManager.getGroupSize(signal.groupId);
      if (groupSize === 0) {
        throw new Error(`Semaphore group does not exist: ${signal.groupId}`);
      }

      // Create Signal object for proof verification
      const signalMessage: Signal = {
        message: this.encodeSignalMessage(signal),
        scope: signal.scope
      };

      // Verify Semaphore proof
      const isValidProof = await this.semaphoreManager.verifyProof(proof, signalMessage, signal.groupId);
      if (!isValidProof) {
        throw new Error('Invalid Semaphore proof for signal');
      }

      // Check for duplicate signaling using nullifier
      const hasSentSignal = await this.checkDuplicateSignal(proof.nullifierHash, signal.scope);
      if (hasSentSignal) {
        throw new Error('Duplicate signal detected for this scope');
      }

      // Generate signal ID
      const signalId = this.generateSignalId();

      // Store signal
      this.signals.set(signalId, { signal, proof });

      // Index by scope
      const scopeSignals = this.signalsByScope.get(signal.scope) || [];
      scopeSignals.push(signalId);
      this.signalsByScope.set(signal.scope, scopeSignals);

      // Index by type
      const typeSignals = this.signalsByType.get(signal.type) || [];
      typeSignals.push(signalId);
      this.signalsByType.set(signal.type, typeSignals);

      // Record signal on-chain
      const txHash = await this.recordSignalOnChain(signalId, signal, proof);

      console.log(`Anonymous signal sent: ${signalId} (type: ${signal.type}, scope: ${signal.scope}), tx: ${txHash}`);
      return signalId;
    } catch (error) {
      throw new Error(`Failed to send signal: ${error}`);
    }
  }

  /**
   * Aggregate signals by type and scope
   */
  async aggregateSignals(signalType: SignalType, scope: string): Promise<AggregatedSignals> {
    try {
      // Get all signals for this type and scope
      const typeSignals = this.signalsByType.get(signalType) || [];
      const scopeSignals = this.signalsByScope.get(scope) || [];

      // Find intersection (signals matching both type and scope)
      const matchingSignalIds = typeSignals.filter(id => scopeSignals.includes(id));

      // Retrieve signal data
      const signals: PrivateSignal[] = [];
      for (const signalId of matchingSignalIds) {
        const signalData = this.signals.get(signalId);
        if (signalData) {
          signals.push(signalData.signal);
        }
      }

      // Aggregate based on signal type
      const aggregation = await this.performAggregation(signals, signalType);

      // Count unique participants (using nullifier hashes)
      const uniqueNullifiers = new Set<string>();
      for (const signalId of matchingSignalIds) {
        const signalData = this.signals.get(signalId);
        if (signalData) {
          uniqueNullifiers.add(signalData.proof.nullifierHash);
        }
      }

      const result: AggregatedSignals = {
        signalType,
        scope,
        signals,
        aggregation,
        participantCount: uniqueNullifiers.size,
        timestamp: Date.now()
      };

      console.log(`Aggregated ${signals.length} signals for type ${signalType}, scope ${scope}`);
      return result;
    } catch (error) {
      throw new Error(`Failed to aggregate signals: ${error}`);
    }
  }

  /**
   * Get signal results for a specific scope
   */
  async getSignalResults(scope: string): Promise<SignalResults> {
    try {
      const scopeSignals = this.signalsByScope.get(scope) || [];

      if (scopeSignals.length === 0) {
        throw new Error(`No signals found for scope: ${scope}`);
      }

      // Get first signal to determine type
      const firstSignalData = this.signals.get(scopeSignals[0]);
      if (!firstSignalData) {
        throw new Error('Signal data not found');
      }

      const signalType = firstSignalData.signal.type;

      // Aggregate all signals for this scope
      const aggregated = await this.aggregateSignals(signalType, scope);

      const results: SignalResults = {
        scope,
        signalType,
        totalSignals: scopeSignals.length,
        aggregatedData: aggregated.aggregation,
        timestamp: Date.now()
      };

      return results;
    } catch (error) {
      throw new Error(`Failed to get signal results: ${error}`);
    }
  }

  /**
   * Verify signal authenticity
   */
  async verifySignal(signalId: SignalId, proof: SemaphoreProof): Promise<boolean> {
    try {
      const signalData = this.signals.get(signalId);
      if (!signalData) {
        console.log(`Signal not found: ${signalId}`);
        return false;
      }

      // Verify proof matches stored proof
      if (signalData.proof.nullifierHash !== proof.nullifierHash) {
        console.log('Proof nullifier mismatch');
        return false;
      }

      // Create Signal object for verification
      const signalMessage: Signal = {
        message: this.encodeSignalMessage(signalData.signal),
        scope: signalData.signal.scope
      };

      // Verify proof with Semaphore manager
      const isValid = await this.semaphoreManager.verifyProof(
        proof,
        signalMessage,
        signalData.signal.groupId
      );

      console.log(`Signal ${signalId} verification: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error(`Failed to verify signal: ${error}`);
      return false;
    }
  }

  // Private helper methods for signaling

  private generateSignalId(): SignalId {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `signal_${timestamp}_${random}`;
  }

  private encodeSignalMessage(signal: PrivateSignal): string {
    // Encode signal data into a message string
    return JSON.stringify({
      type: signal.type,
      scope: signal.scope,
      data: signal.data,
      timestamp: signal.timestamp
    });
  }

  private async checkDuplicateSignal(nullifierHash: string, scope: string): Promise<boolean> {
    // Check if this nullifier has already been used for this scope
    const scopeSignals = this.signalsByScope.get(scope) || [];
    
    for (const signalId of scopeSignals) {
      const signalData = this.signals.get(signalId);
      if (signalData && signalData.proof.nullifierHash === nullifierHash) {
        return true;
      }
    }
    
    return false;
  }

  private async performAggregation(signals: PrivateSignal[], signalType: SignalType): Promise<any> {
    // Perform type-specific aggregation
    switch (signalType) {
      case SignalType.YIELD_STRATEGY:
        return this.aggregateYieldStrategySignals(signals);
      
      case SignalType.REVEAL_TIMING:
        return this.aggregateRevealTimingSignals(signals);
      
      case SignalType.COLLECTION_DECISION:
        return this.aggregateCollectionDecisionSignals(signals);
      
      case SignalType.PARAMETER_ADJUSTMENT:
        return this.aggregateParameterAdjustmentSignals(signals);
      
      case SignalType.CUSTOM:
        return this.aggregateCustomSignals(signals);
      
      default:
        return this.aggregateGenericSignals(signals);
    }
  }

  private aggregateYieldStrategySignals(signals: PrivateSignal[]): any {
    // Aggregate yield strategy preferences
    const strategies: { [strategy: string]: number } = {};
    
    for (const signal of signals) {
      const strategy = signal.data.strategy || 'unknown';
      strategies[strategy] = (strategies[strategy] || 0) + 1;
    }

    // Calculate percentages
    const total = signals.length;
    const percentages: { [strategy: string]: number } = {};
    for (const [strategy, count] of Object.entries(strategies)) {
      percentages[strategy] = (count / total) * 100;
    }

    return {
      strategies,
      percentages,
      mostPreferred: Object.keys(strategies).reduce((a, b) => 
        strategies[a] > strategies[b] ? a : b
      )
    };
  }

  private aggregateRevealTimingSignals(signals: PrivateSignal[]): any {
    // Aggregate reveal timing preferences
    const timings: number[] = [];
    
    for (const signal of signals) {
      if (signal.data.preferredTimestamp) {
        timings.push(signal.data.preferredTimestamp);
      }
    }

    if (timings.length === 0) {
      return { averageTimestamp: null, medianTimestamp: null };
    }

    // Calculate average and median
    const sum = timings.reduce((a, b) => a + b, 0);
    const average = sum / timings.length;
    
    const sorted = timings.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return {
      averageTimestamp: Math.floor(average),
      medianTimestamp: median,
      earliestPreferred: Math.min(...timings),
      latestPreferred: Math.max(...timings),
      totalResponses: timings.length
    };
  }

  private aggregateCollectionDecisionSignals(signals: PrivateSignal[]): any {
    // Aggregate collection-wide decisions
    const decisions: { [decision: string]: number } = {};
    
    for (const signal of signals) {
      const decision = signal.data.decision || 'abstain';
      decisions[decision] = (decisions[decision] || 0) + 1;
    }

    // Calculate support percentages
    const total = signals.length;
    const support: { [decision: string]: number } = {};
    for (const [decision, count] of Object.entries(decisions)) {
      support[decision] = (count / total) * 100;
    }

    return {
      decisions,
      support,
      consensus: this.calculateConsensus(support),
      totalParticipants: total
    };
  }

  private aggregateParameterAdjustmentSignals(signals: PrivateSignal[]): any {
    // Aggregate parameter adjustment suggestions
    const parameters: { [param: string]: number[] } = {};
    
    for (const signal of signals) {
      if (signal.data.parameters) {
        for (const [param, value] of Object.entries(signal.data.parameters)) {
          if (!parameters[param]) {
            parameters[param] = [];
          }
          parameters[param].push(value as number);
        }
      }
    }

    // Calculate averages for each parameter
    const averages: { [param: string]: number } = {};
    for (const [param, values] of Object.entries(parameters)) {
      const sum = values.reduce((a, b) => a + b, 0);
      averages[param] = sum / values.length;
    }

    return {
      parameters,
      averages,
      totalResponses: signals.length
    };
  }

  private aggregateCustomSignals(signals: PrivateSignal[]): any {
    // Generic aggregation for custom signals
    return {
      totalSignals: signals.length,
      data: signals.map(s => s.data),
      timestamp: Date.now()
    };
  }

  private aggregateGenericSignals(signals: PrivateSignal[]): any {
    // Fallback generic aggregation
    return {
      totalSignals: signals.length,
      signalData: signals.map(s => ({
        type: s.type,
        timestamp: s.timestamp,
        data: s.data
      }))
    };
  }

  private calculateConsensus(support: { [decision: string]: number }): string {
    // Determine if there's consensus (>66% support for one option)
    for (const [decision, percentage] of Object.entries(support)) {
      if (percentage > 66) {
        return `Strong consensus for: ${decision}`;
      }
    }

    // Check for majority (>50%)
    for (const [decision, percentage] of Object.entries(support)) {
      if (percentage > 50) {
        return `Majority support for: ${decision}`;
      }
    }

    return 'No clear consensus';
  }

  private async recordSignalOnChain(signalId: SignalId, signal: PrivateSignal, proof: SemaphoreProof): Promise<string> {
    // Mock on-chain signal recording with Semaphore proof
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Recording anonymous signal on-chain: ${signalId} (type: ${signal.type})`);
    console.log(`Signal nullifier: ${proof.nullifierHash}`);
    await new Promise(resolve => setTimeout(resolve, 150));
    return mockTxHash;
  }

  // Private helper methods

  private generateProposalId(): ProposalId {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `proposal_${timestamp}_${random}`;
  }

  private validateProposalType(proposal: Proposal): void {
    const proposalType = proposal.proposalType || 'binary' as any;
    
    switch (proposalType) {
      case 'binary':
        if (proposal.options.length !== 2) {
          throw new Error('Binary proposals must have exactly 2 options');
        }
        break;
      
      case 'multiple_choice':
        if (proposal.options.length < 2) {
          throw new Error('Multiple choice proposals must have at least 2 options');
        }
        break;
      
      case 'weighted':
        if (proposal.options.length < 2) {
          throw new Error('Weighted proposals must have at least 2 options');
        }
        break;
      
      case 'ranked_choice':
        if (proposal.options.length < 3) {
          throw new Error('Ranked choice proposals must have at least 3 options');
        }
        break;
      
      case 'quadratic':
        if (proposal.options.length < 2) {
          throw new Error('Quadratic proposals must have at least 2 options');
        }
        break;
      
      default:
        throw new Error(`Unknown proposal type: ${proposalType}`);
    }
  }

  private async finalizeResultsByType(results: VoteResults, proposal: Proposal): Promise<VoteResults> {
    // Apply type-specific result processing
    switch (proposal.proposalType) {
      case 'binary':
        return this.finalizeBinaryResults(results);
      
      case 'multiple_choice':
        return this.finalizeMultipleChoiceResults(results);
      
      case 'weighted':
        return this.finalizeWeightedResults(results);
      
      case 'ranked_choice':
        return this.finalizeRankedChoiceResults(results);
      
      case 'quadratic':
        return this.finalizeQuadraticResults(results);
      
      default:
        return results;
    }
  }

  private finalizeBinaryResults(results: VoteResults): VoteResults {
    // Binary: simple majority wins
    const options = Object.keys(results.results);
    if (options.length === 2) {
      const winner = results.results[options[0]] > results.results[options[1]] ? options[0] : options[1];
      results.metadata = {
        ...results.metadata,
        winner,
        winningMargin: Math.abs(results.results[options[0]] - results.results[options[1]])
      };
    }
    return results;
  }

  private finalizeMultipleChoiceResults(results: VoteResults): VoteResults {
    // Multiple choice: option with most votes wins
    let maxVotes = 0;
    let winner = '';
    
    for (const [option, votes] of Object.entries(results.results)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = option;
      }
    }
    
    results.metadata = {
      ...results.metadata,
      winner,
      winningVotes: maxVotes,
      winningPercentage: (maxVotes / results.totalVotes) * 100
    };
    
    return results;
  }

  private finalizeWeightedResults(results: VoteResults): VoteResults {
    // Weighted: already handled by vote weight calculation
    return this.finalizeMultipleChoiceResults(results);
  }

  private finalizeRankedChoiceResults(results: VoteResults): VoteResults {
    // Ranked choice: instant runoff voting (simplified)
    // In a full implementation, this would eliminate lowest-ranked options iteratively
    return this.finalizeMultipleChoiceResults(results);
  }

  private finalizeQuadraticResults(results: VoteResults): VoteResults {
    // Quadratic: apply square root to vote counts
    const quadraticResults: { [option: string]: number } = {};
    
    for (const [option, votes] of Object.entries(results.results)) {
      quadraticResults[option] = Math.sqrt(votes);
    }
    
    // Find winner based on quadratic votes
    let maxQuadraticVotes = 0;
    let winner = '';
    
    for (const [option, quadraticVotes] of Object.entries(quadraticResults)) {
      if (quadraticVotes > maxQuadraticVotes) {
        maxQuadraticVotes = quadraticVotes;
        winner = option;
      }
    }
    
    results.metadata = {
      ...results.metadata,
      winner,
      quadraticResults,
      winningQuadraticVotes: maxQuadraticVotes
    };
    
    return results;
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