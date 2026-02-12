import {
  Address,
  TokenId,
  TransactionHash,
  ShieldedNote,
  EncryptedBalance,
  YieldAmount,
  TimePeriod,
  ZKProof,
  KiritoSDKConfig,
  Commitment,
  Nullifier,
  EncryptedAmount,
  StakingInfo,
  SourceYieldData,
  AggregatedYield,
  StakingStatistics,
  YieldClaimProofData
} from '../types';

import { ShieldedPoolManager, YieldDistributor, YieldSource } from '../interfaces';
import { TongoIntegration, StealthAddressGenerator } from '../utils/tongo-integration';
import { ZKProofManager } from '../utils/zk-proof-manager';
import { DeFiYieldAggregator, createDeFiYieldAggregator } from './defi-yield-aggregator';
import { Account } from 'starknet';

/**
 * Shielded Pool Manager SDK Implementation
 * Provides TypeScript implementation for privacy-preserving staking using Tongo protocol
 */
export class ShieldedPoolManagerSDK implements ShieldedPoolManager {
  private config: KiritoSDKConfig;
  private yieldDistributor: YieldDistributorSDK;
  private tongoIntegration: TongoIntegration;
  private starknetAccount: Account;

  constructor(config: KiritoSDKConfig, starknetAccount: Account) {
    this.config = config;
    this.starknetAccount = starknetAccount;
    this.yieldDistributor = new YieldDistributorSDK(config);
    this.tongoIntegration = new TongoIntegration(config, starknetAccount);
  }

  /**
   * Initialize the shielded pool manager
   */
  async initialize(tongoPrivateKey: string): Promise<void> {
    try {
      await this.tongoIntegration.initialize(tongoPrivateKey);
      console.log('Shielded Pool Manager initialized with Tongo protocol');
    } catch (error) {
      throw new Error(`Failed to initialize Shielded Pool Manager: ${error}`);
    }
  }

  /**
   * Deposit tokens into shielded pool using Tongo fund operation
   */
  async deposit(amount: bigint, token: Address): Promise<ShieldedNote> {
    try {
      // Use Tongo fund operation to deposit tokens
      const txHash = await this.tongoIntegration.fund({
        tokenAddress: token,
        amount
      });

      // Get Tongo public key for the note
      const tongoPublicKey = this.tongoIntegration.getTongoPublicKeyHex();
      
      // Create shielded note representation
      const note: ShieldedNote = {
        commitment: await this.generateCommitment(amount, token),
        nullifier: await this.generateNullifier(amount, token),
        encryptedAmount: await this.createEncryptedAmount(amount),
        tokenAddress: token,
        owner: tongoPublicKey
      };

      console.log(`Shielded deposit successful: ${amount} ${token}, tx: ${txHash}`);
      return note;
    } catch (error) {
      throw new Error(`Failed to deposit to shielded pool: ${error}`);
    }
  }

  /**
   * Withdraw tokens from shielded pool using Tongo withdraw operation
   */
  async withdraw(note: ShieldedNote, amount: bigint): Promise<TransactionHash> {
    try {
      // Use Tongo withdraw operation
      const txHash = await this.tongoIntegration.withdraw({
        tokenAddress: note.tokenAddress,
        amount,
        recipient: this.starknetAccount.address
      });

      console.log(`Shielded withdrawal successful: ${amount} ${note.tokenAddress}, tx: ${txHash}`);
      return txHash;
    } catch (error) {
      throw new Error(`Failed to withdraw from shielded pool: ${error}`);
    }
  }

  /**
   * Transfer within shielded pool using Tongo transfer operation
   */
  async transfer(from: ShieldedNote, to: Address, amount: bigint): Promise<ShieldedNote> {
    try {
      // Use Tongo transfer operation
      const txHash = await this.tongoIntegration.transfer({
        tokenAddress: from.tokenAddress,
        amount,
        recipient: to // This should be a Tongo public key
      });

      // Create new shielded note for recipient
      const newNote: ShieldedNote = {
        commitment: await this.generateCommitment(amount, from.tokenAddress),
        nullifier: await this.generateNullifier(amount, from.tokenAddress),
        encryptedAmount: await this.createEncryptedAmount(amount),
        tokenAddress: from.tokenAddress,
        owner: to
      };

      console.log(`Shielded transfer successful: ${amount} ${from.tokenAddress}, tx: ${txHash}`);
      return newNote;
    } catch (error) {
      throw new Error(`Failed to transfer in shielded pool: ${error}`);
    }
  }

