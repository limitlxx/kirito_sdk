import { Address, TokenId, TransactionHash, TokenMetadata, UserOperation, ValidationResult, Transaction, KiritoSDKConfig } from '../types';
import { NFTWallet, AccountAbstractionProxy } from '../interfaces';
/**
 * NFT Wallet SDK Implementation
 * Provides TypeScript implementation for NFT wallet functionality with account abstraction
 */
export declare class NFTWalletSDK implements NFTWallet {
    private config;
    private accountProxy;
    constructor(config: KiritoSDKConfig);
    /**
     * Mint a new NFT with wallet functionality
     */
    mint(recipient: Address, stakingAmount: bigint, metadata: TokenMetadata): Promise<TokenId>;
    /**
     * Mint NFT through sealed-bid auction
     */
    mintThroughAuction(auctionId: string, stakingAmount: bigint, metadata: TokenMetadata): Promise<{
        tokenId: TokenId;
        transactionHash: TransactionHash;
    }>;
    /**
     * Transfer NFT between addresses
     */
    transfer(from: Address, to: Address, tokenId: TokenId): Promise<TransactionHash>;
    /**
     * Private transfer using stealth addresses
     */
    privateTransfer(from: Address, recipientPublicKey: string, tokenId: TokenId): Promise<{
        transactionHash: TransactionHash;
        stealthAddress: Address;
        ephemeralKey: Uint8Array;
    }>;
    /**
     * Execute transaction from NFT wallet
     */
    executeTransaction(tokenId: TokenId, transaction: Transaction): Promise<TransactionHash>;
    /**
     * Get balance of specific asset in NFT wallet
     */
    getBalance(tokenId: TokenId, asset: Address): Promise<bigint>;
    /**
     * Get NFT wallet address
     */
    getWalletAddress(tokenId: TokenId): Promise<Address>;
    /**
     * Check if NFT exists
     */
    exists(tokenId: TokenId): Promise<boolean>;
    /**
     * Scan for NFTs received via stealth addresses
     */
    scanStealthTransfers(privateKey: Uint8Array, ephemeralKeys: Uint8Array[], fromBlock?: number): Promise<{
        stealthAddresses: Address[];
        potentialNFTs: TokenId[];
    }>;
    /**
     * Recover stealth address from ephemeral key
     */
    recoverStealthAddress(ephemeralPublicKey: Uint8Array, recipientPrivateKey: Uint8Array): Promise<{
        stealthAddress: Address;
        sharedSecret: Uint8Array;
    }>;
    private generateTokenId;
    private encodeMintData;
    private encodeTransferData;
    private encodeCallData;
    private getNonce;
    private executeContractCall;
    private callContractView;
}
/**
 * Account Abstraction Proxy SDK Implementation
 * Handles ERC-4337 account abstraction functionality
 */
export declare class AccountAbstractionProxySDK implements AccountAbstractionProxy {
    private config;
    constructor(config: KiritoSDKConfig);
    /**
     * Deploy wallet contract for NFT
     */
    deployWallet(tokenId: TokenId): Promise<Address>;
    /**
     * Validate user operation
     */
    validateTransaction(userOp: UserOperation): Promise<ValidationResult>;
    /**
     * Execute user operation
     */
    executeUserOperation(userOp: UserOperation): Promise<TransactionHash>;
    /**
     * Get wallet implementation address
     */
    getImplementation(): Promise<Address>;
    /**
     * Upgrade wallet implementation
     */
    upgradeImplementation(newImplementation: Address): Promise<TransactionHash>;
    private calculateWalletAddress;
    private hashTokenId;
    private isWalletDeployed;
    private encodeDeployData;
    private validateUserOperation;
    private executeContractCall;
    private callContractView;
}
//# sourceMappingURL=nft-wallet.d.ts.map