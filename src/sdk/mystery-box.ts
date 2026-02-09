import {
  TokenId,
  BoxId,
  HiddenData,
  RevealConditions,
  MysteryBox,
  RevealedTraits,
  ZKProof,
  Secret,
  PublicInputs,
  NoirCircuit,
  CompiledCircuit,
  KiritoSDKConfig,
  Timestamp,
  EncryptedData
} from '../types';

import { MysteryBoxManager, ZKCircuitManager } from '../interfaces';
import { NoirMysteryBoxCircuit, TRAIT_CATEGORIES } from '../circuits/noir-integration';

/**
 * Mystery Box Manager SDK Implementation
 * Handles creation and revelation of mystery boxes with hidden traits
 */
export class MysteryBoxManagerSDK implements MysteryBoxManager {
  private config: KiritoSDKConfig;
  private zkCircuitManager: ZKCircuitManagerSDK;
  private noirCircuit: NoirMysteryBoxCircuit;
  private mysteryBoxes: Map<BoxId, MysteryBox> = new Map();

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    this.zkCircuitManager = new ZKCircuitManagerSDK(config);
    this.noirCircuit = new NoirMysteryBoxCircuit();
  }

  /**
   * Create mystery box for NFT
   */
  async createMysteryBox(tokenId: TokenId, hiddenData: HiddenData): Promise<MysteryBox> {
    try {
      // Generate unique box ID
      const boxId = this.generateBoxId(tokenId);
      
      // Encrypt hidden traits using the encryption utility
      const encryptedTraits = await this.encryptHiddenData(hiddenData);
      
      // Create mystery box
      const mysteryBox: MysteryBox = {
        tokenId,
        encryptedTraits,
        revealConditions: {
          type: 'timelock',
          timestamp: Date.now() + 86400000 // Default 24 hours
        },
        isRevealed: false
      };

      // Store mystery box
      this.mysteryBoxes.set(boxId, mysteryBox);

      // Register mystery box on-chain
      const txHash = await this.registerMysteryBoxOnChain(boxId, mysteryBox);
      
      console.log(`Mystery box created for NFT ${tokenId}: ${boxId}, tx: ${txHash}`);
      return mysteryBox;
    } catch (error) {
      throw new Error(`Failed to create mystery box: ${error}`);
    }
  }

  /**
   * Set reveal conditions for mystery box
   */
  async setRevealConditions(boxId: BoxId, conditions: RevealConditions): Promise<void> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        throw new Error(`Mystery box not found: ${boxId}`);
      }

      if (mysteryBox.isRevealed) {
        throw new Error('Cannot change conditions for already revealed mystery box');
      }

      // Update reveal conditions
      mysteryBox.revealConditions = conditions;
      this.mysteryBoxes.set(boxId, mysteryBox);

      // Update conditions on-chain
      const txHash = await this.updateConditionsOnChain(boxId, conditions);
      
      console.log(`Reveal conditions updated for mystery box ${boxId}, tx: ${txHash}`);
    } catch (error) {
      throw new Error(`Failed to set reveal conditions: ${error}`);
    }
  }

  /**
   * Reveal traits using zero-knowledge proof
   */
  async revealTraits(boxId: BoxId, proof: ZKProof): Promise<RevealedTraits> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        throw new Error(`Mystery box not found: ${boxId}`);
      }

      if (mysteryBox.isRevealed) {
        throw new Error('Mystery box already revealed');
      }

      // Check if reveal conditions are met
      const conditionsMet = await this.checkRevealConditions(boxId);
      if (!conditionsMet) {
        throw new Error('Reveal conditions not met');
      }

      // Verify the zero-knowledge proof using Noir circuit
      const isValidProof = await this.noirCircuit.verifyRevealProof(
        proof,
        boxId,
        mysteryBox.tokenId,
        'full'
      );
      if (!isValidProof) {
        throw new Error('Invalid reveal proof');
      }

      // Decrypt hidden traits
      const decryptedTraits = await this.decryptHiddenData(mysteryBox.encryptedTraits);
      
      // Create revealed traits object
      const revealedTraits: RevealedTraits = {
        traits: decryptedTraits,
        timestamp: Date.now(),
        proof
      };

      // Mark mystery box as revealed
      mysteryBox.isRevealed = true;
      mysteryBox.revealProof = proof;
      this.mysteryBoxes.set(boxId, mysteryBox);

      // Record reveal on-chain
      const txHash = await this.recordRevealOnChain(boxId, revealedTraits);
      
      console.log(`Mystery box revealed: ${boxId}, tx: ${txHash}`);
      return revealedTraits;
    } catch (error) {
      throw new Error(`Failed to reveal traits: ${error}`);
    }
  }

  /**
   * Verify reveal proof
   */
  async verifyReveal(boxId: BoxId, proof: ZKProof): Promise<boolean> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        return false;
      }

      // Use Noir circuit for proof verification
      return await this.noirCircuit.verifyRevealProof(
        proof,
        boxId,
        mysteryBox.tokenId,
        'full'
      );
    } catch (error) {
      console.error(`Failed to verify reveal proof: ${error}`);
      return false;
    }
  }

  /**
   * Check if reveal conditions are met
   */
  async checkRevealConditions(boxId: BoxId): Promise<boolean> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        return false;
      }

      const conditions = mysteryBox.revealConditions;
      const currentTime = Date.now();

      switch (conditions.type) {
        case 'timelock':
          return conditions.timestamp ? currentTime >= conditions.timestamp : false;
          
        case 'action':
          return await this.checkActionCondition(mysteryBox.tokenId, conditions.requiredAction || '');
          
        case 'combined':
          const timeMet = conditions.timestamp ? currentTime >= conditions.timestamp : true;
          const actionMet = conditions.requiredAction ? 
            await this.checkActionCondition(mysteryBox.tokenId, conditions.requiredAction) : true;
          return timeMet && actionMet;
          
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to check reveal conditions: ${error}`);
      return false;
    }
  }

  /**
   * Get mystery box by ID
   */
  async getMysteryBox(boxId: BoxId): Promise<MysteryBox> {
    const mysteryBox = this.mysteryBoxes.get(boxId);
    if (!mysteryBox) {
      throw new Error(`Mystery box not found: ${boxId}`);
    }
    return { ...mysteryBox }; // Return copy to prevent external modification
  }

  /**
   * Get all mystery boxes for a token
   */
  async getMysteryBoxesForToken(tokenId: TokenId): Promise<MysteryBox[]> {
    const boxes: MysteryBox[] = [];
    for (const [boxId, box] of this.mysteryBoxes.entries()) {
      if (box.tokenId === tokenId) {
        boxes.push({ ...box });
      }
    }
    return boxes;
  }

  /**
   * Get ZK Circuit Manager instance
   */
  getZKCircuitManager(): ZKCircuitManager {
    return this.zkCircuitManager;
  }

  /**
   * Generate reveal proof using Noir circuit
   */
  async generateRevealProof(
    boxId: BoxId,
    encryptionKey: string,
    revealType: 'full' | 'bluffing' = 'full',
    bluffCategory?: string
  ): Promise<ZKProof> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        throw new Error(`Mystery box not found: ${boxId}`);
      }

      // Decrypt hidden data to get the original traits
      const hiddenData = await this.getHiddenDataForProof(mysteryBox.encryptedTraits);
      
      // Convert bluff category string to number if provided
      let bluffCategoryNum: number | undefined;
      if (bluffCategory) {
        bluffCategoryNum = this.getTraitCategoryNumber(bluffCategory);
      }

      // Generate proof using Noir circuit
      return await this.noirCircuit.generateRevealProof(
        boxId,
        mysteryBox.tokenId,
        hiddenData,
        mysteryBox.revealConditions,
        encryptionKey,
        revealType,
        bluffCategoryNum
      );
    } catch (error) {
      throw new Error(`Failed to generate reveal proof: ${error}`);
    }
  }

  /**
   * Generate bluffing proof for trait category
   */
  async generateBluffingProof(
    boxId: BoxId,
    traitCategory: string,
    encryptionKey: string
  ): Promise<ZKProof> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        throw new Error(`Mystery box not found: ${boxId}`);
      }

      // Get hidden data for proof generation
      const hiddenData = await this.getHiddenDataForProof(mysteryBox.encryptedTraits);
      
      // Verify that the mystery box contains a trait in the requested category
      const hasTraitInCategory = await this.verifyTraitCategoryExists(hiddenData, traitCategory);
      if (!hasTraitInCategory) {
        throw new Error(`Mystery box does not contain traits in category: ${traitCategory}`);
      }

      // Generate bluffing proof using Noir circuit
      const categoryNum = this.getTraitCategoryNumber(traitCategory);
      return await this.noirCircuit.generateBluffingProof(
        boxId,
        mysteryBox.tokenId,
        hiddenData,
        categoryNum,
        encryptionKey
      );
    } catch (error) {
      throw new Error(`Failed to generate bluffing proof: ${error}`);
    }
  }

  /**
   * Verify bluffing proof
   */
  async verifyBluffingProof(
    boxId: BoxId,
    proof: ZKProof,
    traitCategory: string
  ): Promise<boolean> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        return false;
      }

      // Verify proof using Noir circuit
      return await this.noirCircuit.verifyRevealProof(
        proof,
        boxId,
        mysteryBox.tokenId,
        'bluffing'
      );
    } catch (error) {
      console.error(`Failed to verify bluffing proof: ${error}`);
      return false;
    }
  }

  /**
   * Get available trait categories for bluffing
   */
  async getAvailableTraitCategories(boxId: BoxId): Promise<string[]> {
    try {
      const mysteryBox = this.mysteryBoxes.get(boxId);
      if (!mysteryBox) {
        throw new Error(`Mystery box not found: ${boxId}`);
      }

      // For demo purposes, return mock categories
      // In a real implementation, this would analyze the encrypted traits
      return ['power', 'ability', 'yield', 'rarity'];
    } catch (error) {
      console.error(`Failed to get trait categories: ${error}`);
      return [];
    }
  }

  // Private helper methods

  private generateBoxId(tokenId: TokenId): BoxId {
    // Generate unique box ID using token ID and timestamp
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `box_${tokenId}_${timestamp}_${random}`;
  }

  private async encryptHiddenData(hiddenData: HiddenData): Promise<EncryptedData> {
    try {
      // Serialize hidden data
      const dataString = JSON.stringify(hiddenData);
      const dataBytes = new TextEncoder().encode(dataString);
      
      // Generate encryption key and nonce
      const key = crypto.getRandomValues(new Uint8Array(32));
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      
      // Simple XOR encryption (in real implementation would use AES-GCM)
      const encrypted = new Uint8Array(dataBytes.length);
      for (let i = 0; i < dataBytes.length; i++) {
        encrypted[i] = dataBytes[i] ^ key[i % key.length];
      }

      return {
        data: encrypted,
        nonce
      };
    } catch (error) {
      throw new Error(`Failed to encrypt hidden data: ${error}`);
    }
  }

  private async decryptHiddenData(encryptedData: EncryptedData): Promise<any> {
    try {
      // In real implementation, would need the encryption key
      // For demo purposes, we'll simulate decryption
      const mockDecrypted = {
        traits: {
          'Hidden Power': 'Lightning Strike',
          'Secret Ability': 'Time Manipulation',
          'Bonus Yield': '15%'
        },
        yieldRange: {
          min: 100,
          max: 500
        }
      };

      return mockDecrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt hidden data: ${error}`);
    }
  }

  private async checkActionCondition(tokenId: TokenId, requiredAction: string): Promise<boolean> {
    try {
      // Check if required action has been performed
      switch (requiredAction) {
        case 'stake_minimum':
          return await this.checkMinimumStake(tokenId);
        case 'governance_participation':
          return await this.checkGovernanceParticipation(tokenId);
        case 'yield_claim':
          return await this.checkYieldClaim(tokenId);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to check action condition: ${error}`);
      return false;
    }
  }

  private async checkMinimumStake(tokenId: TokenId): Promise<boolean> {
    // Mock implementation - check if NFT has minimum stake
    console.log(`Checking minimum stake for NFT ${tokenId}`);
    return Math.random() > 0.5; // 50% chance for demo
  }

  private async checkGovernanceParticipation(tokenId: TokenId): Promise<boolean> {
    // Mock implementation - check if holder participated in governance
    console.log(`Checking governance participation for NFT ${tokenId}`);
    return Math.random() > 0.3; // 70% chance for demo
  }

  private async checkYieldClaim(tokenId: TokenId): Promise<boolean> {
    // Mock implementation - check if holder claimed yield
    console.log(`Checking yield claim for NFT ${tokenId}`);
    return Math.random() > 0.4; // 60% chance for demo
  }

  private async registerMysteryBoxOnChain(boxId: BoxId, mysteryBox: MysteryBox): Promise<string> {
    // Mock on-chain registration
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Registering mystery box on-chain: ${boxId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  private async updateConditionsOnChain(boxId: BoxId, conditions: RevealConditions): Promise<string> {
    // Mock on-chain update
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Updating reveal conditions on-chain: ${boxId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  private async recordRevealOnChain(boxId: BoxId, revealedTraits: RevealedTraits): Promise<string> {
    // Mock on-chain reveal recording
    const mockTxHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    console.log(`Recording reveal on-chain: ${boxId}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return mockTxHash;
  }

  private async getHiddenDataForProof(encryptedData: EncryptedData): Promise<HiddenData> {
    // In a real implementation, this would require the encryption key
    // For demo purposes, return mock hidden data
    return {
      traits: {
        'Hidden Power': 'Lightning Strike',
        'Secret Ability': 'Time Manipulation',
        'Bonus Yield': '15%',
        'Rare Attribute': 'Golden Aura'
      },
      yieldRange: {
        min: 100,
        max: 500
      }
    };
  }

  private getTraitCategoryNumber(category: string): number {
    const categoryLower = category.toLowerCase();
    switch (categoryLower) {
      case 'power':
        return TRAIT_CATEGORIES.POWER;
      case 'ability':
        return TRAIT_CATEGORIES.ABILITY;
      case 'yield':
        return TRAIT_CATEGORIES.YIELD;
      case 'rarity':
        return TRAIT_CATEGORIES.RARITY;
      default:
        throw new Error(`Unknown trait category: ${category}`);
    }
  }

  private async verifyTraitCategoryExists(hiddenData: HiddenData, category: string): Promise<boolean> {
    if (!hiddenData.traits) {
      return false;
    }

    const categoryLower = category.toLowerCase();
    
    // Check if any trait belongs to the requested category
    for (const traitName of Object.keys(hiddenData.traits)) {
      const traitCategory = this.determineTraitCategory(traitName);
      if (traitCategory === categoryLower) {
        return true;
      }
    }

    return false;
  }

  private determineTraitCategory(traitName: string): string {
    const name = traitName.toLowerCase();
    
    if (name.includes('power') || name.includes('strength') || name.includes('attack')) {
      return 'power';
    } else if (name.includes('ability') || name.includes('skill') || name.includes('magic')) {
      return 'ability';
    } else if (name.includes('yield') || name.includes('bonus') || name.includes('multiplier')) {
      return 'yield';
    } else {
      return 'rarity';
    }
  }
}

/**
 * ZK Circuit Manager SDK Implementation
 * Handles Noir circuit compilation and proof generation
 */
export class ZKCircuitManagerSDK implements ZKCircuitManager {
  private config: KiritoSDKConfig;
  private compiledCircuits: Map<string, CompiledCircuit> = new Map();
  private noirCircuit: NoirMysteryBoxCircuit;

  constructor(config: KiritoSDKConfig) {
    this.config = config;
    this.noirCircuit = new NoirMysteryBoxCircuit();
  }

  /**
   * Generate reveal proof
   */
  async generateRevealProof(secret: Secret, publicInputs: PublicInputs): Promise<ZKProof> {
    try {
      // Mock proof generation using Noir
      console.log('Generating reveal proof with Noir circuit...');
      
      // Simulate proof generation delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate mock proof
      const proof = crypto.getRandomValues(new Uint8Array(256));
      const publicInputsArray = Object.values(publicInputs).map(input => {
        if (typeof input === 'string') {
          return new TextEncoder().encode(input);
        } else if (Array.isArray(input)) {
          return new Uint8Array(input);
        } else {
          return new TextEncoder().encode(JSON.stringify(input));
        }
      });

      return {
        proof,
        publicInputs: publicInputsArray
      };
    } catch (error) {
      throw new Error(`Failed to generate reveal proof: ${error}`);
    }
  }

  /**
   * Verify zero-knowledge proof
   */
  async verifyProof(proof: ZKProof, publicInputs: PublicInputs): Promise<boolean> {
    try {
      console.log('Verifying zero-knowledge proof...');
      
      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mock verification - check that proof and public inputs are non-empty
      const hasValidProof = proof.proof.length > 0;
      const hasValidInputs = proof.publicInputs.length > 0;
      const inputsMatch = Object.keys(publicInputs).length > 0;
      
      return hasValidProof && hasValidInputs && inputsMatch;
    } catch (error) {
      console.error(`Failed to verify proof: ${error}`);
      return false;
    }
  }

  /**
   * Compile Noir circuit
   */
  async compileCircuit(circuit: NoirCircuit): Promise<CompiledCircuit> {
    try {
      console.log('Compiling Noir circuit...');
      
      // Simulate compilation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate circuit hash for caching
      const circuitHash = await this.hashCircuit(circuit);
      
      // Check if already compiled
      const cached = this.compiledCircuits.get(circuitHash);
      if (cached) {
        console.log('Using cached compiled circuit');
        return cached;
      }

      // Mock compilation result
      const compiled: CompiledCircuit = {
        bytecode: crypto.getRandomValues(new Uint8Array(1024)),
        abi: {
          parameters: ['secret', 'public_inputs'],
          return_type: 'proof'
        }
      };

      // Cache compiled circuit
      this.compiledCircuits.set(circuitHash, compiled);
      
      console.log('Circuit compiled successfully');
      return compiled;
    } catch (error) {
      throw new Error(`Failed to compile circuit: ${error}`);
    }
  }

  /**
   * Generate bluffing proof (prove category without revealing specific trait)
   */
  async generateBluffingProof(traitCategory: string, secret: Secret): Promise<ZKProof> {
    try {
      console.log(`Generating bluffing proof for category: ${traitCategory}`);
      
      // Use Noir circuit for bluffing proof generation
      // In a real implementation, this would use the actual secret and trait data
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Generate proof that proves knowledge of a trait in the category
      // without revealing the specific trait
      const proof = crypto.getRandomValues(new Uint8Array(256));
      const publicInputs = [
        new TextEncoder().encode(traitCategory),
        new TextEncoder().encode('category_membership'),
        new TextEncoder().encode('bluffing_proof')
      ];

      return {
        proof,
        publicInputs
      };
    } catch (error) {
      throw new Error(`Failed to generate bluffing proof: ${error}`);
    }
  }

  /**
   * Get compiled circuit by hash
   */
  getCompiledCircuit(circuitHash: string): CompiledCircuit | undefined {
    return this.compiledCircuits.get(circuitHash);
  }

  /**
   * Clear compiled circuit cache
   */
  clearCircuitCache(): void {
    this.compiledCircuits.clear();
    console.log('Circuit cache cleared');
  }

  // Private helper methods

  private async hashCircuit(circuit: NoirCircuit): Promise<string> {
    // Generate hash of circuit source and dependencies
    const data = circuit.source + circuit.dependencies.join('');
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}