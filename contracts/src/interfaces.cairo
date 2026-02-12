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
pub trait IMultiTokenWallet<TContractState> {
    // Balance management
    fn get_balance(self: @TContractState, token: ContractAddress) -> u256;
    fn get_all_balances(self: @TContractState) -> Span<(ContractAddress, u256)>;
    
    // Token operations
    fn transfer_token(
        ref self: TContractState,
        token: ContractAddress,
        to: ContractAddress,
        amount: u256
    );
    fn receive_token(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        from: ContractAddress
    );
    
    // Token registry
    fn register_token(
        ref self: TContractState,
        token: ContractAddress,
        symbol: ByteArray,
        decimals: u8
    );
    fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
    fn get_supported_tokens(self: @TContractState) -> Span<ContractAddress>;
    fn get_token_info(self: @TContractState, token: ContractAddress) -> (ByteArray, u8);
    
    // Access control
    fn authorize_operator(ref self: TContractState, operator: ContractAddress);
    fn revoke_operator(ref self: TContractState, operator: ContractAddress);
    fn is_authorized_operator(self: @TContractState, operator: ContractAddress) -> bool;
    
    // Wallet info
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn get_nft_info(self: @TContractState) -> (ContractAddress, u256);
    
    // Security
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
}

#[starknet::interface]
pub trait IAccountAbstraction<TContractState> {
    fn execute_transaction(
        ref self: TContractState,
        to: ContractAddress,
        value: u256,
        data: Span<felt252>
    ) -> Span<felt252>;
    fn get_nonce(self: @TContractState) -> u256;
    fn validate_transaction(
        self: @TContractState,
        transaction_hash: felt252,
        signature: Span<felt252>
    ) -> bool;
}

#[starknet::interface]
pub trait IYieldDistributor<TContractState> {
    // Yield source management
    fn register_yield_source(
        ref self: TContractState,
        source_contract: ContractAddress,
        token: ContractAddress,
        name: ByteArray,
        yield_rate: u256
    );
    
    // Collection management
    fn register_nft_collection(
        ref self: TContractState,
        nft_contract: ContractAddress,
        name: ByteArray
    );
    
    // Allocation management
    fn update_allocation(
        ref self: TContractState,
        nft_contract: ContractAddress,
        token_id: u256,
        rarity_score: u256,
        stake_amount: u256,
        custom_factors: u256
    );
    
    // Yield distribution
    fn distribute_yield(
        ref self: TContractState,
        collection: ContractAddress,
        yield_token: ContractAddress,
        total_yield: u256
    );
    
    fn calculate_nft_yield(
        self: @TContractState,
        nft_contract: ContractAddress,
        token_id: u256,
        yield_token: ContractAddress
    ) -> u256;
    
    fn claim_yield(
        ref self: TContractState,
        nft_contract: ContractAddress,
        token_id: u256,
        yield_token: ContractAddress,
        recipient: ContractAddress
    ) -> u256;
    
    // View functions
    fn get_allocation_data(
        self: @TContractState,
        nft_contract: ContractAddress,
        token_id: u256
    ) -> (u256, u256, u256, u256, u256, u64); // AllocationData fields
    
    fn get_yield_source_info(
        self: @TContractState,
        source_contract: ContractAddress
    ) -> (ByteArray, ContractAddress, ContractAddress, u256, u256, u64, bool); // YieldSourceInfo fields
    
    fn get_collection_total_weight(
        self: @TContractState,
        collection: ContractAddress
    ) -> u256;
    
    fn get_yield_pool_balance(
        self: @TContractState,
        collection: ContractAddress,
        yield_token: ContractAddress
    ) -> u256;
    
    fn is_collection_registered(
        self: @TContractState,
        collection: ContractAddress
    ) -> bool;
    
    fn is_yield_source_active(
        self: @TContractState,
        source: ContractAddress
    ) -> bool;
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

#[starknet::interface]
pub trait ITongoPool<TContractState> {
    // Core operations
    fn fund(
        ref self: TContractState,
        token_address: ContractAddress,
        encrypted_amount: felt252,
        commitment: felt252,
        recipient: felt252
    ) -> felt252;
    
    fn transfer(
        ref self: TContractState,
        token_address: ContractAddress,
        encrypted_amount: felt252,
        recipient: felt252,
        proof: Span<felt252>,
        nullifier: felt252
    ) -> felt252;
    
    fn withdraw(
        ref self: TContractState,
        token_address: ContractAddress,
        amount: u256,
        recipient: ContractAddress,
        proof: Span<felt252>,
        nullifier: felt252
    );
    
    // Balance queries
    fn get_encrypted_balance(
        self: @TContractState,
        user_public_key: felt252,
        token_address: ContractAddress
    ) -> felt252;
    
    fn get_supported_tokens(self: @TContractState) -> Span<ContractAddress>;
    
    // Viewing keys for auditing
    fn generate_viewing_key(
        ref self: TContractState,
        user_public_key: felt252,
        token_address: ContractAddress,
        key_hash: felt252,
        expires_at: u64
    );
    
    fn inspect_balance_with_key(
        self: @TContractState,
        viewing_key: felt252,
        token_address: ContractAddress,
        owner_public_key: felt252
    ) -> (felt252, u256, u256);
    
    // Staking integration
    fn update_staking_record(
        ref self: TContractState,
        user_public_key: felt252,
        token_address: ContractAddress,
        encrypted_stake_amount: felt252,
        yield_multiplier: u256
    );
    
    fn verify_shielded_staking_proof(
        self: @TContractState,
        user_public_key: felt252,
        minimum_stake: u256,
        proof: Span<felt252>
    ) -> bool;
    
    // Admin functions
    fn add_supported_token(ref self: TContractState, token: ContractAddress);
    fn set_yield_distributor(ref self: TContractState, distributor: ContractAddress);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
}