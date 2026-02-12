"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionStateManagerSDK = exports.BidCommitmentManagerSDK = exports.SealedBidAuctionSDK = void 0;
const types_1 = require("../types");
/**
 * Sealed-Bid Auction SDK Implementation
 * Provides TypeScript implementation for sealed-bid auction functionality
 */
class SealedBidAuctionSDK {
    constructor(config) {
        this.auctions = new Map();
        this.config = config;
        this.commitmentManager = new BidCommitmentManagerSDK();
        this.stateManager = new AuctionStateManagerSDK();
    }
    /**
     * Create a new sealed-bid auction for an NFT
     */
    async createAuction(config) {
        try {
            // Validate auction configuration
            if (!this.stateManager.validateAuctionTiming(config)) {
                throw new Error('Invalid auction timing configuration');
            }
            // Generate unique auction ID
            const auctionId = this.generateAuctionId();
            // Create auction object
            const auction = {
                id: auctionId,
                config,
                state: types_1.AuctionState.CREATED,
                bids: [],
                revealedBids: [],
                createdAt: Date.now()
            };
            // Store auction
            this.auctions.set(auctionId, auction);
            // Deploy auction contract on-chain
            const txHash = await this.deployAuctionContract(auction);
            // Update auction state to commitment phase
            auction.state = types_1.AuctionState.COMMITMENT_PHASE;
            console.log(`Sealed-bid auction created: ${auctionId}, tx: ${txHash}`);
            return auctionId;
        }
        catch (error) {
            throw new Error(`Failed to create auction: ${error}`);
        }
    }
    /**
     * Submit a bid commitment during the commitment phase
     */
    async submitBidCommitment(auctionId, commitment) {
        try {
            const auction = await this.getAuction(auctionId);
            // Verify auction is in commitment phase
            if (!this.stateManager.isCommitmentPhase(auction)) {
                throw new Error('Auction is not in commitment phase');
            }
            // Validate commitment structure
            if (!commitment.commitment || !commitment.bidder || !commitment.timestamp) {
                throw new Error('Invalid bid commitment structure');
            }
            // Check for duplicate bidder
            const existingBid = auction.bids.find(bid => bid.bidder === commitment.bidder);
            if (existingBid) {
                throw new Error('Bidder has already submitted a commitment');
            }
            // Add commitment to auction
            auction.bids.push(commitment);
            // Submit commitment to blockchain
            const txHash = await this.submitCommitmentOnChain(auctionId, commitment);
            console.log(`Bid commitment submitted: ${commitment.bidId}, tx: ${txHash}`);
            return commitment.bidId;
        }
        catch (error) {
            throw new Error(`Failed to submit bid commitment: ${error}`);
        }
    }
    /**
     * Reveal a bid during the reveal phase
     */
    async revealBid(auctionId, bidId, amount, nonce) {
        try {
            const auction = await this.getAuction(auctionId);
            // Verify auction is in reveal phase
            if (!this.stateManager.isRevealPhase(auction)) {
                throw new Error('Auction is not in reveal phase');
            }
            // Find the commitment
            const commitment = auction.bids.find(bid => bid.bidId === bidId);
            if (!commitment) {
                throw new Error('Bid commitment not found');
            }
            // Verify the commitment matches the revealed values
            const isValid = await this.commitmentManager.verifyCommitment(commitment.commitment, amount, nonce, commitment.bidder);
            if (!isValid) {
                throw new Error('Bid commitment verification failed');
            }
            // Validate bid amount
            if (!this.commitmentManager.validateBidAmount(amount, auction.config.startingPrice, auction.config.reservePrice)) {
                throw new Error('Invalid bid amount');
            }
            // Create revealed bid
            const revealedBid = {
                bidId,
                amount,
                nonce,
                bidder: commitment.bidder,
                commitment: commitment.commitment,
                isRevealed: true
            };
            // Add to revealed bids
            auction.revealedBids.push(revealedBid);
            // Submit reveal to blockchain
            const txHash = await this.revealBidOnChain(auctionId, revealedBid);
            console.log(`Bid revealed: ${bidId}, amount: ${amount}, tx: ${txHash}`);
        }
        catch (error) {
            throw new Error(`Failed to reveal bid: ${error}`);
        }
    }
    /**
     * Finalize auction and determine winner
     */
    async finalizeAuction(auctionId) {
        try {
            const auction = await this.getAuction(auctionId);
            // Verify auction can be finalized
            if (auction.state === types_1.AuctionState.FINALIZED) {
                throw new Error('Auction is already finalized');
            }
            // Check if reveal phase has ended
            const currentTime = Date.now();
            if (currentTime < auction.config.revealPhaseEnd) {
                throw new Error('Reveal phase has not ended yet');
            }
            // Determine winner using winner determination algorithm
            const winner = this.determineWinner(auction);
            // Update auction state
            auction.state = types_1.AuctionState.FINALIZED;
            auction.winner = winner.bidder;
            auction.winningBid = winner.amount;
            auction.finalizedAt = currentTime;
            // Finalize on blockchain
            const txHash = await this.finalizeAuctionOnChain(auctionId, winner);
            const results = {
                auctionId,
                winner: winner.bidder,
                winningBid: winner.amount,
                totalBids: auction.bids.length,
                revealedBids: auction.revealedBids.length,
                finalizedAt: currentTime
            };
            console.log(`Auction finalized: ${auctionId}, winner: ${winner.bidder}, amount: ${winner.amount}, tx: ${txHash}`);
            return results;
        }
        catch (error) {
            throw new Error(`Failed to finalize auction: ${error}`);
        }
    }
    /**
     * Get auction details
     */
    async getAuction(auctionId) {
        const auction = this.auctions.get(auctionId);
        if (!auction) {
            throw new Error(`Auction not found: ${auctionId}`);
        }
        // Update auction state based on current time
        auction.state = this.stateManager.getCurrentPhase(auction);
        return auction;
    }
    /**
     * Get auction state
     */
    async getAuctionState(auctionId) {
        const auction = await this.getAuction(auctionId);
        return auction.state;
    }
    /**
     * Cancel auction (only during commitment phase)
     */
    async cancelAuction(auctionId) {
        try {
            const auction = await this.getAuction(auctionId);
            // Only allow cancellation during commitment phase
            if (auction.state !== types_1.AuctionState.COMMITMENT_PHASE) {
                throw new Error('Auction can only be cancelled during commitment phase');
            }
            // Update auction state
            auction.state = types_1.AuctionState.CANCELLED;
            // Cancel on blockchain
            const txHash = await this.cancelAuctionOnChain(auctionId);
            console.log(`Auction cancelled: ${auctionId}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to cancel auction: ${error}`);
        }
    }
    /**
     * Get all bids for an auction
     */
    async getAuctionBids(auctionId) {
        const auction = await this.getAuction(auctionId);
        return {
            commitments: auction.bids,
            revealedBids: auction.revealedBids
        };
    }
    // Private helper methods
    generateAuctionId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        return `auction_${timestamp}_${random}`;
    }
    determineWinner(auction) {
        if (auction.revealedBids.length === 0) {
            throw new Error('No valid bids revealed');
        }
        // Sort bids by amount (highest first)
        const sortedBids = auction.revealedBids
            .filter(bid => bid.isRevealed)
            .sort((a, b) => Number(b.amount - a.amount));
        // Check if highest bid meets reserve price
        const highestBid = sortedBids[0];
        if (auction.config.reservePrice && highestBid.amount < auction.config.reservePrice) {
            throw new Error('No bids meet the reserve price');
        }
        return highestBid;
    }
    async deployAuctionContract(auction) {
        // Real contract deployment
        try {
            const { createStarknetClient } = await Promise.resolve().then(() => __importStar(require('../utils/starknet-client')));
            const client = createStarknetClient(this.config);
            const txHash = await client.executeContractCall(this.config.network.contracts.auctionFactory || '0x0', 'deploy_auction', [
                auction.id,
                auction.config.startingPrice.toString(),
                auction.config.reservePrice?.toString() || '0',
                auction.config.commitmentPhaseEnd,
                auction.config.revealPhaseEnd
            ]);
            console.log(`Auction contract deployed: ${auction.id}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to deploy auction contract: ${error}`);
        }
    }
    async submitCommitmentOnChain(auctionId, commitment) {
        // Real commitment submission
        try {
            const { createStarknetClient } = await Promise.resolve().then(() => __importStar(require('../utils/starknet-client')));
            const client = createStarknetClient(this.config);
            const txHash = await client.executeContractCall(this.config.network.contracts.auction || '0x0', 'submit_commitment', [
                auctionId,
                commitment.bidId,
                commitment.commitment,
                commitment.bidder,
                commitment.timestamp
            ]);
            console.log(`Commitment submitted on-chain: ${commitment.bidId}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to submit commitment on-chain: ${error}`);
        }
    }
    async revealBidOnChain(auctionId, bid) {
        // Real bid reveal
        try {
            const { createStarknetClient } = await Promise.resolve().then(() => __importStar(require('../utils/starknet-client')));
            const client = createStarknetClient(this.config);
            const txHash = await client.executeContractCall(this.config.network.contracts.auction || '0x0', 'reveal_bid', [
                auctionId,
                bid.bidId,
                bid.amount.toString(),
                Array.from(bid.nonce),
                bid.bidder
            ]);
            console.log(`Bid revealed on-chain: ${bid.bidId}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to reveal bid on-chain: ${error}`);
        }
    }
    async finalizeAuctionOnChain(auctionId, winner) {
        // Real auction finalization
        try {
            const { createStarknetClient } = await Promise.resolve().then(() => __importStar(require('../utils/starknet-client')));
            const client = createStarknetClient(this.config);
            const txHash = await client.executeContractCall(this.config.network.contracts.auction || '0x0', 'finalize_auction', [
                auctionId,
                winner.bidder,
                winner.amount.toString()
            ]);
            console.log(`Auction finalized on-chain: ${auctionId}, winner: ${winner.bidder}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to finalize auction on-chain: ${error}`);
        }
    }
    async cancelAuctionOnChain(auctionId) {
        // Real auction cancellation
        try {
            const { createStarknetClient } = await Promise.resolve().then(() => __importStar(require('../utils/starknet-client')));
            const client = createStarknetClient(this.config);
            const txHash = await client.executeContractCall(this.config.network.contracts.auction || '0x0', 'cancel_auction', [auctionId]);
            console.log(`Auction cancelled on-chain: ${auctionId}, tx: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to cancel auction on-chain: ${error}`);
        }
    }
}
exports.SealedBidAuctionSDK = SealedBidAuctionSDK;
/**
 * Bid Commitment Manager SDK Implementation
 * Handles bid commitment and reveal logic
 */
