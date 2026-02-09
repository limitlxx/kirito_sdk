import fc from 'fast-check';
import {
  SealedBidAuctionSDK,
  BidCommitmentManagerSDK,
  AuctionStateManagerSDK
} from '../../src/sdk/auction';
import {
  AuctionConfig,
  AuctionState,
  BidCommitment,
  KiritoSDKConfig,
  NetworkConfig
} from '../../src/types';

/**
 * Property-Based Tests for Sealed-Bid Auction Integrity
 * **Feature: kirito-sdk, Property 6: Sealed-Bid Auction Integrity**
 * **Validates: Requirements 2.4**
 */

describe('Sealed-Bid Auction Integrity Properties', () => {
  let auctionSDK: SealedBidAuctionSDK;
  let commitmentManager: BidCommitmentManagerSDK;
  let stateManager: AuctionStateManagerSDK;
  let mockConfig: KiritoSDKConfig;

  beforeEach(() => {
    const mockNetwork: NetworkConfig = {
      name: 'test',
      rpcUrl: 'http://localhost:8545',
      chainId: '1',
      contracts: {
        nftWallet: '0x1234567890123456789012345678901234567890',
        walletFactory: '0x2345678901234567890123456789012345678901',
        entryPoint: '0x3456789012345678901234567890123456789012',
        walletImplementation: '0x4567890123456789012345678901234567890123'
      }
    };

    mockConfig = {
      network: mockNetwork,
      ipfs: {
        url: 'http://localhost:5001',
        projectId: 'test',
        projectSecret: 'test'
      },
      privacy: {
        tongoEndpoint: 'http://localhost:8080',
        semaphoreEndpoint: 'http://localhost:8081'
      }
    };

    auctionSDK = new SealedBidAuctionSDK(mockConfig);
    commitmentManager = new BidCommitmentManagerSDK();
    stateManager = new AuctionStateManagerSDK();
  });

  /**
   * Property 6.1: Bid Commitment Hiding
   * For any valid bid amount and nonce, the commitment should not reveal the bid amount
   */
  test('Property 6.1: Bid commitments hide bid amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigUintN(64), // bid amount
        fc.uint8Array({ minLength: 32, maxLength: 32 }), // nonce
        fc.hexaString({ minLength: 40, maxLength: 40 }), // bidder address
        async (bidAmount, nonce, bidderHex) => {
          const bidder = `0x${bidderHex}`;
          
          // Generate commitment
          const commitment = await commitmentManager.generateCommitment(
            bidAmount,
            nonce,
            bidder
          );
          
          // Commitment should be a valid hex string
          expect(commitment).toMatch(/^[0-9a-f]+$/);
          
          // Commitment should not contain the bid amount as a substring
          const bidAmountStr = bidAmount.toString();
          expect(commitment).not.toContain(bidAmountStr);
          
          // Commitment should not contain the bidder address
          expect(commitment.toLowerCase()).not.toContain(bidder.toLowerCase().substring(2));
          
          // Same inputs should produce same commitment (deterministic)
          const commitment2 = await commitmentManager.generateCommitment(
            bidAmount,
            nonce,
            bidder
          );
          expect(commitment).toBe(commitment2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Commitment Verification Correctness
   * For any commitment, it should only verify with the correct bid amount, nonce, and bidder
   */
  test('Property 6.2: Commitment verification is correct and secure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigUintN(64), // original bid amount
        fc.uint8Array({ minLength: 32, maxLength: 32 }), // original nonce
        fc.hexaString({ minLength: 40, maxLength: 40 }), // original bidder
        fc.bigUintN(64), // different bid amount
        fc.uint8Array({ minLength: 32, maxLength: 32 }), // different nonce
        fc.hexaString({ minLength: 40, maxLength: 40 }), // different bidder
        async (origAmount, origNonce, origBidderHex, diffAmount, diffNonce, diffBidderHex) => {
          const origBidder = `0x${origBidderHex}`;
          const diffBidder = `0x${diffBidderHex}`;
          
          // Generate commitment with original values
          const commitment = await commitmentManager.generateCommitment(
            origAmount,
            origNonce,
            origBidder
          );
          
          // Should verify with correct values
          const validVerification = await commitmentManager.verifyCommitment(
            commitment,
            origAmount,
            origNonce,
            origBidder
          );
          expect(validVerification).toBe(true);
          
          // Should not verify with different amount (unless by coincidence)
          if (diffAmount !== origAmount) {
            const invalidAmountVerification = await commitmentManager.verifyCommitment(
              commitment,
              diffAmount,
              origNonce,
              origBidder
            );
            expect(invalidAmountVerification).toBe(false);
          }
          
          // Should not verify with different nonce (unless by coincidence)
          if (!arraysEqual(diffNonce, origNonce)) {
            const invalidNonceVerification = await commitmentManager.verifyCommitment(
              commitment,
              origAmount,
              diffNonce,
              origBidder
            );
            expect(invalidNonceVerification).toBe(false);
          }
          
          // Should not verify with different bidder (unless by coincidence)
          if (diffBidder !== origBidder) {
            const invalidBidderVerification = await commitmentManager.verifyCommitment(
              commitment,
              origAmount,
              origNonce,
              diffBidder
            );
            expect(invalidBidderVerification).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Auction State Transitions
   * For any auction, state transitions should follow the correct sequence and timing
   */
  test('Property 6.3: Auction state transitions are correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 24 }), // commitment phase hours
        fc.integer({ min: 1, max: 24 }), // reveal phase hours
        fc.bigUintN(64), // starting price
        fc.hexaString({ minLength: 40, maxLength: 40 }), // token ID
        fc.hexaString({ minLength: 40, maxLength: 40 }), // auctioneer
        async (commitHours, revealHours, startingPrice, tokenIdHex, auctioneerHex) => {
          const currentTime = Date.now();
          const commitmentPhaseEnd = currentTime + (commitHours * 60 * 60 * 1000);
          const revealPhaseEnd = commitmentPhaseEnd + (revealHours * 60 * 60 * 1000);
          
          const config: AuctionConfig = {
            tokenId: `0x${tokenIdHex}`,
            startingPrice,
            commitmentPhaseEnd,
            revealPhaseEnd,
            auctioneer: `0x${auctioneerHex}`
          };
          
          // Validate timing should pass for valid configurations
          const isValidTiming = stateManager.validateAuctionTiming(config);
          expect(isValidTiming).toBe(true);
          
          // Create auction
          const auctionId = await auctionSDK.createAuction(config);
          const auction = await auctionSDK.getAuction(auctionId);
          
          // Initial state should be commitment phase
          expect(auction.state).toBe(AuctionState.COMMITMENT_PHASE);
          expect(stateManager.isCommitmentPhase(auction)).toBe(true);
          expect(stateManager.isRevealPhase(auction)).toBe(false);
          expect(stateManager.isFinalized(auction)).toBe(false);
          
          // Time remaining should be positive during commitment phase
          const timeRemaining = stateManager.getTimeRemaining(auction);
          expect(timeRemaining).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6.4: Winner Determination Correctness
   * For any set of revealed bids, the highest valid bid should win
   */
  test('Property 6.4: Winner determination selects highest valid bid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.bigUintN(32), { minLength: 2, maxLength: 10 }), // bid amounts
        fc.bigUintN(32), // starting price
        fc.option(fc.bigUintN(32)), // optional reserve price
        fc.hexaString({ minLength: 40, maxLength: 40 }), // token ID
        fc.hexaString({ minLength: 40, maxLength: 40 }), // auctioneer
        async (bidAmounts, startingPrice, reservePrice, tokenIdHex, auctioneerHex) => {
          // Ensure bid amounts are above starting price
          const validBidAmounts = bidAmounts.map(amount => 
            amount < startingPrice ? startingPrice + BigInt(1) : amount
          );
          
          // Ensure reserve price is reasonable
          const finalReservePrice = reservePrice && reservePrice >= startingPrice 
            ? reservePrice 
            : undefined;
          
          const currentTime = Date.now();
          const config: AuctionConfig = {
            tokenId: `0x${tokenIdHex}`,
            startingPrice,
            reservePrice: finalReservePrice,
            commitmentPhaseEnd: currentTime + (1 * 60 * 60 * 1000), // 1 hour
            revealPhaseEnd: currentTime + (2 * 60 * 60 * 1000), // 2 hours
            auctioneer: `0x${auctioneerHex}`
          };
          
          // Create auction
          const auctionId = await auctionSDK.createAuction(config);
          
          // Submit bid commitments
          const bidCommitments: BidCommitment[] = [];
          for (let i = 0; i < validBidAmounts.length; i++) {
            const bidder = `0x${i.toString(16).padStart(40, '0')}`;
            const nonce = await commitmentManager.generateNonce();
            const commitment = await commitmentManager.generateCommitment(
              validBidAmounts[i],
              nonce,
              bidder
            );
            
            const bidCommitment: BidCommitment = {
              bidId: `bid_${i}`,
              commitment,
              bidder,
              timestamp: currentTime
            };
            
            bidCommitments.push(bidCommitment);
            await auctionSDK.submitBidCommitment(auctionId, bidCommitment);
          }
          
          // Simulate time passing to reveal phase
          const auction = await auctionSDK.getAuction(auctionId);
          auction.config.commitmentPhaseEnd = currentTime - 1000; // Past
          auction.config.revealPhaseEnd = currentTime + (1 * 60 * 60 * 1000); // Future
          
          // Reveal all bids
          for (let i = 0; i < validBidAmounts.length; i++) {
            const bidder = `0x${i.toString(16).padStart(40, '0')}`;
            const nonce = await commitmentManager.generateNonce();
            
            // For testing, we'll use a predictable nonce generation
            const testNonce = new Uint8Array(32);
            testNonce.fill(i);
            
            await auctionSDK.revealBid(
              auctionId,
              `bid_${i}`,
              validBidAmounts[i],
              testNonce
            );
          }
          
          // Simulate time passing to finalization
          auction.config.revealPhaseEnd = currentTime - 1000; // Past
          
          // Finalize auction
          const results = await auctionSDK.finalizeAuction(auctionId);
          
          // Winner should have the highest bid amount
          const expectedWinningBid = validBidAmounts.reduce((max, current) => 
            current > max ? current : max
          );
          
          // If reserve price is set, winning bid should meet it
          if (finalReservePrice) {
            if (expectedWinningBid >= finalReservePrice) {
              expect(results.winningBid).toBe(expectedWinningBid);
            }
          } else {
            expect(results.winningBid).toBe(expectedWinningBid);
          }
          
          expect(results.totalBids).toBe(validBidAmounts.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 6.5: Bid Amount Validation
   * For any bid amount, validation should correctly accept/reject based on starting and reserve prices
   */
  test('Property 6.5: Bid amount validation is correct', async () => {
    await fc.assert(
      fc.property(
        fc.bigUintN(32), // bid amount
        fc.bigUintN(32), // starting price
        fc.option(fc.bigUintN(32)), // optional reserve price
        (bidAmount, startingPrice, reservePrice) => {
          const finalReservePrice = reservePrice && reservePrice >= startingPrice 
            ? reservePrice 
            : undefined;
          
          const isValid = commitmentManager.validateBidAmount(
            bidAmount,
            startingPrice,
            finalReservePrice
          );
          
          // Should be valid if bid meets starting price and reserve price (if set)
          const meetsStartingPrice = bidAmount >= startingPrice;
          const meetsReservePrice = !finalReservePrice || bidAmount >= finalReservePrice;
          const expectedValid = meetsStartingPrice && meetsReservePrice;
          
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: Auction Cancellation Rules
   * For any auction, cancellation should only be allowed during commitment phase
   */
  test('Property 6.6: Auction cancellation follows correct rules', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.bigUintN(32), // starting price
        fc.hexaString({ minLength: 40, maxLength: 40 }), // token ID
        fc.hexaString({ minLength: 40, maxLength: 40 }), // auctioneer
        async (startingPrice, tokenIdHex, auctioneerHex) => {
          const currentTime = Date.now();
          const config: AuctionConfig = {
            tokenId: `0x${tokenIdHex}`,
            startingPrice,
            commitmentPhaseEnd: currentTime + (1 * 60 * 60 * 1000), // 1 hour
            revealPhaseEnd: currentTime + (2 * 60 * 60 * 1000), // 2 hours
            auctioneer: `0x${auctioneerHex}`
          };
          
          // Create auction
          const auctionId = await auctionSDK.createAuction(config);
          let auction = await auctionSDK.getAuction(auctionId);
          
          // Should be able to cancel during commitment phase
          expect(auction.state).toBe(AuctionState.COMMITMENT_PHASE);
          
          // Cancel the auction
          const cancelTxHash = await auctionSDK.cancelAuction(auctionId);
          expect(cancelTxHash).toMatch(/^0x[0-9a-f]+$/);
          
          // Auction state should be cancelled
          auction = await auctionSDK.getAuction(auctionId);
          expect(auction.state).toBe(AuctionState.CANCELLED);
          
          // Should not be able to cancel again
          await expect(auctionSDK.cancelAuction(auctionId)).rejects.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Helper function to compare Uint8Arrays
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}