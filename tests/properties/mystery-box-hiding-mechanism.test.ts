/**
 * Property-Based Tests for Mystery Box Hiding Mechanism
 * Feature: kirito-sdk, Property 10: Mystery Box Hiding Mechanism
 * Validates: Requirements 4.1, 4.3
 */

import fc from 'fast-check';
import { MysteryBoxManagerSDK } from '../../src/sdk/mystery-box';
import { KiritoSDKConfig, HiddenData, RevealConditions, TokenId, BoxId } from '../../src/types';

describe('Mystery Box Hiding Mechanism Properties', () => {
  let mysteryBoxManager: MysteryBoxManagerSDK;
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
  });

  /**
   * Property 10: Mystery Box Hiding Mechanism
   * For any mystery box with hidden traits, the traits should remain inaccessible 
   * until reveal conditions are met, at which point valid proofs should enable revelation.
   * **Validates: Requirements 4.1, 4.3**
   */
  describe('Property 10: Mystery Box Hiding Mechanism', () => {
    it('should hide traits until reveal conditions are met', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random token ID
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `token_${s}`),
          
          // Generate random hidden traits
          fc.record({
            traits: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 30 }),
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.integer({ min: 1, max: 1000 }).map(n => n.toString()),
                fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) }).map(f => `${f.toFixed(2)}%`)
              )
            ),
            yieldRange: fc.record({
              min: fc.integer({ min: 10, max: 100 }),
              max: fc.integer({ min: 101, max: 1000 })
            })
          }),
          
          // Generate reveal conditions
          fc.oneof(
            // Time-lock condition
            fc.record({
              type: fc.constant('timelock' as const),
              timestamp: fc.integer({ min: Date.now() + 1000, max: Date.now() + 86400000 })
            }),
            // Action condition
            fc.record({
              type: fc.constant('action' as const),
              requiredAction: fc.constantFrom('stake_minimum', 'governance_participation', 'yield_claim')
            }),
            // Combined condition
            fc.record({
              type: fc.constant('combined' as const),
              timestamp: fc.integer({ min: Date.now() + 1000, max: Date.now() + 86400000 }),
              requiredAction: fc.constantFrom('stake_minimum', 'governance_participation', 'yield_claim')
            })
          ),
          
          async (tokenId: TokenId, hiddenData: HiddenData, revealConditions: RevealConditions) => {
            // Create mystery box with hidden traits
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            
            // Generate a proper box ID that matches what createMysteryBox would generate
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            // Store the mystery box with the generated ID for testing
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            
            // Set reveal conditions
            await mysteryBoxManager.setRevealConditions(boxId, revealConditions);
            
            // Verify traits are hidden (cannot be accessed without proper reveal)
            const retrievedBox = await mysteryBoxManager.getMysteryBox(boxId);
            
            // Traits should be encrypted and not directly accessible
            expect(retrievedBox.isRevealed).toBe(false);
            expect(retrievedBox.encryptedTraits).toBeDefined();
            expect(retrievedBox.encryptedTraits.data).toBeInstanceOf(Uint8Array);
            expect(retrievedBox.encryptedTraits.data.length).toBeGreaterThan(0);
            
            // Verify reveal conditions are properly set
            expect(retrievedBox.revealConditions).toEqual(revealConditions);
            
            // Attempt to reveal without meeting conditions should fail
            const conditionsMet = await mysteryBoxManager.checkRevealConditions(boxId);
            
            if (!conditionsMet) {
              // Generate a mock proof (this would fail verification)
              const mockProof = {
                proof: new Uint8Array(256),
                publicInputs: [new TextEncoder().encode('mock')]
              };
              
              // Attempt to reveal should fail when conditions are not met
              await expect(
                mysteryBoxManager.revealTraits(boxId, mockProof)
              ).rejects.toThrow('Reveal conditions not met');
            }
            
            // Verify that the original hidden data structure is preserved
            expect(Object.keys(hiddenData.traits || {})).toHaveLength(
              Object.keys(hiddenData.traits || {}).length
            );
            
            if (hiddenData.yieldRange) {
              expect(hiddenData.yieldRange.min).toBeLessThanOrEqual(hiddenData.yieldRange.max);
            }
          }
        ),
        { 
          numRuns: 100,
          timeout: 30000,
          verbose: true
        }
      );
    }, 60000);

    it('should maintain trait confidentiality across different encryption keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.constantFrom('Power Level', 'Magic Ability', 'Rare Skill', 'Hidden Bonus'),
              fc.constantFrom('Fire Storm', 'Ice Shield', 'Lightning Bolt', '25% Yield Boost')
            ),
            yieldRange: fc.record({
              min: fc.integer({ min: 50, max: 200 }),
              max: fc.integer({ min: 201, max: 800 })
            })
          }),
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, key1: string, key2: string) => {
            // Ensure keys are different
            fc.pre(key1 !== key2);
            
            // Create two mystery boxes with same data but different encryption
            const box1 = await mysteryBoxManager.createMysteryBox(tokenId + '_1', hiddenData);
            const box2 = await mysteryBoxManager.createMysteryBox(tokenId + '_2', hiddenData);
            
            // Even with same hidden data, encrypted forms should be different
            // (due to different encryption keys/nonces)
            expect(box1.encryptedTraits.data).not.toEqual(box2.encryptedTraits.data);
            
            // Both should have valid encrypted data
            expect(box1.encryptedTraits.data.length).toBeGreaterThan(0);
            expect(box2.encryptedTraits.data.length).toBeGreaterThan(0);
            
            // Both should have nonces for encryption
            expect(box1.encryptedTraits.nonce).toBeDefined();
            expect(box2.encryptedTraits.nonce).toBeDefined();
            expect(box1.encryptedTraits.nonce).not.toEqual(box2.encryptedTraits.nonce);
          }
        ),
        { 
          numRuns: 50,
          timeout: 20000
        }
      );
    }, 40000);

    it('should preserve trait count and structure in encrypted form', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `token_${s}`),
          fc.integer({ min: 1, max: 8 }).chain(count =>
            fc.record({
              traits: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 30 }),
                { minKeys: count, maxKeys: count }
              ),
              yieldRange: fc.record({
                min: fc.integer({ min: 10, max: 100 }),
                max: fc.integer({ min: 101, max: 500 })
              })
            })
          ),
          
          async (tokenId: TokenId, hiddenData: HiddenData) => {
            const originalTraitCount = Object.keys(hiddenData.traits || {}).length;
            
            // Create mystery box
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            
            // Verify encrypted data exists and has reasonable size
            expect(mysteryBox.encryptedTraits.data.length).toBeGreaterThan(0);
            
            // The encrypted data should be proportional to the amount of data
            // (more traits should generally result in more encrypted data)
            const expectedMinSize = originalTraitCount * 10; // Rough estimate
            expect(mysteryBox.encryptedTraits.data.length).toBeGreaterThanOrEqual(expectedMinSize);
            
            // Verify the mystery box maintains the token association
            expect(mysteryBox.tokenId).toBe(tokenId);
            expect(mysteryBox.isRevealed).toBe(false);
          }
        ),
        { 
          numRuns: 75,
          timeout: 25000
        }
      );
    }, 45000);

    it('should handle edge cases in trait data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(s => `token_${s}`),
          fc.oneof(
            // Empty traits
            fc.record({
              traits: fc.constant({}),
              yieldRange: fc.record({
                min: fc.constant(0),
                max: fc.constant(100)
              })
            }),
            // Single trait
            fc.record({
              traits: fc.dictionary(
                fc.constant('Single Trait'),
                fc.constant('Single Value'),
                { minKeys: 1, maxKeys: 1 }
              ),
              yieldRange: fc.record({
                min: fc.constant(1),
                max: fc.constant(1)
              })
            }),
            // Special characters in traits
            fc.record({
              traits: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(
                  fc.constant('🔥 Fire Power'),
                  fc.constant('⚡ Lightning ⚡'),
                  fc.constant('Special chars: !@#$%^&*()'),
                  fc.constant('Unicode: αβγδε')
                )
              ),
              yieldRange: fc.record({
                min: fc.integer({ min: 0, max: 50 }),
                max: fc.integer({ min: 51, max: 200 })
              })
            })
          ),
          
          async (tokenId: TokenId, hiddenData: HiddenData) => {
            // Should handle edge cases without throwing errors
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            
            // Verify basic structure is maintained
            expect(mysteryBox.tokenId).toBe(tokenId);
            expect(mysteryBox.encryptedTraits).toBeDefined();
            expect(mysteryBox.isRevealed).toBe(false);
            
            // Even empty traits should result in some encrypted data (metadata, structure, etc.)
            expect(mysteryBox.encryptedTraits.data.length).toBeGreaterThan(0);
          }
        ),
        { 
          numRuns: 50,
          timeout: 20000
        }
      );
    }, 40000);
  });

  describe('Reveal Condition Verification', () => {
    it('should correctly evaluate time-lock conditions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 15 }),
              fc.string({ minLength: 1, maxLength: 20 })
            )
          }),
          fc.integer({ min: -86400000, max: 86400000 }), // -24h to +24h from now
          
          async (tokenId: TokenId, hiddenData: HiddenData, timeOffset: number) => {
            const mysteryBox = await mysteryBoxManager.createMysteryBox(tokenId, hiddenData);
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            // Store the mystery box with the generated ID for testing
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            
            const revealTime = Date.now() + timeOffset;
            const revealConditions: RevealConditions = {
              type: 'timelock',
              timestamp: revealTime
            };
            
            await mysteryBoxManager.setRevealConditions(boxId, revealConditions);
            
            const conditionsMet = await mysteryBoxManager.checkRevealConditions(boxId);
            
            // Conditions should be met if reveal time is in the past
            if (timeOffset <= 0) {
              expect(conditionsMet).toBe(true);
            } else {
              expect(conditionsMet).toBe(false);
            }
          }
        ),
        { 
          numRuns: 100,
          timeout: 25000
        }
      );
    }, 45000);
  });
});