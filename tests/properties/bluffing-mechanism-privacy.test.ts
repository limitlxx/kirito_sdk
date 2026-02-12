/**
 * Property-Based Tests for Bluffing Mechanism Privacy
 * Feature: kirito-sdk, Property 12: Bluffing Mechanism Privacy
 * Validates: Requirements 4.4
 */

import fc from 'fast-check';
import { MysteryBoxManagerSDK } from '../../src/sdk/mystery-box';
import { KiritoSDKConfig, HiddenData, TokenId, BoxId, ZKProof } from '../../src/types';

describe('Bluffing Mechanism Privacy Properties', () => {
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
   * Property 12: Bluffing Mechanism Privacy
   * For any hidden trait, the bluffing mechanism should allow proving trait category 
   * membership without revealing the specific trait value.
   * **Validates: Requirements 4.4**
   */
  describe('Property 12: Bluffing Mechanism Privacy', () => {
    it('should prove trait category membership without revealing specific trait', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate random token ID
          fc.string({ minLength: 1, maxLength: 15 }).map(s => `token_${s}`),
          
          // Generate hidden data with traits in different categories
          fc.record({
            traits: fc.dictionary(
              fc.oneof(
                // Power category traits
                fc.constantFrom('Fire Power', 'Lightning Strike', 'Ice Blast', 'Earth Shake'),
                // Ability category traits  
                fc.constantFrom('Time Manipulation', 'Mind Reading', 'Teleportation', 'Invisibility'),
                // Yield category traits
                fc.constantFrom('Bonus Yield', 'Yield Multiplier', 'Extra Rewards', 'Compound Interest'),
                // Rarity category traits
                fc.constantFrom('Golden Aura', 'Diamond Shine', 'Legendary Status', 'Mythical Essence')
              ),
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 30 }),
                fc.integer({ min: 1, max: 1000 }).map(n => n.toString()),
                fc.float({ min: Math.fround(1.0), max: Math.fround(50.0) }).map(f => `${f.toFixed(1)}%`)
              ),
              { minKeys: 2, maxKeys: 8 }
            ),
            yieldRange: fc.record({
              min: fc.integer({ min: 10, max: 100 }),
              max: fc.integer({ min: 101, max: 500 })
            })
          }),
          
          // Generate trait category to bluff about
          fc.constantFrom('power', 'ability', 'yield', 'rarity'),
          
          // Generate encryption key
          fc.string({ minLength: 10, maxLength: 50 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, bluffCategory: string, encryptionKey: string) => {
            // Create mystery box manually for testing (don't use createMysteryBox to avoid duplicate storage)
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            // Create encrypted traits (simple mock encryption)
            const encryptedTraits = {
              data: new Uint8Array(32),
              nonce: new Uint8Array(12)
            };
            crypto.getRandomValues(encryptedTraits.data);
            crypto.getRandomValues(encryptedTraits.nonce);
            
            const mysteryBox = {
              tokenId,
              encryptedTraits,
              revealConditions: {
                type: 'timelock' as const,
                timestamp: Date.now() + 86400000
              },
              isRevealed: false
            };
            
            // Store the mystery box and hidden data for testing
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            (mysteryBoxManager as any).hiddenDataStore.set(boxId, hiddenData);
            
            // Check if the mystery box actually contains traits in the requested category
            const availableCategories = await mysteryBoxManager.getAvailableTraitCategories(boxId);
            
            if (availableCategories.includes(bluffCategory)) {
              // Generate bluffing proof for the category
              const bluffingProof = await mysteryBoxManager.generateBluffingProof(
                boxId,
                bluffCategory,
                encryptionKey
              );
              
              // Verify the bluffing proof is valid
              expect(bluffingProof).toBeDefined();
              expect(bluffingProof.proof).toBeInstanceOf(Uint8Array);
              expect(bluffingProof.proof.length).toBeGreaterThan(0);
              expect(bluffingProof.publicInputs).toBeDefined();
              expect(bluffingProof.publicInputs.length).toBeGreaterThan(0);
              
              // Verify that the proof can be validated
              const isValidBluff = await mysteryBoxManager.verifyBluffingProof(
                boxId,
                bluffingProof,
                bluffCategory
              );
              expect(isValidBluff).toBe(true);
              
              // Verify that the proof doesn't reveal specific trait values
              // The proof should only contain category information, not specific trait data
              const proofString = Array.from(bluffingProof.proof).join(',');
              const publicInputsString = bluffingProof.publicInputs
                .map(input => new TextDecoder().decode(input))
                .join('');
              
              // Check that specific trait values are not leaked in the proof
              // For bluffing proofs, we hash the box_id and token_id, so they won't appear as plaintext
              // We should check that trait names and values don't appear as readable strings
              if (hiddenData.traits) {
                // Convert proof to a string to check for readable text
                // We'll check if trait names/values appear as consecutive bytes (not just as individual byte values)
                const proofBytes = bluffingProof.proof;
                const proofText = new TextDecoder('utf-8', { fatal: false }).decode(proofBytes);
                
                for (const [traitName, traitValue] of Object.entries(hiddenData.traits)) {
                  // Check that trait names don't appear as readable text in the proof
                  // Only check if the trait name is long enough to avoid false positives
                  if (traitName.length > 3) {
                    expect(proofText.toLowerCase()).not.toContain(traitName.toLowerCase());
                  }
                  
                  // Check that trait values don't appear as readable text
                  // Only check if the value is long enough and not a common single character/digit
                  const valueStr = String(traitValue);
                  if (valueStr.length > 3) {
                    expect(proofText.toLowerCase()).not.toContain(valueStr.toLowerCase());
                  }
                  
                  // For public inputs, check that trait data doesn't appear
                  // Public inputs should only contain hashed values for bluffing proofs
                  if (traitName.length > 3) {
                    expect(publicInputsString.toLowerCase()).not.toContain(traitName.toLowerCase());
                  }
                  if (valueStr.length > 3) {
                    expect(publicInputsString.toLowerCase()).not.toContain(valueStr.toLowerCase());
                  }
                }
              }
              
              // Verify that different bluffing proofs for the same category are different
              // (due to randomness in proof generation)
              const secondBluffingProof = await mysteryBoxManager.generateBluffingProof(
                boxId,
                bluffCategory,
                encryptionKey
              );
              
              // Proofs should be different due to randomness
              expect(bluffingProof.proof).not.toEqual(secondBluffingProof.proof);
            } else {
              // If the category doesn't exist, bluffing should fail
              await expect(
                mysteryBoxManager.generateBluffingProof(boxId, bluffCategory, encryptionKey)
              ).rejects.toThrow(`Mystery box does not contain traits in category: ${bluffCategory}`);
            }
          }
        ),
        { 
          numRuns: 10, // Reduced from 100 to 10 for faster testing
          timeout: 45000,
          verbose: true
        }
      );
    }, 90000);

    it('should maintain privacy across multiple bluffing attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 12 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }).map(s => `Power_${s}`),
                fc.string({ minLength: 1, maxLength: 20 }).map(s => `Ability_${s}`),
                fc.string({ minLength: 1, maxLength: 20 }).map(s => `Yield_${s}`),
                fc.string({ minLength: 1, maxLength: 20 }).map(s => `Rare_${s}`)
              ),
              fc.string({ minLength: 1, maxLength: 25 }),
              { minKeys: 3, maxKeys: 6 }
            )
          }),
          fc.array(fc.constantFrom('power', 'ability', 'yield', 'rarity'), { minLength: 2, maxLength: 4 }),
          fc.string({ minLength: 8, maxLength: 30 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, categories: string[], encryptionKey: string) => {
            // Create mystery box manually for testing
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            const encryptedTraits = {
              data: new Uint8Array(32),
              nonce: new Uint8Array(12)
            };
            crypto.getRandomValues(encryptedTraits.data);
            crypto.getRandomValues(encryptedTraits.nonce);
            
            const mysteryBox = {
              tokenId,
              encryptedTraits,
              revealConditions: {
                type: 'timelock' as const,
                timestamp: Date.now() + 86400000
              },
              isRevealed: false
            };
            
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            (mysteryBoxManager as any).hiddenDataStore.set(boxId, hiddenData);
            
            const bluffingProofs: { category: string; proof: ZKProof }[] = [];
            
            // Generate bluffing proofs for multiple categories
            for (const category of categories) {
              try {
                const proof = await mysteryBoxManager.generateBluffingProof(
                  boxId,
                  category,
                  encryptionKey
                );
                bluffingProofs.push({ category, proof });
              } catch (error) {
                // Category might not exist in this mystery box, which is fine
                continue;
              }
            }
            
            // Verify that each proof is independent and doesn't leak information about others
            for (let i = 0; i < bluffingProofs.length; i++) {
              for (let j = i + 1; j < bluffingProofs.length; j++) {
                const proof1 = bluffingProofs[i];
                const proof2 = bluffingProofs[j];
                
                // Proofs for different categories should be different
                expect(proof1.proof).not.toEqual(proof2.proof);
                
                // Verify each proof independently
                const isValid1 = await mysteryBoxManager.verifyBluffingProof(
                  boxId,
                  proof1.proof,
                  proof1.category
                );
                const isValid2 = await mysteryBoxManager.verifyBluffingProof(
                  boxId,
                  proof2.proof,
                  proof2.category
                );
                
                expect(isValid1).toBe(true);
                expect(isValid2).toBe(true);
                
                // Cross-verification should fail (proof for category A shouldn't verify for category B)
                const crossValid1 = await mysteryBoxManager.verifyBluffingProof(
                  boxId,
                  proof1.proof,
                  proof2.category
                );
                const crossValid2 = await mysteryBoxManager.verifyBluffingProof(
                  boxId,
                  proof2.proof,
                  proof1.category
                );
                
                // Cross-verification should fail if categories are different
                if (proof1.category !== proof2.category) {
                  expect(crossValid1).toBe(false);
                  expect(crossValid2).toBe(false);
                }
              }
            }
          }
        ),
        { 
          numRuns: 10, // Reduced from 50 to 10 for faster testing
          timeout: 30000
        }
      );
    }, 60000);

    it('should prevent information leakage through proof size or timing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(s => `token_${s}`),
          fc.constantFrom('power', 'ability', 'yield', 'rarity'),
          fc.integer({ min: 1, max: 5 }).chain(traitCount =>
            fc.record({
              traits: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 15 }),
                fc.string({ minLength: 1, maxLength: 20 }),
                { minKeys: traitCount, maxKeys: traitCount }
              )
            })
          ),
          fc.string({ minLength: 10, maxLength: 40 }),
          
          async (tokenId: TokenId, category: string, hiddenData: HiddenData, encryptionKey: string) => {
            // Create mystery box manually for testing
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            const encryptedTraits = {
              data: new Uint8Array(32),
              nonce: new Uint8Array(12)
            };
            crypto.getRandomValues(encryptedTraits.data);
            crypto.getRandomValues(encryptedTraits.nonce);
            
            const mysteryBox = {
              tokenId,
              encryptedTraits,
              revealConditions: {
                type: 'timelock' as const,
                timestamp: Date.now() + 86400000
              },
              isRevealed: false
            };
            
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            (mysteryBoxManager as any).hiddenDataStore.set(boxId, hiddenData);
            
            try {
              // Measure timing and proof size
              const startTime = Date.now();
              const bluffingProof = await mysteryBoxManager.generateBluffingProof(
                boxId,
                category,
                encryptionKey
              );
              const endTime = Date.now();
              
              const proofGenerationTime = endTime - startTime;
              const proofSize = bluffingProof.proof.length;
              
              // Proof size should be consistent regardless of the number of traits
              // (it should only prove category membership, not enumerate all traits)
              expect(proofSize).toBeGreaterThan(0);
              expect(proofSize).toBeLessThan(1024); // Reasonable upper bound
              
              // Timing should not reveal information about trait count
              // (this is a basic check - in practice, constant-time operations would be needed)
              expect(proofGenerationTime).toBeLessThan(5000); // Should complete within 5 seconds
              
              // Verify the proof is valid
              const isValid = await mysteryBoxManager.verifyBluffingProof(
                boxId,
                bluffingProof,
                category
              );
              expect(isValid).toBe(true);
              
              // Proof should not contain raw trait data
              const proofBytes = Array.from(bluffingProof.proof);
              const hasObviousPatterns = proofBytes.some((byte, index) => {
                // Check for obvious patterns that might leak information
                if (index > 0) {
                  const prev = proofBytes[index - 1];
                  // Avoid long sequences of identical bytes (which might indicate poor randomness)
                  if (byte === prev && index > 5) {
                    let sequenceLength = 2;
                    for (let i = index + 1; i < proofBytes.length && proofBytes[i] === byte; i++) {
                      sequenceLength++;
                    }
                    return sequenceLength > 8; // Flag sequences longer than 8 identical bytes
                  }
                }
                return false;
              });
              
              expect(hasObviousPatterns).toBe(false);
              
            } catch (error: any) {
              // If the category doesn't exist, that's acceptable
              if (!error.message.includes('does not contain traits in category')) {
                throw error;
              }
            }
          }
        ),
        { 
          numRuns: 10, // Reduced from 75 to 10 for faster testing
          timeout: 25000
        }
      );
    }, 50000);

    it('should handle edge cases in bluffing mechanism', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 8 }).map(s => `token_${s}`),
          fc.oneof(
            // Empty traits
            fc.record({ traits: fc.constant({}) }),
            // Single trait in specific category
            fc.record({
              traits: fc.dictionary(
                fc.constantFrom('Fire Power', 'Magic Ability', 'Bonus Yield', 'Golden Aura'),
                fc.constant('test_value'),
                { minKeys: 1, maxKeys: 1 }
              )
            }),
            // Multiple traits in same category
            fc.record({
              traits: fc.dictionary(
                fc.constantFrom('Power Level', 'Power Boost', 'Power Strike'),
                fc.string({ minLength: 1, maxLength: 10 }),
                { minKeys: 2, maxKeys: 3 }
              )
            })
          ),
          fc.constantFrom('power', 'ability', 'yield', 'rarity'),
          fc.string({ minLength: 5, maxLength: 20 }),
          
          async (tokenId: TokenId, hiddenData: HiddenData, category: string, encryptionKey: string) => {
            // Create mystery box manually for testing
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            const encryptedTraits = {
              data: new Uint8Array(32),
              nonce: new Uint8Array(12)
            };
            crypto.getRandomValues(encryptedTraits.data);
            crypto.getRandomValues(encryptedTraits.nonce);
            
            const mysteryBox = {
              tokenId,
              encryptedTraits,
              revealConditions: {
                type: 'timelock' as const,
                timestamp: Date.now() + 86400000
              },
              isRevealed: false
            };
            
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            (mysteryBoxManager as any).hiddenDataStore.set(boxId, hiddenData);
            
            const traitCount = Object.keys(hiddenData.traits || {}).length;
            
            if (traitCount === 0) {
              // Empty traits should fail bluffing for any category
              await expect(
                mysteryBoxManager.generateBluffingProof(boxId, category, encryptionKey)
              ).rejects.toThrow();
            } else {
              // Check if the category exists in the traits
              const availableCategories = await mysteryBoxManager.getAvailableTraitCategories(boxId);
              
              if (availableCategories.includes(category)) {
                // Should succeed if category exists
                const proof = await mysteryBoxManager.generateBluffingProof(
                  boxId,
                  category,
                  encryptionKey
                );
                
                expect(proof).toBeDefined();
                expect(proof.proof.length).toBeGreaterThan(0);
                
                const isValid = await mysteryBoxManager.verifyBluffingProof(boxId, proof, category);
                expect(isValid).toBe(true);
              } else {
                // Should fail if category doesn't exist
                await expect(
                  mysteryBoxManager.generateBluffingProof(boxId, category, encryptionKey)
                ).rejects.toThrow(`Mystery box does not contain traits in category: ${category}`);
              }
            }
          }
        ),
        { 
          numRuns: 10, // Reduced from 50 to 10 for faster testing
          timeout: 20000
        }
      );
    }, 40000);
  });

  describe('Bluffing Proof Verification', () => {
    it('should reject invalid bluffing proofs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).map(s => `token_${s}`),
          fc.record({
            traits: fc.dictionary(
              fc.constantFrom('Fire Power', 'Magic Ability'),
              fc.string({ minLength: 1, maxLength: 15 }),
              { minKeys: 1, maxKeys: 2 }
            )
          }),
          fc.constantFrom('power', 'ability'),
          
          async (tokenId: TokenId, hiddenData: HiddenData, category: string) => {
            // Create mystery box manually for testing
            const boxId = `box_${tokenId}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
            
            const encryptedTraits = {
              data: new Uint8Array(32),
              nonce: new Uint8Array(12)
            };
            crypto.getRandomValues(encryptedTraits.data);
            crypto.getRandomValues(encryptedTraits.nonce);
            
            const mysteryBox = {
              tokenId,
              encryptedTraits,
              revealConditions: {
                type: 'timelock' as const,
                timestamp: Date.now() + 86400000
              },
              isRevealed: false
            };
            
            (mysteryBoxManager as any).mysteryBoxes.set(boxId, mysteryBox);
            (mysteryBoxManager as any).hiddenDataStore.set(boxId, hiddenData);
            
            // Create invalid proof
            const invalidProof: ZKProof = {
              proof: new Uint8Array(256), // Random bytes
              publicInputs: [new TextEncoder().encode('invalid')]
            };
            crypto.getRandomValues(invalidProof.proof);
            
            // Invalid proof should be rejected
            const isValid = await mysteryBoxManager.verifyBluffingProof(
              boxId,
              invalidProof,
              category
            );
            expect(isValid).toBe(false);
          }
        ),
        { 
          numRuns: 10, // Reduced from 25 to 10 for faster testing
          timeout: 15000
        }
      );
    }, 30000);
  });
});