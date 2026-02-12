import { NetworkConfig, KiritoSDKConfig } from '../types';

/**
 * Default network configurations
 */
export const STARKNET_SEPOLIA: NetworkConfig = {
  name: 'starknet-sepolia',
  rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
  chainId: '0x534e5f5345504f4c4941', // SN_SEPOLIA
  contracts: {
    nftWallet: '0x0000000000000000000000000000000000000000000000000000000000000001',
    walletFactory: '0x0000000000000000000000000000000000000000000000000000000000000002',
    walletImplementation: '0x0000000000000000000000000000000000000000000000000000000000000003',
    entryPoint: '0x0000000000000000000000000000000000000000000000000000000000000004',
    yieldDistributor: '0x0000000000000000000000000000000000000000000000000000000000000005',
    mysteryBoxManager: '0x0000000000000000000000000000000000000000000000000000000000000006',
    governanceManager: '0x0000000000000000000000000000000000000000000000000000000000000007',
    semaphoreVerifier: '0x0000000000000000000000000000000000000000000000000000000000000008',
    tongoPool: '0x0000000000000000000000000000000000000000000000000000000000000009',
    btcYieldManager: '0x000000000000000000000000000000000000000000000000000000000000000a',
    tokenConversionRouter: '0x000000000000000000000000000000000000000000000000000000000000000b',
    multiTokenWallet: '0x000000000000000000000000000000000000000000000000000000000000000c'
  }
};

export const STARKNET_MAINNET: NetworkConfig = {
  name: 'starknet-mainnet',
  rpcUrl: 'https://starknet-mainnet.public.blastapi.io',
  chainId: '0x534e5f4d41494e', // SN_MAIN
  contracts: {
    nftWallet: '0x0000000000000000000000000000000000000000000000000000000000000001',
    walletFactory: '0x0000000000000000000000000000000000000000000000000000000000000002',
    walletImplementation: '0x0000000000000000000000000000000000000000000000000000000000000003',
    entryPoint: '0x0000000000000000000000000000000000000000000000000000000000000004',
    yieldDistributor: '0x0000000000000000000000000000000000000000000000000000000000000005',
    mysteryBoxManager: '0x0000000000000000000000000000000000000000000000000000000000000006',
    governanceManager: '0x0000000000000000000000000000000000000000000000000000000000000007',
    semaphoreVerifier: '0x0000000000000000000000000000000000000000000000000000000000000008',
    tongoPool: '0x0000000000000000000000000000000000000000000000000000000000000009',
    btcYieldManager: '0x000000000000000000000000000000000000000000000000000000000000000a',
    tokenConversionRouter: '0x000000000000000000000000000000000000000000000000000000000000000b',
    multiTokenWallet: '0x000000000000000000000000000000000000000000000000000000000000000c'
  }
};

/**
 * Default SDK configuration
 */
export const DEFAULT_CONFIG: Partial<KiritoSDKConfig> = {
  network: STARKNET_SEPOLIA,
  ipfs: {
    url: 'https://ipfs.infura.io:5001',
  },
  privacy: {
    tongoEndpoint: 'https://api.tongo.dev',
    semaphoreEndpoint: 'https://api.semaphore.dev',
  }
};

/**
 * Validate SDK configuration
 */
export function validateConfig(config: KiritoSDKConfig): boolean {
  if (!config.network || !config.network.rpcUrl || !config.network.chainId) {
    throw new Error('Invalid network configuration');
  }

  // Validate RPC URL format
  if (!config.network.rpcUrl.startsWith('https://') && !config.network.rpcUrl.startsWith('http://localhost')) {
    throw new Error('Invalid RPC URL: must be HTTPS or localhost');
  }

  // Validate chain ID format
  if (!config.network.chainId.startsWith('0x') || config.network.chainId.length < 3) {
    throw new Error('Invalid chain ID: must be hex format starting with 0x');
  }

  if (!config.ipfs || !config.ipfs.url) {
    throw new Error('Invalid IPFS configuration');
  }

  if (!config.privacy || !config.privacy.tongoEndpoint || !config.privacy.semaphoreEndpoint) {
    throw new Error('Invalid privacy configuration');
  }

  return true;
}

/**
 * Get network configuration by name
 */
export function getNetworkConfig(networkName: string): NetworkConfig {
  switch (networkName.toLowerCase()) {
    case 'sepolia':
    case 'starknet-sepolia':
      return STARKNET_SEPOLIA;
    case 'mainnet':
    case 'starknet-mainnet':
      return STARKNET_MAINNET;
    default:
      throw new Error(`Unsupported network: ${networkName}`);
  }
}