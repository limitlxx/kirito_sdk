#[starknet::contract]
pub mod SecurityModule {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::num::traits::Zero;
    use starknet::storage::*;

    #[storage]
    struct Storage {
        // Access control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,
        
        // Reentrancy protection
        reentrancy_guard: bool,
        
        // Pause functionality
        paused: bool,
        
        // Rate limiting
        last_action_time: Map<ContractAddress, u64>,
        min_action_interval: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        OwnershipTransferred: OwnershipTransferred,
        AdminAdded: AdminAdded,
        AdminRemoved: AdminRemoved,
        Paused: Paused,
        Unpaused: Unpaused,
        ReentrancyAttempt: ReentrancyAttempt,
        RateLimitExceeded: RateLimitExceeded,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OwnershipTransferred {
        #[key]
        pub previous_owner: ContractAddress,
        #[key]
        pub new_owner: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdminAdded {
        #[key]
        pub admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdminRemoved {
        #[key]
        pub admin: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Paused {
        pub account: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Unpaused {
        pub account: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ReentrancyAttempt {
        pub caller: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RateLimitExceeded {
        pub caller: ContractAddress,
        pub last_action: u64,
        pub current_time: u64,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.reentrancy_guard.write(false);
        self.paused.write(false);
        self.min_action_interval.write(1); // 1 second minimum interval
    }

    #[abi(embed_v0)]
    impl SecurityImpl of crate::interfaces::ISecurity<ContractState> {
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            self._only_owner();
            assert(!new_owner.is_zero(), 'New owner cannot be zero');
            
            let previous_owner = self.owner.read();
            self.owner.write(new_owner);
            
            self.emit(OwnershipTransferred { previous_owner, new_owner });
        }

        fn add_admin(ref self: ContractState, admin: ContractAddress) {
            self._only_owner();
            assert(!admin.is_zero(), 'Admin cannot be zero');
            
            self.admins.write(admin, true);
            self.emit(AdminAdded { admin });
        }

        fn remove_admin(ref self: ContractState, admin: ContractAddress) {
            self._only_owner();
            
            self.admins.write(admin, false);
            self.emit(AdminRemoved { admin });
        }

        fn is_admin(self: @ContractState, account: ContractAddress) -> bool {
            self.admins.read(account)
        }

        fn pause(ref self: ContractState) {
            self._only_admin();
            assert(!self.paused.read(), 'Already paused');
            
            self.paused.write(true);
            self.emit(Paused { account: get_caller_address() });
        }

        fn unpause(ref self: ContractState) {
            self._only_admin();
            assert(self.paused.read(), 'Not paused');
            
            self.paused.write(false);
            self.emit(Unpaused { account: get_caller_address() });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn check_rate_limit(ref self: ContractState, account: ContractAddress) -> bool {
            let current_time = get_block_timestamp();
            let last_action = self.last_action_time.read(account);
            let min_interval = self.min_action_interval.read();
            
            if current_time < last_action + min_interval {
                self.emit(RateLimitExceeded { 
                    caller: account, 
                    last_action, 
                    current_time 
                });
                return false;
            }
            
            self.last_action_time.write(account, current_time);
            true
        }

        fn set_min_action_interval(ref self: ContractState, interval: u64) {
            self._only_owner();
            self.min_action_interval.write(interval);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Caller is not the owner');
        }

        fn _only_admin(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            let is_admin = self.admins.read(caller);
            assert(caller == owner || is_admin, 'Caller is not admin');
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

        fn _check_reentrancy_guard(ref self: ContractState) {
            if self.reentrancy_guard.read() {
                self.emit(ReentrancyAttempt { caller: get_caller_address() });
            }
        }
    }
}