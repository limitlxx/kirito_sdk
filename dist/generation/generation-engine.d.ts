/**
 * Generation Engine Implementation
 * Main implementation of the GenerationEngine interface
 */
import { GenerationEngine } from '../interfaces/generation-engine';
import { GenerationConfig, CollectionMetadata, IPFSHashes, HiddenTraits, EncryptionKey, EncryptedData, ImageData, MetadataSet } from '../types';
import { CompositeOptions, ImageVariant } from './hashlips-engine';
import { KiritoSDKConfig } from '../types';
/**
 * Main Generation Engine implementation
 */
export declare class KiritoGenerationEngine implements GenerationEngine {
    private hashLipsEngine;
    private ipfsClient;
    private encryptionManager;
    constructor(config: KiritoSDKConfig, compositeOptions?: CompositeOptions);
    /**
     * Generate a complete NFT collection from configuration
     */
    generateCollection(config: GenerationConfig): Promise<CollectionMetadata>;
    /**
     * Upload images and metadata to IPFS with batch optimization and retry logic
     */
    uploadToIPFS(images: ImageData[], metadata: MetadataSet): Promise<IPFSHashes>;
    /**
     * Encrypt hidden traits for mystery box functionality
     */
    encryptHiddenTraits(traits: HiddenTraits, key: EncryptionKey): Promise<EncryptedData>;
    /**
     * Decrypt hidden traits
     */
    decryptHiddenTraits(encryptedData: EncryptedData, key: EncryptionKey): Promise<HiddenTraits>;
    /**
     * Encrypt traits selectively (some hidden, some visible)
     */
    encryptSelectiveTraits(traits: HiddenTraits, key: EncryptionKey, traitKeysToHide: string[]): Promise<{
        encrypted: EncryptedData;
        visible: HiddenTraits;
    }>;
    /**
     * Create time-locked encryption for traits
     */
    createTimeLockedTraits(traits: HiddenTraits, unlockTimestamp: number, masterKey: EncryptionKey): Promise<EncryptedData>;
    /**
     * Generate trait commitments for bluffing mechanism
     */
    createTraitCommitments(traits: HiddenTraits, nonce: Uint8Array): {
        [key: string]: string;
    };
    /**
     * Generate category proof without revealing specific trait
     */
    generateCategoryProof(trait: any, category: string, key: EncryptionKey): Promise<EncryptedData>;
    /**
     * Calculate rarity scores for generated NFTs
     */
    calculateRarityScores(metadata: MetadataSet): Promise<number[]>;
    /**
     * Validate generation configuration
     */
    validateConfig(config: GenerationConfig): Promise<boolean>;
    /**
     * Generate collection with multiple image variants
     */
    generateCollectionWithVariants(config: GenerationConfig, variants: ImageVariant[]): Promise<{
        collection: CollectionMetadata;
        variants: {
            [tokenId: string]: {
                [variantName: string]: Buffer;
            };
        };
    }>;
    /**
     * Set composite options for image generation
     */
    setCompositeOptions(options: CompositeOptions): void;
    /**
     * Get current composite options
     */
    getCompositeOptions(): CompositeOptions;
    /**
     * Validate image processing capabilities
     */
    static validateImageProcessing(): Promise<{
        sharp: boolean;
        canvas: boolean;
        capabilities: string[];
    }>;
    /**
     * Generate encryption key for hidden traits
     */
    static generateEncryptionKey(): EncryptionKey;
    /**
     * Generate encryption key from password
     */
    static generateEncryptionKeyFromPassword(password: string, salt?: Uint8Array): EncryptionKey;
    /**
     * Create generation config from directory structure
     */
    static createConfigFromDirectory(basePath: string, collectionSize: number, semaphoreGroupId?: string): GenerationConfig;
}
//# sourceMappingURL=generation-engine.d.ts.map