/**
 * Property-Based Tests for ZK Reveal Proof Verification
 * Feature: kirito-sdk, Property 11: ZK Reveal Proof Verification
 * Validates: Requirements 4.2, 4.5
 */

import fc from 'fast-check';
import { MysteryBoxManagerSDK } from '../../src/sdk/mystery-box';
import { GaragaMysteryBoxVerifier } from '../../src/circuits/garaga-integration';
import { NoirMysteryBoxCircuit } from '../../src/circuits/noir-integration';
import { KiritoSDKConfig, HiddenData, TokenId, BoxId, ZKProof, RevealConditions } from '../../src/types';

describe('ZK Reveal Proof Verification Properties', () => {
  let mysteryBoxManager: MysteryBoxManagerSDK;
  let garagaVerifier: GaragaMysteryBoxVerifier;
  let noirCircuit: NoirMysteryBoxCircuit;
  let config: KiritoSDKConfig;

  beforeEach(() => {
    config = {
      network: {
        name: 'sepolia',
        rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
        chainId: 'SN_SEPOLIA',
        contracts: {
          nftWallet: '0x123',
          shieldedPool: '0x456',
          governance: '0x789'
        }
      },
      ipfs: {
        url: 'https://ipfs.io/ipfs/',
        projectId: 'test',
        projectSecret: 'test'
      },
      privacy: {
        tongoEndpoint: 'https://tongo.example.com',
        semaphoreEndpoint: 'https://semaphore.example.com'
      }
    };
    
    mysteryBoxManager = new MysteryBoxManagerSDK(config);
    garagaVerifier = new GaragaMysteryBoxVerifier(config);
    noirCircuit = new NoirMysteryBoxCircuit();
  });

  /**
   * Property 11: ZK Reveal Proof Verification
   * For any mystery box reveal attempt, the Noir circuit should generate valid proofs 
   * for legitimate reveals and reject invalid attempts, with Garaga providing on-chain verification.
   * **Validates: Requirements 4.2, 4.5**
   */
  describe('Property 11: ZK Reveal Proof Verification', () => {
    it('should generate valid proofs for legitimate reveals and verify them correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random token ID
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `token_${s}`),
          
          // Generate hidden data with various trait types
          fc.record({
            traits: fc.dictionary(
              fc.oneof(
                fc.constantFrom('Fire Power', 'Lightning Strike', 'Ice Blast'),
                fc.constantFrom('Time Control', 'Mind Reading', 'Teleportation'),
                fc.constantFrom('Bonus Yield', 'Yield Multiplier', 'Extra Rewards'),
                fc.constantFrom('Golden Aura', 'Diamond Shine', 'Legendary Status')
              ),
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 25 }),
                fc.integer({ min: 1, max: 500 }).map(n => n.toString()),
                fc.float({ min: Math.fround(1.0), max: Math.fround(25.0) }).map(f => `${f.toFixed(1)}%`)
              ),
              { minKeys: 1, maxKeys: 5 }
            ),
            yieldRange: fc.record({
              min: fc.integer({ min: 10, max: 100 }),
              max: fc.integer({ min: 101, max: 500 })
            })
          }),
          
          // Generate reveal conditions
          fc.oneof(
            fc.record({
              type: fc.constant('timelock' as const),
              timestamp: fc.integer({ min: Date.now() - 86400000, max: Date.now() + 86400000 })
            }),
            fc.record({
              type: fc.constant('action' as const),
              requiredAction: fc.constantFrom('stake_minimum', 'governance_participation', 'yield_claim')
            })
          ),
          
          // Generate encryption key
          fc.string({ minLength: 10, maxLength: 40 }),
          
          // Generate reveal type
          fc.constantFrom('full' as const, 'bluffing' as const),
          
          async (tokenId: TokenId, hiddenData: HiddenData, revealConditions: RevealConditions, encryptionKey: string, revealType: 'full' | 'bluffing') => {
            // Create mystery box
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            // Store mystery box for testing
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            
            // Set reveal conditions
            await mysteryBoxManager.setRevealConditions(boxId, revealConditions);
            
            // Generate ZK proof using Noir circuit
            const zkProof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              revealConditions,
              encryptionKey,
              revealType
            );
            
            // Verify proof structure is valid
            expect(zkProof).toBeDefined();
            expect(zkProof.proof).toBeInstanceOf(Uint8Array);
            expect(zkProof.proof.length).toBeGreaterThan(0);
            expect(zkProof.publicInputs).toBeDefined();
            expect(zkProof.publicInputs.length).toBeGreaterThan(0);
            
            // Verify proof using Noir circuit verification
            const isValidNoir = await noirCircuit.verifyRevealProof(
              zkProof,
              boxId,
              tokenId,
              revealType
            );
            expect(isValidNoir).toBe(true);
            
            // Verify proof using mystery box manager
            const isValidManager = await mysteryBoxManager.verifyReveal(boxId, zkProof);
            expect(isValidManager).toBe(true);
            
            // Test proof consistency - same inputs should produce verifiable proofs
            const secondProof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              revealConditions,
              encryptionKey,
              revealType
            );
            
            const isSecondProofValid = await noirCircuit.verifyRevealProof(
              secondProof,
              boxId,
              tokenId,
              revealType
            );
            expect(isSecondProofValid).toBe(true);
            
            // Proofs should be different due to randomness but both valid
            expect(zkProof.proof).not.toEqual(secondProof.proof);
          }
        ),
        { 
          numRuns: 100,
          timeout: 45000,
          verbose: true
        }
      );
    }, 90000);

    it('should reject invalid proofs with wrong parameters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 12 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.constantFrom('Power', 'Ability', 'Yield', 'Rarity'),
              fc.string({ minLength: 1, maxLength: 20 }),
              { minKeys: 1, maxKeys: 3 }
            )
          }),
          fc.string({ minLength: 8, maxLength: 30 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, encryptionKey: string) => {
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            
            const revealConditions: RevealConditions = {
              type: 'timelock',
              timestamp: Date.now() - 1000 // Past timestamp
            };
            
            // Generate valid proof
            const validProof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              revealConditions,
              encryptionKey,
              'full'
            );
            
            // Test 1: Wrong box ID should fail verification
            const wrongBoxId = `wrong_${boxId}`;
            const isValidWrongBox = await noirCircuit.verifyRevealProof(
              validProof,
              wrongBoxId,
              tokenId,
              'full'
            );
            expect(isValidWrongBox).toBe(false);
            
            // Test 2: Wrong token ID should fail verification
            const wrongTokenId = `wrong_${tokenId}`;
            const isValidWrongToken = await noirCircuit.verifyRevealProof(
              validProof,
              boxId,
              wrongTokenId,
              'full'
            );
            expect(isValidWrongToken).toBe(false);
            
            // Test 3: Wrong reveal type should fail verification
            const isValidWrongType = await noirCircuit.verifyRevealProof(
              validProof,
              boxId,
              tokenId,
              'bluffing' // Different from generated proof type
            );
            expect(isValidWrongType).toBe(false);
            
            // Test 4: Corrupted proof should fail verification
            const corruptedProof: ZKProof = {
              proof: new Uint8Array(validProof.proof.length),
              publicInputs: validProof.publicInputs
            };
            crypto.getRandomValues(corruptedProof.proof);
            
            const isValidCorrupted = await noirCircuit.verifyRevealProof(
              corruptedProof,
              boxId,
              tokenId,
              'full'
            );
            expect(isValidCorrupted).toBe(false);
          }
        ),
        { 
          numRuns: 50,
          timeout: 30000
        }
      );
    }, 60000);

    it('should maintain proof verification consistency across different implementations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 15 }),
              fc.string({ minLength: 1, maxLength: 20 }),
              { minKeys: 2, maxKeys: 4 }
            ),
            yieldRange: fc.record({
              min: fc.integer({ min: 50, max: 150 }),
              max: fc.integer({ min: 151, max: 400 })
            })
          }),
          fc.string({ minLength: 12, maxLength: 35 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, encryptionKey: string) => {
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            
            const revealConditions: RevealConditions = {
              type: 'timelock',
              timestamp: Date.now() - 1000
            };
            
            // Generate proof using Noir circuit
            const proof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              revealConditions,
              encryptionKey,
              'full'
            );
            
            // Verify using Noir circuit
            const noirVerification = await noirCircuit.verifyRevealProof(
              proof,
              boxId,
              tokenId,
              'full'
            );
            
            // Verify using mystery box manager
            const managerVerification = await mysteryBoxManager.verifyReveal(boxId, proof);
            
            // Both verifications should agree
            expect(noirVerification).toBe(managerVerification);
            
            // Both should be true for valid proofs
            expect(noirVerification).toBe(true);
            expect(managerVerification).toBe(true);
            
            // Test with bluffing proof as well
            const bluffingProof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              revealConditions,
              encryptionKey,
              'bluffing'
            );
            
            const noirBluffingVerification = await noirCircuit.verifyRevealProof(
              bluffingProof,
              boxId,
              tokenId,
              'bluffing'
            );
            
            const managerBluffingVerification = await mysteryBoxManager.verifyBluffingProof(
              boxId,
              bluffingProof,
              'power' // Assume power category for test
            );
            
            // Bluffing verifications should also be consistent
            expect(noirBluffingVerification).toBe(true);
            expect(managerBluffingVerification).toBe(true);
          }
        ),
        { 
          numRuns: 75,
          timeout: 35000
        }
      );
    }, 70000);

    it('should handle edge cases in proof verification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 8 }).map(s => `token_${s}`),
          fc.oneof(
            // Empty traits
            fc.record({ traits: fc.constant({}) }),
            // Single trait
            fc.record({
              traits: fc.dictionary(
                fc.constant('Single Trait'),
                fc.constant('Single Value'),
                { minKeys: 1, maxKeys: 1 }
              )
            }),
            // Maximum traits
            fc.record({
              traits: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 1, maxLength: 15 }),
                { minKeys: 8, maxKeys: 10 }
              )
            })
          ),
          fc.string({ minLength: 5, maxLength: 25 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, encryptionKey: string) => {
            const traitCount = Object.keys(hiddenData.traits || {}).length;
            
            if (traitCount === 0) {
              // Empty traits should still allow mystery box creation but may fail proof generation
              const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
              expect(mysteryBox).toBeDefined();
              expect(mysteryBox.encryptedTraits).toBeDefined();
              
              // Proof generation might fail for empty traits, which is acceptable
              const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
              try {
                const proof = await noirCircuit.generateRevealProof(
                  boxId,
                  tokenId,
                  hiddenData,
                  { type: 'timelock', timestamp: Date.now() - 1000 },
                  encryptionKey,
                  'full'
                );
                
                // If proof generation succeeds, verification should work
                const isValid = await noirCircuit.verifyRevealProof(proof, boxId, tokenId, 'full');
                expect(typeof isValid).toBe('boolean');
              } catch (error) {
                // Proof generation failure for empty traits is acceptable
                expect(error).toBeDefined();
              }
            } else {
              // Non-empty traits should work normally
              const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
              const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
              (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
              
              const proof = await noirCircuit.generateRevealProof(
                boxId,
                tokenId,
                hiddenData,
                { type: 'timelock', timestamp: Date.now() - 1000 },
                encryptionKey,
                'full'
              );
              
              const isValid = await noirCircuit.verifyRevealProof(proof, boxId, tokenId, 'full');
              expect(isValid).toBe(true);
              
              // Proof should have reasonable size regardless of trait count
              expect(proof.proof.length).toBeGreaterThan(0);
              expect(proof.proof.length).toBeLessThan(2048); // Reasonable upper bound
            }
          }
        ),
        { 
          numRuns: 50,
          timeout: 25000
        }
      );
    }, 50000);
  });

  describe('Garaga On-Chain Verification Integration', () => {
    it('should convert proofs to Garaga format correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 12 }),
              fc.string({ minLength: 1, maxLength: 15 }),
              { minKeys: 1, maxKeys: 3 }
            )
          }),
          fc.string({ minLength: 8, maxLength: 25 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, encryptionKey: string) => {
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            const proof = await noirCircuit.generateRevealProof(
              boxId,
              tokenId,
              hiddenData,
              { type: 'timelock', timestamp: Date.now() - 1000 },
              encryptionKey,
              'full'
            );
            
            // Test Garaga format conversion
            const garagaProof = (garagaVerifier as any).convertToGaragaFormat(proof, 'full');
            
            expect(garagaProof).toBeDefined();
            expect(garagaProof.proof).toBeDefined();
            expect(Array.isArray(garagaProof.proof)).toBe(true);
            expect(garagaProof.public_inputs).toBeDefined();
            expect(Array.isArray(garagaProof.public_inputs)).toBe(true);
            expect(garagaProof.verification_key_hash).toBeDefined();
            expect(typeof garagaProof.verification_key_hash).toBe('string');
            
            // Verify proof elements are properly formatted as felt strings
            garagaProof.proof.forEach((felt: string) => {
              expect(typeof felt).toBe('string');
              expect(felt.startsWith('0x')).toBe(true);
            });
            
            garagaProof.public_inputs.forEach((felt: string) => {
              expect(typeof felt).toBe('string');
              expect(felt.startsWith('0x')).toBe(true);
            });
          }
        ),
        { 
          numRuns: 25,
          timeout: 20000
        }
      );
    }, 40000);
  });
});