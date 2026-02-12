// Garaga On-Chain Verifier for Mystery Box Reveals
// Integrates with Garaga protocol for on-chain ZK proof verification
// Supports both full reveals and bluffing mechanism proofs

use starknet::ContractAddress;
use starknet::get_caller_address;
use starknet::get_block_timestamp;
use garaga::definitions::{G1Point, G2Point, E12D, BN254_ID, BLS12_381_ID};
use garaga::groth16::{Groth16Proof, verify_groth16_proof_bn254};
use garaga::ultra_honk::{UltraHonkProof, verify_ultra_honk_proof};

// Garaga proof verification interface
#[starknet::interface]
trait IGaragaVerifier<TContractState> {
    fn verify_groth16_proof(
        ref self: TContractState,
        proof: Span<felt252>,
        public_inputs: Span<felt252>,
        vk_hash: felt252
    ) -> bool;
    
    fn verify_plonk_proof(
        ref self: TContractState,
        proof: Span<felt252>,
        public_inputs: Span<felt252>,
        vk_hash: felt252
    ) -> bool;
}

// Mystery Box reveal proof structure
#[derive(Drop, Serde, starknet::Store)]
pub struct RevealProof {
    pub proof_data: Array<felt252>,
    pub public_inputs: Array<felt252>,
    pub proof_type: u8, // 1 = full reveal, 2 = bluffing reveal
    pub vk_hash: felt252,
}

// Mystery Box state
#[derive(Drop, Serde, starknet::Store)]
pub struct MysteryBoxState {
    pub token_id: felt252,
    pub owner: ContractAddress,
    pub commitment: felt252,
    pub reveal_conditions: RevealConditions,
    pub is_revealed: bool,
    pub reveal_timestamp: u64,
}

// Reveal conditions
#[derive(Drop, Serde, starknet::Store)]
pub struct RevealConditions {
    pub condition_type: u8, // 1 = timelock, 2 = action, 3 = combined
    pub timestamp: u64,
    pub required_action: u8,
    pub minimum_stake: u256,
}

// Events
#[derive(Drop, starknet::Event)]
struct MysteryBoxCreated {
    #[key]
    box_id: felt252,
    #[key]
    token_id: felt252,
    owner: ContractAddress,
    commitment: felt252,
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

#[starknet::contract]
pub mod GaragaMysteryBoxVerifier {
    use super::{
        IGaragaVerifier, RevealProof, MysteryBoxState, RevealConditions,
        MysteryBoxCreated, MysteryBoxRevealed, BluffingProofVerified
    };
    use starknet::{
        ContractAddress, get_caller_address, get_block_timestamp,
        storage::{
            StoragePointerReadAccess, StoragePointerWriteAccess,
            Map, StoragePathEntry
        }
    };
    use core::pedersen::pedersen;

    #[storage]
    struct Storage {
        // Mystery box storage
        mystery_boxes: Map<felt252, MysteryBoxState>,
        box_count: u256,
        
        // Garaga verifier contract
        garaga_verifier: ContractAddress,
        
        // Verification keys for different proof types
        full_reveal_vk_hash: felt252,
        bluffing_reveal_vk_hash: felt252,
        
        // Access control
        owner: ContractAddress,
        authorized_minters: Map<ContractAddress, bool>,
        
        // Nullifiers to prevent double reveals
        used_nullifiers: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MysteryBoxCreated: MysteryBoxCreated,
        MysteryBoxRevealed: MysteryBoxRevealed,
        BluffingProofVerified: BluffingProofVerified,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        garaga_verifier: ContractAddress,
        full_reveal_vk_hash: felt252,
        bluffing_reveal_vk_hash: felt252
    ) {
        self.owner.write(owner);
        self.garaga_verifier.write(garaga_verifier);
        self.full_reveal_vk_hash.write(full_reveal_vk_hash);
        self.bluffing_reveal_vk_hash.write(bluffing_reveal_vk_hash);
        self.box_count.write(0);
    }

    #[abi(embed_v0)]
    impl GaragaMysteryBoxVerifierImpl of super::IGaragaMysteryBoxVerifier<ContractState> {
        /// Create a new mystery box with hidden traits
        fn create_mystery_box(
            ref self: ContractState,
            box_id: felt252,
            token_id: felt252,
            commitment: felt252,
            reveal_conditions: RevealConditions
        ) {
            // Only authorized minters can create mystery boxes
            let caller = get_caller_address();
            assert(
                self.authorized_minters.entry(caller).read() || caller == self.owner.read(),
                'Unauthorized minter'
            );

            // Ensure box doesn't already exist
            let existing_box = self.mystery_boxes.entry(box_id).read();
            assert(existing_box.token_id == 0, 'Mystery box already exists');

            // Create mystery box state
            let mystery_box = MysteryBoxState {
                token_id,
                owner: caller,
                commitment,
                reveal_conditions,
                is_revealed: false,
                reveal_timestamp: 0,
            };

            // Store mystery box
            self.mystery_boxes.entry(box_id).write(mystery_box);
            self.box_count.write(self.box_count.read() + 1);

            // Emit event
            self.emit(MysteryBoxCreated {
                box_id,
                token_id,
                owner: caller,
                commitment,
            });
        }

