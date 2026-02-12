"use strict";
/**
 * Comprehensive Data Encryption System
 * Provides encryption/decryption functionality with key management and rotation
 * Implements secure storage and retrieval mechanisms for all sensitive data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionUtils = exports.HiddenTraitEncryption = exports.DataEncryptionManager = void 0;
exports.createEncryptionManager = createEncryptionManager;
exports.createDataEncryptionManager = createDataEncryptionManager;
const crypto_1 = require("crypto");
const util_1 = require("util");
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
/**
 * Default encryption configuration
 */
const DEFAULT_CONFIG = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16, // 128 bits
    saltLength: 32, // 256 bits
    scryptCost: 16384 // N parameter for scrypt
};
/**
 * Comprehensive Data Encryption Manager
 * Handles encryption, key management, rotation, and secure storage
 */
class DataEncryptionManager {
    constructor(config = {}, rotationPolicy) {
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
    generateKey(purpose = 'general') {
        const keyId = this.generateKeyId();
        const key = {
            key: (0, crypto_1.randomBytes)(this.config.keyLength),
            iv: (0, crypto_1.randomBytes)(this.config.ivLength)
        };
        const metadata = {
            id: keyId,
            version: 1,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.rotationPolicy.maxKeyAge,
            algorithm: this.config.algorithm,
            purpose
        };
        const storedKey = { key, metadata };
        this.keyStore.set(keyId, storedKey);
        if (!this.currentKeyId) {
            this.currentKeyId = keyId;
        }
        return storedKey;
    }
    /**
     * Generate encryption key from password using scrypt
     */
    async generateKeyFromPassword(password, salt, purpose = 'password-derived') {
        const saltBuffer = salt ? Buffer.from(salt) : (0, crypto_1.randomBytes)(this.config.saltLength);
        // Use scrypt for key derivation (more secure than PBKDF2)
        const keyBuffer = await scryptAsync(password, saltBuffer, this.config.keyLength);
        const ivBuffer = await scryptAsync(password + ':iv', saltBuffer, this.config.ivLength);
        const keyId = this.generateKeyId();
        const key = {
            key: new Uint8Array(keyBuffer),
            iv: new Uint8Array(ivBuffer)
        };
        const metadata = {
            id: keyId,
            version: 1,
            createdAt: Date.now(),
            algorithm: this.config.algorithm,
            purpose
        };
        const storedKey = { key, metadata };
        this.keyStore.set(keyId, storedKey);
        return storedKey;
    }
    /**
     * Rotate encryption key
     */
    async rotateKey(oldKeyId, purpose) {
        const oldKey = this.keyStore.get(oldKeyId);
        if (!oldKey) {
            throw new Error(`Key ${oldKeyId} not found for rotation`);
        }
        const newKeyId = this.generateKeyId();
        const key = {
            key: (0, crypto_1.randomBytes)(this.config.keyLength),
            iv: (0, crypto_1.randomBytes)(this.config.ivLength)
        };
        const metadata = {
            id: newKeyId,
            version: oldKey.metadata.version + 1,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.rotationPolicy.maxKeyAge,
            rotatedFrom: oldKeyId,
            algorithm: this.config.algorithm,
            purpose: purpose || oldKey.metadata.purpose
        };
        const newStoredKey = { key, metadata };
        this.keyStore.set(newKeyId, newStoredKey);
        this.currentKeyId = newKeyId;
        return newStoredKey;
    }
    /**
     * Re-encrypt data with new key (for key rotation)
     */
    async reencryptData(encryptedData, oldKeyId, newKeyId) {
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
    async encryptData(data, key) {
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
            const iv = (0, crypto_1.randomBytes)(this.config.ivLength);
            // Create cipher with GCM mode for authenticated encryption
            const cipher = (0, crypto_1.createCipheriv)(this.config.algorithm, Buffer.from(key.key), iv);
            // Encrypt data
            let encrypted = cipher.update(dataBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            // Get authentication tag (GCM mode)
            const authTag = cipher.getAuthTag();
            // Combine encrypted data with auth tag
            const combined = Buffer.concat([encrypted, authTag]);
            return {
                data: new Uint8Array(combined),
                nonce: new Uint8Array(iv)
            };
        }
        catch (error) {
            throw new Error(`Data encryption failed: ${error}`);
        }
    }
    /**
     * Decrypt sensitive data using AES-256-GCM
     */
    async decryptData(encryptedData, key) {
        try {
            const dataBuffer = Buffer.from(encryptedData.data);
            const iv = Buffer.from(encryptedData.nonce);
            // Extract auth tag (last 16 bytes for GCM)
            const authTagLength = 16;
            const authTag = dataBuffer.subarray(-authTagLength);
            const ciphertext = dataBuffer.subarray(0, -authTagLength);
            // Create decipher
            const decipher = (0, crypto_1.createDecipheriv)(this.config.algorithm, Buffer.from(key.key), iv);
            // Set auth tag for verification
            decipher.setAuthTag(authTag);
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
        }
        catch (error) {
            throw new Error(`Data decryption failed: ${error}`);
        }
    }
    /**
     * Encrypt data with current key and store with metadata
     */
    async encryptAndStore(data, metadata) {
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
    async retrieveAndDecrypt(entry) {
        const storedKey = this.keyStore.get(entry.keyId);
        if (!storedKey) {
            throw new Error(`Key ${entry.keyId} not found in key store`);
        }
        return await this.decryptData(entry.data, storedKey.key);
    }
    /**
     * Check if key should be rotated
     */
    shouldRotateKey(storedKey) {
        const age = Date.now() - storedKey.metadata.createdAt;
        return age >= this.rotationPolicy.rotationIntervalMs;
    }
    /**
     * Generate unique key ID
     */
    generateKeyId() {
        return `key_${Date.now()}_${(0, crypto_1.randomBytes)(8).toString('hex')}`;
    }
    /**
     * Get current key
     */
    getCurrentKey() {
        if (!this.currentKeyId)
            return null;
        return this.keyStore.get(this.currentKeyId) || null;
    }
    /**
     * Get key by ID
     */
    getKey(keyId) {
        return this.keyStore.get(keyId) || null;
    }
    /**
     * List all keys
     */
    listKeys() {
        return Array.from(this.keyStore.values());
    }
    /**
     * Remove expired keys
     */
    cleanupExpiredKeys() {
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
    exportKeyStore() {
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
    importKeyStore(exportedData) {
        const parsed = JSON.parse(exportedData);
        this.currentKeyId = parsed.currentKeyId;
        this.config = parsed.config;
        this.rotationPolicy = parsed.rotationPolicy;
        this.keyStore.clear();
        for (const entry of parsed.keys) {
            const storedKey = {
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
exports.DataEncryptionManager = DataEncryptionManager;
/**
 * Hidden Trait Encryption Manager (backward compatible wrapper)
 * Uses DataEncryptionManager internally
 */
class HiddenTraitEncryption {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.encryptionManager = new DataEncryptionManager(config);
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
     * Generate encryption key from password
     */
    async generateKeyFromPassword(password, salt) {
        const storedKey = await this.encryptionManager.generateKeyFromPassword(password, salt, 'hidden-traits');
        return storedKey.key;
    }
    /**
     * Encrypt hidden traits for mystery box functionality
     */
    async encryptTraits(traits, key) {
        return await this.encryptionManager.encryptData(traits, key);
    }
    /**
     * Decrypt hidden traits
     */
    async decryptTraits(encryptedData, key) {
        return await this.encryptionManager.decryptData(encryptedData, key);
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
            return await this.encryptionManager.encryptData(proofData, key);
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
            const proofData = await this.encryptionManager.decryptData(encryptedProof, key);
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
 * Create data encryption manager with key management
 */
function createDataEncryptionManager(config, rotationPolicy) {
    return new DataEncryptionManager(config, rotationPolicy);
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
    },
    /**
     * Encrypt any sensitive data with key management
     */
    async encryptSensitiveData(data, purpose) {
        const manager = new DataEncryptionManager();
        manager.generateKey(purpose || 'sensitive-data');
        return await manager.encryptAndStore(data);
    },
    /**
     * Decrypt sensitive data
     */
    async decryptSensitiveData(entry, keyStore) {
        const manager = new DataEncryptionManager();
        manager.importKeyStore(keyStore);
        return await manager.retrieveAndDecrypt(entry);
    }
};
//# sourceMappingURL=encryption.js.map