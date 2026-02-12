"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YieldSourceSelector = exports.ConvertibleToken = exports.YieldSourceType = void 0;
exports.createYieldSourceSelector = createYieldSourceSelector;
/**
 * Yield source types supported by the system
 */
var YieldSourceType;
(function (YieldSourceType) {
    YieldSourceType["BTC"] = "BTC";
    YieldSourceType["WBTC"] = "WBTC";
    YieldSourceType["MIXED"] = "MIXED";
})(YieldSourceType || (exports.YieldSourceType = YieldSourceType = {}));
/**
 * Token types that can be converted to WBTC for yield
 */
var ConvertibleToken;
(function (ConvertibleToken) {
    ConvertibleToken["BTC"] = "BTC";
    ConvertibleToken["ETH"] = "ETH";
    ConvertibleToken["STRK"] = "STRK";
    ConvertibleToken["USDC"] = "USDC";
    ConvertibleToken["WBTC"] = "WBTC";
})(ConvertibleToken || (exports.ConvertibleToken = ConvertibleToken = {}));
/**
 * Yield Source Selector Implementation
 *
 * Handles yield source selection during minting, token conversion,
 * and allocation configuration.
 */
class YieldSourceSelector {
    constructor(layerSwapBridge, gardenBridge, xverseBridge) {
        this.layerSwapBridge = layerSwapBridge;
        this.gardenBridge = gardenBridge;
        this.xverseBridge = xverseBridge;
    }
    /**
     * Configure yield source for minting
     */
    async configureYieldSource(sourceType, allocation, preferences) {
        // Validate allocation percentages
        this.validateAllocation(allocation);
        const config = {
            sourceType,
            allocation,
            conversionPreferences: preferences,
            metadata: {
                selectedSources: this.getSourcesForType(sourceType),
                conversionHistory: [],
                allocationHistory: [],
                preferences: {
                    riskTolerance: 'medium',
                    yieldStrategy: 'balanced',
                    autoReinvest: false,
                    notificationPreferences: {
                        yieldClaims: true,
                        conversionOpportunities: true,
                        rateChanges: false
                    }
                }
            }
        };
        return config;
    }
    /**
     * Analyze wallet holdings and suggest optimal conversion
     */
    async analyzeWalletForConversion(walletAddress, targetWBTCAmount) {
        // Get wallet holdings (simplified - would integrate with actual wallet)
        const holdings = await this.getWalletHoldings(walletAddress);
        const options = [];
        // Check each token for conversion potential
        for (const [token, balance] of Object.entries(holdings)) {
            if (balance > 0n && token !== ConvertibleToken.WBTC) {
                const conversionOption = await this.getConversionOption(token, ConvertibleToken.WBTC, balance, targetWBTCAmount);
                if (conversionOption) {
                    options.push(conversionOption);
                }
            }
        }
        // Sort by best rate
        return options.sort((a, b) => b.rate - a.rate);
    }
    /**
     * Execute automatic token conversion during mint
     */
    async executeAutoConversion(fromToken, amount, starknetAddress, preferences) {
        let bridge;
        let txHash;
        // Select bridge based on preferences
        switch (preferences.preferredBridge) {
            case 'layerswap':
                const layerSwapTx = await this.layerSwapBridge.convertStarknetTokenToWBTC(fromToken, amount, starknetAddress);
                bridge = 'layerswap';
                txHash = layerSwapTx.txHash || '';
                break;
            case 'garden':
                const gardenTx = await this.gardenBridge.executeAtomicSwapWithRouting(fromToken, ConvertibleToken.WBTC, amount, starknetAddress);
                bridge = 'garden';
                txHash = gardenTx.txHash || '';
                break;
            case 'xverse':
                const xverseTx = await this.xverseBridge.bridgeToStarknet(fromToken, amount, starknetAddress);
                bridge = 'xverse';
                txHash = xverseTx.txHash || '';
                break;
            case 'auto':
            default:
                // Find best rate across all bridges
                const bestOption = await this.findBestConversionRate(fromToken, amount);
                return this.executeAutoConversion(fromToken, amount, starknetAddress, { ...preferences, preferredBridge: bestOption.bridge });
        }
        // Get current rate for record
        const rate = await this.getCurrentRate(fromToken, ConvertibleToken.WBTC);
        return {
            timestamp: Date.now(),
            fromToken,
            toToken: ConvertibleToken.WBTC,
            amount,
            rate,
            bridge,
            txHash
        };
    }
    /**
     * Create minting configuration with yield source selection
     */
    async createMintingConfig(walletAddress, desiredYieldAmount, sourceType, preferences) {
        // Analyze wallet for conversion options
        const conversionOptions = await this.analyzeWalletForConversion(walletAddress, desiredYieldAmount);
        // Select best token to use
        const bestOption = conversionOptions[0];
        if (!bestOption) {
            throw new Error('No suitable tokens found for conversion');
        }
        // Configure yield source
        const allocation = {
            btcPercentage: sourceType === YieldSourceType.BTC ? 100 :
                sourceType === YieldSourceType.WBTC ? 0 : 50,
            wbtcPercentage: sourceType === YieldSourceType.WBTC ? 100 :
                sourceType === YieldSourceType.BTC ? 0 : 50,
            customFactors: {
                rarityWeight: 0.3,
                stakeWeight: 0.7,
                customMultipliers: {}
            }
        };
        const yieldSource = await this.configureYieldSource(sourceType, allocation, preferences);
        // Create allocation preview
        const allocationPreview = await this.createAllocationPreview(desiredYieldAmount, allocation, bestOption.rate);
        return {
            yieldSource,
            tokenToUse: bestOption.fromToken,
            amountToConvert: bestOption.amount,
            conversionOptions,
            estimatedWBTCYield: bestOption.expectedOutput,
            allocationPreview
        };
    }
    /**
     * Store yield preferences and conversion history in NFT metadata
     */
    async storeYieldMetadata(nftId, config, conversionRecord) {
        const metadata = config.yieldSource.metadata;
        // Add conversion to history
        metadata.conversionHistory.push(conversionRecord);
        // Add allocation to history
        metadata.allocationHistory.push({
            timestamp: Date.now(),
            nftId,
            allocation: config.yieldSource.allocation,
            estimatedYield: config.estimatedWBTCYield
        });
        return metadata;
    }
    /**
     * Get bidirectional conversion options
     */
    async getBidirectionalConversionOptions(tokenA, tokenB, amount) {
        const [aToB, bToA] = await Promise.all([
            this.getConversionOption(tokenA, tokenB, amount, amount),
            this.getConversionOption(tokenB, tokenA, amount, amount)
        ]);
        return { aToB, bToA };
    }
    /**
     * Private helper methods
     */
    validateAllocation(allocation) {
        const total = allocation.btcPercentage + allocation.wbtcPercentage;
        if (total !== 100) {
            throw new Error(`Allocation percentages must sum to 100, got ${total}`);
        }
    }
    getSourcesForType(sourceType) {
        switch (sourceType) {
            case YieldSourceType.BTC:
                return ['bitcoin-yield', 'btc-defi'];
            case YieldSourceType.WBTC:
                return ['wbtc-lending', 'wbtc-staking'];
            case YieldSourceType.MIXED:
                return ['bitcoin-yield', 'btc-defi', 'wbtc-lending', 'wbtc-staking'];
            default:
                return [];
        }
    }
    async getWalletHoldings(walletAddress) {
        // Simplified - would integrate with actual wallet/blockchain queries
        return {
            [ConvertibleToken.BTC]: 0n,
            [ConvertibleToken.ETH]: 1000000000000000000n, // 1 ETH
            [ConvertibleToken.STRK]: 100000000000000000000n, // 100 STRK
            [ConvertibleToken.USDC]: 1000000000n, // 1000 USDC
            [ConvertibleToken.WBTC]: 0n
        };
    }
    async getConversionOption(fromToken, toToken, amount, targetAmount) {
        try {
            // Get rate from best bridge
            const rate = await this.getCurrentRate(fromToken, toToken);
            const expectedOutput = (amount * BigInt(Math.floor(rate * 10000))) / 10000n;
            if (expectedOutput < targetAmount / 2n) {
                return null; // Not enough output
            }
            return {
                fromToken,
                toToken,
                amount,
                expectedOutput,
                rate,
                fees: amount / 1000n, // 0.1% fee estimate
                bridge: 'auto',
                estimatedTime: 600 // 10 minutes
            };
        }
        catch (error) {
            console.error(`Failed to get conversion option for ${fromToken} -> ${toToken}:`, error);
            return null;
        }
    }
    async getCurrentRate(fromToken, toToken) {
        // Simplified rate calculation - would integrate with actual price oracles
        const rates = {
            'ETH-WBTC': 0.037, // 1 ETH = 0.037 WBTC
            'STRK-WBTC': 0.00003, // 1 STRK = 0.00003 WBTC
            'USDC-WBTC': 0.000017, // 1 USDC = 0.000017 WBTC
            'BTC-WBTC': 1.0 // 1:1 ratio
        };
        return rates[`${fromToken}-${toToken}`] || 0;
    }
    async findBestConversionRate(fromToken, amount) {
        // Compare rates across bridges
        const rates = await Promise.all([
            this.getLayerSwapRate(fromToken, amount),
            this.getGardenRate(fromToken, amount),
            this.getXverseRate(fromToken, amount)
        ]);
        const bestRate = rates.reduce((best, current) => current.rate > best.rate ? current : best);
        return bestRate;
    }
    async getLayerSwapRate(fromToken, amount) {
        try {
            const quote = await this.layerSwapBridge.getQuote(fromToken, ConvertibleToken.WBTC, amount, 'STARKNET_MAINNET', 'STARKNET_MAINNET');
            const rate = Number(quote.toAmount) / Number(quote.fromAmount);
            return { bridge: 'layerswap', rate };
        }
        catch {
            return { bridge: 'layerswap', rate: 0 };
        }
    }
    async getGardenRate(fromToken, amount) {
        try {
            const route = await this.gardenBridge.getOptimalRoute(fromToken, ConvertibleToken.WBTC, amount);
            const rate = Number(route.expectedOutput) / Number(amount);
            return { bridge: 'garden', rate };
        }
        catch {
            return { bridge: 'garden', rate: 0 };
        }
    }
    async getXverseRate(fromToken, amount) {
        try {
            const estimate = await this.xverseBridge.estimateBridgeFees(fromToken, amount, 'starknet');
            const outputAmount = amount - estimate.totalFee;
            const rate = Number(outputAmount) / Number(amount);
            return { bridge: 'xverse', rate };
        }
        catch {
            return { bridge: 'xverse', rate: 0 };
        }
    }
    async createAllocationPreview(yieldAmount, allocation, conversionRate) {
        const rarityScore = Math.random() * 100; // Simplified
        const yieldMultiplier = 1 + (rarityScore / 100);
        const dailyYield = (yieldAmount * BigInt(Math.floor(yieldMultiplier * 100))) / (365n * 100n);
        const monthlyYield = dailyYield * 30n;
        const annualYield = dailyYield * 365n;
        return {
            nftId: `nft-${Date.now()}`,
            rarityScore,
            yieldMultiplier,
            estimatedDailyYield: dailyYield,
            estimatedMonthlyYield: monthlyYield,
            estimatedAnnualYield: annualYield,
            allocation
        };
    }
}
exports.YieldSourceSelector = YieldSourceSelector;
/**
 * Factory function to create yield source selector
 */
function createYieldSourceSelector(layerSwapBridge, gardenBridge, xverseBridge) {
    return new YieldSourceSelector(layerSwapBridge, gardenBridge, xverseBridge);
}
//# sourceMappingURL=yield-source-selector.js.map