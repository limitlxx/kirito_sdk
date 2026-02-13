import { KiritoSDKConfig, NetworkConfig, Address, TokenId, TransactionHash, TokenMetadata, YieldAmount, TimePeriod } from '../types';
import { GenerationEngine, NFTWallet, ShieldedPoolManager, MysteryBoxManager, AnonymousGovernance, SealedBidAuction } from '../interfaces';
import { AllocationFactors } from './wallet-allocation';
import { DeFiYieldAggregator } from './defi-yield-aggregator';
import { ComprehensiveWallet } from './comprehensive-wallet';
import { WalletConnector, WalletType, WalletInfo, WalletConnectionResult } from './wallet-connector';
import { Account } from 'starknet';
/**
 * SDK Logger for comprehensive logging
 */
export interface SDKLogger {
    debug(message: string, context?: any): void;
    info(message: string, context?: any): void;
    warn(message: string, context?: any): void;
    error(message: string, error?: Error, context?: any): void;
}
/**
 * Main Kirito SDK Class
 * Provides unified interface to all privacy-focused NFT functionality
 *
 * Features:
 * - NFT generation and minting with privacy features
 * - Shielded staking and yield distribution
 * - Mystery box reveals with ZK proofs
 * - Anonymous governance and voting
 * - Sealed-bid auctions
 * - Multi-token wallet management
 * - DeFi protocol integration
 * - Comprehensive error handling and logging
 */
export declare class KiritoSDK {
    private config;
    private logger;
    private generationEngine?;
    private nftWallet?;
    private shieldedPool?;
    private mysteryBox?;
    private governance?;
    private auction?;
    private errorHandler?;
    private walletAllocation?;
    private defiAggregator?;
    private walletConnector?;
    private starknetAccount?;
    private isInitialized;
    constructor(config?: Partial<KiritoSDKConfig>, logger?: SDKLogger);
    /**
     * Initialize SDK with all components
     *
     * @param starknetAccount - Optional Starknet account for transaction signing
     * @param allocationFactors - Optional custom allocation factors for yield distribution
     */
    initialize(starknetAccount?: Account, allocationFactors?: AllocationFactors): Promise<void>;
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
     * Get Sealed-Bid Auction instance
     */
    getAuction(): SealedBidAuction;
    /**
     * Get Wallet Connector instance
     */
    getWalletConnector(): WalletConnector;
    /**
     * Detect available wallets
     */
    detectWallets(): Promise<WalletInfo[]>;
    /**
     * Connect to a wallet
     */
    connectWallet(walletType: WalletType): Promise<WalletConnectionResult>;
    /**
     * Disconnect from current wallet
     */
    disconnectWallet(): Promise<void>;
    /**
     * Get connected wallet info
     */
    getConnectedWallet(): WalletInfo | null;
    /**
     * Check if wallet is connected
     */
    isWalletConnected(): boolean;
    /**
     * Get DeFi Yield Aggregator instance
     */
    getDeFiAggregator(): DeFiYieldAggregator;
    /**
     * Create a comprehensive wallet instance for an NFT
     */
    createComprehensiveWallet(walletAddress: Address, tokenId: TokenId): ComprehensiveWallet;
    /**
     * High-level API: Mint NFT with yield allocation
     */
    mintWithYieldAllocation(recipient: Address, metadata: TokenMetadata, stakeAmount: bigint, yieldSourcePreferences?: string[]): Promise<{
        tokenId: TokenId;
        txHash: TransactionHash;
        allocation: any;
    }>;
    /**
     * High-level API: Get aggregated yield for wallet
     */
    getAggregatedYield(walletAddress: Address, period: TimePeriod): Promise<YieldAmount>;
    /**
     * High-level API: Optimize yield distribution
     */
    optimizeYieldDistribution(walletAddress: Address, period: TimePeriod): Promise<any>;
    /**
     * High-level API: Execute rebalancing
     */
    executeRebalancing(walletAddress: Address, optimization: any): Promise<TransactionHash[]>;
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
    /**
     * Get logger instance
     */
    getLogger(): SDKLogger;
    /**
     * Set custom logger
     */
    setLogger(logger: SDKLogger): void;
    /**
     * Check if SDK is initialized
     */
    isReady(): boolean;
    /**
     * Ensure SDK is initialized before operations
     */
    private ensureInitialized;
    private checkNetworkConnectivity;
    private checkIPFSConnectivity;
    private checkTongoConnectivity;
    private checkSemaphoreConnectivity;
    private recoverNetworkConnection;
    private recoverIPFSConnection;
    private recoverPrivacyServices;
}
/**
 * Factory function to create Kirito SDK instance
 */
export declare function createKiritoSDK(config?: Partial<KiritoSDKConfig>, logger?: SDKLogger): KiritoSDK;
//# sourceMappingURL=kirito-sdk.d.ts.map