import { KiritoSDKConfig, NetworkConfig } from '../types';
import { GenerationEngine, NFTWallet, ShieldedPoolManager, MysteryBoxManager, AnonymousGovernance, ErrorHandler } from '../interfaces';
/**
 * Main Kirito SDK Class
 * Provides unified interface to all privacy-focused NFT functionality
 */
export declare class KiritoSDK {
    private config;
    private generationEngine?;
    private nftWallet?;
    private shieldedPool?;
    private mysteryBox?;
    private governance?;
    private errorHandler?;
    constructor(config?: Partial<KiritoSDKConfig>);
    /**
     * Initialize SDK with all components
     */
    initialize(): Promise<void>;
    /**
     * Initialize all SDK components
     */
    private initializeComponents;
    /**
     * Get current network configuration
     */
    getNetworkConfig(): NetworkConfig;
    /**
     * Switch to different network
     */
    switchNetwork(networkConfig: NetworkConfig): Promise<void>;
    /**
     * Get Generation Engine instance
     */
    getGenerationEngine(): GenerationEngine;
    /**
     * Get NFT Wallet instance
     */
    getNFTWallet(): NFTWallet;
    /**
     * Get Shielded Pool Manager instance
     */
    getShieldedPool(): ShieldedPoolManager;
    /**
     * Get Mystery Box Manager instance
     */
    getMysteryBox(): MysteryBoxManager;
    /**
     * Get Anonymous Governance instance
     */
    getGovernance(): AnonymousGovernance;
    /**
     * Get Error Handler instance
     */
    getErrorHandler(): ErrorHandler;
    /**
     * Health check for all components
     */
    healthCheck(): Promise<{
        [component: string]: boolean;
    }>;
    /**
     * Comprehensive error handling and recovery
     */
    handleError(error: Error, context: string): Promise<void>;
    /**
     * Graceful shutdown of all components
     */
    shutdown(): Promise<void>;
    /**
     * Get SDK version and build info
     */
    getVersion(): {
        version: string;
        buildDate: string;
        components: string[];
    };
    /**
     * Get current configuration
     */
    getConfig(): KiritoSDKConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<KiritoSDKConfig>): Promise<void>;
    private checkNetworkConnectivity;
    private checkIPFSConnectivity;
    private checkTongoConnectivity;
    private checkSemaphoreConnectivity;
    private recoverNetworkConnection;
    private recoverIPFSConnection;
    private recoverPrivacyServices;
}
//# sourceMappingURL=kirito-sdk.d.ts.map