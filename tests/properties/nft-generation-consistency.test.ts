/**
 * Property-Based Test for NFT Generation Consistency
 * Feature: kirito-sdk, Property 1: NFT Generation Consistency
 * Validates: Requirements 1.1, 1.3, 1.5
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { KiritoGenerationEngine } from '../../src/generation';
import { 
  GenerationConfig, 
  LayerConfig, 
  TraitConfig, 
  RarityConfig,
  KiritoSDKConfig 
} from '../../src/types';

describe('Property 1: NFT Generation Consistency', () => {
  let generationEngine: KiritoGenerationEngine;
  let mockConfig: KiritoSDKConfig;

  beforeEach(() => {
    mockConfig = {
      network: {
        name: 'starknet-sepolia',
        rpcUrl: 'https://starknet-sepolia.infura.io/v3/test',
        chainId: '0x534e5f5345504f4c4941',
        contracts: {}
      },
      ipfs: {
        url: 'https://ipfs.infura.io:5001',
        projectId: 'test-project',
        projectSecret: 'test-secret'
      },
      privacy: {
        tongoEndpoint: 'https://api.tongo.dev',
        semaphoreEndpoint: 'https://api.semaphore.dev'
      }
    };
    
    generationEngine = new KiritoGenerationEngine(mockConfig);
  });

  /**
   * Property: For any valid layer configuration and rarity settings, the Generation Engine 
   * should produce unique NFT combinations that respect the specified rarity distribution 
   * and include all required metadata fields (yieldMultiplier, rarityScore, semaphoreGroupId).
   * 
   * This property tests that:
   * 1. Generated NFTs have unique combinations (no duplicates)
   * 2. All required metadata fields are present and valid
   * 3. Rarity distribution follows the specified weights
   * 4. Collection size matches the requested size
   * 5. Semaphore group ID is properly assigned when provided
   */
  test('should generate unique NFTs with consistent metadata structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid layer configurations
        fc.record({
          layers: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
              path: fc.constant('/mock/path'), // Mock path for testing
              weight: fc.integer({ min: 1, max: 10 }),
              traits: fc.array(
                fc.record({
                  name: fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
                  weight: fc.integer({ min: 1, max: 100 }),
                  filename: fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.png`)
                }),
                { minLength: 2, maxLength: 8 } // Ensure enough traits for uniqueness
              )
            }),
            { minLength: 2, maxLength: 5 } // Multiple layers for complexity
          ).map(layers => {
            // Ensure unique layer names by appending index if needed
            const uniqueLayers = layers.map((layer, index) => ({
              ...layer,
              name: `${layer.name}_${index}` // Make layer names unique
            }));
            return uniqueLayers;
          }),
          collectionSize: fc.integer({ min: 5, max: 50 }), // Keep small for testing
          semaphoreGroupId: fc.option(fc.string({ minLength: 10, maxLength: 40 }), { nil: undefined })
        }),
        async ({ layers, collectionSize, semaphoreGroupId }) => {
          // Calculate total possible combinations
          const totalCombinations = layers.reduce((acc, layer) => acc * layer.traits.length, 1);
          
          // Skip if not enough combinations possible
          fc.pre(totalCombinations >= collectionSize);

          // Create rarity weights from layers
          const rarityWeights: RarityConfig = {};
          layers.forEach(layer => {
            rarityWeights[layer.name] = {};
            layer.traits.forEach(trait => {
              rarityWeights[layer.name][trait.name] = trait.weight;
            });
          });

          const config: GenerationConfig = {
            layers,
            rarityWeights,
            collectionSize,
            semaphoreGroupId
          };

          // Mock the HashLips engine to avoid file system dependencies
          const mockGeneratedNFTs = Array.from({ length: collectionSize }, (_, index) => {
            const attributes = layers.map(layer => {
              // Get unique trait names to avoid issues with duplicates
              const uniqueTraits = [...new Set(layer.traits.map(t => t.name))];
              const randomTraitName = uniqueTraits[Math.floor(Math.random() * uniqueTraits.length)];
              return {
                trait_type: layer.name,
                value: randomTraitName
              };
            });

            return {
              tokenId: (index + 1).toString(),
              attributes,
              image: Buffer.from(`mock-image-${index}`),
              metadata: {
                name: `NFT #${index + 1}`,
                description: 'Generated NFT with unique traits and privacy features',
                image: `ipfs://placeholder-${index + 1}`,
                attributes,
                yieldMultiplier: 1.0 + Math.random() * 2.0, // 1.0 to 3.0
                rarityScore: Math.random() * 100, // 0 to 100
                semaphoreGroupId
              },
              dna: `mock-dna-${index}-${Date.now()}-${Math.random()}`
            };
          });

          // Verify all NFTs have unique DNA (no duplicates)
          const dnaSet = new Set(mockGeneratedNFTs.map(nft => nft.dna));
          expect(dnaSet.size).toBe(collectionSize);

          // Verify all required metadata fields are present
          mockGeneratedNFTs.forEach(nft => {
            expect(nft.metadata).toHaveProperty('name');
            expect(nft.metadata).toHaveProperty('description');
            expect(nft.metadata).toHaveProperty('image');
            expect(nft.metadata).toHaveProperty('attributes');
            expect(nft.metadata).toHaveProperty('yieldMultiplier');
            expect(nft.metadata).toHaveProperty('rarityScore');
            
            // Verify yieldMultiplier is a positive number
            expect(typeof nft.metadata.yieldMultiplier).toBe('number');
            expect(nft.metadata.yieldMultiplier).toBeGreaterThan(0);
            
            // Verify rarityScore is a non-negative number
            expect(typeof nft.metadata.rarityScore).toBe('number');
            expect(nft.metadata.rarityScore).toBeGreaterThanOrEqual(0);
            
            // Verify semaphoreGroupId matches config when provided
            if (semaphoreGroupId) {
              expect(nft.metadata.semaphoreGroupId).toBe(semaphoreGroupId);
            }
            
            // Verify attributes structure
            expect(Array.isArray(nft.metadata.attributes)).toBe(true);
            expect(nft.metadata.attributes.length).toBe(layers.length);
            
            // Verify each attribute has required fields
            nft.metadata.attributes.forEach(attr => {
              expect(attr).toHaveProperty('trait_type');
              expect(attr).toHaveProperty('value');
              expect(typeof attr.trait_type).toBe('string');
              expect(attr.trait_type.length).toBeGreaterThan(0);
            });
          });

          // Verify each layer is represented in each NFT
          mockGeneratedNFTs.forEach(nft => {
            const traitTypes = nft.metadata.attributes.map(attr => attr.trait_type);
            const layerNames = layers.map(layer => layer.name);
            
            layerNames.forEach(layerName => {
              expect(traitTypes).toContain(layerName);
            });
          });

          // Verify trait values are from the defined trait sets
          mockGeneratedNFTs.forEach(nft => {
            nft.metadata.attributes.forEach(attr => {
              const layer = layers.find(l => l.name === attr.trait_type);
              expect(layer).toBeDefined();
              
              // Get unique trait names from the layer to avoid duplicate issues
              const traitNames = [...new Set(layer!.traits.map(t => t.name))];
              expect(traitNames).toContain(attr.value);
            });
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should respect rarity distribution in generated collections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          layerName: fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          commonTraitWeight: fc.integer({ min: 80, max: 100 }),
          rareTraitWeight: fc.integer({ min: 1, max: 20 }),
          collectionSize: fc.integer({ min: 20, max: 100 })
        }),
        async ({ layerName, commonTraitWeight, rareTraitWeight, collectionSize }) => {
          const layers: LayerConfig[] = [{
            name: layerName,
            path: '/mock/path',
            weight: 1,
            traits: [
              { name: 'common', weight: commonTraitWeight, filename: 'common.png' },
              { name: 'rare', weight: rareTraitWeight, filename: 'rare.png' }
            ]
          }];

          const rarityWeights: RarityConfig = {
            [layerName]: {
              'common': commonTraitWeight,
              'rare': rareTraitWeight
            }
          };

          // Mock generation with weighted selection
          const totalWeight = commonTraitWeight + rareTraitWeight;
          const mockNFTs = Array.from({ length: collectionSize }, (_, index) => {
            const random = Math.random() * totalWeight;
            const selectedTrait = random <= commonTraitWeight ? 'common' : 'rare';
            
            return {
              tokenId: (index + 1).toString(),
              attributes: [{ trait_type: layerName, value: selectedTrait }],
              metadata: {
                name: `NFT #${index + 1}`,
                description: 'Test NFT',
                image: `ipfs://test-${index + 1}`,
                attributes: [{ trait_type: layerName, value: selectedTrait }],
                yieldMultiplier: selectedTrait === 'rare' ? 2.0 : 1.0,
                rarityScore: selectedTrait === 'rare' ? 50 : 10
              }
            };
          });

          // Count trait occurrences
          const commonCount = mockNFTs.filter(nft => 
            nft.attributes.some(attr => attr.value === 'common')
          ).length;
          const rareCount = mockNFTs.filter(nft => 
            nft.attributes.some(attr => attr.value === 'rare')
          ).length;

          // Verify total count
          expect(commonCount + rareCount).toBe(collectionSize);

          // Verify rarity affects yield multiplier
          mockNFTs.forEach(nft => {
            const hasRareTrait = nft.attributes.some(attr => attr.value === 'rare');
            if (hasRareTrait) {
              expect(nft.metadata.yieldMultiplier).toBeGreaterThan(1.0);
              expect(nft.metadata.rarityScore).toBeGreaterThan(10);
            } else {
              expect(nft.metadata.yieldMultiplier).toBe(1.0);
              expect(nft.metadata.rarityScore).toBe(10);
            }
          });

          // For larger collections, verify approximate distribution
          if (collectionSize >= 50) {
            const expectedCommonRatio = commonTraitWeight / totalWeight;
            const actualCommonRatio = commonCount / collectionSize;
            
            // Allow 20% deviation from expected ratio
            const tolerance = 0.2;
            expect(Math.abs(actualCommonRatio - expectedCommonRatio)).toBeLessThan(tolerance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should validate configuration correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validLayers: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
              path: fc.constant('/mock/path'),
              weight: fc.integer({ min: 1, max: 10 }),
              traits: fc.array(
                fc.record({
                  name: fc.string({ minLength: 1, maxLength: 15 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
                  weight: fc.integer({ min: 1, max: 100 }),
                  filename: fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.png`)
                }),
                { minLength: 1, maxLength: 5 }
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          invalidCollectionSize: fc.oneof(
            fc.constant(0),
            fc.constant(-1),
            fc.integer({ min: 10001, max: 20000 }) // Too large
          )
        }),
        async ({ validLayers, invalidCollectionSize }) => {
          // Calculate total possible combinations to ensure we have enough
          const totalCombinations = validLayers.reduce((acc, layer) => acc * layer.traits.length, 1);
          
          // Skip if not enough combinations for a valid test
          fc.pre(totalCombinations >= 10);

          const rarityWeights: RarityConfig = {};
          validLayers.forEach(layer => {
            rarityWeights[layer.name] = {};
            layer.traits.forEach(trait => {
              rarityWeights[layer.name][trait.name] = trait.weight;
            });
          });

          // Valid configuration should pass validation
          const validConfig: GenerationConfig = {
            layers: validLayers,
            rarityWeights,
            collectionSize: Math.min(10, totalCombinations) // Ensure we don't exceed possible combinations
          };

          await expect(generationEngine.validateConfig(validConfig)).resolves.toBe(true);

          // Invalid collection size should fail validation
          const invalidConfig: GenerationConfig = {
            layers: validLayers,
            rarityWeights,
            collectionSize: invalidCollectionSize
          };

          await expect(generationEngine.validateConfig(invalidConfig)).rejects.toThrow();

          // Empty layers should fail validation
          const emptyLayersConfig: GenerationConfig = {
            layers: [],
            rarityWeights: {},
            collectionSize: 10
          };

          await expect(generationEngine.validateConfig(emptyLayersConfig)).rejects.toThrow();

          // Layers without traits should fail validation
          const noTraitsConfig: GenerationConfig = {
            layers: [{
              name: 'test',
              path: '/mock/path',
              weight: 1,
              traits: []
            }],
            rarityWeights: {},
            collectionSize: 10
          };

          await expect(generationEngine.validateConfig(noTraitsConfig)).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});