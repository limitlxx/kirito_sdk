import { Address, TransactionHash } from '../types';

// Core bridge types
export interface BridgeQuote {
  fromToken: string;
  toToken: string;
  fromAmount: bigint;
  toAmount: bigint;
  estimatedFees: bigint;
  estimatedTime: number; // seconds
  slippage: number; // percentage
  route: string[];
}

export interface BridgeTransaction {
  id: string;
  status: BridgeTransactionStatus;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: bigint;
  toAmount: bigint;
  txHash?: TransactionHash;
  confirmations: number;
  requiredConfirmations: number;
}

export enum BridgeTransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// LayerSwap Bridge Interface
export interface LayerSwapBridge {
  // Quote and execute cross-chain swaps
  getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    fromChain: string,
    toChain: string
  ): Promise<BridgeQuote>;

  // Execute bridge transaction
  executeBridge(
    quote: BridgeQuote,
    destinationAddress: Address,
    options?: BridgeOptions
  ): Promise<BridgeTransaction>;

  // Monitor transaction status
  getTransactionStatus(transactionId: string): Promise<BridgeTransaction>;

  // Get supported tokens and chains
  getSupportedTokens(): Promise<SupportedToken[]>;
  getSupportedChains(): Promise<SupportedChain[]>;
}

// Garden Finance Bridge Interface
export interface GardenFinanceBridge {
  // BTC wrapping and unwrapping
  wrapBTC(amount: bigint, destinationAddress: Address): Promise<BridgeTransaction>;
  unwrapWBTC(amount: bigint, btcAddress: string): Promise<BridgeTransaction>;

  // Atomic swaps
  createAtomicSwap(
    fromToken: string,
    toToken: string,
    amount: bigint,
    counterparty: Address
  ): Promise<AtomicSwap>;

  // Liquidity routing
  getOptimalRoute(
    fromToken: string,
    toToken: string,
    amount: bigint
  ): Promise<LiquidityRoute>;
}

// Xverse Bridge Interface
export interface XverseBridge {
  // Wallet connection
  connectWallet(): Promise<XverseWallet>;
  disconnectWallet(): Promise<void>;

  // Multi-token bridge support
  bridgeToStarknet(
    token: string,
    amount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction>;

  // Fee estimation
  estimateBridgeFees(
    token: string,
    amount: bigint,
    destination: string
  ): Promise<BridgeFeeEstimate>;
}

// Supporting types
export interface BridgeOptions {
  slippageTolerance?: number;
  deadline?: number;
  gasPrice?: bigint;
  priorityFee?: bigint;
}

export interface SupportedToken {
  symbol: string;
  address: Address;
  decimals: number;
  chains: string[];
}

export interface SupportedChain {
  id: string;
  name: string;
  nativeToken: string;
  blockTime: number;
}

export interface AtomicSwap {
  id: string;
  fromToken: string;
  toToken: string;
  amount: bigint;
  counterparty: Address;
  lockTime: number;
  secretHash: string;
  status: AtomicSwapStatus;
}

export enum AtomicSwapStatus {
  CREATED = 'created',
  LOCKED = 'locked',
  REDEEMED = 'redeemed',
  REFUNDED = 'refunded'
}

export interface LiquidityRoute {
  path: string[];
  expectedOutput: bigint;
  priceImpact: number;
  fees: bigint[];
}

export interface XverseWallet {
  address: string;
  publicKey: string;
  network: 'mainnet' | 'testnet';
}

export interface BridgeFeeEstimate {
  networkFee: bigint;
  bridgeFee: bigint;
  totalFee: bigint;
  estimatedTime: number;
}

// Token conversion aggregator interface
export interface TokenConversionAggregator {
  // Find best conversion rates across all bridges
  getBestRate(
    fromToken: string,
    toToken: string,
    amount: bigint
  ): Promise<ConversionRate>;

  // Execute conversion with optimal routing
  executeConversion(
    fromToken: string,
    toToken: string,
    amount: bigint,
    destinationAddress: Address,
    options?: ConversionOptions
  ): Promise<BridgeTransaction>;

  // Multi-hop routing support
  getMultiHopRoute(
    fromToken: string,
    toToken: string,
    amount: bigint
  ): Promise<MultiHopRoute>;

  // Rate caching and refresh
  refreshRates(): Promise<void>;
  getCachedRates(): Promise<CachedRate[]>;

  // Conversion preview with fees and slippage
  getConversionPreview(
    fromToken: string,
    toToken: string,
    amount: bigint,
    options?: ConversionOptions
  ): Promise<{
    bestRate: ConversionRate;
    multiHopRoute?: MultiHopRoute;
    estimatedOutput: bigint;
    totalFees: bigint;
    priceImpact: number;
    slippageProtection: bigint;
  }>;
}

export interface ConversionRate {
  fromToken: string;
  toToken: string;
  rate: number;
  bridge: string;
  fees: bigint;
  estimatedTime: number;
  confidence: number; // 0-1 score
}

export interface ConversionOptions {
  maxSlippage?: number;
  maxHops?: number;
  preferredBridges?: string[];
  deadline?: number;
}

export interface MultiHopRoute {
  hops: ConversionHop[];
  totalFees: bigint;
  estimatedTime: number;
  priceImpact: number;
}

export interface ConversionHop {
  fromToken: string;
  toToken: string;
  bridge: string;
  amount: bigint;
  expectedOutput: bigint;
}

export interface CachedRate {
  pair: string;
  rate: number;
  timestamp: number;
  ttl: number;
}