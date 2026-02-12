import { Address, TransactionHash, AuctionId, BidId, Auction, AuctionConfig, SealedBid, BidCommitment, AuctionResults, AuctionState, KiritoSDKConfig } from '../types';
import { SealedBidAuction, BidCommitmentManager, AuctionStateManager } from '../interfaces';
/**
 * Sealed-Bid Auction SDK Implementation
 * Provides TypeScript implementation for sealed-bid auction functionality
 */
export declare class SealedBidAuctionSDK implements SealedBidAuction {
    private config;
    private commitmentManager;
    private stateManager;
    private auctions;
    constructor(config: KiritoSDKConfig);
    /**
     * Create a new sealed-bid auction for an NFT
     */
    createAuction(config: AuctionConfig): Promise<AuctionId>;
    /**
     * Submit a bid commitment during the commitment phase
     */
    submitBidCommitment(auctionId: AuctionId, commitment: BidCommitment): Promise<BidId>;
    /**
     * Reveal a bid during the reveal phase
     */
    revealBid(auctionId: AuctionId, bidId: BidId, amount: bigint, nonce: Uint8Array): Promise<void>;
    /**
     * Finalize auction and determine winner
     */
    finalizeAuction(auctionId: AuctionId): Promise<AuctionResults>;
    /**
     * Get auction details
     */
    getAuction(auctionId: AuctionId): Promise<Auction>;
    /**
     * Get auction state
     */
    getAuctionState(auctionId: AuctionId): Promise<AuctionState>;
    /**
     * Cancel auction (only during commitment phase)
     */
    cancelAuction(auctionId: AuctionId): Promise<TransactionHash>;
    /**
     * Get all bids for an auction
     */
    getAuctionBids(auctionId: AuctionId): Promise<{
        commitments: BidCommitment[];
        revealedBids: SealedBid[];
    }>;
    private generateAuctionId;
    private determineWinner;
    private deployAuctionContract;
    private submitCommitmentOnChain;
    private revealBidOnChain;
    private finalizeAuctionOnChain;
    private cancelAuctionOnChain;
}
/**
 * Bid Commitment Manager SDK Implementation
 * Handles bid commitment and reveal logic
 */
export declare class BidCommitmentManagerSDK implements BidCommitmentManager {
    /**
     * Generate bid commitment hash
     */
    generateCommitment(amount: bigint, nonce: Uint8Array, bidder: Address): Promise<string>;
    /**
     * Verify bid commitment
     */
    verifyCommitment(commitment: string, amount: bigint, nonce: Uint8Array, bidder: Address): Promise<boolean>;
    /**
     * Generate secure nonce for bid
     */
    generateNonce(): Promise<Uint8Array>;
    /**
     * Validate bid amount
     */
    validateBidAmount(amount: bigint, startingPrice: bigint, reservePrice?: bigint): boolean;
}
/**
 * Auction State Manager SDK Implementation
 * Manages auction timing and state transitions
 */
export declare class AuctionStateManagerSDK implements AuctionStateManager {
    /**
     * Check if auction is in commitment phase
     */
    isCommitmentPhase(auction: Auction): boolean;
    /**
     * Check if auction is in reveal phase
     */
    isRevealPhase(auction: Auction): boolean;
    /**
     * Check if auction is finalized
     */
    isFinalized(auction: Auction): boolean;
    /**
     * Get current auction phase
     */
    getCurrentPhase(auction: Auction): AuctionState;
    /**
     * Validate auction timing
     */
    validateAuctionTiming(config: AuctionConfig): boolean;
    /**
     * Get time remaining in current phase
     */
    getTimeRemaining(auction: Auction): number;
}
//# sourceMappingURL=auction.d.ts.map