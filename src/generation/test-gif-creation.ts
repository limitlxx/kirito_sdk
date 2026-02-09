/**
 * Test script specifically for GIF creation functionality
 */

import { HashLipsEngine, CompositeOptions, ImageVariant } from './hashlips-engine';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testGIFCreation() {
  console.log('Testing GIF creation functionality...');
  
  try {
    // Create test output directory
    const outputDir = 'test-output';
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

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

    // Create mock traits for testing
    const mockTraits = [
      {
        layer: 'background',
        trait: { name: 'blue', weight: 50, filename: 'blue.png' },
        buffer: testImageBuffer
      },
      {
        layer: 'character',
        trait: { name: 'warrior', weight: 30, filename: 'warrior.png' },
        buffer: testImageBuffer
      }
    ];

    const compositeOptions: CompositeOptions = {
      canvasWidth: 128,
      canvasHeight: 128,
      backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 }
    };

    const engine = new HashLipsEngine(compositeOptions);

    console.log('Testing animated GIF creation...');
    
    // Test animated GIF creation
    const gifBuffer = await engine.createAnimatedGIF(mockTraits, {
      width: 64,
      height: 64,
      frames: 4,
      delay: 250,
      quality: 15
    });

    console.log(`Generated GIF buffer size: ${gifBuffer.length} bytes`);
    
    // Save the GIF for inspection
    const gifPath = join(outputDir, 'test-animated.gif');
    writeFileSync(gifPath, gifBuffer);
    console.log(`Saved test GIF to: ${gifPath}`);

    // Test image variants including GIF
    console.log('Testing image variants generation...');
    
    const variants: ImageVariant[] = [
      {
        name: 'original',
        width: 128,
        height: 128,
        format: 'png'
      },
      {
        name: 'animated_thumb',
        width: 64,
        height: 64,
        format: 'gif',
        animated: true,
        frames: 6,
        delay: 200
      },
      {
        name: 'static_thumb',
        width: 32,
        height: 32,
        format: 'png'
      }
    ];

    const variantResults = await engine.generateImageVariants(mockTraits, variants);
    
    console.log('Generated variants:');
    for (const [name, buffer] of Object.entries(variantResults)) {
      console.log(`  ${name}: ${buffer.length} bytes`);
      
      // Save each variant
      const ext = variants.find(v => v.name === name)?.format || 'png';
      const variantPath = join(outputDir, `test-${name}.${ext}`);
      writeFileSync(variantPath, buffer);
      console.log(`    Saved to: ${variantPath}`);
    }

    // Test standard variants (including GIF thumbnails)
    console.log('Testing standard variants...');
    const standardVariants = HashLipsEngine.createStandardVariants();
    const standardResults = await engine.generateImageVariants(mockTraits, standardVariants);
    
    console.log('Standard variants generated:');
    for (const [name, buffer] of Object.entries(standardResults)) {
      console.log(`  ${name}: ${buffer.length} bytes`);
    }

    console.log('✅ GIF creation test completed successfully!');
    console.log(`Check the ${outputDir} directory for generated test files.`);
    
  } catch (error) {
    console.error('❌ GIF creation test failed:', error);
    throw error;
  }
}

// Export for testing
export { testGIFCreation };

// Run test if this file is executed directly
if (require.main === module) {
  testGIFCreation().catch(console.error);
}