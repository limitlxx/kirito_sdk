import { Address, TransactionHash } from '../types';
import { LayerSwapBridgeImpl } from './layerswap-bridge';
import { GardenFinanceBridgeImpl } from './garden-finance-bridge';
import { XverseBridgeImpl } from './xverse-bridge';
/**
 * Yield source types supported by the system
 */
export declare enum YieldSourceType {
    BTC = "BTC",
    WBTC = "WBTC",
    MIXED = "MIXED"
}
/**
 * Token types that can be converted to WBTC for yield
 */
export declare enum ConvertibleToken {
    BTC = "BTC",
    ETH = "ETH",
    STRK = "STRK",
    USDC = "USDC",
    WBTC = "WBTC"
}
/**
 * Yield source configuration for minting
 */
export interface YieldSourceConfig {
    sourceType: YieldSourceType;
    allocation: YieldAllocation;
    conversionPreferences: ConversionPreferences;
    metadata: YieldMetadata;
}
/**
 * Allocation configuration for yield distribution
 */
export interface YieldAllocation {
    btcPercentage: number;
    wbtcPercentage: number;
    customFactors: CustomAllocationFactors;
}
/**
 * Custom factors for yield allocation
 */
export interface CustomAllocationFactors {
    rarityWeight: number;
    stakeWeight: number;
    customMultipliers: Record<string, number>;
}
/**
 * Conversion preferences for token swaps
 */
export interface ConversionPreferences {
    preferredBridge: 'layerswap' | 'garden' | 'xverse' | 'auto';
    maxSlippage: number;
    deadline: number;
    enableAutoConversion: boolean;
}
/**
 * Metadata stored with yield preferences
 */
export interface YieldMetadata {
    selectedSources: string[];
    conversionHistory: ConversionRecord[];
    allocationHistory: AllocationRecord[];
    preferences: UserPreferences;
}
/**
 * Record of token conversions
 */
export interface ConversionRecord {
    timestamp: number;
    fromToken: ConvertibleToken;
    toToken: ConvertibleToken;
    amount: bigint;
    rate: number;
    bridge: string;
    txHash: TransactionHash;
}
/**
 * Record of yield allocations
 */
export interface AllocationRecord {
    timestamp: number;
    nftId: string;
    allocation: YieldAllocation;
    estimatedYield: bigint;
}
/**
 * User preferences for yield generation
 */
export interface UserPreferences {
    riskTolerance: 'low' | 'medium' | 'high';
    yieldStrategy: 'conservative' | 'balanced' | 'aggressive';
    autoReinvest: boolean;
    notificationPreferences: NotificationPreferences;
}
/**
 * Notification preferences
 */
export interface NotificationPreferences {
    yieldClaims: boolean;
    conversionOpportunities: boolean;
    rateChanges: boolean;
}
/**
 * Wallet holdings for conversion analysis
 */
export interface WalletHoldings {
    [ConvertibleToken.BTC]: bigint;
    [ConvertibleToken.ETH]: bigint;
    [ConvertibleToken.STRK]: bigint;
    [ConvertibleToken.USDC]: bigint;
    [ConvertibleToken.WBTC]: bigint;
}
/**
 * Conversion option with rate and fees
 */
export interface ConversionOption {
    fromToken: ConvertibleToken;
    toToken: ConvertibleToken;
    amount: bigint;
    expectedOutput: bigint;
    rate: number;
    fees: bigint;
    bridge: string;
    estimatedTime: number;
}
/**
 * Minting configuration with yield source selection
 */
export interface MintingConfig {
    yieldSource: YieldSourceConfig;
    tokenToUse: ConvertibleToken;
    amountToConvert: bigint;
    conversionOptions: ConversionOption[];
    estimatedWBTCYield: bigint;
    allocationPreview: AllocationPreview;
}
/**
 * Preview of yield allocation
 */
export interface AllocationPreview {
    nftId: string;
    rarityScore: number;
    yieldMultiplier: number;
    estimatedDailyYield: bigint;
    estimatedMonthlyYield: bigint;
    estimatedAnnualYield: bigint;
    allocation: YieldAllocation;
}
/**
 * Yield Source Selector Implementation
 *
 * Handles yield source selection during minting, token conversion,
 * and allocation configuration.
 */
export declare class YieldSourceSelector {
    private layerSwapBridge;
    private gardenBridge;
    private xverseBridge;
    constructor(layerSwapBridge: LayerSwapBridgeImpl, gardenBridge: GardenFinanceBridgeImpl, xverseBridge: XverseBridgeImpl);
    /**
     * Configure yield source for minting
     */
    configureYieldSource(sourceType: YieldSourceType, allocation: YieldAllocation, preferences: ConversionPreferences): Promise<YieldSourceConfig>;
    /**
     * Analyze wallet holdings and suggest optimal conversion
     */
    analyzeWalletForConversion(walletAddress: Address, targetWBTCAmount: bigint): Promise<ConversionOption[]>;
    /**
     * Execute automatic token conversion during mint
     */
    executeAutoConversion(fromToken: ConvertibleToken, amount: bigint, starknetAddress: Address, preferences: ConversionPreferences): Promise<ConversionRecord>;
    /**
     * Create minting configuration with yield source selection
     */
    createMintingConfig(walletAddress: Address, desiredYieldAmount: bigint, sourceType: YieldSourceType, preferences: ConversionPreferences): Promise<MintingConfig>;
    /**
     * Store yield preferences and conversion history in NFT metadata
     */
    storeYieldMetadata(nftId: string, config: MintingConfig, conversionRecord: ConversionRecord): Promise<YieldMetadata>;
    /**
     * Get bidirectional conversion options
     */
    getBidirectionalConversionOptions(tokenA: ConvertibleToken, tokenB: ConvertibleToken, amount: bigint): Promise<{
        aToB: ConversionOption | null;
        bToA: ConversionOption | null;
    }>;
    /**
     * Private helper methods
     */
    private validateAllocation;
    private getSourcesForType;
    private getWalletHoldings;
    private getConversionOption;
    private getCurrentRate;
    private findBestConversionRate;
    private getLayerSwapRate;
    private getGardenRate;
    private getXverseRate;
    private createAllocationPreview;
}
/**
 * Factory function to create yield source selector
 */
export declare function createYieldSourceSelector(layerSwapBridge: LayerSwapBridgeImpl, gardenBridge: GardenFinanceBridgeImpl, xverseBridge: XverseBridgeImpl): YieldSourceSelector;
//# sourceMappingURL=yield-source-selector.d.ts.map