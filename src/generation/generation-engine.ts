/**
 * Generation Engine Implementation
 * Main implementation of the GenerationEngine interface
 */

import { GenerationEngine } from '../interfaces/generation-engine';
import {
  GenerationConfig,
  CollectionMetadata,
  IPFSHashes,
  HiddenTraits,
  EncryptionKey,
  EncryptedData,
  ImageData,
  MetadataSet,
  TokenMetadata
} from '../types';
import { HashLipsEngine, CompositeOptions, ImageVariant } from './hashlips-engine';
import { IPFSClient, createIPFSClient } from '../utils/ipfs';
import { HiddenTraitEncryption } from '../utils/encryption';
import { KiritoSDKConfig } from '../types';

/**
 * Main Generation Engine implementation
 */
export class KiritoGenerationEngine implements GenerationEngine {
  private hashLipsEngine: HashLipsEngine;
  private ipfsClient: IPFSClient;
  private encryptionManager: HiddenTraitEncryption;

  constructor(config: KiritoSDKConfig, compositeOptions?: CompositeOptions) {
    this.hashLipsEngine = new HashLipsEngine(compositeOptions);
    this.ipfsClient = createIPFSClient(config.ipfs);
    this.encryptionManager = new HiddenTraitEncryption();
  }

  /**
   * Generate a complete NFT collection from configuration
   */
  async generateCollection(config: GenerationConfig): Promise<CollectionMetadata> {
    // Validate configuration
    await this.validateConfig(config);

    // Generate NFTs using HashLips engine
    const { nfts, stats } = await this.hashLipsEngine.generateCollection(config);
    
    console.log(`Generated ${nfts.length} unique NFTs out of ${stats.totalCombinations} possible combinations`);
    console.log('Rarity distribution:', stats.rarityDistribution);

    // Prepare images and metadata for IPFS upload
    const images: ImageData[] = nfts.map(nft => ({
      buffer: nft.image,
      filename: `${nft.tokenId}.png`,
      metadata: nft.metadata
    }));

    const metadataSet: MetadataSet = {};
    nfts.forEach(nft => {
      metadataSet[nft.tokenId] = nft.metadata;
    });

    // Upload to IPFS
    const ipfsHashes = await this.uploadToIPFS(images, metadataSet);

    // Convert to collection metadata format
    const collectionMetadata = HashLipsEngine.convertToCollectionMetadata(nfts, ipfsHashes);

    return collectionMetadata;
  }

  /**
   * Upload images and metadata to IPFS with batch optimization and retry logic
   */
  async uploadToIPFS(images: ImageData[], metadata: MetadataSet): Promise<IPFSHashes> {
    const imageHashes: string[] = [];
    const metadataHashes: string[] = [];

    try {
      console.log(`Starting IPFS upload for ${images.length} images and metadata files...`);

      // Upload images in optimized batches
      const imageFiles = images.map(img => ({
        buffer: img.buffer,
        filename: img.filename
      }));

      const imageResults = await this.ipfsClient.uploadFilesWithProgress(
        imageFiles,
        (completed, total, currentFile) => {
          if (completed % 10 === 0 || completed === total) {
            console.log(`Image upload progress: ${completed}/${total} (${currentFile})`);
          }
        },
        {
          batchSize: 8, // Smaller batches for images (larger files)
          delayBetweenBatches: 1500, // Longer delay for images
          maxConcurrent: 3 // Lower concurrency for images
        }
      );

      imageHashes.push(...imageResults.map(result => result.hash));
      console.log(`Successfully uploaded ${imageHashes.length} images to IPFS`);

      // Update metadata with IPFS image URLs
      const updatedMetadata: MetadataSet = {};
      Object.keys(metadata).forEach((tokenId, index) => {
        updatedMetadata[tokenId] = {
          ...metadata[tokenId],
          image: `ipfs://${imageHashes[index]}`
        };
      });

      // Upload metadata files in batches
      const metadataFiles = Object.entries(updatedMetadata).map(([tokenId, meta]) => ({
        buffer: Buffer.from(JSON.stringify(meta, null, 2)),
        filename: `${tokenId}.json`
      }));

      const metadataResults = await this.ipfsClient.uploadFilesWithProgress(
        metadataFiles,
        (completed, total, currentFile) => {
          if (completed % 20 === 0 || completed === total) {
            console.log(`Metadata upload progress: ${completed}/${total} (${currentFile})`);
          }
        },
        {
          batchSize: 15, // Larger batches for metadata (smaller files)
          delayBetweenBatches: 800, // Shorter delay for metadata
          maxConcurrent: 5 // Higher concurrency for metadata
        }
      );

      metadataHashes.push(...metadataResults.map(result => result.hash));
      console.log(`Successfully uploaded ${metadataHashes.length} metadata files to IPFS`);

      // Upload collection metadata
      const collectionMeta = {
        name: 'Generated NFT Collection',
        description: 'Privacy-enhanced NFT collection with yield generation capabilities',
        image: imageHashes.length > 0 ? `ipfs://${imageHashes[0]}` : '',
        external_link: '',
        seller_fee_basis_points: 250, // 2.5% royalty
        fee_recipient: '',
        total_supply: images.length,
        created_at: new Date().toISOString()
      };

      const collectionResult = await this.ipfsClient.uploadJSON(collectionMeta, 'collection.json');
      console.log(`Collection metadata uploaded to IPFS: ${collectionResult.hash}`);

      // Pin important files for availability
      try {
        await this.ipfsClient.pinFile(collectionResult.hash);
        console.log('Collection metadata pinned to IPFS');
      } catch (error) {
        console.warn('Failed to pin collection metadata:', error);
      }

      const finalHashes: IPFSHashes = {
        images: imageHashes,
        metadata: metadataHashes,
        collection: collectionResult.hash
      };

      console.log('IPFS upload completed successfully');
      return finalHashes;

    } catch (error) {
      console.error('IPFS upload failed:', error);
      throw new Error(`IPFS upload failed: ${error}`);
    }
  }

