/**
 * Generate 10 NFTs using the existing traits folder
 * This script demonstrates real NFT generation with actual trait images
 */
declare function generateNFTsFromTraits(): Promise<{
    nfts: import("./hashlips-engine").GeneratedNFT[];
    stats: import("./hashlips-engine").RarityStats;
    generationTime: number;
    outputDir: string;
    summary: {
        collection: {
            name: string;
            description: string;
            total_supply: number;
            generated_at: string;
            generation_time_ms: number;
            collection_thumbnail: string;
        };
        statistics: {
            total_combinations: number;
            generated_nfts: number;
            success_rate: string;
            rarity_distribution: {
                [score: string]: number;
            };
            average_rarity_score: string;
            average_yield_multiplier: string;
        };
        layers: {
            name: string;
            trait_count: number;
            traits: {
                name: string;
                weight: number;
                rarity_percentage: string;
            }[];
        }[];
        nfts: {
            token_id: string;
            dna: string;
            rarity_score: number;
            yield_multiplier: number;
            attributes: import(".").Attribute[];
        }[];
    };
}>;
export { generateNFTsFromTraits };
//# sourceMappingURL=generate-nfts-from-traits.d.ts.map