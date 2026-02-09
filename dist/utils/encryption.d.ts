/**
 * Encryption Utilities for Hidden Traits
 * Provides encryption/decryption functionality for mystery box traits
 */
import { EncryptionKey, EncryptedData, HiddenTraits } from '../types';
/**
 * Encryption configuration options
 */
export interface EncryptionConfig {
    algorithm?: string;
    keyLength?: number;
    ivLength?: number;
}
/**
 * Hidden Trait Encryption Manager
 */
export declare class HiddenTraitEncryption {
    private config;
    constructor(config?: EncryptionConfig);
    /**
     * Generate a new encryption key
     */
    generateKey(): EncryptionKey;
    /**
     * Generate encryption key from password (deterministic)
     */
    generateKeyFromPassword(password: string, salt?: Uint8Array): EncryptionKey;
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
};
//# sourceMappingURL=encryption.d.ts.map