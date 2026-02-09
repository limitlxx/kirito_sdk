import { Account } from 'starknet';
import { Address, TransactionHash, KiritoSDKConfig } from '../types';
/**
 * Tongo Protocol Integration
 * Provides integration with Tongo protocol for shielded transactions
 * Note: This is a simplified implementation for testing purposes
 */
export declare class TongoIntegration {
    private config;
    private starknetAccount;
    private tongoPrivateKey?;
    private tongoPublicKey?;
    constructor(config: KiritoSDKConfig, starknetAccount: Account);
    /**
     * Initialize Tongo integration with user's private key
     */
    initialize(tongoPrivateKey: string): Promise<void>;
    /**
     * Fund operation - deposit tokens into Tongo shielded pool
     */
    fund(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient?: string;
    }): Promise<TransactionHash>;
    /**
     * Transfer operation - private transfer within Tongo
     */
    transfer(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient: string;
    }): Promise<TransactionHash>;
    /**
     * Withdraw operation - withdraw tokens from Tongo back to public balance
     */
    withdraw(params: {
        tokenAddress: Address;
        amount: bigint;
        recipient?: Address;
    }): Promise<TransactionHash>;
    /**
     * Get shielded balance for the current account
     */
    getShieldedBalance(tokenAddress: Address): Promise<{
        encryptedBalance: string;
        canDecrypt: boolean;
    }>;
    /**
     * Get Tongo public key for the current account
     */
    getTongoPublicKey(): string;
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