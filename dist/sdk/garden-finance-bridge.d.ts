import { GardenFinanceBridge, BridgeTransaction, AtomicSwap, LiquidityRoute } from '../interfaces/bridge';
import { Address, TransactionHash } from '../types';
/**
 * Garden Finance Bridge Implementation
 *
 * Integrates with Garden Finance for Bitcoin DeFi operations,
 * BTC wrapping/unwrapping, and atomic swaps.
 */
export declare class GardenFinanceBridgeImpl implements GardenFinanceBridge {
    private readonly apiUrl;
    private readonly network;
    private readonly apiKey?;
    constructor(network?: 'mainnet' | 'testnet', apiKey?: string);
    /**
     * Wrap BTC to WBTC with transaction confirmation monitoring
     */
    wrapBTC(amount: bigint, destinationAddress: Address): Promise<BridgeTransaction>;
    /**
     * Unwrap WBTC to BTC with transaction confirmation monitoring
     */
    unwrapWBTC(amount: bigint, btcAddress: string): Promise<BridgeTransaction>;
    /**
     * Create atomic swap between Starknet tokens and BTC/WBTC with secure secret generation
     */
    createAtomicSwap(fromToken: string, toToken: string, amount: bigint, counterparty: Address): Promise<AtomicSwap>;
    /**
     * Get optimal liquidity route for token conversion
     */
    getOptimalRoute(fromToken: string, toToken: string, amount: bigint): Promise<LiquidityRoute>;
    /**
     * Execute atomic swap with optimal routing
     */
    executeAtomicSwapWithRouting(fromToken: string, toToken: string, amount: bigint, destinationAddress: Address): Promise<BridgeTransaction>;
    /**
     * Lock funds for atomic swap
     */
    lockSwapFunds(swapId: string, secret: string): Promise<TransactionHash>;
    /**
     * Redeem atomic swap
     */
    redeemSwap(swapId: string, secret: string): Promise<TransactionHash>;
    /**
     * Refund atomic swap (if expired)
     */
    refundSwap(swapId: string): Promise<TransactionHash>;
    /**
     * Get swap status
     */
    getSwapStatus(swapId: string): Promise<AtomicSwap>;
    /**
     * Make authenticated request to Garden Finance API
     */
    private makeRequest;
    /**
     * Generate cryptographically secure random secret for atomic swap
     */
    private generateSecureSecret;
    /**
     * Monitor transaction confirmations until completion
     */
    private monitorTransactionConfirmations;
    /**
     * Hash secret using SHA-256
     */
    private hashSecret;
    /**
     * Map Garden Finance status to internal status
     */
    private mapStatus;
    /**
     * Map Garden Finance swap status to internal swap status
     */
    private mapSwapStatus;
    /**
     * Get chain name for token
     */
    private getChainForToken;
    /**
     * Get required confirmations for token
     */
    private getRequiredConfirmations;
}
/**
 * Factory function to create Garden Finance bridge instance
 */
export declare function createGardenFinanceBridge(network?: 'mainnet' | 'testnet', apiKey?: string): GardenFinanceBridge;
//# sourceMappingURL=garden-finance-bridge.d.ts.map