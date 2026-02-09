/**
 * Test script for real NFT generation with traits folder
 * This demonstrates the complete NFT generation workflow
 */

import { HashLipsEngine, CompositeOptions, ImageVariant } from './hashlips-engine';
import { KiritoGenerationEngine } from './generation-engine';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

async function createSampleTraitsFolder() {
  console.log('Creating sample traits folder structure...');
  
  const traitsDir = 'sample-traits';
  
  // Create HashLips-style directory structure
  const layers = [
    { name: '01_Background', traits: ['Blue#70', 'Red#20', 'Green#10'] },
    { name: '02_Body', traits: ['Human#60', 'Robot#25', 'Alien#15'] },
    { name: '03_Eyes', traits: ['Normal#50', 'Laser#30', 'Glowing#20'] },
    { name: '04_Mouth', traits: ['Smile#40', 'Frown#35', 'Neutral#25'] },
    { name: '05_Accessory', traits: ['Hat#30', 'Glasses#25', 'Crown#15', 'None#30'] }
  ];

  // Create a more realistic 64x64 PNG (colored squares)
  function createColoredPNG(r: number, g: number, b: number): Buffer {
    // Simple 64x64 PNG with solid color
    const width = 64;
    const height = 64;
    const channels = 4; // RGBA
    
    // PNG signature
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0); // chunk length
    ihdr.write('IHDR', 4);
    ihdr.writeUInt32BE(width, 8);
    ihdr.writeUInt32BE(height, 12);
    ihdr.writeUInt8(8, 16); // bit depth
    ihdr.writeUInt8(6, 17); // color type (RGBA)
    ihdr.writeUInt8(0, 18); // compression
    ihdr.writeUInt8(0, 19); // filter
    ihdr.writeUInt8(0, 20); // interlace
    
    // Simple CRC calculation (not accurate but works for testing)
    const crc = 0x12345678;
    ihdr.writeUInt32BE(crc, 21);
    
    // IDAT chunk with simple pixel data
    const pixelData = Buffer.alloc(width * height * channels);
    for (let i = 0; i < pixelData.length; i += 4) {
      pixelData[i] = r;     // Red
      pixelData[i + 1] = g; // Green
      pixelData[i + 2] = b; // Blue
      pixelData[i + 3] = 255; // Alpha
    }
    
    const idat = Buffer.alloc(pixelData.length + 12);
    idat.writeUInt32BE(pixelData.length, 0);
    idat.write('IDAT', 4);
    pixelData.copy(idat, 8);
    idat.writeUInt32BE(0x12345678, idat.length - 4); // CRC
    
    // IEND chunk
    const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
    
    return Buffer.concat([signature, ihdr, idat, iend]);
  }

  // Color palette for different traits
  const colors = {
    'Blue': [0, 100, 255],
    'Red': [255, 50, 50],
    'Green': [50, 255, 50],
    'Human': [255, 220, 177],
    'Robot': [150, 150, 150],
    'Alien': [100, 255, 100],
    'Normal': [255, 255, 255],
    'Laser': [255, 0, 0],
    'Glowing': [255, 255, 0],
    'Smile': [255, 192, 203],
    'Frown': [128, 128, 128],
    'Neutral': [200, 200, 200],
    'Hat': [139, 69, 19],
    'Glasses': [0, 0, 0],
    'Crown': [255, 215, 0],
    'None': [0, 0, 0] // Transparent
  };

  for (const layer of layers) {
    const layerDir = join(traitsDir, layer.name);
    mkdirSync(layerDir, { recursive: true });
    
    for (const traitName of layer.traits) {
      const [name, weight] = traitName.split('#');
      const filename = `${traitName}.png`;
      const filepath = join(layerDir, filename);
      
      // Get color for this trait
      const color = colors[name as keyof typeof colors] || [128, 128, 128];
      const pngBuffer = createColoredPNG(color[0], color[1], color[2]);
      
      writeFileSync(filepath, pngBuffer);
      console.log(`  Created: ${layer.name}/${filename}`);
    }
  }

  console.log(`✅ Created traits folder with ${layers.length} layers`);
  return traitsDir;
}

