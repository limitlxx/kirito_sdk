/**
 * Comprehensive Data Encryption System
 * Provides encryption/decryption functionality with key management and rotation
 * Implements secure storage and retrieval mechanisms for all sensitive data
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';
import { EncryptionKey, EncryptedData, HiddenTraits } from '../types';

const scryptAsync = promisify(scrypt);

/**
 * Encryption configuration options
 */
export interface EncryptionConfig {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  saltLength?: number;
  scryptCost?: number;
}

/**
 * Default encryption configuration
 */
const DEFAULT_CONFIG: Required<EncryptionConfig> = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  saltLength: 32, // 256 bits
  scryptCost: 16384 // N parameter for scrypt
};

/**
 * Key metadata for key management and rotation
 */
export interface KeyMetadata {
  id: string;
  version: number;
  createdAt: number;
  expiresAt?: number;
  rotatedFrom?: string;
  algorithm: string;
  purpose: string;
}

/**
 * Stored key with metadata
 */
export interface StoredKey {
  key: EncryptionKey;
  metadata: KeyMetadata;
}

/**
 * Key rotation policy
 */
export interface KeyRotationPolicy {
  rotationIntervalMs: number;
  maxKeyAge: number;
  autoRotate: boolean;
}

/**
 * Encrypted storage entry
 */
export interface EncryptedStorageEntry {
  data: EncryptedData;
  keyId: string;
  keyVersion: number;
  timestamp: number;
  metadata?: any;
}

/**
 * Comprehensive Data Encryption Manager
 * Handles encryption, key management, rotation, and secure storage
 */
export class DataEncryptionManager {
  private config: Required<EncryptionConfig>;
  private keyStore: Map<string, StoredKey>;
  private currentKeyId: string | null;
  private rotationPolicy: KeyRotationPolicy;

  constructor(
    config: EncryptionConfig = {},
    rotationPolicy?: KeyRotationPolicy
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keyStore = new Map();
    this.currentKeyId = null;
    this.rotationPolicy = rotationPolicy || {
      rotationIntervalMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxKeyAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      autoRotate: true
    };
  }

  /**
   * Generate a new encryption key with metadata
   */
  generateKey(purpose: string = 'general'): StoredKey {
    const keyId = this.generateKeyId();
    const key: EncryptionKey = {
      key: randomBytes(this.config.keyLength),
      iv: randomBytes(this.config.ivLength)
    };

    const metadata: KeyMetadata = {
      id: keyId,
      version: 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.rotationPolicy.maxKeyAge,
      algorithm: this.config.algorithm,
      purpose
    };

    const storedKey: StoredKey = { key, metadata };
    this.keyStore.set(keyId, storedKey);
    
    if (!this.currentKeyId) {
      this.currentKeyId = keyId;
    }

    return storedKey;
  }

