import { Address, TransactionHash } from '../types';
export interface BridgeQuote {
    fromToken: string;
    toToken: string;
    fromAmount: bigint;
    toAmount: bigint;
    estimatedFees: bigint;
    estimatedTime: number;
    slippage: number;
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
export declare enum BridgeTransactionStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    COMPLETED = "completed",
    FAILED = "failed"
}
export interface LayerSwapBridge {
    getQuote(fromToken: string, toToken: string, amount: bigint, fromChain: string, toChain: string): Promise<BridgeQuote>;
    executeBridge(quote: BridgeQuote, destinationAddress: Address, options?: BridgeOptions): Promise<BridgeTransaction>;
    getTransactionStatus(transactionId: string): Promise<BridgeTransaction>;
    getSupportedTokens(): Promise<SupportedToken[]>;
    getSupportedChains(): Promise<SupportedChain[]>;
}
export interface GardenFinanceBridge {
    wrapBTC(amount: bigint, destinationAddress: Address): Promise<BridgeTransaction>;
    unwrapWBTC(amount: bigint, btcAddress: string): Promise<BridgeTransaction>;
    createAtomicSwap(fromToken: string, toToken: string, amount: bigint, counterparty: Address): Promise<AtomicSwap>;
    getOptimalRoute(fromToken: string, toToken: string, amount: bigint): Promise<LiquidityRoute>;
}
export interface XverseBridge {
    connectWallet(): Promise<XverseWallet>;
    disconnectWallet(): Promise<void>;
    bridgeToStarknet(token: string, amount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    estimateBridgeFees(token: string, amount: bigint, destination: string): Promise<BridgeFeeEstimate>;
}
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
export declare enum AtomicSwapStatus {
    CREATED = "created",
    LOCKED = "locked",
    REDEEMED = "redeemed",
    REFUNDED = "refunded"
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
export interface TokenConversionAggregator {
    getBestRate(fromToken: string, toToken: string, amount: bigint): Promise<ConversionRate>;
    executeConversion(fromToken: string, toToken: string, amount: bigint, destinationAddress: Address, options?: ConversionOptions): Promise<BridgeTransaction>;
    getMultiHopRoute(fromToken: string, toToken: string, amount: bigint): Promise<MultiHopRoute>;
    refreshRates(): Promise<void>;
    getCachedRates(): Promise<CachedRate[]>;
    getConversionPreview(fromToken: string, toToken: string, amount: bigint, options?: ConversionOptions): Promise<{
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
    confidence: number;
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
//# sourceMappingURL=bridge.d.ts.map