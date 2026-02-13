/**
 * Garaga Integration for On-Chain ZK Proof Verification
 * Production implementation for Starknet proof verification using Garaga
 * Based on official Garaga documentation: https://garaga.gitbook.io/garaga
 *
 * Prerequisites:
 * - npm install garaga@latest
 * - Compiled Noir circuits with verification keys
 * - Deployed Garaga verifier contract on Starknet
 */
import { Account } from 'starknet';
import { ZKProof, TokenId, BoxId, KiritoSDKConfig } from '../types';
export interface GaragaProof {
    proof: string[];
    public_inputs: string[];
    verification_key_hash: string;
}
export interface GaragaVerifierContract {
    verify_groth16_proof_bn254(proof: string[], public_inputs: string[], vk_hash: string): Promise<boolean>;
    verify_ultra_honk_proof(proof: string[], public_inputs: string[], vk_hash: string): Promise<boolean>;
}
export interface VerificationKeyConfig {
    fullRevealVkPath: string;
    bluffingRevealVkPath: string;
    verifierContractAddress?: string;
}
/**
 * Garaga SDK Integration for Mystery Box Verification
 * Production-ready on-chain proof verification using Garaga verifier contracts
 */
export declare class GaragaMysteryBoxVerifier {
    private config;
    private provider;
    private verifierContract?;
    private account?;
    private fullRevealVkHashPromise;
    private bluffingRevealVkHashPromise;
    private vkConfig;
    constructor(config: KiritoSDKConfig, vkConfig: VerificationKeyConfig);
    /**
     * Load verification key hash from compiled circuit
     */
    private loadVerificationKeyHash;
    /**
     * Compute verification key hash from VK data
     */
    private computeVkHash;
    /**
     * Initialize Garaga verifier contract with real ABI
     */
    initialize(account: Account, verifierContractAddress?: string): Promise<void>;
    /**
     * Load verifier contract ABI from compiled contract
     */
    private loadVerifierAbi;
    /**
     * Verify contract connection is working
     */
    private verifyContractConnection;
    /**
     * Verify mystery box reveal proof on-chain using Garaga
     * Production implementation with proper error handling
     */
    verifyRevealProofOnChain(boxId: BoxId, tokenId: TokenId, proof: ZKProof, revealType?: 'full' | 'bluffing'): Promise<boolean>;
    /**
     * Parse verification result from contract call
     */
    private parseVerificationResult;
    /**
     * Submit mystery box reveal transaction on-chain
     * Production implementation with proper transaction handling
     */
    submitRevealTransaction(boxId: BoxId, proof: ZKProof, nullifier: string, revealType?: 'full' | 'bluffing'): Promise<string>;
    /**
     * Generate Garaga verifier contract using Garaga CLI
     * Production implementation that actually executes Garaga commands
     *
     * Prerequisites:
     * - Garaga CLI installed: pip install garaga
     * - Compiled Noir circuit with verification key
     *
     * Steps:
     * 1. garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     * 2. Compile with scarb build
     * 3. Deploy using starkli or scarb
     */
    generateVerifierContract(vkPath: string, outputPath: string, system?: 'groth16' | 'ultra_honk'): Promise<void>;
    /**
     * Deploy Garaga verifier contract to Starknet
     * Production implementation using Starknet.js
     */
    deployVerifierContract(compiledContractPath: string, constructorCalldata: string[]): Promise<string>;
    /**
     * Save deployment information for future reference
     */
    private saveDeploymentInfo;
    /**
     * Get verification key hash for proof type
     */
    getVerificationKeyHash(proofType: 'full' | 'bluffing'): Promise<string>;
    /**
     * Update verification key hashes (for contract upgrades)
     * Production implementation with proper transaction handling
     */
    updateVerificationKeys(fullRevealVk: string, bluffingRevealVk: string): Promise<void>;
    /**
     * Convert ZKProof to Garaga format
     */
    private convertToGaragaFormat;
    /**
     * Convert bytes to Starknet felt
     */
    private bytesToFelt;
    /**
     * Convert bytes array to felt array
     */
    private bytesToFeltArray;
    /**
     * Convert string to felt
     */
    private stringToFelt;
}
/**
 * Garaga CLI Integration Helper
 * Production utilities for working with Garaga command-line tools
 * Based on official Garaga CLI: https://garaga.gitbook.io/garaga
 */
export declare class GaragaCLIHelper {
    /**
     * Generate verification key from Noir circuit
     * Requires: nargo compile && garaga gen
     */
    static generateVerificationKey(circuitPath: string, outputPath: string): Promise<string>;
    /**
     * Generate verifier contract from verification key
     * Command: garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     */
    static generateVerifierContract(vkPath: string, outputPath: string): Promise<void>;
    /**
     * Declare contract on Starknet using starkli
     * Requires: scarb build && starkli declare
     */
    static declareContract(contractPath: string, accountPath: string, rpcUrl: string): Promise<string>;
    /**
     * Deploy contract instance using starkli
     * Command: starkli deploy <class-hash> <constructor-args>
     */
    static deployContract(classHash: string, constructorArgs: string[], accountPath: string, rpcUrl: string): Promise<string>;
    /**
     * Verify proof on-chain using Garaga verifier
     * Requires deployed verifier contract
     */
    static verifyOnChain(contractAddress: string, vkPath: string, proofPath: string, publicInputsPath: string, accountPath: string, rpcUrl: string): Promise<boolean>;
    /**
     * Check if Garaga CLI is installed
     */
    static checkGaragaInstallation(): Promise<boolean>;
    /**
     * Install Garaga CLI
     */
    static installGaraga(): Promise<void>;
}
//# sourceMappingURL=garaga-integration.d.ts.map