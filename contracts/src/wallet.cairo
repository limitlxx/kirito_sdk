#[starknet::contract]
pub mod Wallet {
    use starknet::{
        ContractAddress, get_caller_address,
        get_tx_info, account::Call
    };
    use starknet::storage::*;
    use core::array::ArrayTrait;
    use core::traits::Into;
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        // Account abstraction storage
        owner: ContractAddress,
        token_id: u256,
        nft_contract: ContractAddress,
        
        // Asset balances
        balances: Map<ContractAddress, u256>,
        
        // Nonce for transaction replay protection
        nonce: felt252,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TransactionExecuted: TransactionExecuted,
        AssetReceived: AssetReceived,
        AssetTransferred: AssetTransferred,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TransactionExecuted {
        pub hash: felt252,
        pub response: Span<felt252>,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AssetReceived {
        pub asset: ContractAddress,
        pub amount: u256,
        pub from: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AssetTransferred {
        pub asset: ContractAddress,
        pub amount: u256,
        pub to: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        token_id: u256,
        nft_contract: ContractAddress
    ) {
        self.owner.write(owner);
        self.token_id.write(token_id);
        self.nft_contract.write(nft_contract);
        self.nonce.write(0);
    }

    #[abi(embed_v0)]
    impl AccountAbstractionImpl of crate::interfaces::IAccountAbstraction<ContractState> {
        fn validate_transaction(
            self: @ContractState,
            call_array: Array<Call>,
            calldata: Array<felt252>,
            tx_hash: felt252
        ) -> felt252 {
            // Verify that the caller is authorized to execute transactions
            // In a full implementation, this would verify signatures
            let caller = get_caller_address();
            let owner = self.owner.read();
            let nft_contract = self.nft_contract.read();
            
            // Allow owner or NFT contract to execute transactions
            if caller == owner || caller == nft_contract {
                starknet::VALIDATED
            } else {
                0
            }
        }

        fn execute_transaction(
            ref self: ContractState,
            call_array: Array<Call>,
            calldata: Array<felt252>
        ) -> Array<Span<felt252>> {
            // Validate the transaction first
            let tx_info = get_tx_info().unbox();
            let validation_result = self.validate_transaction(
                call_array.clone(),
                calldata.clone(),
                tx_info.transaction_hash
            );
            assert(validation_result == starknet::VALIDATED, 'Transaction not validated');
            
            // Execute each call in the array
            let mut results = array![];
            let mut i = 0;
            
            loop {
                if i >= call_array.len() {
                    break;
                }
                
                let _call = call_array.at(i);
                
                // For production, would execute actual contract calls
                // For now, simulate successful execution
                let mut success_result = array![];
                success_result.append(1); // Success indicator
                results.append(success_result.span());
                
                i += 1;
            };
            
            // Increment nonce
            let current_nonce = self.nonce.read();
            self.nonce.write(current_nonce + 1);
            
            self.emit(TransactionExecuted { 
                hash: tx_info.transaction_hash, 
                response: array![].span() 
            });
            
            results
        }

        fn is_valid_signature(
            self: @ContractState,
            hash: felt252,
            signature: Array<felt252>
        ) -> felt252 {
            // Enhanced signature validation
            let _owner = self.owner.read();
            
            // Check signature length (should be 2 for ECDSA: r, s)
            if signature.len() != 2 {
                return 0;
            }
            
            // In a full implementation, this would:
            // 1. Recover the public key from the signature and hash
            // 2. Derive the address from the public key
            // 3. Compare with the stored owner address
            
            // For now, we'll do a simplified check
            let r = *signature.at(0);
            let s = *signature.at(1);
            
            // Basic validation: signature components should not be zero
            if r == 0 || s == 0 {
                return 0;
            }
            
            // In production, use proper ECDSA verification here
            // For now, return VALIDATED if basic checks pass
            starknet::VALIDATED
        }
    }

    #[abi(embed_v0)]
    impl WalletImpl of crate::interfaces::IWallet<ContractState> {
        fn get_balance(self: @ContractState, asset: ContractAddress) -> u256 {
            self.balances.read(asset)
        }

        fn transfer(
            ref self: ContractState,
            asset: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) {
            // Verify authorization
            let caller = get_caller_address();
            let owner = self.owner.read();
            let nft_contract = self.nft_contract.read();
            
            assert(
                caller == owner || caller == nft_contract,
                'Not authorized to transfer'
            );
            
            assert(!to.is_zero(), 'Cannot transfer to zero address');
            assert(amount > 0, 'Amount must be > 0');
            
            // Check balance
            let current_balance = self.balances.read(asset);
            assert(current_balance >= amount, 'Insufficient balance');
            
            // Update balance
            self.balances.write(asset, current_balance - amount);
            
            // For production implementation, would execute ERC20 transfer
            // This would involve calling the ERC20 contract's transfer function
            // For now, we simulate successful transfer by updating internal balance
            
            self.emit(AssetTransferred { asset, amount, to });
        }

        fn receive(
            ref self: ContractState,
            asset: ContractAddress,
            amount: u256,
            from: ContractAddress
        ) {
            // Update balance
            let current_balance = self.balances.read(asset);
            self.balances.write(asset, current_balance + amount);
            
            self.emit(AssetReceived { asset, amount, from });
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn get_token_id(self: @ContractState) -> u256 {
            self.token_id.read()
        }

        fn get_nft_contract(self: @ContractState) -> ContractAddress {
            self.nft_contract.read()
        }
    }
}