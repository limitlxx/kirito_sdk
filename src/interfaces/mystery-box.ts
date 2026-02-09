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
  CompiledCircuit
} from '../types';

/**
 * Mystery Box Manager Interface
 * Handles creation and revelation of mystery boxes with hidden traits
 */
export interface MysteryBoxManager {
  /**
   * Create mystery box for NFT
   */
  createMysteryBox(tokenId: TokenId, hiddenData: HiddenData): Promise<MysteryBox>;

  /**
   * Set reveal conditions for mystery box
   */
  setRevealConditions(boxId: BoxId, conditions: RevealConditions): Promise<void>;

  /**
   * Reveal traits using zero-knowledge proof
   */
  revealTraits(boxId: BoxId, proof: ZKProof): Promise<RevealedTraits>;

  /**
   * Verify reveal proof
   */
  verifyReveal(boxId: BoxId, proof: ZKProof): Promise<boolean>;

  /**
   * Check if reveal conditions are met
   */
  checkRevealConditions(boxId: BoxId): Promise<boolean>;

  /**
   * Get mystery box by ID
   */
  getMysteryBox(boxId: BoxId): Promise<MysteryBox>;
}

/**
 * ZK Circuit Manager Interface
 * Handles Noir circuit compilation and proof generation
 */
export interface ZKCircuitManager {
  /**
   * Generate reveal proof
   */
  generateRevealProof(secret: Secret, publicInputs: PublicInputs): Promise<ZKProof>;

  /**
   * Verify zero-knowledge proof
   */
  verifyProof(proof: ZKProof, publicInputs: PublicInputs): Promise<boolean>;

  /**
   * Compile Noir circuit
   */
  compileCircuit(circuit: NoirCircuit): Promise<CompiledCircuit>;

  /**
   * Generate bluffing proof (prove category without revealing specific trait)
   */
  generateBluffingProof(traitCategory: string, secret: Secret): Promise<ZKProof>;
}