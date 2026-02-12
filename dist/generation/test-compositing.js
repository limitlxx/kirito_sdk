"use strict";
/**
 * Test script for image compositing functionality
 * This can be run to verify that the image processing works correctly
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testImageProcessing = testImageProcessing;
const hashlips_engine_1 = require("./hashlips-engine");
async function testImageProcessing() {
    console.log('Testing image processing capabilities...');
    try {
        // Test capability detection
        const capabilities = await hashlips_engine_1.HashLipsEngine.validateImageProcessing();
        console.log('Image processing capabilities:', capabilities);
        if (!capabilities.sharp && !capabilities.canvas) {
            console.warn('Neither Sharp nor Canvas is available. Image compositing will use basic fallback.');
            return;
        }
        // Test composite options
        const compositeOptions = {
            canvasWidth: 500,
            canvasHeight: 500,
            backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 },
            outputFormat: 'png',
            quality: 90
        };
        console.log('Composite options configured:', compositeOptions);
        // Test standard variants (including GIF)
        const standardVariants = hashlips_engine_1.HashLipsEngine.createStandardVariants();
        console.log('Standard variants available:', standardVariants.map(v => `${v.name} (${v.width}x${v.height} ${v.format}${v.animated ? ' animated' : ''})`));
        // Test HashLips variants
        const hashLipsVariants = hashlips_engine_1.HashLipsEngine.createHashLipsVariants();
        console.log('HashLips variants available:', hashLipsVariants.map(v => `${v.name} (${v.width}x${v.height} ${v.format}${v.animated ? ' animated' : ''})`));
        console.log('✅ Image processing test completed successfully!');
    }
    catch (error) {
        console.error('❌ Image processing test failed:', error);
    }
}
// Run test if this file is executed directly
if (require.main === module) {
    testImageProcessing().catch(console.error);
}
//# sourceMappingURL=test-compositing.js.map