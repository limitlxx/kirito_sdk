/**
 * Generate 10 NFTs using the existing traits folder
 * This script demonstrates real NFT generation with actual trait images
 */

import { HashLipsEngine, CompositeOptions, ImageVariant } from './hashlips-engine';
import { KiritoGenerationEngine } from './generation-engine';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function generateNFTsFromTraits() {
  console.log('🎨 Generating 10 NFTs from Traits Folder');
  console.log('='.repeat(50));
  
  try {
    const traitsPath = 'traits';
    const outputDir = 'generated-nfts';
    
    // Create output directory
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Configure generation engine with optimal settings
    const compositeOptions: CompositeOptions = {
      canvasWidth: 512,
      canvasHeight: 512,
      backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      outputFormat: 'png',
      quality: 95,
      blend: 'source-over'
    };

    console.log('\n📁 Loading Traits Configuration...');
    
    // Create HashLips config from the existing traits directory
    const config = HashLipsEngine.createHashLipsConfig(traitsPath, 10, {
      rarityDelimiter: '#',
      debugLogs: true,
      namePrefix: 'Kirito Eye NFT',
      description: 'Privacy-enhanced eye NFT with yield generation capabilities',
      format: {
        width: 512,
        height: 512,
        smoothing: true
      }
    });

    console.log(`✅ Configuration loaded:`);
    console.log(`   Collection size: ${config.collectionSize}`);
    console.log(`   Layers found: ${config.layers.length}`);
    
    // Display layer information
    console.log('\n📊 Layer Structure:');
    for (const layer of config.layers) {
      console.log(`   ${layer.name}:`);
      for (const trait of layer.traits) {
        console.log(`     - ${trait.name} (weight: ${trait.weight})`);
      }
    }

    // Calculate total possible combinations
    let totalCombinations = 1;
    for (const layer of config.layers) {
      totalCombinations *= layer.traits.length;
    }
    console.log(`\n🔢 Total possible combinations: ${totalCombinations.toLocaleString()}`);

    // Initialize generation engine
    console.log('\n🚀 Initializing Generation Engine...');
    const engine = new HashLipsEngine(compositeOptions);
    engine.setDebugLogs(false); // Reduce noise for cleaner output

    // Generate NFT collection
    console.log('\n🎯 Generating NFT Collection...');
    const startTime = Date.now();
    
    const { nfts, stats } = await engine.generateCollection(config);
    
    const generationTime = Date.now() - startTime;
    console.log(`\n✅ Generation Complete! (${generationTime}ms)`);
    console.log(`   Generated: ${nfts.length} unique NFTs`);
    console.log(`   Success rate: ${((nfts.length / config.collectionSize) * 100).toFixed(1)}%`);

    // Display rarity statistics
    console.log('\n📈 Rarity Distribution:');
    for (const [range, count] of Object.entries(stats.rarityDistribution)) {
      console.log(`   ${range}: ${count} NFTs`);
    }

    // Define image variants to generate
    const variants: ImageVariant[] = [
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
        name: 'gif_preview',
        width: 96,
        height: 96,
        format: 'gif',
        animated: true,
        frames: 8,
        delay: 250,
        quality: 15
      }
    ];

    console.log('\n💾 Saving Generated NFTs...');
    
    // Save each NFT with all variants
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      const nftDir = join(outputDir, `nft-${nft.tokenId}`);
      
      if (!existsSync(nftDir)) {
        mkdirSync(nftDir, { recursive: true });
      }

      console.log(`\n📦 Processing NFT #${nft.tokenId}:`);
      console.log(`   DNA: ${nft.dna.substring(0, 20)}...`);
      console.log(`   Rarity Score: ${nft.metadata.rarityScore}`);
      console.log(`   Yield Multiplier: ${nft.metadata.yieldMultiplier}x`);
      
      // Display attributes
      console.log(`   Attributes:`);
      for (const attr of nft.attributes) {
        console.log(`     ${attr.trait_type}: ${attr.value}`);
      }

      try {
        // Generate variants for this NFT
        const variantResults = await engine.generateNFTWithVariants(
          parseInt(nft.tokenId),
          config.layers,
          variants
        );

        // Save all variants
        let savedCount = 0;
        for (const [variantName, buffer] of Object.entries(variantResults.variants)) {
          const variant = variants.find(v => v.name === variantName);
          const ext = variant?.format || 'png';
          const filename = `${variantName}.${ext}`;
          const filepath = join(nftDir, filename);
          
          writeFileSync(filepath, buffer);
          console.log(`     ✅ ${filename} (${buffer.length} bytes)`);
          savedCount++;
        }

        // Save metadata
        const metadataPath = join(nftDir, 'metadata.json');
        const metadata = {
          ...nft.metadata,
          image: `./original.png`, // Local reference for testing
          animation_url: `./gif_preview.gif`,
          external_url: `https://kirito-nft.com/nft/${nft.tokenId}`,
          background_color: "000000",
          attributes: nft.attributes.map(attr => ({
            trait_type: attr.trait_type,
            value: attr.value,
            display_type: attr.display_type || undefined
          }))
        };
        
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`     ✅ metadata.json`);

        console.log(`   📁 Saved ${savedCount + 1} files to ${nftDir}`);

      } catch (error) {
        console.error(`   ❌ Failed to generate variants for NFT #${nft.tokenId}:`, error);
      }
    }

    // Generate collection summary
    console.log('\n📋 Generating Collection Summary...');
    
    // Create collection thumbnail GIF
    console.log('\n🎬 Creating Collection Thumbnail GIF...');
    try {
      const nftImages = nfts.map(nft => nft.image);
      const collectionGIF = await engine.createCollectionThumbnailGIF(nftImages, {
        width: 256,
        height: 256,
        delay: 1000, // 1 second per NFT
        quality: 20
      });
      
      const collectionGIFPath = join(outputDir, 'collection-thumbnail.gif');
      writeFileSync(collectionGIFPath, collectionGIF);
      console.log(`✅ Collection thumbnail GIF saved (${collectionGIF.length} bytes)`);
      console.log(`   📁 ${collectionGIFPath}`);
      console.log(`   🎞️  ${nfts.length} frames, 1 second per NFT`);
    } catch (error) {
      console.error('❌ Failed to create collection thumbnail GIF:', error);
    }
    
    const collectionSummary = {
      collection: {
        name: "Kirito Eye NFT Collection",
        description: "Privacy-enhanced eye NFTs with yield generation capabilities",
        total_supply: nfts.length,
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        collection_thumbnail: "collection-thumbnail.gif"
      },
      statistics: {
        total_combinations: stats.totalCombinations,
        generated_nfts: nfts.length,
        success_rate: ((nfts.length / config.collectionSize) * 100).toFixed(1) + '%',
        rarity_distribution: stats.rarityDistribution,
        average_rarity_score: (nfts.reduce((sum, nft) => sum + nft.metadata.rarityScore, 0) / nfts.length).toFixed(2),
        average_yield_multiplier: (nfts.reduce((sum, nft) => sum + nft.metadata.yieldMultiplier, 0) / nfts.length).toFixed(2)
      },
      layers: config.layers.map(layer => ({
        name: layer.name,
        trait_count: layer.traits.length,
        traits: layer.traits.map(trait => ({
          name: trait.name,
          weight: trait.weight,
          rarity_percentage: ((trait.weight / layer.traits.reduce((sum, t) => sum + t.weight, 0)) * 100).toFixed(1) + '%'
        }))
      })),
      nfts: nfts.map(nft => ({
        token_id: nft.tokenId,
        dna: nft.dna,
        rarity_score: nft.metadata.rarityScore,
        yield_multiplier: nft.metadata.yieldMultiplier,
        attributes: nft.attributes
      }))
    };

    const summaryPath = join(outputDir, 'collection-summary.json');
    writeFileSync(summaryPath, JSON.stringify(collectionSummary, null, 2));
    console.log(`✅ Collection summary saved to ${summaryPath}`);

    // Generate README for the collection
    const readmeContent = `# Kirito Eye NFT Collection

## Overview
This collection contains ${nfts.length} unique eye-themed NFTs generated using the Kirito SDK with privacy-enhanced features and yield generation capabilities.

![Collection Preview](collection-thumbnail.gif)

## Generation Details
- **Generated**: ${new Date().toLocaleString()}
- **Generation Time**: ${generationTime}ms
- **Success Rate**: ${((nfts.length / config.collectionSize) * 100).toFixed(1)}%
- **Total Possible Combinations**: ${stats.totalCombinations.toLocaleString()}

## Collection Files
- \`collection-thumbnail.gif\` - Animated preview of all NFTs in the collection
- \`collection-summary.json\` - Complete collection statistics and metadata
- \`README.md\` - This documentation file

## Layer Structure
${config.layers.map(layer => 
  `### ${layer.name}\n${layer.traits.map(trait => 
    `- **${trait.name}** (weight: ${trait.weight})`
  ).join('\n')}`
).join('\n\n')}

## Rarity Distribution
${Object.entries(stats.rarityDistribution).map(([range, count]) => 
  `- **${range}**: ${count} NFTs`
).join('\n')}

## File Structure
Each NFT folder contains:
- \`original.png\` - Full resolution (512x512)
- \`large.png\` - Large size (256x256)
- \`medium.webp\` - Medium size (128x128)
- \`thumbnail.webp\` - Thumbnail (64x64)
- \`gif_preview.gif\` - Animated preview (96x96)
- \`metadata.json\` - Complete metadata with attributes

## Features
- **Privacy-Enhanced**: Hidden traits can be encrypted
- **Yield Generation**: Rarity-based yield multipliers
- **Multiple Formats**: PNG, WebP, and animated GIF variants
- **HashLips Compatible**: Standard trait-based generation
- **Blockchain Ready**: IPFS-compatible metadata structure

## Usage
These NFTs are ready for:
1. IPFS upload and pinning
2. Smart contract minting
3. Marketplace listing
4. Yield farming integration
5. Privacy-enhanced trading

Generated with ❤️ using Kirito SDK
`;

    const readmePath = join(outputDir, 'README.md');
    writeFileSync(readmePath, readmeContent);
    console.log(`✅ README.md saved to ${readmePath}`);

    console.log('\n🎉 NFT Generation Complete!');
    console.log(`📁 Check the '${outputDir}' directory for all generated files`);
    console.log(`📊 Generated ${nfts.length} NFTs with ${variants.length} variants each`);
    console.log(`💾 Total files created: ${nfts.length * (variants.length + 1) + 2}`);

    return {
      nfts,
      stats,
      generationTime,
      outputDir,
      summary: collectionSummary
    };

  } catch (error) {
    console.error('❌ NFT generation failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { generateNFTsFromTraits };

// Run if executed directly
if (require.main === module) {
  generateNFTsFromTraits()
    .then((result) => {
      console.log('\n✨ Generation Summary:');
      console.log(`   NFTs Generated: ${result.nfts.length}`);
      console.log(`   Generation Time: ${result.generationTime}ms`);
      console.log(`   Output Directory: ${result.outputDir}`);
      console.log(`   Average Rarity: ${result.summary.statistics.average_rarity_score}`);
      console.log(`   Average Yield: ${result.summary.statistics.average_yield_multiplier}x`);
    })
    .catch(console.error);
}