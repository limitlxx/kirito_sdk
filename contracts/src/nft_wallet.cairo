#[starknet::contract]
pub mod NFTWallet {
    use starknet::{
        ContractAddress, ClassHash, get_caller_address, get_contract_address, 
        syscalls::deploy_syscall
    };
    use starknet::storage::*;
    use core::array::ArrayTrait;
    use core::traits::Into;
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        // ERC-721 storage
        name: ByteArray,
        symbol: ByteArray,
        base_uri: ByteArray,
        total_supply: u256,
        
        // Token ownership and approvals
        owners: Map<u256, ContractAddress>,
        balances: Map<ContractAddress, u256>,
        token_approvals: Map<u256, ContractAddress>,
        operator_approvals: Map<(ContractAddress, ContractAddress), bool>,
        
        // NFT Wallet specific storage
        wallet_addresses: Map<u256, ContractAddress>,
        staking_amounts: Map<u256, u256>,
        token_uris: Map<u256, ByteArray>,
        
        // Account abstraction storage
        wallet_class_hash: ClassHash,
        wallet_salt_nonce: u256,
        
        // UUPS Proxy storage
        implementation: ClassHash,
        admin: ContractAddress,
        
        // Access control
        owner: ContractAddress,
        minters: Map<ContractAddress, bool>,
        
        // Security patterns
        paused: bool,
        reentrancy_guard: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
        ApprovalForAll: ApprovalForAll,
        WalletDeployed: WalletDeployed,
        StakingAmountSet: StakingAmountSet,
        Upgraded: Upgraded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        #[key]
        pub token_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub approved: ContractAddress,
        #[key]
        pub token_id: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ApprovalForAll {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub operator: ContractAddress,
        pub approved: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WalletDeployed {
        #[key]
        pub token_id: u256,
        pub wallet_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StakingAmountSet {
        #[key]
        pub token_id: u256,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Upgraded {
        pub implementation: ClassHash,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        base_uri: ByteArray,
        owner: ContractAddress,
        wallet_class_hash: ClassHash,
        admin: ContractAddress
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.base_uri.write(base_uri);
        self.owner.write(owner);
        self.wallet_class_hash.write(wallet_class_hash);
        self.admin.write(admin);
        self.wallet_salt_nonce.write(0);
        self.total_supply.write(0);
        
        // Initialize UUPS proxy - set initial implementation
        // In a real proxy pattern, this would be the class hash of the implementation contract
        // For now, we use the wallet_class_hash as a placeholder
        self.implementation.write(wallet_class_hash);
        
        // Initialize security
        self.paused.write(false);
        self.reentrancy_guard.write(false);
        
        // Set owner as initial minter
        self.minters.write(owner, true);
    }

    #[abi(embed_v0)]
    impl ERC721Impl of crate::interfaces::IERC721<ContractState> {
        fn balance_of(self: @ContractState, owner: ContractAddress) -> u256 {
            assert(!owner.is_zero(), 'Invalid owner address');
            self.balances.read(owner)
        }

        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            let owner = self.owners.read(token_id);
            assert(!owner.is_zero(), 'Token does not exist');
            owner
        }

        fn safe_transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256,
            data: Span<felt252>
        ) {
            self._safe_transfer_from(from, to, token_id, data);
        }

        fn transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256
        ) {
            self._when_not_paused();
            self._transfer_from(from, to, token_id);
        }

        fn approve(ref self: ContractState, to: ContractAddress, token_id: u256) {
            let owner = self.owner_of(token_id);
            assert(to != owner, 'Cannot approve to owner');
            
            let caller = get_caller_address();
            assert(
                caller == owner || self.is_approved_for_all(owner, caller),
                'Not authorized to approve'
            );
            
            self.token_approvals.write(token_id, to);
            self.emit(Approval { owner, approved: to, token_id });
        }

        fn set_approval_for_all(ref self: ContractState, operator: ContractAddress, approved: bool) {
            let caller = get_caller_address();
            assert(caller != operator, 'Cannot approve to self');
            
            self.operator_approvals.write((caller, operator), approved);
            self.emit(ApprovalForAll { owner: caller, operator, approved });
        }

        fn get_approved(self: @ContractState, token_id: u256) -> ContractAddress {
            assert(!self.owners.read(token_id).is_zero(), 'Token does not exist');
            self.token_approvals.read(token_id)
        }

        fn is_approved_for_all(
            self: @ContractState,
            owner: ContractAddress,
            operator: ContractAddress
        ) -> bool {
            self.operator_approvals.read((owner, operator))
        }

        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            assert(!self.owners.read(token_id).is_zero(), 'Token does not exist');
            let token_uri = self.token_uris.read(token_id);
            if token_uri.len() > 0 {
                token_uri
            } else {
                let base_uri = self.base_uri.read();
                // Proper URI building with token ID
                self._build_token_uri(base_uri, token_id)
            }
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
    }

