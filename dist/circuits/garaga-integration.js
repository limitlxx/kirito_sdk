"use strict";
/**
 * Garaga Integration for On-Chain ZK Proof Verification
 * Handles Garaga SDK integration for Starknet proof verification
 * Based on official Garaga documentation: https://garaga.gitbook.io/garaga
 *
 * Real implementation would use:
 * npm install garaga@1.0.1
 * pip install garaga==1.0.1
 * garaga gen --system groth16 --vk verification_key.json
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GaragaCLIHelper = exports.GaragaMysteryBoxVerifier = void 0;
const starknet_1 = require("starknet");
/**
 * Garaga SDK Integration for Mystery Box Verification
 * Handles on-chain proof verification using Garaga verifier contracts
 */
class GaragaMysteryBoxVerifier {
    constructor(config) {
        this.config = config;
        this.provider = new starknet_1.RpcProvider({ nodeUrl: config.network.rpcUrl });
        // Mock verification key hashes - in real implementation these would be generated
        this.fullRevealVkHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        this.bluffingRevealVkHash = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';
    }
    /**
     * Initialize Garaga verifier contract
     */
    async initialize(account, verifierContractAddress) {
        try {
            this.account = account;
            // Load verifier contract ABI (simplified for demo)
            const verifierAbi = [
                {
                    name: 'verify_groth16_proof',
                    type: 'function',
                    inputs: [
                        { name: 'proof', type: 'felt*' },
                        { name: 'public_inputs', type: 'felt*' },
                        { name: 'vk_hash', type: 'felt' }
                    ],
                    outputs: [{ name: 'is_valid', type: 'felt' }]
                },
                {
                    name: 'verify_mystery_box_reveal',
                    type: 'function',
                    inputs: [
                        { name: 'box_id', type: 'felt' },
                        { name: 'proof_data', type: 'felt*' },
                        { name: 'public_inputs', type: 'felt*' },
                        { name: 'nullifier', type: 'felt' }
                    ],
                    outputs: [{ name: 'success', type: 'felt' }]
                }
            ];
            // Create contract instance - use object format for compatibility
            this.verifierContract = new starknet_1.Contract({
                abi: verifierAbi,
                address: verifierContractAddress
            });
            // Connect provider and account
            if (this.provider) {
                this.verifierContract = this.verifierContract.connect(this.provider);
            }
            if (this.account && this.verifierContract) {
                this.verifierContract = this.verifierContract.connect(this.account);
            }
            console.log('Garaga verifier contract initialized');
        }
        catch (error) {
            throw new Error(`Failed to initialize Garaga verifier: ${error}`);
        }
    }
    /**
     * Verify mystery box reveal proof on-chain using Garaga
     */
    async verifyRevealProofOnChain(boxId, tokenId, proof, revealType = 'full') {
        try {
            if (!this.verifierContract) {
                throw new Error('Verifier contract not initialized');
            }
            // Convert proof to Garaga format
            const garagaProof = this.convertToGaragaFormat(proof, revealType);
            console.log(`Verifying ${revealType} reveal proof on-chain for mystery box ${boxId}...`);
            // Call Garaga verifier contract using BN254 curve
            const result = await this.verifierContract.call('verify_groth16_proof_bn254', [
                garagaProof.proof,
                garagaProof.public_inputs,
                garagaProof.verification_key_hash
            ]);
            const isValid = result?.is_valid === '1' || result?.is_valid === 1 || result === '1' || result === 1;
            if (isValid) {
                console.log('On-chain proof verification successful');
            }
            else {
                console.warn('On-chain proof verification failed');
            }
            return isValid;
        }
        catch (error) {
            console.error(`On-chain proof verification error: ${error}`);
            return false;
        }
    }
    /**
     * Submit mystery box reveal transaction on-chain
     */
    async submitRevealTransaction(boxId, proof, nullifier, revealType = 'full') {
        try {
            if (!this.verifierContract || !this.account) {
                throw new Error('Contract or account not initialized');
            }
            // Convert proof to Garaga format
            const garagaProof = this.convertToGaragaFormat(proof, revealType);
            console.log(`Submitting ${revealType} reveal transaction for mystery box ${boxId}...`);
            // Submit transaction to reveal mystery box
            const response = await this.verifierContract.invoke('verify_mystery_box_reveal', [
                this.stringToFelt(boxId),
                garagaProof.proof,
                garagaProof.public_inputs,
                nullifier
            ]);
            await this.provider.waitForTransaction(response.transaction_hash);
            console.log(`Reveal transaction submitted: ${response.transaction_hash}`);
            return response.transaction_hash;
        }
        catch (error) {
            throw new Error(`Failed to submit reveal transaction: ${error}`);
        }
    }
    /**
     * Generate Garaga verifier contract using Garaga CLI
     * Based on: https://garaga.gitbook.io/garaga
     *
     * Real implementation steps:
     * 1. garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     * 2. garaga declare --contract verifier.cairo
     * 3. garaga deploy --class-hash <hash> --constructor-args <args>
     */
    async generateVerifierContract(circuitPath, outputPath) {
        try {
            console.log('Generating Garaga verifier contract...');
            console.log('Circuit path:', circuitPath);
            console.log('Output path:', outputPath);
            // In a real implementation, this would execute:
            // garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
            // For demo purposes, we simulate the contract generation
            const mockVerifierContract = this.generateMockVerifierContract();
            console.log('Verifier contract generated successfully');
            console.log('Contract preview:', mockVerifierContract.substring(0, 200) + '...');
        }
        catch (error) {
            throw new Error(`Failed to generate verifier contract: ${error}`);
        }
    }
    /**
     * Deploy Garaga verifier contract to Starknet
     */
    async deployVerifierContract(compiledContractPath, constructorCalldata) {
        try {
            if (!this.account) {
                throw new Error('Account not initialized');
            }
            console.log('Deploying Garaga verifier contract...');
            // In a real implementation, this would:
            // 1. Declare the contract class
            // 2. Deploy the contract instance
            // 3. Return the contract address
            // Mock deployment for demo
            const mockContractAddress = '0x' + Math.random().toString(16).substring(2, 66);
            console.log('Verifier contract deployed at:', mockContractAddress);
            return mockContractAddress;
        }
        catch (error) {
            throw new Error(`Failed to deploy verifier contract: ${error}`);
        }
    }
    /**
     * Get verification key hash for proof type
     */
    getVerificationKeyHash(proofType) {
        return proofType === 'full' ? this.fullRevealVkHash : this.bluffingRevealVkHash;
    }
    /**
     * Update verification key hashes (for contract upgrades)
     */
    async updateVerificationKeys(fullRevealVk, bluffingRevealVk) {
        try {
            if (!this.verifierContract || !this.account) {
                throw new Error('Contract or account not initialized');
            }
            console.log('Updating verification keys...');
            const response = await this.verifierContract.invoke('update_verification_keys', [
                fullRevealVk,
                bluffingRevealVk
            ]);
            await this.provider.waitForTransaction(response.transaction_hash);
            this.fullRevealVkHash = fullRevealVk;
            this.bluffingRevealVkHash = bluffingRevealVk;
            console.log('Verification keys updated successfully');
        }
        catch (error) {
            throw new Error(`Failed to update verification keys: ${error}`);
        }
    }
    // Private helper methods
    /**
     * Convert ZKProof to Garaga format
     */
    convertToGaragaFormat(proof, revealType) {
        // Convert proof bytes to felt array
        const proofFelts = this.bytesToFeltArray(proof.proof);
        // Convert public inputs to felt array
        const publicInputsFelts = proof.publicInputs.map(input => this.bytesToFelt(input));
        // Get appropriate verification key hash
        const vkHash = this.getVerificationKeyHash(revealType);
        return {
            proof: proofFelts,
            public_inputs: publicInputsFelts,
            verification_key_hash: vkHash
        };
    }
    /**
     * Convert bytes to Starknet felt
     */
    bytesToFelt(bytes) {
        // Convert bytes to big integer then to felt string
        let value = 0n;
        for (let i = 0; i < Math.min(bytes.length, 31); i++) {
            value = (value << 8n) + BigInt(bytes[i]);
        }
        return '0x' + value.toString(16);
    }
    /**
     * Convert bytes array to felt array
     */
    bytesToFeltArray(bytes) {
        const felts = [];
        // Split bytes into 31-byte chunks (max felt size)
        for (let i = 0; i < bytes.length; i += 31) {
            const chunk = bytes.slice(i, i + 31);
            felts.push(this.bytesToFelt(chunk));
        }
        return felts;
    }
    /**
     * Convert string to felt
     */
    stringToFelt(str) {
        const bytes = new TextEncoder().encode(str);
        return this.bytesToFelt(bytes);
    }
    /**
     * Generate mock verifier contract based on Garaga architecture
     * Real contract would be generated by: garaga gen --system groth16 --vk vk.json
     */
    generateMockVerifierContract() {
        return `
// Generated Garaga Verifier Contract for Mystery Box Reveals
// Generated using: garaga gen --system groth16 --vk mystery_box_vk.json
// Based on Garaga v1.0.1 architecture

use garaga::definitions::{G1Point, G2Point, E12D, BN254_ID};
use garaga::groth16::{Groth16Proof, verify_groth16_proof_bn254};
use garaga::basic_field_ops::{FieldOps, FieldUtils};

#[starknet::contract]
mod MysteryBoxGaragaVerifier {
    use super::{verify_groth16_proof_bn254, G1Point, G2Point, BN254_ID};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    
    #[storage]
    struct Storage {
        // Verification keys for different proof types
        full_reveal_vk_hash: felt252,
        bluffing_reveal_vk_hash: felt252,
        
        // Mystery box state
        mystery_boxes: LegacyMap<felt252, MysteryBoxState>,
        used_nullifiers: LegacyMap<felt252, bool>,
        
        // Access control
        owner: ContractAddress,
        authorized_minters: LegacyMap<ContractAddress, bool>,
    }
    
    #[derive(Drop, Serde, starknet::Store)]
    struct MysteryBoxState {
        token_id: felt252,
        owner: ContractAddress,
        commitment: felt252,
        is_revealed: bool,
        reveal_timestamp: u64,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MysteryBoxRevealed: MysteryBoxRevealed,
        BluffingProofVerified: BluffingProofVerified,
    }
    
    #[derive(Drop, starknet::Event)]
    struct MysteryBoxRevealed {
        #[key]
        box_id: felt252,
        #[key]
        token_id: felt252,
        reveal_type: u8,
        timestamp: u64,
    }
    
    #[derive(Drop, starknet::Event)]
    struct BluffingProofVerified {
        #[key]
        box_id: felt252,
        #[key]
        token_id: felt252,
        category: felt252,
        timestamp: u64,
    }
    
    #[constructor]
    fn constructor(
        ref self: ContractState,
        full_reveal_vk: felt252,
        bluffing_reveal_vk: felt252,
        owner: ContractAddress
    ) {
        self.full_reveal_vk_hash.write(full_reveal_vk);
        self.bluffing_reveal_vk_hash.write(bluffing_reveal_vk);
        self.owner.write(owner);
    }
    
    #[abi(embed_v0)]
    impl MysteryBoxGaragaVerifierImpl of super::IMysteryBoxGaragaVerifier<ContractState> {
        /// Verify Groth16 proof using Garaga BN254 implementation
        fn verify_groth16_proof_bn254(
            self: @ContractState,
            proof: Span<felt252>,
            public_inputs: Span<felt252>,
            vk_hash: felt252
        ) -> bool {
            // Use Garaga's optimized BN254 Groth16 verification
            verify_groth16_proof_bn254(proof, public_inputs, vk_hash)
        }
        
        /// Verify mystery box reveal with on-chain state update
        fn verify_mystery_box_reveal(
            ref self: ContractState,
            box_id: felt252,
            proof_data: Span<felt252>,
            public_inputs: Span<felt252>,
            nullifier: felt252,
            reveal_type: u8
        ) -> bool {
            // Check nullifier hasn't been used
            assert(!self.used_nullifiers.read(nullifier), 'Nullifier already used');
            
            // Get appropriate verification key
            let vk_hash = if reveal_type == 1 {
                self.full_reveal_vk_hash.read()
            } else {
                self.bluffing_reveal_vk_hash.read()
            };
            
            // Verify proof using Garaga
            let is_valid = verify_groth16_proof_bn254(proof_data, public_inputs, vk_hash);
            
            if is_valid {
                // Mark nullifier as used
                self.used_nullifiers.write(nullifier, true);
                
                // Extract box info from public inputs
                let token_id = *public_inputs.at(1);
                
                // Emit appropriate event
                if reveal_type == 1 {
                    self.emit(MysteryBoxRevealed {
                        box_id,
                        token_id,
                        reveal_type,
                        timestamp: get_block_timestamp(),
                    });
                } else {
                    let category = *public_inputs.at(6); // Category from bluffing proof
                    self.emit(BluffingProofVerified {
                        box_id,
                        token_id,
                        category,
                        timestamp: get_block_timestamp(),
                    });
                }
            }
            
            is_valid
        }
        
        /// Check if nullifier has been used
        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.read(nullifier)
        }
        
        /// Update verification keys (owner only)
        fn update_verification_keys(
            ref self: ContractState,
            full_reveal_vk: felt252,
            bluffing_reveal_vk: felt252
        ) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.full_reveal_vk_hash.write(full_reveal_vk);
            self.bluffing_reveal_vk_hash.write(bluffing_reveal_vk);
        }
    }
}

#[starknet::interface]
trait IMysteryBoxGaragaVerifier<TContractState> {
    fn verify_groth16_proof_bn254(
        self: @TContractState,
        proof: Span<felt252>,
        public_inputs: Span<felt252>,
        vk_hash: felt252
    ) -> bool;
    
    fn verify_mystery_box_reveal(
        ref self: TContractState,
        box_id: felt252,
        proof_data: Span<felt252>,
        public_inputs: Span<felt252>,
        nullifier: felt252,
        reveal_type: u8
    ) -> bool;
    
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn update_verification_keys(
        ref self: TContractState,
        full_reveal_vk: felt252,
        bluffing_reveal_vk: felt252
    );
}
    `;
    }
}
exports.GaragaMysteryBoxVerifier = GaragaMysteryBoxVerifier;
/**
 * Garaga CLI Integration Helper
 * Provides utilities for working with Garaga command-line tools
 * Based on official Garaga CLI: https://garaga.gitbook.io/garaga
 */
