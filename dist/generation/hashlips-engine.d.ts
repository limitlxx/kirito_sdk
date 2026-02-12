/**
 * HashLips Art Engine Integration
 * Adapted for privacy-enhanced metadata with custom fields
 * Based on the original HashLips Art Engine implementation
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
    blend?: 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';
    opacity?: number;
    bypassDNA?: boolean;
}
export interface ImageVariant {
    name: string;
    width: number;
    height: number;
    format: 'png' | 'jpeg' | 'webp' | 'gif';
    quality?: number;
    animated?: boolean;
    frames?: number;
    delay?: number;
}
export interface HashLipsLayerConfig extends LayerConfig {
    blend?: string;
    opacity?: number;
    bypassDNA?: boolean;
    displayName?: string;
}
/**
 * HashLips-compatible generation engine with privacy enhancements
 */
export declare class HashLipsEngine {
    private generatedDNAs;
    private rarityWeights;
    private compositeOptions;
    private debugLogs;
    constructor(compositeOptions?: CompositeOptions);
    /**
     * Enable/disable debug logging (HashLips compatibility)
     */
    setDebugLogs(enabled: boolean): void;
    private log;
    /**
     * Generate complete NFT collection
     */
    generateCollection(config: GenerationConfig): Promise<{
        nfts: GeneratedNFT[];
        stats: RarityStats;
    }>;
    /**
     * Generate a single NFT with unique DNA (HashLips-style)
     */
    private generateSingleNFT;
    /**
     * Select random trait based on weights (HashLips algorithm)
     */
    private selectRandomTrait;
    /**
     * Get collection name (can be customized)
     */
    private getCollectionName;
    /**
     * Get collection description (can be customized)
     */
    private getCollectionDescription;
    /**
     * Calculate yield multiplier based on rarity
     */
    private calculateYieldMultiplier;
    /**
     * Calculate rarity scores for all NFTs
     */
    private calculateRarityScores;
    /**
     * Composite multiple trait images into final NFT image (HashLips-style)
     */
    private compositeImages;
    /**
     * Composite using Canvas API (HashLips original approach)
     */
    private compositeWithCanvas;
    /**
     * Composite using Sharp (fallback)
     */
    private compositeWithSharp;
    /**
     * Get layer-specific options
     */
    private getLayerOptions;
    /**
     * Create animated GIF thumbnail
     */
    createAnimatedGIF(traits: {
        layer: string;
        trait: TraitConfig;
        buffer: Buffer;
    }[], options?: {
        width?: number;
        height?: number;
        frames?: number;
        delay?: number;
        quality?: number;
    }): Promise<Buffer>;
    /**
     * Get frame-specific effects for animation
     */
    private getFrameEffect;
    /**
     * Fallback image compositing when Sharp is not available
     */
    private fallbackCompositeImages;
    /**
     * Advanced composite with custom positioning and effects
     */
    private advancedCompositeImages;
    /**
     * Generate multiple image variants (different sizes/formats) including GIF thumbnails
     */
    generateImageVariants(traits: {
        layer: string;
        trait: TraitConfig;
        buffer: Buffer;
    }[], variants: Array<{
        name: string;
        width: number;
        height: number;
        format: 'png' | 'jpeg' | 'webp' | 'gif';
        quality?: number;
        animated?: boolean;
        frames?: number;
        delay?: number;
    }>): Promise<{
        [variantName: string]: Buffer;
    }>;
    /**
     * Resize image to specific variant requirements
     */
    private resizeImage;
    /**
     * Calculate generation statistics
     */
    private calculateStats;
    /**
     * Validate generation configuration
     */
    private validateConfig;
    /**
     * Load layer configuration from directory structure (HashLips-style)
     */
    static loadLayersFromDirectory(basePath: string, rarityDelimiter?: string): LayerConfig[];
    /**
     * Parse HashLips-style trait filename (e.g., "trait_name#70.png")
     */
    private static parseTraitFilename;
    /**
     * Create HashLips-compatible generation config
     */
    static createHashLipsConfig(layersPath: string, collectionSize: number, options?: {
        rarityDelimiter?: string;
        shuffleLayerConfigurations?: boolean;
        debugLogs?: boolean;
        format?: {
            width: number;
            height: number;
            smoothing: boolean;
        };
        background?: {
            generate: boolean;
            brightness: string;
            static: boolean;
            default: string;
        };
        extraMetadata?: any;
        namePrefix?: string;
        description?: string;
        baseUri?: string;
        uniqueDnaTorrance?: number;
    }): GenerationConfig;
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
     * Create standard image variants for NFT collections (including GIF thumbnails)
     */
    static createStandardVariants(): ImageVariant[];
    /**
     * Create HashLips-compatible variants (matching original dimensions)
     */
    static createHashLipsVariants(): ImageVariant[];
    /**
     * Create collection thumbnail GIF that cycles through all NFTs
     */
    createCollectionThumbnailGIF(nftImages: Buffer[], options?: {
        width?: number;
        height?: number;
        delay?: number;
        quality?: number;
        loops?: number;
    }): Promise<Buffer>;
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