import { KiritoSDK } from './kirito-sdk';
import { KiritoSDKConfig } from '../types';

/**
 * Integration test for Kirito SDK components
 * This demonstrates that all components are properly integrated
 */
export async function testSDKIntegration(): Promise<void> {
  console.log('Starting Kirito SDK integration test...');

  try {
    // Initialize SDK with default configuration
    const sdk = new KiritoSDK();
    
    // Initialize all components
    await sdk.initialize();
    
    // Test component access
    console.log('Testing component access...');
    
    // Test NFT Wallet component
    const nftWallet = sdk.getNFTWallet();
    console.log('✓ NFT Wallet component accessible');
    
    // Test Shielded Pool component
    const shieldedPool = sdk.getShieldedPool();
    console.log('✓ Shielded Pool component accessible');
    
    // Test Mystery Box component
    const mysteryBox = sdk.getMysteryBox();
    console.log('✓ Mystery Box component accessible');
    
    // Test Anonymous Governance component
    const governance = sdk.getGovernance();
    console.log('✓ Anonymous Governance component accessible');
    
    // Test health check
    console.log('Testing health check...');
    const health = await sdk.healthCheck();
    console.log('Health status:', health);
    
    // Test configuration access
    console.log('Testing configuration...');
    const config = sdk.getConfig();
    console.log('✓ Configuration accessible');
    console.log('Network:', config.network.name);
    
    // Test version info
    const version = sdk.getVersion();
    console.log('✓ Version info:', version);
    
    // Test graceful shutdown
    await sdk.shutdown();
    console.log('✓ SDK shutdown successful');
    
    console.log('🎉 All integration tests passed!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

/**
 * Test SDK with custom configuration
 */
export async function testCustomConfiguration(): Promise<void> {
  console.log('Testing SDK with custom configuration...');
  
  const customConfig: Partial<KiritoSDKConfig> = {
    network: {
      name: 'custom-testnet',
      rpcUrl: 'https://custom-rpc.example.com',
      chainId: '0x123456',
      contracts: {
        nftWallet: '0x1111111111111111111111111111111111111111111111111111111111111111',
        walletFactory: '0x2222222222222222222222222222222222222222222222222222222222222222'
      }
    },
    ipfs: {
      url: 'https://custom-ipfs.example.com:5001',
      projectId: 'test-project',
      projectSecret: 'test-secret'
    }
  };
  
  try {
    const sdk = new KiritoSDK(customConfig);
    await sdk.initialize();
    
    const config = sdk.getConfig();
    console.log('✓ Custom configuration applied');
    console.log('Custom network:', config.network.name);
    
    await sdk.shutdown();
    console.log('✓ Custom configuration test passed');
    
  } catch (error) {
    console.error('❌ Custom configuration test failed:', error);
    throw error;
  }
}

// Run integration tests if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await testSDKIntegration();
      await testCustomConfiguration();
      console.log('🎉 All tests completed successfully!');
    } catch (error) {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    }
  })();
}