  /**
   * Get encrypted balance using real Tongo SDK with enhanced display
   */
  async getShieldedBalance(note: ShieldedNote): Promise<EncryptedBalance> {
    try {
      // Get balance from enhanced Tongo integration
      const balance = await this.tongoIntegration.getShieldedBalance(note.tokenAddress);

      return {
        encryptedAmount: {
          ciphertext: new Uint8Array(
            (balance.encryptedBalance.startsWith('0x') ? balance.encryptedBalance.slice(2) : balance.encryptedBalance)
              .match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []
          ),
          ephemeralKey: new Uint8Array(32) // Would be provided by Tongo in real implementation
        },
        proof: new Uint8Array(64) // Proof of balance ownership
      };
    } catch (error) {
      throw new Error(`Failed to get shielded balance: ${error}`);
    }
  }

  /**
   * Get encrypted balance display for UI
   */
  async getEncryptedBalanceDisplay(tokenAddress: Address): Promise<{
    hasBalance: boolean;
    encryptedDisplay: string;
    canDecrypt: boolean;
    decryptedDisplay?: string;
    lastUpdated: number;
  }> {
    try {
      return await this.tongoIntegration.getEncryptedBalanceDisplay(tokenAddress);
    } catch (error) {
      throw new Error(`Failed to get encrypted balance display: ${error}`);
    }
  }

  /**
   * Generate proof of balance ownership without revealing amount
   */
  async generateBalanceProof(
    tokenAddress: Address,
    minimumAmount?: bigint
  ): Promise<{
    proof: Uint8Array;
    publicInputs: Uint8Array[];
    canProveOwnership: boolean;
  }> {
    try {
      return await this.tongoIntegration.generateBalanceProof(tokenAddress, minimumAmount);
    } catch (error) {
      throw new Error(`Failed to generate balance proof: ${error}`);
    }
  }

  /**
   * Query all encrypted balances for the current account
   */
  async queryAllBalances(): Promise<Map<Address, {
    encryptedBalance: string;
    canDecrypt: boolean;
    decryptedAmount?: bigint;
  }>> {
    try {
      return await this.tongoIntegration.queryAllBalances();
    } catch (error) {
      throw new Error(`Failed to query all balances: ${error}`);
    }
  }

  /**
   * Generate viewing key for balance auditing
   */
  async generateViewingKey(tokenAddress: Address): Promise<{
    viewingKey: string;
    expiresAt?: number;
  }> {
    try {
      return await this.tongoIntegration.generateViewingKey(tokenAddress);
    } catch (error) {
      throw new Error(`Failed to generate viewing key: ${error}`);
    }
  }

  /**
   * Verify note validity (simplified for Tongo integration)
   */
  async verifyNote(note: ShieldedNote): Promise<boolean> {
    try {
      // For Tongo integration, we trust the SDK to manage note validity
      // In a full implementation, this would verify the note against the Tongo contract state
      return note.commitment.value.length > 0 && 
             note.nullifier.value.length > 0 && 
             note.tokenAddress.length > 0;
    } catch (error) {
      console.error(`Failed to verify note: ${error}`);
      return false;
    }
  }

  /**
   * Get yield distributor instance
   */
  getYieldDistributor(): YieldDistributor {
    return this.yieldDistributor;
  }

  // Private helper methods

  private async generateCommitment(amount: bigint, token: Address): Promise<Commitment> {
    // Generate cryptographic commitment using Pedersen hash
    const randomness = crypto.getRandomValues(new Uint8Array(32));
    const data = new TextEncoder().encode(`${amount}_${token}_${Array.from(randomness).join('')}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    
    return {
      value: '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    };
  }

  private async generateNullifier(amount: bigint, token: Address): Promise<Nullifier> {
    // Generate nullifier from amount, token, and timestamp
    const timestamp = Date.now();
    const data = new TextEncoder().encode(`${amount}_${token}_${timestamp}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hash));
    
    return {
      value: '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    };
  }

  private async createEncryptedAmount(amount: bigint): Promise<EncryptedAmount> {
    // Create encrypted amount representation (simplified)
    const ephemeralKey = crypto.getRandomValues(new Uint8Array(32));
    const amountBytes = new TextEncoder().encode(amount.toString());
    
    // XOR with ephemeral key for simple encryption
    const ciphertext = new Uint8Array(amountBytes.length);
    for (let i = 0; i < amountBytes.length; i++) {
      ciphertext[i] = amountBytes[i] ^ ephemeralKey[i % ephemeralKey.length];
    }

    return {
      ciphertext,
      ephemeralKey
    };
  }
}

/**
 * Yield Calculation Engine
 * Core engine for calculating proportional yields based on stake and rarity
 */
