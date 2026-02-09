"use strict";
/**
 * IPFS Integration Utilities
 * Handles IPFS uploads and retrieval for NFT metadata and images
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPFSClient = void 0;
exports.createIPFSClient = createIPFSClient;
exports.createInfuraIPFSClient = createInfuraIPFSClient;
exports.createLocalIPFSClient = createLocalIPFSClient;
/**
 * IPFS Client for handling uploads and downloads with retry logic and batch optimization
 */
class IPFSClient {
    constructor(config) {
        this.defaultTimeout = 30000; // 30 seconds
        this.defaultRetryAttempts = 3;
        this.defaultRetryDelay = 1000; // 1 second
        this.config = {
            timeout: this.defaultTimeout,
            retryAttempts: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelay,
            ...config
        };
    }
    /**
     * Upload file to IPFS with retry logic
     */
    async uploadFile(file, filename) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const formData = new FormData();
                const blob = new Blob([file], { type: 'application/octet-stream' });
                formData.append('file', blob, filename);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                const response = await fetch(`${this.config.url}/api/v0/add`, {
                    method: 'POST',
                    body: formData,
                    headers: this.getAuthHeaders(),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
                }
                const result = await response.json();
                return {
                    hash: result.Hash,
                    url: `ipfs://${result.Hash}`,
                    size: result.Size
                };
            }
            catch (error) {
                lastError = error;
                if (attempt < this.config.retryAttempts) {
                    console.warn(`IPFS upload attempt ${attempt} failed for ${filename}, retrying...`, error);
                    await this.delay(this.config.retryDelayMs * attempt); // Exponential backoff
                }
            }
        }
        throw new Error(`Failed to upload ${filename} to IPFS after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
    }
    /**
     * Upload JSON metadata to IPFS
     */
    async uploadJSON(data, filename) {
        const jsonBuffer = Buffer.from(JSON.stringify(data, null, 2));
        return this.uploadFile(jsonBuffer, filename || 'metadata.json');
    }
    /**
     * Upload multiple files to IPFS with batch optimization
     */
    async uploadFiles(files, options = {}) {
        const { batchSize = 10, delayBetweenBatches = 1000, maxConcurrent = 5 } = options;
        const results = [];
        // Process files in batches
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            // Process batch with concurrency limit
            const batchPromises = batch.map(async (file, index) => {
                // Stagger requests within batch to avoid overwhelming IPFS
                if (index > 0 && index % maxConcurrent === 0) {
                    await this.delay(200); // Small delay every maxConcurrent files
                }
                return this.uploadFile(file.buffer, file.filename);
            });
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
                console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)} (${batchResults.length} files)`);
                // Delay between batches (except for the last batch)
                if (i + batchSize < files.length) {
                    await this.delay(delayBetweenBatches);
                }
            }
            catch (error) {
                throw new Error(`Batch upload failed at batch starting with index ${i}: ${error}`);
            }
        }
        return results;
    }
    /**
     * Upload files with progress callback
     */
    async uploadFilesWithProgress(files, onProgress, options = {}) {
        const { batchSize = 10, delayBetweenBatches = 1000, maxConcurrent = 5 } = options;
        const results = [];
        let completed = 0;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchPromises = batch.map(async (file, index) => {
                if (index > 0 && index % maxConcurrent === 0) {
                    await this.delay(200);
                }
                onProgress?.(completed, files.length, file.filename);
                const result = await this.uploadFile(file.buffer, file.filename);
                completed++;
                onProgress?.(completed, files.length, file.filename);
                return result;
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < files.length) {
                await this.delay(delayBetweenBatches);
            }
        }
        return results;
    }
    /**
     * Retrieve file from IPFS with retry logic
     */
    async getFile(hash) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                const response = await fetch(`${this.config.url}/api/v0/cat?arg=${hash}`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`IPFS retrieval failed: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
            catch (error) {
                lastError = error;
                if (attempt < this.config.retryAttempts) {
                    console.warn(`IPFS retrieval attempt ${attempt} failed for ${hash}, retrying...`, error);
                    await this.delay(this.config.retryDelayMs * attempt);
                }
            }
        }
        throw new Error(`Failed to retrieve ${hash} from IPFS after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
    }
    /**
     * Get IPFS gateway URL for hash
     */
    getGatewayUrl(hash, gateway = 'https://ipfs.io/ipfs/') {
        return `${gateway}${hash}`;
    }
    /**
     * Pin file to IPFS (keep it available) with retry logic
     */
    async pinFile(hash) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
                const response = await fetch(`${this.config.url}/api/v0/pin/add?arg=${hash}`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error(`IPFS pinning failed: ${response.status} ${response.statusText}`);
                }
                return; // Success
            }
            catch (error) {
                lastError = error;
                if (attempt < this.config.retryAttempts) {
                    console.warn(`IPFS pinning attempt ${attempt} failed for ${hash}, retrying...`, error);
                    await this.delay(this.config.retryDelayMs * attempt);
                }
            }
        }
        throw new Error(`Failed to pin ${hash} to IPFS after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
    }
    /**
     * Pin multiple files to IPFS
     */
    async pinFiles(hashes) {
        const pinPromises = hashes.map(hash => this.pinFile(hash));
        await Promise.all(pinPromises);
    }
    /**
     * Check IPFS node status with timeout
     */
    async getStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for status check
            const response = await fetch(`${this.config.url}/api/v0/version`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                return {
                    online: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
            const result = await response.json();
            return {
                online: true,
                version: result.Version
            };
        }
        catch (error) {
            return {
                online: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Test IPFS connectivity by uploading and retrieving a small test file
     */
    async testConnectivity() {
        try {
            const startTime = Date.now();
            const testData = Buffer.from(`IPFS connectivity test - ${Date.now()}`);
            // Upload test file
            const uploadResult = await this.uploadFile(testData, 'connectivity-test.txt');
            // Retrieve test file
            const retrievedData = await this.getFile(uploadResult.hash);
            const roundTripTime = Date.now() - startTime;
            // Verify data integrity
            if (!testData.equals(retrievedData)) {
                return {
                    success: false,
                    error: 'Data integrity check failed - uploaded and retrieved data do not match'
                };
            }
            return {
                success: true,
                roundTripTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    getAuthHeaders() {
        const headers = {};
        if (this.config.projectId && this.config.projectSecret) {
            const auth = Buffer.from(`${this.config.projectId}:${this.config.projectSecret}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.IPFSClient = IPFSClient;
/**
 * Create IPFS client instance with enhanced configuration
 */
function createIPFSClient(config) {
    return new IPFSClient(config);
}
/**
 * Create IPFS client with default Infura configuration
 */
function createInfuraIPFSClient(projectId, projectSecret) {
    return new IPFSClient({
        url: 'https://ipfs.infura.io:5001',
        projectId,
        projectSecret,
        timeout: 60000, // 60 seconds for Infura
        retryAttempts: 3,
        retryDelayMs: 2000
    });
}
/**
 * Create IPFS client with local node configuration
 */
function createLocalIPFSClient(url = 'http://localhost:5001') {
    return new IPFSClient({
        url,
        timeout: 30000,
        retryAttempts: 2,
        retryDelayMs: 1000
    });
}
//# sourceMappingURL=ipfs.js.map