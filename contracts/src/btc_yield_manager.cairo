use starknet::{ContractAddress, get_caller_address, get_contract_address};
use openzeppelin::access::ownable::OwnableComponent;
use openzeppelin::upgrades::UpgradeableComponent;
use openzeppelin::security::ReentrancyGuardComponent;

#[starknet::interface]
pub trait IBTCYieldManager<TContractState> {
    // Yield source management
    fn register_yield_source(
        ref self: TContractState,
        source_id: felt252,
        source_address: ContractAddress,
        token_address: ContractAddress,
        apy: u256
    );
    
    fn update_yield_source(
        ref self: TContractState,
        source_id: felt252,
        apy: u256,
        is_active: bool
    );
    
    fn get_yield_source(self: @TContractState, source_id: felt252) -> YieldSource;
    
    // Yield tracking
    fn track_yield(
        ref self: TContractState,
        nft_id: u256,
        source_id: felt252,
        amount: u256
    );
    
    fn calculate_yield(
        self: @TContractState,
        nft_id: u256,
        source_id: felt252,
        period: u64
    ) -> u256;
    
    fn get_total_yield(self: @TContractState, nft_id: u256) -> u256;
    
    // Yield distribution
    fn distribute_yield(
        ref self: TContractState,
        nft_ids: Array<u256>,
        amounts: Array<u256>
    );
    
    fn claim_yield(ref self: TContractState, nft_id: u256) -> u256;
    
    // Oracle integration
    fn update_conversion_rate(
        ref self: TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress,
        rate: u256
    );
    
    fn get_conversion_rate(
        self: @TContractState,
        from_token: ContractAddress,
        to_token: ContractAddress
    ) -> u256;
}

#[derive(Drop, Serde, starknet::Store)]
pub struct YieldSource {
    pub id: felt252,
    pub source_address: ContractAddress,
    pub token_address: ContractAddress,
    pub apy: u256,
    pub is_active: bool,
    pub total_deposited: u256,
    pub last_updated: u64
}

#[derive(Drop, Serde, starknet::Store)]
pub struct YieldPosition {
    pub nft_id: u256,
    pub source_id: felt252,
    pub principal: u256,
    pub accrued_yield: u256,
    pub last_claim: u64,
    pub created_at: u64
}

#[derive(Drop, Serde, starknet::Store)]
pub struct ConversionRate {
    pub from_token: ContractAddress,
    pub to_token: ContractAddress,
    pub rate: u256,
    pub last_updated: u64,
    pub oracle_address: ContractAddress
}