    #[abi(embed_v0)]
    impl NFTWalletImpl of crate::interfaces::INFTWallet<ContractState> {
        fn mint(
            ref self: ContractState,
            to: ContractAddress,
            token_id: u256,
            staking_amount: u256,
            metadata_uri: ByteArray
        ) {
            // Security checks
            self._when_not_paused();
            self._nonreentrant();
            
            // Check minter authorization
            assert(self.minters.read(get_caller_address()), 'Not authorized to mint');
            assert(!to.is_zero(), 'Cannot mint to zero address');
            assert(self.owners.read(token_id).is_zero(), 'Token already exists');
            
            // Mint the NFT
            self.owners.write(token_id, to);
            let current_balance = self.balances.read(to);
            self.balances.write(to, current_balance + 1);
            let current_supply = self.total_supply.read();
            self.total_supply.write(current_supply + 1);
            
            // Store metadata URI
            self.token_uris.write(token_id, metadata_uri);
            
            // Store staking amount
            self.staking_amounts.write(token_id, staking_amount);
            
            // Deploy wallet contract with account abstraction
            let wallet_address = self._deploy_wallet(token_id, to);
            self.wallet_addresses.write(token_id, wallet_address);
            
            self.emit(Transfer { from: 0.try_into().unwrap(), to, token_id });
            self.emit(WalletDeployed { token_id, wallet_address });
            self.emit(StakingAmountSet { token_id, amount: staking_amount });
            
            // End reentrancy protection
            self._end_nonreentrant();
        }

        fn get_wallet_address(self: @ContractState, token_id: u256) -> ContractAddress {
            assert(!self.owners.read(token_id).is_zero(), 'Token does not exist');
            self.wallet_addresses.read(token_id)
        }

        fn execute_from_wallet(
            ref self: ContractState,
            token_id: u256,
            to: ContractAddress,
            value: u256,
            data: Span<felt252>
        ) -> Span<felt252> {
            // Verify caller owns the NFT or is approved
            let owner = self.owners.read(token_id);
            assert(!owner.is_zero(), 'Token does not exist');
            
            let caller = get_caller_address();
            assert(
                caller == owner || 
                caller == self.get_approved(token_id) ||
                self.is_approved_for_all(owner, caller),
                'Not authorized'
            );
            
            // Get the wallet address for this token
            let wallet_address = self.wallet_addresses.read(token_id);
            assert(!wallet_address.is_zero(), 'Wallet not deployed');
            
            // Prepare calldata for wallet's execute function
            let mut execute_calldata = array![];
            execute_calldata.append(to.into());
            execute_calldata.append(value.low.into());
            execute_calldata.append(value.high.into());
            
            // Append the data span
            let mut i = 0;
            loop {
                if i >= data.len() {
                    break;
                }
                execute_calldata.append(*data.at(i));
                i += 1;
            };
            
            // Execute call to wallet contract using syscall
            let result = starknet::syscalls::call_contract_syscall(
                wallet_address,
                selector!("execute_transaction"),
                execute_calldata.span()
            );
            
            match result {
                Result::Ok(ret_data) => ret_data,
                Result::Err(err) => {
                    panic!("Wallet execution failed");
                }
            }
        }