  /**
   * Encrypt hidden traits for mystery box functionality
   */
  async encryptHiddenTraits(traits: HiddenTraits, key: EncryptionKey): Promise<EncryptedData> {
    return await this.encryptionManager.encryptTraits(traits, key);
  }

  /**
   * Decrypt hidden traits
   */
  async decryptHiddenTraits(encryptedData: EncryptedData, key: EncryptionKey): Promise<HiddenTraits> {
    return await this.encryptionManager.decryptTraits(encryptedData, key);
  }

  /**
   * Encrypt traits selectively (some hidden, some visible)
   */
  async encryptSelectiveTraits(
    traits: HiddenTraits, 
    key: EncryptionKey, 
    traitKeysToHide: string[]
  ): Promise<{ encrypted: EncryptedData; visible: HiddenTraits }> {
    return await this.encryptionManager.encryptSelectiveTraits(traits, key, traitKeysToHide);
  }

  /**
   * Create time-locked encryption for traits
   */
  async createTimeLockedTraits(
    traits: HiddenTraits, 
    unlockTimestamp: number, 
    masterKey: EncryptionKey
  ): Promise<EncryptedData> {
    return await this.encryptionManager.createTimeLockedEncryption(traits, unlockTimestamp, masterKey);
  }

  /**
   * Generate trait commitments for bluffing mechanism
   */
  createTraitCommitments(traits: HiddenTraits, nonce: Uint8Array): { [key: string]: string } {
    return this.encryptionManager.createTraitCommitments(traits, nonce);
  }

  /**
   * Generate category proof without revealing specific trait
   */
  async generateCategoryProof(
    trait: any, 
    category: string, 
    key: EncryptionKey
  ): Promise<EncryptedData> {
    return await this.encryptionManager.generateCategoryProof(trait, category, key);
  }

  /**
   * Calculate rarity scores for generated NFTs
   */
  async calculateRarityScores(metadata: MetadataSet): Promise<number[]> {
    const metadataArray = Object.values(metadata) as TokenMetadata[];
    
    // Count trait occurrences
    const traitCounts: { [key: string]: { [key: string]: number } } = {};
    
    for (const meta of metadataArray) {
      for (const attr of meta.attributes) {
        if (!traitCounts[attr.trait_type]) {
          traitCounts[attr.trait_type] = {};
        }
        if (!traitCounts[attr.trait_type][attr.value.toString()]) {
          traitCounts[attr.trait_type][attr.value.toString()] = 0;
        }
        traitCounts[attr.trait_type][attr.value.toString()]++;
      }
    }

    // Calculate rarity scores
    const rarityScores: number[] = [];
    
    for (const meta of metadataArray) {
      let rarityScore = 0;
      
      for (const attr of meta.attributes) {
        const traitCount = traitCounts[attr.trait_type][attr.value.toString()];
        const traitRarity = metadataArray.length / traitCount;
        rarityScore += traitRarity;
      }
      
      rarityScores.push(Math.round(rarityScore * 100) / 100);
    }

    return rarityScores;
  }

