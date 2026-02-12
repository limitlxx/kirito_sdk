/**
 * Comprehensive Data Encryption System
 * Provides encryption/decryption functionality with key management and rotation
 * Implements secure storage and retrieval mechanisms for all sensitive data
 */
import { EncryptionKey, EncryptedData, HiddenTraits } from '../types';
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
export declare class DataEncryptionManager {
    private config;
    private keyStore;
    private currentKeyId;
    private rotationPolicy;
    constructor(config?: EncryptionConfig, rotationPolicy?: KeyRotationPolicy);
    /**
     * Generate a new encryption key with metadata
     */
    generateKey(purpose?: string): StoredKey;
    /**
     * Generate encryption key from password using scrypt
     */
    generateKeyFromPassword(password: string, salt?: Uint8Array, purpose?: string): Promise<StoredKey>;
    /**
     * Rotate encryption key
     */
    rotateKey(oldKeyId: string, purpose?: string): Promise<StoredKey>;
    /**
     * Re-encrypt data with new key (for key rotation)
     */
    reencryptData(encryptedData: EncryptedData, oldKeyId: string, newKeyId: string): Promise<EncryptedData>;
    /**
     * Encrypt sensitive data using AES-256-GCM
     */
    encryptData(data: any, key: EncryptionKey): Promise<EncryptedData>;
    /**
     * Decrypt sensitive data using AES-256-GCM
     */
    decryptData(encryptedData: EncryptedData, key: EncryptionKey): Promise<any>;
    /**
     * Encrypt data with current key and store with metadata
     */
    encryptAndStore(data: any, metadata?: any): Promise<EncryptedStorageEntry>;
    /**
     * Retrieve and decrypt stored data
     */
    retrieveAndDecrypt(entry: EncryptedStorageEntry): Promise<any>;
    /**
     * Check if key should be rotated
     */
    private shouldRotateKey;
    /**
     * Generate unique key ID
     */
    private generateKeyId;
    /**
     * Get current key
     */
    getCurrentKey(): StoredKey | null;
    /**
     * Get key by ID
     */
    getKey(keyId: string): StoredKey | null;
    /**
     * List all keys
     */
    listKeys(): StoredKey[];
    /**
     * Remove expired keys
     */
    cleanupExpiredKeys(): number;
    /**
     * Export key store (for backup)
     */
    exportKeyStore(): string;
    /**
     * Import key store (from backup)
     */
    importKeyStore(exportedData: string): void;
}
/**
 * Hidden Trait Encryption Manager (backward compatible wrapper)
 * Uses DataEncryptionManager internally
 */
export declare class HiddenTraitEncryption {
    private encryptionManager;
    private config;
    constructor(config?: EncryptionConfig);
    /**
     * Generate a new encryption key
     */
    generateKey(): EncryptionKey;
    /**
     * Generate encryption key from password
     */
    generateKeyFromPassword(password: string, salt?: Uint8Array): Promise<EncryptionKey>;
    /**
     * Encrypt hidden traits for mystery box functionality
     */
    encryptTraits(traits: HiddenTraits, key: EncryptionKey): Promise<EncryptedData>;
    /**
     * Decrypt hidden traits
     */
    decryptTraits(encryptedData: EncryptedData, key: EncryptionKey): Promise<HiddenTraits>;
    /**
     * Encrypt specific trait values selectively
     */
    encryptSelectiveTraits(traits: HiddenTraits, key: EncryptionKey, traitKeysToHide: string[]): Promise<{
        encrypted: EncryptedData;
        visible: HiddenTraits;
    }>;
    /**
     * Create trait commitment (hash) without revealing the trait
     */
    createTraitCommitment(trait: any, nonce: Uint8Array): string;
    /**
     * Verify trait commitment
     */
    verifyTraitCommitment(trait: any, nonce: Uint8Array, commitment: string): boolean;
    /**
     * Create multiple trait commitments for bluffing mechanism
     */
    createTraitCommitments(traits: HiddenTraits, nonce: Uint8Array): {
        [key: string]: string;
    };
    /**
     * Generate proof of trait category without revealing specific trait
     */
    generateCategoryProof(trait: any, category: string, key: EncryptionKey): Promise<EncryptedData>;
    /**
     * Verify category proof
     */
    verifyCategoryProof(encryptedProof: EncryptedData, key: EncryptionKey, expectedCategory: string): Promise<boolean>;
    /**
     * Check if trait belongs to a category (simplified implementation)
     */
    private isTraitInCategory;
    /**
     * Create time-locked encryption (encrypt with time-based key derivation)
     */
    createTimeLockedEncryption(traits: HiddenTraits, unlockTimestamp: number, masterKey: EncryptionKey): Promise<EncryptedData>;
    /**
     * Decrypt time-locked traits (only works after unlock time)
     */
    decryptTimeLockedTraits(encryptedData: EncryptedData, masterKey: EncryptionKey, currentTimestamp?: number): Promise<HiddenTraits>;
}
/**
 * Create default encryption manager instance
 */
export declare function createEncryptionManager(config?: EncryptionConfig): HiddenTraitEncryption;
/**
 * Create data encryption manager with key management
 */
export declare function createDataEncryptionManager(config?: EncryptionConfig, rotationPolicy?: KeyRotationPolicy): DataEncryptionManager;
/**
 * Utility functions for quick encryption/decryption
 */
export declare const EncryptionUtils: {
    /**
     * Quick encrypt with generated key
     */
    quickEncrypt(data: HiddenTraits): Promise<{
        encrypted: EncryptedData;
        key: EncryptionKey;
    }>;
    /**
     * Quick decrypt
     */
    quickDecrypt(encrypted: EncryptedData, key: EncryptionKey): Promise<HiddenTraits>;
    /**
     * Generate secure random key
     */
    generateSecureKey(): EncryptionKey;
    /**
     * Encrypt any sensitive data with key management
     */
    encryptSensitiveData(data: any, purpose?: string): Promise<EncryptedStorageEntry>;
    /**
     * Decrypt sensitive data
     */
    decryptSensitiveData(entry: EncryptedStorageEntry, keyStore: string): Promise<any>;
};
//# sourceMappingURL=encryption.d.ts.map