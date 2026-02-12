import { XverseBridge, XverseWallet, BridgeTransaction, BridgeFeeEstimate } from '../interfaces/bridge';
import { Address } from '../types';
/**
 * Xverse Bridge Implementation
 *
 * Integrates with Xverse Starknet bridge for BTC transfers and
 * multi-token bridge support (ETH, STRK, USDC → WBTC).
 */
export declare class XverseBridgeImpl implements XverseBridge {
    private wallet;
    private readonly network;
    private readonly bridgeApiUrl;
    constructor(network?: 'mainnet' | 'testnet');
    /**
     * Connect to Xverse wallet with improved browser detection
     */
    connectWallet(): Promise<XverseWallet>;
    /**
     * Disconnect wallet
     */
    disconnectWallet(): Promise<void>;
    /**
     * Bridge tokens to Starknet
     */
    bridgeToStarknet(token: string, amount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Bridge multiple tokens in a single transaction
     */
    bridgeMultipleTokens(tokens: Array<{
        token: string;
        amount: bigint;
    }>, starknetAddress: Address): Promise<BridgeTransaction[]>;
    /**
     * Estimate bridge fees
     */
    estimateBridgeFees(token: string, amount: bigint, destination: string): Promise<BridgeFeeEstimate>;
    /**
     * Get bridge transaction status
     */
    getBridgeStatus(bridgeId: string): Promise<BridgeTransaction>;
    /**
     * Convert ETH to WBTC via Xverse bridge
     */
    convertETHToWBTC(ethAmount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Convert STRK to WBTC via Xverse bridge
     */
    convertSTRKToWBTC(strkAmount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Convert USDC to WBTC via Xverse bridge
     */
    convertUSDCToWBTC(usdcAmount: bigint, starknetAddress: Address): Promise<BridgeTransaction>;
    /**
     * Optimize bridge fees by batching transactions
     */
    optimizeBridgeFees(tokens: Array<{
        token: string;
        amount: bigint;
    }>, starknetAddress: Address): Promise<{
        optimizedTransactions: BridgeTransaction[];
        totalSavings: bigint;
    }>;
    /**
     * Sign transaction with Xverse wallet with enhanced validation
     */
    private signTransaction;
    /**
     * Make request to Xverse bridge API with retry logic
     */
    private makeRequest;
    /**
     * Get destination token for bridge
     */
    private getDestinationToken;
    /**
     * Map Xverse status to internal status
     */
    private mapStatus;
}
/**
 * Extend window interface for Xverse providers
 */
declare global {
    interface Window {
        XverseProviders?: {
            request: (method: string, params?: any) => Promise<any>;
        };
    }
}
/**
 * Factory function to create Xverse bridge instance
 */
export declare function createXverseBridge(network?: 'mainnet' | 'testnet'): XverseBridge;
//# sourceMappingURL=xverse-bridge.d.ts.map