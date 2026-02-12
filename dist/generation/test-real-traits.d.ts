/**
 * Test script for real NFT generation with traits folder
 * This demonstrates the complete NFT generation workflow
 */
declare function testRealNFTGeneration(): Promise<{
    nfts: import("./hashlips-engine").GeneratedNFT[];
    stats: import("./hashlips-engine").RarityStats;
    generationTime: number;
    outputDir: string;
}>;
declare function explainArchitecture(): void;
export { testRealNFTGeneration, explainArchitecture };
//# sourceMappingURL=test-real-traits.d.ts.map