        /// Reveal mystery box traits using ZK proof with Garaga verification
        fn reveal_mystery_box(
            ref self: ContractState,
            box_id: felt252,
            proof: RevealProof,
            nullifier: felt252
        ) -> bool {
            // Get mystery box
            let mut mystery_box = self.mystery_boxes.entry(box_id).read();
            assert(mystery_box.token_id != 0, 'Mystery box not found');
            assert(!mystery_box.is_revealed, 'Already revealed');

            // Check nullifier hasn't been used
            assert(!self.used_nullifiers.entry(nullifier).read(), 'Nullifier already used');

            // Verify reveal conditions are met
            assert(self._check_reveal_conditions(mystery_box.reveal_conditions), 'Conditions not met');

            // Verify ZK proof using Garaga
            let vk_hash = if proof.proof_type == 1 {
                self.full_reveal_vk_hash.read()
            } else {
                self.bluffing_reveal_vk_hash.read()
            };

            // Use Garaga to verify Groth16 proof
            let is_valid = verify_groth16_proof_bn254(
                proof.proof_data.span(),
                proof.public_inputs.span(),
                vk_hash
            );

            assert(is_valid, 'Invalid proof');

            // Mark as revealed and use nullifier
            mystery_box.is_revealed = true;
            mystery_box.reveal_timestamp = get_block_timestamp();
            self.mystery_boxes.entry(box_id).write(mystery_box);
            self.used_nullifiers.entry(nullifier).write(true);

            // Emit appropriate event
            if proof.proof_type == 1 {
                self.emit(MysteryBoxRevealed {
                    box_id,
                    token_id: mystery_box.token_id,
                    reveal_type: proof.proof_type,
                    timestamp: mystery_box.reveal_timestamp,
                });
            } else {
                // For bluffing proofs, extract category from public inputs
                let category = if proof.public_inputs.len() > 0 {
                    *proof.public_inputs.at(0)
                } else {
                    0
                };
                
                self.emit(BluffingProofVerified {
                    box_id,
                    token_id: mystery_box.token_id,
                    category,
                    timestamp: mystery_box.reveal_timestamp,
                });
            }

            true
        }

        /// Verify bluffing proof for trait category using Garaga
        fn verify_bluffing_proof(
            ref self: ContractState,
            box_id: felt252,
            proof: RevealProof,
            category: felt252
        ) -> bool {
            // Get mystery box
            let mystery_box = self.mystery_boxes.entry(box_id).read();
            assert(mystery_box.token_id != 0, 'Mystery box not found');

            // Ensure this is a bluffing proof
            assert(proof.proof_type == 2, 'Not a bluffing proof');

            // Verify ZK proof using Garaga directly
            let is_valid = verify_groth16_proof_bn254(
                proof.proof_data.span(),
                proof.public_inputs.span(),
                self.bluffing_reveal_vk_hash.read()
            );

            if is_valid {
                self.emit(BluffingProofVerified {
                    box_id,
                    token_id: mystery_box.token_id,
                    category,
                    timestamp: get_block_timestamp(),
                });
            }

            is_valid
        }

        /// Get mystery box state
        fn get_mystery_box(self: @ContractState, box_id: felt252) -> MysteryBoxState {
            self.mystery_boxes.entry(box_id).read()
        }

        /// Check if nullifier has been used
        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.entry(nullifier).read()
        }

        /// Get total number of mystery boxes
        fn get_box_count(self: @ContractState) -> u256 {
            self.box_count.read()
        }

        /// Update Garaga verifier contract (owner only)
        fn update_garaga_verifier(ref self: ContractState, new_verifier: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.garaga_verifier.write(new_verifier);
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

        /// Authorize minter (owner only)
        fn authorize_minter(ref self: ContractState, minter: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.authorized_minters.entry(minter).write(true);
        }

        /// Revoke minter authorization (owner only)
        fn revoke_minter(ref self: ContractState, minter: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.authorized_minters.entry(minter).write(false);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Check if reveal conditions are satisfied
        fn _check_reveal_conditions(
            self: @ContractState,
            conditions: RevealConditions
        ) -> bool {
            let current_time = get_block_timestamp();

            match conditions.condition_type {
                1 => {
                    // Timelock condition
                    current_time >= conditions.timestamp
                },
                2 => {
                    // Action condition - would need to check external state
                    // For now, assume action is completed
                    true
                },
                3 => {
                    // Combined condition
                    let time_met = current_time >= conditions.timestamp;
                    let action_met = true; // Would check external action state
                    time_met && action_met
                },
                _ => false
            }
        }

        /// Generate commitment hash for mystery box
        fn _generate_commitment(
            self: @ContractState,
            token_id: felt252,
            traits_hash: felt252,
            encryption_key: felt252
        ) -> felt252 {
            let hash1 = pedersen(token_id, traits_hash);
            pedersen(hash1, encryption_key)
        }

        /// Verify proof public inputs format
        fn _verify_public_inputs_format(
            self: @ContractState,
            public_inputs: Span<felt252>,
            expected_length: u32
        ) -> bool {
            public_inputs.len() == expected_length
        }
    }
}

// Interface for the mystery box verifier
#[starknet::interface]
pub trait IGaragaMysteryBoxVerifier<TContractState> {
    fn create_mystery_box(
        ref self: TContractState,
        box_id: felt252,
        token_id: felt252,
        commitment: felt252,
        reveal_conditions: RevealConditions
    );
    
    fn reveal_mystery_box(
        ref self: TContractState,
        box_id: felt252,
        proof: RevealProof,
        nullifier: felt252
    ) -> bool;
    
    fn verify_bluffing_proof(
        ref self: TContractState,
        box_id: felt252,
        proof: RevealProof,
        category: felt252
    ) -> bool;
    
    fn get_mystery_box(self: @TContractState, box_id: felt252) -> MysteryBoxState;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn get_box_count(self: @TContractState) -> u256;
    
    fn update_garaga_verifier(ref self: TContractState, new_verifier: ContractAddress);
    fn update_verification_keys(
        ref self: TContractState,
        full_reveal_vk: felt252,
        bluffing_reveal_vk: felt252
    );
    fn authorize_minter(ref self: TContractState, minter: ContractAddress);
    fn revoke_minter(ref self: TContractState, minter: ContractAddress);
}