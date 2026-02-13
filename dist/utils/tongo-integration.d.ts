import { Account } from 'starknet';
import { Address, TransactionHash, KiritoSDKConfig } from '../types';
/**
 * Tongo Protocol Integration
 * Real implementation for shielded transactions using ElGamal encryption
 * Based on Tongo protocol specifications from tongo.cash
 */
export declare class TongoIntegration {
    private config;
    private starknetAccount;
    private tongoPrivateKey?;
    private tongoPublicKey?;
    private tongoContract?;
    private encryptionKey?;
    constructor(config: KiritoSDKConfig, starknetAccount: Account);
    /**
     * Initialize Tongo integration with user's private key
     * Sets up ElGamal encryption and connects to Tongo contract
     */
    initialize(tongoPrivateKey: string): Promise<void>;
    /**
     * Fund operation - deposit tokens into Tongo shielded pool
     * Uses real ElGamal encryption and Tongo contract calls
     */
    fund(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient?: string;
    }): Promise<TransactionHash>;
    /**
     * Transfer operation - private transfer within Tongo
     * Uses zero-knowledge proofs to hide transfer amounts
     */
    transfer(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient: string;
    }): Promise<TransactionHash>;
    /**
     * Withdraw operation - withdraw tokens from Tongo back to public balance
     * Requires proof of ownership and nullifier to prevent double-spending
     */
    withdraw(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient?: Address;
    }): Promise<TransactionHash>;
    /**
     * Get shielded balance for the current account
     * Queries encrypted balance from Tongo contract and attempts decryption
     */
    getShieldedBalance(tokenAddress: Address): Promise<{
        encryptedBalance: string;
        canDecrypt: boolean;
        decryptedAmount?: bigint;
    }>;
    /**
     * Get Tongo public key for the current account
     */
    getTongoPublicKey(): Uint8Array;
    /**
     * Get Tongo public key as hex string
     */
    getTongoPublicKeyHex(): string;
    /**
     * Generate stealth address for private NFT transfers
     */
    generateStealthAddress(recipientPublicKey: string): Promise<{
        stealthAddress: Address;
        ephemeralPrivateKey: Uint8Array;
        sharedSecret: Uint8Array;
    }>;
    /**
     * Scan for stealth addresses belonging to a private key
     */
    scanStealthAddresses(privateKey: Uint8Array, ephemeralKeys: Uint8Array[]): Promise<Address[]>;
    /**
     * Initialize Tongo contract connection with real contract
     */
    private initializeTongoContract;
    /**
     * Load Tongo contract ABI
     */
    private loadTongoAbi;
    /**
     * Verify Tongo contract connection
     */
    private verifyTongoContract;
    /**
     * Generate public key from private key using elliptic curve operations
     */
    private generatePublicKey;
    /**
     * Initialize encryption key for ElGamal operations
     */
    private initializeEncryptionKey;
    /**
     * Encrypt amount using ElGamal encryption
     */
    private encryptAmount;
    /**
     * Encrypt amount for specific recipient
     */
    private encryptAmountForRecipient;
    /**
     * Decrypt amount using private key
     */
    private decryptAmount;
    /**
     * Generate commitment for deposit/transfer
     */
    private generateCommitment;
    /**
     * Generate nullifier to prevent double-spending
     */
    private generateNullifier;
    /**
     * Generate zero-knowledge proof for transfer using real ZK library
     */
    private generateTransferProof;
    /**
     * Generate Pedersen commitment as fallback
     */
    private generatePedersenCommitment;
    /**
     * Generate zero-knowledge proof for withdrawal using real ZK library
     */
    private generateWithdrawalProof;
    /**
     * Generate signature-based proof as fallback
     */
    private generateSignatureProof;
    /**
     * Generate shared secret with recipient using ECDH
     */
    private generateSharedSecret;
    /**
     * Convert hex string to Uint8Array
     */
    private hexToUint8Array;
    /**
     * Query all encrypted balances for the current account
     */
    queryAllBalances(): Promise<Map<Address, {
        encryptedBalance: string;
        canDecrypt: boolean;
        decryptedAmount?: bigint;
    }>>;
    /**
     * Generate proof of balance ownership without revealing the amount
     */
    generateBalanceProof(tokenAddress: Address, minimumAmount?: bigint): Promise<{
        proof: Uint8Array;
        publicInputs: Uint8Array[];
        canProveOwnership: boolean;
    }>;
    /**
     * Verify balance proof without revealing the actual balance
     */
    verifyBalanceProof(proof: Uint8Array, publicInputs: Uint8Array[], ownerPublicKey: string, tokenAddress: Address): Promise<boolean>;
    /**
     * Verify proof format and structure
     */
    private verifyProofFormat;
    /**
     * Generate proof of transaction history without revealing amounts
     */
    generateTransactionHistoryProof(tokenAddress: Address, fromTimestamp: number, toTimestamp: number): Promise<{
        proof: Uint8Array;
        transactionCount: number;
        totalVolume?: bigint;
    }>;
    /**
     * Get encrypted balance display data for UI
     */
    getEncryptedBalanceDisplay(tokenAddress: Address): Promise<{
        hasBalance: boolean;
        encryptedDisplay: string;
        canDecrypt: boolean;
        decryptedDisplay?: string;
        lastUpdated: number;
    }>;
    /**
     * Generate viewing key for balance auditing
     */
    generateViewingKey(tokenAddress: Address): Promise<{
        viewingKey: string;
        expiresAt?: number;
    }>;
    /**
     * Use viewing key to inspect balance (for auditing)
     */
    inspectBalanceWithViewingKey(viewingKey: string, tokenAddress: Address, ownerPublicKey: string): Promise<{
        canView: boolean;
        encryptedBalance?: string;
        balanceRange?: {
            min: bigint;
            max: bigint;
        };
    }>;
    /**
     * Format encrypted balance for display
     */
    private formatEncryptedBalance;
    /**
     * Format decrypted balance for display
     */
    private formatDecryptedBalance;
    /**
     * Convert BigInt to Uint8Array
     */
    private bigIntToUint8Array;
    /**
     * Verify viewing key validity
     */
    private verifyViewingKey;
}
/**
 * Stealth Address Generation utilities
 * Provides stealth address generation for private transfers
 */
export declare class StealthAddressGenerator {
    /**
     * Generate stealth address for recipient
     */
    static generateStealthAddress(recipientPublicKey: string): Promise<{
        stealthAddress: Address;
        ephemeralPrivateKey: Uint8Array;
        sharedSecret: Uint8Array;
    }>;
    /**
     * Recover stealth address from ephemeral key
     */
    static recoverStealthAddress(ephemeralPublicKey: Uint8Array, recipientPrivateKey: Uint8Array): Promise<{
        stealthAddress: Address;
        sharedSecret: Uint8Array;
    }>;
    /**
     * Scan for stealth addresses belonging to a private key
     */
    static scanStealthAddresses(privateKey: Uint8Array, ephemeralKeys: Uint8Array[]): Promise<Address[]>;
}
//# sourceMappingURL=tongo-integration.d.ts.map