"use strict";
/**
 * HashLips Art Engine Integration
 * Adapted for privacy-enhanced metadata with custom fields
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashLipsEngine = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * HashLips-compatible generation engine with privacy enhancements
 */
class HashLipsEngine {
    constructor(compositeOptions = {}) {
        this.generatedDNAs = new Set();
        this.rarityWeights = {};
        this.compositeOptions = {
            canvasWidth: 1000,
            canvasHeight: 1000,
            backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 },
            outputFormat: 'png',
            quality: 95,
            ...compositeOptions
        };
    }
    /**
     * Generate complete NFT collection
     */
    async generateCollection(config) {
        this.validateConfig(config);
        this.rarityWeights = config.rarityWeights;
        const nfts = [];
        const maxAttempts = config.collectionSize * 10; // Prevent infinite loops
        let attempts = 0;
        while (nfts.length < config.collectionSize && attempts < maxAttempts) {
            attempts++;
            try {
                const nft = await this.generateSingleNFT(nfts.length + 1, config.layers, config.semaphoreGroupId);
                if (nft && !this.generatedDNAs.has(nft.dna)) {
                    this.generatedDNAs.add(nft.dna);
                    nfts.push(nft);
                }
            }
            catch (error) {
                console.warn(`Failed to generate NFT ${nfts.length + 1}:`, error);
            }
        }
        if (nfts.length < config.collectionSize) {
            throw new Error(`Could only generate ${nfts.length} unique NFTs out of ${config.collectionSize} requested`);
        }
        // Calculate rarity scores for all generated NFTs
        this.calculateRarityScores(nfts);
        const stats = this.calculateStats(nfts, config.layers);
        return { nfts, stats };
    }
    /**
     * Generate a single NFT with unique DNA
     */
    async generateSingleNFT(tokenId, layers, semaphoreGroupId) {
        const selectedTraits = [];
        const attributes = [];
        let dna = '';
        // Select traits for each layer
        for (const layer of layers) {
            const selectedTrait = this.selectRandomTrait(layer);
            if (!selectedTrait) {
                throw new Error(`No trait selected for layer: ${layer.name}`);
            }
            // Load trait image
            const traitPath = (0, path_1.join)(layer.path, selectedTrait.filename);
            const traitBuffer = (0, fs_1.readFileSync)(traitPath);
            selectedTraits.push({
                layer: layer.name,
                trait: selectedTrait,
                buffer: traitBuffer
            });
            // Add to attributes
            attributes.push({
                trait_type: layer.name,
                value: selectedTrait.name
            });
            // Build DNA string
            dna += `${layer.name}:${selectedTrait.name};`;
        }
        // Create DNA hash
        const dnaHash = (0, crypto_1.createHash)('sha256').update(dna).digest('hex');
        // Composite image (simplified - in real implementation would use canvas/sharp)
        const compositeImage = await this.compositeImages(selectedTraits);
        // Create metadata with privacy enhancements
        const metadata = {
            name: `NFT #${tokenId}`,
            description: `Generated NFT with unique traits and privacy features`,
            image: `ipfs://placeholder-${tokenId}`, // Will be updated after IPFS upload
            attributes,
            yieldMultiplier: this.calculateYieldMultiplier(attributes),
            rarityScore: 0, // Will be calculated later
            semaphoreGroupId
        };
        return {
            tokenId: tokenId.toString(),
            attributes,
            image: compositeImage,
            metadata,
            dna: dnaHash
        };
    }
    /**
     * Select random trait based on weights
     */
    selectRandomTrait(layer) {
        const totalWeight = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);
        const random = Math.random() * totalWeight;
        let currentWeight = 0;
        for (const trait of layer.traits) {
            currentWeight += trait.weight;
            if (random <= currentWeight) {
                return trait;
            }
        }
        return layer.traits[layer.traits.length - 1]; // Fallback to last trait
    }
    /**
     * Calculate yield multiplier based on rarity
     */
    calculateYieldMultiplier(attributes) {
        let multiplier = 1.0;
        for (const attr of attributes) {
            const traitRarity = this.rarityWeights[attr.trait_type]?.[attr.value.toString()];
            if (traitRarity) {
                // Higher rarity (lower weight) = higher multiplier
                multiplier *= (1 + (1 / traitRarity));
            }
        }
        return Math.round(multiplier * 100) / 100; // Round to 2 decimal places
    }
    /**
     * Calculate rarity scores for all NFTs
     */
    calculateRarityScores(nfts) {
        // Count trait occurrences
        const traitCounts = {};
        for (const nft of nfts) {
            for (const attr of nft.attributes) {
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
        for (const nft of nfts) {
            let rarityScore = 0;
            for (const attr of nft.attributes) {
                const traitCount = traitCounts[attr.trait_type][attr.value.toString()];
                const traitRarity = nfts.length / traitCount;
                rarityScore += traitRarity;
            }
            nft.metadata.rarityScore = Math.round(rarityScore * 100) / 100;
        }
    }
    /**
     * Composite multiple trait images into final NFT image
     */
    async compositeImages(traits) {
        if (traits.length === 0) {
            throw new Error('No traits to composite');
        }
        try {
            // Import Sharp dynamically to handle potential installation issues
            const sharp = await Promise.resolve().then(() => __importStar(require('sharp')));
            // Use configured canvas dimensions
            const canvasWidth = this.compositeOptions.canvasWidth;
            const canvasHeight = this.compositeOptions.canvasHeight;
            const backgroundColor = this.compositeOptions.backgroundColor;
            // Create base canvas with configured background
            let composite = sharp.default({
                create: {
                    width: canvasWidth,
                    height: canvasHeight,
                    channels: 4, // RGBA
                    background: backgroundColor
                }
            });
            // Prepare composite operations for all trait layers
            const compositeOperations = [];
            for (const trait of traits) {
                try {
                    // Resize trait image to fit canvas while maintaining aspect ratio
                    const resizedTrait = await sharp.default(trait.buffer)
                        .resize(canvasWidth, canvasHeight, {
                        fit: 'inside', // Maintain aspect ratio
                        withoutEnlargement: false // Allow enlargement if needed
                    })
                        .png() // Ensure PNG format for transparency support
                        .toBuffer();
                    // Add to composite operations
                    compositeOperations.push({
                        input: resizedTrait,
                        top: 0,
                        left: 0,
                        blend: 'over' // Standard alpha blending
                    });
                }
                catch (error) {
                    console.warn(`Failed to process trait ${trait.trait.name} from layer ${trait.layer}:`, error);
                    // Continue with other traits instead of failing completely
                }
            }
            // Apply all composite operations at once for better performance
            if (compositeOperations.length > 0) {
                composite = composite.composite(compositeOperations);
            }
            else {
                throw new Error('No valid traits could be processed for compositing');
            }
            // Generate final PNG buffer with optimization
            const finalImage = await composite
                .png({
                quality: 95, // High quality
                compressionLevel: 6, // Balanced compression
                adaptiveFiltering: true, // Better compression for complex images
                palette: false // Use full color depth
            })
                .toBuffer();
            return finalImage;
        }
        catch (error) {
            // Fallback to simple implementation if Sharp fails
            console.warn('Sharp image processing failed, falling back to simple implementation:', error);
            return this.fallbackCompositeImages(traits);
        }
    }
    /**
     * Fallback image compositing when Sharp is not available
     */
    async fallbackCompositeImages(traits) {
        if (traits.length === 0) {
            throw new Error('No traits to composite');
        }
        try {
            // Try Canvas API as fallback
            const { createCanvas, loadImage } = await Promise.resolve().then(() => __importStar(require('canvas')));
            const canvasWidth = 1000;
            const canvasHeight = 1000;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            // Set transparent background
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            // Composite each trait layer
            for (const trait of traits) {
                try {
                    const image = await loadImage(trait.buffer);
                    // Calculate scaling to fit canvas while maintaining aspect ratio
                    const scale = Math.min(canvasWidth / image.width, canvasHeight / image.height);
                    const scaledWidth = image.width * scale;
                    const scaledHeight = image.height * scale;
                    // Center the image
                    const x = (canvasWidth - scaledWidth) / 2;
                    const y = (canvasHeight - scaledHeight) / 2;
                    // Draw the trait
                    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
                }
                catch (error) {
                    console.warn(`Failed to process trait ${trait.trait.name} with Canvas:`, error);
                }
            }
            // Convert canvas to buffer
            return canvas.toBuffer('image/png');
        }
        catch (error) {
            // Final fallback - return first trait buffer
            console.warn('Canvas fallback failed, using first trait as final image:', error);
            return traits[0].buffer;
        }
    }
    /**
     * Advanced composite with custom positioning and effects
     */
    async advancedCompositeImages(traits, options = {}) {
        if (traits.length === 0) {
            throw new Error('No traits to composite');
        }
        const { canvasWidth = 1000, canvasHeight = 1000, backgroundColor = { r: 0, g: 0, b: 0, alpha: 0 }, layerPositions = {}, effects = {} } = options;
        try {
            const sharp = await Promise.resolve().then(() => __importStar(require('sharp')));
            // Create base canvas
            let composite = sharp.default({
                create: {
                    width: canvasWidth,
                    height: canvasHeight,
                    channels: 4,
                    background: backgroundColor
                }
            });
            const compositeOperations = [];
            for (const trait of traits) {
                try {
                    let traitProcessor = sharp.default(trait.buffer);
                    // Apply effects if specified
                    const layerEffects = effects[trait.layer];
                    if (layerEffects) {
                        if (layerEffects.blur) {
                            traitProcessor = traitProcessor.blur(layerEffects.blur);
                        }
                        if (layerEffects.brightness) {
                            traitProcessor = traitProcessor.modulate({ brightness: layerEffects.brightness });
                        }
                        if (layerEffects.contrast) {
                            traitProcessor = traitProcessor.linear(layerEffects.contrast, 0);
                        }
                    }
                    // Get position for this layer
                    const position = layerPositions[trait.layer] || { x: 0, y: 0, scale: 1 };
                    const scale = position.scale || 1;
                    // Resize trait
                    const resizedTrait = await traitProcessor
                        .resize(Math.round(canvasWidth * scale), Math.round(canvasHeight * scale), {
                        fit: 'inside',
                        withoutEnlargement: false
                    })
                        .png()
                        .toBuffer();
                    compositeOperations.push({
                        input: resizedTrait,
                        top: position.y,
                        left: position.x,
                        blend: 'over'
                    });
                }
                catch (error) {
                    console.warn(`Failed to process trait ${trait.trait.name}:`, error);
                }
            }
            if (compositeOperations.length > 0) {
                composite = composite.composite(compositeOperations);
            }
            return await composite
                .png({ quality: 95, compressionLevel: 6 })
                .toBuffer();
        }
        catch (error) {
            console.warn('Advanced compositing failed, falling back to basic implementation:', error);
            return this.compositeImages(traits);
        }
    }
    /**
     * Generate multiple image variants (different sizes/formats)
     */
    async generateImageVariants(traits, variants) {
        // First create the base high-resolution image
        const baseImage = await this.compositeImages(traits);
        const results = {};
        try {
            const sharp = await Promise.resolve().then(() => __importStar(require('sharp')));
            for (const variant of variants) {
                try {
                    let processor = sharp.default(baseImage)
                        .resize(variant.width, variant.height, {
                        fit: 'cover',
                        position: 'center'
                    });
                    // Apply format-specific options
                    switch (variant.format) {
                        case 'png':
                            processor = processor.png({
                                quality: variant.quality || 95,
                                compressionLevel: 6
                            });
                            break;
                        case 'jpeg':
                            processor = processor.jpeg({
                                quality: variant.quality || 90,
                                progressive: true
                            });
                            break;
                        case 'webp':
                            processor = processor.webp({
                                quality: variant.quality || 85,
                                effort: 4
                            });
                            break;
                    }
                    results[variant.name] = await processor.toBuffer();
                }
                catch (error) {
                    console.warn(`Failed to generate variant ${variant.name}:`, error);
                }
            }
        }
        catch (error) {
            console.warn('Sharp not available for variant generation:', error);
            // Fallback: just return the base image for all variants
            variants.forEach(variant => {
                results[variant.name] = baseImage;
            });
        }
        return results;
    }
    /**
     * Calculate generation statistics
     */
    calculateStats(nfts, layers) {
        // Calculate total possible combinations
        let totalCombinations = 1;
        for (const layer of layers) {
            totalCombinations *= layer.traits.length;
        }
        // Calculate rarity distribution
        const rarityDistribution = {};
        for (const nft of nfts) {
            const scoreRange = Math.floor(nft.metadata.rarityScore / 10) * 10;
            const key = `${scoreRange}-${scoreRange + 9}`;
            rarityDistribution[key] = (rarityDistribution[key] || 0) + 1;
        }
        return {
            totalCombinations,
            actualGenerated: nfts.length,
            rarityDistribution
        };
    }
    /**
     * Validate generation configuration
     */
    validateConfig(config) {
        if (!config.layers || config.layers.length === 0) {
            throw new Error('At least one layer is required');
        }
        if (config.collectionSize <= 0) {
            throw new Error('Collection size must be positive');
        }
        for (const layer of config.layers) {
            if (!layer.traits || layer.traits.length === 0) {
                throw new Error(`Layer ${layer.name} must have at least one trait`);
            }
            // Validate trait files exist
            for (const trait of layer.traits) {
                const traitPath = (0, path_1.join)(layer.path, trait.filename);
                try {
                    const stats = (0, fs_1.statSync)(traitPath);
                    if (!stats.isFile()) {
                        throw new Error(`Trait file not found: ${traitPath}`);
                    }
                }
                catch (error) {
                    throw new Error(`Cannot access trait file: ${traitPath}`);
                }
            }
        }
    }
    /**
     * Load layer configuration from directory structure
     */
    static loadLayersFromDirectory(basePath) {
        const layers = [];
        try {
            const layerDirs = (0, fs_1.readdirSync)(basePath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort();
            for (const layerName of layerDirs) {
                const layerPath = (0, path_1.join)(basePath, layerName);
                const traits = [];
                const traitFiles = (0, fs_1.readdirSync)(layerPath)
                    .filter(file => ['.png', '.jpg', '.jpeg', '.gif'].includes((0, path_1.extname)(file).toLowerCase()))
                    .sort();
                for (const filename of traitFiles) {
                    const traitName = filename.replace((0, path_1.extname)(filename), '');
                    traits.push({
                        name: traitName,
                        weight: 1, // Default weight, can be customized
                        filename
                    });
                }
                if (traits.length > 0) {
                    layers.push({
                        name: layerName,
                        path: layerPath,
                        weight: 1, // Default layer weight
                        traits
                    });
                }
            }
        }
        catch (error) {
            throw new Error(`Failed to load layers from directory: ${error}`);
        }
        return layers;
    }
    /**
     * Generate NFT with custom composite options and multiple image variants
     */
    async generateNFTWithVariants(tokenId, layers, variants, semaphoreGroupId) {
        // Generate base NFT
        const nft = await this.generateSingleNFT(tokenId, layers, semaphoreGroupId);
        if (!nft) {
            throw new Error(`Failed to generate NFT ${tokenId}`);
        }
        // Generate image variants
        const selectedTraits = this.reconstructTraitsFromNFT(nft, layers);
        const imageVariants = await this.generateImageVariants(selectedTraits, variants);
        return {
            nft,
            variants: imageVariants
        };
    }
    /**
     * Reconstruct trait data from generated NFT for variant generation
     */
    reconstructTraitsFromNFT(nft, layers) {
        const traits = [];
        for (const attr of nft.attributes) {
            const layer = layers.find(l => l.name === attr.trait_type);
            if (layer) {
                const trait = layer.traits.find(t => t.name === attr.value);
                if (trait) {
                    try {
                        // In a real implementation, you'd load the actual trait file
                        // For now, we'll use a placeholder buffer
                        const traitPath = (0, path_1.join)(layer.path, trait.filename);
                        const traitBuffer = (0, fs_1.readFileSync)(traitPath);
                        traits.push({
                            layer: layer.name,
                            trait,
                            buffer: traitBuffer
                        });
                    }
                    catch (error) {
                        console.warn(`Could not load trait file for ${layer.name}/${trait.name}:`, error);
                    }
                }
            }
        }
        return traits;
    }
    /**
     * Update composite options
     */
    setCompositeOptions(options) {
        this.compositeOptions = {
            ...this.compositeOptions,
            ...options
        };
    }
    /**
     * Get current composite options
     */
    getCompositeOptions() {
        return { ...this.compositeOptions };
    }
    /**
     * Convert generated NFTs to collection metadata format
     */
    static convertToCollectionMetadata(nfts, ipfsHashes) {
        const tokens = nfts.map((nft, index) => ({
            ...nft.metadata,
            image: `ipfs://${ipfsHashes.images[index]}`
        }));
        return {
            tokens,
            ipfsHashes,
            totalSupply: nfts.length
        };
    }
    /**
     * Create standard image variants for NFT collections
     */
    static createStandardVariants() {
        return [
            {
                name: 'original',
                width: 1000,
                height: 1000,
                format: 'png',
                quality: 95
            },
            {
                name: 'large',
                width: 512,
                height: 512,
                format: 'png',
                quality: 90
            },
            {
                name: 'medium',
                width: 256,
                height: 256,
                format: 'webp',
                quality: 85
            },
            {
                name: 'thumbnail',
                width: 128,
                height: 128,
                format: 'webp',
                quality: 80
            },
            {
                name: 'preview',
                width: 64,
                height: 64,
                format: 'jpeg',
                quality: 75
            }
        ];
    }
    /**
     * Validate image processing capabilities
     */
    static async validateImageProcessing() {
        const capabilities = [];
        let sharpAvailable = false;
        let canvasAvailable = false;
        // Test Sharp
        try {
            const sharp = await Promise.resolve().then(() => __importStar(require('sharp')));
            await sharp.default(Buffer.alloc(100)).png().toBuffer();
            sharpAvailable = true;
            capabilities.push('sharp', 'high-performance', 'webp', 'advanced-effects');
        }
        catch (error) {
            console.warn('Sharp not available:', error);
        }
        // Test Canvas
        try {
            const { createCanvas } = await Promise.resolve().then(() => __importStar(require('canvas')));
            createCanvas(100, 100);
            canvasAvailable = true;
            capabilities.push('canvas', 'fallback-rendering');
        }
        catch (error) {
            console.warn('Canvas not available:', error);
        }
        if (!sharpAvailable && !canvasAvailable) {
            capabilities.push('basic-only');
        }
        return {
            sharp: sharpAvailable,
            canvas: canvasAvailable,
            capabilities
        };
    }
}
exports.HashLipsEngine = HashLipsEngine;
//# sourceMappingURL=hashlips-engine.js.map