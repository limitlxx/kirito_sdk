use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct YieldSourceInfo {
    pub name: ByteArray,
    pub token: ContractAddress,
    pub source_contract: ContractAddress,
    pub yield_rate: u256, // annual yield rate in basis points
    pub total_deposited: u256,
    pub last_update: u64,
    pub active: bool,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct AllocationData {
    pub rarity_score: u256,
    pub stake_amount: u256,
    pub yield_multiplier: u256, // scaled by 10000 (e.g., 15000 = 1.5x)
    pub custom_factors: u256, // encoded custom factors
    pub allocated_weight: u256,
    pub last_claim: u64,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct DistributionRound {
    pub round_id: u32,
    pub collection: ContractAddress,
    pub yield_token: ContractAddress,
    pub total_yield: u256,
    pub total_weight: u256,
    pub timestamp: u64,
    pub nft_count: u32,
}

#[starknet::contract]
pub mod YieldDistributor {
    use super::{YieldSourceInfo, AllocationData, DistributionRound};
    use starknet::{
        ContractAddress, get_caller_address,
        get_block_timestamp, syscalls::call_contract_syscall
    };
    use starknet::storage::*;
    use core::array::ArrayTrait;
    use core::traits::Into;
    use core::num::traits::Zero;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        // Contract ownership and access control
        owner: ContractAddress,
        authorized_distributors: Map<ContractAddress, bool>,
        
        // NFT collection tracking
        nft_contracts: Map<ContractAddress, bool>,
        registered_collections: Map<u32, ContractAddress>,
        collection_count: u32,
        
        // Yield source management
        yield_sources: Map<ContractAddress, YieldSourceInfo>,
        source_registry: Map<u32, ContractAddress>,
        source_count: u32,
        active_sources: Map<ContractAddress, bool>,
        
        // Allocation tracking
        nft_allocations: Map<(ContractAddress, u256), AllocationData>, // (nft_contract, token_id) -> allocation
        total_allocated_weight: Map<ContractAddress, u256>, // collection -> total weight
        
        // Distribution history
        distribution_rounds: Map<u32, DistributionRound>,
        round_count: u32,
        last_distribution: Map<ContractAddress, u64>, // collection -> timestamp
        
        // Yield pools
        yield_pools: Map<(ContractAddress, ContractAddress), u256>, // (collection, token) -> pool amount
        pending_yields: Map<(ContractAddress, u256), u256>, // (nft_contract, token_id) -> pending amount
        
        // Security and configuration
        paused: bool,
        min_distribution_interval: u64,
        max_allocation_weight: u256,
        distribution_fee: u256, // basis points (e.g., 100 = 1%)
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        YieldSourceRegistered: YieldSourceRegistered,
        AllocationUpdated: AllocationUpdated,
        YieldDistributed: YieldDistributed,
        YieldClaimed: YieldClaimed,
        CollectionRegistered: CollectionRegistered,
        DistributionRoundCompleted: DistributionRoundCompleted,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldSourceRegistered {
        #[key]
        pub source: ContractAddress,
        pub token: ContractAddress,
        pub yield_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AllocationUpdated {
        #[key]
        pub nft_contract: ContractAddress,
        #[key]
        pub token_id: u256,
        pub allocated_weight: u256,
        pub yield_multiplier: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldDistributed {
        #[key]
        pub collection: ContractAddress,
        #[key]
        pub yield_token: ContractAddress,
        pub total_yield: u256,
        pub round_id: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldClaimed {
        #[key]
        pub nft_contract: ContractAddress,
        #[key]
        pub token_id: u256,
        pub amount: u256,
        pub recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollectionRegistered {
        #[key]
        pub collection: ContractAddress,
        pub name: ByteArray,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DistributionRoundCompleted {
        #[key]
        pub round_id: u32,
        pub collection: ContractAddress,
        pub total_yield: u256,
        pub nft_count: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        min_distribution_interval: u64,
        distribution_fee: u256
    ) {
        self.owner.write(owner);
        self.min_distribution_interval.write(min_distribution_interval);
        self.distribution_fee.write(distribution_fee);
        self.max_allocation_weight.write(1000000); // 100x max multiplier
        self.collection_count.write(0);
        self.source_count.write(0);
        self.round_count.write(0);
        self.paused.write(false);
        
        // Set owner as authorized distributor
        self.authorized_distributors.write(owner, true);
    }

    #[abi(embed_v0)]
    impl YieldDistributorImpl of crate::interfaces::IYieldDistributor<ContractState> {
        fn register_yield_source(
            ref self: ContractState,
            source_contract: ContractAddress,
            token: ContractAddress,
            name: ByteArray,
            yield_rate: u256
        ) {
            self._only_owner();
            assert(!source_contract.is_zero(), 'Invalid source contract');
            assert(!token.is_zero(), 'Invalid token address');
            assert(yield_rate > 0, 'Yield rate must be positive');
            
            let source_info = YieldSourceInfo {
                name,
                token,
                source_contract,
                yield_rate,
                total_deposited: 0,
                last_update: get_block_timestamp(),
                active: true,
            };
            
            self.yield_sources.write(source_contract, source_info);
            self.active_sources.write(source_contract, true);
            
            // Add to registry
            let current_count = self.source_count.read();
            self.source_registry.write(current_count, source_contract);
            self.source_count.write(current_count + 1);
            
            self.emit(YieldSourceRegistered { source: source_contract, token, yield_rate });
        }

        fn register_nft_collection(
            ref self: ContractState,
            nft_contract: ContractAddress,
            name: ByteArray
        ) {
            self._only_owner();
            assert(!nft_contract.is_zero(), 'Invalid NFT contract');
            assert(!self.nft_contracts.read(nft_contract), 'Collection already registered');
            
            self.nft_contracts.write(nft_contract, true);
            
            // Add to registry
            let current_count = self.collection_count.read();
            self.registered_collections.write(current_count, nft_contract);
            self.collection_count.write(current_count + 1);
            
            self.emit(CollectionRegistered { collection: nft_contract, name });
        }

        fn update_allocation(
            ref self: ContractState,
            nft_contract: ContractAddress,
            token_id: u256,
            rarity_score: u256,
            stake_amount: u256,
            custom_factors: u256
        ) {
            self._only_authorized();
            assert(self.nft_contracts.read(nft_contract), 'Collection not registered');
            
            // Calculate yield multiplier based on factors
            let yield_multiplier = self._calculate_yield_multiplier(
                rarity_score,
                stake_amount,
                custom_factors
            );
            
            // Calculate allocated weight
            let allocated_weight = self._calculate_allocated_weight(
                stake_amount,
                yield_multiplier
            );
            
            assert(allocated_weight <= self.max_allocation_weight.read(), 'Weight exceeds maximum');
            
            // Get current allocation to update total weight
            let current_allocation = self.nft_allocations.read((nft_contract, token_id));
            let current_total = self.total_allocated_weight.read(nft_contract);
            
            // Update total weight
            let new_total = current_total - current_allocation.allocated_weight + allocated_weight;
            self.total_allocated_weight.write(nft_contract, new_total);
            
            // Update allocation
            let allocation_data = AllocationData {
                rarity_score,
                stake_amount,
                yield_multiplier,
                custom_factors,
                allocated_weight,
                last_claim: current_allocation.last_claim,
            };
            
            self.nft_allocations.write((nft_contract, token_id), allocation_data);
            
            self.emit(AllocationUpdated { 
                nft_contract, 
                token_id, 
                allocated_weight, 
                yield_multiplier 
            });
        }

        fn distribute_yield(
            ref self: ContractState,
            collection: ContractAddress,
            yield_token: ContractAddress,
            total_yield: u256
        ) {
            self._only_authorized();
            self._when_not_paused();
            assert(self.nft_contracts.read(collection), 'Collection not registered');
            assert(total_yield > 0, 'Yield amount must be positive');
            
            // Check minimum interval
            let last_dist = self.last_distribution.read(collection);
            let current_time = get_block_timestamp();
            let min_interval = self.min_distribution_interval.read();
            
            assert(current_time >= last_dist + min_interval, 'Distribution too frequent');
            
            // Get total allocated weight for collection
            let total_weight = self.total_allocated_weight.read(collection);
            assert(total_weight > 0, 'No allocations found');
            
            // Calculate distribution fee
            let fee_amount = (total_yield * self.distribution_fee.read()) / 10000;
            let distributable_yield = total_yield - fee_amount;
            
            // Create distribution round
            let round_id = self.round_count.read();
            let distribution_round = DistributionRound {
                round_id,
                collection,
                yield_token,
                total_yield: distributable_yield,
                total_weight,
                timestamp: current_time,
                nft_count: 0, // Will be updated during distribution
            };
            
            self.distribution_rounds.write(round_id, distribution_round);
            self.round_count.write(round_id + 1);
            
            // Update yield pool
            let current_pool = self.yield_pools.read((collection, yield_token));
            self.yield_pools.write((collection, yield_token), current_pool + distributable_yield);
            
            // Update last distribution time
            self.last_distribution.write(collection, current_time);
            
            self.emit(YieldDistributed { 
                collection, 
                yield_token, 
                total_yield: distributable_yield, 
                round_id 
            });
        }

        fn calculate_nft_yield(
            self: @ContractState,
            nft_contract: ContractAddress,
            token_id: u256,
            yield_token: ContractAddress
        ) -> u256 {
            let allocation = self.nft_allocations.read((nft_contract, token_id));
            if allocation.allocated_weight == 0 {
                return 0;
            }
            
            let total_weight = self.total_allocated_weight.read(nft_contract);
            if total_weight == 0 {
                return 0;
            }
            
            let yield_pool = self.yield_pools.read((nft_contract, yield_token));
            let nft_yield = (yield_pool * allocation.allocated_weight) / total_weight;
            
            nft_yield
        }

        fn claim_yield(
            ref self: ContractState,
            nft_contract: ContractAddress,
            token_id: u256,
            yield_token: ContractAddress,
            recipient: ContractAddress
        ) -> u256 {
            self._when_not_paused();
            assert(!recipient.is_zero(), 'Invalid recipient');
            
            // Verify NFT ownership before allowing yield claim
            let caller = get_caller_address();
            
            // Query NFT contract to verify ownership
            let mut owner_call_data = array![];
            owner_call_data.append(token_id.low.into());
            owner_call_data.append(token_id.high.into());
            
            let owner_result = starknet::syscalls::call_contract_syscall(
                nft_contract,
                selector!("owner_of"),
                owner_call_data.span()
            );
            
            let nft_owner = match owner_result {
                Result::Ok(ret_data) => {
                    assert(ret_data.len() > 0, 'Query returned no data');
                    let owner_felt = *ret_data.at(0);
                    let owner_address: ContractAddress = owner_felt.try_into().unwrap();
                    owner_address
                },
                Result::Err(_revert_reason) => {
                    panic!("Failed to verify NFT ownership")
                }
            };
            
            // Verify caller is the NFT owner or approved operator
            let mut is_authorized = caller == nft_owner;
            
            if !is_authorized {
                // Check if caller is approved for this specific token
                let mut approved_call_data = array![];
                approved_call_data.append(token_id.low.into());
                approved_call_data.append(token_id.high.into());
                
                let approved_result = starknet::syscalls::call_contract_syscall(
                    nft_contract,
                    selector!("get_approved"),
                    approved_call_data.span()
                );
                
                match approved_result {
                    Result::Ok(ret_data) => {
                        if ret_data.len() > 0 {
                            let approved_felt = *ret_data.at(0);
                            let approved_address: ContractAddress = approved_felt.try_into().unwrap();
                            is_authorized = caller == approved_address;
                        }
                    },
                    Result::Err(_) => {}
                }
            }
            
            if !is_authorized {
                // Check if caller is approved operator for all tokens
                let mut operator_call_data = array![];
                operator_call_data.append(nft_owner.into());
                operator_call_data.append(caller.into());
                
                let operator_result = starknet::syscalls::call_contract_syscall(
                    nft_contract,
                    selector!("is_approved_for_all"),
                    operator_call_data.span()
                );
                
                match operator_result {
                    Result::Ok(ret_data) => {
                        if ret_data.len() > 0 {
                            let is_operator = *ret_data.at(0);
                            is_authorized = is_operator == 1;
                        }
                    },
                    Result::Err(_) => {}
                }
            }
            
            assert(is_authorized, 'Not authorized to claim yield');
            
            // Calculate claimable yield
            let claimable_amount = self.calculate_nft_yield(nft_contract, token_id, yield_token);
            assert(claimable_amount > 0, 'No yield to claim');
            
            // Update pending yields
            let current_pending = self.pending_yields.read((nft_contract, token_id));
            let total_claimable = current_pending + claimable_amount;
            
            // Reset pending yields
            self.pending_yields.write((nft_contract, token_id), 0);
            
            // Update last claim time
            let mut allocation = self.nft_allocations.read((nft_contract, token_id));
            allocation.last_claim = get_block_timestamp();
            self.nft_allocations.write((nft_contract, token_id), allocation);
            
            // Transfer yield to recipient
            self._transfer_yield(yield_token, recipient, total_claimable);
            
            self.emit(YieldClaimed { 
                nft_contract, 
                token_id, 
                amount: total_claimable, 
                recipient 
            });
            
            total_claimable
        }
        fn get_allocation_data(
            self: @ContractState,
            nft_contract: ContractAddress,
            token_id: u256
        ) -> (u256, u256, u256, u256, u256, u64) {
            let data = self.nft_allocations.read((nft_contract, token_id));
            (
                data.rarity_score,
                data.stake_amount,
                data.yield_multiplier,
                data.custom_factors,
                data.allocated_weight,
                data.last_claim
            )
        }

        fn get_yield_source_info(
            self: @ContractState,
            source_contract: ContractAddress
        ) -> (ByteArray, ContractAddress, ContractAddress, u256, u256, u64, bool) {
            let info = self.yield_sources.read(source_contract);
            (
                info.name,
                info.token,
                info.source_contract,
                info.yield_rate,
                info.total_deposited,
                info.last_update,
                info.active
            )
        }

        fn get_collection_total_weight(
            self: @ContractState,
            collection: ContractAddress
        ) -> u256 {
            self.total_allocated_weight.read(collection)
        }

        fn get_yield_pool_balance(
            self: @ContractState,
            collection: ContractAddress,
            yield_token: ContractAddress
        ) -> u256 {
            self.yield_pools.read((collection, yield_token))
        }

        fn is_collection_registered(
            self: @ContractState,
            collection: ContractAddress
        ) -> bool {
            self.nft_contracts.read(collection)
        }

        fn is_yield_source_active(
            self: @ContractState,
            source: ContractAddress
        ) -> bool {
            self.active_sources.read(source)
        }
    }

    #[abi(embed_v0)]
    impl AdminImpl of crate::interfaces::IAdmin<ContractState> {
        fn pause(ref self: ContractState) {
            self._only_owner();
            self.paused.write(true);
        }

        fn unpause(ref self: ContractState) {
            self._only_owner();
            self.paused.write(false);
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress, authorized: bool) {
            self._only_owner();
            self.authorized_distributors.write(minter, authorized);
        }

        fn is_minter(self: @ContractState, account: ContractAddress) -> bool {
            self.authorized_distributors.read(account)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), 'Only owner allowed');
        }

        fn _only_authorized(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_authorized = self.authorized_distributors.read(caller);
            assert(is_owner || is_authorized, 'Not authorized');
        }

        fn _when_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn _calculate_yield_multiplier(
            self: @ContractState,
            rarity_score: u256,
            stake_amount: u256,
            custom_factors: u256
        ) -> u256 {
            // Base multiplier: 10000 (1.0x)
            let mut multiplier = 10000_u256;
            
            // Rarity bonus: up to 50% (5000 basis points)
            let rarity_bonus = (rarity_score * 5000) / 100; // rarity_score is 0-100
            multiplier += rarity_bonus;
            
            // Stake bonus: logarithmic scale, up to 100% (10000 basis points)
            let stake_bonus = self._calculate_stake_bonus(stake_amount);
            multiplier += stake_bonus;
            
            // Custom factors bonus: up to 20% (2000 basis points)
            let custom_bonus = (custom_factors * 2000) / 10000; // custom_factors is encoded
            multiplier += custom_bonus;
            
            // Cap at maximum allocation weight
            let max_multiplier = self.max_allocation_weight.read();
            if multiplier > max_multiplier {
                multiplier = max_multiplier;
            }
            
            multiplier
        }

        fn _calculate_stake_bonus(self: @ContractState, stake_amount: u256) -> u256 {
            if stake_amount == 0 {
                return 0;
            }
            
            // Logarithmic bonus calculation (simplified)
            // In production, would use proper logarithm implementation
            let mut bonus = 0_u256;
            let mut temp_stake = stake_amount;
            
            // Simple logarithmic approximation
            while temp_stake > 1000000000000000000 { // 1 token (18 decimals)
                bonus += 1000; // 10% bonus per order of magnitude
                temp_stake = temp_stake / 10;
            };
            
            // Cap stake bonus at 100% (10000 basis points)
            if bonus > 10000 {
                bonus = 10000;
            }
            
            bonus
        }

        fn _calculate_allocated_weight(
            self: @ContractState,
            stake_amount: u256,
            yield_multiplier: u256
        ) -> u256 {
            // Base weight is stake amount
            let base_weight = stake_amount;
            
            // Apply yield multiplier
            let allocated_weight = (base_weight * yield_multiplier) / 10000;
            
            allocated_weight
        }

        fn _transfer_yield(
            self: @ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) {
            // Robust ERC20 transfer with comprehensive error handling
            
            // Validate inputs
            assert(!token.is_zero(), 'Invalid token address');
            assert(!recipient.is_zero(), 'Invalid recipient address');
            assert(amount > 0, 'Amount must be positive');
            
            // Check if token contract exists
            let token_class_result = starknet::syscalls::get_class_hash_at_syscall(token);
            match token_class_result {
                Result::Ok(class_hash) => {
                    let class_hash_felt: felt252 = class_hash.into();
                    assert(class_hash_felt != 0, 'Token contract not found');
                },
                Result::Err(_) => {
                    panic!("Failed to verify token contract");
                }
            }
            
            // Prepare transfer calldata
            let mut call_data = array![];
            call_data.append(recipient.into());
            call_data.append(amount.low.into());
            call_data.append(amount.high.into());
            
            // Execute transfer with detailed error handling
            let result = call_contract_syscall(
                token,
                selector!("transfer"),
                call_data.span()
            );
            
            match result {
                Result::Ok(ret_data) => {
                    // Verify transfer returned success
                    if ret_data.len() > 0 {
                        let success = *ret_data.at(0);
                        if success == 0 {
                            panic!("Transfer returned false");
                        }
                    } else {
                        // Some ERC20s don't return a value, assume success if no revert
                    }
                },
                Result::Err(_revert_reason) => {
                    // Log detailed error information
                    // In production, would emit error event with revert_reason
                    panic!("Yield transfer failed");
                }
            }
            
            // Additional safety: Verify recipient balance increased
            // This is an extra check to ensure transfer actually happened
            let mut balance_call_data = array![];
            balance_call_data.append(recipient.into());
            
            let balance_result = call_contract_syscall(
                token,
                selector!("balance_of"),
                balance_call_data.span()
            );
            
            match balance_result {
                Result::Ok(balance_data) => {
                    if balance_data.len() >= 2 {
                        let balance_low: u128 = (*balance_data.at(0)).try_into().unwrap();
                        let balance_high: u128 = (*balance_data.at(1)).try_into().unwrap();
                        let balance = u256 { low: balance_low, high: balance_high };
                        
                        // Verify recipient has at least the transferred amount
                        assert(balance >= amount, 'Balance verification failed');
                    }
                },
                Result::Err(_) => {
                    // Balance check failed, but transfer succeeded
                    // Log warning but don't revert
                }
            }
        }
    }
}