  /**
   * Generate encryption key from password using scrypt
   */
  async generateKeyFromPassword(
    password: string, 
    salt?: Uint8Array,
    purpose: string = 'password-derived'
  ): Promise<StoredKey> {
    const saltBuffer = salt ? Buffer.from(salt) : randomBytes(this.config.saltLength);
    
    // Use scrypt for key derivation (more secure than PBKDF2)
    const keyBuffer = await scryptAsync(
      password, 
      saltBuffer, 
      this.config.keyLength
    ) as Buffer;
    
    const ivBuffer = await scryptAsync(
      password + ':iv', 
      saltBuffer, 
      this.config.ivLength
    ) as Buffer;

    const keyId = this.generateKeyId();
    const key: EncryptionKey = {
      key: new Uint8Array(keyBuffer),
      iv: new Uint8Array(ivBuffer)
    };

    const metadata: KeyMetadata = {
      id: keyId,
      version: 1,
      createdAt: Date.now(),
      algorithm: this.config.algorithm,
      purpose
    };

    const storedKey: StoredKey = { key, metadata };
    this.keyStore.set(keyId, storedKey);

    return storedKey;
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(oldKeyId: string, purpose?: string): Promise<StoredKey> {
    const oldKey = this.keyStore.get(oldKeyId);
    if (!oldKey) {
      throw new Error(`Key ${oldKeyId} not found for rotation`);
    }

    const newKeyId = this.generateKeyId();
    const key: EncryptionKey = {
      key: randomBytes(this.config.keyLength),
      iv: randomBytes(this.config.ivLength)
    };

    const metadata: KeyMetadata = {
      id: newKeyId,
      version: oldKey.metadata.version + 1,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.rotationPolicy.maxKeyAge,
      rotatedFrom: oldKeyId,
      algorithm: this.config.algorithm,
      purpose: purpose || oldKey.metadata.purpose
    };

    const newStoredKey: StoredKey = { key, metadata };
    this.keyStore.set(newKeyId, newStoredKey);
    this.currentKeyId = newKeyId;

    return newStoredKey;
  }

  /**
   * Re-encrypt data with new key (for key rotation)
   */
  async reencryptData(
    encryptedData: EncryptedData,
    oldKeyId: string,
    newKeyId: string
  ): Promise<EncryptedData> {
    const oldKey = this.keyStore.get(oldKeyId);
    const newKey = this.keyStore.get(newKeyId);

    if (!oldKey || !newKey) {
      throw new Error('Keys not found for re-encryption');
    }

    // Decrypt with old key
    const decrypted = await this.decryptData(encryptedData, oldKey.key);
    
    // Encrypt with new key
    return await this.encryptData(decrypted, newKey.key);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  async encryptData(data: any, key: EncryptionKey): Promise<EncryptedData> {
    try {
      // Serialize data to JSON with BigInt, Uint8Array, and Date support
      const dataJson = JSON.stringify(data, (key, value) => {
        // Handle BigInt serialization
        if (typeof value === 'bigint') {
          return { __type: 'bigint', value: value.toString() };
        }
        // Handle Uint8Array serialization
        if (value instanceof Uint8Array) {
          return { __type: 'Uint8Array', value: Array.from(value) };
        }
        // Handle Date serialization
        if (value instanceof Date) {
          return { __type: 'Date', value: value.toISOString() };
        }
        return value;
      });
      const dataBuffer = Buffer.from(dataJson, 'utf8');

      // Generate new IV for each encryption
      const iv = randomBytes(this.config.ivLength);

      // Create cipher with GCM mode for authenticated encryption
      const cipher = createCipheriv(
        this.config.algorithm, 
        Buffer.from(key.key),
        iv
      );

      // Encrypt data
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag (GCM mode)
      const authTag = (cipher as any).getAuthTag();

      // Combine encrypted data with auth tag
      const combined = Buffer.concat([encrypted, authTag]);

      return {
        data: new Uint8Array(combined),
        nonce: new Uint8Array(iv)
      };

    } catch (error) {
      throw new Error(`Data encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  async decryptData(encryptedData: EncryptedData, key: EncryptionKey): Promise<any> {
    try {
      const dataBuffer = Buffer.from(encryptedData.data);
      const iv = Buffer.from(encryptedData.nonce);

      // Extract auth tag (last 16 bytes for GCM)
      const authTagLength = 16;
      const authTag = dataBuffer.subarray(-authTagLength);
      const ciphertext = dataBuffer.subarray(0, -authTagLength);

      // Create decipher
      const decipher = createDecipheriv(
        this.config.algorithm,
        Buffer.from(key.key),
        iv
      );

      // Set auth tag for verification
      (decipher as any).setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // Parse JSON with BigInt, Uint8Array, and Date support
      const dataJson = decrypted.toString('utf8');
      return JSON.parse(dataJson, (key, value) => {
        // Handle BigInt deserialization
        if (value && typeof value === 'object' && value.__type === 'bigint') {
          return BigInt(value.value);
        }
        // Handle Uint8Array deserialization
        if (value && typeof value === 'object' && value.__type === 'Uint8Array') {
          return new Uint8Array(value.value);
        }
        // Handle Date deserialization
        if (value && typeof value === 'object' && value.__type === 'Date') {
          return new Date(value.value);
        }
        return value;
      });

    } catch (error) {
      throw new Error(`Data decryption failed: ${error}`);
    }
  }

  /**
   * Encrypt data with current key and store with metadata
   */
  async encryptAndStore(data: any, metadata?: any): Promise<EncryptedStorageEntry> {
    if (!this.currentKeyId) {
      throw new Error('No encryption key available. Generate a key first.');
    }

    const storedKey = this.keyStore.get(this.currentKeyId);
    if (!storedKey) {
      throw new Error('Current key not found in key store');
    }

    // Check if key needs rotation
    if (this.rotationPolicy.autoRotate && this.shouldRotateKey(storedKey)) {
      const newKey = await this.rotateKey(this.currentKeyId);
      const encryptedData = await this.encryptData(data, newKey.key);
      
      return {
        data: encryptedData,
        keyId: newKey.metadata.id,
        keyVersion: newKey.metadata.version,
        timestamp: Date.now(),
        metadata
      };
    }

    const encryptedData = await this.encryptData(data, storedKey.key);
    
    return {
      data: encryptedData,
      keyId: storedKey.metadata.id,
      keyVersion: storedKey.metadata.version,
      timestamp: Date.now(),
      metadata
    };
  }

  /**
   * Retrieve and decrypt stored data
   */
  async retrieveAndDecrypt(entry: EncryptedStorageEntry): Promise<any> {
    const storedKey = this.keyStore.get(entry.keyId);
    if (!storedKey) {
      throw new Error(`Key ${entry.keyId} not found in key store`);
    }

    return await this.decryptData(entry.data, storedKey.key);
  }

  /**
   * Check if key should be rotated
   */
  private shouldRotateKey(storedKey: StoredKey): boolean {
    const age = Date.now() - storedKey.metadata.createdAt;
    return age >= this.rotationPolicy.rotationIntervalMs;
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Get current key
   */
  getCurrentKey(): StoredKey | null {
    if (!this.currentKeyId) return null;
    return this.keyStore.get(this.currentKeyId) || null;
  }

  /**
   * Get key by ID
   */
  getKey(keyId: string): StoredKey | null {
    return this.keyStore.get(keyId) || null;
  }

  /**
   * List all keys
   */
  listKeys(): StoredKey[] {
    return Array.from(this.keyStore.values());
  }

  /**
   * Remove expired keys
   */
  cleanupExpiredKeys(): number {
    const now = Date.now();
    let removed = 0;

    for (const [keyId, storedKey] of this.keyStore.entries()) {
      if (storedKey.metadata.expiresAt && storedKey.metadata.expiresAt < now) {
        // Don't remove current key
        if (keyId !== this.currentKeyId) {
          this.keyStore.delete(keyId);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Export key store (for backup)
   */
  exportKeyStore(): string {
    const keys = Array.from(this.keyStore.entries()).map(([id, storedKey]) => ({
      id,
      key: {
        key: Array.from(storedKey.key.key),
        iv: Array.from(storedKey.key.iv)
      },
      metadata: storedKey.metadata
    }));

    return JSON.stringify({
      currentKeyId: this.currentKeyId,
      keys,
      config: this.config,
      rotationPolicy: this.rotationPolicy
    });
  }

  /**
   * Import key store (from backup)
   */
  importKeyStore(exportedData: string): void {
    const parsed = JSON.parse(exportedData);
    
    this.currentKeyId = parsed.currentKeyId;
    this.config = parsed.config;
    this.rotationPolicy = parsed.rotationPolicy;
    this.keyStore.clear();

    for (const entry of parsed.keys) {
      const storedKey: StoredKey = {
        key: {
          key: new Uint8Array(entry.key.key),
          iv: new Uint8Array(entry.key.iv)
        },
        metadata: entry.metadata
      };
      this.keyStore.set(entry.id, storedKey);
    }
  }
}

/**
 * Hidden Trait Encryption Manager (backward compatible wrapper)
 * Uses DataEncryptionManager internally
 */
export class HiddenTraitEncryption {
  private encryptionManager: DataEncryptionManager;
  private config: Required<EncryptionConfig>;

  constructor(config: EncryptionConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.encryptionManager = new DataEncryptionManager(config);
  }

  /**
   * Generate a new encryption key
   */
  generateKey(): EncryptionKey {
    return {
      key: randomBytes(this.config.keyLength),
      iv: randomBytes(this.config.ivLength)
    };
  }

  /**
   * Generate encryption key from password
   */
  async generateKeyFromPassword(password: string, salt?: Uint8Array): Promise<EncryptionKey> {
    const storedKey = await this.encryptionManager.generateKeyFromPassword(password, salt, 'hidden-traits');
    return storedKey.key;
  }

  /**
   * Encrypt hidden traits for mystery box functionality
   */
  async encryptTraits(traits: HiddenTraits, key: EncryptionKey): Promise<EncryptedData> {
    return await this.encryptionManager.encryptData(traits, key);
  }

  /**
   * Decrypt hidden traits
   */
  async decryptTraits(encryptedData: EncryptedData, key: EncryptionKey): Promise<HiddenTraits> {
    return await this.encryptionManager.decryptData(encryptedData, key);
  }

  /**
   * Encrypt specific trait values selectively
   */
  async encryptSelectiveTraits(
    traits: HiddenTraits, 
    key: EncryptionKey, 
    traitKeysToHide: string[]
  ): Promise<{ encrypted: EncryptedData; visible: HiddenTraits }> {
    try {
      const hiddenTraits: HiddenTraits = {};
      const visibleTraits: HiddenTraits = {};

      // Separate traits into hidden and visible
      for (const [traitKey, traitValue] of Object.entries(traits)) {
        if (traitKeysToHide.includes(traitKey)) {
          hiddenTraits[traitKey] = traitValue;
        } else {
          visibleTraits[traitKey] = traitValue;
        }
      }

      // Encrypt only the hidden traits
      const encrypted = await this.encryptTraits(hiddenTraits, key);

      return {
        encrypted,
        visible: visibleTraits
      };

    } catch (error) {
      throw new Error(`Selective trait encryption failed: ${error}`);
    }
  }

  /**
   * Create trait commitment (hash) without revealing the trait
   */
  createTraitCommitment(trait: any, nonce: Uint8Array): string {
    const traitString = typeof trait === 'string' ? trait : JSON.stringify(trait);
    const data = Buffer.concat([
      Buffer.from(traitString, 'utf8'),
      Buffer.from(nonce)
    ]);
    
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify trait commitment
   */
  verifyTraitCommitment(trait: any, nonce: Uint8Array, commitment: string): boolean {
    const calculatedCommitment = this.createTraitCommitment(trait, nonce);
    return calculatedCommitment === commitment;
  }

  /**
   * Create multiple trait commitments for bluffing mechanism
   */
  createTraitCommitments(traits: HiddenTraits, nonce: Uint8Array): { [key: string]: string } {
    const commitments: { [key: string]: string } = {};
    
    for (const [traitKey, traitValue] of Object.entries(traits)) {
      commitments[traitKey] = this.createTraitCommitment(traitValue, nonce);
    }
    
    return commitments;
  }

  /**
   * Generate proof of trait category without revealing specific trait
   */
  async generateCategoryProof(
    trait: any, 
    category: string, 
    key: EncryptionKey
  ): Promise<EncryptedData> {
    try {
      // Create category proof data
      const proofData = {
        category,
        hasTraitInCategory: this.isTraitInCategory(trait, category),
        timestamp: Date.now()
      };

      return await this.encryptionManager.encryptData(proofData, key);

    } catch (error) {
      throw new Error(`Category proof generation failed: ${error}`);
    }
  }

  /**
   * Verify category proof
   */
  async verifyCategoryProof(
    encryptedProof: EncryptedData, 
    key: EncryptionKey, 
    expectedCategory: string
  ): Promise<boolean> {
    try {
      const proofData = await this.encryptionManager.decryptData(encryptedProof, key);
      return proofData.category === expectedCategory && proofData.hasTraitInCategory === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if trait belongs to a category (simplified implementation)
   */
  private isTraitInCategory(trait: any, category: string): boolean {
    // Simplified category checking - in real implementation this would be more sophisticated
    const traitString = typeof trait === 'string' ? trait.toLowerCase() : JSON.stringify(trait).toLowerCase();
    const categoryLower = category.toLowerCase();
    
    // Basic category matching
    if (categoryLower === 'rare' && (traitString.includes('rare') || traitString.includes('legendary'))) {
      return true;
    }
    if (categoryLower === 'common' && (traitString.includes('common') || traitString.includes('basic'))) {
      return true;
    }
    if (categoryLower === 'special' && (traitString.includes('special') || traitString.includes('unique'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Create time-locked encryption (encrypt with time-based key derivation)
   */
  async createTimeLockedEncryption(
    traits: HiddenTraits, 
    unlockTimestamp: number, 
    masterKey: EncryptionKey
  ): Promise<EncryptedData> {
    try {
      // Derive time-specific key
      const timeData = Buffer.from(unlockTimestamp.toString());
      const timeHash = createHash('sha256').update(Buffer.concat([
        Buffer.from(masterKey.key),
        timeData
      ])).digest();

      const timeKey: EncryptionKey = {
        key: new Uint8Array(timeHash.subarray(0, this.config.keyLength)),
        iv: masterKey.iv
      };

      // Add timestamp to traits
      const timedTraits = {
        ...traits,
        _unlockTimestamp: unlockTimestamp,
        _createdAt: Date.now()
      };

      return await this.encryptTraits(timedTraits, timeKey);

    } catch (error) {
      throw new Error(`Time-locked encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt time-locked traits (only works after unlock time)
   */
  async decryptTimeLockedTraits(
    encryptedData: EncryptedData, 
    masterKey: EncryptionKey, 
    currentTimestamp: number = Date.now()
  ): Promise<HiddenTraits> {
    // Try different timestamps around the current time to find the correct unlock time
    const timeRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const step = 60 * 1000; // 1 minute steps
    
    for (let timestamp = currentTimestamp - timeRange; timestamp <= currentTimestamp + timeRange; timestamp += step) {
      try {
        const timeData = Buffer.from(timestamp.toString());
        const timeHash = createHash('sha256').update(Buffer.concat([
          Buffer.from(masterKey.key),
          timeData
        ])).digest();

        const timeKey: EncryptionKey = {
          key: new Uint8Array(timeHash.subarray(0, this.config.keyLength)),
          iv: masterKey.iv
        };

        const decryptedTraits = await this.decryptTraits(encryptedData, timeKey);
        
        // Check if this is the correct timestamp
        if (decryptedTraits._unlockTimestamp && decryptedTraits._unlockTimestamp <= currentTimestamp) {
          // Remove metadata fields
          delete decryptedTraits._unlockTimestamp;
          delete decryptedTraits._createdAt;
          return decryptedTraits;
        }
      } catch (error) {
        // Continue trying other timestamps
        continue;
      }
    }

    throw new Error('Time-locked traits cannot be decrypted - unlock time not reached or invalid key');
  }
}

/**
 * Create default encryption manager instance
 */
export function createEncryptionManager(config?: EncryptionConfig): HiddenTraitEncryption {
  return new HiddenTraitEncryption(config);
}

/**
 * Create data encryption manager with key management
 */
export function createDataEncryptionManager(
  config?: EncryptionConfig,
  rotationPolicy?: KeyRotationPolicy
): DataEncryptionManager {
  return new DataEncryptionManager(config, rotationPolicy);
}

/**
 * Utility functions for quick encryption/decryption
 */
export const EncryptionUtils = {
  /**
   * Quick encrypt with generated key
   */
  async quickEncrypt(data: HiddenTraits): Promise<{ encrypted: EncryptedData; key: EncryptionKey }> {
    const manager = new HiddenTraitEncryption();
    const key = manager.generateKey();
    const encrypted = await manager.encryptTraits(data, key);
    return { encrypted, key };
  },

  /**
   * Quick decrypt
   */
  async quickDecrypt(encrypted: EncryptedData, key: EncryptionKey): Promise<HiddenTraits> {
    const manager = new HiddenTraitEncryption();
    return await manager.decryptTraits(encrypted, key);
  },

  /**
   * Generate secure random key
   */
  generateSecureKey(): EncryptionKey {
    const manager = new HiddenTraitEncryption();
    return manager.generateKey();
  },

  /**
   * Encrypt any sensitive data with key management
   */
  async encryptSensitiveData(data: any, purpose?: string): Promise<EncryptedStorageEntry> {
    const manager = new DataEncryptionManager();
    manager.generateKey(purpose || 'sensitive-data');
    return await manager.encryptAndStore(data);
  },

  /**
   * Decrypt sensitive data
   */
  async decryptSensitiveData(entry: EncryptedStorageEntry, keyStore: string): Promise<any> {
    const manager = new DataEncryptionManager();
    manager.importKeyStore(keyStore);
    return await manager.retrieveAndDecrypt(entry);
  }
};
