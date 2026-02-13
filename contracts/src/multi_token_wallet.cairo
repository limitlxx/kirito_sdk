#[starknet::contract]
pub mod MultiTokenWallet {
    use starknet::{
        ContractAddress, get_caller_address,
        syscalls::call_contract_syscall
    };
    use starknet::storage::*;
    use core::array::ArrayTrait;
    use core::traits::Into;
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        // Wallet ownership
        owner: ContractAddress,
        nft_contract: ContractAddress,
        token_id: u256,
        
        // Multi-token balances: token_address -> balance
        token_balances: Map<ContractAddress, u256>,
        
        // Native token balances (ETH, STRK)
        eth_balance: u256,
        strk_balance: u256,
        
        // Token registry for supported assets
        supported_tokens: Map<ContractAddress, bool>,
        token_registry: Map<u32, ContractAddress>, // index -> token address
        token_count: u32,
        
        // Token metadata for display
        token_symbols: Map<ContractAddress, ByteArray>,
        token_decimals: Map<ContractAddress, u8>,
        
        // Access control
        authorized_operators: Map<ContractAddress, bool>,
        
        // Security
        paused: bool,
        reentrancy_guard: bool,
        
        // Account abstraction support
        nonce: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TokenReceived: TokenReceived,
        TokenTransferred: TokenTransferred,
        TokenRegistered: TokenRegistered,
        OperatorAuthorized: OperatorAuthorized,
        OperatorRevoked: OperatorRevoked,
        WalletPaused: WalletPaused,
        WalletUnpaused: WalletUnpaused,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenReceived {
        #[key]
        pub token: ContractAddress,
        pub amount: u256,
        #[key]
        pub from: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenTransferred {
        #[key]
        pub token: ContractAddress,
        pub amount: u256,
        #[key]
        pub to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TokenRegistered {
        #[key]
        pub token: ContractAddress,
        pub symbol: ByteArray,
        pub decimals: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OperatorAuthorized {
        #[key]
        pub operator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OperatorRevoked {
        #[key]
        pub operator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WalletPaused {
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WalletUnpaused {
        pub timestamp: u64,
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
        self.token_count.write(0);
        self.nonce.write(0);
        self.paused.write(false);
        self.reentrancy_guard.write(false);
        
        // Register common Starknet tokens by default
        self._register_default_tokens();
    }

    #[abi(embed_v0)]
    impl MultiTokenWalletImpl of crate::interfaces::IMultiTokenWallet<ContractState> {
        fn get_balance(self: @ContractState, token: ContractAddress) -> u256 {
            if token.is_zero() {
                // ETH balance
                self.eth_balance.read()
            } else if token == self._get_strk_address() {
                // STRK balance
                self.strk_balance.read()
            } else {
                // ERC20 token balance
                self.token_balances.read(token)
            }
        }

        fn get_all_balances(self: @ContractState) -> Span<(ContractAddress, u256)> {
            let mut balances = array![];
            
            // Add ETH balance
            let eth_balance = self.eth_balance.read();
            if eth_balance > 0 {
                balances.append((0.try_into().unwrap(), eth_balance));
            }
            
            // Add STRK balance
            let strk_address = self._get_strk_address();
            let strk_balance = self.strk_balance.read();
            if strk_balance > 0 {
                balances.append((strk_address, strk_balance));
            }
            
            // Add ERC20 token balances
            let token_count = self.token_count.read();
            let mut i = 0;
            while i < token_count {
                let token_address = self.token_registry.read(i);
                let balance = self.token_balances.read(token_address);
                if balance > 0 {
                    balances.append((token_address, balance));
                }
                i += 1;
            };
            
            balances.span()
        }

        fn transfer_token(
            ref self: ContractState,
            token: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) {
            self._when_not_paused();
            self._only_owner_or_operator();
            self._nonreentrant();
            
            assert(!to.is_zero(), 'Invalid recipient');
            assert(amount > 0, 'Amount must be positive');
            
            let current_balance = self.get_balance(token);
            assert(current_balance >= amount, 'Insufficient balance');
            
            if token.is_zero() {
                // Transfer ETH
                self._transfer_eth(to, amount);
            } else if token == self._get_strk_address() {
                // Transfer STRK
                self._transfer_strk(to, amount);
            } else {
                // Transfer ERC20 token
                self._transfer_erc20(token, to, amount);
            }
            
            self.emit(TokenTransferred { token, amount, to });
            self._end_nonreentrant();
        }

        fn receive_token(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            from: ContractAddress
        ) {
            self._when_not_paused();
            assert(amount > 0, 'Amount must be positive');
            
            if token.is_zero() {
                // Receive ETH
                let current_balance = self.eth_balance.read();
                self.eth_balance.write(current_balance + amount);
            } else if token == self._get_strk_address() {
                // Receive STRK
                let current_balance = self.strk_balance.read();
                self.strk_balance.write(current_balance + amount);
            } else {
                // Receive ERC20 token
                let current_balance = self.token_balances.read(token);
                self.token_balances.write(token, current_balance + amount);
                
                // Auto-register token if not already registered
                if !self.supported_tokens.read(token) {
                    self._auto_register_token(token);
                }
            }
            
            self.emit(TokenReceived { token, amount, from });
        }

        fn register_token(
            ref self: ContractState,
            token: ContractAddress,
            symbol: ByteArray,
            decimals: u8
        ) {
            self._only_owner_or_operator();
            assert(!token.is_zero(), 'Invalid token address');
            assert(!self.supported_tokens.read(token), 'Token already registered');
            
            // Register token
            self.supported_tokens.write(token, true);
            self.token_symbols.write(token, symbol.clone());
            self.token_decimals.write(token, decimals);
            
            // Add to registry
            let current_count = self.token_count.read();
            self.token_registry.write(current_count, token);
            self.token_count.write(current_count + 1);
            
            self.emit(TokenRegistered { token, symbol, decimals });
        }

        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            if token.is_zero() || token == self._get_strk_address() {
                true // ETH and STRK are always supported
            } else {
                self.supported_tokens.read(token)
            }
        }

        fn get_supported_tokens(self: @ContractState) -> Span<ContractAddress> {
            let mut tokens = array![];
            
            // Add ETH (zero address)
            tokens.append(0.try_into().unwrap());
            
            // Add STRK
            tokens.append(self._get_strk_address());
            
            // Add registered ERC20 tokens
            let token_count = self.token_count.read();
            let mut i = 0;
            while i < token_count {
                let token_address = self.token_registry.read(i);
                tokens.append(token_address);
                i += 1;
            };
            
            tokens.span()
        }

        fn get_token_info(self: @ContractState, token: ContractAddress) -> (ByteArray, u8) {
            if token.is_zero() {
                ("ETH", 18)
            } else if token == self._get_strk_address() {
                ("STRK", 18)
            } else {
                let symbol = self.token_symbols.read(token);
                let decimals = self.token_decimals.read(token);
                (symbol, decimals)
            }
        }

        fn authorize_operator(ref self: ContractState, operator: ContractAddress) {
            self._only_owner();
            assert(!operator.is_zero(), 'Invalid operator address');
            
            self.authorized_operators.write(operator, true);
            self.emit(OperatorAuthorized { operator });
        }

        fn revoke_operator(ref self: ContractState, operator: ContractAddress) {
            self._only_owner();
            
            self.authorized_operators.write(operator, false);
            self.emit(OperatorRevoked { operator });
        }

        fn is_authorized_operator(self: @ContractState, operator: ContractAddress) -> bool {
            self.authorized_operators.read(operator)
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn get_nft_info(self: @ContractState) -> (ContractAddress, u256) {
            (self.nft_contract.read(), self.token_id.read())
        }

        fn pause(ref self: ContractState) {
            self._only_owner();
            self.paused.write(true);
            self.emit(WalletPaused { timestamp: starknet::get_block_timestamp() });
        }

        fn unpause(ref self: ContractState) {
            self._only_owner();
            self.paused.write(false);
            self.emit(WalletUnpaused { timestamp: starknet::get_block_timestamp() });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }
    }

    #[abi(embed_v0)]
    impl AccountAbstractionImpl of crate::interfaces::IAccountAbstraction<ContractState> {
        fn execute_transaction(
            ref self: ContractState,
            to: ContractAddress,
            value: u256,
            data: Span<felt252>
        ) -> Span<felt252> {
            self._when_not_paused();
            self._only_owner_or_operator();
            self._nonreentrant();
            
            // Increment nonce
            let current_nonce = self.nonce.read();
            self.nonce.write(current_nonce + 1);
            
            // Execute the transaction
            let result = self._execute_call(to, value, data);
            
            self._end_nonreentrant();
            result
        }

        fn get_nonce(self: @ContractState) -> u256 {
            self.nonce.read()
        }

        fn validate_transaction(
            self: @ContractState,
            transaction_hash: felt252,
            signature: Span<felt252>
        ) -> bool {
            // Simplified validation - in production would verify signature
            // against owner's public key and transaction hash
            signature.len() > 0 && !self.paused.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), 'Only owner allowed');
        }

        fn _only_owner_or_operator(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_operator = self.authorized_operators.read(caller);
            assert(is_owner || is_operator, 'Not authorized');
        }

        fn _when_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Wallet is paused');
        }

        fn _nonreentrant(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrant call');
            self.reentrancy_guard.write(true);
        }

        fn _end_nonreentrant(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn _get_strk_address(self: @ContractState) -> ContractAddress {
            // STRK token address on Starknet mainnet
            // This would be the actual STRK token contract address
            0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d.try_into().unwrap()
        }

        fn _register_default_tokens(ref self: ContractState) {
            // Register common Starknet tokens
            
            // USDC
            let usdc_address: ContractAddress = 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8.try_into().unwrap();
            self.supported_tokens.write(usdc_address, true);
            self.token_symbols.write(usdc_address, "USDC");
            self.token_decimals.write(usdc_address, 6);
            self.token_registry.write(0, usdc_address);
            
            // WBTC (if available on Starknet)
            let wbtc_address: ContractAddress = 0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac.try_into().unwrap();
            self.supported_tokens.write(wbtc_address, true);
            self.token_symbols.write(wbtc_address, "WBTC");
            self.token_decimals.write(wbtc_address, 8);
            self.token_registry.write(1, wbtc_address);
            
            // DAI
            let dai_address: ContractAddress = 0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3.try_into().unwrap();
            self.supported_tokens.write(dai_address, true);
            self.token_symbols.write(dai_address, "DAI");
            self.token_decimals.write(dai_address, 18);
            self.token_registry.write(2, dai_address);
            
            self.token_count.write(3);
        }

        fn _auto_register_token(ref self: ContractState, token: ContractAddress) {
            // Auto-register token by querying its metadata
            let symbol = self._query_token_symbol(token);
            let decimals = self._query_token_decimals(token);
            
            self.supported_tokens.write(token, true);
            self.token_symbols.write(token, symbol.clone());
            self.token_decimals.write(token, decimals);
            
            let current_count = self.token_count.read();
            self.token_registry.write(current_count, token);
            self.token_count.write(current_count + 1);
            
            self.emit(TokenRegistered { token, symbol, decimals });
        }

        fn _query_token_symbol(self: @ContractState, token: ContractAddress) -> ByteArray {
            // Query token symbol using call_contract_syscall
            let mut call_data = array![];
            let result = call_contract_syscall(
                token,
                selector!("symbol"),
                call_data.span()
            );
            
            match result {
                Result::Ok(data) => {
                    if data.len() > 0 {
                        // Convert felt252 to ByteArray (simplified)
                        "TOKEN"
                    } else {
                        "UNKNOWN"
                    }
                },
                Result::Err(_err) => "UNKNOWN"
            }
        }

        fn _query_token_decimals(self: @ContractState, token: ContractAddress) -> u8 {
            // Query token decimals using call_contract_syscall
            let mut call_data = array![];
            let result = call_contract_syscall(
                token,
                selector!("decimals"),
                call_data.span()
            );
            
            match result {
                Result::Ok(data) => {
                    if data.len() > 0 {
                        // Convert felt252 to u8 (simplified)
                        18
                    } else {
                        18
                    }
                },
                Result::Err(_err) => 18
            }
        }

        fn _transfer_eth(ref self: ContractState, to: ContractAddress, amount: u256) {
            let current_balance = self.eth_balance.read();
            assert(current_balance >= amount, 'Insufficient ETH balance');
            
            self.eth_balance.write(current_balance - amount);
            
            // In production, would use syscall to transfer ETH
            // For now, we simulate the transfer
        }

        fn _transfer_strk(ref self: ContractState, to: ContractAddress, amount: u256) {
            let current_balance = self.strk_balance.read();
            assert(current_balance >= amount, 'Insufficient STRK balance');
            
            self.strk_balance.write(current_balance - amount);
            
            // Transfer STRK using ERC20 transfer
            let strk_address = self._get_strk_address();
            self._call_erc20_transfer(strk_address, to, amount);
        }

        fn _transfer_erc20(
            ref self: ContractState,
            token: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) {
            let current_balance = self.token_balances.read(token);
            assert(current_balance >= amount, 'Insufficient token balance');
            
            self.token_balances.write(token, current_balance - amount);
            
            // Call ERC20 transfer
            self._call_erc20_transfer(token, to, amount);
        }

        fn _call_erc20_transfer(
            self: @ContractState,
            token: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) {
            let mut call_data = array![];
            call_data.append(to.into());
            call_data.append(amount.low.into());
            call_data.append(amount.high.into());
            
            let result = call_contract_syscall(
                token,
                selector!("transfer"),
                call_data.span()
            );
            
            match result {
                Result::Ok(_) => {},
                Result::Err(_err) => {
                    // Handle transfer failure
                    panic!("Token transfer failed");
                }
            }
        }

        fn _execute_call(
            self: @ContractState,
            to: ContractAddress,
            value: u256,
            data: Span<felt252>
        ) -> Span<felt252> {
            // Execute arbitrary contract call
            let result = call_contract_syscall(
                to,
                selector!("execute"), // Generic execute selector
                data
            );
            
            match result {
                Result::Ok(return_data) => return_data,
                Result::Err(_) => {
                    let mut error_data = array![];
                    error_data.append(0); // Error indicator
                    error_data.span()
                }
            }
        }
    }
}