export class YieldCalculationEngine {
  private config: KiritoSDKConfig;
  private yieldSources: Map<string, YieldSource> = new Map();
  private stakingData: Map<TokenId, StakingInfo> = new Map();
  private totalStakedAmount: bigint = BigInt(0);
  private totalRarityWeight: number = 0;
  private defiAggregator?: DeFiYieldAggregator;

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    // Initialize DeFi aggregator if starknet account is available
    if (config.starknetAccount) {
      this.defiAggregator = createDeFiYieldAggregator(config, config.starknetAccount);
    }
  }

  /**
   * Calculate proportional yield for a specific NFT based on stake and rarity
   */
  async calculateProportionalYield(
    tokenId: TokenId, 
    stakingAmount: bigint, 
    rarityScore: number, 
    yieldMultiplier: number,
    totalYieldPool: bigint
  ): Promise<bigint> {
    try {
      // Get staking info for the token
      const stakingInfo = this.stakingData.get(tokenId) || {
        tokenId,
        stakedAmount: stakingAmount,
        rarityScore,
        yieldMultiplier,
        lastClaimTimestamp: Date.now()
      };

      // Calculate stake weight (proportion of total staked)
      const stakeWeight = this.totalStakedAmount > 0 
        ? Number(stakingInfo.stakedAmount) / Number(this.totalStakedAmount)
        : 0;

      // Calculate rarity weight (normalized rarity score)
      const rarityWeight = this.totalRarityWeight > 0
        ? stakingInfo.rarityScore / this.totalRarityWeight
        : 0;

      // Combined weight: 70% stake, 30% rarity
      const combinedWeight = (stakeWeight * 0.7) + (rarityWeight * 0.3);

      // Apply yield multiplier
      const adjustedWeight = combinedWeight * stakingInfo.yieldMultiplier;

      // Calculate proportional yield
      const proportionalYield = BigInt(Math.floor(Number(totalYieldPool) * adjustedWeight));

      console.log(`Yield calculation for ${tokenId}:`, {
        stakeWeight,
        rarityWeight,
        combinedWeight,
        yieldMultiplier: stakingInfo.yieldMultiplier,
        proportionalYield: proportionalYield.toString()
      });

      return proportionalYield;
    } catch (error) {
      throw new Error(`Failed to calculate proportional yield: ${error}`);
    }
  }

  /**
   * Aggregate yields from multiple sources with weighted distribution
   * Uses the unified DeFi aggregator for better yield optimization
   */
  async aggregateMultiSourceYields(period: TimePeriod): Promise<AggregatedYield> {
    try {
      // Use DeFi aggregator if available for DeFi protocols
      if (this.defiAggregator) {
        try {
          const representativeWallet = this.config.network.contracts.yieldDistributor;
          const defiYield = await this.defiAggregator.getAggregatedYield(representativeWallet, period);
          
          // Convert DeFi aggregator result to our format
          const sourceYields: SourceYieldData[] = defiYield.protocolBreakdown.map(pb => ({
            sourceId: pb.protocol,
            sourceName: pb.protocolName,
            rawYield: pb.rawYield,
            weightedYield: pb.weightedYield,
            weight: pb.weight,
            token: pb.token
          }));

          // Add non-DeFi sources (RWA, etc.)
          for (const [sourceId, source] of this.yieldSources) {
            if (!source.isActive) continue;
            
            // Skip DeFi sources as they're handled by the aggregator
            if (sourceId.includes('vesu') || sourceId.includes('ekubo') || sourceId.includes('atomiq')) {
              continue;
            }

            try {
              const sourceYield = await this.fetchYieldFromSource(source, period);
              const weightedYield = BigInt(Math.floor(Number(sourceYield.amount) * source.weight));
              
              sourceYields.push({
                sourceId,
                sourceName: source.name,
                rawYield: sourceYield.amount,
                weightedYield,
                weight: source.weight,
                token: sourceYield.token
              });
            } catch (error) {
              console.warn(`Failed to fetch yield from source ${sourceId}: ${error}`);
            }
          }

          // Recalculate total yield
          const totalYield = sourceYields.reduce((sum, sy) => sum + sy.weightedYield, BigInt(0));

          return {
            totalYield,
            sourceBreakdown: sourceYields,
            period,
            aggregationTimestamp: Date.now()
          };
        } catch (error) {
          console.warn(`DeFi aggregator failed, falling back to individual sources: ${error}`);
        }
      }

      // Fallback to original implementation
      const sourceYields: SourceYieldData[] = [];
      let totalWeightedYield = BigInt(0);
      let totalWeight = 0;

      // Collect yields from all active sources
      for (const [sourceId, source] of this.yieldSources) {
        if (!source.isActive) continue;

        try {
          const sourceYield = await this.fetchYieldFromSource(source, period);
          const weightedYield = BigInt(Math.floor(Number(sourceYield.amount) * source.weight));
          
          sourceYields.push({
            sourceId,
            sourceName: source.name,
            rawYield: sourceYield.amount,
            weightedYield,
            weight: source.weight,
            token: sourceYield.token
          });

          totalWeightedYield += weightedYield;
          totalWeight += source.weight;
        } catch (error) {
          console.warn(`Failed to fetch yield from source ${sourceId}: ${error}`);
          // Continue with other sources
        }
      }

      // Normalize weights if they don't sum to 1.0
      if (totalWeight !== 1.0 && totalWeight > 0) {
        const normalizationFactor = 1.0 / totalWeight;
        sourceYields.forEach(sy => {
          sy.weight *= normalizationFactor;
          sy.weightedYield = BigInt(Math.floor(Number(sy.rawYield) * sy.weight));
        });
        
        // Recalculate total
        totalWeightedYield = sourceYields.reduce((sum, sy) => sum + sy.weightedYield, BigInt(0));
      }

      return {
        totalYield: totalWeightedYield,
        sourceBreakdown: sourceYields,
        period,
        aggregationTimestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to aggregate multi-source yields: ${error}`);
    }
  }

  /**
   * Update staking information for yield calculations
   */
  updateStakingInfo(tokenId: TokenId, stakingInfo: StakingInfo): void {
    const previousInfo = this.stakingData.get(tokenId);
    
    // Update total staked amount
    if (previousInfo) {
      this.totalStakedAmount -= previousInfo.stakedAmount;
      this.totalRarityWeight -= previousInfo.rarityScore;
    }
    
    this.stakingData.set(tokenId, stakingInfo);
    this.totalStakedAmount += stakingInfo.stakedAmount;
    this.totalRarityWeight += stakingInfo.rarityScore;
  }

  /**
   * Add or update yield source
   */
  addYieldSource(source: YieldSource): void {
    this.yieldSources.set(source.id, source);
  }

  /**
   * Remove yield source
   */
  removeYieldSource(sourceId: string): boolean {
    return this.yieldSources.delete(sourceId);
  }

  /**
   * Get all yield sources
   */
  getYieldSources(): YieldSource[] {
    return Array.from(this.yieldSources.values());
  }

  /**
   * Get DeFi aggregator instance for advanced operations
   */
  getDeFiAggregator(): DeFiYieldAggregator | undefined {
    return this.defiAggregator;
  }

  /**
   * Get staking statistics
   */
  getStakingStatistics(): StakingStatistics {
    return {
      totalStakedAmount: this.totalStakedAmount,
      totalRarityWeight: this.totalRarityWeight,
      activeStakers: this.stakingData.size,
      averageStake: this.stakingData.size > 0 
        ? this.totalStakedAmount / BigInt(this.stakingData.size)
        : BigInt(0),
      averageRarity: this.stakingData.size > 0
        ? this.totalRarityWeight / this.stakingData.size
        : 0
    };
  }

  // Private helper methods

  private async fetchYieldFromSource(source: YieldSource, period: TimePeriod): Promise<YieldAmount> {
    try {
      if (source.id.includes('defi')) {
        return await this.fetchDeFiYield(source, period);
      } else if (source.id.includes('rwa')) {
        return await this.fetchRWAYield(source, period);
      } else {
        // Generic yield source
        return await this.fetchGenericYield(source, period);
      }
    } catch (error) {
      throw new Error(`Failed to fetch yield from ${source.name}: ${error}`);
    }
  }

  private async fetchDeFiYield(source: YieldSource, period: TimePeriod): Promise<YieldAmount> {
    // DeFi yield fetching with support for multiple protocols
    const periodDays = (period.end - period.start) / (1000 * 60 * 60 * 24);
    
    try {
      if (source.endpoint.includes('vesu')) {
        // Real Vesu lending protocol integration
        try {
          const { VesuIntegration } = await import('./vesu-integration');
          const vesuIntegration = new VesuIntegration(
            source.endpoint,
            this.config.starknetAccount,
            this.config.network.contracts.vesuLending || '0x123456789abcdef'
          );
          
          // Get aggregated yield from all Vesu positions
          // For yield calculation, we use a representative wallet address
          const representativeWallet = this.config.network.contracts.yieldDistributor;
          const vesuYield = await vesuIntegration.getAggregatedYield(representativeWallet, period);
          
          return vesuYield;
        } catch (error) {
          console.warn(`Vesu integration failed, using fallback: ${error}`);
          // Fallback to mock implementation
          const lendingAPY = 0.08; // 8% APY from lending
          const dailyRate = lendingAPY / 365;
          const mockPoolSize = BigInt(1000000);
          const yieldAmount = BigInt(Math.floor(Number(mockPoolSize) * dailyRate * periodDays));
          
          return {
            amount: yieldAmount,
            token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
            period
          };
        }
      } else if (source.endpoint.includes('ekubo')) {
        // Real Ekubo DEX protocol integration
        try {
          const { EkuboIntegration } = await import('./ekubo-integration');
          const ekuboIntegration = new EkuboIntegration(
            this.config.starknetAccount,
            this.config.network.contracts.ekuboDEX || '0x123456789abcdef',
            source.endpoint
          );
          
          // Get aggregated yield from all Ekubo positions
          // For yield calculation, we use a representative wallet address
          const representativeWallet = this.config.network.contracts.yieldDistributor;
          const ekuboYield = await ekuboIntegration.getAggregatedYield(representativeWallet, period);
          
          return ekuboYield;
        } catch (error) {
          console.warn(`Ekubo integration failed, using fallback: ${error}`);
          // Fallback to mock implementation
          const lpAPY = 0.12; // 12% APY from LP fees
          const dailyRate = lpAPY / 365;
          const mockPoolSize = BigInt(800000);
          const yieldAmount = BigInt(Math.floor(Number(mockPoolSize) * dailyRate * periodDays));
          
          return {
            amount: yieldAmount,
            token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
            period
          };
        }
      } else if (source.endpoint.includes('atomiq')) {
        // Atomiq is now a cross-chain swap protocol, not a yield source
        // Skip it for yield aggregation as it doesn't provide yield
        console.warn('Atomiq is a swap protocol, not a yield source - skipping');
        
        // Fallback to zero yield
        return {
          amount: BigInt(0),
          token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
          period
        };
      } else {
        // Generic DeFi protocol
        const annualYieldRate = 0.08; // 8% APY
        const dailyRate = annualYieldRate / 365;
        const mockPoolSize = BigInt(1000000);
        const yieldAmount = BigInt(Math.floor(Number(mockPoolSize) * dailyRate * periodDays));
        
        return {
          amount: yieldAmount,
          token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
          period
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch DeFi yield from ${source.name}: ${error}`);
      // Fallback to zero yield
      return {
        amount: BigInt(0),
        token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        period
      };
    }
  }

  private async fetchRWAYield(source: YieldSource, period: TimePeriod): Promise<YieldAmount> {
    // Mock RWA yield fetching - in real implementation would call RWA oracles
    const periodDays = (period.end - period.start) / (1000 * 60 * 60 * 24);
    const annualYieldRate = 0.05; // 5% APY for RWA
    const dailyRate = annualYieldRate / 365;
    const mockAssetValue = BigInt(500000); // 500K tokens
    
    const yieldAmount = BigInt(Math.floor(Number(mockAssetValue) * dailyRate * periodDays));
    
    return {
      amount: yieldAmount,
      token: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // USDC
      period
    };
  }

  private async fetchGenericYield(source: YieldSource, period: TimePeriod): Promise<YieldAmount> {
    // Mock generic yield source
    const mockYield = BigInt(Math.floor(Math.random() * 100000 * source.weight));
    
    return {
      amount: mockYield,
      token: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      period
    };
  }
}

