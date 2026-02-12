/**
 * HashLips Art Engine Integration
 * Adapted for privacy-enhanced metadata with custom fields
 * Based on the original HashLips Art Engine implementation
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import {
  GenerationConfig,
  LayerConfig,
  TraitConfig,
  TokenMetadata,
  Attribute,
  CollectionMetadata,
  MetadataSet,
  ImageData
} from '../types';

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
  rarityDistribution: { [score: string]: number };
}

export interface CompositeOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  backgroundColor?: { r: number; g: number; b: number; alpha: number };
  layerPositions?: { [layerName: string]: { x: number; y: number; scale?: number } };
  effects?: { [layerName: string]: { blur?: number; brightness?: number; contrast?: number } };
  outputFormat?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  // HashLips-specific options
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
  animated?: boolean; // For GIF creation
  frames?: number;    // Number of frames for animated GIF
  delay?: number;     // Delay between frames in ms
}

export interface HashLipsLayerConfig extends LayerConfig {
  // HashLips-specific layer options
  blend?: string;
  opacity?: number;
  bypassDNA?: boolean;
  displayName?: string;
}

/**
 * HashLips-compatible generation engine with privacy enhancements
 */
export class HashLipsEngine {
  private generatedDNAs: Set<string> = new Set();
  private rarityWeights: { [key: string]: { [key: string]: number } } = {};
  private compositeOptions: CompositeOptions;
  private debugLogs: boolean = false;

