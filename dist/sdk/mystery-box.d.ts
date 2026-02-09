import { TokenId, BoxId, HiddenData, RevealConditions, MysteryBox, RevealedTraits, ZKProof, Secret, PublicInputs, NoirCircuit, CompiledCircuit, KiritoSDKConfig } from '../types';
import { MysteryBoxManager, ZKCircuitManager } from '../interfaces';
/**
 * Mystery Box Manager SDK Implementation
 * Handles creation and revelation of mystery boxes with hidden traits
 */
export declare class MysteryBoxManagerSDK implements MysteryBoxManager {
    private config;
    private zkCircuitManager;
    private mysteryBoxes;
    constructor(config: KiritoSDKConfig);
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
    /**
     * Get all mystery boxes for a token
     */
    getMysteryBoxesForToken(tokenId: TokenId): Promise<MysteryBox[]>;
    /**
     * Get ZK Circuit Manager instance
     */
    getZKCircuitManager(): ZKCircuitManager;
    private generateBoxId;
    private encryptHiddenData;
    private decryptHiddenData;
    private checkActionCondition;
    private checkMinimumStake;
    private checkGovernanceParticipation;
    private checkYieldClaim;
    private registerMysteryBoxOnChain;
    private updateConditionsOnChain;
    private recordRevealOnChain;
}
/**
 * ZK Circuit Manager SDK Implementation
 * Handles Noir circuit compilation and proof generation
 */
export declare class ZKCircuitManagerSDK implements ZKCircuitManager {
    private config;
    private compiledCircuits;
    constructor(config: KiritoSDKConfig);
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
    /**
     * Get compiled circuit by hash
     */
    getCompiledCircuit(circuitHash: string): CompiledCircuit | undefined;
    /**
     * Clear compiled circuit cache
     */
    clearCircuitCache(): void;
    private hashCircuit;
}
//# sourceMappingURL=mystery-box.d.ts.map