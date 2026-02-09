import {
  KiritoSDKConfig,
  NetworkConfig,
  Address,
  TokenId,
  TransactionHash
} from '../types';

import {
  GenerationEngine,
  NFTWallet,
  ShieldedPoolManager,
  MysteryBoxManager,
  AnonymousGovernance,
  SealedBidAuction,
  ErrorHandler
} from '../interfaces';

import { DEFAULT_CONFIG, validateConfig } from './config';
import { NFTWalletSDK } from './nft-wallet';
import { ShieldedPoolManagerSDK } from './shielded-pool';
import { MysteryBoxManagerSDK } from './mystery-box';
import { AnonymousGovernanceSDK } from './governance';
import { SealedBidAuctionSDK } from './auction';

/**
 * Main Kirito SDK Class
 * Provides unified interface to all privacy-focused NFT functionality
 */
export class KiritoSDK {
  private config: KiritoSDKConfig;
  private generationEngine?: GenerationEngine;
  private nftWallet?: NFTWallet;
  private shieldedPool?: ShieldedPoolManager;
  private mysteryBox?: MysteryBoxManager;
  private governance?: AnonymousGovernance;
  private auction?: SealedBidAuction;
  private errorHandler?: ErrorHandler;

  constructor(config?: Partial<KiritoSDKConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as KiritoSDKConfig;
    validateConfig(this.config);
  }

  /**
   * Initialize SDK with all components
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Kirito SDK...');
      console.log(`Network: ${this.config.network.name}`);
      console.log(`Chain ID: ${this.config.network.chainId}`);
      console.log(`RPC URL: ${this.config.network.rpcUrl}`);
      console.log(`IPFS URL: ${this.config.ipfs.url}`);
      
      // Initialize all SDK components
      await this.initializeComponents();
      
      // Perform initial health checks
      const health = await this.healthCheck();
      console.log('Component health status:', health);
      
      console.log('SDK initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize SDK: ${error}`);
    }
  }

  /**
   * Initialize all SDK components
   */
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize NFT Wallet component
      this.nftWallet = new NFTWalletSDK(this.config);
      console.log('✓ NFT Wallet component initialized');

      // Initialize Shielded Pool component (requires a mock account for now)
      const mockAccount = {
        address: '0x0000000000000000000000000000000000000000000000000000000000000000',
        execute: async () => ({ transaction_hash: '0x0' })
      } as any;
      this.shieldedPool = new ShieldedPoolManagerSDK(this.config, mockAccount);
      console.log('✓ Shielded Pool component initialized');

      // Initialize Mystery Box component
      this.mysteryBox = new MysteryBoxManagerSDK(this.config);
      console.log('✓ Mystery Box component initialized');

      // Initialize Anonymous Governance component
      this.governance = new AnonymousGovernanceSDK(this.config);
      console.log('✓ Anonymous Governance component initialized');

      // Initialize Sealed-Bid Auction component
      this.auction = new SealedBidAuctionSDK(this.config);
      console.log('✓ Sealed-Bid Auction component initialized');

