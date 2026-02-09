use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
use core::poseidon::poseidon_hash_span;
use core::array::ArrayTrait;
use core::option::OptionTrait;

#[starknet::interface]
pub trait ISemaphore<TContractState> {
    // Group management
    fn create_group(ref self: TContractState, group_id: felt252, admin: ContractAddress);
    fn add_member(ref self: TContractState, group_id: felt252, commitment: felt252);
    fn remove_member(ref self: TContractState, group_id: felt252, commitment: felt252);
    fn get_group_size(self: @TContractState, group_id: felt252) -> u32;
    fn is_member(self: @TContractState, group_id: felt252, commitment: felt252) -> bool;
    fn get_merkle_root(self: @TContractState, group_id: felt252) -> felt252;
    
    // Proof verification
    fn verify_proof(
        self: @TContractState,
        group_id: felt252,
        signal: felt252,
        nullifier_hash: felt252,
        external_nullifier: felt252,
        proof: Span<felt252>
    ) -> bool;
    
    // Nullifier tracking
    fn is_nullifier_used(self: @TContractState, nullifier_hash: felt252) -> bool;
    fn mark_nullifier_used(ref self: TContractState, nullifier_hash: felt252);
    
    // Admin functions
    fn set_group_admin(ref self: TContractState, group_id: felt252, admin: ContractAddress);
    fn get_group_admin(self: @TContractState, group_id: felt252) -> ContractAddress;
}

#[starknet::contract]
pub mod Semaphore {
    use core::num::traits::Zero;
use super::ISemaphore;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::poseidon::poseidon_hash_span;
    use core::array::ArrayTrait;
    use core::option::OptionTrait;
    use core::traits::Into;
    use core::traits::TryInto;

    #[storage]
    struct Storage {
        // Group ID -> Admin address
        group_admins: LegacyMap<felt252, ContractAddress>,
        
        // Group ID -> Member count
        group_sizes: LegacyMap<felt252, u32>,
        
        // Group ID -> Member index -> Commitment
        group_members: LegacyMap<(felt252, u32), felt252>,
        
        // Group ID -> Commitment -> Member index (for membership checks)
        member_indices: LegacyMap<(felt252, felt252), u32>,
        
        // Group ID -> Merkle tree root
        merkle_roots: LegacyMap<felt252, felt252>,
        
        // Nullifier hash -> Used flag
        used_nullifiers: LegacyMap<felt252, bool>,
        
