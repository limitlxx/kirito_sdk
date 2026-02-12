import { Address, TransactionHash } from '../types';
import { LayerSwapBridgeImpl } from './layerswap-bridge';
import { GardenFinanceBridgeImpl } from './garden-finance-bridge';
import { XverseBridgeImpl } from './xverse-bridge';

/**
 * Yield source types supported by the system
 */
export enum YieldSourceType {
  BTC = 'BTC',
  WBTC = 'WBTC',
  MIXED = 'MIXED'
}

/**
 * Token types that can be converted to WBTC for yield
 */
export enum ConvertibleToken {
  BTC = 'BTC',
  ETH = 'ETH',
  STRK = 'STRK',
  USDC = 'USDC',
  WBTC = 'WBTC'
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
  btcPercentage: number; // 0-100
  wbtcPercentage: number; // 0-100
  customFactors: CustomAllocationFactors;
}

/**
 * Custom factors for yield allocation
 */
export interface CustomAllocationFactors {
  rarityWeight: number; // 0-1
  stakeWeight: number; // 0-1
  customMultipliers: Record<string, number>;
}

/**
 * Conversion preferences for token swaps
 */
export interface ConversionPreferences {
  preferredBridge: 'layerswap' | 'garden' | 'xverse' | 'auto';
  maxSlippage: number; // percentage
  deadline: number; // seconds
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
export class YieldSourceSelector {
  private layerSwapBridge: LayerSwapBridgeImpl;
  private gardenBridge: GardenFinanceBridgeImpl;
  private xverseBridge: XverseBridgeImpl;

  constructor(
    layerSwapBridge: LayerSwapBridgeImpl,
    gardenBridge: GardenFinanceBridgeImpl,
    xverseBridge: XverseBridgeImpl
  ) {
    this.layerSwapBridge = layerSwapBridge;
    this.gardenBridge = gardenBridge;
    this.xverseBridge = xverseBridge;
  }

