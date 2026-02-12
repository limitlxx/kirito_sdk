import { TokenConversionAggregator, ConversionRate, ConversionOptions, MultiHopRoute, CachedRate, LayerSwapBridge, GardenFinanceBridge, XverseBridge, BridgeTransaction } from '../interfaces/bridge';
import { Address } from '../types';
/**
 * Token Conversion Aggregator Implementation
 *
 * Finds optimal conversion rates across multiple bridges and DEX aggregators,
 * supports multi-hop routing, and provides rate caching with automatic refresh.
 */
export declare class TokenConversionAggregatorImpl implements TokenConversionAggregator {
    private layerSwapBridge;
    private gardenBridge;
    private xverseBridge;
    private dexAggregators;
    private rateCache;
    private readonly cacheTimeout;
    constructor(layerSwapBridge: LayerSwapBridge, gardenBridge: GardenFinanceBridge, xverseBridge: XverseBridge);
    /**
     * Find best conversion rate across all bridges and DEX aggregators
     */
    getBestRate(fromToken: string, toToken: string, amount: bigint): Promise<ConversionRate>;
    /**
     * Execute conversion with optimal routing
     */
    executeConversion(fromToken: string, toToken: string, amount: bigint, destinationAddress: Address, options?: ConversionOptions): Promise<BridgeTransaction>;
    /**
     * Get multi-hop route for complex conversions
     */
    getMultiHopRoute(fromToken: string, toToken: string, amount: bigint): Promise<MultiHopRoute>;
    /**
     * Refresh cached rates
     */
    refreshRates(): Promise<void>;
    /**
     * Get all cached rates
     */
    getCachedRates(): Promise<CachedRate[]>;
    /**
     * Execute multi-hop conversion with slippage protection
     */
    executeMultiHopConversion(route: MultiHopRoute, destinationAddress: Address, options?: ConversionOptions): Promise<BridgeTransaction[]>;
    /**
     * Get conversion preview with fees and slippage
     */
    getConversionPreview(fromToken: string, toToken: string, amount: bigint, options?: ConversionOptions): Promise<{
        bestRate: ConversionRate;
        multiHopRoute?: MultiHopRoute;
        estimatedOutput: bigint;
        totalFees: bigint;
        priceImpact: number;
        slippageProtection: bigint;
    }>;
    /**
     * Private helper methods
     */
    private getLayerSwapRate;
    private getGardenRate;
    private getXverseRate;
    private getDEXRate;
    private executeDEXSwap;
    private getCachedRate;
    private cacheRate;
}
/**
 * Factory function to create token conversion aggregator
 */
export declare function createTokenConversionAggregator(layerSwapBridge: LayerSwapBridge, gardenBridge: GardenFinanceBridge, xverseBridge: XverseBridge): TokenConversionAggregator;
//# sourceMappingURL=token-conversion-aggregator.d.ts.map