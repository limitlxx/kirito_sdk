/**
 * Xverse Wallet Integration
 *
 * Official Sats Connect integration for Bitcoin wallet operations.
 * Provides wallet connection, transaction signing, and Bitcoin data access.
 *
 * Documentation:
 * - Sats Connect: https://docs.xverse.app/sats-connect
 * - Xverse API: https://docs.xverse.app/api
 *
 * Key Features:
 * - Wallet connection via Sats Connect
 * - Bitcoin transaction signing
 * - Ordinals and Runes support
 * - Bitcoin balance and transaction queries
 */
interface SignTransactionResponse {
    hex: string;
    txId?: string;
}
interface SignMessageResponse {
    signature: string;
    address: string;
}
/**
 * Xverse wallet information
 */
export interface XverseWallet {
    paymentAddress: string;
    paymentPublicKey: string;
    ordinalsAddress?: string;
    ordinalsPublicKey?: string;
    stacksAddress?: string;
    network: 'mainnet' | 'testnet';
}
/**
 * Bitcoin balance information
 */
export interface BitcoinBalance {
    confirmed: bigint;
    unconfirmed: bigint;
    total: bigint;
}
/**
 * Bitcoin transaction information
 */
export interface BitcoinTransaction {
    txid: string;
    blockHeight?: number;
    timestamp?: number;
    fee: bigint;
    inputs: Array<{
        address: string;
        value: bigint;
    }>;
    outputs: Array<{
        address: string;
        value: bigint;
    }>;
}
/**
 * Ordinal inscription information
 */
export interface OrdinalInscription {
    id: string;
    number: number;
    address: string;
    contentType: string;
    contentLength: number;
    timestamp: number;
}
/**
 * Rune balance information
 */
export interface RuneBalance {
    rune: string;
    runeId: string;
    amount: bigint;
    symbol: string;
    divisibility: number;
}
/**
 * Xverse Wallet Integration
 *
 * Provides Bitcoin wallet operations using Sats Connect and Xverse API.
 */
export declare class XverseWalletIntegration {
    private wallet;
    private readonly network;
    private readonly apiBaseUrl;
    private readonly apiKey?;
    constructor(network?: 'mainnet' | 'testnet', apiKey?: string);
    /**
     * Connect to Xverse wallet using Sats Connect
     */
    connectWallet(): Promise<XverseWallet>;
    /**
     * Disconnect wallet
     */
    disconnectWallet(): Promise<void>;
    /**
     * Get connected wallet info
     */
    getWallet(): XverseWallet | null;
    /**
     * Sign a Bitcoin transaction
     *
     * @param psbtHex - PSBT in hex format
     * @param inputsToSign - Inputs to sign with their indexes
     * @param broadcast - Whether to broadcast after signing
     */
    signTransaction(psbtHex: string, inputsToSign: Array<{
        address: string;
        signingIndexes: number[];
    }>, broadcast?: boolean): Promise<SignTransactionResponse>;
    /**
     * Sign a message with Bitcoin address
     */
    signMessage(message: string, address?: string): Promise<SignMessageResponse>;
    /**
     * Get Bitcoin balance for connected wallet
     */
    getBitcoinBalance(address?: string): Promise<BitcoinBalance>;
    /**
     * Get Bitcoin transactions for address
     */
    getBitcoinTransactions(address?: string, limit?: number): Promise<BitcoinTransaction[]>;
    /**
     * Get Ordinals inscriptions for address
     */
    getOrdinals(address?: string, limit?: number): Promise<OrdinalInscription[]>;
    /**
     * Get Runes balances for address
     */
    getRunes(address?: string): Promise<RuneBalance[]>;
    /**
     * Get transaction details by txid
     */
    getTransaction(txid: string): Promise<BitcoinTransaction>;
    /**
     * Make authenticated request to Xverse API
     */
    private makeApiRequest;
}
/**
 * Factory function to create Xverse wallet integration
 */
export declare function createXverseWallet(network?: 'mainnet' | 'testnet', apiKey?: string): XverseWalletIntegration;
export {};
//# sourceMappingURL=xverse-wallet.d.ts.map