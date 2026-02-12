/**
 * Basic Usage Example
 * 
 * Demonstrates basic SDK initialization and wallet connection
 */

import { KiritoSDK, WalletType, createKiritoSDK } from '@kirito/sdk';

async function main() {
  // Create SDK instance with configuration
  const sdk = createKiritoSDK({
    network: {
      name: 'sepolia',
      chainId: 'SN_SEPOLIA',
      rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
      contracts: {
        nftWallet: '0x...',
        yieldDistributor: '0x...',
        multiTokenWallet: '0x...'
      }
    },
    ipfs: {
      url: 'https://ipfs.infura.io:5001',
      gateway: 'https://ipfs.io/ipfs/'
    },
    privacy: {
      tongoEndpoint: 'https://tongo.xyz/api',
      semaphoreEndpoint: 'https://semaphore.xyz/api'
    },
    debug: true // Enable debug logging
  });

  // Initialize SDK
  console.log('Initializing SDK...');
  await sdk.initialize();

  // Check health
  const health = await sdk.healthCheck();
  console.log('SDK Health:', health);

  // Detect available wallets
  console.log('\nDetecting wallets...');
  const wallets = await sdk.detectWallets();
  
  wallets.forEach(wallet => {
    console.log(`- ${wallet.name}: ${wallet.isInstalled ? 'Installed' : 'Not installed'}`);
  });

  // Connect to wallet (if available)
  if (wallets.length > 0) {
    const walletType = wallets[0].type;
    console.log(`\nConnecting to ${wallets[0].name}...`);
    
    const result = await sdk.connectWallet(walletType);
    
    if (result.success) {
      console.log('✓ Connected successfully');
      console.log('Address:', result.address);
      
      // Get connected wallet info
      const connectedWallet = sdk.getConnectedWallet();
      console.log('Connected wallet:', connectedWallet);
    } else {
      console.error('✗ Connection failed:', result.error);
    }
  }

  // Get SDK version
  const version = sdk.getVersion();
  console.log('\nSDK Version:', version.version);
  console.log('Components:', version.components.join(', '));

  // Graceful shutdown
  await sdk.shutdown();
  console.log('\nSDK shutdown complete');
}

main().catch(console.error);
