"use strict";
/**
 * Standalone script to create collection thumbnail GIF from existing NFT images
 * This can be used to create collection previews from any set of NFT images
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCollectionGIFFromImages = createCollectionGIFFromImages;
exports.createMultipleCollectionGIFs = createMultipleCollectionGIFs;
const hashlips_engine_1 = require("./hashlips-engine");
const fs_1 = require("fs");
const path_1 = require("path");
async function createCollectionGIFFromImages(imagesDir, outputPath, options = {}) {
    console.log('🎬 Creating Collection Thumbnail GIF');
    console.log('='.repeat(40));
    try {
        const { width = 256, height = 256, delay = 1000, quality = 20, pattern = 'original.png' } = options;
        console.log(`📁 Loading images from: ${imagesDir}`);
        console.log(`🎯 Looking for pattern: ${pattern}`);
        // Find all NFT directories
        const nftDirs = (0, fs_1.readdirSync)(imagesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('nft-'))
            .map(dirent => dirent.name)
            .sort((a, b) => {
            const numA = parseInt(a.replace('nft-', ''));
            const numB = parseInt(b.replace('nft-', ''));
            return numA - numB;
        });
        console.log(`📊 Found ${nftDirs.length} NFT directories`);
        // Load images
        const imageBuffers = [];
        for (const nftDir of nftDirs) {
            const imagePath = (0, path_1.join)(imagesDir, nftDir, pattern);
            try {
                const imageBuffer = (0, fs_1.readFileSync)(imagePath);
                imageBuffers.push(imageBuffer);
                console.log(`✅ Loaded: ${nftDir}/${pattern} (${imageBuffer.length} bytes)`);
            }
            catch (error) {
                console.warn(`⚠️  Could not load: ${imagePath}`);
            }
        }
        if (imageBuffers.length === 0) {
            throw new Error('No images found to create collection GIF');
        }
        console.log(`\n🎨 Creating GIF with ${imageBuffers.length} frames...`);
        console.log(`   Size: ${width}x${height}`);
        console.log(`   Delay: ${delay}ms per frame`);
        console.log(`   Quality: ${quality}`);
        // Create HashLips engine for GIF creation
        const engine = new hashlips_engine_1.HashLipsEngine({
            canvasWidth: width,
            canvasHeight: height,
            backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 }
        });
        // Create collection GIF
        const startTime = Date.now();
        const gifBuffer = await engine.createCollectionThumbnailGIF(imageBuffers, {
            width,
            height,
            delay,
            quality
        });
        const creationTime = Date.now() - startTime;
        // Save GIF
        (0, fs_1.writeFileSync)(outputPath, gifBuffer);
        console.log(`\n🎉 Collection GIF Created Successfully!`);
        console.log(`   📁 Output: ${outputPath}`);
        console.log(`   📊 Size: ${gifBuffer.length} bytes (${(gifBuffer.length / 1024).toFixed(1)} KB)`);
        console.log(`   ⏱️  Creation time: ${creationTime}ms`);
        console.log(`   🎞️  Frames: ${imageBuffers.length}`);
        console.log(`   ⏰ Total duration: ${(imageBuffers.length * delay / 1000).toFixed(1)} seconds`);
        return {
            outputPath,
            size: gifBuffer.length,
            frames: imageBuffers.length,
            creationTime,
            duration: imageBuffers.length * delay
        };
    }
    catch (error) {
        console.error('❌ Failed to create collection GIF:', error);
        throw error;
    }
}
async function createMultipleCollectionGIFs() {
    console.log('🎬 Creating Multiple Collection GIF Variants');
    console.log('='.repeat(50));
    const baseDir = 'generated-nfts';
    const variants = [
        {
            name: 'collection-preview-fast',
            pattern: 'large.png',
            width: 200,
            height: 200,
            delay: 500,
            quality: 25
        },
        {
            name: 'collection-preview-detailed',
            pattern: 'original.png',
            width: 300,
            height: 300,
            delay: 1500,
            quality: 15
        },
        {
            name: 'collection-preview-compact',
            pattern: 'thumbnail.webp',
            width: 128,
            height: 128,
            delay: 800,
            quality: 30
        }
    ];
    const results = [];
    for (const variant of variants) {
        try {
            console.log(`\n📝 Creating variant: ${variant.name}`);
            const outputPath = (0, path_1.join)(baseDir, `${variant.name}.gif`);
            const result = await createCollectionGIFFromImages(baseDir, outputPath, {
                width: variant.width,
                height: variant.height,
                delay: variant.delay,
                quality: variant.quality,
                pattern: variant.pattern
            });
            results.push({
                name: variant.name,
                ...result
            });
        }
        catch (error) {
            console.error(`❌ Failed to create ${variant.name}:`, error);
        }
    }
    console.log('\n📊 Summary of Created GIFs:');
    for (const result of results) {
        console.log(`   ${result.name}:`);
        console.log(`     Size: ${(result.size / 1024).toFixed(1)} KB`);
        console.log(`     Duration: ${(result.duration / 1000).toFixed(1)}s`);
        console.log(`     Frames: ${result.frames}`);
    }
    return results;
}
// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        // Create multiple variants
        createMultipleCollectionGIFs().catch(console.error);
    }
    else if (args.length >= 2) {
        // Create single GIF
        const [imagesDir, outputPath] = args;
        const width = args[2] ? parseInt(args[2]) : 256;
        const height = args[3] ? parseInt(args[3]) : 256;
        const delay = args[4] ? parseInt(args[4]) : 1000;
        createCollectionGIFFromImages(imagesDir, outputPath, {
            width,
            height,
            delay
        }).catch(console.error);
    }
    else {
        console.log('Usage:');
        console.log('  npm run create-collection-gif                    # Create multiple variants');
        console.log('  npm run create-collection-gif <dir> <output>     # Create single GIF');
        console.log('  npm run create-collection-gif <dir> <output> <width> <height> <delay>');
    }
}
//# sourceMappingURL=create-collection-gif.js.map