  /**
   * Validate generation configuration
   */
  async validateConfig(config: GenerationConfig): Promise<boolean> {
    if (!config.layers || config.layers.length === 0) {
      throw new Error('At least one layer is required');
    }

    if (config.collectionSize <= 0) {
      throw new Error('Collection size must be positive');
    }

    if (config.collectionSize > 10000) {
      throw new Error('Collection size cannot exceed 10,000 for performance reasons');
    }

    // Validate layers have traits
    for (const layer of config.layers) {
      if (!layer.traits || layer.traits.length === 0) {
        throw new Error(`Layer ${layer.name} must have at least one trait`);
      }
    }

    // Check if enough combinations are possible
    let totalCombinations = 1;
    for (const layer of config.layers) {
      totalCombinations *= layer.traits.length;
    }

    if (totalCombinations < config.collectionSize) {
      throw new Error(
        `Not enough trait combinations (${totalCombinations}) for collection size (${config.collectionSize})`
      );
    }

    return true;
  }

  /**
   * Generate collection with multiple image variants
   */
  async generateCollectionWithVariants(
    config: GenerationConfig,
    variants: ImageVariant[]
  ): Promise<{
    collection: CollectionMetadata;
    variants: { [tokenId: string]: { [variantName: string]: Buffer } };
  }> {
    // Validate configuration
    await this.validateConfig(config);

    // Generate NFTs using HashLips engine
    const { nfts, stats } = await this.hashLipsEngine.generateCollection(config);
    
    console.log(`Generated ${nfts.length} unique NFTs with variants`);
    console.log('Rarity distribution:', stats.rarityDistribution);

    // Generate variants for each NFT
    const allVariants: { [tokenId: string]: { [variantName: string]: Buffer } } = {};
    
    for (const nft of nfts) {
      try {
        const nftWithVariants = await this.hashLipsEngine.generateNFTWithVariants(
          parseInt(nft.tokenId),
          config.layers,
          variants,
          config.semaphoreGroupId
        );
        
        allVariants[nft.tokenId] = nftWithVariants.variants;
      } catch (error) {
        console.warn(`Failed to generate variants for NFT ${nft.tokenId}:`, error);
        // Use original image for all variants as fallback
        allVariants[nft.tokenId] = {};
        variants.forEach(variant => {
          allVariants[nft.tokenId][variant.name] = nft.image;
        });
      }
    }

    // Prepare images for IPFS upload (use 'original' variant or main image)
    const images: ImageData[] = nfts.map(nft => ({
      buffer: allVariants[nft.tokenId]['original'] || nft.image,
      filename: `${nft.tokenId}.png`,
      metadata: nft.metadata
    }));

    const metadataSet: MetadataSet = {};
    nfts.forEach(nft => {
      metadataSet[nft.tokenId] = nft.metadata;
    });

    // Upload to IPFS
    const ipfsHashes = await this.uploadToIPFS(images, metadataSet);

    // Convert to collection metadata format
    const collectionMetadata = HashLipsEngine.convertToCollectionMetadata(nfts, ipfsHashes);

    return {
      collection: collectionMetadata,
      variants: allVariants
    };
  }

  /**
   * Set composite options for image generation
   */
  setCompositeOptions(options: CompositeOptions): void {
    this.hashLipsEngine.setCompositeOptions(options);
  }

  /**
   * Get current composite options
   */
  getCompositeOptions(): CompositeOptions {
    return this.hashLipsEngine.getCompositeOptions();
  }

  /**
   * Validate image processing capabilities
   */
  static async validateImageProcessing(): Promise<{
    sharp: boolean;
    canvas: boolean;
    capabilities: string[];
  }> {
    return await HashLipsEngine.validateImageProcessing();
  }

  /**
   * Generate encryption key for hidden traits
   */
  static generateEncryptionKey(): EncryptionKey {
    const manager = new HiddenTraitEncryption();
    return manager.generateKey();
  }

  /**
   * Generate encryption key from password
   */
  static generateEncryptionKeyFromPassword(password: string, salt?: Uint8Array): EncryptionKey {
    const manager = new HiddenTraitEncryption();
    return manager.generateKeyFromPassword(password, salt);
  }

  /**
   * Create generation config from directory structure (HashLips-compatible)
   */
  static createConfigFromDirectory(
    basePath: string,
    collectionSize: number,
    semaphoreGroupId?: string,
    options?: {
      rarityDelimiter?: string;
      debugLogs?: boolean;
      namePrefix?: string;
      description?: string;
    }
  ): GenerationConfig {
    return HashLipsEngine.createHashLipsConfig(basePath, collectionSize, {
      ...options,
      extraMetadata: {
        semaphoreGroupId,
        ...options
      }
    });
  }
}