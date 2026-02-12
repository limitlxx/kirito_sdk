/**
 * Wallet Compatibility Layer
 *
 * Provides unified interface for connecting to multiple wallet providers:
 * - Xverse (Bitcoin wallet with Starknet bridge support)
 * - Argent X (Starknet native wallet)
 * - Braavos (Starknet native wallet)
 */
import { Address, TransactionHash } from '../types';
import { Account } from 'starknet';
/**
 * Supported wallet types
 */
export declare enum WalletType {
    XVERSE = "xverse",
    ARGENT_X = "argentX",
    BRAAVOS = "braavos",
    UNKNOWN = "unknown"
}
/**
 * Wallet connection status
 */
export declare enum ConnectionStatus {
    DISCONNECTED = "disconnected",
    CONNECTING = "connecting",
    CONNECTED = "connected",
    ERROR = "error"
}
/**
 * Wallet information
 */
export interface WalletInfo {
    type: WalletType;
    name: string;
    icon?: string;
    address?: Address;
    publicKey?: string;
    isInstalled: boolean;
    isConnected: boolean;
    chainId?: string;
}
/**
 * Wallet connection result
 */
export interface WalletConnectionResult {
    success: boolean;
    walletType: WalletType;
    address?: Address;
    account?: Account;
    error?: string;
}
/**
 * Transaction request
 */
export interface TransactionRequest {
    contractAddress: Address;
    entrypoint: string;
    calldata: string[];
}
/**
 * Wallet event types
 */
export type WalletEvent = 'accountsChanged' | 'networkChanged' | 'disconnect' | 'connect';
/**
 * Wallet event handler
 */
export type WalletEventHandler = (data: any) => void;
/**
 * Unified Wallet Connector
 *
 * Provides a single interface for connecting to and interacting with
 * multiple wallet providers on Starknet.
 */
export declare class WalletConnector {
    private provider;
    private connectedWallet?;
    private connectedAccount?;
    private connectedAddress?;
    private connectionStatus;
    private eventHandlers;
    constructor(rpcUrl: string);
    /**
     * Detect available wallets
     */
    detectWallets(): Promise<WalletInfo[]>;
    /**
     * Connect to a specific wallet
     */
    connect(walletType: WalletType): Promise<WalletConnectionResult>;
    /**
     * Disconnect from current wallet
     */
    disconnect(): Promise<void>;
    /**
     * Get connected wallet info
     */
    getConnectedWallet(): WalletInfo | null;
    /**
     * Get connected account
     */
    getAccount(): Account | undefined;
    /**
     * Get connection status
     */
    getStatus(): ConnectionStatus;
    /**
     * Check if wallet is connected
     */
    isConnected(): boolean;
    /**
     * Execute transaction through connected wallet
     */
    executeTransaction(request: TransactionRequest): Promise<TransactionHash>;
    /**
     * Sign message with connected wallet
     */
    signMessage(message: string): Promise<string[]>;
    /**
     * Switch network
     */
    switchNetwork(chainId: string): Promise<boolean>;
    /**
     * Add event listener
     */
    on(event: WalletEvent, handler: WalletEventHandler): void;
    /**
     * Remove event listener
     */
    off(event: WalletEvent, handler: WalletEventHandler): void;
    /**
     * Private helper methods
     */
    private detectArgentX;
    private detectBraavos;
    private detectXverse;
    private connectArgentX;
    private connectBraavos;
    private connectXverse;
    private getWalletName;
    private initializeEventHandlers;
    private emit;
}
/**
 * Factory function to create wallet connector
 */
export declare function createWalletConnector(rpcUrl: string): WalletConnector;
/**
 * Utility function to get recommended wallet for user
 */
export declare function getRecommendedWallet(): Promise<WalletType>;
//# sourceMappingURL=wallet-connector.d.ts.map