        fn get_wallet_balance(
            self: @ContractState,
            token_id: u256,
            asset: ContractAddress
        ) -> u256 {
            assert(!self.owners.read(token_id).is_zero(), 'Token does not exist');
            
            // Get the wallet address for this token
            let wallet_address = self.wallet_addresses.read(token_id);
            assert(!wallet_address.is_zero(), 'Wallet not deployed');
            
            // Query balance from the wallet contract or token contract
            if asset.is_zero() {
                // ETH balance - query from wallet contract
                let balance_result = starknet::syscalls::call_contract_syscall(
                    wallet_address,
                    selector!("get_balance"),
                    array![asset.into()].span()
                );
                
                match balance_result {
                    Result::Ok(ret_data) => {
                        if ret_data.len() >= 2 {
                            let low = (*ret_data.at(0)).try_into().unwrap();
                            let high = (*ret_data.at(1)).try_into().unwrap();
                            u256 { low, high }
                        } else {
                            0_u256
                        }
                    },
                    Result::Err(_) => 0_u256
                }
            } else {
                // ERC20 token balance - query from token contract
                let balance_result = starknet::syscalls::call_contract_syscall(
                    asset,
                    selector!("balance_of"),
                    array![wallet_address.into()].span()
                );
                
                match balance_result {
                    Result::Ok(ret_data) => {
                        if ret_data.len() >= 2 {
                            let low = (*ret_data.at(0)).try_into().unwrap();
                            let high = (*ret_data.at(1)).try_into().unwrap();
                            u256 { low, high }
                        } else {
                            0_u256
                        }
                    },
                    Result::Err(_) => 0_u256
                }
            }
        }
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of crate::interfaces::IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            assert(get_caller_address() == self.admin.read(), 'Only admin can upgrade');
            assert(!new_class_hash.is_zero(), 'Invalid class hash');
            
            self.implementation.write(new_class_hash);
            self.emit(Upgraded { implementation: new_class_hash });
        }

