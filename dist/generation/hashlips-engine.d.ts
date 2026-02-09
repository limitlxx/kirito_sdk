/**
 * HashLips Art Engine Integration
 * Adapted for privacy-enhanced metadata with custom fields
 */
import { GenerationConfig, LayerConfig, TraitConfig, TokenMetadata, Attribute, CollectionMetadata } from '../types';
export interface GeneratedNFT {
    tokenId: string;
    attributes: Attribute[];
    image: Buffer;
    metadata: TokenMetadata;
    dna: string;
}
export interface RarityStats {
    totalCombinations: number;
    actualGenerated: number;
    rarityDistribution: {
        [score: string]: number;
    };
}
export interface CompositeOptions {
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundColor?: {
        r: number;
        g: number;
        b: number;
        alpha: number;
    };
    layerPositions?: {
        [layerName: string]: {
            x: number;
            y: number;
            scale?: number;
        };
    };
    effects?: {
        [layerName: string]: {
            blur?: number;
            brightness?: number;
            contrast?: number;
        };
    };
    outputFormat?: 'png' | 'jpeg' | 'webp';
    quality?: number;
}
export interface ImageVariant {
    name: string;
    width: number;
    height: number;
    format: 'png' | 'jpeg' | 'webp';
    quality?: number;
}
/**
 * HashLips-compatible generation engine with privacy enhancements
 */
export declare class HashLipsEngine {
    private generatedDNAs;
    private rarityWeights;
    private compositeOptions;
    constructor(compositeOptions?: CompositeOptions);
    /**
     * Generate complete NFT collection
     */
    generateCollection(config: GenerationConfig): Promise<{
        nfts: GeneratedNFT[];
        stats: RarityStats;
    }>;
    /**
     * Generate a single NFT with unique DNA
     */
    private generateSingleNFT;
    /**
     * Select random trait based on weights
     */
    private selectRandomTrait;
    /**
     * Calculate yield multiplier based on rarity
     */
    private calculateYieldMultiplier;
    /**
     * Calculate rarity scores for all NFTs
     */
    private calculateRarityScores;
    /**
     * Composite multiple trait images into final NFT image
     */
    private compositeImages;
    /**
     * Fallback image compositing when Sharp is not available
     */
    private fallbackCompositeImages;
    /**
     * Advanced composite with custom positioning and effects
     */
    private advancedCompositeImages;
    /**
     * Generate multiple image variants (different sizes/formats)
     */
    generateImageVariants(traits: {
        layer: string;
        trait: TraitConfig;
        buffer: Buffer;
    }[], variants: Array<{
        name: string;
        width: number;
        height: number;
        format: 'png' | 'jpeg' | 'webp';
        quality?: number;
    }>): Promise<{
        [variantName: string]: Buffer;
    }>;
    /**
     * Calculate generation statistics
     */
    private calculateStats;
    /**
     * Validate generation configuration
     */
    private validateConfig;
    /**
     * Load layer configuration from directory structure
     */
    static loadLayersFromDirectory(basePath: string): LayerConfig[];
    /**
     * Generate NFT with custom composite options and multiple image variants
     */
    generateNFTWithVariants(tokenId: number, layers: LayerConfig[], variants: ImageVariant[], semaphoreGroupId?: string): Promise<{
        nft: GeneratedNFT;
        variants: {
            [variantName: string]: Buffer;
        };
    }>;
    /**
     * Reconstruct trait data from generated NFT for variant generation
     */
    private reconstructTraitsFromNFT;
    /**
     * Update composite options
     */
    setCompositeOptions(options: CompositeOptions): void;
    /**
     * Get current composite options
     */
    getCompositeOptions(): CompositeOptions;
    /**
     * Convert generated NFTs to collection metadata format
     */
    static convertToCollectionMetadata(nfts: GeneratedNFT[], ipfsHashes: {
        images: string[];
        metadata: string[];
        collection: string;
    }): CollectionMetadata;
    /**
     * Create standard image variants for NFT collections
     */
    static createStandardVariants(): ImageVariant[];
    /**
     * Validate image processing capabilities
     */
    static validateImageProcessing(): Promise<{
        sharp: boolean;
        canvas: boolean;
        capabilities: string[];
    }>;
}
//# sourceMappingURL=hashlips-engine.d.ts.map