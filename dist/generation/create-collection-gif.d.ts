/**
 * Standalone script to create collection thumbnail GIF from existing NFT images
 * This can be used to create collection previews from any set of NFT images
 */
declare function createCollectionGIFFromImages(imagesDir: string, outputPath: string, options?: {
    width?: number;
    height?: number;
    delay?: number;
    quality?: number;
    pattern?: string;
}): Promise<{
    outputPath: string;
    size: number;
    frames: number;
    creationTime: number;
    duration: number;
}>;
declare function createMultipleCollectionGIFs(): Promise<{
    outputPath: string;
    size: number;
    frames: number;
    creationTime: number;
    duration: number;
    name: string;
}[]>;
export { createCollectionGIFFromImages, createMultipleCollectionGIFs };
//# sourceMappingURL=create-collection-gif.d.ts.map