        fn get_implementation(self: @ContractState) -> ClassHash {
            self.implementation.read()
        }
    }

    #[abi(embed_v0)]
    impl AdminImpl of crate::interfaces::IAdmin<ContractState> {
        fn pause(ref self: ContractState) {
            self._pause();
        }

        fn unpause(ref self: ContractState) {
            self._unpause();
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress, authorized: bool) {
            self._set_minter(minter, authorized);
        }

        fn is_minter(self: @ContractState, account: ContractAddress) -> bool {
            self.minters.read(account)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256
        ) {
            let owner = self.owner_of(token_id);
            assert(from == owner, 'Transfer from incorrect owner');
            assert(!to.is_zero(), 'Transfer to zero address');
            
            let caller = get_caller_address();
            assert(
                caller == owner ||
                caller == self.get_approved(token_id) ||
                self.is_approved_for_all(owner, caller),
                'Not authorized to transfer'
            );
            
            // Clear approval
            self.token_approvals.write(token_id, 0.try_into().unwrap());
            
            // Update balances
            let from_balance = self.balances.read(from);
            self.balances.write(from, from_balance - 1);
            let to_balance = self.balances.read(to);
            self.balances.write(to, to_balance + 1);
            
            // Update owner
            self.owners.write(token_id, to);
            
            self.emit(Transfer { from, to, token_id });
        }

        fn _safe_transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256,
            data: Span<felt252>
        ) {
            self._transfer_from(from, to, token_id);
            
            // Check if `to` is a contract and call onERC721Received
            let to_code_size = self._get_code_size(to);
            if to_code_size > 0 {
                // Call onERC721Received on the receiver contract
                let mut receiver_calldata = array![];
                receiver_calldata.append(get_caller_address().into()); // operator
                receiver_calldata.append(from.into()); // from
                receiver_calldata.append(token_id.low.into()); // token_id low
                receiver_calldata.append(token_id.high.into()); // token_id high
                receiver_calldata.append(data.len().into()); // data length
                
                // Append data
                let mut i = 0;
                loop {
                    if i >= data.len() {
                        break;
                    }
                    receiver_calldata.append(*data.at(i));
                    i += 1;
                };
                
                let result = starknet::syscalls::call_contract_syscall(
                    to,
                    selector!("on_erc721_received"),
                    receiver_calldata.span()
                );
                
                match result {
                    Result::Ok(ret_data) => {
                        // Verify the magic value is returned
                        // ERC721_RECEIVER_MAGIC = selector!("on_erc721_received")
                        if ret_data.len() > 0 {
                            let magic_value = *ret_data.at(0);
                            let expected_magic = selector!("on_erc721_received");
                            assert(magic_value == expected_magic, 'Invalid receiver response');
                        } else {
                            panic!("Receiver returned no data");
                        }
                    },
                    Result::Err(_) => {
                        panic!("Receiver call failed");
                    }
                }
            }
        }

        fn _deploy_wallet(
            ref self: ContractState,
            token_id: u256,
            owner: ContractAddress
        ) -> ContractAddress {
            let class_hash = self.wallet_class_hash.read();
            let salt_nonce = self.wallet_salt_nonce.read();
            let salt = (salt_nonce + token_id).try_into().expect('Salt overflow');
            
            // Constructor calldata for wallet: owner address and token_id
            let mut constructor_calldata = array![];
            constructor_calldata.append(owner.into());
            constructor_calldata.append(token_id.low.into());
            constructor_calldata.append(token_id.high.into());
            constructor_calldata.append(get_contract_address().into()); // NFT contract address
            
            let (wallet_address, _) = deploy_syscall(
                class_hash,
                salt,
                constructor_calldata.span(),
                false
            ).expect('Wallet deployment failed');
            
            // Increment salt nonce for next deployment
            self.wallet_salt_nonce.write(salt_nonce + 1);
            
            wallet_address
        }

        fn _set_minter(ref self: ContractState, minter: ContractAddress, authorized: bool) {
            assert(get_caller_address() == self.owner.read(), 'Only owner can set minters');
            self.minters.write(minter, authorized);
        }

        fn _when_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn _nonreentrant(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrant call');
            self.reentrancy_guard.write(true);
        }

        fn _end_nonreentrant(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn _pause(ref self: ContractState) {
            assert(get_caller_address() == self.owner.read(), 'Only owner can pause');
            self.paused.write(true);
        }

        fn _unpause(ref self: ContractState) {
            assert(get_caller_address() == self.owner.read(), 'Only owner can unpause');
            self.paused.write(false);
        }

        fn _get_code_size(self: @ContractState, address: ContractAddress) -> u256 {
            // Use proper syscall to check if address is a contract
            let addr_felt: felt252 = address.into();
            if addr_felt == 0 {
                return 0;
            }
            
            // Try to get the class hash at the address
            // If it succeeds and returns non-zero, it's a contract
            let class_hash_result = starknet::syscalls::get_class_hash_at_syscall(address);
            
            match class_hash_result {
                Result::Ok(class_hash) => {
                    let class_hash_felt: felt252 = class_hash.into();
                    if class_hash_felt == 0 {
                        0_u256
                    } else {
                        1_u256 // Non-zero indicates contract exists
                    }
                },
                Result::Err(_) => 0_u256
            }
        }

        fn _build_token_uri(self: @ContractState, base_uri: ByteArray, token_id: u256) -> ByteArray {
            // Build URI by concatenating base_uri with token_id
            let mut result = base_uri;
            
            // Convert token_id to string representation
            let id_low = token_id.low;
            
            // Simple number to string conversion for the low part
            if id_low == 0 {
                result.append(@"0");
            } else {
                // Convert number to string (simplified approach)
                let mut temp_id = id_low;
                let mut digits = array![];
                
                // Extract digits
                while temp_id != 0 {
                    let digit = temp_id % 10;
                    digits.append(digit);
                    temp_id = temp_id / 10;
                };
                
                // Reverse and append digits
                let mut i = digits.len();
                while i > 0 {
                    i -= 1;
                    let digit = *digits.at(i);
                    
                    // Convert digit to character and append
                    if digit == 0 { result.append(@"0"); }
                    else if digit == 1 { result.append(@"1"); }
                    else if digit == 2 { result.append(@"2"); }
                    else if digit == 3 { result.append(@"3"); }
                    else if digit == 4 { result.append(@"4"); }
                    else if digit == 5 { result.append(@"5"); }
                    else if digit == 6 { result.append(@"6"); }
                    else if digit == 7 { result.append(@"7"); }
                    else if digit == 8 { result.append(@"8"); }
                    else if digit == 9 { result.append(@"9"); }
                };
            }
            
            result.append(@".json");
            result
        }
    }
}