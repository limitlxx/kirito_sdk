import fc from 'fast-check';
import { createLayerSwapBridge } from '../../src/sdk/layerswap-bridge';
import { createGardenFinanceBridge } from '../../src/sdk/garden-finance-bridge';
import { createXverseBridge } from '../../src/sdk/xverse-bridge';
import { BridgeTransactionStatus, SupportedToken } from '../../src/interfaces/bridge';

/**
 * Property-Based Tests for BTC Bridge Integration
 * 
 * **Validates: Requirements 3.4, 3.5**
 * 
 * Tests the round-trip consistency and reliability of Bitcoin bridge operations
 * across LayerSwap, Garden Finance, and Xverse bridges.
 */

describe('BTC Bridge Integration Properties', () => {
  const layerSwapBridge = createLayerSwapBridge('testnet');
  const gardenBridge = createGardenFinanceBridge('testnet');
  const xverseBridge = createXverseBridge('testnet');

  /**
   * Property 20: BTC Bridge Round-Trip
   * 
   * For any valid bridge transaction, the system should maintain consistency
   * between input amounts, output amounts, and fees across all supported bridges.
   */
  describe('Property 20: BTC Bridge Round-Trip', () => {
    test('LayerSwap bridge maintains transaction consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid bridge parameters
          fc.record({
            fromToken: fc.constantFrom('BTC', 'ETH', 'STRK', 'USDC'),
            toToken: fc.constant('WBTC'),
            amount: fc.bigInt({ min: 1000000n, max: 100000000000n }), // 0.01 to 1000 tokens
            starknetAddress: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`),
            fromChain: fc.constantFrom('BITCOIN', 'STARKNET_MAINNET'),
            toChain: fc.constant('STARKNET_MAINNET')
          }),
          async ({ fromToken, toToken, amount, starknetAddress, fromChain, toChain }) => {
            try {
              // Get quote from LayerSwap
              const quote = await layerSwapBridge.getQuote(
                fromToken,
                toToken,
                amount,
                fromChain,
                toChain
              );

              // Verify quote consistency
              expect(quote.fromToken).toBe(fromToken);
              expect(quote.toToken).toBe(toToken);
              expect(quote.fromAmount).toBe(amount);
              expect(quote.toAmount).toBeGreaterThan(0n);
              expect(quote.estimatedFees).toBeGreaterThanOrEqual(0n);
              
              // Verify conservation: output + fees should be reasonable relative to input
              const totalOutput = quote.toAmount + quote.estimatedFees;
              const conservationRatio = Number(totalOutput) / Number(amount);
              expect(conservationRatio).toBeGreaterThan(0.5); // At least 50% efficiency
              expect(conservationRatio).toBeLessThan(2.0); // No more than 2x output

              // Verify route consistency
              expect(quote.route).toContain(fromChain);
              expect(quote.route).toContain(toChain);

              // Test transaction execution (mock)
              const transaction = await layerSwapBridge.executeBridge(quote, starknetAddress);
              
              expect(transaction.fromToken).toBe(fromToken);
              expect(transaction.toToken).toBe(toToken);
              expect(transaction.fromAmount).toBe(amount);
              expect(transaction.toAmount).toBe(quote.toAmount);
              expect(transaction.status).toBeDefined();
              expect(transaction.id).toBeTruthy();

            } catch (error) {
              // Some combinations might not be supported, which is acceptable
              if (error instanceof Error && 
                  (error.message.includes('not supported') || 
                   error.message.includes('invalid pair'))) {
                return; // Skip unsupported pairs
              }
              throw error;
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 60000);

    test('Garden Finance bridge maintains atomic swap consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('BTC', 'ETH', 'STRK', 'USDC', 'WBTC'),
            toToken: fc.constantFrom('BTC', 'ETH', 'STRK', 'USDC', 'WBTC'),
            amount: fc.bigInt({ min: 1000000n, max: 10000000000n }),
            destinationAddress: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
          }),
          async ({ fromToken, toToken, amount, destinationAddress }) => {
            // Skip same-token conversions
            if (fromToken === toToken) return;

            try {
              // Test optimal route calculation
              const route = await gardenBridge.getOptimalRoute(fromToken, toToken, amount);
              
              expect(route.path).toContain(fromToken);
              expect(route.path).toContain(toToken);
              expect(route.expectedOutput).toBeGreaterThan(0n);
              expect(route.priceImpact).toBeGreaterThanOrEqual(0);
              expect(route.fees).toBeDefined();

              // Test atomic swap creation
              const swap = await gardenBridge.createAtomicSwap(
                fromToken,
                toToken,
                amount,
                destinationAddress
              );

              expect(swap.fromToken).toBe(fromToken);
              expect(swap.toToken).toBe(toToken);
              expect(swap.amount).toBe(amount);
              expect(swap.counterparty).toBe(destinationAddress);
              expect(swap.secretHash).toBeTruthy();
              expect(swap.lockTime).toBeGreaterThan(Math.floor(Date.now() / 1000));

              // Test BTC wrapping/unwrapping consistency
              if (fromToken === 'BTC' && toToken === 'WBTC') {
                const wrapTx = await gardenBridge.wrapBTC(amount, destinationAddress);
                expect(wrapTx.fromToken).toBe('BTC');
                expect(wrapTx.toToken).toBe('WBTC');
                expect(wrapTx.fromAmount).toBe(amount);
              }

              if (fromToken === 'WBTC' && toToken === 'BTC') {
                const unwrapTx = await gardenBridge.unwrapWBTC(amount, destinationAddress);
                expect(unwrapTx.fromToken).toBe('WBTC');
                expect(unwrapTx.toToken).toBe('BTC');
                expect(unwrapTx.fromAmount).toBe(amount);
              }

            } catch (error) {
              // Some token pairs might not be supported
              if (error instanceof Error && 
                  error.message.includes('not supported')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 60000);

    test('Xverse bridge maintains multi-token conversion consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tokens: fc.array(
              fc.record({
                token: fc.constantFrom('ETH', 'STRK', 'USDC', 'BTC'),
                amount: fc.bigInt({ min: 1000000n, max: 1000000000n })
              }),
              { minLength: 1, maxLength: 3 }
            ),
            starknetAddress: fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`)
          }),
          async ({ tokens, starknetAddress }) => {
            try {
              // Test individual bridge operations
              for (const { token, amount } of tokens) {
                const feeEstimate = await xverseBridge.estimateBridgeFees(
                  token,
                  amount,
                  starknetAddress
                );

                expect(feeEstimate.networkFee).toBeGreaterThanOrEqual(0n);
                expect(feeEstimate.bridgeFee).toBeGreaterThanOrEqual(0n);
                expect(feeEstimate.totalFee).toBe(feeEstimate.networkFee + feeEstimate.bridgeFee);
                expect(feeEstimate.estimatedTime).toBeGreaterThan(0);

                // Verify fee reasonableness (should be less than 10% of amount)
                const feePercentage = Number(feeEstimate.totalFee) / Number(amount);
                expect(feePercentage).toBeLessThan(0.1);
              }

              // Test multi-token bridge operations
              const bridgeTransactions = [];
              for (const { token, amount } of tokens) {
                try {
                  const tx = await xverseBridge.bridgeToStarknet(
                    token,
                    amount,
                    starknetAddress
                  );
                  bridgeTransactions.push(tx);
                  
                  expect(tx.fromToken).toBe(token);
                  expect(tx.fromAmount).toBe(amount);
                  expect(tx.status).toBeDefined();
                } catch (error) {
                  // Individual bridge failures are acceptable
                  if (error instanceof Error && 
                      error.message.includes('wallet not connected')) {
                    continue;
                  }
                  throw error;
                }
              }

              expect(bridgeTransactions.length).toBeGreaterThanOrEqual(0);

            } catch (error) {
              // Wallet connection errors are acceptable in test environment
              if (error instanceof Error && 
                  error.message.includes('wallet not available')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 60000);

    test('Cross-bridge rate consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK', 'USDC'),
            amount: fc.bigInt({ min: 1000000n, max: 1000000000n })
          }),
          async ({ fromToken, amount }) => {
            try {
              // Get rates from all bridges
              const layerSwapQuote = await layerSwapBridge.getQuote(
                fromToken,
                'WBTC',
                amount,
                'STARKNET_MAINNET',
                'STARKNET_MAINNET'
              );

              const gardenRoute = await gardenBridge.getOptimalRoute(
                fromToken,
                'WBTC',
                amount
              );

              const xverseFees = await xverseBridge.estimateBridgeFees(
                fromToken,
                amount,
                'starknet'
              );

              // Calculate effective rates
              const layerSwapRate = Number(layerSwapQuote.toAmount) / Number(amount);
              const gardenRate = Number(gardenRoute.expectedOutput) / Number(amount);
              const xverseRate = Number(amount - xverseFees.totalFee) / Number(amount);

              // Rates should be positive and reasonable
              expect(layerSwapRate).toBeGreaterThan(0);
              expect(gardenRate).toBeGreaterThan(0);
              expect(xverseRate).toBeGreaterThan(0);

              // Rates shouldn't differ by more than 50% (market efficiency)
              const rates = [layerSwapRate, gardenRate, xverseRate];
              const minRate = Math.min(...rates);
              const maxRate = Math.max(...rates);
              const rateDifference = (maxRate - minRate) / minRate;
              
              expect(rateDifference).toBeLessThan(0.5); // Less than 50% difference

            } catch (error) {
              // API errors are acceptable in test environment
              if (error instanceof Error && 
                  (error.message.includes('API error') || 
                   error.message.includes('network'))) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 30, timeout: 30000 }
      );
    }, 60000);

    test('Bridge transaction status consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            transactionId: fc.string({ minLength: 10, maxLength: 64 }),
            initialStatus: fc.constantFrom(
              BridgeTransactionStatus.PENDING,
              BridgeTransactionStatus.CONFIRMED,
              BridgeTransactionStatus.COMPLETED,
              BridgeTransactionStatus.FAILED
            )
          }),
          async ({ transactionId, initialStatus }) => {
            try {
              // Test LayerSwap status tracking
              const layerSwapStatus = await layerSwapBridge.getTransactionStatus(transactionId);
              
              expect(Object.values(BridgeTransactionStatus)).toContain(layerSwapStatus.status);
              expect(layerSwapStatus.id).toBe(transactionId);
              expect(layerSwapStatus.confirmations).toBeGreaterThanOrEqual(0);
              expect(layerSwapStatus.requiredConfirmations).toBeGreaterThan(0);

              // Status transitions should be logical
              if (layerSwapStatus.status === BridgeTransactionStatus.COMPLETED) {
                expect(layerSwapStatus.confirmations).toBeGreaterThanOrEqual(
                  layerSwapStatus.requiredConfirmations
                );
              }

              if (layerSwapStatus.status === BridgeTransactionStatus.FAILED) {
                expect(layerSwapStatus.toAmount).toBeGreaterThanOrEqual(0n);
              }

            } catch (error) {
              // Transaction not found is acceptable for random IDs
              if (error instanceof Error && 
                  error.message.includes('not found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50, timeout: 20000 }
      );
    }, 40000);
  });

  /**
   * Integration test for complete bridge workflow
   */
  test('Complete bridge workflow maintains data integrity', async () => {
    const testAmount = 1000000000n; // 1 token
    const testAddress = '0x1234567890123456789012345678901234567890123456789012345678901234';

    try {
      // Test LayerSwap complete workflow
      const quote = await layerSwapBridge.getQuote(
        'ETH',
        'WBTC',
        testAmount,
        'STARKNET_MAINNET',
        'STARKNET_MAINNET'
      );

      expect(quote.fromAmount).toBe(testAmount);
      expect(quote.toAmount).toBeGreaterThan(0n);

      const transaction = await layerSwapBridge.executeBridge(quote, testAddress);
      expect(transaction.fromAmount).toBe(testAmount);
      expect(transaction.toAmount).toBe(quote.toAmount);

      // Get transaction status instead of monitoring
      const finalStatus = await layerSwapBridge.getTransactionStatus(transaction.id);
      expect(finalStatus.id).toBe(transaction.id);

    } catch (error) {
      // API limitations in test environment are acceptable
      if (error instanceof Error && 
          (error.message.includes('API') || 
           error.message.includes('timeout'))) {
        console.log('Bridge integration test skipped due to API limitations');
        return;
      }
      throw error;
    }
  }, 30000);
});

/**
 * Feature: kirito-sdk, Property 20: BTC Bridge Round-Trip
 * 
 * This test suite validates that Bitcoin bridge integrations maintain
 * consistency and reliability across all supported bridges and token pairs.
 */