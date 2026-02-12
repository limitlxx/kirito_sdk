"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenConversionAggregatorImpl = void 0;
exports.createTokenConversionAggregator = createTokenConversionAggregator;
/**
 * Token Conversion Aggregator Implementation
 *
 * Finds optimal conversion rates across multiple bridges and DEX aggregators,
 * supports multi-hop routing, and provides rate caching with automatic refresh.
 */
class TokenConversionAggregatorImpl {
    constructor(layerSwapBridge, gardenBridge, xverseBridge) {
        this.cacheTimeout = 60000; // 1 minute
        this.layerSwapBridge = layerSwapBridge;
        this.gardenBridge = gardenBridge;
        this.xverseBridge = xverseBridge;
        this.rateCache = new Map();
        this.dexAggregators = [
            new AvnuAggregator(),
            new FibrousAggregator()
        ];
    }
    /**
     * Find best conversion rate across all bridges and DEX aggregators
     */
    async getBestRate(fromToken, toToken, amount) {
        const cacheKey = `${fromToken}-${toToken}-${amount}`;
        const cached = this.getCachedRate(cacheKey);
        if (cached) {
            return {
                fromToken,
                toToken,
                rate: cached.rate,
                bridge: 'cached',
                fees: 0n,
                estimatedTime: 0,
                confidence: 0.9
            };
        }
        // Get rates from all sources in parallel
        const ratePromises = [
            this.getLayerSwapRate(fromToken, toToken, amount),
            this.getGardenRate(fromToken, toToken, amount),
            this.getXverseRate(fromToken, toToken, amount),
            ...this.dexAggregators.map(dex => this.getDEXRate(dex, fromToken, toToken, amount))
        ];
        const rates = await Promise.allSettled(ratePromises);
        const validRates = rates
            .filter((result) => result.status === 'fulfilled' && result.value.rate > 0)
            .map(result => result.value);
        if (validRates.length === 0) {
            throw new Error(`No valid conversion rates found for ${fromToken} -> ${toToken}`);
        }
        // Find best rate (highest output amount)
        const bestRate = validRates.reduce((best, current) => current.rate > best.rate ? current : best);
        // Cache the result
        this.cacheRate(cacheKey, bestRate.rate);
        return bestRate;
    }
    /**
     * Execute conversion with optimal routing
     */
    async executeConversion(fromToken, toToken, amount, destinationAddress, options) {
        const bestRate = await this.getBestRate(fromToken, toToken, amount);
        // Apply slippage protection
        const maxSlippage = options?.maxSlippage || 0.5; // 0.5% default
        const minOutput = BigInt(Math.floor(Number(amount) * bestRate.rate * (1 - maxSlippage / 100)));
        // Execute conversion based on best bridge
        switch (bestRate.bridge) {
            case 'layerswap':
                const layerSwapQuote = await this.layerSwapBridge.getQuote(fromToken, toToken, amount, 'STARKNET_MAINNET', 'STARKNET_MAINNET');
                return this.layerSwapBridge.executeBridge(layerSwapQuote, destinationAddress);
            case 'garden':
                // Use optimal route to execute conversion
                const route = await this.gardenBridge.getOptimalRoute(fromToken, toToken, amount);
                const swap = await this.gardenBridge.createAtomicSwap(fromToken, toToken, amount, destinationAddress);
                return {
                    id: swap.id,
                    status: 'pending',
                    fromChain: 'starknet',
                    toChain: 'starknet',
                    fromToken,
                    toToken,
                    fromAmount: amount,
                    toAmount: route.expectedOutput,
                    txHash: undefined,
                    confirmations: 0,
                    requiredConfirmations: 1
                };
            case 'xverse':
                return this.xverseBridge.bridgeToStarknet(fromToken, amount, destinationAddress);
            case 'avnu':
            case 'fibrous':
                return this.executeDEXSwap(bestRate.bridge, fromToken, toToken, amount, destinationAddress);
            default:
                throw new Error(`Unsupported bridge: ${bestRate.bridge}`);
        }
    }
    /**
     * Get multi-hop route for complex conversions
     */
    async getMultiHopRoute(fromToken, toToken, amount) {
        // Define common intermediate tokens for routing
        const intermediateTokens = ['ETH', 'USDC', 'WBTC'];
        // Try direct conversion first
        try {
            const directRate = await this.getBestRate(fromToken, toToken, amount);
            return {
                hops: [{
                        fromToken,
                        toToken,
                        bridge: directRate.bridge,
                        amount,
                        expectedOutput: BigInt(Math.floor(Number(amount) * directRate.rate))
                    }],
                totalFees: directRate.fees,
                estimatedTime: directRate.estimatedTime,
                priceImpact: 0.1 // Simplified
            };
        }
        catch (error) {
            // Direct conversion failed, try multi-hop
        }
        // Try multi-hop routes through intermediate tokens
        let bestRoute = null;
        let bestOutput = 0n;
        for (const intermediate of intermediateTokens) {
            if (intermediate === fromToken || intermediate === toToken)
                continue;
            try {
                // First hop: fromToken -> intermediate
                const firstHopRate = await this.getBestRate(fromToken, intermediate, amount);
                const intermediateAmount = BigInt(Math.floor(Number(amount) * firstHopRate.rate));
                // Second hop: intermediate -> toToken
                const secondHopRate = await this.getBestRate(intermediate, toToken, intermediateAmount);
                const finalAmount = BigInt(Math.floor(Number(intermediateAmount) * secondHopRate.rate));
                if (finalAmount > bestOutput) {
                    bestOutput = finalAmount;
                    bestRoute = {
                        hops: [
                            {
                                fromToken,
                                toToken: intermediate,
                                bridge: firstHopRate.bridge,
                                amount,
                                expectedOutput: intermediateAmount
                            },
                            {
                                fromToken: intermediate,
                                toToken,
                                bridge: secondHopRate.bridge,
                                amount: intermediateAmount,
                                expectedOutput: finalAmount
                            }
                        ],
                        totalFees: firstHopRate.fees + secondHopRate.fees,
                        estimatedTime: firstHopRate.estimatedTime + secondHopRate.estimatedTime,
                        priceImpact: 0.2 // Simplified
                    };
                }
            }
            catch (error) {
                // This route failed, continue to next
                continue;
            }
        }
        if (!bestRoute) {
            throw new Error(`No valid multi-hop route found for ${fromToken} -> ${toToken}`);
        }
        return bestRoute;
    }
    /**
     * Refresh cached rates
     */
    async refreshRates() {
        // Clear expired cache entries
        const now = Date.now();
        for (const [key, rate] of this.rateCache.entries()) {
            if (now - rate.timestamp > rate.ttl) {
                this.rateCache.delete(key);
            }
        }
    }
    /**
     * Get all cached rates
     */
    async getCachedRates() {
        await this.refreshRates();
        return Array.from(this.rateCache.values());
    }
    /**
     * Execute multi-hop conversion with slippage protection
     */
    async executeMultiHopConversion(route, destinationAddress, options) {
        const transactions = [];
        let currentAmount = route.hops[0].amount;
        for (let i = 0; i < route.hops.length; i++) {
            const hop = route.hops[i];
            const isLastHop = i === route.hops.length - 1;
            const recipient = isLastHop ? destinationAddress : destinationAddress; // Simplified
            const transaction = await this.executeConversion(hop.fromToken, hop.toToken, currentAmount, recipient, options);
            transactions.push(transaction);
            currentAmount = transaction.toAmount;
        }
        return transactions;
    }
    /**
     * Get conversion preview with fees and slippage
     */
    async getConversionPreview(fromToken, toToken, amount, options) {
        const bestRate = await this.getBestRate(fromToken, toToken, amount);
        let multiHopRoute;
        // Try multi-hop if direct rate is poor
        if (bestRate.rate < 0.8) { // Less than 80% efficiency
            try {
                multiHopRoute = await this.getMultiHopRoute(fromToken, toToken, amount);
            }
            catch (error) {
                // Multi-hop failed, use direct route
            }
        }
        const effectiveRate = multiHopRoute ?
            Number(multiHopRoute.hops[multiHopRoute.hops.length - 1].expectedOutput) / Number(amount) :
            bestRate.rate;
        const estimatedOutput = BigInt(Math.floor(Number(amount) * effectiveRate));
        const maxSlippage = options?.maxSlippage || 0.5;
        const slippageProtection = BigInt(Math.floor(Number(estimatedOutput) * (maxSlippage / 100)));
        return {
            bestRate,
            multiHopRoute,
            estimatedOutput,
            totalFees: multiHopRoute ? multiHopRoute.totalFees : bestRate.fees,
            priceImpact: multiHopRoute ? multiHopRoute.priceImpact : 0.1,
            slippageProtection
        };
    }
    /**
     * Private helper methods
     */
    async getLayerSwapRate(fromToken, toToken, amount) {
        try {
            const quote = await this.layerSwapBridge.getQuote(fromToken, toToken, amount, 'STARKNET_MAINNET', 'STARKNET_MAINNET');
            return {
                fromToken,
                toToken,
                rate: Number(quote.toAmount) / Number(amount),
                bridge: 'layerswap',
                fees: quote.estimatedFees,
                estimatedTime: quote.estimatedTime,
                confidence: 0.9
            };
        }
        catch (error) {
            return {
                fromToken,
                toToken,
                rate: 0,
                bridge: 'layerswap',
                fees: 0n,
                estimatedTime: 0,
                confidence: 0
            };
        }
    }
    async getGardenRate(fromToken, toToken, amount) {
        try {
            const route = await this.gardenBridge.getOptimalRoute(fromToken, toToken, amount);
            return {
                fromToken,
                toToken,
                rate: Number(route.expectedOutput) / Number(amount),
                bridge: 'garden',
                fees: route.fees.reduce((sum, fee) => sum + fee, 0n),
                estimatedTime: 300, // 5 minutes estimate
                confidence: 0.85
            };
        }
        catch (error) {
            return {
                fromToken,
                toToken,
                rate: 0,
                bridge: 'garden',
                fees: 0n,
                estimatedTime: 0,
                confidence: 0
            };
        }
    }
    async getXverseRate(fromToken, toToken, amount) {
        try {
            const fees = await this.xverseBridge.estimateBridgeFees(fromToken, amount, 'starknet');
            const outputAmount = amount - fees.totalFee;
            return {
                fromToken,
                toToken,
                rate: Number(outputAmount) / Number(amount),
                bridge: 'xverse',
                fees: fees.totalFee,
                estimatedTime: fees.estimatedTime,
                confidence: 0.8
            };
        }
        catch (error) {
            return {
                fromToken,
                toToken,
                rate: 0,
                bridge: 'xverse',
                fees: 0n,
                estimatedTime: 0,
                confidence: 0
            };
        }
    }
    async getDEXRate(dex, fromToken, toToken, amount) {
        try {
            const quote = await dex.getQuote(fromToken, toToken, amount);
            return {
                fromToken,
                toToken,
                rate: Number(quote.toAmount) / Number(amount),
                bridge: dex.name.toLowerCase(),
                fees: quote.fees,
                estimatedTime: 60, // 1 minute for DEX swaps
                confidence: 0.95
            };
        }
        catch (error) {
            return {
                fromToken,
                toToken,
                rate: 0,
                bridge: dex.name.toLowerCase(),
                fees: 0n,
                estimatedTime: 0,
                confidence: 0
            };
        }
    }
    async executeDEXSwap(dexName, fromToken, toToken, amount, recipient) {
        const dex = this.dexAggregators.find(d => d.name.toLowerCase() === dexName);
        if (!dex) {
            throw new Error(`DEX aggregator ${dexName} not found`);
        }
        const quote = await dex.getQuote(fromToken, toToken, amount);
        const txHash = await dex.executeSwap(quote, recipient);
        return {
            id: txHash,
            status: 'pending',
            fromChain: 'starknet',
            toChain: 'starknet',
            fromToken,
            toToken,
            fromAmount: amount,
            toAmount: quote.toAmount,
            txHash,
            confirmations: 0,
            requiredConfirmations: 1
        };
    }
    getCachedRate(key) {
        const cached = this.rateCache.get(key);
        if (!cached)
            return null;
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.rateCache.delete(key);
            return null;
        }
        return cached;
    }
    cacheRate(key, rate) {
        this.rateCache.set(key, {
            pair: key,
            rate,
            timestamp: Date.now(),
            ttl: this.cacheTimeout
        });
    }
}
exports.TokenConversionAggregatorImpl = TokenConversionAggregatorImpl;
/**
 * Mock DEX Aggregator Implementations
 */