  constructor(compositeOptions: CompositeOptions = {}) {
    this.compositeOptions = {
      canvasWidth: 512,
      canvasHeight: 512,
      backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 },
      outputFormat: 'png',
      quality: 95,
      blend: 'source-over',
      opacity: 1,
      bypassDNA: false,
      ...compositeOptions
    };
  }

  /**
   * Enable/disable debug logging (HashLips compatibility)
   */
  setDebugLogs(enabled: boolean): void {
    this.debugLogs = enabled;
  }

  private log(...args: any[]): void {
    if (this.debugLogs) {
      console.log('[HashLips Engine]', ...args);
    }
  }

  /**
   * Generate complete NFT collection
   */
  async generateCollection(config: GenerationConfig): Promise<{
    nfts: GeneratedNFT[];
    stats: RarityStats;
  }> {
    this.validateConfig(config);
    this.rarityWeights = config.rarityWeights;
    
    const nfts: GeneratedNFT[] = [];
    const maxAttempts = config.collectionSize * 10; // Prevent infinite loops
    let attempts = 0;

    while (nfts.length < config.collectionSize && attempts < maxAttempts) {
      attempts++;
      
      try {
        const nft = await this.generateSingleNFT(
          nfts.length + 1,
          config.layers,
          config.semaphoreGroupId
        );
        
        if (nft && !this.generatedDNAs.has(nft.dna)) {
          this.generatedDNAs.add(nft.dna);
          nfts.push(nft);
        }
      } catch (error) {
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
   * Generate a single NFT with unique DNA (HashLips-style)
   */
  private async generateSingleNFT(
    tokenId: number,
    layers: LayerConfig[],
    semaphoreGroupId?: string
  ): Promise<GeneratedNFT | null> {
    const selectedTraits: { layer: string; trait: TraitConfig; buffer: Buffer }[] = [];
    const attributes: Attribute[] = [];
    let dna = '';

    this.log(`Generating NFT #${tokenId}...`);

    // Select traits for each layer (HashLips approach)
    for (const layer of layers) {
      const selectedTrait = this.selectRandomTrait(layer);
      if (!selectedTrait) {
        throw new Error(`No trait selected for layer: ${layer.name}`);
      }

      this.log(`Selected trait: ${layer.name} -> ${selectedTrait.name} (weight: ${selectedTrait.weight})`);

      // Load trait image
      const traitPath = join(layer.path, selectedTrait.filename);
      let traitBuffer: Buffer;
      
      try {
        traitBuffer = readFileSync(traitPath);
      } catch (error) {
        this.log(`Failed to load trait file: ${traitPath}`, error);
        // Skip this trait and continue
        continue;
      }
      
      selectedTraits.push({
        layer: layer.name,
        trait: selectedTrait,
        buffer: traitBuffer
      });

      // Add to attributes (HashLips format)
      attributes.push({
        trait_type: layer.name,
        value: selectedTrait.name
      });

      // Build DNA string (HashLips approach)
      dna += `${layer.name}:${selectedTrait.name};`;
    }

    // Create DNA hash (HashLips style)
    const dnaHash = createHash('sha256').update(dna).digest('hex');

    this.log(`Generated DNA: ${dnaHash.substring(0, 16)}...`);

    // Check for DNA uniqueness
    if (this.generatedDNAs.has(dnaHash)) {
      this.log(`Duplicate DNA found for NFT #${tokenId}, skipping...`);
      return null;
    }

    // Composite image
    const compositeImage = await this.compositeImages(selectedTraits);

    // Create metadata with privacy enhancements
    const metadata: TokenMetadata = {
      name: `${this.getCollectionName()} #${tokenId}`,
      description: this.getCollectionDescription(),
      image: `ipfs://placeholder-${tokenId}`, // Will be updated after IPFS upload
      attributes,
      yieldMultiplier: this.calculateYieldMultiplier(attributes),
      rarityScore: 0, // Will be calculated later
      semaphoreGroupId
    };

    this.log(`Successfully generated NFT #${tokenId}`);

    return {
      tokenId: tokenId.toString(),
      attributes,
      image: compositeImage,
      metadata,
      dna: dnaHash
    };
  }

  /**
   * Select random trait based on weights (HashLips algorithm)
   */
  private selectRandomTrait(layer: LayerConfig): TraitConfig | null {
    if (!layer.traits || layer.traits.length === 0) {
      return null;
    }

    // Calculate total weight
    const totalWeight = layer.traits.reduce((sum, trait) => sum + trait.weight, 0);
    
    if (totalWeight === 0) {
      // If no weights, select randomly
      return layer.traits[Math.floor(Math.random() * layer.traits.length)];
    }

    // Weighted random selection (HashLips approach)
    const random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const trait of layer.traits) {
      currentWeight += trait.weight;
      if (random <= currentWeight) {
        return trait;
      }
    }
    
    // Fallback to last trait
    return layer.traits[layer.traits.length - 1];
  }

  /**
   * Get collection name (can be customized)
   */
  private getCollectionName(): string {
    return 'Kirito NFT';
  }

  /**
   * Get collection description (can be customized)
   */
  private getCollectionDescription(): string {
    return 'Privacy-enhanced NFT with yield generation capabilities and mystery box features';
  }

  /**
   * Calculate yield multiplier based on rarity
   */
  private calculateYieldMultiplier(attributes: Attribute[]): number {
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
  private calculateRarityScores(nfts: GeneratedNFT[]): void {
    // Count trait occurrences
    const traitCounts: { [key: string]: { [key: string]: number } } = {};
    
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
   * Composite multiple trait images into final NFT image (HashLips-style)
   */
  private async compositeImages(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[]
  ): Promise<Buffer> {
    if (traits.length === 0) {
      throw new Error('No traits to composite');
    }

    this.log(`Compositing ${traits.length} traits...`);

    try {
      // Try Canvas API first (HashLips original approach)
      return await this.compositeWithCanvas(traits);
    } catch (canvasError) {
      this.log('Canvas compositing failed, trying Sharp:', canvasError);
      
      try {
        // Fallback to Sharp
        return await this.compositeWithSharp(traits);
      } catch (sharpError) {
        this.log('Sharp compositing failed, using simple fallback:', sharpError);
        // Final fallback
        return traits[0].buffer;
      }
    }
  }

  /**
   * Composite using Canvas API (HashLips original approach)
   */
  private async compositeWithCanvas(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[]
  ): Promise<Buffer> {
    const { createCanvas, loadImage } = await import('canvas');
    
    const canvasWidth = this.compositeOptions.canvasWidth!;
    const canvasHeight = this.compositeOptions.canvasHeight!;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Set background
    const bg = this.compositeOptions.backgroundColor!;
    if (bg.alpha > 0) {
      ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${bg.alpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Composite each trait layer (HashLips style)
    for (const trait of traits) {
      try {
        this.log(`Drawing layer: ${trait.layer} - ${trait.trait.name}`);
        
        const image = await loadImage(trait.buffer);
        
        // Apply layer-specific options if available
        const layerOptions = this.getLayerOptions(trait.layer);
        
        // Set blend mode (HashLips feature)
        if (layerOptions.blend) {
          ctx.globalCompositeOperation = layerOptions.blend as any;
        } else {
          ctx.globalCompositeOperation = (this.compositeOptions.blend as any) || 'source-over';
        }
        
        // Set opacity (HashLips feature)
        ctx.globalAlpha = layerOptions.opacity !== undefined ? layerOptions.opacity : (this.compositeOptions.opacity || 1);
        
        // Get position for this layer
        const position = this.compositeOptions.layerPositions?.[trait.layer] || { x: 0, y: 0, scale: 1 };
        const scale = position.scale || 1;
        
        // Calculate dimensions
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;
        
        // Center the image if no specific position
        const x = position.x || (canvasWidth - scaledWidth) / 2;
        const y = position.y || (canvasHeight - scaledHeight) / 2;
        
        // Draw the trait
        ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
        
        // Reset for next layer
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        
      } catch (error) {
        this.log(`Failed to process trait ${trait.trait.name}:`, error);
      }
    }

    // Convert canvas to buffer
    return canvas.toBuffer('image/png');
  }

  /**
   * Composite using Sharp (fallback)
   */
  private async compositeWithSharp(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[]
  ): Promise<Buffer> {
    const sharp = await import('sharp');
    
    const canvasWidth = this.compositeOptions.canvasWidth!;
    const canvasHeight = this.compositeOptions.canvasHeight!;
    const backgroundColor = this.compositeOptions.backgroundColor!;

    // Create base canvas
    let composite = sharp.default({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: backgroundColor
      }
    });

    const compositeOperations: Array<{ input: Buffer; top: number; left: number; blend?: 'over' | 'in' | 'out' | 'atop' | 'dest' | 'dest-over' | 'dest-in' | 'dest-out' | 'dest-atop' | 'xor' | 'add' | 'saturate' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'colour-dodge' | 'colour-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' }> = [];

    for (const trait of traits) {
      try {
        const position = this.compositeOptions.layerPositions?.[trait.layer] || { x: 0, y: 0, scale: 1 };
        const scale = position.scale || 1;

        const resizedTrait = await sharp.default(trait.buffer)
          .resize(
            Math.round(canvasWidth * scale), 
            Math.round(canvasHeight * scale), 
            {
              fit: 'inside',
              withoutEnlargement: false
            }
          )
          .png()
          .toBuffer();

        compositeOperations.push({
          input: resizedTrait,
          top: position.y,
          left: position.x,
          blend: 'over' as const
        });

      } catch (error) {
        this.log(`Failed to process trait ${trait.trait.name} with Sharp:`, error);
      }
    }

    if (compositeOperations.length > 0) {
      composite = composite.composite(compositeOperations);
    }

    return await composite
      .png({ quality: this.compositeOptions.quality || 95 })
      .toBuffer();
  }

  /**
   * Get layer-specific options
   */
  private getLayerOptions(layerName: string): { blend?: string; opacity?: number } {
    const layerPos = this.compositeOptions.layerPositions?.[layerName];
    return {
      blend: layerPos?.['blend' as keyof typeof layerPos] as string | undefined,
      opacity: layerPos?.['opacity' as keyof typeof layerPos] as number | undefined
    };
  }

  /**
   * Create animated GIF thumbnail
   */
  async createAnimatedGIF(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[],
    options: {
      width?: number;
      height?: number;
      frames?: number;
      delay?: number;
      quality?: number;
    } = {}
  ): Promise<Buffer> {
    const {
      width = 128,
      height = 128,
      frames = 8,
      delay = 200,
      quality = 10
    } = options;

    try {
      const { createCanvas, loadImage } = await import('canvas');
      const GIFEncoder = (await import('gifencoder')).default;
      
      const encoder = new GIFEncoder(width, height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Configure GIF encoder
      encoder.start();
      encoder.setRepeat(0); // Loop forever
      encoder.setDelay(delay);
      encoder.setQuality(quality);

      this.log(`Creating animated GIF with ${frames} frames...`);

      // Create frames with different effects
      for (let frame = 0; frame < frames; frame++) {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set background
        const bg = this.compositeOptions.backgroundColor!;
        if (bg.alpha > 0) {
          ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${bg.alpha})`;
          ctx.fillRect(0, 0, width, height);
        }

        // Create frame-specific effects
        const frameEffect = this.getFrameEffect(frame, frames);
        
        // Composite traits with frame effects
        for (const trait of traits) {
          try {
            const image = await loadImage(trait.buffer);
            
            // Apply frame-specific transformations
            ctx.save();
            
            // Apply rotation or scale based on frame
            const centerX = width / 2;
            const centerY = height / 2;
            ctx.translate(centerX, centerY);
            
            if (frameEffect.rotate) {
              ctx.rotate(frameEffect.rotate);
            }
            
            if (frameEffect.scale) {
              ctx.scale(frameEffect.scale, frameEffect.scale);
            }
            
            ctx.globalAlpha = frameEffect.opacity || 1;
            
            // Calculate scaled dimensions
            const scale = Math.min(width / image.width, height / image.height) * 0.8;
            const scaledWidth = image.width * scale;
            const scaledHeight = image.height * scale;
            
            // Draw centered
            ctx.drawImage(
              image, 
              -scaledWidth / 2, 
              -scaledHeight / 2, 
              scaledWidth, 
              scaledHeight
            );
            
            ctx.restore();
            
          } catch (error) {
            this.log(`Failed to process trait ${trait.trait.name} for GIF frame ${frame}:`, error);
          }
        }

        // Add frame to GIF
        encoder.addFrame(ctx as any);
      }

      encoder.finish();
      
      this.log('Animated GIF created successfully');
      return encoder.out.getData();

    } catch (error) {
      this.log('GIF creation failed, creating static thumbnail:', error);
      
      // Fallback to static thumbnail
      const staticImage = await this.compositeImages(traits);
      
      try {
        const sharp = await import('sharp');
        return await sharp.default(staticImage)
          .resize(width, height, { fit: 'cover' })
          .png()
          .toBuffer();
      } catch (sharpError) {
        return staticImage;
      }
    }
  }

  /**
   * Get frame-specific effects for animation
   */
  private getFrameEffect(frame: number, totalFrames: number): {
    rotate?: number;
    scale?: number;
    opacity?: number;
  } {
    const progress = frame / totalFrames;
    
    return {
      rotate: Math.sin(progress * Math.PI * 2) * 0.1, // Subtle rotation
      scale: 1 + Math.sin(progress * Math.PI * 2) * 0.05, // Subtle scaling
      opacity: 0.9 + Math.sin(progress * Math.PI * 2) * 0.1 // Subtle opacity change
    };
  }

  /**
   * Fallback image compositing when Sharp is not available
   */
  private async fallbackCompositeImages(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[]
  ): Promise<Buffer> {
    if (traits.length === 0) {
      throw new Error('No traits to composite');
    }

    try {
      // Try Canvas API as fallback
      const { createCanvas, loadImage } = await import('canvas');
      
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
          const scale = Math.min(
            canvasWidth / image.width,
            canvasHeight / image.height
          );
          
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;
          
          // Center the image
          const x = (canvasWidth - scaledWidth) / 2;
          const y = (canvasHeight - scaledHeight) / 2;
          
          // Draw the trait
          ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
          
        } catch (error) {
          console.warn(`Failed to process trait ${trait.trait.name} with Canvas:`, error);
        }
      }

      // Convert canvas to buffer
      return canvas.toBuffer('image/png');

    } catch (error) {
      // Final fallback - return first trait buffer
      console.warn('Canvas fallback failed, using first trait as final image:', error);
      return traits[0].buffer;
    }
  }

  /**
   * Advanced composite with custom positioning and effects
   */
  private async advancedCompositeImages(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[],
    options: {
      canvasWidth?: number;
      canvasHeight?: number;
      backgroundColor?: { r: number; g: number; b: number; alpha: number };
      layerPositions?: { [layerName: string]: { x: number; y: number; scale?: number } };
      effects?: { [layerName: string]: { blur?: number; brightness?: number; contrast?: number } };
    } = {}
  ): Promise<Buffer> {
    if (traits.length === 0) {
      throw new Error('No traits to composite');
    }

    const {
      canvasWidth = 1000,
      canvasHeight = 1000,
      backgroundColor = { r: 0, g: 0, b: 0, alpha: 0 },
      layerPositions = {},
      effects = {}
    } = options;

    try {
      const sharp = await import('sharp');
      
      // Create base canvas
      let composite = sharp.default({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: backgroundColor
        }
      });

      const compositeOperations: Array<{ input: Buffer; top: number; left: number; blend?: 'over' | 'in' | 'out' | 'atop' | 'dest' | 'dest-over' | 'dest-in' | 'dest-out' | 'dest-atop' | 'xor' | 'add' | 'saturate' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'colour-dodge' | 'colour-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' }> = [];

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
            .resize(
              Math.round(canvasWidth * scale), 
              Math.round(canvasHeight * scale), 
              {
                fit: 'inside',
                withoutEnlargement: false
              }
            )
            .png()
            .toBuffer();

          compositeOperations.push({
            input: resizedTrait,
            top: position.y,
            left: position.x,
            blend: 'over' as const
          });

        } catch (error) {
          console.warn(`Failed to process trait ${trait.trait.name}:`, error);
        }
      }

      if (compositeOperations.length > 0) {
        composite = composite.composite(compositeOperations);
      }

      return await composite
        .png({ quality: 95, compressionLevel: 6 })
        .toBuffer();

    } catch (error) {
      console.warn('Advanced compositing failed, falling back to basic implementation:', error);
      return this.compositeImages(traits);
    }
  }

  /**
   * Generate multiple image variants (different sizes/formats) including GIF thumbnails
   */
  async generateImageVariants(
    traits: { layer: string; trait: TraitConfig; buffer: Buffer }[],
    variants: Array<{
      name: string;
      width: number;
      height: number;
      format: 'png' | 'jpeg' | 'webp' | 'gif';
      quality?: number;
      animated?: boolean;
      frames?: number;
      delay?: number;
    }>
  ): Promise<{ [variantName: string]: Buffer }> {
    const results: { [variantName: string]: Buffer } = {};

    for (const variant of variants) {
      try {
        this.log(`Generating variant: ${variant.name} (${variant.width}x${variant.height} ${variant.format})`);

        if (variant.format === 'gif' && variant.animated) {
          // Create animated GIF
          results[variant.name] = await this.createAnimatedGIF(traits, {
            width: variant.width,
            height: variant.height,
            frames: variant.frames || 8,
            delay: variant.delay || 200,
            quality: variant.quality || 10
          });
        } else {
          // Create static image variant
          const baseImage = await this.compositeImages(traits);
          results[variant.name] = await this.resizeImage(baseImage, variant);
        }

      } catch (error) {
        this.log(`Failed to generate variant ${variant.name}:`, error);
        // Fallback: use base image
        try {
          const baseImage = await this.compositeImages(traits);
          results[variant.name] = baseImage;
        } catch (fallbackError) {
          this.log(`Fallback failed for variant ${variant.name}:`, fallbackError);
        }
      }
    }

    return results;
  }

  /**
   * Resize image to specific variant requirements
   */
  private async resizeImage(
    baseImage: Buffer,
    variant: {
      width: number;
      height: number;
      format: 'png' | 'jpeg' | 'webp' | 'gif';
      quality?: number;
    }
  ): Promise<Buffer> {
    try {
      const sharp = await import('sharp');
      
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
        case 'gif':
          // For static GIF, convert to PNG first then to GIF
          processor = processor.png();
          break;
      }

      return await processor.toBuffer();

    } catch (error) {
      this.log('Sharp resize failed, using Canvas fallback:', error);
      
      // Canvas fallback
      try {
        const { createCanvas, loadImage } = await import('canvas');
        const image = await loadImage(baseImage);
        const canvas = createCanvas(variant.width, variant.height);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(image, 0, 0, variant.width, variant.height);
        
        return canvas.toBuffer('image/png');
      } catch (canvasError) {
        this.log('Canvas resize fallback failed:', canvasError);
        return baseImage;
      }
    }
  }

  /**
   * Calculate generation statistics
   */
  private calculateStats(nfts: GeneratedNFT[], layers: LayerConfig[]): RarityStats {
    // Calculate total possible combinations
    let totalCombinations = 1;
    for (const layer of layers) {
      totalCombinations *= layer.traits.length;
    }

    // Calculate rarity distribution
    const rarityDistribution: { [score: string]: number } = {};
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
  private validateConfig(config: GenerationConfig): void {
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
        const traitPath = join(layer.path, trait.filename);
        try {
          const stats = statSync(traitPath);
          if (!stats.isFile()) {
            throw new Error(`Trait file not found: ${traitPath}`);
          }
        } catch (error) {
          throw new Error(`Cannot access trait file: ${traitPath}`);
        }
      }
    }
  }

  /**
   * Load layer configuration from directory structure (HashLips-style)
   */
  static loadLayersFromDirectory(
    basePath: string, 
    rarityDelimiter: string = '#'
  ): LayerConfig[] {
    const layers: LayerConfig[] = [];
    
    try {
      const layerDirs = readdirSync(basePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();

      console.log(`[HashLips Engine] Found ${layerDirs.length} layer directories`);

      for (const layerName of layerDirs) {
        const layerPath = join(basePath, layerName);
        const traits: TraitConfig[] = [];
        
        const traitFiles = readdirSync(layerPath)
          .filter(file => ['.png', '.jpg', '.jpeg', '.gif'].includes(extname(file).toLowerCase()))
          .sort();

        console.log(`[HashLips Engine] Processing layer "${layerName}" with ${traitFiles.length} traits`);

        for (const filename of traitFiles) {
          // Parse HashLips-style filename with rarity weight
          const { name, weight } = this.parseTraitFilename(filename, rarityDelimiter);
          
          traits.push({
            name,
            weight,
            filename
          });

          console.log(`[HashLips Engine] Added trait: ${name} (weight: ${weight})`);
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
    } catch (error) {
      throw new Error(`Failed to load layers from directory: ${error}`);
    }

    console.log(`[HashLips Engine] Loaded ${layers.length} layers total`);
    return layers;
  }

  /**
   * Parse HashLips-style trait filename (e.g., "trait_name#70.png")
   */
  private static parseTraitFilename(
    filename: string, 
    rarityDelimiter: string = '#'
  ): { name: string; weight: number } {
    const nameWithoutExt = filename.replace(extname(filename), '');
    
    if (nameWithoutExt.includes(rarityDelimiter)) {
      const parts = nameWithoutExt.split(rarityDelimiter);
      const name = parts[0].trim();
      const weightStr = parts[1].trim();
      const weight = parseInt(weightStr, 10);
      
      if (isNaN(weight) || weight <= 0) {
        console.warn(`[HashLips Engine] Invalid weight "${weightStr}" for trait "${name}", using default weight 1`);
        return { name, weight: 1 };
      }
      
      return { name, weight };
    } else {
      // No rarity delimiter found, use default weight
      return { name: nameWithoutExt, weight: 1 };
    }
  }

  /**
   * Create HashLips-compatible generation config
   */
  static createHashLipsConfig(
    layersPath: string,
    collectionSize: number,
    options: {
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
    } = {}
  ): GenerationConfig {
    const {
      rarityDelimiter = '#',
      shuffleLayerConfigurations = false,
      debugLogs = false,
      format = { width: 512, height: 512, smoothing: false },
      namePrefix = 'Kirito NFT',
      description = 'Privacy-enhanced NFT collection',
      uniqueDnaTorrance = 10000
    } = options;

    // Load layers using HashLips approach
    const layers = this.loadLayersFromDirectory(layersPath, rarityDelimiter);
    
    // Create rarity weights from loaded layers
    const rarityWeights: { [key: string]: { [key: string]: number } } = {};
    for (const layer of layers) {
      rarityWeights[layer.name] = {};
      for (const trait of layer.traits) {
        rarityWeights[layer.name][trait.name] = trait.weight;
      }
    }

    console.log(`[HashLips Engine] Created config for ${collectionSize} NFTs with ${layers.length} layers`);

    return {
      layers,
      rarityWeights,
      collectionSize,
      // Add HashLips-specific metadata
      extraMetadata: {
        namePrefix,
        description,
        format,
        shuffleLayerConfigurations,
        debugLogs,
        uniqueDnaTorrance,
        ...options.extraMetadata
      }
    };
  }

  /**
   * Generate NFT with custom composite options and multiple image variants
   */
  async generateNFTWithVariants(
    tokenId: number,
    layers: LayerConfig[],
    variants: ImageVariant[],
    semaphoreGroupId?: string
  ): Promise<{
    nft: GeneratedNFT;
    variants: { [variantName: string]: Buffer };
  }> {
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
  private reconstructTraitsFromNFT(
    nft: GeneratedNFT, 
    layers: LayerConfig[]
  ): { layer: string; trait: TraitConfig; buffer: Buffer }[] {
    const traits: { layer: string; trait: TraitConfig; buffer: Buffer }[] = [];

    for (const attr of nft.attributes) {
      const layer = layers.find(l => l.name === attr.trait_type);
      if (layer) {
        const trait = layer.traits.find(t => t.name === attr.value);
        if (trait) {
          try {
            // In a real implementation, you'd load the actual trait file
            // For now, we'll use a placeholder buffer
            const traitPath = join(layer.path, trait.filename);
            const traitBuffer = readFileSync(traitPath);
            
            traits.push({
              layer: layer.name,
              trait,
              buffer: traitBuffer
            });
          } catch (error) {
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
  setCompositeOptions(options: CompositeOptions): void {
    this.compositeOptions = {
      ...this.compositeOptions,
      ...options
    };
  }

  /**
   * Get current composite options
   */
  getCompositeOptions(): CompositeOptions {
    return { ...this.compositeOptions };
  }

  /**
   * Convert generated NFTs to collection metadata format
   */
  static convertToCollectionMetadata(
    nfts: GeneratedNFT[],
    ipfsHashes: { images: string[]; metadata: string[]; collection: string }
  ): CollectionMetadata {
    const tokens: TokenMetadata[] = nfts.map((nft, index) => ({
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
   * Create standard image variants for NFT collections (including GIF thumbnails)
   */
  static createStandardVariants(): ImageVariant[] {
    return [
      {
        name: 'original',
        width: 512,
        height: 512,
        format: 'png',
        quality: 95
      },
      {
        name: 'large',
        width: 256,
        height: 256,
        format: 'png',
        quality: 90
      },
      {
        name: 'medium',
        width: 128,
        height: 128,
        format: 'webp',
        quality: 85
      },
      {
        name: 'thumbnail',
        width: 64,
        height: 64,
        format: 'webp',
        quality: 80
      },
      {
        name: 'gif_thumbnail',
        width: 128,
        height: 128,
        format: 'gif',
        quality: 10,
        animated: true,
        frames: 8,
        delay: 200
      },
      {
        name: 'preview',
        width: 32,
        height: 32,
        format: 'jpeg',
        quality: 75
      }
    ];
  }

  /**
   * Create HashLips-compatible variants (matching original dimensions)
   */
  static createHashLipsVariants(): ImageVariant[] {
    return [
      {
        name: 'original',
        width: 512,
        height: 512,
        format: 'png',
        quality: 100
      },
      {
        name: 'gif_preview',
        width: 256,
        height: 256,
        format: 'gif',
        quality: 15,
        animated: true,
        frames: 6,
        delay: 300
      }
    ];
  }

  /**
   * Create collection thumbnail GIF that cycles through all NFTs
   */
  async createCollectionThumbnailGIF(
    nftImages: Buffer[],
    options: {
      width?: number;
      height?: number;
      delay?: number;
      quality?: number;
      loops?: number;
    } = {}
  ): Promise<Buffer> {
    const {
      width = 256,
      height = 256,
      delay = 800, // Slower delay to see each NFT
      quality = 15,
      loops = 0 // Infinite loop
    } = options;

    try {
      const { createCanvas, loadImage } = await import('canvas');
      const GIFEncoder = (await import('gifencoder')).default;
      
      const encoder = new GIFEncoder(width, height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Configure GIF encoder
      encoder.start();
      encoder.setRepeat(loops);
      encoder.setDelay(delay);
      encoder.setQuality(quality);

      this.log(`Creating collection thumbnail GIF with ${nftImages.length} NFTs...`);

      // Add each NFT as a frame
      for (let i = 0; i < nftImages.length; i++) {
        try {
          // Clear canvas
          ctx.clearRect(0, 0, width, height);
          
          // Set background
          const bg = this.compositeOptions.backgroundColor!;
          if (bg.alpha > 0) {
            ctx.fillStyle = `rgba(${bg.r}, ${bg.g}, ${bg.b}, ${bg.alpha})`;
            ctx.fillRect(0, 0, width, height);
          }

          // Load and draw NFT image
          const image = await loadImage(nftImages[i]);
          
          // Calculate scaling to fit canvas while maintaining aspect ratio
          const scale = Math.min(width / image.width, height / image.height);
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;
          
          // Center the image
          const x = (width - scaledWidth) / 2;
          const y = (height - scaledHeight) / 2;
          
          // Draw the NFT
          ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
          
          // Add NFT number overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(10, 10, 60, 30);
          ctx.fillStyle = 'white';
          ctx.font = 'bold 16px Arial';
          ctx.fillText(`#${i + 1}`, 15, 30);
          
          // Add frame to GIF
          encoder.addFrame(ctx as any);
          
          this.log(`Added NFT #${i + 1} to collection GIF`);
          
        } catch (error) {
          this.log(`Failed to process NFT #${i + 1} for collection GIF:`, error);
        }
      }

      encoder.finish();
      
      this.log('Collection thumbnail GIF created successfully');
      return encoder.out.getData();

    } catch (error) {
      this.log('Collection GIF creation failed:', error);
      throw new Error(`Failed to create collection thumbnail GIF: ${error}`);
    }
  }

  /**
   * Validate image processing capabilities
   */
  static async validateImageProcessing(): Promise<{
    sharp: boolean;
    canvas: boolean;
    capabilities: string[];
  }> {
    const capabilities: string[] = [];
    let sharpAvailable = false;
    let canvasAvailable = false;

    // Test Sharp
    try {
      const sharp = await import('sharp');
      await sharp.default(Buffer.alloc(100)).png().toBuffer();
      sharpAvailable = true;
      capabilities.push('sharp', 'high-performance', 'webp', 'advanced-effects');
    } catch (error) {
      console.warn('Sharp not available:', error);
    }

    // Test Canvas
    try {
      const { createCanvas } = await import('canvas');
      createCanvas(100, 100);
      canvasAvailable = true;
      capabilities.push('canvas', 'fallback-rendering');
    } catch (error) {
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