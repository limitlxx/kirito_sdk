import {
  GenerationConfig,
  CollectionMetadata,
  IPFSHashes,
  HiddenTraits,
  EncryptionKey,
  EncryptedData,
  ImageData,
  MetadataSet
} from '../types';

/**
 * Generation Engine Interface
 * Creates unique NFT collections from image layers using HashLips Art Engine
 */
export interface GenerationEngine {
  /**
   * Generate a complete NFT collection from configuration
   */
  generateCollection(config: GenerationConfig): Promise<CollectionMetadata>;

  /**
   * Upload images and metadata to IPFS
   */
  uploadToIPFS(images: ImageData[], metadata: MetadataSet): Promise<IPFSHashes>;

  /**
   * Encrypt hidden traits for mystery box functionality
   */
  encryptHiddenTraits(traits: HiddenTraits, key: EncryptionKey): Promise<EncryptedData>;

  /**
   * Calculate rarity scores for generated NFTs
   */
  calculateRarityScores(metadata: MetadataSet): Promise<number[]>;

  /**
   * Validate generation configuration
   */
  validateConfig(config: GenerationConfig): Promise<boolean>;
}