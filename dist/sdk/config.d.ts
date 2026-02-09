import { NetworkConfig, KiritoSDKConfig } from '../types';
/**
 * Default network configurations
 */
export declare const STARKNET_SEPOLIA: NetworkConfig;
export declare const STARKNET_MAINNET: NetworkConfig;
/**
 * Default SDK configuration
 */
export declare const DEFAULT_CONFIG: Partial<KiritoSDKConfig>;
/**
 * Validate SDK configuration
 */
export declare function validateConfig(config: KiritoSDKConfig): boolean;
/**
 * Get network configuration by name
 */
export declare function getNetworkConfig(networkName: string): NetworkConfig;
//# sourceMappingURL=config.d.ts.map