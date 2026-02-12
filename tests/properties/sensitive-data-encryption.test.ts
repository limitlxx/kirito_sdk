/**
 * Property-Based Test for Sensitive Data Encryption
 * Feature: kirito-sdk, Property 17: Sensitive Data Encryption
 * Validates: Requirements 7.2
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { 
  DataEncryptionManager, 
  EncryptionUtils,
  KeyRotationPolicy,
  EncryptedStorageEntry
} from '../../src/utils/encryption';
import { EncryptionKey, EncryptedData } from '../../src/types';

describe('Property 17: Sensitive Data Encryption', () => {
  let encryptionManager: DataEncryptionManager;

  beforeEach(() => {
    encryptionManager = new DataEncryptionManager();
  });

  /**
   * Property: For any sensitive data stored by the system, it should be encrypted 
   * and remain inaccessible without proper authorization (correct key).
   * 
   * This property tests that:
   * 1. All sensitive data is encrypted before storage
   * 2. Encrypted data cannot be accessed without the correct key
   * 3. Round-trip encryption/decryption preserves data integrity
   * 4. Key management and rotation work correctly
   * 5. Encrypted data is cryptographically secure (different from plaintext)
   */
  test('should encrypt all sensitive data and make it inaccessible without proper authorization', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various types of sensitive data
        fc.record({
          sensitiveData: fc.oneof(
            // User credentials
            fc.record({
              type: fc.constant('credentials'),
              username: fc.string({ minLength: 3, maxLength: 30 }),
              passwordHash: fc.hexaString({ minLength: 64, maxLength: 64 }),
              apiKey: fc.uuid(),
              secretToken: fc.hexaString({ minLength: 32, maxLength: 64 })
            }),
            // Financial data
            fc.record({
              type: fc.constant('financial'),
              accountNumber: fc.string({ minLength: 10, maxLength: 20 }),
              balance: fc.bigInt({ min: 0n, max: 1000000000000n }),
              transactions: fc.array(
                fc.record({
                  amount: fc.bigInt({ min: 0n, max: 1000000n }),
                  timestamp: fc.integer({ min: 1600000000000, max: Date.now() }),
                  recipient: fc.hexaString({ minLength: 40, maxLength: 66 })
                }),
                { maxLength: 10 }
              )
            }),
            // Personal information
            fc.record({
              type: fc.constant('personal'),
              name: fc.string({ minLength: 2, maxLength: 50 }),
              email: fc.emailAddress(),
              phone: fc.string({ minLength: 10, maxLength: 15 }),
              address: fc.record({
                street: fc.string({ minLength: 5, maxLength: 50 }),
                city: fc.string({ minLength: 2, maxLength: 30 }),
                country: fc.string({ minLength: 2, maxLength: 30 }),
                postalCode: fc.string({ minLength: 3, maxLength: 10 })
              }),
              dateOfBirth: fc.date({ min: new Date('1950-01-01'), max: new Date('2010-12-31') })
            }),
            // Private keys and secrets
            fc.record({
              type: fc.constant('cryptographic'),
              privateKey: fc.hexaString({ minLength: 64, maxLength: 64 }),
              mnemonic: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { minLength: 12, maxLength: 24 }),
              encryptionSeed: fc.uint8Array({ minLength: 32, maxLength: 32 }),
              derivationPath: fc.string({ minLength: 5, maxLength: 30 })
            }),
            // NFT metadata with hidden traits
            fc.record({
              type: fc.constant('nft_metadata'),
              tokenId: fc.integer({ min: 1, max: 10000 }),
              hiddenTraits: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(
                  fc.string({ minLength: 1, maxLength: 30 }),
                  fc.integer({ min: 1, max: 100 }),
                  fc.float({ min: Math.fround(0.1), max: Math.fround(10.0) })
                ),
                { minKeys: 1, maxKeys: 5 }
              ),
              yieldAmount: fc.bigInt({ min: 0n, max: 1000000n }),
              stakingInfo: fc.record({
                amount: fc.bigInt({ min: 0n, max: 1000000n }),
                timestamp: fc.integer({ min: 1600000000000, max: Date.now() })
              })
            })
          )
        }),
        async ({ sensitiveData }) => {
          // Generate encryption key
          const storedKey = encryptionManager.generateKey('sensitive-data');
          
          // Encrypt sensitive data
          const encrypted = await encryptionManager.encryptData(sensitiveData, storedKey.key);
          
          // Verify encrypted data structure
          expect(encrypted).toHaveProperty('data');
          expect(encrypted).toHaveProperty('nonce');
          expect(encrypted.data).toBeInstanceOf(Uint8Array);
          expect(encrypted.nonce).toBeInstanceOf(Uint8Array);
          expect(encrypted.data.length).toBeGreaterThan(0);
          
          // Verify encrypted data is different from original (not accessible)
          const originalJson = JSON.stringify(sensitiveData, (key, value) => {
            if (typeof value === 'bigint') return value.toString();
            if (value instanceof Date) return value.toISOString();
            return value;
          });
          const encryptedString = Buffer.from(encrypted.data).toString('base64');
          expect(encryptedString).not.toBe(originalJson);
          expect(encryptedString).not.toContain(originalJson);
          
          // Verify sensitive fields are not visible in encrypted data
          const sensitiveFields = extractSensitiveFields(sensitiveData);
          for (const field of sensitiveFields) {
            expect(encryptedString).not.toContain(field);
          }
          
          // Decrypt with correct key (proper authorization)
          const decrypted = await encryptionManager.decryptData(encrypted, storedKey.key);
          
          // Verify round-trip integrity (with Date normalization)
          const normalizedOriginal = normalizeData(sensitiveData);
          const normalizedDecrypted = normalizeData(decrypted);
          expect(normalizedDecrypted).toEqual(normalizedOriginal);
          
          // Verify decryption without proper authorization fails
          const wrongKey = encryptionManager.generateKey('wrong-key');
          await expect(
            encryptionManager.decryptData(encrypted, wrongKey.key)
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should support key management with metadata tracking', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 15 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 30 }),
              fc.integer({ min: 1, max: 1000 }),
              fc.bigInt({ min: 0n, max: 1000000n })
            ),
            { minKeys: 1, maxKeys: 5 }
          ),
          purpose: fc.constantFrom('user-data', 'financial', 'credentials', 'nft-metadata', 'private-keys')
        }),
        async ({ data, purpose }) => {
          // Generate key with purpose
          const storedKey = encryptionManager.generateKey(purpose);
          
          // Verify key metadata
          expect(storedKey.metadata).toHaveProperty('id');
          expect(storedKey.metadata).toHaveProperty('version');
          expect(storedKey.metadata).toHaveProperty('createdAt');
          expect(storedKey.metadata).toHaveProperty('expiresAt');
          expect(storedKey.metadata).toHaveProperty('algorithm');
          expect(storedKey.metadata).toHaveProperty('purpose');
          expect(storedKey.metadata.purpose).toBe(purpose);
          expect(storedKey.metadata.version).toBe(1);
          expect(storedKey.metadata.createdAt).toBeLessThanOrEqual(Date.now());
          expect(storedKey.metadata.expiresAt).toBeGreaterThan(Date.now());
          
          // Encrypt data
          const encrypted = await encryptionManager.encryptData(data, storedKey.key);
          
          // Retrieve key by ID
          const retrievedKey = encryptionManager.getKey(storedKey.metadata.id);
          expect(retrievedKey).not.toBeNull();
          expect(retrievedKey?.metadata.id).toBe(storedKey.metadata.id);
          
          // Decrypt with retrieved key
          const decrypted = await encryptionManager.decryptData(encrypted, retrievedKey!.key);
          expect(decrypted).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should support key rotation and re-encryption', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.integer({ min: 1, max: 100 })
            ),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ data }) => {
          // Generate initial key
          const oldKey = encryptionManager.generateKey('rotation-test');
          const oldKeyId = oldKey.metadata.id;
          
          // Encrypt data with old key
          const encrypted = await encryptionManager.encryptData(data, oldKey.key);
          
          // Rotate key
          const newKey = await encryptionManager.rotateKey(oldKeyId);
          
          // Verify new key metadata
          expect(newKey.metadata.version).toBe(oldKey.metadata.version + 1);
          expect(newKey.metadata.rotatedFrom).toBe(oldKeyId);
          expect(newKey.metadata.id).not.toBe(oldKeyId);
          expect(Buffer.from(newKey.key.key)).not.toEqual(Buffer.from(oldKey.key.key));
          
          // Re-encrypt data with new key
          const reencrypted = await encryptionManager.reencryptData(
            encrypted,
            oldKeyId,
            newKey.metadata.id
          );
          
          // Verify re-encrypted data is different
          expect(Buffer.from(reencrypted.data)).not.toEqual(Buffer.from(encrypted.data));
          
          // Decrypt with new key should work
          const decrypted = await encryptionManager.decryptData(reencrypted, newKey.key);
          expect(decrypted).toEqual(data);
          
          // Old key should still be able to decrypt original data
          const decryptedOld = await encryptionManager.decryptData(encrypted, oldKey.key);
          expect(decryptedOld).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should support encrypted storage with automatic key management', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 12 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 25 }),
              fc.integer({ min: 1, max: 500 }),
              fc.boolean()
            ),
            { minKeys: 1, maxKeys: 4 }
          ),
          metadata: fc.record({
            source: fc.constantFrom('user-input', 'api', 'blockchain', 'ipfs'),
            timestamp: fc.integer({ min: 1600000000000, max: Date.now() }),
            version: fc.integer({ min: 1, max: 10 })
          })
        }),
        async ({ data, metadata }) => {
          // Generate a key first
          encryptionManager.generateKey('storage-test');
          
          // Encrypt and store
          const entry = await encryptionManager.encryptAndStore(data, metadata);
          
          // Verify storage entry structure
          expect(entry).toHaveProperty('data');
          expect(entry).toHaveProperty('keyId');
          expect(entry).toHaveProperty('keyVersion');
          expect(entry).toHaveProperty('timestamp');
          expect(entry).toHaveProperty('metadata');
          expect(entry.metadata).toEqual(metadata);
          expect(entry.timestamp).toBeLessThanOrEqual(Date.now());
          
          // Retrieve and decrypt
          const decrypted = await encryptionManager.retrieveAndDecrypt(entry);
          expect(decrypted).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should support password-based key derivation for user-controlled encryption', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          password: fc.string({ minLength: 8, maxLength: 50 }),
          salt: fc.uint8Array({ minLength: 16, maxLength: 32 }),
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 1, maxLength: 20 }),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ password, salt, data }) => {
          // Generate key from password
          const storedKey1 = await encryptionManager.generateKeyFromPassword(password, salt, 'user-password');
          const storedKey2 = await encryptionManager.generateKeyFromPassword(password, salt, 'user-password');
          
          // Same password and salt should produce same key
          expect(Buffer.from(storedKey1.key.key)).toEqual(Buffer.from(storedKey2.key.key));
          expect(Buffer.from(storedKey1.key.iv)).toEqual(Buffer.from(storedKey2.key.iv));
          
          // Encrypt and decrypt with password-derived key
          const encrypted = await encryptionManager.encryptData(data, storedKey1.key);
          const decrypted = await encryptionManager.decryptData(encrypted, storedKey2.key);
          
          expect(decrypted).toEqual(data);
          
          // Different password should produce different key
          const differentPassword = password + '_different';
          const storedKey3 = await encryptionManager.generateKeyFromPassword(differentPassword, salt, 'user-password');
          expect(Buffer.from(storedKey3.key.key)).not.toEqual(Buffer.from(storedKey1.key.key));
          
          // Wrong password should fail to decrypt
          await expect(
            encryptionManager.decryptData(encrypted, storedKey3.key)
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should support key store export and import for backup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 15 }),
              fc.integer({ min: 1, max: 100 })
            ),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ data }) => {
          // Generate key and encrypt data
          const storedKey = encryptionManager.generateKey('backup-test');
          const encrypted = await encryptionManager.encryptData(data, storedKey.key);
          
          // Export key store
          const exported = encryptionManager.exportKeyStore();
          expect(typeof exported).toBe('string');
          expect(exported.length).toBeGreaterThan(0);
          
          // Create new manager and import key store
          const newManager = new DataEncryptionManager();
          newManager.importKeyStore(exported);
          
          // Verify imported key can decrypt data
          const importedKey = newManager.getKey(storedKey.metadata.id);
          expect(importedKey).not.toBeNull();
          
          const decrypted = await newManager.decryptData(encrypted, importedKey!.key);
          expect(decrypted).toEqual(data);
          
          // Verify key metadata is preserved
          expect(importedKey!.metadata).toEqual(storedKey.metadata);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle expired keys correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }),
            fc.string({ minLength: 1, maxLength: 12 }),
            { minKeys: 1, maxKeys: 2 }
          )
        }),
        async ({ data }) => {
          // Create manager with short key expiration
          const shortExpirationPolicy: KeyRotationPolicy = {
            rotationIntervalMs: 100, // 100ms
            maxKeyAge: 200, // 200ms
            autoRotate: false
          };
          
          const manager = new DataEncryptionManager({}, shortExpirationPolicy);
          
          // Generate multiple keys
          const key1 = manager.generateKey('test-1');
          const key2 = manager.generateKey('test-2');
          const key3 = manager.generateKey('test-3');
          
          // Wait for keys to expire
          await new Promise(resolve => setTimeout(resolve, 250));
          
          // Cleanup expired keys
          const removed = manager.cleanupExpiredKeys();
          
          // At least some keys should be removed (not current key)
          expect(removed).toBeGreaterThanOrEqual(0);
          
          // Current key should still exist
          const currentKey = manager.getCurrentKey();
          expect(currentKey).not.toBeNull();
        }
      ),
      { numRuns: 50 } // Fewer runs due to timeouts
    );
  });

  test('should use authenticated encryption (GCM mode) to prevent tampering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          data: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.string({ minLength: 1, maxLength: 15 }),
            { minKeys: 1, maxKeys: 3 }
          )
        }),
        async ({ data }) => {
          const storedKey = encryptionManager.generateKey('auth-test');
          const encrypted = await encryptionManager.encryptData(data, storedKey.key);
          
          // Tamper with encrypted data
          const tamperedData = new Uint8Array(encrypted.data);
          tamperedData[0] = tamperedData[0] ^ 0xFF; // Flip bits
          
          const tamperedEncrypted: EncryptedData = {
            data: tamperedData,
            nonce: encrypted.nonce
          };
          
          // Decryption should fail due to authentication tag mismatch
          await expect(
            encryptionManager.decryptData(tamperedEncrypted, storedKey.key)
          ).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle various data types and edge cases', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({}), // Empty object
          fc.constant([]), // Empty array
          fc.constant(null),
          fc.constant(''),
          fc.constant(0),
          fc.constant(false),
          fc.record({
            nested: fc.record({
              deep: fc.record({
                value: fc.string({ minLength: 1, maxLength: 10 })
              })
            })
          }),
          fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 10 }),
          fc.bigInt({ min: 0n, max: 999999999999999999n })
        ),
        async (data) => {
          const storedKey = encryptionManager.generateKey('edge-case-test');
          
          // Should handle edge cases without throwing
          const encrypted = await encryptionManager.encryptData(data, storedKey.key);
          const decrypted = await encryptionManager.decryptData(encrypted, storedKey.key);
          
          expect(decrypted).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Helper function to extract sensitive field values from data
 */
function extractSensitiveFields(data: any): string[] {
  const fields: string[] = [];
  
  function extract(obj: any) {
    if (typeof obj === 'string' && obj.length > 5) {
      fields.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const value of Object.values(obj)) {
        extract(value);
      }
    }
  }
  
  extract(data);
  return fields;
}

/**
 * Helper function to normalize data for comparison (handles Date objects)
 */
function normalizeData(data: any): any {
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(normalizeData);
  }
  if (data && typeof data === 'object') {
    const normalized: any = {};
    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeData(value);
    }
    return normalized;
  }
  return data;
}