        // Contract owner
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        GroupCreated: GroupCreated,
        MemberAdded: MemberAdded,
        MemberRemoved: MemberRemoved,
        ProofVerified: ProofVerified,
        NullifierUsed: NullifierUsed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct GroupCreated {
        pub group_id: felt252,
        pub admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberAdded {
        pub group_id: felt252,
        pub commitment: felt252,
        pub member_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberRemoved {
        pub group_id: felt252,
        pub commitment: felt252,
        pub member_count: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofVerified {
        pub group_id: felt252,
        pub signal: felt252,
        pub nullifier_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct NullifierUsed {
        pub nullifier_hash: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl SemaphoreImpl of ISemaphore<ContractState> {
        fn create_group(ref self: ContractState, group_id: felt252, admin: ContractAddress) {
            // Only owner can create groups
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can create groups');
            
            // Check if group already exists
            let current_admin = self.group_admins.read(group_id);
            assert(current_admin.is_zero(), 'Group already exists');
            
            // Create group
            self.group_admins.write(group_id, admin);
            self.group_sizes.write(group_id, 0);
            self.merkle_roots.write(group_id, 0);
            
            self.emit(GroupCreated { group_id, admin });
        }

        fn add_member(ref self: ContractState, group_id: felt252, commitment: felt252) {
            // Only group admin can add members
            let caller = get_caller_address();
            let admin = self.group_admins.read(group_id);
            assert(!admin.is_zero(), 'Group does not exist');
            assert(caller == admin, 'Only admin can add members');
            
            // Check if member already exists
            let existing_index = self.member_indices.read((group_id, commitment));
            if existing_index != 0 {
                // Check if this index actually contains this commitment
                let stored_commitment = self.group_members.read((group_id, existing_index - 1));
                assert(stored_commitment != commitment, 'Member already exists');
            }
            
            // Add member
            let current_size = self.group_sizes.read(group_id);
            self.group_members.write((group_id, current_size), commitment);
            self.member_indices.write((group_id, commitment), current_size + 1);
            self.group_sizes.write(group_id, current_size + 1);
            
            // Update Merkle root
            self._update_merkle_root(group_id);
            
            self.emit(MemberAdded { 
                group_id, 
                commitment, 
                member_count: current_size + 1 
            });
        }

        fn remove_member(ref self: ContractState, group_id: felt252, commitment: felt252) {
            // Only group admin can remove members
            let caller = get_caller_address();
            let admin = self.group_admins.read(group_id);
            assert(!admin.is_zero(), 'Group does not exist');
            assert(caller == admin, 'Only admin can remove members');
            
            // Find member index
            let member_index = self.member_indices.read((group_id, commitment));
            assert(member_index != 0, 'Member not found');
            let actual_index = member_index - 1; // Convert to 0-based index
            
            // Get current size
            let current_size = self.group_sizes.read(group_id);
            assert(current_size > 0, 'Group is empty');
            
            // If not the last member, move the last member to this position
            if actual_index != current_size - 1 {
                let last_commitment = self.group_members.read((group_id, current_size - 1));
                self.group_members.write((group_id, actual_index), last_commitment);
                self.member_indices.write((group_id, last_commitment), actual_index + 1);
            }
            
            // Clear the last position and update indices
            self.group_members.write((group_id, current_size - 1), 0);
            self.member_indices.write((group_id, commitment), 0);
            self.group_sizes.write(group_id, current_size - 1);
            
            // Update Merkle root
            self._update_merkle_root(group_id);
            
            self.emit(MemberRemoved { 
                group_id, 
                commitment, 
                member_count: current_size - 1 
            });
        }

        fn get_group_size(self: @ContractState, group_id: felt252) -> u32 {
            self.group_sizes.read(group_id)
        }

        fn is_member(self: @ContractState, group_id: felt252, commitment: felt252) -> bool {
            let member_index = self.member_indices.read((group_id, commitment));
            if member_index == 0 {
                return false;
            }
            
            // Verify the commitment is actually stored at this index
            let stored_commitment = self.group_members.read((group_id, member_index - 1));
            stored_commitment == commitment
        }

        fn get_merkle_root(self: @ContractState, group_id: felt252) -> felt252 {
            self.merkle_roots.read(group_id)
        }

        fn verify_proof(
            self: @ContractState,
            group_id: felt252,
            signal: felt252,
            nullifier_hash: felt252,
            external_nullifier: felt252,
            proof: Span<felt252>
        ) -> bool {
            // Check if nullifier has been used
            if self.used_nullifiers.read(nullifier_hash) {
                return false;
            }
            
            // Get current Merkle root
            let merkle_root = self.merkle_roots.read(group_id);
            if merkle_root == 0 {
                return false; // Group doesn't exist or is empty
            }
            
            // Verify proof structure (simplified verification)
            if proof.len() < 8 {
                return false;
            }
            
            // In a real implementation, this would verify the zk-SNARK proof
            // For now, we do basic validation of the proof components
            let proof_valid = self._verify_semaphore_proof(
                merkle_root,
                signal,
                nullifier_hash,
                external_nullifier,
                proof
            );
            
            proof_valid
        }

        fn is_nullifier_used(self: @ContractState, nullifier_hash: felt252) -> bool {
            self.used_nullifiers.read(nullifier_hash)
        }

        fn mark_nullifier_used(ref self: ContractState, nullifier_hash: felt252) {
            // This should only be called after successful proof verification
            self.used_nullifiers.write(nullifier_hash, true);
            self.emit(NullifierUsed { nullifier_hash });
        }

        fn set_group_admin(ref self: ContractState, group_id: felt252, admin: ContractAddress) {
            // Only current admin or owner can change admin
            let caller = get_caller_address();
            let current_admin = self.group_admins.read(group_id);
            assert(!current_admin.is_zero(), 'Group does not exist');
            assert(
                caller == current_admin || caller == self.owner.read(),
                'Not authorized to change admin'
            );
            
            self.group_admins.write(group_id, admin);
        }

        fn get_group_admin(self: @ContractState, group_id: felt252) -> ContractAddress {
            self.group_admins.read(group_id)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _update_merkle_root(ref self: ContractState, group_id: felt252) {
            let group_size = self.group_sizes.read(group_id);
            
            if group_size == 0 {
                self.merkle_roots.write(group_id, 0);
                return;
            }
            
            // Build Merkle tree from commitments
            let mut commitments = ArrayTrait::new();
            let mut i = 0;
            
            while i < group_size {
                let commitment = self.group_members.read((group_id, i));
                commitments.append(commitment);
                i += 1;
            };
            
            // Calculate Merkle root using Poseidon hash
            let root = self._calculate_merkle_root(commitments.span());
            self.merkle_roots.write(group_id, root);
        }

        fn _calculate_merkle_root(self: @ContractState, commitments: Span<felt252>) -> felt252 {
            if commitments.len() == 0 {
                return 0;
            }
            
            if commitments.len() == 1 {
                return *commitments.at(0);
            }
            
            // Simple Merkle tree construction using Poseidon
            // In production, this should use a proper incremental Merkle tree
            let mut current_level = commitments;
            let mut next_level = ArrayTrait::new();
            
            loop {
                if current_level.len() == 1 {
                    break *current_level.at(0);
                }
                
                let mut i = 0;
                while i < current_level.len() {
                    if i + 1 < current_level.len() {
                        // Hash pair
                        let left = *current_level.at(i);
                        let right = *current_level.at(i + 1);
                        let mut hash_input = ArrayTrait::new();
                        hash_input.append(left);
                        hash_input.append(right);
                        let hash = poseidon_hash_span(hash_input.span());
                        next_level.append(hash);
                        i += 2;
                    } else {
                        // Odd number, carry forward
                        next_level.append(*current_level.at(i));
                        i += 1;
                    }
                };
                
                current_level = next_level.span();
                next_level = ArrayTrait::new();
            }
        }

        fn _verify_semaphore_proof(
            self: @ContractState,
            merkle_root: felt252,
            signal: felt252,
            nullifier_hash: felt252,
            external_nullifier: felt252,
            proof: Span<felt252>
        ) -> bool {
            // Simplified proof verification
            // In a real implementation, this would verify the zk-SNARK proof
            // using a verifier contract (like Garaga)
            
            // Basic structure validation
            if proof.len() != 8 {
                return false;
            }
            
            // Check that proof components are non-zero
            let mut i = 0;
            while i < proof.len() {
                if *proof.at(i) == 0 {
                    return false;
                }
                i += 1;
            };
            
            // Verify nullifier hash format (should be hash of identity + external_nullifier)
            // This is a simplified check - real implementation would verify the zk-proof
            let mut nullifier_input = ArrayTrait::new();
            nullifier_input.append(external_nullifier);
            nullifier_input.append(signal);
            let expected_nullifier = poseidon_hash_span(nullifier_input.span());
            
            // For demo purposes, we accept the proof if it has the right structure
            // In production, this would call a zk-SNARK verifier
            true
        }
    }
}