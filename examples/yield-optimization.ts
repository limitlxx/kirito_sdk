/**
 * Yield Optimization Example
 * 
 * Demonstrates yield aggregation and optimization across DeFi protocols
 */

import { KiritoSDK, WalletType } from '@kirito/sdk';

async function main() {
  const sdk = new KiritoSDK({
    network: {
      name: 'sepolia',
      chainId: 'SN_SEPOLIA',
      rpcUrl: 'https://starknet-sepolia.public.blastapi.io'
    }
  });

  await sdk.initialize();

  // Connect wallet
  const result = await sdk.connectWallet(WalletType.ARGENT_X);
  if (!result.success) {
    throw new Error('Failed to connect wallet');
  }

  const walletAddress = result.address!;
  console.log('Connected to wallet:', walletAddress);

  // Define time period (last 30 days)
  const period = {
    start: Date.now() - (30 * 24 * 60 * 60 * 1000),
    end: Date.now()
  };

  // Get aggregated yield from all protocols
  console.log('\nFetching aggregated yield...');
  const aggregatedYield = await sdk.getAggregatedYield(walletAddress, period);

  console.log('✓ Aggregated Yield Retrieved');
  console.log('Total Yield:', aggregatedYield.amount.toString());
  console.log('Token:', aggregatedYield.token);

  // Get detailed breakdown from DeFi aggregator
  const defiAggregator = sdk.getDeFiAggregator();
  const detailedYield = await defiAggregator.getAggregatedYield(walletAddress, period);

  console.log('\nProtocol Breakdown:');
  detailedYield.protocolBreakdown.forEach(protocol => {
    console.log(`\n${protocol.protocolName}:`);
    console.log('  - Raw Yield:', protocol.rawYield.toString());
    console.log('  - Weighted Yield:', protocol.weightedYield.toString());
    console.log('  - Weight:', (protocol.weight * 100).toFixed(1) + '%');
    console.log('  - APY:', (protocol.apy * 100).toFixed(2) + '%');
    console.log('  - Health Score:', (protocol.healthScore * 100).toFixed(1) + '%');
    console.log('  - Status:', protocol.isHealthy ? '✓ Healthy' : '✗ Unhealthy');
  });

  console.log('\nOverall Health Score:', (detailedYield.healthScore * 100).toFixed(1) + '%');

  // Get optimization recommendations
  console.log('\n\nGenerating optimization recommendations...');
  const optimization = await sdk.optimizeYieldDistribution(walletAddress, period);

  console.log('✓ Optimization Analysis Complete');
  console.log('\nCurrent APY:', (optimization.currentAPY * 100).toFixed(2) + '%');
  console.log('Optimized APY:', (optimization.optimizedAPY * 100).toFixed(2) + '%');
  console.log('Potential Improvement:', ((optimization.optimizedAPY - optimization.currentAPY) * 100).toFixed(2) + '%');

  console.log('\nRebalancing Recommendations:');
  optimization.rebalanceRecommendations.forEach(rec => {
    console.log(`\n${rec.protocol}:`);
    console.log('  - Current Weight:', (rec.currentWeight * 100).toFixed(1) + '%');
    console.log('  - Recommended Weight:', (rec.recommendedWeight * 100).toFixed(1) + '%');
    console.log('  - Change:', ((rec.recommendedWeight - rec.currentWeight) * 100).toFixed(1) + '%');
    console.log('  - Reason:', rec.reason);
  });

  console.log('\nEstimated Gas:', optimization.estimatedGasForRebalance.toString());
  console.log('Time to Break Even:', optimization.estimatedTimeToBreakeven.toFixed(0) + ' days');

  // Execute rebalancing (optional)
  const shouldRebalance = false; // Set to true to execute

  if (shouldRebalance) {
    console.log('\n\nExecuting rebalancing...');
    const txHashes = await sdk.executeRebalancing(walletAddress, optimization);
    
    console.log('✓ Rebalancing Complete');
    console.log('Transactions:', txHashes.length);
    txHashes.forEach((hash, index) => {
      console.log(`  ${index + 1}. ${hash}`);
    });
  }

  // Monitor protocol health
  console.log('\n\nMonitoring protocol health...');
  const healthResults = await defiAggregator.monitorProtocolHealth();

  healthResults.forEach((health, protocol) => {
    console.log(`\n${protocol}:`);
    console.log('  - Status:', health.isHealthy ? '✓ Healthy' : '✗ Unhealthy');
    console.log('  - Health Score:', (health.healthScore * 100).toFixed(1) + '%');
    
    if (health.issues.length > 0) {
      console.log('  - Issues:', health.issues.join(', '));
    }
    
    if (health.recommendations.length > 0) {
      console.log('  - Recommendations:', health.recommendations.join(', '));
    }
  });

  await sdk.shutdown();
}

main().catch(console.error);
