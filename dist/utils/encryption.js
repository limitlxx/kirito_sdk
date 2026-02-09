"use strict";
/**
 * Encryption Utilities for Hidden Traits
 * Provides encryption/decryption functionality for mystery box traits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionUtils = exports.HiddenTraitEncryption = void 0;
exports.createEncryptionManager = createEncryptionManager;
const crypto_1 = require("crypto");
/**
 * Default encryption configuration
 */
const DEFAULT_CONFIG = {
    algorithm: 'aes-256-cbc',
    keyLength: 32, // 256 bits
    ivLength: 16 // 128 bits
};
/**
 * Hidden Trait Encryption Manager
 */
class HiddenTraitEncryption {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Generate a new encryption key
     */
    generateKey() {
        return {
            key: (0, crypto_1.randomBytes)(this.config.keyLength),
            iv: (0, crypto_1.randomBytes)(this.config.ivLength)
        };
    }
    /**
     * Generate encryption key from password (deterministic)
     */
    generateKeyFromPassword(password, salt) {
        const saltBuffer = salt ? Buffer.from(salt) : (0, crypto_1.randomBytes)(16);
        // Use PBKDF2 for key derivation
        const crypto = require('crypto');
        const key = crypto.pbkdf2Sync(password, saltBuffer, 100000, this.config.keyLength, 'sha256');
        const iv = crypto.pbkdf2Sync(password + 'iv', saltBuffer, 100000, this.config.ivLength, 'sha256');
        return {
            key: new Uint8Array(key),
            iv: new Uint8Array(iv)
        };
    }
    /**
     * Encrypt hidden traits for mystery box functionality
     */
    async encryptTraits(traits, key) {
        try {
            // Serialize traits to JSON
            const traitsJson = JSON.stringify(traits);
            const traitsBuffer = Buffer.from(traitsJson, 'utf8');
            // Create cipher
            const cipher = (0, crypto_1.createCipher)(this.config.algorithm, Buffer.from(key.key));
            // Encrypt data
            let encrypted = cipher.update(traitsBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return {
                data: new Uint8Array(encrypted),
                nonce: key.iv
            };
        }
        catch (error) {
            throw new Error(`Trait encryption failed: ${error}`);
        }
    }
    /**
     * Decrypt hidden traits
     */
    async decryptTraits(encryptedData, key) {
        try {
            const dataBuffer = Buffer.from(encryptedData.data);
            // Create decipher
            const decipher = (0, crypto_1.createDecipher)(this.config.algorithm, Buffer.from(key.key));
            // Decrypt data
            let decrypted = decipher.update(dataBuffer);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            // Parse JSON
            const traitsJson = decrypted.toString('utf8');
            return JSON.parse(traitsJson);
        }
        catch (error) {
            throw new Error(`Trait decryption failed: ${error}`);
        }
    }
    /**
     * Encrypt specific trait values selectively
     */
    async encryptSelectiveTraits(traits, key, traitKeysToHide) {
        try {
            const hiddenTraits = {};
            const visibleTraits = {};
            // Separate traits into hidden and visible
            for (const [traitKey, traitValue] of Object.entries(traits)) {
                if (traitKeysToHide.includes(traitKey)) {
                    hiddenTraits[traitKey] = traitValue;
                }
                else {
                    visibleTraits[traitKey] = traitValue;
                }
            }
            // Encrypt only the hidden traits
            const encrypted = await this.encryptTraits(hiddenTraits, key);
            return {
                encrypted,
                visible: visibleTraits
            };
        }
        catch (error) {
            throw new Error(`Selective trait encryption failed: ${error}`);
        }
    }
    /**
     * Create trait commitment (hash) without revealing the trait
     */
    createTraitCommitment(trait, nonce) {
        const traitString = typeof trait === 'string' ? trait : JSON.stringify(trait);
        const data = Buffer.concat([
            Buffer.from(traitString, 'utf8'),
            Buffer.from(nonce)
        ]);
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    /**
     * Verify trait commitment
     */
    verifyTraitCommitment(trait, nonce, commitment) {
        const calculatedCommitment = this.createTraitCommitment(trait, nonce);
        return calculatedCommitment === commitment;
    }
    /**
     * Create multiple trait commitments for bluffing mechanism
     */
    createTraitCommitments(traits, nonce) {
        const commitments = {};
        for (const [traitKey, traitValue] of Object.entries(traits)) {
            commitments[traitKey] = this.createTraitCommitment(traitValue, nonce);
        }
        return commitments;
    }
    /**
     * Generate proof of trait category without revealing specific trait
     */
    async generateCategoryProof(trait, category, key) {
        try {
            // Create category proof data
            const proofData = {
                category,
                hasTraitInCategory: this.isTraitInCategory(trait, category),
                timestamp: Date.now()
            };
            // Encrypt the proof
            const proofJson = JSON.stringify(proofData);
            const proofBuffer = Buffer.from(proofJson, 'utf8');
            const cipher = (0, crypto_1.createCipher)(this.config.algorithm, Buffer.from(key.key));
            let encrypted = cipher.update(proofBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return {
                data: new Uint8Array(encrypted),
                nonce: key.iv
            };
        }
        catch (error) {
            throw new Error(`Category proof generation failed: ${error}`);
        }
    }
    /**
     * Verify category proof
     */
    async verifyCategoryProof(encryptedProof, key, expectedCategory) {
        try {
            const dataBuffer = Buffer.from(encryptedProof.data);
            const decipher = (0, crypto_1.createDecipher)(this.config.algorithm, Buffer.from(key.key));
            let decrypted = decipher.update(dataBuffer);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            const proofData = JSON.parse(decrypted.toString('utf8'));
            return proofData.category === expectedCategory && proofData.hasTraitInCategory === true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if trait belongs to a category (simplified implementation)
     */
    isTraitInCategory(trait, category) {
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
    async createTimeLockedEncryption(traits, unlockTimestamp, masterKey) {
        try {
            // Derive time-specific key
            const timeData = Buffer.from(unlockTimestamp.toString());
            const timeHash = (0, crypto_1.createHash)('sha256').update(Buffer.concat([
                Buffer.from(masterKey.key),
                timeData
            ])).digest();
            const timeKey = {
                key: new Uint8Array(timeHash.slice(0, this.config.keyLength)),
                iv: masterKey.iv
            };
            // Add timestamp to traits
            const timedTraits = {
                ...traits,
                _unlockTimestamp: unlockTimestamp,
                _createdAt: Date.now()
            };
            return await this.encryptTraits(timedTraits, timeKey);
        }
        catch (error) {
            throw new Error(`Time-locked encryption failed: ${error}`);
        }
    }
    /**
     * Decrypt time-locked traits (only works after unlock time)
     */
    async decryptTimeLockedTraits(encryptedData, masterKey, currentTimestamp = Date.now()) {
        // Try different timestamps around the current time to find the correct unlock time
        const timeRange = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const step = 60 * 1000; // 1 minute steps
        for (let timestamp = currentTimestamp - timeRange; timestamp <= currentTimestamp + timeRange; timestamp += step) {
            try {
                const timeData = Buffer.from(timestamp.toString());
                const timeHash = (0, crypto_1.createHash)('sha256').update(Buffer.concat([
                    Buffer.from(masterKey.key),
                    timeData
                ])).digest();
                const timeKey = {
                    key: new Uint8Array(timeHash.slice(0, this.config.keyLength)),
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
            }
            catch (error) {
                // Continue trying other timestamps
                continue;
            }
        }
        throw new Error('Time-locked traits cannot be decrypted - unlock time not reached or invalid key');
    }
}
exports.HiddenTraitEncryption = HiddenTraitEncryption;
/**
 * Create default encryption manager instance
 */
function createEncryptionManager(config) {
    return new HiddenTraitEncryption(config);
}
/**
 * Utility functions for quick encryption/decryption
 */
exports.EncryptionUtils = {
    /**
     * Quick encrypt with generated key
     */
    async quickEncrypt(data) {
        const manager = new HiddenTraitEncryption();
        const key = manager.generateKey();
        const encrypted = await manager.encryptTraits(data, key);
        return { encrypted, key };
    },
    /**
     * Quick decrypt
     */
    async quickDecrypt(encrypted, key) {
        const manager = new HiddenTraitEncryption();
        return await manager.decryptTraits(encrypted, key);
    },
    /**
     * Generate secure random key
     */
    generateSecureKey() {
        const manager = new HiddenTraitEncryption();
        return manager.generateKey();
    }
};
//# sourceMappingURL=encryption.js.map