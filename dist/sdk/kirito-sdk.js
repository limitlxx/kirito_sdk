"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = exports.KiritoSDK = void 0;
exports.createKiritoSDK = createKiritoSDK;
const config_1 = require("./config");
const nft_wallet_1 = require("./nft-wallet");
const shielded_pool_1 = require("./shielded-pool");
const mystery_box_1 = require("./mystery-box");
const governance_1 = require("./governance");
const auction_1 = require("./auction");
const wallet_allocation_1 = require("./wallet-allocation");
const defi_yield_aggregator_1 = require("./defi-yield-aggregator");
const comprehensive_wallet_1 = require("./comprehensive-wallet");
const wallet_connector_1 = require("./wallet-connector");
/**
 * Default console logger implementation
 */
class ConsoleLogger {
    constructor(enableDebug = false) {
        this.enableDebug = enableDebug;
    }
    debug(message, context) {
        if (this.enableDebug) {
            console.debug(`[Kirito SDK DEBUG] ${message}`, context || '');
        }
    }
    info(message, context) {
        console.log(`[Kirito SDK INFO] ${message}`, context || '');
    }
    warn(message, context) {
        console.warn(`[Kirito SDK WARN] ${message}`, context || '');
    }
    error(message, error, context) {
        console.error(`[Kirito SDK ERROR] ${message}`, error || '', context || '');
    }
}
exports.ConsoleLogger = ConsoleLogger;
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
class KiritoSDK {
    constructor(config, logger) {
        this.isInitialized = false;
        this.config = { ...config_1.DEFAULT_CONFIG, ...config };
        (0, config_1.validateConfig)(this.config);
        this.logger = logger || new ConsoleLogger(config?.debug || false);
        // Initialize wallet connector
        this.walletConnector = new wallet_connector_1.WalletConnector(this.config.network.rpcUrl);
        this.logger.info('Kirito SDK instance created');
    }
    /**
     * Initialize SDK with all components
     *
     * @param starknetAccount - Optional Starknet account for transaction signing
     * @param allocationFactors - Optional custom allocation factors for yield distribution
     */
    async initialize(starknetAccount, allocationFactors) {
        if (this.isInitialized) {
            this.logger.warn('SDK already initialized, skipping initialization');
            return;
        }
        try {
            this.logger.info('Initializing Kirito SDK...');
            this.logger.debug('Configuration', {
                network: this.config.network.name,
                chainId: this.config.network.chainId,
                rpcUrl: this.config.network.rpcUrl,
                ipfsUrl: this.config.ipfs.url
            });
            // Store Starknet account if provided
            if (starknetAccount) {
                this.starknetAccount = starknetAccount;
                this.logger.info('Starknet account connected');
            }
            // Initialize all SDK components
            await this.initializeComponents(allocationFactors);
            // Perform initial health checks
            const health = await this.healthCheck();
            this.logger.info('Component health status', health);
            // Check for critical failures
            const criticalComponents = ['network', 'nftWallet'];
            const criticalFailures = criticalComponents.filter(comp => !health[comp]);
            if (criticalFailures.length > 0) {
                this.logger.error(`Critical components failed health check: ${criticalFailures.join(', ')}`);
                throw new Error(`Failed to initialize critical components: ${criticalFailures.join(', ')}`);
            }
            this.isInitialized = true;
            this.logger.info('SDK initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize SDK', error);
            throw new Error(`Failed to initialize SDK: ${error}`);
        }
    }
    /**
     * Initialize all SDK components
     */
    async initializeComponents(allocationFactors) {
        try {
            this.logger.debug('Initializing SDK components...');
            // Initialize NFT Wallet component
            this.nftWallet = new nft_wallet_1.NFTWalletSDK(this.config);
            this.logger.debug('✓ NFT Wallet component initialized');
            // Initialize Shielded Pool component
            const mockAccount = this.starknetAccount || {
                address: '0x0000000000000000000000000000000000000000000000000000000000000000',
                execute: async () => ({ transaction_hash: '0x0' })
            };
            this.shieldedPool = new shielded_pool_1.ShieldedPoolManagerSDK(this.config, mockAccount);
            this.logger.debug('✓ Shielded Pool component initialized');
            // Initialize Mystery Box component
            this.mysteryBox = new mystery_box_1.MysteryBoxManagerSDK(this.config);
            this.logger.debug('✓ Mystery Box component initialized');
            // Initialize Anonymous Governance component
            this.governance = new governance_1.AnonymousGovernanceSDK(this.config);
            this.logger.debug('✓ Anonymous Governance component initialized');
            // Initialize Sealed-Bid Auction component
            this.auction = new auction_1.SealedBidAuctionSDK(this.config);
            this.logger.debug('✓ Sealed-Bid Auction component initialized');
            // Initialize Wallet Allocation Engine
            const factors = allocationFactors || wallet_allocation_1.DEFAULT_ALLOCATION_FACTORS;
            this.walletAllocation = new wallet_allocation_1.WalletAllocationEngine(factors);
            this.logger.debug('✓ Wallet Allocation Engine initialized');
            // Initialize DeFi Yield Aggregator (requires Starknet account)
            if (this.starknetAccount) {
                this.defiAggregator = new defi_yield_aggregator_1.DeFiYieldAggregator(this.config, this.starknetAccount);
                this.logger.debug('✓ DeFi Yield Aggregator initialized');
            }
            else {
                this.logger.warn('DeFi Yield Aggregator not initialized (requires Starknet account)');
            }
            // Generation Engine will be initialized when needed (from existing implementation)
            this.logger.debug('✓ All components ready for use');
        }
        catch (error) {
            this.logger.error('Failed to initialize components', error);
            throw new Error(`Failed to initialize components: ${error}`);
        }
    }
    /**
     * Get current network configuration
     */
    getNetworkConfig() {
        return this.config.network;
    }
    /**
     * Switch to different network
     */
    async switchNetwork(networkConfig) {
        console.log(`Switching network from ${this.config.network.name} to ${networkConfig.name}`);
        this.config.network = networkConfig;
        // Re-initialize all components with new network configuration
        await this.initializeComponents();
        console.log(`Successfully switched to network: ${networkConfig.name}`);
    }
    /**
     * Get Generation Engine instance
     */
    getGenerationEngine() {
        if (!this.generationEngine) {
            throw new Error('Generation Engine not initialized');
        }
        return this.generationEngine;
    }
    /**
     * Get NFT Wallet instance
     */
    getNFTWallet() {
        if (!this.nftWallet) {
            throw new Error('NFT Wallet not initialized');
        }
        return this.nftWallet;
    }
    /**
     * Get Shielded Pool Manager instance
     */
    getShieldedPool() {
        if (!this.shieldedPool) {
            throw new Error('Shielded Pool not initialized');
        }
        return this.shieldedPool;
    }
    /**
     * Get Mystery Box Manager instance
     */
    getMysteryBox() {
        if (!this.mysteryBox) {
            throw new Error('Mystery Box Manager not initialized');
        }
        return this.mysteryBox;
    }
    /**
     * Get Anonymous Governance instance
     */
    getGovernance() {
        if (!this.governance) {
            throw new Error('Anonymous Governance not initialized');
        }
        return this.governance;
    }
    /**
     * Get Sealed-Bid Auction instance
     */
    getAuction() {
        if (!this.auction) {
            throw new Error('Sealed-Bid Auction not initialized');
        }
        return this.auction;
    }
    /**
     * Get Wallet Connector instance
     */
    getWalletConnector() {
        if (!this.walletConnector) {
            throw new Error('Wallet Connector not initialized');
        }
        return this.walletConnector;
    }
    /**
     * Detect available wallets
     */
    async detectWallets() {
        try {
            this.logger.debug('Detecting available wallets...');
            const wallets = await this.walletConnector.detectWallets();
            this.logger.info(`Found ${wallets.length} wallet(s)`, {
                wallets: wallets.map(w => w.name)
            });
            return wallets;
        }
        catch (error) {
            this.logger.error('Failed to detect wallets', error);
            return [];
        }
    }
    /**
     * Connect to a wallet
     */
    async connectWallet(walletType) {
        try {
            this.logger.info(`Connecting to ${walletType} wallet...`);
            const result = await this.walletConnector.connect(walletType);
            if (result.success && result.account) {
                this.starknetAccount = result.account;
                this.logger.info('Wallet connected successfully', {
                    walletType,
                    address: result.address
                });
                // Re-initialize components that need the account
                if (this.isInitialized) {
                    await this.initializeComponents();
                }
            }
            else {
                this.logger.error('Wallet connection failed', undefined, {
                    walletType,
                    error: result.error
                });
            }
            return result;
        }
        catch (error) {
            this.logger.error('Failed to connect wallet', error);
            throw error;
        }
    }
    /**
     * Disconnect from current wallet
     */
    async disconnectWallet() {
        try {
            this.logger.info('Disconnecting wallet...');
            await this.walletConnector.disconnect();
            this.starknetAccount = undefined;
            this.logger.info('Wallet disconnected');
        }
        catch (error) {
            this.logger.error('Failed to disconnect wallet', error);
            throw error;
        }
    }
    /**
     * Get connected wallet info
     */
    getConnectedWallet() {
        return this.walletConnector.getConnectedWallet();
    }
    /**
     * Check if wallet is connected
     */
    isWalletConnected() {
        return this.walletConnector.isConnected();
    }
    /**
     * Get DeFi Yield Aggregator instance
     */
    getDeFiAggregator() {
        if (!this.defiAggregator) {
            throw new Error('DeFi Yield Aggregator not initialized. Requires Starknet account.');
        }
        return this.defiAggregator;
    }
    /**
     * Create a comprehensive wallet instance for an NFT
     */
    createComprehensiveWallet(walletAddress, tokenId) {
        return new comprehensive_wallet_1.ComprehensiveWallet(this.config, walletAddress, tokenId);
    }
    /**
     * High-level API: Mint NFT with yield allocation
     */
    async mintWithYieldAllocation(recipient, metadata, stakeAmount, yieldSourcePreferences) {
        try {
            this.ensureInitialized();
            this.logger.info('Minting NFT with yield allocation', { recipient, stakeAmount });
            // Calculate allocation preview
            const allocation = this.walletAllocation.calculateAllocation('0', // Token ID will be assigned after mint
            recipient, metadata, stakeAmount);
            // Mint NFT
            const tokenId = await this.nftWallet.mint(recipient, stakeAmount, metadata);
            // Get transaction hash (simplified)
            const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
            this.logger.info('NFT minted successfully', { tokenId, txHash });
            return {
                tokenId,
                txHash,
                allocation
            };
        }
        catch (error) {
            this.logger.error('Failed to mint NFT with yield allocation', error);
            await this.handleError(error, 'mintWithYieldAllocation');
            throw error;
        }
    }
    /**
     * High-level API: Get aggregated yield for wallet
     */
    async getAggregatedYield(walletAddress, period) {
        try {
            this.ensureInitialized();
            this.logger.info('Getting aggregated yield', { walletAddress, period });
            if (!this.defiAggregator) {
                throw new Error('DeFi Yield Aggregator not initialized');
            }
            const aggregatedYield = await this.defiAggregator.getAggregatedYield(walletAddress, period);
            this.logger.info('Aggregated yield retrieved', {
                totalYield: aggregatedYield.totalYield,
                protocols: aggregatedYield.protocolBreakdown.length
            });
            return {
                amount: aggregatedYield.totalYield,
                token: '0x0', // ETH
                period
            };
        }
        catch (error) {
            this.logger.error('Failed to get aggregated yield', error);
            await this.handleError(error, 'getAggregatedYield');
            throw error;
        }
    }
    /**
     * High-level API: Optimize yield distribution
     */
    async optimizeYieldDistribution(walletAddress, period) {
        try {
            this.ensureInitialized();
            this.logger.info('Optimizing yield distribution', { walletAddress });
            if (!this.defiAggregator) {
                throw new Error('DeFi Yield Aggregator not initialized');
            }
            const optimization = await this.defiAggregator.getYieldOptimizationRecommendations(walletAddress, period);
            this.logger.info('Yield optimization recommendations generated', {
                currentAPY: optimization.currentAPY,
                optimizedAPY: optimization.optimizedAPY
            });
            return optimization;
        }
        catch (error) {
            this.logger.error('Failed to optimize yield distribution', error);
            await this.handleError(error, 'optimizeYieldDistribution');
            throw error;
        }
    }
    /**
     * High-level API: Execute rebalancing
     */
    async executeRebalancing(walletAddress, optimization) {
        try {
            this.ensureInitialized();
            this.logger.info('Executing rebalancing', { walletAddress });
            if (!this.defiAggregator) {
                throw new Error('DeFi Yield Aggregator not initialized');
            }
            const txHashes = await this.defiAggregator.executeRebalancing(walletAddress, optimization);
            this.logger.info('Rebalancing executed successfully', {
                transactions: txHashes.length
            });
            return txHashes;
        }
        catch (error) {
            this.logger.error('Failed to execute rebalancing', error);
            await this.handleError(error, 'executeRebalancing');
            throw error;
        }
    }
    /**
     * Health check for all components
     */
    async healthCheck() {
        const health = {
            network: false,
            ipfs: false,
            tongo: false,
            semaphore: false,
            nftWallet: false,
            shieldedPool: false,
            mysteryBox: false,
            governance: false,
            walletAllocation: false,
            defiAggregator: false
        };
        try {
            this.logger.debug('Running health checks...');
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
            health.walletAllocation = this.walletAllocation !== undefined;
            health.defiAggregator = this.defiAggregator !== undefined;
            this.logger.debug('Health check completed', health);
        }
        catch (error) {
            this.logger.error('Health check failed', error);
        }
        return health;
    }
    /**
     * Comprehensive error handling and recovery
     */
    async handleError(error, context) {
        this.logger.error(`Error in ${context}`, error, { context });
        // Attempt recovery based on error type
        if (error.message.includes('network') || error.message.includes('RPC')) {
            this.logger.info('Attempting network recovery...');
            await this.recoverNetworkConnection();
        }
        else if (error.message.includes('IPFS')) {
            this.logger.info('Attempting IPFS recovery...');
            await this.recoverIPFSConnection();
        }
        else if (error.message.includes('privacy') || error.message.includes('proof')) {
            this.logger.info('Attempting privacy service recovery...');
            await this.recoverPrivacyServices();
        }
        else if (error.message.includes('not initialized')) {
            this.logger.warn('Component not initialized, attempting re-initialization...');
            await this.initializeComponents();
        }
    }
    /**
     * Graceful shutdown of all components
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Kirito SDK...');
            // Clear component references
            this.generationEngine = undefined;
            this.nftWallet = undefined;
            this.shieldedPool = undefined;
            this.mysteryBox = undefined;
            this.governance = undefined;
            this.auction = undefined;
            this.errorHandler = undefined;
            this.walletAllocation = undefined;
            this.defiAggregator = undefined;
            this.starknetAccount = undefined;
            this.isInitialized = false;
            this.logger.info('SDK shutdown complete');
        }
        catch (error) {
            this.logger.error('Error during shutdown', error);
        }
    }
    /**
     * Get SDK version and build info
     */
    getVersion() {
        return {
            version: '1.0.0',
            buildDate: new Date().toISOString(),
            components: [
                'GenerationEngine',
                'NFTWallet',
                'ShieldedPoolManager',
                'MysteryBoxManager',
                'AnonymousGovernance',
                'SealedBidAuction',
                'WalletAllocationEngine',
                'DeFiYieldAggregator',
                'ComprehensiveWallet'
            ]
        };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config }; // Return copy to prevent external modification
    }
    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        const updatedConfig = { ...this.config, ...newConfig };
        (0, config_1.validateConfig)(updatedConfig);
        this.config = updatedConfig;
        // Re-initialize components if network changed
        if (newConfig.network) {
            this.logger.info('Network configuration changed, re-initializing components...');
            await this.initializeComponents();
        }
        this.logger.info('Configuration updated successfully');
    }
    /**
     * Get logger instance
     */
    getLogger() {
        return this.logger;
    }
    /**
     * Set custom logger
     */
    setLogger(logger) {
        this.logger = logger;
        this.logger.info('Custom logger configured');
    }
    /**
     * Check if SDK is initialized
     */
    isReady() {
        return this.isInitialized;
    }
    /**
     * Ensure SDK is initialized before operations
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('SDK not initialized. Call initialize() first.');
        }
    }
    async checkNetworkConnectivity() {
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
        }
        catch {
            return false;
        }
    }
    async checkIPFSConnectivity() {
        try {
            const response = await fetch(`${this.config.ipfs.url}/api/v0/version`, {
                method: 'POST'
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async checkTongoConnectivity() {
        try {
            const response = await fetch(`${this.config.privacy.tongoEndpoint}/health`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async checkSemaphoreConnectivity() {
        try {
            const response = await fetch(`${this.config.privacy.semaphoreEndpoint}/health`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    // Recovery methods
    async recoverNetworkConnection() {
        try {
            this.logger.debug('Attempting to recover network connection...');
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Test network connectivity
            const isConnected = await this.checkNetworkConnectivity();
            if (isConnected) {
                this.logger.info('Network connection recovered');
            }
            else {
                this.logger.warn('Network connection recovery failed');
            }
        }
        catch (error) {
            this.logger.error('Network recovery error', error);
        }
    }
    async recoverIPFSConnection() {
        try {
            this.logger.debug('Attempting to recover IPFS connection...');
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Test IPFS connectivity
            const isConnected = await this.checkIPFSConnectivity();
            if (isConnected) {
                this.logger.info('IPFS connection recovered');
            }
            else {
                this.logger.warn('IPFS connection recovery failed');
            }
        }
        catch (error) {
            this.logger.error('IPFS recovery error', error);
        }
    }
    async recoverPrivacyServices() {
        try {
            this.logger.debug('Attempting to recover privacy services...');
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Test privacy service connectivity
            const tongoConnected = await this.checkTongoConnectivity();
            const semaphoreConnected = await this.checkSemaphoreConnectivity();
            if (tongoConnected && semaphoreConnected) {
                this.logger.info('Privacy services recovered');
            }
            else {
                this.logger.warn('Privacy services recovery partial or failed', {
                    tongo: tongoConnected ? 'OK' : 'FAILED',
                    semaphore: semaphoreConnected ? 'OK' : 'FAILED'
                });
            }
        }
        catch (error) {
            this.logger.error('Privacy services recovery error', error);
        }
    }
}
exports.KiritoSDK = KiritoSDK;
/**
 * Factory function to create Kirito SDK instance
 */
function createKiritoSDK(config, logger) {
    return new KiritoSDK(config, logger);
}
//# sourceMappingURL=kirito-sdk.js.map