      // Generation Engine will be initialized when needed (from existing implementation)
      console.log('✓ All components ready for use');
    } catch (error) {
      throw new Error(`Failed to initialize components: ${error}`);
    }
  }

  /**
   * Get current network configuration
   */
  getNetworkConfig(): NetworkConfig {
    return this.config.network;
  }

  /**
   * Switch to different network
   */
  async switchNetwork(networkConfig: NetworkConfig): Promise<void> {
    console.log(`Switching network from ${this.config.network.name} to ${networkConfig.name}`);
    
    this.config.network = networkConfig;
    
    // Re-initialize all components with new network configuration
    await this.initializeComponents();
    
    console.log(`Successfully switched to network: ${networkConfig.name}`);
  }

  /**
   * Get Generation Engine instance
   */
  getGenerationEngine(): GenerationEngine {
    if (!this.generationEngine) {
      throw new Error('Generation Engine not initialized');
    }
    return this.generationEngine;
  }

  /**
   * Get NFT Wallet instance
   */
  getNFTWallet(): NFTWallet {
    if (!this.nftWallet) {
      throw new Error('NFT Wallet not initialized');
    }
    return this.nftWallet;
  }

  /**
   * Get Shielded Pool Manager instance
   */
  getShieldedPool(): ShieldedPoolManager {
    if (!this.shieldedPool) {
      throw new Error('Shielded Pool not initialized');
    }
    return this.shieldedPool;
  }

  /**
   * Get Mystery Box Manager instance
   */
  getMysteryBox(): MysteryBoxManager {
    if (!this.mysteryBox) {
      throw new Error('Mystery Box Manager not initialized');
    }
    return this.mysteryBox;
  }

  /**
   * Get Anonymous Governance instance
   */
  getGovernance(): AnonymousGovernance {
    if (!this.governance) {
      throw new Error('Anonymous Governance not initialized');
    }
    return this.governance;
  }

  /**
   * Get Sealed-Bid Auction instance
   */
  getAuction(): SealedBidAuction {
    if (!this.auction) {
      throw new Error('Sealed-Bid Auction not initialized');
    }
    return this.auction;
  }

  /**
   * Get Error Handler instance
   */
  getErrorHandler(): ErrorHandler {
    if (!this.errorHandler) {
      throw new Error('Error Handler not initialized');
    }
    return this.errorHandler;
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<{ [component: string]: boolean }> {
    const health = {
      network: false,
      ipfs: false,
      tongo: false,
      semaphore: false,
      nftWallet: false,
      shieldedPool: false,
      mysteryBox: false,
      governance: false
    };

    try {
      // Network connectivity check
      health.network = await this.checkNetworkConnectivity();
      
      // IPFS connectivity check
      health.ipfs = await this.checkIPFSConnectivity();
      
      // Privacy service checks
      health.tongo = await this.checkTongoConnectivity();
      health.semaphore = await this.checkSemaphoreConnectivity();

      // Component health checks
      health.nftWallet = this.nftWallet !== undefined;
      health.shieldedPool = this.shieldedPool !== undefined;
      health.mysteryBox = this.mysteryBox !== undefined;
      health.governance = this.governance !== undefined;
      
    } catch (error) {
      console.error('Health check failed:', error);
    }

    return health;
  }

  /**
   * Comprehensive error handling and recovery
   */
  async handleError(error: Error, context: string): Promise<void> {
    console.error(`Error in ${context}:`, error.message);
    
    // Log error details for debugging
    console.error('Error stack:', error.stack);
    
    // Attempt recovery based on error type
    if (error.message.includes('network') || error.message.includes('RPC')) {
      console.log('Attempting network recovery...');
      await this.recoverNetworkConnection();
    } else if (error.message.includes('IPFS')) {
      console.log('Attempting IPFS recovery...');
      await this.recoverIPFSConnection();
    } else if (error.message.includes('privacy') || error.message.includes('proof')) {
      console.log('Attempting privacy service recovery...');
      await this.recoverPrivacyServices();
    }
  }

  /**
   * Graceful shutdown of all components
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down Kirito SDK...');
      
      // Clear component references
      this.generationEngine = undefined;
      this.nftWallet = undefined;
      this.shieldedPool = undefined;
      this.mysteryBox = undefined;
      this.governance = undefined;
      this.auction = undefined;
      this.errorHandler = undefined;
      
      console.log('SDK shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Get SDK version and build info
   */
  getVersion(): { version: string; buildDate: string; components: string[] } {
    return {
      version: '1.0.0-beta',
      buildDate: new Date().toISOString(),
      components: [
        'GenerationEngine',
        'NFTWallet', 
        'ShieldedPoolManager',
        'MysteryBoxManager',
        'AnonymousGovernance',
        'SealedBidAuction'
      ]
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): KiritoSDKConfig {
    return { ...this.config }; // Return copy to prevent external modification
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<KiritoSDKConfig>): Promise<void> {
    const updatedConfig = { ...this.config, ...newConfig } as KiritoSDKConfig;
    validateConfig(updatedConfig);
    
    this.config = updatedConfig;
    
    // Re-initialize components if network changed
    if (newConfig.network) {
      await this.initializeComponents();
    }
    
    console.log('Configuration updated successfully');
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Basic RPC connectivity check
      const response = await fetch(this.config.network.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'starknet_chainId',
          params: [],
          id: 1
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkIPFSConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ipfs.url}/api/v0/version`, {
        method: 'POST'
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkTongoConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.privacy.tongoEndpoint}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkSemaphoreConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.privacy.semaphoreEndpoint}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Recovery methods

  private async recoverNetworkConnection(): Promise<void> {
    try {
      console.log('Attempting to recover network connection...');
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test network connectivity
      const isConnected = await this.checkNetworkConnectivity();
      if (isConnected) {
        console.log('Network connection recovered');
      } else {
        console.log('Network connection recovery failed');
      }
    } catch (error) {
      console.error('Network recovery error:', error);
    }
  }

  private async recoverIPFSConnection(): Promise<void> {
    try {
      console.log('Attempting to recover IPFS connection...');
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test IPFS connectivity
      const isConnected = await this.checkIPFSConnectivity();
      if (isConnected) {
        console.log('IPFS connection recovered');
      } else {
        console.log('IPFS connection recovery failed');
      }
    } catch (error) {
      console.error('IPFS recovery error:', error);
    }
  }

  private async recoverPrivacyServices(): Promise<void> {
    try {
      console.log('Attempting to recover privacy services...');
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test privacy service connectivity
      const tongoConnected = await this.checkTongoConnectivity();
      const semaphoreConnected = await this.checkSemaphoreConnectivity();
      
      if (tongoConnected && semaphoreConnected) {
        console.log('Privacy services recovered');
      } else {
        console.log('Privacy services recovery partial or failed');
        console.log(`Tongo: ${tongoConnected ? 'OK' : 'FAILED'}`);
        console.log(`Semaphore: ${semaphoreConnected ? 'OK' : 'FAILED'}`);
      }
    } catch (error) {
      console.error('Privacy services recovery error:', error);
    }
  }
}