# Generation Engine - Image Compositing

The Kirito SDK Generation Engine provides production-ready image compositing capabilities for NFT generation using Sharp (primary) and Canvas (fallback) libraries.

## Features

- **High-Performance Compositing**: Uses Sharp for optimal performance and quality
- **Automatic Fallbacks**: Falls back to Canvas API if Sharp is unavailable
- **Multiple Image Variants**: Generate different sizes and formats automatically
- **Advanced Effects**: Apply blur, brightness, contrast, and positioning effects
- **Flexible Configuration**: Customizable canvas size, background, and layer positioning

## Basic Usage

```typescript
import { KiritoGenerationEngine, CompositeOptions, ImageVariant } from './generation';

// Basic configuration
const config = {
  network: { /* network config */ },
  ipfs: { /* IPFS config */ },
  privacy: { /* privacy config */ }
};

// Create generation engine with custom composite options
const compositeOptions: CompositeOptions = {
  canvasWidth: 1000,
  canvasHeight: 1000,
  backgroundColor: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent
  outputFormat: 'png',
  quality: 95
};

const engine = new KiritoGenerationEngine(config, compositeOptions);
```

## Advanced Compositing

```typescript
// Configure layer positions and effects
const advancedOptions: CompositeOptions = {
  canvasWidth: 1200,
  canvasHeight: 1200,
  backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 }, // White background
  layerPositions: {
    'background': { x: 0, y: 0, scale: 1.0 },
    'character': { x: 100, y: 100, scale: 0.8 },
    'accessories': { x: 50, y: 50, scale: 1.2 }
  },
  effects: {
    'background': { blur: 2, brightness: 0.9 },
    'character': { contrast: 1.1 },
    'accessories': { brightness: 1.1 }
  }
};

engine.setCompositeOptions(advancedOptions);
```

## Multiple Image Variants

```typescript
// Define image variants
const variants: ImageVariant[] = [
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
    format: 'webp',
    quality: 85
  },
  {
    name: 'thumbnail',
    width: 128,
    height: 128,
    format: 'jpeg',
    quality: 75
  }
];

// Generate collection with variants
const result = await engine.generateCollectionWithVariants(generationConfig, variants);

// Access different variants
const originalImage = result.variants['1']['original']; // NFT #1 original size
const thumbnail = result.variants['1']['thumbnail'];    // NFT #1 thumbnail
```

## Standard Variants

```typescript
// Use predefined standard variants
const standardVariants = HashLipsEngine.createStandardVariants();
// Includes: original (1000x1000 PNG), large (512x512 PNG), 
//          medium (256x256 WebP), thumbnail (128x128 WebP), 
//          preview (64x64 JPEG)

const result = await engine.generateCollectionWithVariants(config, standardVariants);
```

## Capability Detection

```typescript
// Check available image processing capabilities
const capabilities = await KiritoGenerationEngine.validateImageProcessing();

console.log('Sharp available:', capabilities.sharp);
console.log('Canvas available:', capabilities.canvas);
console.log('Capabilities:', capabilities.capabilities);
// Output: ['sharp', 'high-performance', 'webp', 'advanced-effects']
```

## Error Handling

The image compositing system includes multiple fallback layers:

1. **Sharp (Primary)**: High-performance image processing with full feature support
2. **Canvas (Fallback)**: Basic compositing when Sharp is unavailable
3. **Simple (Final Fallback)**: Returns first trait image if all else fails

```typescript
try {
  const collection = await engine.generateCollection(config);
} catch (error) {
  console.error('Generation failed:', error);
  // The system will automatically attempt fallbacks
}
```

## Performance Considerations

- **Sharp**: Fastest, supports WebP, advanced effects, and parallel processing
- **Canvas**: Moderate performance, good compatibility, basic compositing
- **Memory Usage**: Large collections may require batch processing
- **File Formats**: PNG for transparency, WebP for smaller sizes, JPEG for thumbnails

## Installation Requirements

```bash
# Primary dependency (recommended)
npm install sharp

# Fallback dependency (optional)
npm install canvas

# The system will work with either or both installed
```

## Layer Structure

Organize your trait layers in this structure:
```
traits/
├── background/
│   ├── blue.png
│   ├── red.png
│   └── green.png
├── character/
│   ├── warrior.png
│   ├── mage.png
│   └── archer.png
└── accessories/
    ├── sword.png
    ├── staff.png
    └── bow.png
```

The compositing engine will layer images in the order specified in your layer configuration, with proper alpha blending and positioning.