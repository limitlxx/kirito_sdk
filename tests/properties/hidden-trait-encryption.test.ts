/**
 * Property-Based Test for Hidden Trait Encryption Round-Trip
 * Feature: kirito-sdk, Property 3: Hidden Trait Encryption Round-Trip
 * Validates: Requirements 1.4
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { HiddenTraitEncryption, EncryptionUtils } from '../../src/utils/encryption';
import { EncryptionKey, EncryptedData, HiddenTraits } from '../../src/types';

describe('Property 3: Hidden Trait Encryption Round-Trip', () => {
  let encryptionManager: HiddenTraitEncryption;

  beforeEach(() => {
    encryptionManager = new HiddenTraitEncryption();
  });

  /**
   * Property: For any hidden trait data, encrypting then decrypting with the correct key 
   * should produce the original trait data, while decryption with an incorrect key should fail.
   * 
   * This property tests that:
   * 1. Round-trip encryption/decryption preserves data integrity
   * 2. Encrypted data is different from original data
   * 3. Wrong keys fail to decrypt correctly
   * 4. Encryption produces consistent results for same input
   * 5. Different keys produce different encrypted outputs
   */
  test('should preserve data integrity through encryption round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various hidden trait structures
        fc.record({
          traits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.integer({ min: 1, max: 1000 }),
              fc.float({ min: Math.fround(0.1), max: Math.fround(100.0) }),
              fc.boolean(),
              fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
              fc.record({
                rarity: fc.string({ minLength: 1, maxLength: 15 }),
                power: fc.integer({ min: 1, max: 100 }),
                element: fc.constantFrom('fire', 'water', 'earth', 'air', 'void')
              })
            ),
            { minKeys: 1, maxKeys: 10 }
          )
        }),
        async ({ traits }) => {
          // Generate encryption key
          const key = encryptionManager.generateKey();
          
          // Encrypt traits
          const encrypted = await encryptionManager.encryptTraits(traits, key);
          
          // Verify encrypted data structure
          expect(encrypted).toHaveProperty('data');
          expect(encrypted).toHaveProperty('nonce');
          expect(encrypted.data).toBeInstanceOf(Uint8Array);
          expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
          expect(encrypted.data.length).toBeGreaterThan(0);
          
          // Verify encrypted data is different from original
          const originalJson = JSON.stringify(traits);
          const encryptedString = Buffer.from(encrypted.data).toString('base64');
          expect(encryptedString).not.toBe(originalJson);
          expect(encryptedString).not.toContain(originalJson);
          
          // Decrypt with correct key
          const decrypted = await encryptionManager.decryptTraits(encrypted, key);
          
          // Verify round-trip integrity
          expect(decrypted).toEqual(traits);
          
          // Verify all trait keys are preserved
          const originalKeys = Object.keys(traits).sort();
          const decryptedKeys = Object.keys(decrypted).sort();
          expect(decryptedKeys).toEqual(originalKeys);
          
          // Verify all trait values are preserved
          for (const [traitKey, traitValue] of Object.entries(traits)) {
            expect(decrypted[traitKey]).toEqual(traitValue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should fail decryption with incorrect keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 30 }),
              fc.integer({ min: 1, max: 100 })
            ),
            { minKeys: 1, maxKeys: 5 }
          )
        }),
        async ({ traits }) => {
          // Generate two different keys
          const correctKey = encryptionManager.generateKey();
          const wrongKey = encryptionManager.generateKey();
          
          // Ensure keys are actually different
          expect(Buffer.from(correctKey.key)).not.toEqual(Buffer.from(wrongKey.key));
          
          // Encrypt with correct key
          const encrypted = await encryptionManager.encryptTraits(traits, correctKey);
          
          // Attempt decryption with wrong key should fail
          await expect(
            encryptionManager.decryptTraits(encrypted, wrongKey)
          ).rejects.toThrow();
          
          // Decryption with correct key should succeed
          const decrypted = await encryptionManager.decryptTraits(encrypted, correctKey);
          expect(decrypted).toEqual(traits);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should produce different encrypted outputs for different keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 1, maxLength: 20 }),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ traits }) => {
          // Generate two different keys
          const key1 = encryptionManager.generateKey();
          const key2 = encryptionManager.generateKey();
          
          // Encrypt same data with different keys
          const encrypted1 = await encryptionManager.encryptTraits(traits, key1);
          const encrypted2 = await encryptionManager.encryptTraits(traits, key2);
          
          // Encrypted outputs should be different
          expect(Buffer.from(encrypted1.data)).not.toEqual(Buffer.from(encrypted2.data));
          
          // Both should decrypt to original data with their respective keys
          const decrypted1 = await encryptionManager.decryptTraits(encrypted1, key1);
          const decrypted2 = await encryptionManager.decryptTraits(encrypted2, key2);
          
          expect(decrypted1).toEqual(traits);
          expect(decrypted2).toEqual(traits);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle selective trait encryption correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          allTraits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 25 }),
              fc.integer({ min: 1, max: 100 })
            ),
            { minKeys: 3, maxKeys: 8 }
          ),
          hideRatio: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8) }) // Hide 20-80% of traits
        }),
        async ({ allTraits, hideRatio }) => {
          const allTraitKeys = Object.keys(allTraits);
          const numToHide = Math.max(1, Math.floor(allTraitKeys.length * hideRatio));
          const traitKeysToHide = allTraitKeys.slice(0, numToHide);
          
          const key = encryptionManager.generateKey();
          
          // Perform selective encryption
          const result = await encryptionManager.encryptSelectiveTraits(
            allTraits, 
            key, 
            traitKeysToHide
          );
          
          // Verify structure
          expect(result).toHaveProperty('encrypted');
          expect(result).toHaveProperty('visible');
          
          // Verify visible traits
          const expectedVisibleKeys = allTraitKeys.filter(k => !traitKeysToHide.includes(k));
          expect(Object.keys(result.visible).sort()).toEqual(expectedVisibleKeys.sort());
          
          for (const key of expectedVisibleKeys) {
            expect(result.visible[key]).toEqual(allTraits[key]);
          }
          
          // Decrypt hidden traits
          const decryptedHidden = await encryptionManager.decryptTraits(result.encrypted, key);
          
          // Verify hidden traits
          expect(Object.keys(decryptedHidden).sort()).toEqual(traitKeysToHide.sort());
          
          for (const hiddenKey of traitKeysToHide) {
            expect(decryptedHidden[hiddenKey]).toEqual(allTraits[hiddenKey]);
          }
          
          // Verify no overlap between visible and hidden
          const visibleKeys = Object.keys(result.visible);
          const hiddenKeys = Object.keys(decryptedHidden);
          const intersection = visibleKeys.filter(k => hiddenKeys.includes(k));
          expect(intersection).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle trait commitments correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 12 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.integer({ min: 1, max: 50 })
            ),
            { minKeys: 1, maxKeys: 5 }
          ),
          nonce: fc.uint8Array({ minLength: 16, maxLength: 32 })
        }),
        async ({ traits, nonce }) => {
          // Create commitments
          const commitments = encryptionManager.createTraitCommitments(traits, nonce);
          
          // Verify commitment structure
          expect(Object.keys(commitments).sort()).toEqual(Object.keys(traits).sort());
          
          // Verify each commitment
          for (const [traitKey, traitValue] of Object.entries(traits)) {
            const commitment = commitments[traitKey];
            
            // Commitment should be a hex string
            expect(typeof commitment).toBe('string');
            expect(commitment).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
            
            // Verify commitment
            const isValid = encryptionManager.verifyTraitCommitment(traitValue, nonce, commitment);
            expect(isValid).toBe(true);
            
            // Wrong nonce should fail verification
            const wrongNonce = new Uint8Array(nonce.length);
            wrongNonce.fill(0);
            const isInvalid = encryptionManager.verifyTraitCommitment(traitValue, wrongNonce, commitment);
            expect(isInvalid).toBe(false);
          }
          
          // Same input should produce same commitment
          const commitments2 = encryptionManager.createTraitCommitments(traits, nonce);
          expect(commitments2).toEqual(commitments);
          
          // Different nonce should produce different commitments
          const differentNonce = new Uint8Array(nonce.length);
          differentNonce.fill(255);
          const commitments3 = encryptionManager.createTraitCommitments(traits, differentNonce);
          expect(commitments3).not.toEqual(commitments);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle password-based key derivation consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          password: fc.string({ minLength: 8, maxLength: 50 }),
          salt: fc.uint8Array({ minLength: 16, maxLength: 32 }),
          traits: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 1, maxLength: 15 }),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ password, salt, traits }) => {
          // Generate key from password
          const key1 = encryptionManager.generateKeyFromPassword(password, salt);
          const key2 = encryptionManager.generateKeyFromPassword(password, salt);
          
          // Same password and salt should produce same key
          expect(Buffer.from(key1.key)).toEqual(Buffer.from(key2.key));
          expect(Buffer.from(key1.iv)).toEqual(Buffer.from(key2.iv));
          
          // Encrypt and decrypt with password-derived key
          const encrypted = await encryptionManager.encryptTraits(traits, key1);
          const decrypted = await encryptionManager.decryptTraits(encrypted, key2);
          
          expect(decrypted).toEqual(traits);
          
          // Different password should produce different key
          const differentPassword = password + 'different';
          const key3 = encryptionManager.generateKeyFromPassword(differentPassword, salt);
          expect(Buffer.from(key3.key)).not.toEqual(Buffer.from(key1.key));
          
          // Different salt should produce different key
          const differentSalt = new Uint8Array(salt.length);
          differentSalt.fill(123);
          const key4 = encryptionManager.generateKeyFromPassword(password, differentSalt);
          expect(Buffer.from(key4.key)).not.toEqual(Buffer.from(key1.key));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle empty and edge case traits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({}), // Empty traits
          fc.record({
            emptyString: fc.constant(''),
            zero: fc.constant(0),
            false: fc.constant(false),
            null: fc.constant(null),
            emptyArray: fc.constant([]),
            emptyObject: fc.constant({})
          }),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 5 }),
            fc.oneof(
              fc.constant(''),
              fc.constant(0),
              fc.constant(false),
              fc.constant(null)
            ),
            { minKeys: 1, maxKeys: 3 }
          )
        ),
        async (traits) => {
          const key = encryptionManager.generateKey();
          
          // Should handle edge cases without throwing
          const encrypted = await encryptionManager.encryptTraits(traits, key);
          const decrypted = await encryptionManager.decryptTraits(encrypted, key);
          
          expect(decrypted).toEqual(traits);
        }
      ),
      { numRuns: 100 }
    );
  });
});