class GaragaCLIHelper {
    /**
     * Generate verification key from Noir circuit
     * Command: nargo compile && garaga gen --system groth16 --circuit target/circuit.json
     */
    static async generateVerificationKey(circuitPath) {
        console.log('Generating verification key for circuit:', circuitPath);
        console.log('Real command: garaga gen --system groth16 --circuit', circuitPath);
        return 'verification_key.json';
    }
    /**
     * Generate verifier contract from verification key
     * Command: garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     */
    static async generateVerifierContract(vkPath, outputPath) {
        console.log('Generating verifier contract from VK:', vkPath);
        console.log('Real command: garaga gen --system groth16 --vk', vkPath, '--output', outputPath);
    }
    /**
     * Declare contract on Starknet
     * Command: garaga declare --contract verifier.cairo
     */
    static async declareContract(contractPath) {
        console.log('Declaring contract:', contractPath);
        console.log('Real command: garaga declare --contract', contractPath);
        return 'mock_class_hash_0x123...';
    }
    /**
     * Deploy contract instance
     * Command: garaga deploy --class-hash <hash> --constructor-args <args>
     */
    static async deployContract(classHash, constructorArgs) {
        console.log('Deploying contract with class hash:', classHash);
        console.log('Real command: garaga deploy --class-hash', classHash, '--constructor-args', constructorArgs.join(' '));
        return 'mock_contract_address_0x456...';
    }
    /**
     * Verify proof on-chain
     * Command: garaga verify-onchain --address <addr> --vk vk.json --proof proof.json --public-inputs inputs.json
     */
    static async verifyOnChain(contractAddress, vkPath, proofPath, publicInputsPath) {
        console.log('Verifying proof on-chain at contract:', contractAddress);
        console.log('Real command: garaga verify-onchain --address', contractAddress, '--vk', vkPath, '--proof', proofPath, '--public-inputs', publicInputsPath);
        return true;
    }
}
exports.GaragaCLIHelper = GaragaCLIHelper;
//# sourceMappingURL=garaga-integration.js.map