use starknet::{ContractAddress, ClassHash};

// Core interfaces for Kirito SDK contracts

#[starknet::interface]
pub trait IERC721<TContractState> {
    fn balance_of(self: @TContractState, owner: ContractAddress) -> u256;
    fn owner_of(self: @TContractState, token_id: u256) -> ContractAddress;
    fn safe_transfer_from(
        ref self: TContractState,
        from: ContractAddress,
        to: ContractAddress,
        token_id: u256,
        data: Span<felt252>
    );
    fn transfer_from(
        ref self: TContractState,
        from: ContractAddress,
        to: ContractAddress,
        token_id: u256
    );
    fn approve(ref self: TContractState, to: ContractAddress, token_id: u256);
    fn set_approval_for_all(ref self: TContractState, operator: ContractAddress, approved: bool);
    fn get_approved(self: @TContractState, token_id: u256) -> ContractAddress;
    fn is_approved_for_all(
        self: @TContractState,
        owner: ContractAddress,
        operator: ContractAddress
    ) -> bool;
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn token_uri(self: @TContractState, token_id: u256) -> ByteArray;
    fn total_supply(self: @TContractState) -> u256;
}

#[starknet::interface]
pub trait INFTWallet<TContractState> {
    fn mint(
        ref self: TContractState,
        to: ContractAddress,
        token_id: u256,
        staking_amount: u256,
        metadata_uri: ByteArray
    );
    fn get_wallet_address(self: @TContractState, token_id: u256) -> ContractAddress;
    fn execute_from_wallet(
        ref self: TContractState,
        token_id: u256,
        to: ContractAddress,
        value: u256,
        data: Span<felt252>
    ) -> Span<felt252>;
    fn get_wallet_balance(
        self: @TContractState,
        token_id: u256,
        asset: ContractAddress
    ) -> u256;
}

#[starknet::interface]
pub trait IShieldedPool<TContractState> {
    fn deposit(
        ref self: TContractState,
        amount: u256,
        token: ContractAddress,
        commitment: felt252
    ) -> felt252;
    fn withdraw(
        ref self: TContractState,
        nullifier: felt252,
        amount: u256,
        recipient: ContractAddress,
        proof: Span<felt252>
    );
    fn verify_note(
        self: @TContractState,
        commitment: felt252,
        nullifier: felt252
    ) -> bool;
}

#[starknet::interface]
pub trait IMysteryBox<TContractState> {
    fn create_mystery_box(
        ref self: TContractState,
        token_id: u256,
        encrypted_traits: Span<felt252>,
        reveal_conditions: Span<felt252>
    ) -> felt252;
    fn reveal_traits(
        ref self: TContractState,
        box_id: felt252,
        proof: Span<felt252>
    ) -> Span<felt252>;
    fn verify_reveal(
        self: @TContractState,
        box_id: felt252,
        proof: Span<felt252>
    ) -> bool;
    fn is_revealed(self: @TContractState, box_id: felt252) -> bool;
}

#[starknet::interface]
pub trait IAnonymousGovernance<TContractState> {
    fn create_proposal(
        ref self: TContractState,
        title: ByteArray,
        description: ByteArray,
        options: Span<ByteArray>,
        group_id: felt252,
        deadline: u64
    ) -> felt252;
    fn vote(
        ref self: TContractState,
        proposal_id: felt252,
        signal: felt252,
        proof: Span<felt252>
    ) -> felt252;
    fn tally_votes(self: @TContractState, proposal_id: felt252) -> Span<u256>;
    fn verify_membership(
        self: @TContractState,
        commitment: felt252,
        group_id: felt252
    ) -> bool;
}

#[starknet::interface]
pub trait IAccountAbstraction<TContractState> {
    fn validate_transaction(
        self: @TContractState,
        call_array: Array<starknet::account::Call>,
        calldata: Array<felt252>,
        tx_hash: felt252
    ) -> felt252;
    fn execute_transaction(
        ref self: TContractState,
        call_array: Array<starknet::account::Call>,
        calldata: Array<felt252>
    ) -> Array<Span<felt252>>;
    fn is_valid_signature(
        self: @TContractState,
        hash: felt252,
        signature: Array<felt252>
    ) -> felt252;
}

#[starknet::interface]
pub trait IUpgradeable<TContractState> {
    fn upgrade(ref self: TContractState, new_class_hash: ClassHash);
    fn get_implementation(self: @TContractState) -> ClassHash;
}

#[starknet::interface]
pub trait IWallet<TContractState> {
    fn get_balance(self: @TContractState, asset: ContractAddress) -> u256;
    fn transfer(
        ref self: TContractState,
        asset: ContractAddress,
        to: ContractAddress,
        amount: u256
    );
    fn receive(
        ref self: TContractState,
        asset: ContractAddress,
        amount: u256,
        from: ContractAddress
    );
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn get_token_id(self: @TContractState) -> u256;
    fn get_nft_contract(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
pub trait IAdmin<TContractState> {
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn set_minter(ref self: TContractState, minter: ContractAddress, authorized: bool);
    fn is_minter(self: @TContractState, account: ContractAddress) -> bool;
}

#[starknet::interface]
pub trait ISecurity<TContractState> {
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn check_rate_limit(ref self: TContractState, account: ContractAddress) -> bool;
    fn set_min_action_interval(ref self: TContractState, interval: u64);
}

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