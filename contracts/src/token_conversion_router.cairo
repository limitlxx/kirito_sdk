use starknet::ContractAddress;

#[starknet::interface]
pub trait ITokenConversionRouter<TContractState> {
    // Route management
    fn add_conversion_route(
        ref self: TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        bridge_address: ContractAddress,
        fee_rate: u256
    );
    
    fn remove_conversion_route(
        ref self: TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        bridge_address: ContractAddress
    );
    
    fn get_best_route(
        self: @TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        amount: u256
    ) -> ConversionRoute;
    
    // Conversion execution
    fn execute_conversion(
        ref self: TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        amount: u256,
        min_output: u256,
        recipient: ContractAddress
    ) -> u256;
    
    fn execute_multi_hop_conversion(
        ref self: TContractState,
        route: Array<ContractAddress>,
        amount: u256,
        min_output: u256,
        recipient: ContractAddress
    ) -> u256;
    
    // Rate queries
    fn get_conversion_rate(
        self: @TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        amount: u256
    ) -> u256;
    
    fn get_multi_hop_rate(
        self: @TContractState,
        route: Array<ContractAddress>,
        amount: u256
    ) -> u256;
    
    // Slippage protection
    fn set_max_slippage(ref self: TContractState, slippage_bps: u256);
    fn get_max_slippage(self: @TContractState) -> u256;
}