class BidCommitmentManagerSDK {
    /**
     * Generate bid commitment hash
     */
    async generateCommitment(amount, nonce, bidder) {
        try {
            // Create commitment data
            const commitmentData = {
                amount: amount.toString(),
                nonce: Array.from(nonce),
                bidder
            };
            // Hash the commitment data
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(commitmentData));
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        catch (error) {
            throw new Error(`Failed to generate commitment: ${error}`);
        }
    }
    /**
     * Verify bid commitment
     */
    async verifyCommitment(commitment, amount, nonce, bidder) {
        try {
            // Generate commitment from provided values
            const expectedCommitment = await this.generateCommitment(amount, nonce, bidder);
            // Compare with provided commitment
            return commitment === expectedCommitment;
        }
        catch (error) {
            console.error(`Failed to verify commitment: ${error}`);
            return false;
        }
    }
    /**
     * Generate secure nonce for bid
     */
    async generateNonce() {
        // Generate 32 bytes of random data
        const nonce = new Uint8Array(32);
        crypto.getRandomValues(nonce);
        return nonce;
    }
    /**
     * Validate bid amount
     */
    validateBidAmount(amount, startingPrice, reservePrice) {
        // Check minimum bid amount
        if (amount < startingPrice) {
            return false;
        }
        // Check reserve price if set
        if (reservePrice && amount < reservePrice) {
            return false;
        }
        // Check for reasonable maximum (prevent overflow)
        const maxBid = BigInt('0xffffffffffffffffffffffffffffffff'); // 128-bit max
        if (amount > maxBid) {
            return false;
        }
        return true;
    }
}
exports.BidCommitmentManagerSDK = BidCommitmentManagerSDK;
/**
 * Auction State Manager SDK Implementation
 * Manages auction timing and state transitions
 */