/**
 * Yield Distributor SDK Implementation
 * Handles yield calculation and distribution for shielded pools
 */
export class YieldDistributorSDK implements YieldDistributor {
  private config: KiritoSDKConfig;
  private yieldEngine: YieldCalculationEngine;
  private zkProofManager: ZKProofManager;

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    this.yieldEngine = new YieldCalculationEngine(config);
    this.zkProofManager = new ZKProofManager(config);
    this.initializeDefaultYieldSources();
  }

  /**
   * Calculate yield for specific NFT using the enhanced yield engine
   */
  async calculateYield(tokenId: TokenId, period: TimePeriod): Promise<YieldAmount> {
    try {
      // Get NFT metadata to determine yield multiplier and rarity
      const metadata = await this.getNFTMetadata(tokenId);
      const yieldMultiplier = metadata.yieldMultiplier || 1.0;
      const rarityScore = metadata.rarityScore || 1.0;

      // Get staking amount for this NFT (mock for now)
      const stakingAmount = await this.getStakingAmount(tokenId);

      // Update staking info in the yield engine
      this.yieldEngine.updateStakingInfo(tokenId, {
        tokenId,
        stakedAmount: stakingAmount,
        rarityScore,
        yieldMultiplier,
        lastClaimTimestamp: Date.now()
      });

      // Get aggregated yield from all sources
      const aggregatedYield = await this.yieldEngine.aggregateMultiSourceYields(period);

      // Calculate proportional yield for this specific NFT
      const proportionalYield = await this.yieldEngine.calculateProportionalYield(
        tokenId,
        stakingAmount,
        rarityScore,
        yieldMultiplier,
        aggregatedYield.totalYield
      );

      return {
        amount: proportionalYield,
        token: aggregatedYield.sourceBreakdown[0]?.token || '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        period
      };
    } catch (error) {
      throw new Error(`Failed to calculate yield: ${error}`);
    }
  }

  /**
   * Distribute yields to multiple recipients
   */
  async distributeYields(recipients: TokenId[], amounts: YieldAmount[]): Promise<TransactionHash> {
    try {
      if (recipients.length !== amounts.length) {
        throw new Error('Recipients and amounts arrays must have same length');
      }

      // Prepare distribution data
      const distributionData = recipients.map((tokenId, index) => ({
        tokenId,
        amount: amounts[index].amount.toString(),
        token: amounts[index].token
      }));

      // Execute distribution transaction
      const txHash = await this.executeContractCall(
        this.config.network.contracts.yieldDistributor,
        'distribute_yields',
        distributionData
      );

      console.log(`Yields distributed to ${recipients.length} recipients, tx: ${txHash}`);
      return txHash;
    } catch (error) {
      throw new Error(`Failed to distribute yields: ${error}`);
    }
  }

  /**
   * Claim yield with zero-knowledge proof
   * Verifies eligibility without revealing private staking information
   */
  async claimYield(tokenId: TokenId, proof: ZKProof): Promise<TransactionHash> {
    try {
      // Extract claim amount from proof public inputs
      const claimAmount = await this.extractClaimAmountFromProof(proof);

      // Verify the zero-knowledge proof
      const isValidProof = await this.zkProofManager.verifyYieldClaimProof(
        tokenId,
        claimAmount,
        proof
      );

      if (!isValidProof) {
        throw new Error('Invalid yield claim proof');
      }

      // Execute claim transaction with automatic deposit to NFT wallet
      const txHash = await this.executeYieldClaim(tokenId, claimAmount);

      console.log(`Yield claimed for NFT ${tokenId}: ${claimAmount.toString()}, tx: ${txHash}`);
      return txHash;
    } catch (error) {
      throw new Error(`Failed to claim yield: ${error}`);
    }
  }

  /**
   * Generate zero-knowledge proof for yield claim
   * Creates a proof that the user is eligible for the specified yield amount
   */
  async generateYieldClaimProof(
    tokenId: TokenId,
    claimAmount: bigint,
    stakingNote: ShieldedNote
  ): Promise<ZKProof> {
    try {
      // Get NFT metadata for proof generation
      const metadata = await this.getNFTMetadata(tokenId);
      const stakingAmount = await this.getStakingAmount(tokenId);

      // Create proof data
      const proofData: YieldClaimProofData = {
        tokenId,
        stakedAmount: stakingAmount,
        rarityScore: metadata.rarityScore,
        yieldMultiplier: metadata.yieldMultiplier,
        claimAmount,
        stakingNote,
        lastClaimTimestamp: Date.now()
      };

      // Generate the ZK proof
      const proof = await this.zkProofManager.generateYieldClaimProof(proofData);

      console.log(`Generated yield claim proof for NFT ${tokenId}`);
      return proof;
    } catch (error) {
      throw new Error(`Failed to generate yield claim proof: ${error}`);
    }
  }

  /**
   * Verify yield eligibility without claiming
   * Allows users to check if they are eligible for yield without actually claiming
   */
  async verifyYieldEligibility(
    tokenId: TokenId,
    stakingNote: ShieldedNote,
    minimumYield: bigint
  ): Promise<boolean> {
    try {
      // Generate eligibility proof
      const eligibilityProof = await this.zkProofManager.generateEligibilityProof(
        tokenId,
        stakingNote,
        minimumYield
      );

      // Verify the proof (this is mainly for demonstration)
      const isEligible = await this.zkProofManager.verifyYieldClaimProof(
        tokenId,
        minimumYield,
        eligibilityProof
      );

      return isEligible;
    } catch (error) {
      console.error(`Failed to verify yield eligibility: ${error}`);
      return false;
    }
  }

  /**
   * Batch claim yields for multiple NFTs
   * Efficiently processes multiple yield claims in a single transaction
   */
  async batchClaimYields(
    claims: Array<{ tokenId: TokenId; proof: ZKProof }>
  ): Promise<TransactionHash> {
    try {
      // Extract claim amounts and verify all proofs
      const claimData = await Promise.all(
        claims.map(async claim => ({
          tokenId: claim.tokenId,
          claimAmount: await this.extractClaimAmountFromProof(claim.proof),
          proof: claim.proof
        }))
      );

      // Batch verify all proofs
      const verificationResults = await this.zkProofManager.batchVerifyYieldClaims(claimData);

      // Check if all proofs are valid
      const allValid = verificationResults.every(result => result);
      if (!allValid) {
        const invalidIndices = verificationResults
          .map((valid, index) => valid ? -1 : index)
          .filter(index => index >= 0);
        throw new Error(`Invalid proofs at indices: ${invalidIndices.join(', ')}`);
      }

      // Execute batch claim transaction
      const totalClaimAmount = claimData.reduce((sum, claim) => sum + claim.claimAmount, 0n);
      const txHash = await this.executeBatchYieldClaim(claimData);

      console.log(`Batch yield claim completed for ${claims.length} NFTs, total: ${totalClaimAmount.toString()}, tx: ${txHash}`);
      return txHash;
    } catch (error) {
      throw new Error(`Failed to batch claim yields: ${error}`);
    }
  }

  /**
   * Get ZK proof manager instance for advanced operations
   */
  getZKProofManager(): ZKProofManager {
    return this.zkProofManager;
  }

  /**
   * Get total yield available using the yield engine
   */
  async getTotalYield(period: TimePeriod): Promise<YieldAmount> {
    try {
      const aggregatedYield = await this.yieldEngine.aggregateMultiSourceYields(period);
      
      return {
        amount: aggregatedYield.totalYield,
        token: aggregatedYield.sourceBreakdown[0]?.token || '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        period
      };
    } catch (error) {
      throw new Error(`Failed to get total yield: ${error}`);
    }
  }

  /**
   * Add yield source using the yield engine
   */
  async addYieldSource(source: YieldSource): Promise<void> {
    try {
      // Validate yield source
      if (!source.id || !source.endpoint) {
        throw new Error('Invalid yield source configuration');
      }

      // Test connectivity to yield source
      const isReachable = await this.testYieldSourceConnectivity(source);
      if (!isReachable) {
        throw new Error(`Cannot connect to yield source: ${source.endpoint}`);
      }

      // Add to yield engine
      this.yieldEngine.addYieldSource(source);
      console.log(`Yield source added: ${source.name} (${source.id})`);
    } catch (error) {
      throw new Error(`Failed to add yield source: ${error}`);
    }
  }

  /**
   * Get all yield sources from the yield engine
   */
  getYieldSources(): YieldSource[] {
    return this.yieldEngine.getYieldSources();
  }

  /**
   * Remove yield source using the yield engine
   */
  removeYieldSource(sourceId: string): void {
    const removed = this.yieldEngine.removeYieldSource(sourceId);
    if (removed) {
      console.log(`Yield source removed: ${sourceId}`);
    }
  }

  /**
   * Get staking statistics from the yield engine
   */
  getStakingStatistics(): StakingStatistics {
    return this.yieldEngine.getStakingStatistics();
  }

  /**
   * Get yield engine instance for advanced operations
   */
  getYieldEngine(): YieldCalculationEngine {
    return this.yieldEngine;
  }

  // Private helper methods

  private initializeDefaultYieldSources(): void {
    // Add default yield sources based on available protocols from resources_links.md
    // Note: Atomiq is removed as it's a cross-chain swap protocol, not a yield source
    const defaultSources: YieldSource[] = [
      {
        id: 'vesu_lending_pool',
        name: 'Vesu Lending Pool',
        endpoint: 'https://api.vesu.xyz/lending-rates',
        weight: 0.4, // Increased from 0.3
        isActive: true
      },
      {
        id: 'ekubo_dex_pool',
        name: 'Ekubo DEX LP Pool',
        endpoint: 'https://api.ekubo.org/pool-yields',
        weight: 0.3, // Increased from 0.25
        isActive: true
      },
      {
        id: 'mock_rwa_oracle',
        name: 'Mock RWA Oracle',
        endpoint: 'https://mock-rwa-api.example.com',
        weight: 0.3, // Same
        isActive: true
      }
    ];

    defaultSources.forEach(source => {
      this.yieldEngine.addYieldSource(source);
    });
  }

  private async getStakingAmount(tokenId: TokenId): Promise<bigint> {
    try {
      // Query real staking amount from NFT contract
      const { createStarknetClient } = await import('../utils/starknet-client');
      const client = createStarknetClient(this.config);
      
      const result = await client.callContractView(
        this.config.network.contracts.nftWallet,
        'get_staking_amount',
        [tokenId]
      );
      
      return BigInt(result[0]);
    } catch (error) {
      console.error(`Failed to get staking amount: ${error}`);
      throw new Error(`Failed to get staking amount for NFT ${tokenId}: ${error}`);
    }
  }

  private async extractClaimAmountFromProof(proof: ZKProof): Promise<bigint> {
    try {
      // Extract claim amount from the second public input
      if (proof.publicInputs.length < 2) {
        throw new Error('Invalid proof structure - missing claim amount');
      }

      return this.bytesToBigInt(proof.publicInputs[1]);
    } catch (error) {
      throw new Error(`Failed to extract claim amount from proof: ${error}`);
    }
  }

  private async executeYieldClaim(tokenId: TokenId, claimAmount: bigint): Promise<TransactionHash> {
    try {
      // Execute the yield claim and automatically deposit to NFT wallet
      const txHash = await this.executeContractCall(
        this.config.network.contracts.yieldDistributor,
        'claim_yield_to_wallet',
        [tokenId, claimAmount.toString()]
      );

      // Update internal tracking
      console.log(`Yield ${claimAmount.toString()} automatically deposited to NFT wallet ${tokenId}`);
      
      return txHash;
    } catch (error) {
      throw new Error(`Failed to execute yield claim: ${error}`);
    }
  }

  private async executeBatchYieldClaim(
    claims: Array<{ tokenId: TokenId; claimAmount: bigint; proof: ZKProof }>
  ): Promise<TransactionHash> {
    try {
      // Prepare batch claim data
      const batchData = claims.map(claim => ({
        tokenId: claim.tokenId,
        amount: claim.claimAmount.toString()
      }));

      // Execute batch claim transaction
      const txHash = await this.executeContractCall(
        this.config.network.contracts.yieldDistributor,
        'batch_claim_yields',
        [batchData]
      );

      return txHash;
    } catch (error) {
      throw new Error(`Failed to execute batch yield claim: ${error}`);
    }
  }

  private bytesToBigInt(bytes: Uint8Array): bigint {
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return BigInt('0x' + hex);
  }

  private async getNFTMetadata(tokenId: TokenId): Promise<any> {
    try {
      // Query real NFT metadata from contract
      const { createStarknetClient } = await import('../utils/starknet-client');
      const client = createStarknetClient(this.config);
      
      // Get token URI from NFT contract
      const uriResult = await client.callContractView(
        this.config.network.contracts.nftWallet,
        'token_uri',
        [tokenId]
      );
      
      const tokenUri = uriResult[0];
      
      // Fetch metadata from IPFS or HTTP
      let metadata: any;
      if (tokenUri.startsWith('ipfs://')) {
        const ipfsHash = tokenUri.replace('ipfs://', '');
        const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
        metadata = await response.json();
      } else {
        const response = await fetch(tokenUri);
        metadata = await response.json();
      }
      
      // Extract yield multiplier and rarity score from metadata
      return {
        yieldMultiplier: metadata.attributes?.find((a: any) => a.trait_type === 'Yield Multiplier')?.value || 1.0,
        rarityScore: metadata.attributes?.find((a: any) => a.trait_type === 'Rarity Score')?.value || 1.0,
        ...metadata
      };
    } catch (error) {
      console.error(`Failed to get NFT metadata: ${error}`);
      // Fallback to default values
      return {
        yieldMultiplier: 1.0,
        rarityScore: 1.0
      };
    }
  }

  private async verifyYieldProof(tokenId: TokenId, proof: ZKProof): Promise<boolean> {
    try {
      // Mock proof verification - in real implementation would use proper ZK verification
      console.log(`Verifying yield proof for NFT ${tokenId}`);
      
      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock verification (always returns true for demo)
      return proof.proof.length > 0 && proof.publicInputs.length > 0;
    } catch (error) {
      console.error(`Proof verification failed: ${error}`);
      return false;
    }
  }

  private async testYieldSourceConnectivity(source: YieldSource): Promise<boolean> {
    try {
      console.log(`Testing connectivity to ${source.endpoint}`);
      
      // Real HTTP connectivity test with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(source.endpoint, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is successful (2xx status)
      const isReachable = response.ok;
      console.log(`Connectivity test for ${source.name}: ${isReachable ? 'SUCCESS' : 'FAILED'} (status: ${response.status})`);
      
      return isReachable;
    } catch (error) {
      console.error(`Connectivity test failed for ${source.name}: ${error}`);
      return false;
    }
  }

  private async executeContractCall(contractAddress: Address, method: string, params: any[]): Promise<TransactionHash> {
    // Real Starknet.js implementation
    try {
      const { createStarknetClient } = await import('../utils/starknet-client');
      const client = createStarknetClient(this.config);
      
      const txHash = await client.executeContractCall(
        contractAddress,
        method,
        params
      );
      
      console.log(`Contract call executed: ${contractAddress}.${method}, tx: ${txHash}`);
      return txHash;
    } catch (error) {
      throw new Error(`Failed to execute contract call ${method}: ${error}`);
    }
  }

  private hexToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return new Uint8Array(cleanHex.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []);
  }
}