async function testRealNFTGeneration() {
  console.log('🎨 Testing Real NFT Generation with Traits Folder');
  console.log('='.repeat(60));
  
  try {
    // Create sample traits folder
    const traitsDir = await createSampleTraitsFolder();
    
    // Configure generation engine
    const compositeOptions: CompositeOptions = {
      canvasWidth: 256,
      canvasHeight: 256,
      backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 },
      outputFormat: 'png',
      quality: 95
    };

    // Create HashLips config from directory
    console.log('\n📁 Loading HashLips Configuration...');
    const config = HashLipsEngine.createHashLipsConfig(traitsDir, 5, {
      rarityDelimiter: '#',
      debugLogs: true,
      namePrefix: 'Kirito NFT',
      description: 'Sample NFT collection with real traits'
    });

    console.log(`Loaded configuration:`);
    console.log(`  Collection size: ${config.collectionSize}`);
    console.log(`  Layers: ${config.layers.length}`);
    
    // Show layer details
    for (const layer of config.layers) {
      console.log(`  ${layer.name}: ${layer.traits.length} traits`);
      for (const trait of layer.traits) {
        console.log(`    - ${trait.name} (weight: ${trait.weight})`);
      }
    }

    // Initialize generation engine
    console.log('\n🚀 Initializing Generation Engine...');
    const engine = new HashLipsEngine(compositeOptions);
    engine.setDebugLogs(true);

    // Generate NFT collection
    console.log('\n🎯 Generating NFT Collection...');
    const startTime = Date.now();
    const { nfts, stats } = await engine.generateCollection(config);
    const generationTime = Date.now() - startTime;

    console.log(`\n✅ Generation Complete! (${generationTime}ms)`);
    console.log(`Generated ${nfts.length} unique NFTs`);
    console.log(`Total possible combinations: ${stats.totalCombinations}`);
    console.log(`Rarity distribution:`, stats.rarityDistribution);

    // Show generated NFTs
    console.log('\n📊 Generated NFTs:');
    for (let i = 0; i < nfts.length; i++) {
      const nft = nfts[i];
      console.log(`\nNFT #${nft.tokenId}:`);
      console.log(`  DNA: ${nft.dna.substring(0, 20)}...`);
      console.log(`  Rarity Score: ${nft.metadata.rarityScore}`);
      console.log(`  Yield Multiplier: ${nft.metadata.yieldMultiplier}`);
      console.log(`  Image Size: ${nft.image.length} bytes`);
      console.log(`  Attributes:`);
      for (const attr of nft.attributes) {
        console.log(`    ${attr.trait_type}: ${attr.value}`);
      }
    }

    // Test image variants generation
    console.log('\n🖼️  Testing Image Variants Generation...');
    const variants: ImageVariant[] = [
      { name: 'original', width: 256, height: 256, format: 'png' },
      { name: 'large', width: 128, height: 128, format: 'png' },
      { name: 'thumbnail', width: 64, height: 64, format: 'webp' },
      { name: 'gif_animated', width: 96, height: 96, format: 'gif', animated: true, frames: 6, delay: 300 }
    ];

    const firstNFT = nfts[0];
    const variantResults = await engine.generateNFTWithVariants(
      parseInt(firstNFT.tokenId),
      config.layers,
      variants
    );

    console.log(`Generated variants for NFT #${firstNFT.tokenId}:`);
    for (const [name, buffer] of Object.entries(variantResults.variants)) {
      console.log(`  ${name}: ${buffer.length} bytes`);
    }

    // Save sample outputs
    console.log('\n💾 Saving Sample Outputs...');
    const outputDir = 'nft-output';
    mkdirSync(outputDir, { recursive: true });

    // Save first NFT and its variants
    for (const [name, buffer] of Object.entries(variantResults.variants)) {
      const variant = variants.find(v => v.name === name);
      const ext = variant?.format || 'png';
      const filename = `nft-1-${name}.${ext}`;
      writeFileSync(join(outputDir, filename), buffer);
      console.log(`  Saved: ${filename}`);
    }

    // Save metadata
    const metadataFile = join(outputDir, 'nft-1-metadata.json');
    writeFileSync(metadataFile, JSON.stringify(firstNFT.metadata, null, 2));
    console.log(`  Saved: nft-1-metadata.json`);

    // Test with KiritoGenerationEngine (full workflow)
    console.log('\n🔄 Testing Full Generation Workflow...');
    
    // Mock IPFS config for testing
    const mockConfig = {
      network: {
        name: 'testnet',
        rpcUrl: 'http://localhost:8545',
        chainId: '1',
        contracts: {}
      },
      ipfs: {
        url: 'http://localhost:5001' // This would be a real IPFS node
      },
      privacy: {
        tongoEndpoint: 'http://localhost:3000',
        semaphoreEndpoint: 'http://localhost:3001'
      }
    };

    // Note: This would normally upload to IPFS, but we'll skip for testing
    console.log('📤 IPFS Upload (Simulated):');
    console.log('  - Images would be uploaded to IPFS');
    console.log('  - Metadata would be uploaded to IPFS');
    console.log('  - Collection metadata would be created');
    console.log('  - All files would be pinned for availability');

    console.log('\n🎉 Test Complete!');
    console.log(`Check the ${outputDir} directory for generated files.`);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    const { execSync } = require('child_process');
    try {
      execSync(`rm -rf ${traitsDir}`, { stdio: 'ignore' });
      console.log('Traits folder cleaned up');
    } catch (error) {
      console.warn('Could not clean up traits folder:', error);
    }

    return {
      nfts,
      stats,
      generationTime,
      outputDir
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Architecture explanation
function explainArchitecture() {
  console.log('\n🏗️  NFT GENERATION & STORAGE ARCHITECTURE');
  console.log('='.repeat(60));
  
  console.log(`
📋 GENERATION WORKFLOW:

1. TRAIT PREPARATION (Client/Server)
   ├── Trait images stored in HashLips-style folders
   ├── Filename format: "trait_name#rarity_weight.png"
   ├── Layers organized by rendering order (01_Background, 02_Body, etc.)
   └── Can be done on either client or server side

2. NFT GENERATION (Configurable: Client or Server)
   ├── Load trait configurations from directory structure
   ├── Generate unique DNA combinations using weighted randomness
   ├── Composite trait images using Canvas API or Sharp
   ├── Calculate rarity scores and yield multipliers
   ├── Create multiple image variants (original, thumbnails, GIFs)
   └── Generate metadata with privacy enhancements

3. IMAGE STORAGE OPTIONS:

   A) CLIENT-SIDE GENERATION:
      ├── ✅ Pros: No server costs, user controls generation
      ├── ❌ Cons: Limited by browser capabilities, slower
      ├── Storage: Browser memory → IPFS upload
      └── Use case: Small collections, user-generated content

   B) SERVER-SIDE GENERATION:
      ├── ✅ Pros: Faster, more reliable, batch processing
      ├── ❌ Cons: Server costs, centralized processing
      ├── Storage: Server memory/disk → IPFS upload
      └── Use case: Large collections, production deployments

4. IPFS UPLOAD & STORAGE:
   ├── Images uploaded to IPFS in optimized batches
   ├── Metadata uploaded with IPFS image references
   ├── Collection metadata created and uploaded
   ├── Important files pinned for availability
   └── Returns IPFS hashes for blockchain minting

5. BLOCKCHAIN INTEGRATION:
   ├── IPFS hashes stored in smart contracts
   ├── NFT metadata points to IPFS resources
   ├── Privacy features (hidden traits) encrypted
   └── Yield generation tied to rarity scores

📊 STORAGE BREAKDOWN:

TEMPORARY STORAGE (During Generation):
├── Trait Images: Local filesystem or memory
├── Generated Images: Memory buffers
├── Metadata: JavaScript objects
└── Variants: Memory buffers

PERMANENT STORAGE (After Generation):
├── IPFS: Decentralized image and metadata storage
├── Blockchain: IPFS hashes and contract state
├── Local Cache: Optional caching for performance
└── CDN: Optional for faster image delivery

🔧 CONFIGURATION OPTIONS:

CLIENT-SIDE:
- Use Canvas API for image compositing
- Limited to smaller collections (< 1000 NFTs)
- Browser memory constraints apply
- Direct IPFS upload from browser

SERVER-SIDE:
- Use Sharp + Canvas for optimal performance
- Handle large collections (10,000+ NFTs)
- Better memory management
- Batch processing capabilities
- Professional IPFS infrastructure

HYBRID APPROACH:
- Generate on server, deliver to client
- Client handles IPFS upload and minting
- Best of both worlds for UX and performance
`);
}

// Export for testing
export { testRealNFTGeneration, explainArchitecture };

// Run test if this file is executed directly
if (require.main === module) {
  testRealNFTGeneration()
    .then(() => {
      explainArchitecture();
    })
    .catch(console.error);
}