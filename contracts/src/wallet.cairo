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
            // Get transaction info to access signature
            let tx_info = get_tx_info().unbox();
            let signature = tx_info.signature;
            
            // Verify signature length (should be 2 for ECDSA: r, s)
            if signature.len() != 2 {
                return 0;
            }
            
            let r = *signature.at(0);
            let s = *signature.at(1);
            
            // Basic validation: signature components should not be zero
            if r == 0 || s == 0 {
                return 0;
            }
            
            // Get the owner's public key (stored as address)
            let owner = self.owner.read();
            let nft_contract = self.nft_contract.read();
            
            // Verify ECDSA signature
            // In production, this would use proper ECDSA verification with public key recovery
            // For now, we verify the caller is authorized
            let caller = get_caller_address();
            
            // Allow owner or NFT contract to execute transactions
            if caller == owner || caller == nft_contract {
                starknet::VALIDATED
            } else {
                // In full implementation, would verify signature cryptographically:
                // 1. Recover public key from (tx_hash, r, s)
                // 2. Derive address from public key
                // 3. Compare with stored owner address
                // For now, require direct authorization
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
                
                let call = call_array.at(i);
                
                // Execute the actual contract call using syscall
                let call_result = starknet::syscalls::call_contract_syscall(
                    *call.to,
                    *call.selector,
                    *call.calldata
                );
                
                match call_result {
                    Result::Ok(ret_data) => {
                        results.append(ret_data);
                    },
                    Result::Err(err) => {
                        // Create error result
                        let mut error_result = array![];
                        error_result.append(0); // Error indicator
                        results.append(error_result.span());
                    }
                };
                
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
            // Check signature length (should be 2 for ECDSA: r, s)
            if signature.len() != 2 {
                return 0;
            }
            
            let r = *signature.at(0);
            let s = *signature.at(1);
            
            // Basic validation: signature components should not be zero
            if r == 0 || s == 0 {
                return 0;
            }
            
            // Get the owner's address (which represents the public key)
            let owner = self.owner.read();
            let owner_felt: felt252 = owner.into();
            
            // In production, this would use proper ECDSA verification:
            // 1. Use check_ecdsa_signature syscall with the owner's public key
            // 2. Verify the signature against the hash
            // 
            // For now, we perform basic validation and trust the signature
            // if it has the correct structure
            
            // Attempt ECDSA verification using syscall
            // Note: In real implementation, we'd need the actual public key, not just address
            // This is a simplified version that validates structure
            
            // The full implementation would look like:
            // let verification_result = starknet::syscalls::check_ecdsa_signature(
            //     hash,
            //     owner_public_key,
            //     r,
            //     s
            // );
            // 
            // match verification_result {
            //     Result::Ok(_) => starknet::VALIDATED,
            //     Result::Err(_) => 0
            // }
            
            // For now, return VALIDATED if basic checks pass
            // This should be replaced with actual ECDSA verification in production
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
            
            // Execute ERC20 transfer using syscall
            let mut transfer_calldata = array![];
            transfer_calldata.append(to.into());
            transfer_calldata.append(amount.low.into());
            transfer_calldata.append(amount.high.into());
            
            let transfer_result = starknet::syscalls::call_contract_syscall(
                asset,
                selector!("transfer"),
                transfer_calldata.span()
            );
            
            match transfer_result {
                Result::Ok(ret_data) => {
                    // Verify transfer succeeded (should return true)
                    if ret_data.len() > 0 {
                        let success = *ret_data.at(0);
                        assert(success == 1, 'Transfer failed');
                    }
                },
                Result::Err(_) => {
                    panic!("Transfer call failed");
                }
            }
            
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