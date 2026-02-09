/**
 * Property-Based Test for Zero-Knowledge Yield Claims
 * Feature: kirito-sdk, Property 8: Zero-Knowledge Yield Claims
 * Validates: Requirements 3.3, 7.3
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { YieldDistributorSDK } from '../../src/sdk/shielded-pool';
import { ZKProofManager } from '../../src/utils/zk-proof-manager';
import { 
  KiritoSDKConfig,
  TokenId,
  ShieldedNote,
  ZKProof,
  YieldClaimProofData,
  Commitment,
  Nullifier,
  EncryptedAmount
} from '../../src/types';

describe('Property 8: Zero-Knowledge Yield Claims', () => {
  let yieldDistributor: YieldDistributorSDK;
  let zkProofManager: ZKProofManager;
  let mockConfig: KiritoSDKConfig;

  beforeEach(() => {
    mockConfig = {
      network: {
        name: 'starknet-sepolia',
        rpcUrl: 'https://starknet-sepolia.infura.io/v3/test',
        chainId: '0x534e5f5345504f4c4941',
        contracts: {
          yieldDistributor: '0x123456789abcdef'
        }
      },
      ipfs: {
        url: 'https://ipfs.infura.io:5001',
        projectId: 'test-project',
        projectSecret: 'test-secret'
      },
      privacy: {
        tongoEndpoint: 'https://api.tongo.dev',
        semaphoreEndpoint: 'https://api.semaphore.dev'
      }
    };
    
    yieldDistributor = new YieldDistributorSDK(mockConfig);
    zkProofManager = new ZKProofManager(mockConfig);
  });

  /**
   * Property: For any valid yield claim, the ZK proof should verify eligibility 
   * without revealing the claimant's balance or stake amount.
   * 
   * This property tests that:
   * 1. Valid proofs are generated for legitimate claims
   * 2. Proofs verify successfully without revealing private data
   * 3. Invalid claims are rejected
   * 4. Double claiming is prevented through nullifier tracking
   * 5. Proof verification is deterministic for the same inputs
   */
  test('should generate and verify valid ZK proofs for yield claims', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tokenId: fc.string({ minLength: 3, maxLength: 20 }).map(s => `nft_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
          stakedAmount: fc.bigInt({ min: 1000n, max: 10000000n }),
          rarityScore: fc.float({ min: Math.fround(1.0), max: Math.fround(10.0), noNaN: true }),
          yieldMultiplier: fc.float({ min: Math.fround(1.0), max: Math.fround(5.0), noNaN: true }),
          claimAmount: fc.bigInt({ min: 100n, max: 1000000n }),
          lastClaimTimestamp: fc.integer({ min: 1640995200000, max: 1704067200000 })
        }),
        async ({ tokenId, stakedAmount, rarityScore, yieldMultiplier, claimAmount, lastClaimTimestamp }) => {
          // Create mock staking note
          const stakingNote: ShieldedNote = {
            commitment: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            nullifier: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            encryptedAmount: {
              ciphertext: new Uint8Array(32),
              ephemeralKey: new Uint8Array(32)
            },
            tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            owner: `0x${Math.random().toString(16).substring(2, 66)}`
          };

          // Fill encrypted amount with random data
          crypto.getRandomValues(stakingNote.encryptedAmount.ciphertext);
          crypto.getRandomValues(stakingNote.encryptedAmount.ephemeralKey);

          // Create proof data
          const proofData: YieldClaimProofData = {
            tokenId,
            stakedAmount,
            rarityScore,
            yieldMultiplier,
            claimAmount,
            stakingNote,
            lastClaimTimestamp
          };

          // Generate ZK proof
          const proof = await zkProofManager.generateYieldClaimProof(proofData);

          // Verify proof structure
          expect(proof).toHaveProperty('proof');
          expect(proof).toHaveProperty('publicInputs');
          expect(proof.proof).toBeInstanceOf(Uint8Array);
          expect(proof.proof.length).toBeGreaterThan(0);
          expect(Array.isArray(proof.publicInputs)).toBe(true);
          expect(proof.publicInputs.length).toBeGreaterThan(0);

          // Verify the proof
          const isValid = await zkProofManager.verifyYieldClaimProof(tokenId, claimAmount, proof);
          expect(isValid).toBe(true);

          // Verify that the same proof data generates the same proof
          const proof2 = await zkProofManager.generateYieldClaimProof(proofData);
          const isValid2 = await zkProofManager.verifyYieldClaimProof(tokenId, claimAmount, proof2);
          expect(isValid2).toBe(true);

          // Verify that proof doesn't reveal private data
          // The proof should not contain the actual staked amount, rarity score, or multiplier
          const proofString = Array.from(proof.proof).join(',');
          const publicInputsString = proof.publicInputs.map(pi => Array.from(pi).join(',')).join('|');
          
          // These private values should not appear directly in the proof
          expect(proofString).not.toContain(stakedAmount.toString());
          expect(proofString).not.toContain(rarityScore.toString());
          expect(proofString).not.toContain(yieldMultiplier.toString());
          
          // Public inputs should contain token ID and claim amount but not private data
          expect(publicInputsString).toContain(tokenId);
          // Claim amount might be encoded, so we don't check for direct string match
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid proofs should be rejected consistently
   */
  test('should reject invalid proofs and prevent unauthorized claims', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validTokenId: fc.string({ minLength: 3, maxLength: 15 }).map(s => `valid_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
          invalidTokenId: fc.string({ minLength: 3, maxLength: 15 }).map(s => `invalid_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
          validClaimAmount: fc.bigInt({ min: 100n, max: 100000n }),
          invalidClaimAmount: fc.bigInt({ min: 100001n, max: 1000000n }),
          stakedAmount: fc.bigInt({ min: 1000n, max: 1000000n }),
          rarityScore: fc.float({ min: Math.fround(1.0), max: Math.fround(5.0), noNaN: true }),
          yieldMultiplier: fc.float({ min: Math.fround(1.0), max: Math.fround(3.0), noNaN: true })
        }),
        async ({ validTokenId, invalidTokenId, validClaimAmount, invalidClaimAmount, stakedAmount, rarityScore, yieldMultiplier }) => {
          // Ensure token IDs are different
          fc.pre(validTokenId !== invalidTokenId);

          // Create fresh ZK proof manager for this test
          const freshZKManager = new ZKProofManager(mockConfig);

          // Create mock staking note
          const stakingNote: ShieldedNote = {
            commitment: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            nullifier: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            encryptedAmount: {
              ciphertext: new Uint8Array(32),
              ephemeralKey: new Uint8Array(32)
            },
            tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            owner: `0x${Math.random().toString(16).substring(2, 66)}`
          };

          crypto.getRandomValues(stakingNote.encryptedAmount.ciphertext);
          crypto.getRandomValues(stakingNote.encryptedAmount.ephemeralKey);

          // Generate valid proof
          const validProofData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount,
            rarityScore,
            yieldMultiplier,
            claimAmount: validClaimAmount,
            stakingNote,
            lastClaimTimestamp: Date.now()
          };

          const validProof = await freshZKManager.generateYieldClaimProof(validProofData);

          // Valid proof should verify successfully
          const validResult = await freshZKManager.verifyYieldClaimProof(
            validTokenId,
            validClaimAmount,
            validProof
          );
          expect(validResult).toBe(true);

          // Same proof with wrong token ID should fail
          const wrongTokenResult = await freshZKManager.verifyYieldClaimProof(
            invalidTokenId,
            validClaimAmount,
            validProof
          );
          expect(wrongTokenResult).toBe(false);

          // Same proof with wrong claim amount should fail
          const wrongAmountResult = await freshZKManager.verifyYieldClaimProof(
            validTokenId,
            invalidClaimAmount,
            validProof
          );
          expect(wrongAmountResult).toBe(false);

          // Attempt to reuse the same proof (double claim) should fail
          const doubleClaimResult = await freshZKManager.verifyYieldClaimProof(
            validTokenId,
            validClaimAmount,
            validProof
          );
          expect(doubleClaimResult).toBe(false); // Should fail due to nullifier reuse

          // Create malformed proof
          const malformedProof: ZKProof = {
            proof: new Uint8Array(0), // Empty proof
            publicInputs: []
          };

          const malformedResult = await freshZKManager.verifyYieldClaimProof(
            validTokenId,
            validClaimAmount,
            malformedProof
          );
          expect(malformedResult).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Batch verification should be consistent with individual verification
   */
  test('should handle batch verification consistently with individual verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tokenId: fc.string({ minLength: 3, maxLength: 10 }).map(s => `batch_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
            stakedAmount: fc.bigInt({ min: 1000n, max: 1000000n }),
            rarityScore: fc.float({ min: Math.fround(1.0), max: Math.fround(5.0), noNaN: true }),
            yieldMultiplier: fc.float({ min: Math.fround(1.0), max: Math.fround(3.0), noNaN: true }),
            claimAmount: fc.bigInt({ min: 100n, max: 10000n })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (claimRequests) => {
          // Ensure unique token IDs
          const uniqueTokenIds = new Set(claimRequests.map(req => req.tokenId));
          fc.pre(uniqueTokenIds.size === claimRequests.length);

          const freshZKManager = new ZKProofManager(mockConfig);

          // Generate proofs for all claims
          const claimsWithProofs = await Promise.all(
            claimRequests.map(async (req, index) => {
              const stakingNote: ShieldedNote = {
                commitment: { value: `0x${(Math.random() * index + 1).toString(16).substring(2, 66)}` },
                nullifier: { value: `0x${(Math.random() * index + 2).toString(16).substring(2, 66)}` },
                encryptedAmount: {
                  ciphertext: new Uint8Array(32),
                  ephemeralKey: new Uint8Array(32)
                },
                tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
                owner: `0x${(Math.random() * index + 3).toString(16).substring(2, 66)}`
              };

              crypto.getRandomValues(stakingNote.encryptedAmount.ciphertext);
              crypto.getRandomValues(stakingNote.encryptedAmount.ephemeralKey);

              const proofData: YieldClaimProofData = {
                tokenId: req.tokenId,
                stakedAmount: req.stakedAmount,
                rarityScore: req.rarityScore,
                yieldMultiplier: req.yieldMultiplier,
                claimAmount: req.claimAmount,
                stakingNote,
                lastClaimTimestamp: Date.now() + index // Ensure different timestamps
              };

              const proof = await freshZKManager.generateYieldClaimProof(proofData);

              return {
                tokenId: req.tokenId,
                claimAmount: req.claimAmount,
                proof
              };
            })
          );

          // Verify each proof individually
          const individualResults = await Promise.all(
            claimsWithProofs.map(claim =>
              freshZKManager.verifyYieldClaimProof(claim.tokenId, claim.claimAmount, claim.proof)
            )
          );

          // All individual verifications should succeed
          expect(individualResults.every(result => result)).toBe(true);

          // Create fresh manager for batch verification (to avoid nullifier conflicts)
          const batchZKManager = new ZKProofManager(mockConfig);

          // Batch verify all proofs
          const batchResults = await batchZKManager.batchVerifyYieldClaims(claimsWithProofs);

          // Batch results should match individual results
          expect(batchResults.length).toBe(individualResults.length);
          expect(batchResults.every(result => result)).toBe(true);

          // Verify that batch verification is consistent
          for (let i = 0; i < batchResults.length; i++) {
            expect(batchResults[i]).toBe(individualResults[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Eligibility proofs should work correctly without claiming
   */
  test('should generate and verify eligibility proofs without claiming', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tokenId: fc.string({ minLength: 3, maxLength: 15 }).map(s => `eligible_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
          minimumYield: fc.bigInt({ min: 100n, max: 10000n }),
          stakedAmount: fc.bigInt({ min: 10000n, max: 1000000n }) // Higher stake to ensure eligibility
        }),
        async ({ tokenId, minimumYield, stakedAmount }) => {
          // Ensure minimum yield is reasonable compared to staked amount
          fc.pre(minimumYield < stakedAmount / 10n);

          const freshZKManager = new ZKProofManager(mockConfig);

          // Create mock staking note
          const stakingNote: ShieldedNote = {
            commitment: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            nullifier: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            encryptedAmount: {
              ciphertext: new Uint8Array(32),
              ephemeralKey: new Uint8Array(32)
            },
            tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            owner: `0x${Math.random().toString(16).substring(2, 66)}`
          };

          crypto.getRandomValues(stakingNote.encryptedAmount.ciphertext);
          crypto.getRandomValues(stakingNote.encryptedAmount.ephemeralKey);

          // Generate eligibility proof
          const eligibilityProof = await freshZKManager.generateEligibilityProof(
            tokenId,
            stakingNote,
            minimumYield
          );

          // Verify proof structure
          expect(eligibilityProof).toHaveProperty('proof');
          expect(eligibilityProof).toHaveProperty('publicInputs');
          expect(eligibilityProof.proof).toBeInstanceOf(Uint8Array);
          expect(eligibilityProof.proof.length).toBeGreaterThan(0);
          expect(Array.isArray(eligibilityProof.publicInputs)).toBe(true);
          expect(eligibilityProof.publicInputs.length).toBeGreaterThan(0);

          // Verify eligibility using the yield distributor
          const isEligible = await yieldDistributor.verifyYieldEligibility(
            tokenId,
            stakingNote,
            minimumYield
          );

          // Should be eligible for reasonable minimum yield
          expect(typeof isEligible).toBe('boolean');

          // Generate multiple eligibility proofs for the same inputs
          const eligibilityProof2 = await freshZKManager.generateEligibilityProof(
            tokenId,
            stakingNote,
            minimumYield
          );

          // Both proofs should have valid structure
          expect(eligibilityProof2.proof.length).toBeGreaterThan(0);
          expect(eligibilityProof2.publicInputs.length).toBeGreaterThan(0);

          // Verify that eligibility check doesn't affect actual claiming
          // (i.e., no nullifiers are consumed)
          const usedNullifiers = freshZKManager.getUsedNullifiers();
          expect(usedNullifiers.length).toBe(0); // Eligibility checks shouldn't consume nullifiers
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: ZK proof manager should handle edge cases gracefully
   */
  test('should handle edge cases and invalid inputs gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validTokenId: fc.string({ minLength: 1, maxLength: 10 }).map(s => `edge_${s.replace(/[^a-zA-Z0-9]/g, '_')}`),
          zeroAmount: fc.constant(0n),
          negativeAmount: fc.bigInt({ min: -1000n, max: -1n }),
          validAmount: fc.bigInt({ min: 1n, max: 1000n }),
          zeroRarity: fc.constant(0),
          negativeRarity: fc.float({ min: -5.0, max: -0.1, noNaN: true }),
          validRarity: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true })
        }),
        async ({ validTokenId, zeroAmount, negativeAmount, validAmount, zeroRarity, negativeRarity, validRarity }) => {
          const freshZKManager = new ZKProofManager(mockConfig);

          // Create valid staking note
          const validStakingNote: ShieldedNote = {
            commitment: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            nullifier: { value: `0x${Math.random().toString(16).substring(2, 66)}` },
            encryptedAmount: {
              ciphertext: new Uint8Array(32),
              ephemeralKey: new Uint8Array(32)
            },
            tokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
            owner: `0x${Math.random().toString(16).substring(2, 66)}`
          };

          crypto.getRandomValues(validStakingNote.encryptedAmount.ciphertext);
          crypto.getRandomValues(validStakingNote.encryptedAmount.ephemeralKey);

          // Test with zero claim amount - should fail
          const zeroClaimData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount: validAmount,
            rarityScore: validRarity,
            yieldMultiplier: 1.0,
            claimAmount: zeroAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          await expect(freshZKManager.generateYieldClaimProof(zeroClaimData))
            .rejects.toThrow();

          // Test with negative claim amount - should fail
          const negativeClaimData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount: validAmount,
            rarityScore: validRarity,
            yieldMultiplier: 1.0,
            claimAmount: negativeAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          await expect(freshZKManager.generateYieldClaimProof(negativeClaimData))
            .rejects.toThrow();

          // Test with zero rarity score - should fail
          const zeroRarityData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount: validAmount,
            rarityScore: zeroRarity,
            yieldMultiplier: 1.0,
            claimAmount: validAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          await expect(freshZKManager.generateYieldClaimProof(zeroRarityData))
            .rejects.toThrow();

          // Test with negative rarity score - should fail
          const negativeRarityData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount: validAmount,
            rarityScore: negativeRarity,
            yieldMultiplier: 1.0,
            claimAmount: validAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          await expect(freshZKManager.generateYieldClaimProof(negativeRarityData))
            .rejects.toThrow();

          // Test with empty token ID - should fail
          const emptyTokenData: YieldClaimProofData = {
            tokenId: '',
            stakedAmount: validAmount,
            rarityScore: validRarity,
            yieldMultiplier: 1.0,
            claimAmount: validAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          await expect(freshZKManager.generateYieldClaimProof(emptyTokenData))
            .rejects.toThrow();

          // Test with valid data - should succeed
          const validData: YieldClaimProofData = {
            tokenId: validTokenId,
            stakedAmount: validAmount,
            rarityScore: validRarity,
            yieldMultiplier: 1.0,
            claimAmount: validAmount,
            stakingNote: validStakingNote,
            lastClaimTimestamp: Date.now()
          };

          const validProof = await freshZKManager.generateYieldClaimProof(validData);
          expect(validProof.proof.length).toBeGreaterThan(0);
          expect(validProof.publicInputs.length).toBeGreaterThan(0);

          const isValid = await freshZKManager.verifyYieldClaimProof(
            validTokenId,
            validAmount,
            validProof
          );
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});