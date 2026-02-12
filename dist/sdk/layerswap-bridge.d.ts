import { LayerSwapBridge, BridgeQuote, BridgeTransaction, BridgeOptions, SupportedToken, SupportedChain } from '../interfaces/bridge';
import { Address } from '../types';
/**
 * LayerSwap Bridge Implementation
 *
 * Integrates with LayerSwap API for cross-chain BTC transfers to Starknet
 * and Starknet native token to WBTC conversions.
 */
export declare class LayerSwapBridgeImpl implements LayerSwapBridge {
    private readonly apiUrl;
    private readonly apiKey?;
    private readonly network;
    constructor(network?: 'mainnet' | 'testnet', apiKey?: string);
    /**
     * Get quote for cross-chain swap
     */
    getQuote(fromToken: string, toToken: string, amount: bigint, fromChain: string, toChain: string): Promise<BridgeQuote>;
    /**
     * Execute bridge transaction
     */
    executeBridge(quote: BridgeQuote, destinationAddress: Address, options?: BridgeOptions): Promise<BridgeTransaction>;
    /**
     * Get transaction status
     */
    getTransactionStatus(transactionId: string): Promise<BridgeTransaction>;
    /**
     * Get supported tokens
     */
    getSupportedTokens(): Promise<SupportedToken[]>;
    /**
     * Get supported chains
     */
    getSupportedChains(): Promise<SupportedChain[]>;
    /**
     * Convert BTC to WBTC during minting
     */
    convertBTCToWBTC(btcAmount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Convert Starknet native tokens to WBTC
     */
    convertStarknetTokenToWBTC(token: 'ETH' | 'STRK' | 'USDC', amount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Monitor bridge transaction until completion
     */
    monitorTransaction(transactionId: string, onUpdate?: (transaction: BridgeTransaction) => void): Promise<BridgeTransaction>;
    /**
     * Make authenticated request to LayerSwap API
     */
    private makeRequest;
    /**
     * Map LayerSwap status to internal status
     */
    private mapStatus;
}
/**
 * Factory function to create LayerSwap bridge instance
 */
export declare function createLayerSwapBridge(network?: 'mainnet' | 'testnet', apiKey?: string): LayerSwapBridge;
//# sourceMappingURL=layerswap-bridge.d.ts.map