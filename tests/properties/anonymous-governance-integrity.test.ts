import fc from 'fast-check';
import {
  AnonymousGovernanceSDK,
  SemaphoreManagerSDK
} from '../../src/sdk/governance';
import {
  Proposal,
  VotingPowerType,
  Signal,
  Identity,
  Commitment,
  SemaphoreProof,
  KiritoSDKConfig,
  NetworkConfig,
  ProposalId,
  GroupId
} from '../../src/types';

/**
 * Property-Based Tests for Anonymous Governance Integrity
 * **Feature: kirito-sdk, Property 13: Anonymous Governance Integrity**
 * **Validates: Requirements 5.1, 5.3, 5.5**
 */

describe('Anonymous Governance Integrity Properties', () => {
  let governanceSDK: AnonymousGovernanceSDK;
  let semaphoreManager: SemaphoreManagerSDK;
  let mockConfig: KiritoSDKConfig;

  beforeEach(() => {
    const mockNetwork: NetworkConfig = {
      name: 'test',
      rpcUrl: 'http://localhost:8545',
      chainId: '1',
      contracts: {
        semaphore: '0x1234567890123456789012345678901234567890',
        governance: '0x2345678901234567890123456789012345678901'
      }
    };

    mockConfig = {
      network: mockNetwork,
      ipfs: {
        url: 'http://localhost:5001',
        projectId: 'test',
        projectSecret: 'test'
      },
      privacy: {
        tongoEndpoint: 'http://localhost:8080',
        semaphoreEndpoint: 'http://localhost:8081'
      }
    };

    governanceSDK = new AnonymousGovernanceSDK(mockConfig);
    semaphoreManager = governanceSDK.getSemaphoreManager() as SemaphoreManagerSDK;
  });

  /**
   * Property 13.1: Anonymous Voting Prevents Identity Revelation
   * For any valid identity and vote, the Semaphore proof should not reveal the voter's identity
   */
  test('Property 13.1: Anonymous voting preserves voter anonymity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }), // proposal title
        fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 2, maxLength: 5 }), // options
        fc.integer({ min: 1, max: 10 }), // number of voters
        fc.integer({ min: 1, max: 24 }), // hours until deadline
        async (title, options, numVoters, hoursUntilDeadline) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Generate identities and add to group
          const identities: Identity[] = [];
          for (let i = 0; i < numVoters; i++) {
            const privateKey = crypto.getRandomValues(new Uint8Array(32));
            const commitment: Commitment = {
              value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
            };
            const identity: Identity = { privateKey, commitment };
            identities.push(identity);
            await semaphoreManager.addMember(groupId, commitment);
          }

          // Create proposal
          const proposal: Proposal = {
            id: '', // Will be set by createProposal
            title,
            description: `Test proposal: ${title}`,
            options,
            groupId,
            deadline: Date.now() + (hoursUntilDeadline * 60 * 60 * 1000),
            votingPower: VotingPowerType.EQUAL
          };

          const proposalId = await governanceSDK.createProposal(proposal, groupId);

          // Each identity votes
          const proofs: SemaphoreProof[] = [];
          for (let i = 0; i < identities.length; i++) {
            const identity = identities[i];
            const chosenOption = options[i % options.length];
            
            const signal: Signal = {
              message: `${proposalId}|${chosenOption}`,
              scope: `governance_vote_${proposalId}`
            };

            // Generate proof
            const proof = await semaphoreManager.generateProof(identity, signal, groupId);
            proofs.push(proof);

            // Vote using the proof
            await governanceSDK.vote(signal, proof);
          }

          // Verify anonymity properties
          for (let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            const identity = identities[i];

            // Proof should not contain the private key
            const privateKeyHex = Array.from(identity.privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
            expect(proof.signal).not.toContain(privateKeyHex);
            expect(proof.merkleTreeRoot).not.toContain(privateKeyHex);
            expect(proof.nullifierHash).not.toContain(privateKeyHex);

            // Proof should not directly contain the commitment value
            expect(proof.signal).not.toContain(identity.commitment.value.substring(2));
            expect(proof.merkleTreeRoot).not.toContain(identity.commitment.value.substring(2));

            // Each proof should have a unique nullifier hash (prevents double voting)
            for (let j = i + 1; j < proofs.length; j++) {
              expect(proof.nullifierHash).not.toBe(proofs[j].nullifierHash);
            }

            // Nullifier should be deterministic for same identity and signal
            const signal: Signal = {
              message: `${proposalId}|${options[i % options.length]}`,
              scope: `governance_vote_${proposalId}`
            };
            const proof2 = await semaphoreManager.generateProof(identity, signal, groupId);
            expect(proof.nullifierHash).toBe(proof2.nullifierHash);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 13.2: Double Voting Prevention
   * For any identity, attempting to vote twice on the same proposal should be prevented
   */
  test('Property 13.2: Double voting is prevented through nullifier tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 30 }), // proposal title
        fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 2, maxLength: 4 }), // options
        fc.integer({ min: 1, max: 5 }), // hours until deadline
        async (title, options, hoursUntilDeadline) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Generate single identity
          const privateKey = crypto.getRandomValues(new Uint8Array(32));
          const commitment: Commitment = {
            value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
          };
          const identity: Identity = { privateKey, commitment };
          await semaphoreManager.addMember(groupId, commitment);

          // Create proposal
          const proposal: Proposal = {
            id: '',
            title,
            description: `Test proposal: ${title}`,
            options,
            groupId,
            deadline: Date.now() + (hoursUntilDeadline * 60 * 60 * 1000),
            votingPower: VotingPowerType.EQUAL
          };

          const proposalId = await governanceSDK.createProposal(proposal, groupId);

          // First vote should succeed
          const chosenOption = options[0];
          const signal: Signal = {
            message: `${proposalId}|${chosenOption}`,
            scope: `governance_vote_${proposalId}`
          };

          const proof1 = await semaphoreManager.generateProof(identity, signal, groupId);
          const voteId1 = await governanceSDK.vote(signal, proof1);
          expect(voteId1).toBeDefined();

          // Second vote with same identity should fail
          const signal2: Signal = {
            message: `${proposalId}|${options[1] || options[0]}`,
            scope: `governance_vote_${proposalId}`
          };

          const proof2 = await semaphoreManager.generateProof(identity, signal2, groupId);
          
          // Should have same nullifier hash (same identity, same scope)
          expect(proof1.nullifierHash).toBe(proof2.nullifierHash);

          // Second vote should be rejected
          await expect(governanceSDK.vote(signal2, proof2)).rejects.toThrow(/double voting/i);

          // Verify vote results only count the first vote
          const results = await governanceSDK.tallyVotes(proposalId);
          expect(results.totalVotes).toBe(1);
          expect(results.results[chosenOption]).toBe(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 13.3: Vote Tallying Accuracy
   * For any set of valid votes, the tally should accurately count all votes without revealing voter identities
   */
  test('Property 13.3: Vote tallying is accurate and preserves anonymity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 30 }), // proposal title
        fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 2, maxLength: 4 }), // options
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 3, maxLength: 10 }), // vote choices (indices)
        fc.integer({ min: 1, max: 12 }), // hours until deadline
        async (title, options, voteChoices, hoursUntilDeadline) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Generate identities and add to group
          const identities: Identity[] = [];
          for (let i = 0; i < voteChoices.length; i++) {
            const privateKey = crypto.getRandomValues(new Uint8Array(32));
            const commitment: Commitment = {
              value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
            };
            const identity: Identity = { privateKey, commitment };
            identities.push(identity);
            await semaphoreManager.addMember(groupId, commitment);
          }

          // Create proposal
          const proposal: Proposal = {
            id: '',
            title,
            description: `Test proposal: ${title}`,
            options,
            groupId,
            deadline: Date.now() + (hoursUntilDeadline * 60 * 60 * 1000),
            votingPower: VotingPowerType.EQUAL
          };

          const proposalId = await governanceSDK.createProposal(proposal, groupId);

          // Track expected vote counts
          const expectedCounts: { [option: string]: number } = {};
          options.forEach(option => expectedCounts[option] = 0);

          // Cast votes
          for (let i = 0; i < voteChoices.length; i++) {
            const identity = identities[i];
            const choiceIndex = voteChoices[i] % options.length;
            const chosenOption = options[choiceIndex];
            expectedCounts[chosenOption]++;

            const signal: Signal = {
              message: `${proposalId}|${chosenOption}`,
              scope: `governance_vote_${proposalId}`
            };

            const proof = await semaphoreManager.generateProof(identity, signal, groupId);
            await governanceSDK.vote(signal, proof);
          }

          // Tally votes
          const results = await governanceSDK.tallyVotes(proposalId);

          // Verify accuracy
          expect(results.totalVotes).toBe(voteChoices.length);
          expect(results.proposalId).toBe(proposalId);

          // Check each option count
          for (const option of options) {
            expect(results.results[option]).toBe(expectedCounts[option]);
          }

          // Verify sum of all votes equals total
          const sumOfVotes = Object.values(results.results).reduce((sum, count) => sum + count, 0);
          expect(sumOfVotes).toBe(results.totalVotes);

          // Verify no voter identity information is leaked in results
          const resultsString = JSON.stringify(results);
          for (const identity of identities) {
            const privateKeyHex = Array.from(identity.privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
            expect(resultsString).not.toContain(privateKeyHex);
            expect(resultsString).not.toContain(identity.commitment.value.substring(2));
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13.4: Group Membership Verification
   * For any commitment, membership verification should only succeed for actual group members
   */
  test('Property 13.4: Group membership verification is accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }), // number of members
        fc.integer({ min: 1, max: 5 }), // number of non-members to test
        async (numMembers, numNonMembers) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Generate member commitments and add to group
          const memberCommitments: Commitment[] = [];
          for (let i = 0; i < numMembers; i++) {
            const privateKey = crypto.getRandomValues(new Uint8Array(32));
            const commitment: Commitment = {
              value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
            };
            memberCommitments.push(commitment);
            await semaphoreManager.addMember(groupId, commitment);
          }

          // Generate non-member commitments (don't add to group)
          const nonMemberCommitments: Commitment[] = [];
          for (let i = 0; i < numNonMembers; i++) {
            const privateKey = crypto.getRandomValues(new Uint8Array(32));
            const commitment: Commitment = {
              value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
            };
            nonMemberCommitments.push(commitment);
          }

          // Verify all members are recognized
          for (const commitment of memberCommitments) {
            const isMember = await governanceSDK.verifyMembership(commitment, groupId);
            expect(isMember).toBe(true);
          }

          // Verify non-members are not recognized
          for (const commitment of nonMemberCommitments) {
            const isMember = await governanceSDK.verifyMembership(commitment, groupId);
            expect(isMember).toBe(false);
          }

          // Verify group size is correct
          const groupSize = await semaphoreManager.getGroupSize(groupId);
          expect(groupSize).toBe(numMembers);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 13.5: Proposal Lifecycle Management
   * For any proposal, the lifecycle should follow correct state transitions and timing
   */
  test('Property 13.5: Proposal lifecycle follows correct state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 40 }), // proposal title
        fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 2, maxLength: 5 }), // options
        fc.integer({ min: 1, max: 48 }), // hours until deadline
        async (title, options, hoursUntilDeadline) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Add at least one member to make group valid
          const privateKey = crypto.getRandomValues(new Uint8Array(32));
          const commitment: Commitment = {
            value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
          };
          await semaphoreManager.addMember(groupId, commitment);

          const currentTime = Date.now();
          const deadline = currentTime + (hoursUntilDeadline * 60 * 60 * 1000);

          // Create proposal
          const proposal: Proposal = {
            id: '',
            title,
            description: `Test proposal: ${title}`,
            options,
            groupId,
            deadline,
            votingPower: VotingPowerType.EQUAL
          };

          const proposalId = await governanceSDK.createProposal(proposal, groupId);

          // Verify proposal was created correctly
          const createdProposal = await governanceSDK.getProposal(proposalId);
          expect(createdProposal.id).toBe(proposalId);
          expect(createdProposal.title).toBe(title);
          expect(createdProposal.options).toEqual(options);
          expect(createdProposal.groupId).toBe(groupId);
          expect(createdProposal.deadline).toBe(deadline);

          // Proposal should be active if deadline is in the future
          const isActive = await governanceSDK.isProposalActive(proposalId);
          const expectedActive = currentTime < deadline;
          expect(isActive).toBe(expectedActive);

          // Initial vote results should be empty but structured correctly
          const initialResults = await governanceSDK.tallyVotes(proposalId);
          expect(initialResults.proposalId).toBe(proposalId);
          expect(initialResults.totalVotes).toBe(0);
          expect(initialResults.isFinalized).toBe(false);

          // All options should be initialized with 0 votes
          for (const option of options) {
            expect(initialResults.results[option]).toBe(0);
          }

          // Results should have exactly the same options as the proposal
          const resultOptions = Object.keys(initialResults.results);
          expect(resultOptions.sort()).toEqual(options.sort());
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Property 13.6: Proof Verification Consistency
   * For any valid proof, verification should be consistent and deterministic
   */
  test('Property 13.6: Semaphore proof verification is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 50 }), // signal message
        fc.string({ minLength: 5, maxLength: 20 }), // signal scope
        async (message, scope) => {
          // Create Semaphore group
          const groupId = `group_${Date.now()}_${Math.random()}`;
          await semaphoreManager.createGroup(groupId);

          // Generate identity and add to group
          const privateKey = crypto.getRandomValues(new Uint8Array(32));
          const commitment: Commitment = {
            value: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`
          };
          const identity: Identity = { privateKey, commitment };
          await semaphoreManager.addMember(groupId, commitment);

          const signal: Signal = { message, scope };

          // Generate proof
          const proof = await semaphoreManager.generateProof(identity, signal, groupId);

          // Verify proof multiple times - should be consistent
          const verification1 = await semaphoreManager.verifyProof(proof, signal, groupId);
          const verification2 = await semaphoreManager.verifyProof(proof, signal, groupId);
          const verification3 = await semaphoreManager.verifyProof(proof, signal, groupId);

          expect(verification1).toBe(true);
          expect(verification2).toBe(true);
          expect(verification3).toBe(true);

          // Proof should have correct structure
          expect(proof.merkleTreeRoot).toMatch(/^0x[0-9a-f]+$/);
          expect(proof.nullifierHash).toMatch(/^0x[0-9a-f]+$/);
          expect(proof.signal).toBe(message);
          expect(proof.externalNullifier).toMatch(/^0x[0-9a-f]+$/);
          expect(Array.isArray(proof.proof)).toBe(true);
          expect(proof.proof.length).toBe(8); // Groth16 proof structure

          // Proof should fail with wrong signal
          const wrongSignal: Signal = { message: message + '_wrong', scope };
          const wrongVerification = await semaphoreManager.verifyProof(proof, wrongSignal, groupId);
          expect(wrongVerification).toBe(false);

          // Proof should fail with wrong group
          const wrongGroupId = `wrong_${groupId}`;
          await semaphoreManager.createGroup(wrongGroupId);
          const wrongGroupVerification = await semaphoreManager.verifyProof(proof, signal, wrongGroupId);
          expect(wrongGroupVerification).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});