/**
 * Test script for HashLips Art Engine integration
 */

import { HashLipsEngine } from './hashlips-engine';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function testHashLipsIntegration() {
  console.log('Testing HashLips Art Engine integration...');
  
  try {
    // Create test layer directory structure (HashLips style)
    const testLayersDir = 'test-layers';
    
    // Create directories
    mkdirSync(join(testLayersDir, '01_Background'), { recursive: true });
    mkdirSync(join(testLayersDir, '02_Character'), { recursive: true });
    mkdirSync(join(testLayersDir, '03_Accessory'), { recursive: true });

    // Create a simple test image buffer (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00, // image data
      0x01, 0x00, 0x01, 0x5C, 0xC2, 0xD5, 0x7A, 0x00, // checksum
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
      0x42, 0x60, 0x82
    ]);

    // Create HashLips-style trait files with rarity weights
    const traitFiles = [
      // Background layer
      { path: join(testLayersDir, '01_Background', 'Blue#70.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '01_Background', 'Red#20.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '01_Background', 'Green#10.png'), buffer: testImageBuffer },
      
      // Character layer
      { path: join(testLayersDir, '02_Character', 'Warrior#50.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '02_Character', 'Mage#30.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '02_Character', 'Rogue#20.png'), buffer: testImageBuffer },
      
      // Accessory layer
      { path: join(testLayersDir, '03_Accessory', 'Sword#40.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '03_Accessory', 'Staff#35.png'), buffer: testImageBuffer },
      { path: join(testLayersDir, '03_Accessory', 'Dagger#25.png'), buffer: testImageBuffer }
    ];

    // Write trait files
    for (const file of traitFiles) {
      writeFileSync(file.path, file.buffer);
    }

    console.log(`Created ${traitFiles.length} trait files in HashLips format`);

    // Test loading layers from directory
    console.log('Testing layer loading from directory...');
    const layers = HashLipsEngine.loadLayersFromDirectory(testLayersDir);
    
    console.log(`Loaded ${layers.length} layers:`);
    for (const layer of layers) {
      console.log(`  ${layer.name}: ${layer.traits.length} traits`);
      for (const trait of layer.traits) {
        console.log(`    ${trait.name} (weight: ${trait.weight})`);
      }
    }

    // Test creating HashLips config
    console.log('Testing HashLips config creation...');
    const config = HashLipsEngine.createHashLipsConfig(testLayersDir, 10, {
      rarityDelimiter: '#',
      debugLogs: true,
      namePrefix: 'Test NFT',
      description: 'Test collection with HashLips integration'
    });

    console.log('Generated config:');
    console.log(`  Collection size: ${config.collectionSize}`);
    console.log(`  Layers: ${config.layers.length}`);
    console.log(`  Rarity weights configured: ${Object.keys(config.rarityWeights).length} layers`);

    // Test filename parsing
    console.log('Testing filename parsing...');
    const testFilenames = [
      'Blue#70.png',
      'Red#20.png', 
      'NoWeight.png',
      'Invalid#abc.png',
      'Zero#0.png'
    ];

    for (const filename of testFilenames) {
      const parsed = (HashLipsEngine as any).parseTraitFilename(filename, '#');
      console.log(`  ${filename} -> name: "${parsed.name}", weight: ${parsed.weight}`);
    }

    // Test generation with small collection
    console.log('Testing NFT generation with HashLips config...');
    const engine = new HashLipsEngine();
    engine.setDebugLogs(true);

    const { nfts, stats } = await engine.generateCollection(config);
    
    console.log(`Generated ${nfts.length} NFTs:`);
    console.log(`  Total combinations possible: ${stats.totalCombinations}`);
    console.log(`  Rarity distribution:`, stats.rarityDistribution);

    // Show first few NFTs
    for (let i = 0; i < Math.min(3, nfts.length); i++) {
      const nft = nfts[i];
      console.log(`  NFT #${nft.tokenId}:`);
      console.log(`    DNA: ${nft.dna.substring(0, 16)}...`);
      console.log(`    Rarity Score: ${nft.metadata.rarityScore}`);
      console.log(`    Yield Multiplier: ${nft.metadata.yieldMultiplier}`);
      console.log(`    Attributes: ${nft.attributes.map(a => `${a.trait_type}:${a.value}`).join(', ')}`);
    }

    // Test variants generation
    console.log('Testing variants generation with HashLips...');
    const variants = HashLipsEngine.createHashLipsVariants();
    const firstNFT = nfts[0];
    
    const nftWithVariants = await engine.generateNFTWithVariants(
      parseInt(firstNFT.tokenId),
      config.layers,
      variants
    );

    console.log('Generated variants for NFT #1:');
    for (const [name, buffer] of Object.entries(nftWithVariants.variants)) {
      console.log(`  ${name}: ${buffer.length} bytes`);
    }

    console.log('✅ HashLips integration test completed successfully!');
    
    // Cleanup
    console.log('Cleaning up test files...');
    const { execSync } = require('child_process');
    try {
      execSync(`rm -rf ${testLayersDir}`, { stdio: 'ignore' });
      console.log('Test files cleaned up');
    } catch (error) {
      console.warn('Could not clean up test files:', error);
    }
    
  } catch (error) {
    console.error('❌ HashLips integration test failed:', error);
    throw error;
  }
}

// Export for testing
export { testHashLipsIntegration };

// Run test if this file is executed directly
if (require.main === module) {
  testHashLipsIntegration().catch(console.error);
}