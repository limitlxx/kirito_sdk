/**
 * Atomiq Cross-Chain Swap Integration
 *
 * Official SDK integration for trustless Bitcoin ↔ Starknet atomic swaps.
 * Uses @atomiqlabs/sdk for HTLC-based cross-chain swaps.
 *
 * Documentation: https://www.npmjs.com/package/@atomiqlabs/sdk
 *
 * Key Features:
 * - Bitcoin L1 ↔ Starknet swaps
 * - Atomic swap security with HTLC
 * - Automatic settlement with manual fallback
 * - Swap state tracking and monitoring
 */
import { Address, TransactionHash } from '../types';
interface BitcoinWallet {
    address: string;
    publicKey: string;
    signPsbt: (psbt: {
        psbt: any;
        psbtHex: string;
        psbtBase64: string;
    }, signInputs: number[]) => Promise<string>;
}
declare enum SwapState {
    CREATED = "CREATED",
    COMMITED = "COMMITED",
    CLAIMED = "CLAIMED",
    REFUNDED = "REFUNDED",
    FAILED = "FAILED"
}
interface SwapLimits {
    input: {
        min: bigint | null;
        max: bigint | null;
    };
    output: {
        min: bigint | null;
        max: bigint | null;
    };
}
/**
 * Atomiq swap result with tracking information
 */
export interface AtomiqSwapResult {
    swapId: string;
    fromToken: string;
    toToken: string;
    inputAmount: bigint;
    outputAmount: bigint;
    fee: bigint;
    state: SwapState;
    btcTxId?: string;
    starknetTxId?: string;
    expiryTime: number;
}
/**
 * Atomiq Integration for Bitcoin ↔ Starknet Swaps
 *
 * Provides trustless cross-chain atomic swaps using HTLC.
 */
export declare class AtomiqIntegration {
    private swapper;
    private readonly network;
    private readonly starknetRpcUrl;
    private readonly storageBasePath;
    private initialized;
    constructor(network: "mainnet" | "testnet" | undefined, starknetRpcUrl: string, storageBasePath?: string);
    /**
     * Initialize Atomiq swapper with Starknet support
     *
     * Must be called before any swap operations.
     */
    initialize(): Promise<void>;
    /**
     * Swap Bitcoin to Starknet token
     *
     * @param amount - Amount in satoshis (for BTC)
     * @param destinationToken - Starknet token address
     * @param destinationAddress - Starknet recipient address
     * @param btcWallet - Bitcoin wallet for signing
     * @param exactIn - If true, amount is input; if false, amount is output
     */
    swapBTCToStarknet(amount: bigint, destinationToken: Address, destinationAddress: Address, btcWallet: BitcoinWallet, exactIn?: boolean): Promise<AtomiqSwapResult>;
    /**
     * Swap Starknet token to Bitcoin
     *
     * @param amount - Amount in token units
     * @param sourceToken - Starknet token address
     * @param btcAddress - Bitcoin recipient address
     * @param starknetWallet - Starknet wallet for signing
     * @param exactIn - If true, amount is input; if false, amount is output
     */
    swapStarknetToBTC(amount: bigint, sourceToken: Address, btcAddress: string, starknetWallet: any, exactIn?: boolean): Promise<AtomiqSwapResult>;
    /**
     * Get swap limits for a token pair
     */
    getSwapLimits(fromToken: string, toToken: string): Promise<SwapLimits>;
    /**
     * Get swap status by ID
     */
    getSwapStatus(swapId: string): Promise<AtomiqSwapResult | null>;
    /**
     * Get all refundable swaps (expired or failed)
     */
    getRefundableSwaps(): Promise<AtomiqSwapResult[]>;
    /**
     * Get all claimable swaps (completed while offline)
     */
    getClaimableSwaps(): Promise<AtomiqSwapResult[]>;
    /**
     * Refund an expired or failed swap
     */
    refundSwap(swapId: string): Promise<TransactionHash>;
    private ensureInitialized;
    private getStarknetToken;
}
/**
 * Factory function to create Atomiq integration instance
 */
export declare function createAtomiqIntegration(network: "mainnet" | "testnet" | undefined, starknetRpcUrl: string, storageBasePath?: string): AtomiqIntegration;
/**
 * Helper to create Bitcoin wallet interface for Atomiq
 */
export declare function createBitcoinWallet(address: string, publicKey: string, signPsbtFn: (psbtHex: string, signInputs: number[]) => Promise<string>): BitcoinWallet;
export {};
//# sourceMappingURL=atomiq-integration.d.ts.map