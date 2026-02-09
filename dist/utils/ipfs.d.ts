/**
 * IPFS Integration Utilities
 * Handles IPFS uploads and retrieval for NFT metadata and images
 */
export interface IPFSConfig {
    url: string;
    projectId?: string;
    projectSecret?: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelayMs?: number;
}
export interface IPFSUploadResult {
    hash: string;
    url: string;
    size: number;
}
export interface BatchUploadOptions {
    batchSize?: number;
    delayBetweenBatches?: number;
    maxConcurrent?: number;
}
/**
 * IPFS Client for handling uploads and downloads with retry logic and batch optimization
 */
export declare class IPFSClient {
    private config;
    private defaultTimeout;
    private defaultRetryAttempts;
    private defaultRetryDelay;
    constructor(config: IPFSConfig);
    /**
     * Upload file to IPFS with retry logic
     */
    uploadFile(file: Buffer, filename: string): Promise<IPFSUploadResult>;
    /**
     * Upload JSON metadata to IPFS
     */
    uploadJSON(data: any, filename?: string): Promise<IPFSUploadResult>;
    /**
     * Upload multiple files to IPFS with batch optimization
     */
    uploadFiles(files: {
        buffer: Buffer;
        filename: string;
    }[], options?: BatchUploadOptions): Promise<IPFSUploadResult[]>;
    /**
     * Upload files with progress callback
     */
    uploadFilesWithProgress(files: {
        buffer: Buffer;
        filename: string;
    }[], onProgress?: (completed: number, total: number, currentFile: string) => void, options?: BatchUploadOptions): Promise<IPFSUploadResult[]>;
    /**
     * Retrieve file from IPFS with retry logic
     */
    getFile(hash: string): Promise<Buffer>;
    /**
     * Get IPFS gateway URL for hash
     */
    getGatewayUrl(hash: string, gateway?: string): string;
    /**
     * Pin file to IPFS (keep it available) with retry logic
     */
    pinFile(hash: string): Promise<void>;
    /**
     * Pin multiple files to IPFS
     */
    pinFiles(hashes: string[]): Promise<void>;
    /**
     * Check IPFS node status with timeout
     */
    getStatus(): Promise<{
        online: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Test IPFS connectivity by uploading and retrieving a small test file
     */
    testConnectivity(): Promise<{
        success: boolean;
        error?: string;
        roundTripTime?: number;
    }>;
    private getAuthHeaders;
    private delay;
}
/**
 * Create IPFS client instance with enhanced configuration
 */
export declare function createIPFSClient(config: IPFSConfig): IPFSClient;
/**
 * Create IPFS client with default Infura configuration
 */
export declare function createInfuraIPFSClient(projectId: string, projectSecret: string): IPFSClient;
/**
 * Create IPFS client with local node configuration
 */
export declare function createLocalIPFSClient(url?: string): IPFSClient;
//# sourceMappingURL=ipfs.d.ts.map