#[starknet::contract]
pub mod BTCYieldManager {
    use super::{IBTCYieldManager, YieldSource, YieldPosition, ConversionRate};
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address, get_block_timestamp
    };
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::security::ReentrancyGuardComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl UpgradeableImpl = UpgradeableComponent::UpgradeableImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl ReentrancyGuardImpl = ReentrancyGuardComponent::ReentrancyGuardImpl<ContractState>;
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
        
        // Yield sources
        yield_sources: LegacyMap<felt252, YieldSource>,
        active_sources: LegacyMap<u32, felt252>,
        source_count: u32,
        
        // Yield positions
        yield_positions: LegacyMap<(u256, felt252), YieldPosition>,
        nft_yield_sources: LegacyMap<u256, Array<felt252>>,
        
        // Conversion rates
        conversion_rates: LegacyMap<(ContractAddress, ContractAddress), ConversionRate>,
        
        // Oracle addresses
        authorized_oracles: LegacyMap<ContractAddress, bool>,
        
        // Total statistics
        total_yield_distributed: u256,
        total_nfts_earning: u256
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
        
        YieldSourceRegistered: YieldSourceRegistered,
        YieldSourceUpdated: YieldSourceUpdated,
        YieldTracked: YieldTracked,
        YieldDistributed: YieldDistributed,
        YieldClaimed: YieldClaimed,
        ConversionRateUpdated: ConversionRateUpdated
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldSourceRegistered {
        pub source_id: felt252,
        pub source_address: ContractAddress,
        pub token_address: ContractAddress,
        pub apy: u256
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldSourceUpdated {
        pub source_id: felt252,
        pub apy: u256,
        pub is_active: bool
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldTracked {
        pub nft_id: u256,
        pub source_id: felt252,
        pub amount: u256
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldDistributed {
        pub total_amount: u256,
        pub recipient_count: u32
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldClaimed {
        pub nft_id: u256,
        pub amount: u256,
        pub claimer: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConversionRateUpdated {
        pub from_token: ContractAddress,
        pub to_token: ContractAddress,
        pub rate: u256,
        pub oracle: ContractAddress
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.source_count.write(0);
        self.total_yield_distributed.write(0);
        self.total_nfts_earning.write(0);
    }

    #[abi(embed_v0)]
    impl BTCYieldManagerImpl of IBTCYieldManager<ContractState> {
        fn register_yield_source(
            ref self: ContractState,
            source_id: felt252,
            source_address: ContractAddress,
            token_address: ContractAddress,
            apy: u256
        ) {
            self.ownable.assert_only_owner();
            
            let yield_source = YieldSource {
                id: source_id,
                source_address,
                token_address,
                apy,
                is_active: true,
                total_deposited: 0,
                last_updated: get_block_timestamp()
            };
            
            self.yield_sources.write(source_id, yield_source);
            
            let count = self.source_count.read();
            self.active_sources.write(count, source_id);
            self.source_count.write(count + 1);
            
            self.emit(YieldSourceRegistered {
                source_id,
                source_address,
                token_address,
                apy
            });
        }

        fn update_yield_source(
            ref self: ContractState,
            source_id: felt252,
            apy: u256,
            is_active: bool
        ) {
            self.ownable.assert_only_owner();
            
            let mut source = self.yield_sources.read(source_id);
            source.apy = apy;
            source.is_active = is_active;
            source.last_updated = get_block_timestamp();
            
            self.yield_sources.write(source_id, source);
            
            self.emit(YieldSourceUpdated {
                source_id,
                apy,
                is_active
            });
        }

        fn get_yield_source(self: @ContractState, source_id: felt252) -> YieldSource {
            self.yield_sources.read(source_id)
        }

        fn track_yield(
            ref self: ContractState,
            nft_id: u256,
            source_id: felt252,
            amount: u256
        ) {
            // Verify source exists and is active
            let source = self.yield_sources.read(source_id);
            assert(source.is_active, 'Yield source not active');
            
            let position_key = (nft_id, source_id);
            let mut position = self.yield_positions.read(position_key);
            
            if position.nft_id == 0 {
                // New position
                position = YieldPosition {
                    nft_id,
                    source_id,
                    principal: amount,
                    accrued_yield: 0,
                    last_claim: get_block_timestamp(),
                    created_at: get_block_timestamp()
                };
            } else {
                // Update existing position
                position.principal += amount;
            }
            
            self.yield_positions.write(position_key, position);
            
            // Update source total
            let mut updated_source = source;
            updated_source.total_deposited += amount;
            self.yield_sources.write(source_id, updated_source);
            
            self.emit(YieldTracked {
                nft_id,
                source_id,
                amount
            });
        }

        fn calculate_yield(
            self: @ContractState,
            nft_id: u256,
            source_id: felt252,
            period: u64
        ) -> u256 {
            let position = self.yield_positions.read((nft_id, source_id));
            let source = self.yield_sources.read(source_id);
            
            if position.nft_id == 0 || !source.is_active {
                return 0;
            }
            
            // Calculate yield: principal * apy * period / (365 * 24 * 3600)
            let annual_seconds = 365 * 24 * 3600;
            let yield_amount = (position.principal * source.apy * period.into()) / (annual_seconds.into() * 10000); // APY in basis points
            
            yield_amount
        }

        fn get_total_yield(self: @ContractState, nft_id: u256) -> u256 {
            // This would iterate through all sources for the NFT
            // For now, return 0 as placeholder
            0
        }

        fn distribute_yield(
            ref self: ContractState,
            nft_ids: Array<u256>,
            amounts: Array<u256>
        ) {
            self.ownable.assert_only_owner();
            self.reentrancy_guard.start();
            
            assert(nft_ids.len() == amounts.len(), 'Array length mismatch');
            
            let mut total_distributed = 0;
            let mut i = 0;
            
            while i < nft_ids.len() {
                let nft_id = *nft_ids.at(i);
                let amount = *amounts.at(i);
                
                // Update yield for NFT (simplified)
                total_distributed += amount;
                
                i += 1;
            };
            
            let current_total = self.total_yield_distributed.read();
            self.total_yield_distributed.write(current_total + total_distributed);
            
            self.emit(YieldDistributed {
                total_amount: total_distributed,
                recipient_count: nft_ids.len()
            });
            
            self.reentrancy_guard.end();
        }

        fn claim_yield(ref self: ContractState, nft_id: u256) -> u256 {
            self.reentrancy_guard.start();
            
            let caller = get_caller_address();
            
            // Calculate claimable yield (simplified)
            let claimable_amount = 0; // Placeholder
            
            if claimable_amount > 0 {
                self.emit(YieldClaimed {
                    nft_id,
                    amount: claimable_amount,
                    claimer: caller
                });
            }
            
            self.reentrancy_guard.end();
            claimable_amount
        }

        fn update_conversion_rate(
            ref self: ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress,
            rate: u256
        ) {
            let caller = get_caller_address();
            assert(self.authorized_oracles.read(caller), 'Unauthorized oracle');
            
            let conversion_rate = ConversionRate {
                from_token,
                to_token,
                rate,
                last_updated: get_block_timestamp(),
                oracle_address: caller
            };
            
            self.conversion_rates.write((from_token, to_token), conversion_rate);
            
            self.emit(ConversionRateUpdated {
                from_token,
                to_token,
                rate,
                oracle: caller
            });
        }

        fn get_conversion_rate(
            self: @ContractState,
            from_token: ContractAddress,
            to_token: ContractAddress
        ) -> u256 {
            let rate_info = self.conversion_rates.read((from_token, to_token));
            rate_info.rate
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn authorize_oracle(ref self: ContractState, oracle: ContractAddress) {
            self.ownable.assert_only_owner();
            self.authorized_oracles.write(oracle, true);
        }

        fn revoke_oracle(ref self: ContractState, oracle: ContractAddress) {
            self.ownable.assert_only_owner();
            self.authorized_oracles.write(oracle, false);
        }
    }
}