class AuctionStateManagerSDK {
    /**
     * Check if auction is in commitment phase
     */
    isCommitmentPhase(auction) {
        const currentTime = Date.now();
        return currentTime >= auction.createdAt &&
            currentTime < auction.config.commitmentPhaseEnd &&
            auction.state !== types_1.AuctionState.CANCELLED;
    }
    /**
     * Check if auction is in reveal phase
     */
    isRevealPhase(auction) {
        const currentTime = Date.now();
        return currentTime >= auction.config.commitmentPhaseEnd &&
            currentTime < auction.config.revealPhaseEnd &&
            auction.state !== types_1.AuctionState.CANCELLED;
    }
    /**
     * Check if auction is finalized
     */
    isFinalized(auction) {
        return auction.state === types_1.AuctionState.FINALIZED;
    }
    /**
     * Get current auction phase
     */
    getCurrentPhase(auction) {
        if (auction.state === types_1.AuctionState.CANCELLED) {
            return types_1.AuctionState.CANCELLED;
        }
        if (auction.state === types_1.AuctionState.FINALIZED) {
            return types_1.AuctionState.FINALIZED;
        }
        const currentTime = Date.now();
        if (currentTime < auction.config.commitmentPhaseEnd) {
            return types_1.AuctionState.COMMITMENT_PHASE;
        }
        else if (currentTime < auction.config.revealPhaseEnd) {
            return types_1.AuctionState.REVEAL_PHASE;
        }
        else {
            return types_1.AuctionState.FINALIZED;
        }
    }
    /**
     * Validate auction timing
     */
    validateAuctionTiming(config) {
        const currentTime = Date.now();
        // Commitment phase must be in the future
        if (config.commitmentPhaseEnd <= currentTime) {
            return false;
        }
        // Reveal phase must be after commitment phase
        if (config.revealPhaseEnd <= config.commitmentPhaseEnd) {
            return false;
        }
        // Phases should have reasonable duration (at least 1 hour each)
        const minPhaseDuration = 60 * 60 * 1000; // 1 hour in milliseconds
        if (config.commitmentPhaseEnd - currentTime < minPhaseDuration) {
            return false;
        }
        if (config.revealPhaseEnd - config.commitmentPhaseEnd < minPhaseDuration) {
            return false;
        }
        return true;
    }
    /**
     * Get time remaining in current phase
     */
    getTimeRemaining(auction) {
        const currentTime = Date.now();
        const currentPhase = this.getCurrentPhase(auction);
        switch (currentPhase) {
            case types_1.AuctionState.COMMITMENT_PHASE:
                return Math.max(0, auction.config.commitmentPhaseEnd - currentTime);
            case types_1.AuctionState.REVEAL_PHASE:
                return Math.max(0, auction.config.revealPhaseEnd - currentTime);
            default:
                return 0;
        }
    }
}
exports.AuctionStateManagerSDK = AuctionStateManagerSDK;
//# sourceMappingURL=auction.js.map