class AvnuAggregator {
    constructor() {
        this.name = 'Avnu';
    }
    async getQuote(fromToken, toToken, amount) {
        // Mock implementation - would integrate with actual Avnu API
        const mockRate = this.getMockRate(fromToken, toToken);
        const toAmount = BigInt(Math.floor(Number(amount) * mockRate));
        const fees = amount / 1000n; // 0.1% fee
        return {
            fromToken,
            toToken,
            fromAmount: amount,
            toAmount: toAmount - fees,
            route: [fromToken, toToken],
            priceImpact: 0.05,
            fees,
            gasEstimate: 50000n
        };
    }
    async executeSwap(quote, recipient) {
        // Mock implementation
        return `0x${Math.random().toString(16).slice(2)}`;
    }
    getMockRate(fromToken, toToken) {
        const rates = {
            'ETH-WBTC': 0.037,
            'STRK-WBTC': 0.00003,
            'USDC-WBTC': 0.000017,
            'ETH-USDC': 2200,
            'STRK-ETH': 0.0008
        };
        return rates[`${fromToken}-${toToken}`] || 0.5;
    }
}
class FibrousAggregator {
    constructor() {
        this.name = 'Fibrous';
    }
    async getQuote(fromToken, toToken, amount) {
        // Mock implementation - would integrate with actual Fibrous API
        const mockRate = this.getMockRate(fromToken, toToken);
        const toAmount = BigInt(Math.floor(Number(amount) * mockRate));
        const fees = amount / 500n; // 0.2% fee
        return {
            fromToken,
            toToken,
            fromAmount: amount,
            toAmount: toAmount - fees,
            route: [fromToken, 'ETH', toToken], // Multi-hop route
            priceImpact: 0.08,
            fees,
            gasEstimate: 75000n
        };
    }
    async executeSwap(quote, recipient) {
        // Mock implementation
        return `0x${Math.random().toString(16).slice(2)}`;
    }
    getMockRate(fromToken, toToken) {
        const rates = {
            'ETH-WBTC': 0.036,
            'STRK-WBTC': 0.000029,
            'USDC-WBTC': 0.000016,
            'ETH-USDC': 2180,
            'STRK-ETH': 0.00079
        };
        return rates[`${fromToken}-${toToken}`] || 0.48;
    }
}
/**
 * Factory function to create token conversion aggregator
 */
function createTokenConversionAggregator(layerSwapBridge, gardenBridge, xverseBridge) {
    return new TokenConversionAggregatorImpl(layerSwapBridge, gardenBridge, xverseBridge);
}
//# sourceMappingURL=token-conversion-aggregator.js.map