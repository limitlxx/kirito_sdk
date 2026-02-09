import { Address, TokenId, TransactionHash, TokenMetadata, UserOperation, ValidationResult, Transaction } from '../types';
/**
 * NFT Wallet Interface
 * Each NFT functions as a smart wallet using account abstraction
 */
export interface NFTWallet {
    /**
     * Mint a new NFT with wallet functionality
     */
    mint(recipient: Address, stakingAmount: bigint, metadata: TokenMetadata): Promise<TokenId>;
    /**
     * Transfer NFT between addresses
     */
    transfer(from: Address, to: Address, tokenId: TokenId): Promise<TransactionHash>;
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
}
/**
 * Account Abstraction Proxy Interface
 * Handles ERC-4337 account abstraction functionality
 */
export interface AccountAbstractionProxy {
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
}
//# sourceMappingURL=nft-wallet.d.ts.map