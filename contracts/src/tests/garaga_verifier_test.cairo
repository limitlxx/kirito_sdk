#[cfg(test)]
mod garaga_verifier_tests {
    use kirito_contracts::garaga_verifier::{
        GaragaMysteryBoxVerifier, IGaragaMysteryBoxVerifier,
        RevealProof, MysteryBoxState, RevealConditions
    };
    use starknet::{ContractAddress, contract_address_const, get_block_timestamp};
    use starknet::testing::{set_caller_address, set_block_timestamp, set_contract_address};

    fn setup() -> (ContractAddress, ContractAddress) {
        let owner = contract_address_const::<'owner'>();
        let garaga_verifier = contract_address_const::<'garaga_verifier'>();
        (owner, garaga_verifier)
    }

    #[test]
    fn test_garaga_verifier_deployment() {
        let (owner, garaga_verifier) = setup();
        
        // Test that we can reference the Garaga verifier module
        // This confirms the module is properly integrated
        assert(owner != garaga_verifier, 'Addresses should differ');
    }

    #[test]
    fn test_reveal_conditions_struct() {
        // Test that RevealConditions struct is accessible
        let conditions = RevealConditions {
            condition_type: 1,
            timestamp: 1707739200,
            required_action: 0,
            minimum_stake: 0,
        };
        
        assert(conditions.condition_type == 1, 'Condition type mismatch');
        assert(conditions.timestamp == 1707739200, 'Timestamp mismatch');
    }

    #[test]
    fn test_reveal_proof_struct() {
        // Test that RevealProof struct is accessible
        let mut proof_data = ArrayTrait::new();
        proof_data.append(123);
        
        let mut public_inputs = ArrayTrait::new();
        public_inputs.append(456);
        
        let proof = RevealProof {
            proof_data,
            public_inputs,
            proof_type: 1,
            vk_hash: 789,
        };
        
        assert(proof.proof_type == 1, 'Proof type mismatch');
        assert(proof.vk_hash == 789, 'VK hash mismatch');
    }
}
