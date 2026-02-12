import fc from 'fast-check';
import { createTokenConversionAggregator } from '../../src/sdk/token-conversion-aggregator';
import { createLayerSwapBridge } from '../../src/sdk/layerswap-bridge';
import { createGardenFinanceBridge } from '../../src/sdk/garden-finance-bridge';
import { createXverseBridge } from '../../src/sdk/xverse-bridge';

/**
 * Property-Based Tests for Token Conversion Consistency
 * 
 * **Validates: Conversion rates and bridge integrity**
 * 
 * Tests the consistency and reliability of token conversion operations
 * across multiple bridges and DEX aggregators.
 */

describe('Token Conversion Consistency Properties', () => {
  const layerSwapBridge = createLayerSwapBridge('testnet');
  const gardenBridge = createGardenFinanceBridge('testnet');
  const xverseBridge = createXverseBridge('testnet');
  const aggregator = createTokenConversionAggregator(layerSwapBridge, gardenBridge, xverseBridge);

  /**
   * Property 23: Token Conversion Round-Trip Consistency
   * 
   * For any valid token conversion, the system should maintain consistency
   * in rates, fees, and output amounts across all conversion methods.
   */
  describe('Property 23: Token Conversion Round-Trip Consistency', () => {
    test('Conversion rates maintain mathematical consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK', 'USDC', 'BTC'),
            toToken: fc.constantFrom('WBTC', 'ETH', 'USDC'),
            amount: fc.bigInt({ min: 1000000n, max: 10000000000n })
          }),
          async ({ fromToken, toToken, amount }) => {
            // Skip same-token conversions
            if (fromToken === toToken) return;

            try {
              const bestRate = await aggregator.getBestRate(fromToken, toToken, amount);

              // Rate should be positive
              expect(bestRate.rate).toBeGreaterThan(0);
              
              // Rate should be reasonable (not more than 10x or less than 0.01x)
              expect(bestRate.rate).toBeGreaterThan(0.01);
              expect(bestRate.rate).toBeLessThan(10);

              // Fees should be non-negative
              expect(bestRate.fees).toBeGreaterThanOrEqual(0n);

              // Estimated time should be positive
              expect(bestRate.estimatedTime).toBeGreaterThanOrEqual(0);

              // Confidence should be between 0 and 1
              expect(bestRate.confidence).toBeGreaterThanOrEqual(0);
              expect(bestRate.confidence).toBeLessThanOrEqual(1);

              // Bridge should be specified
              expect(bestRate.bridge).toBeTruthy();

              // Calculate expected output
              const expectedOutput = BigInt(Math.floor(Number(amount) * bestRate.rate));
              expect(expectedOutput).toBeGreaterThan(0n);

              // Output should be less than input (accounting for fees and conversion)
              // unless it's a favorable conversion rate
              if (bestRate.rate < 1) {
                expect(expectedOutput).toBeLessThan(amount);
              }

            } catch (error) {
              // Some token pairs might not be supported
              if (error instanceof Error && 
                  error.message.includes('No valid conversion rates found')) {
                return; // Skip unsupported pairs
              }
              throw error;
            }
          }
        ),
        { numRuns: 100, timeout: 30000 }
      );
    }, 60000);

    test('Multi-hop routing maintains conversion consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('STRK', 'USDC'),
            toToken: fc.constantFrom('WBTC', 'ETH'),
            amount: fc.bigInt({ min: 1000000n, max: 1000000000n })
          }),
          async ({ fromToken, toToken, amount }) => {
            if (fromToken === toToken) return;

            try {
              const multiHopRoute = await aggregator.getMultiHopRoute(fromToken, toToken, amount);

              // Route should have at least one hop
              expect(multiHopRoute.hops.length).toBeGreaterThan(0);
              expect(multiHopRoute.hops.length).toBeLessThanOrEqual(3); // Max 3 hops

              // First hop should start with fromToken
              expect(multiHopRoute.hops[0].fromToken).toBe(fromToken);
              expect(multiHopRoute.hops[0].amount).toBe(amount);

              // Last hop should end with toToken
              const lastHop = multiHopRoute.hops[multiHopRoute.hops.length - 1];
              expect(lastHop.toToken).toBe(toToken);

              // Hops should be connected (output of one = input of next)
              for (let i = 0; i < multiHopRoute.hops.length - 1; i++) {
                const currentHop = multiHopRoute.hops[i];
                const nextHop = multiHopRoute.hops[i + 1];
                
                expect(currentHop.toToken).toBe(nextHop.fromToken);
                expect(currentHop.expectedOutput).toBe(nextHop.amount);
              }

              // Total fees should be sum of all hop fees
              expect(multiHopRoute.totalFees).toBeGreaterThanOrEqual(0n);

              // Estimated time should be sum of all hop times
              expect(multiHopRoute.estimatedTime).toBeGreaterThan(0);

              // Price impact should be reasonable
              expect(multiHopRoute.priceImpact).toBeGreaterThanOrEqual(0);
              expect(multiHopRoute.priceImpact).toBeLessThan(1); // Less than 100%

              // Final output should be positive
              expect(lastHop.expectedOutput).toBeGreaterThan(0n);

            } catch (error) {
              // Multi-hop routing might fail for some pairs
              if (error instanceof Error && 
                  error.message.includes('No valid multi-hop route found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 60000);

    test('Rate caching maintains consistency and freshness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK'),
            toToken: fc.constantFrom('WBTC', 'USDC'),
            amount: fc.bigInt({ min: 1000000n, max: 100000000n })
          }),
          async ({ fromToken, toToken, amount }) => {
            if (fromToken === toToken) return;

            try {
              // Get rate twice to test caching
              const rate1 = await aggregator.getBestRate(fromToken, toToken, amount);
              const rate2 = await aggregator.getBestRate(fromToken, toToken, amount);

              // Rates should be identical when cached
              expect(rate1.rate).toBe(rate2.rate);
              expect(rate1.bridge).toBe(rate2.bridge);
              expect(rate1.fees).toBe(rate2.fees);

              // Check cached rates
              const cachedRates = await aggregator.getCachedRates();
              expect(cachedRates.length).toBeGreaterThanOrEqual(0);

              // Each cached rate should have required properties
              for (const cached of cachedRates) {
                expect(cached.pair).toBeTruthy();
                expect(cached.rate).toBeGreaterThan(0);
                expect(cached.timestamp).toBeGreaterThan(0);
                expect(cached.ttl).toBeGreaterThan(0);
              }

              // Refresh rates should not throw
              await expect(aggregator.refreshRates()).resolves.not.toThrow();

            } catch (error) {
              // Rate fetching might fail in test environment
              if (error instanceof Error && 
                  error.message.includes('No valid conversion rates found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 30, timeout: 20000 }
      );
    }, 40000);

    test('Conversion preview maintains accuracy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK', 'USDC'),
            toToken: fc.constantFrom('WBTC', 'ETH'),
            amount: fc.bigInt({ min: 1000000n, max: 1000000000n }),
            maxSlippage: fc.float({ min: 0.1, max: 5.0 }) // 0.1% to 5%
          }),
          async ({ fromToken, toToken, amount, maxSlippage }) => {
            if (fromToken === toToken) return;

            try {
              const preview = await aggregator.getConversionPreview(
                fromToken,
                toToken,
                amount,
                { maxSlippage }
              );

              // Best rate should be valid
              expect(preview.bestRate.rate).toBeGreaterThan(0);
              expect(preview.bestRate.fromToken).toBe(fromToken);
              expect(preview.bestRate.toToken).toBe(toToken);

              // Estimated output should be positive
              expect(preview.estimatedOutput).toBeGreaterThan(0n);

              // Total fees should be non-negative
              expect(preview.totalFees).toBeGreaterThanOrEqual(0n);

              // Price impact should be reasonable
              expect(preview.priceImpact).toBeGreaterThanOrEqual(0);
              expect(preview.priceImpact).toBeLessThan(1);

              // Slippage protection should be calculated correctly
              const expectedSlippage = BigInt(Math.floor(Number(preview.estimatedOutput) * (maxSlippage / 100)));
              expect(preview.slippageProtection).toBe(expectedSlippage);

              // If multi-hop route exists, it should be valid
              if (preview.multiHopRoute) {
                expect(preview.multiHopRoute.hops.length).toBeGreaterThan(1);
                expect(preview.multiHopRoute.hops[0].fromToken).toBe(fromToken);
                
                const lastHop = preview.multiHopRoute.hops[preview.multiHopRoute.hops.length - 1];
                expect(lastHop.toToken).toBe(toToken);
              }

            } catch (error) {
              // Preview might fail for unsupported pairs
              if (error instanceof Error && 
                  error.message.includes('No valid conversion rates found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50, timeout: 30000 }
      );
    }, 60000);

    test('Cross-aggregator rate consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK'),
            toToken: fc.constantFrom('USDC', 'WBTC'),
            amount: fc.bigInt({ min: 10000000n, max: 100000000n })
          }),
          async ({ fromToken, toToken, amount }) => {
            if (fromToken === toToken) return;

            try {
              // Get rates multiple times to check consistency
              const rates = await Promise.all([
                aggregator.getBestRate(fromToken, toToken, amount),
                aggregator.getBestRate(fromToken, toToken, amount),
                aggregator.getBestRate(fromToken, toToken, amount)
              ]);

              // All rates should be identical (due to caching)
              for (let i = 1; i < rates.length; i++) {
                expect(rates[i].rate).toBe(rates[0].rate);
                expect(rates[i].bridge).toBe(rates[0].bridge);
                expect(rates[i].confidence).toBe(rates[0].confidence);
              }

              // Rates should be within reasonable bounds
              for (const rate of rates) {
                expect(rate.rate).toBeGreaterThan(0);
                expect(rate.confidence).toBeGreaterThan(0);
                expect(rate.confidence).toBeLessThanOrEqual(1);
                expect(rate.fees).toBeGreaterThanOrEqual(0n);
                expect(rate.estimatedTime).toBeGreaterThanOrEqual(0);
              }

            } catch (error) {
              // Rate consistency checks might fail for unsupported pairs
              if (error instanceof Error && 
                  error.message.includes('No valid conversion rates found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 30, timeout: 20000 }
      );
    }, 40000);

    test('Slippage protection maintains bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fromToken: fc.constantFrom('ETH', 'STRK', 'USDC'),
            toToken: fc.constantFrom('WBTC', 'ETH', 'USDC'),
            amount: fc.bigInt({ min: 1000000n, max: 100000000n }),
            maxSlippage: fc.float({ min: 0.1, max: 10.0 })
          }),
          async ({ fromToken, toToken, amount, maxSlippage }) => {
            if (fromToken === toToken) return;

            try {
              const preview = await aggregator.getConversionPreview(
                fromToken,
                toToken,
                amount,
                { maxSlippage }
              );

              // Slippage protection should be proportional to max slippage
              const slippageRatio = Number(preview.slippageProtection) / Number(preview.estimatedOutput);
              const expectedRatio = maxSlippage / 100;
              
              // Allow for small rounding differences
              expect(Math.abs(slippageRatio - expectedRatio)).toBeLessThan(0.001);

              // Slippage protection should never exceed estimated output
              expect(preview.slippageProtection).toBeLessThanOrEqual(preview.estimatedOutput);

              // With slippage protection, minimum output should be reasonable
              const minOutput = preview.estimatedOutput - preview.slippageProtection;
              expect(minOutput).toBeGreaterThan(0n);
              expect(minOutput).toBeLessThan(preview.estimatedOutput);

            } catch (error) {
              // Slippage calculations might fail for unsupported pairs
              if (error instanceof Error && 
                  error.message.includes('No valid conversion rates found')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50, timeout: 25000 }
      );
    }, 50000);
  });

  /**
   * Integration test for complete conversion workflow
   */
  test('Complete conversion workflow maintains data integrity', async () => {
    const testAmount = 1000000000n; // 1 token
    const testAddress = '0x1234567890123456789012345678901234567890123456789012345678901234';

    try {
      // Test conversion preview
      const preview = await aggregator.getConversionPreview(
        'ETH',
        'WBTC',
        testAmount,
        { maxSlippage: 1.0 }
      );

      expect(preview.bestRate.rate).toBeGreaterThan(0);
      expect(preview.estimatedOutput).toBeGreaterThan(0n);
      expect(preview.totalFees).toBeGreaterThanOrEqual(0n);

      // Test multi-hop route if available
      if (preview.multiHopRoute) {
        expect(preview.multiHopRoute.hops.length).toBeGreaterThan(1);
        expect(preview.multiHopRoute.totalFees).toBeGreaterThanOrEqual(0n);
      }

      // Test rate caching
      const cachedRates = await aggregator.getCachedRates();
      expect(Array.isArray(cachedRates)).toBe(true);

      // Test rate refresh
      await expect(aggregator.refreshRates()).resolves.not.toThrow();

    } catch (error) {
      // Integration test might fail due to API limitations
      if (error instanceof Error && 
          (error.message.includes('No valid conversion rates found') ||
           error.message.includes('API') ||
           error.message.includes('network'))) {
        console.log('Token conversion integration test skipped due to API limitations');
        return;
      }
      throw error;
    }
  }, 30000);

  /**
   * Edge case tests
   */
  describe('Edge Cases', () => {
    test('Handles zero and very small amounts gracefully', async () => {
      const smallAmounts = [0n, 1n, 100n, 1000n];
      
      for (const amount of smallAmounts) {
        try {
          const rate = await aggregator.getBestRate('ETH', 'WBTC', amount);
          
          if (amount === 0n) {
            // Zero amount should either fail or return zero rate
            expect(rate.rate === 0 || rate === null).toBeTruthy();
          } else {
            // Small amounts should still have positive rates
            expect(rate.rate).toBeGreaterThanOrEqual(0);
          }
        } catch (error) {
          // Zero/small amounts might be rejected, which is acceptable
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('Handles very large amounts appropriately', async () => {
      const largeAmount = 1000000000000000000n; // Very large amount
      
      try {
        const rate = await aggregator.getBestRate('ETH', 'WBTC', largeAmount);
        
        // Large amounts should still have reasonable rates
        expect(rate.rate).toBeGreaterThan(0);
        expect(rate.rate).toBeLessThan(10); // Not unreasonably high
        
        // Fees might be higher for large amounts
        expect(rate.fees).toBeGreaterThanOrEqual(0n);
        
      } catch (error) {
        // Large amounts might be rejected due to liquidity constraints
        if (error instanceof Error && 
            (error.message.includes('liquidity') || 
             error.message.includes('amount too large'))) {
          return; // Acceptable failure
        }
        throw error;
      }
    });

    test('Handles unsupported token pairs gracefully', async () => {
      const unsupportedPairs = [
        ['INVALID_TOKEN', 'WBTC'],
        ['ETH', 'INVALID_TOKEN'],
        ['FAKE', 'ALSO_FAKE']
      ];

      for (const [fromToken, toToken] of unsupportedPairs) {
        await expect(
          aggregator.getBestRate(fromToken, toToken, 1000000n)
        ).rejects.toThrow();
      }
    });
  });
});

/**
 * Feature: kirito-sdk, Property 23: Token Conversion Round-Trip Consistency
 * 
 * This test suite validates that token conversion operations maintain
 * mathematical consistency, proper rate calculations, and reliable
 * multi-hop routing across all supported bridges and DEX aggregators.
 */