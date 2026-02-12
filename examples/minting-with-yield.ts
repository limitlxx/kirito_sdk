/**
 * Minting with Yield Allocation Example
 * 
 * Demonstrates minting NFTs with automatic yield allocation
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

  console.log('Connected to wallet:', result.address);

  // Prepare NFT metadata
  const metadata = {
    name: 'Kirito NFT #1',
    description: 'A privacy-enhanced yield-generating NFT',
    image: 'ipfs://QmXxx...',
    attributes: [
      { trait_type: 'Background', value: 'Legendary' },
      { trait_type: 'Eyes', value: 'Diamond' },
      { trait_type: 'Rarity', value: 'Epic' }
    ],
    rarityScore: 95,
    yieldMultiplier: 1.5,
    semaphoreGroupId: '0x123...'
  };

  // Stake amount (1 ETH)
  const stakeAmount = BigInt('1000000000000000000');

  // Mint NFT with yield allocation
  console.log('\nMinting NFT with yield allocation...');
  const { tokenId, txHash, allocation } = await sdk.mintWithYieldAllocation(
    result.address!,
    metadata,
    stakeAmount
  );

  console.log('✓ NFT minted successfully');
  console.log('Token ID:', tokenId);
  console.log('Transaction:', txHash);
  console.log('\nAllocation Details:');
  console.log('- Rarity Score:', allocation.rarityScore);
  console.log('- Stake Amount:', allocation.stakeAmount.toString());
  console.log('- Yield Multiplier:', allocation.yieldMultiplier);
  console.log('- Allocated Amount:', allocation.allocatedAmount.toString());

  // Get allocation preview for another NFT
  const walletAllocation = sdk.getWalletAllocation();
  const preview = walletAllocation.createAllocationPreview(
    '2',
    metadata,
    stakeAmount,
    BigInt('100000000000000000000') // 100 ETH annual yield
  );

  console.log('\nAllocation Preview for Next NFT:');
  console.log('- Estimated Daily Yield:', preview.estimatedDailyYield.toString());
  console.log('- Estimated Monthly Yield:', preview.estimatedMonthlyYield.toString());
  console.log('- Estimated Annual Yield:', preview.estimatedAnnualYield.toString());
  console.log('\nBreakdown:');
  console.log('- Base Allocation:', preview.allocationBreakdown.baseAllocation.toString());
  console.log('- Rarity Bonus:', preview.allocationBreakdown.rarityBonus.toString());
  console.log('- Stake Bonus:', preview.allocationBreakdown.stakeBonus.toString());
  console.log('- Custom Bonus:', preview.allocationBreakdown.customBonus.toString());
  console.log('- Total:', preview.allocationBreakdown.totalAllocation.toString());

  await sdk.shutdown();
}

main().catch(console.error);
