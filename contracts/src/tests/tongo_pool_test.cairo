#[cfg(test)]
mod tongo_pool_tests {
    use starknet::{ContractAddress, contract_address_const, get_block_timestamp};
    use starknet::testing::{set_caller_address, set_block_timestamp};
    use core::array::ArrayTrait;
    use core::traits::Into;
    
    use super::super::tongo_pool::{TongoPool, ITongoPoolDispatcher, ITongoPoolDispatcherTrait};
    use super::super::interfaces::ITongoPool;
    use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};

    fn setup() -> (ITongoPoolDispatcher, ContractAddress) {
        let owner = contract_address_const::<'owner'>();
        set_caller_address(owner);
        
        let contract = declare("TongoPool").unwrap().contract_class();
        let constructor_calldata = array![owner.into()];
        let (contract_address, _) = contract.deploy(@constructor_calldata).unwrap();
        
        let dispatcher = ITongoPoolDispatcher { contract_address };
        (dispatcher, owner)
    }

    #[test]
    fn test_constructor() {
        let (tongo_pool, owner) = setup();
        
        assert(tongo_pool.get_owner() == owner, 'Wrong owner');
        assert(!tongo_pool.is_paused(), 'Should not be paused');
    }

    #[test]
    fn test_add_supported_token() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Token should now be supported (verified through successful operations)
        // In a full implementation, we'd have a getter for supported tokens
    }

    #[test]
    #[should_panic(expected: ('Not owner',))]
    fn test_add_supported_token_not_owner() {
        let (tongo_pool, _) = setup();
        let token = contract_address_const::<'token'>();
        let non_owner = contract_address_const::<'non_owner'>();
        
        set_caller_address(non_owner);
        tongo_pool.add_supported_token(token);
    }

    #[test]
    fn test_fund_operation() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let encrypted_amount = 67890;
        let commitment = 11111;
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Perform fund operation
        let result = tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
        
        assert(result == commitment, 'Wrong commitment returned');
        
        // Check balance was updated
        let balance = tongo_pool.get_encrypted_balance(user_public_key, token);
        assert(balance == encrypted_amount, 'Balance not updated');
    }

    #[test]
    #[should_panic(expected: ('Token not supported',))]
    fn test_fund_unsupported_token() {
        let (tongo_pool, _) = setup();
        let token = contract_address_const::<'unsupported_token'>();
        let user_public_key = 12345;
        let encrypted_amount = 67890;
        let commitment = 11111;
        
        tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
    }

    #[test]
    #[should_panic(expected: ('Commitment already used',))]
    fn test_fund_duplicate_commitment() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let encrypted_amount = 67890;
        let commitment = 11111;
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // First fund operation
        tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
        
        // Second fund operation with same commitment should fail
        tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
    }

    #[test]
    fn test_transfer_operation() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let sender_key = 12345;
        let recipient_key = 54321;
        let encrypted_amount = 67890;
        let nullifier = 99999;
        let proof = array![1, 2, 3, 4].span();
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Perform transfer operation
        let result = tongo_pool.transfer(
            token,
            encrypted_amount,
            recipient_key,
            proof,
            nullifier
        );
        
        assert(result == nullifier, 'Wrong nullifier returned');
        
        // Check recipient balance was updated
        let balance = tongo_pool.get_encrypted_balance(recipient_key, token);
        assert(balance == encrypted_amount, 'Recipient balance not updated');
    }

    #[test]
    #[should_panic(expected: ('Nullifier already used',))]
    fn test_transfer_duplicate_nullifier() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let recipient_key = 54321;
        let encrypted_amount = 67890;
        let nullifier = 99999;
        let proof = array![1, 2, 3, 4].span();
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // First transfer
        tongo_pool.transfer(
            token,
            encrypted_amount,
            recipient_key,
            proof,
            nullifier
        );
        
        // Second transfer with same nullifier should fail
        tongo_pool.transfer(
            token,
            encrypted_amount,
            recipient_key,
            proof,
            nullifier
        );
    }

    #[test]
    fn test_withdraw_operation() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let recipient = contract_address_const::<'recipient'>();
        let amount = 100000;
        let nullifier = 88888;
        let proof = array![5, 6, 7, 8].span();
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Perform withdraw operation
        tongo_pool.withdraw(
            token,
            amount,
            recipient,
            proof,
            nullifier
        );
        
        // Withdrawal should complete without error
        // In a full implementation, we'd verify the token transfer occurred
    }

    #[test]
    fn test_viewing_key_generation() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let key_hash = 77777;
        let expires_at = get_block_timestamp() + 86400; // 24 hours
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Generate viewing key
        tongo_pool.generate_viewing_key(
            user_public_key,
            token,
            key_hash,
            expires_at
        );
        
        // Viewing key generation should complete without error
        // In a full implementation, we'd verify the key was stored
    }

    #[test]
    fn test_balance_inspection_with_viewing_key() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let key_hash = 77777;
        let expires_at = get_block_timestamp() + 86400; // 24 hours
        let encrypted_amount = 67890;
        let commitment = 11111;
        
        // Add supported token first
        set_caller_address(owner);
        tongo_pool.add_supported_token(token);
        
        // Fund account to have balance
        tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
        
        // Generate viewing key
        tongo_pool.generate_viewing_key(
            user_public_key,
            token,
            key_hash,
            expires_at
        );
        
        // Inspect balance with viewing key
        let (balance, min_range, max_range) = tongo_pool.inspect_balance_with_key(
            key_hash,
            token,
            user_public_key
        );
        
        assert(balance == encrypted_amount, 'Wrong balance returned');
        assert(min_range == 0, 'Wrong min range');
        assert(max_range == 1000000, 'Wrong max range');
    }

    #[test]
    fn test_staking_record_operations() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let encrypted_stake_amount = 50000;
        let yield_multiplier = 150; // 1.5x multiplier
        let yield_distributor = contract_address_const::<'yield_distributor'>();
        
        // Set yield distributor
        set_caller_address(owner);
        tongo_pool.set_yield_distributor(yield_distributor);
        
        // Update staking record (as yield distributor)
        set_caller_address(yield_distributor);
        tongo_pool.update_staking_record(
            user_public_key,
            token,
            encrypted_stake_amount,
            yield_multiplier
        );
        
        // Get staking record
        let record = tongo_pool.get_staking_record(user_public_key);
        assert(record.encrypted_stake_amount == encrypted_stake_amount, 'Wrong stake amount');
        assert(record.yield_multiplier == yield_multiplier, 'Wrong yield multiplier');
    }

    #[test]
    #[should_panic(expected: ('Unauthorized',))]
    fn test_staking_record_unauthorized() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let encrypted_stake_amount = 50000;
        let yield_multiplier = 150;
        let unauthorized = contract_address_const::<'unauthorized'>();
        
        // Try to update staking record without being yield distributor
        set_caller_address(unauthorized);
        tongo_pool.update_staking_record(
            user_public_key,
            token,
            encrypted_stake_amount,
            yield_multiplier
        );
    }

    #[test]
    fn test_shielded_staking_proof_verification() {
        let (tongo_pool, owner) = setup();
        let user_public_key = 12345;
        let minimum_stake = 10000;
        let proof = array![9, 10, 11, 12].span();
        
        // Verify staking proof
        let is_valid = tongo_pool.verify_shielded_staking_proof(
            user_public_key,
            minimum_stake,
            proof
        );
        
        assert(is_valid, 'Proof should be valid');
    }

    #[test]
    fn test_pause_unpause() {
        let (tongo_pool, owner) = setup();
        
        set_caller_address(owner);
        
        // Initially not paused
        assert(!tongo_pool.is_paused(), 'Should not be paused initially');
        
        // Pause contract
        tongo_pool.pause();
        assert(tongo_pool.is_paused(), 'Should be paused');
        
        // Unpause contract
        tongo_pool.unpause();
        assert(!tongo_pool.is_paused(), 'Should not be paused after unpause');
    }

    #[test]
    #[should_panic(expected: ('Contract paused',))]
    fn test_fund_when_paused() {
        let (tongo_pool, owner) = setup();
        let token = contract_address_const::<'token'>();
        let user_public_key = 12345;
        let encrypted_amount = 67890;
        let commitment = 11111;
        
        set_caller_address(owner);
        
        // Add supported token and pause
        tongo_pool.add_supported_token(token);
        tongo_pool.pause();
        
        // Try to fund when paused - should fail
        tongo_pool.fund(
            token,
            encrypted_amount,
            commitment,
            user_public_key
        );
    }
}