import { Address, TokenId, TransactionHash, KiritoSDKConfig } from '../types';
/**
 * Token information for wallet operations
 */
export interface TokenInfo {
    address: Address;
    symbol: string;
    decimals: number;
    balance: bigint;
    usdValue?: number;
}
/**
 * DEX aggregator route for token swaps
 */
export interface SwapRoute {
    fromToken: Address;
    toToken: Address;
    amount: bigint;
    expectedOutput: bigint;
    priceImpact: number;
    route: Address[];
    fees: bigint;
    estimatedGas: bigint;
}
/**
 * DeFi protocol information
 */
export interface DeFiProtocol {
    name: string;
    address: Address;
    type: 'lending' | 'staking' | 'liquidity' | 'yield';
    apy: number;
    tvl: bigint;
    supported: boolean;
}
/**
 * Staking position information
 */
export interface StakingPosition {
    protocol: string;
    protocolAddress: Address;
    stakedAmount: bigint;
    rewardAmount: bigint;
    apy: number;
    lockPeriod?: number;
    unlockTime?: number;
}
/**
 * Batch transaction for multiple operations
 */
export interface BatchTransaction {
    operations: WalletOperation[];
    estimatedGas: bigint;
    totalFees: bigint;
    executionOrder: number[];
}
/**
 * Individual wallet operation
 */
export interface WalletOperation {
    type: 'transfer' | 'swap' | 'stake' | 'unstake' | 'claim';
    tokenAddress: Address;
    amount: bigint;
    target: Address;
    data?: Uint8Array;
    gasLimit: bigint;
}
/**
 * Comprehensive Wallet Functions
 *
 * Provides advanced wallet functionality including token transfers,
 * DEX integration, DeFi protocol interactions, and batch operations.
 */
export declare class ComprehensiveWallet {
    private config;
    private walletAddress;
    private tokenId;
    constructor(config: KiritoSDKConfig, walletAddress: Address, tokenId: TokenId);
    /**
     * Transfer tokens from NFT wallet
     */
    transferToken(tokenAddress: Address, recipient: Address, amount: bigint, memo?: string): Promise<TransactionHash>;
    /**
     * Swap tokens using DEX aggregator
     */
    swapTokens(fromToken: Address, toToken: Address, amount: bigint, minOutput: bigint, slippageTolerance?: number): Promise<{
        txHash: TransactionHash;
        actualOutput: bigint;
        priceImpact: number;
    }>;
    /**
     * Stake tokens in DeFi protocol
     */
    stakeTokens(protocol: DeFiProtocol, tokenAddress: Address, amount: bigint, lockPeriod?: number): Promise<{
        txHash: TransactionHash;
        stakingPosition: StakingPosition;
    }>;
    /**
     * Unstake tokens from DeFi protocol
     */
    unstakeTokens(protocol: DeFiProtocol, tokenAddress: Address, amount: bigint): Promise<{
        txHash: TransactionHash;
        unstakedAmount: bigint;
        rewardAmount: bigint;
    }>;
    /**
     * Execute batch transactions
     */
    executeBatchTransactions(operations: WalletOperation[]): Promise<{
        txHash: TransactionHash;
        results: Array<{
            success: boolean;
            result?: any;
            error?: string;
        }>;
    }>;
    /**
     * Get all token balances
     */
    getAllTokenBalances(): Promise<TokenInfo[]>;
    /**
     * Get all staking positions
     */
    getAllStakingPositions(): Promise<StakingPosition[]>;
    /**
     * Get optimal swap route from DEX aggregator
     */
    getOptimalSwapRoute(fromToken: Address, toToken: Address, amount: bigint): Promise<SwapRoute>;
    /**
     * Private helper methods
     */
    private validateAddress;
    private validateAmount;
    private validateOperation;
    private optimizeExecutionOrder;
    private getTokenBalance;
    private getSupportedTokens;
    private getTokenInfo;
    private getTokenUSDValue;
    private getStakingPosition;
    private getSupportedProtocols;
    private getAvnuRoute;
    private getFibrousRoute;
    private getEkuboRoute;
    private encodeTransferData;
    private encodeSwapData;
    private encodeStakeData;
    private encodeUnstakeData;
    private encodeBatchData;
    private executeWalletTransaction;
    private callWalletView;
}
/**
 * Factory function to create comprehensive wallet
 */
export declare function createComprehensiveWallet(config: KiritoSDKConfig, walletAddress: Address, tokenId: TokenId): ComprehensiveWallet;
//# sourceMappingURL=comprehensive-wallet.d.ts.map