#[derive(Drop, Serde)]
pub struct ConversionRoute {
    pub from_token: ContractAddress,
    pub to_token: ContractAddress,
    pub bridge_address: ContractAddress,
    pub expected_output: u256,
    pub fee_amount: u256,
    pub price_impact: u256,
    pub is_multi_hop: bool,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct BridgeInfo {
    pub bridge_address: ContractAddress,
    pub fee_rate: u256, // in basis points
    pub is_active: bool,
    pub total_volume: u256,
    pub last_updated: u64
}

#[derive(Drop, Serde, starknet::Store)]
pub struct ConversionPair {
    pub from_token: ContractAddress,
    pub to_token: ContractAddress,
    pub is_supported: bool
}

#[starknet::contract]
pub mod TokenConversionRouter {
    use super::{ITokenConversionRouter, ConversionRoute, BridgeInfo, ConversionPair};
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address, get_block_timestamp
    };
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::security::ReentrancyGuardComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};


    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Component storage
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        
        // Conversion routes
        bridge_info: Map<ContractAddress, BridgeInfo>,
        pair_bridges: Map<(ContractAddress, ContractAddress), ContractAddress>, // Simplified: one bridge per pair
        
        // Route optimization
        supported_tokens: Map<ContractAddress, bool>,
        token_count: u32,
        
        // Slippage protection
        max_slippage_bps: u256,
        
        // Statistics
        total_conversions: u256,
        total_volume: u256
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        
        ConversionRouteAdded: ConversionRouteAdded,
        ConversionRouteRemoved: ConversionRouteRemoved,
        ConversionExecuted: ConversionExecuted,
        MultiHopConversionExecuted: MultiHopConversionExecuted,
        SlippageUpdated: SlippageUpdated
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConversionRouteAdded {
        pub from_token: ContractAddress,
        pub to_token: ContractAddress,
        pub bridge_address: ContractAddress,
        pub fee_rate: u256
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConversionRouteRemoved {
        pub from_token: ContractAddress,
        pub to_token: ContractAddress,
        pub bridge_address: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConversionExecuted {
        pub from_token: ContractAddress,
        pub to_token: ContractAddress,
        pub amount_in: u256,
        pub amount_out: u256,
        pub recipient: ContractAddress,
        pub bridge_used: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    pub struct MultiHopConversionExecuted {
        pub route: Array<ContractAddress>,
        pub amount_in: u256,
        pub amount_out: u256,
        pub recipient: ContractAddress,
        pub hops: u32
    }

    #[derive(Drop, starknet::Event)]
    pub struct SlippageUpdated {
        pub old_slippage: u256,
        pub new_slippage: u256
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.max_slippage_bps.write(500); // 5% default max slippage
        self.token_count.write(0);
        self.total_conversions.write(0);
        self.total_volume.write(0);
    }

    #[abi(embed_v0)]
    impl TokenConversionRouterImpl of ITokenConversionRouter<ContractState> {
        fn add_conversion_route(
            ref self: ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            bridge_address: ContractAddress,
            fee_rate: u256
        ) {
            self.ownable.assert_only_owner();
            
            // Add bridge info
            let bridge_info = BridgeInfo {
                bridge_address,
                fee_rate,
                is_active: true,
                total_volume: 0,
                last_updated: get_block_timestamp()
            };
            self.bridge_info.write(bridge_address, bridge_info);
            
            // Update conversion pair
            let pair_key = (from_token, to_token);
            let _pair = ConversionPair {
                from_token,
                to_token,
                is_supported: true
            };
            
            self.supported_tokens.write(from_token, true);
            self.supported_tokens.write(to_token, true);
            self.pair_bridges.write(pair_key, bridge_address);
            
            self.emit(ConversionRouteAdded {
                from_token,
                to_token,
                bridge_address,
                fee_rate
            });
        }

        fn remove_conversion_route(
            ref self: ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            bridge_address: ContractAddress
        ) {
            self.ownable.assert_only_owner();
            
            // Deactivate bridge
            let mut bridge_info = self.bridge_info.read(bridge_address);
            bridge_info.is_active = false;
            self.bridge_info.write(bridge_address, bridge_info);
            
            self.emit(ConversionRouteRemoved {
                from_token,
                to_token,
                bridge_address
            });
        }

        fn get_best_route(
            self: @ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            amount: u256
        ) -> ConversionRoute {
            assert(self.supported_tokens.read(from_token), 'From token not supported');
            assert(self.supported_tokens.read(to_token), 'To token not supported');
            
            // Get the bridge for this pair
            let bridge_address = self.pair_bridges.read((from_token, to_token));
            let bridge_info = self.bridge_info.read(bridge_address);
            
            let fee_amount = (amount * bridge_info.fee_rate) / 10000;
            let expected_output = amount - fee_amount;
            
            ConversionRoute {
                from_token,
                to_token,
                bridge_address,
                expected_output,
                fee_amount,
                price_impact: 0, // Simplified
                is_multi_hop: false,
            }
        }

        fn execute_conversion(
            ref self: ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            amount: u256,
            min_output: u256,
            recipient: ContractAddress
        ) -> u256 {
            self.reentrancy_guard.start();
            
            let caller = get_caller_address();
            
            // Get best route
            let route = self.get_best_route(from_token, to_token, amount);
            
            // Check slippage
            assert(route.expected_output >= min_output, 'Slippage too high');
            
            // Transfer tokens from caller
            let from_token_dispatcher = IERC20Dispatcher { contract_address: from_token };
            from_token_dispatcher.transfer_from(caller, get_contract_address(), amount);
            
            // Execute conversion through bridge (simplified)
            let actual_output = route.expected_output; // In real implementation, call bridge
            
            // Transfer output tokens to recipient
            let to_token_dispatcher = IERC20Dispatcher { contract_address: to_token };
            to_token_dispatcher.transfer(recipient, actual_output);
            
            // Update statistics
            let current_conversions = self.total_conversions.read();
            let current_volume = self.total_volume.read();
            self.total_conversions.write(current_conversions + 1);
            self.total_volume.write(current_volume + amount);
            
            self.emit(ConversionExecuted {
                from_token,
                to_token,
                amount_in: amount,
                amount_out: actual_output,
                recipient,
                bridge_used: route.bridge_address
            });
            
            self.reentrancy_guard.end();
            actual_output
        }

        fn execute_multi_hop_conversion(
            ref self: ContractState,
            route: Array<ContractAddress>,
            amount: u256,
            min_output: u256,
            recipient: ContractAddress
        ) -> u256 {
            self.reentrancy_guard.start();
            
            assert(route.len() >= 2, 'Route too short');
            
            let mut current_amount = amount;
            let mut i = 0;
            
            // Execute each hop
            while i < route.len() - 1 {
                let from_token = *route.at(i);
                let to_token = *route.at(i + 1);
                
                // For last hop, send to recipient; otherwise to contract
                let hop_recipient = if i == route.len() - 2 {
                    recipient
                } else {
                    get_contract_address()
                };
                
                current_amount = self.execute_conversion(
                    from_token,
                    to_token,
                    current_amount,
                    0, // No slippage check on intermediate hops
                    hop_recipient
                );
                
                i += 1;
            };
            
            // Check final slippage
            assert(current_amount >= min_output, 'Multi-hop slippage too high');
            
            self.emit(MultiHopConversionExecuted {
                route: route.clone(),
                amount_in: amount,
                amount_out: current_amount,
                recipient,
                hops: route.len() - 1
            });
            
            self.reentrancy_guard.end();
            current_amount
        }

        fn get_conversion_rate(
            self: @ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            amount: u256
        ) -> u256 {
            let route = self.get_best_route(from_token, to_token, amount);
            route.expected_output
        }

        fn get_multi_hop_rate(
            self: @ContractState,
            route: Array<ContractAddress>,
            amount: u256
        ) -> u256 {
            let mut current_amount = amount;
            let mut i = 0;
            
            while i < route.len() - 1 {
                let from_token = *route.at(i);
                let to_token = *route.at(i + 1);
                
                current_amount = self.get_conversion_rate(from_token, to_token, current_amount);
                i += 1;
            };
            
            current_amount
        }

        fn set_max_slippage(ref self: ContractState, slippage_bps: u256) {
            self.ownable.assert_only_owner();
            
            let old_slippage = self.max_slippage_bps.read();
            self.max_slippage_bps.write(slippage_bps);
            
            self.emit(SlippageUpdated {
                old_slippage,
                new_slippage: slippage_bps
            });
        }

        fn get_max_slippage(self: @ContractState) -> u256 {
            self.max_slippage_bps.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        fn get_bridge_count(self: @ContractState, from_token: ContractAddress, to_token: ContractAddress) -> u32 {
            let is_supported = self.supported_tokens.read(from_token) && self.supported_tokens.read(to_token);
            if is_supported { 1 } else { 0 }
        }
    }
}