  /**
   * Configure yield source for minting
   */
  async configureYieldSource(
    sourceType: YieldSourceType,
    allocation: YieldAllocation,
    preferences: ConversionPreferences
  ): Promise<YieldSourceConfig> {
    // Validate allocation percentages
    this.validateAllocation(allocation);

    const config: YieldSourceConfig = {
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
  async analyzeWalletForConversion(
    walletAddress: Address,
    targetWBTCAmount: bigint
  ): Promise<ConversionOption[]> {
    // Get wallet holdings (simplified - would integrate with actual wallet)
    const holdings = await this.getWalletHoldings(walletAddress);
    
    const options: ConversionOption[] = [];

    // Check each token for conversion potential
    for (const [token, balance] of Object.entries(holdings)) {
      if (balance > 0n && token !== ConvertibleToken.WBTC) {
        const conversionOption = await this.getConversionOption(
          token as ConvertibleToken,
          ConvertibleToken.WBTC,
          balance,
          targetWBTCAmount
        );
        
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
  async executeAutoConversion(
    fromToken: ConvertibleToken,
    amount: bigint,
    starknetAddress: Address,
    preferences: ConversionPreferences
  ): Promise<ConversionRecord> {
    let bridge: string;
    let txHash: TransactionHash;

    // Select bridge based on preferences
    switch (preferences.preferredBridge) {
      case 'layerswap':
        const layerSwapTx = await this.layerSwapBridge.convertStarknetTokenToWBTC(
          fromToken as 'ETH' | 'STRK' | 'USDC',
          amount,
          starknetAddress
        );
        bridge = 'layerswap';
        txHash = layerSwapTx.txHash || '';
        break;

      case 'garden':
        const gardenTx = await this.gardenBridge.executeAtomicSwapWithRouting(
          fromToken,
          ConvertibleToken.WBTC,
          amount,
          starknetAddress
        );
        bridge = 'garden';
        txHash = gardenTx.txHash || '';
        break;

      case 'xverse':
        const xverseTx = await this.xverseBridge.bridgeToStarknet(
          fromToken,
          amount,
          starknetAddress
        );
        bridge = 'xverse';
        txHash = xverseTx.txHash || '';
        break;

      case 'auto':
      default:
        // Find best rate across all bridges
        const bestOption = await this.findBestConversionRate(fromToken, amount);
        return this.executeAutoConversion(
          fromToken,
          amount,
          starknetAddress,
          { ...preferences, preferredBridge: bestOption.bridge as any }
        );
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
  async createMintingConfig(
    walletAddress: Address,
    desiredYieldAmount: bigint,
    sourceType: YieldSourceType,
    preferences: ConversionPreferences
  ): Promise<MintingConfig> {
    // Analyze wallet for conversion options
    const conversionOptions = await this.analyzeWalletForConversion(
      walletAddress,
      desiredYieldAmount
    );

    // Select best token to use
    const bestOption = conversionOptions[0];
    if (!bestOption) {
      throw new Error('No suitable tokens found for conversion');
    }

    // Configure yield source
    const allocation: YieldAllocation = {
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

    const yieldSource = await this.configureYieldSource(
      sourceType,
      allocation,
      preferences
    );

    // Create allocation preview
    const allocationPreview = await this.createAllocationPreview(
      desiredYieldAmount,
      allocation,
      bestOption.rate
    );

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
  async storeYieldMetadata(
    nftId: string,
    config: MintingConfig,
    conversionRecord: ConversionRecord
  ): Promise<YieldMetadata> {
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
  async getBidirectionalConversionOptions(
    tokenA: ConvertibleToken,
    tokenB: ConvertibleToken,
    amount: bigint
  ): Promise<{
    aToB: ConversionOption | null;
    bToA: ConversionOption | null;
  }> {
    const [aToB, bToA] = await Promise.all([
      this.getConversionOption(tokenA, tokenB, amount, amount),
      this.getConversionOption(tokenB, tokenA, amount, amount)
    ]);

    return { aToB, bToA };
  }

  /**
   * Private helper methods
   */
  private validateAllocation(allocation: YieldAllocation): void {
    const total = allocation.btcPercentage + allocation.wbtcPercentage;
    if (total !== 100) {
      throw new Error(`Allocation percentages must sum to 100, got ${total}`);
    }
  }

  private getSourcesForType(sourceType: YieldSourceType): string[] {
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

  private async getWalletHoldings(walletAddress: Address): Promise<WalletHoldings> {
    // Simplified - would integrate with actual wallet/blockchain queries
    return {
      [ConvertibleToken.BTC]: 0n,
      [ConvertibleToken.ETH]: 1000000000000000000n, // 1 ETH
      [ConvertibleToken.STRK]: 100000000000000000000n, // 100 STRK
      [ConvertibleToken.USDC]: 1000000000n, // 1000 USDC
      [ConvertibleToken.WBTC]: 0n
    };
  }

  private async getConversionOption(
    fromToken: ConvertibleToken,
    toToken: ConvertibleToken,
    amount: bigint,
    targetAmount: bigint
  ): Promise<ConversionOption | null> {
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
    } catch (error) {
      console.error(`Failed to get conversion option for ${fromToken} -> ${toToken}:`, error);
      return null;
    }
  }

  private async getCurrentRate(fromToken: ConvertibleToken, toToken: ConvertibleToken): Promise<number> {
    // Simplified rate calculation - would integrate with actual price oracles
    const rates: Record<string, number> = {
      'ETH-WBTC': 0.037, // 1 ETH = 0.037 WBTC
      'STRK-WBTC': 0.00003, // 1 STRK = 0.00003 WBTC
      'USDC-WBTC': 0.000017, // 1 USDC = 0.000017 WBTC
      'BTC-WBTC': 1.0 // 1:1 ratio
    };

    return rates[`${fromToken}-${toToken}`] || 0;
  }

  private async findBestConversionRate(
    fromToken: ConvertibleToken,
    amount: bigint
  ): Promise<{ bridge: string; rate: number }> {
    // Compare rates across bridges
    const rates = await Promise.all([
      this.getLayerSwapRate(fromToken, amount),
      this.getGardenRate(fromToken, amount),
      this.getXverseRate(fromToken, amount)
    ]);

    const bestRate = rates.reduce((best, current) => 
      current.rate > best.rate ? current : best
    );

    return bestRate;
  }

  private async getLayerSwapRate(fromToken: ConvertibleToken, amount: bigint): Promise<{ bridge: string; rate: number }> {
    try {
      const quote = await this.layerSwapBridge.getQuote(
        fromToken,
        ConvertibleToken.WBTC,
        amount,
        'STARKNET_MAINNET',
        'STARKNET_MAINNET'
      );
      const rate = Number(quote.toAmount) / Number(quote.fromAmount);
      return { bridge: 'layerswap', rate };
    } catch {
      return { bridge: 'layerswap', rate: 0 };
    }
  }

  private async getGardenRate(fromToken: ConvertibleToken, amount: bigint): Promise<{ bridge: string; rate: number }> {
    try {
      const route = await this.gardenBridge.getOptimalRoute(fromToken, ConvertibleToken.WBTC, amount);
      const rate = Number(route.expectedOutput) / Number(amount);
      return { bridge: 'garden', rate };
    } catch {
      return { bridge: 'garden', rate: 0 };
    }
  }

  private async getXverseRate(fromToken: ConvertibleToken, amount: bigint): Promise<{ bridge: string; rate: number }> {
    try {
      const estimate = await this.xverseBridge.estimateBridgeFees(fromToken, amount, 'starknet');
      const outputAmount = amount - estimate.totalFee;
      const rate = Number(outputAmount) / Number(amount);
      return { bridge: 'xverse', rate };
    } catch {
      return { bridge: 'xverse', rate: 0 };
    }
  }

  private async createAllocationPreview(
    yieldAmount: bigint,
    allocation: YieldAllocation,
    conversionRate: number
  ): Promise<AllocationPreview> {
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

/**
 * Factory function to create yield source selector
 */
export function createYieldSourceSelector(
  layerSwapBridge: LayerSwapBridgeImpl,
  gardenBridge: GardenFinanceBridgeImpl,
  xverseBridge: XverseBridgeImpl
): YieldSourceSelector {
  return new YieldSourceSelector(layerSwapBridge, gardenBridge, xverseBridge);
}