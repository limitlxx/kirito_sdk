# Implementation Plan: Kirito SDK

## Overview

This implementation plan converts the Kirito SDK design into discrete coding tasks using TypeScript for the SDK components and Cairo for smart contracts. The plan follows an incremental approach, building core functionality first, then adding privacy features, and finally integrating all components. Each task builds on previous work to ensure a cohesive, working system.

## Critical Gaps Identified

The following areas require production implementation to replace mock/placeholder code:

1. **BTC/WBTC Yield Integration**: Minting flow needs BTC yield source selection and wallet conversion
2. **Wallet Allocation Logic**: Yield distribution based on rarity and custom allocation factors
3. **Bitcoin Bridge Integration**: LayerSwap, Garden Finance, and Xverse bridge implementations
4. **Real DeFi Protocol Integration**: Vesu, Ekubo, Atomiq API integrations (currently mocked)
5. **Tongo Protocol Integration**: Complete Tongo SDK integration for shielded transactions
6. **Cairo Smart Contracts**: Missing yield distributor, BTC bridge, and allocation contracts
7. **Garaga-Noir Integration**: Complete mystery box circuit compilation and verification
8. **Demo Application**: React dApp with Scaffold-Stark

## Tasks

- [x] 1. Project Setup and Core Infrastructure                        
  - Initialize TypeScript SDK project with proper build configuration
  - Set up Cairo smart contract development environment with Starknet Foundry
  - Configure IPFS integration and testing infrastructure
  - Create base interfaces and type definitions for all components
  - _Requirements: 6.1, 6.4_

- [x] 1.1 Write property test for project structure
  - **Property 15: Cross-Network Deployment**
  - **Validates: Requirements 6.2**

- [x] 2. Generation Engine Implementation
  - [x] 2.1 Implement HashLips Art Engine integration
    - Fork and adapt HashLips engine for privacy-enhanced metadata
    - Add support for custom fields (yieldMultiplier, rarityScore, semaphoreGroupId)
    - Implement rarity calculation algorithms
    - _Requirements: 1.1, 1.3, 1.5_

  - [x] 2.2 Write property test for NFT generation consistency
    - **Property 1: NFT Generation Consistency**
    - **Validates: Requirements 1.1, 1.3, 1.5**

  - [x] 2.3 Implement IPFS upload functionality
    - Create IPFS client integration for image and metadata upload
    - Implement batch upload optimization for large collections
    - Add retry logic and error handling for network issues
    - _Requirements: 1.2_

  - [x] 2.4 Write property test for IPFS upload completeness
    - **Property 2: IPFS Upload Completeness**
    - **Validates: Requirements 1.2**

  - [x] 2.5 Implement hidden trait encryption
    - Create encryption/decryption functions for mystery box traits
    - Implement key generation and management
    - Add support for selective trait hiding
    - _Requirements: 1.4_

  - [x] 2.6 Write property test for hidden trait encryption
    - **Property 3: Hidden Trait Encryption Round-Trip**
    - **Validates: Requirements 1.4**

- [x] 3. Smart Contract Foundation
  - [x] 3.1 Implement base ERC-721 contract with account abstraction
    - Create Cairo ERC-721 contract with UUPS proxy pattern
    - Implement ERC-4337 account abstraction extensions
    - Add wallet functionality for token storage and transfers
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 3.2 Write property test for NFT wallet deployment
    - **Property 4: NFT Wallet Deployment**
    - **Validates: Requirements 2.1, 2.3, 6.5**

  - [x] 3.3 Write property test for proxy contract upgradeability
    - **Property 19: Proxy Contract Upgradeability**
    - **Validates: Requirements 2.5**

  - [x] 3.4 Implement OpenZeppelin security patterns
    - Integrate OpenZeppelin Cairo contracts for security
    - Add access control and reentrancy protection
    - Implement safe upgrade mechanisms
    - _Requirements: 7.5_

  - [x] 3.5 Write property test for security compliance
    - **Property 18: OpenZeppelin Security Compliance**
    - **Validates: Requirements 7.5**

- [x] 4. Checkpoint - Core Infrastructure Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. SDK Component Implementation
  - [x] 5.1 Implement NFT Wallet SDK component
    - Create TypeScript implementation of NFTWallet interface
    - Integrate with deployed Cairo contracts
    - Add wallet connection and transaction handling
    - _Requirements: 2.1, 2.3, 6.5_

  - [x] 5.2 Implement Shielded Pool SDK component
    - Create TypeScript implementation of ShieldedPoolManager interface
    - Add placeholder for Tongo protocol integration
    - Implement basic staking and yield tracking
    - _Requirements: 2.2, 7.4_

  - [x] 5.3 Implement Mystery Box SDK component
    - Create TypeScript implementation of MysteryBoxManager interface
    - Integrate with hidden trait encryption system
    - Add reveal condition management
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.4 Implement Anonymous Governance SDK component
    - Create TypeScript implementation of AnonymousGovernance interface
    - Add placeholder for Semaphore protocol integration
    - Implement basic proposal and voting system
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.5 Integrate all components into main KiritoSDK class
    - Wire up all component implementations in the main SDK
    - Implement proper initialization and error handling
    - Add comprehensive health checks
    - _Requirements: 6.1, 6.3_

- [x] 6. Tongo Shielded Pool Integration
  - [x] 6.1 Implement Tongo SDK integration
    - Integrate Tongo protocol for shielded staking
    - Implement deposit and withdrawal functionality
    - Add encrypted balance management
    - _Requirements: 2.2, 7.4_

  - [x] 6.2 Write property test for shielded staking privacy
    - **Property 5: Shielded Staking Privacy**
    - **Validates: Requirements 2.2, 7.4**

  - [x] 6.3 Implement stealth address generation
    - Create stealth address generation for private transfers
    - Implement address derivation and recovery
    - Add integration with NFT wallet transfers
    - _Requirements: 7.1_

  - [x] 6.4 Write property test for stealth address privacy
    - **Property 16: Stealth Address Privacy**
    - **Validates: Requirements 7.1**

- [-] 7. Yield Distribution System
  - [x] 7.1 Implement yield calculation engine
    - Create proportional yield calculation based on stake and rarity
    - Implement multi-source yield aggregation
    - Add support for DeFi and RWA oracle integration
    - _Requirements: 3.1, 3.4, 3.5_

  - [x] 7.2 Write property test for yield distribution proportionality
    - **Property 7: Yield Distribution Proportionality**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 7.3 Write property test for multi-source yield integration
    - **Property 9: Multi-Source Yield Integration**
    - **Validates: Requirements 3.4, 3.5**

  - [x] 7.4 Implement zero-knowledge yield claiming
    - Create ZK proof generation for yield eligibility
    - Implement proof verification without revealing balances
    - Add automatic yield deposit to NFT wallets
    - _Requirements: 3.2, 3.3, 7.3_

  - [x] 7.5 Write property test for zero-knowledge yield claims
    - **Property 8: Zero-Knowledge Yield Claims**
    - **Validates: Requirements 3.3, 7.3**

- [-] 8. Sealed-Bid Auction System
  - [x] 8.1 Implement sealed-bid auction mechanics
    - Create bid commitment and reveal phases
    - Implement winner determination algorithm
    - Add auction state management and timing
    - _Requirements: 2.4_

  - [x] 8.2 Write property test for sealed-bid auction integrity
    - **Property 6: Sealed-Bid Auction Integrity**
    - **Validates: Requirements 2.4**

- [ ] 9. Checkpoint - Privacy and Yield Systems Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Mystery Box Implementation
  - [x] 10.1 Implement Noir circuit for mystery box reveals
    - Create Noir circuits for trait hiding and revealing
    - Implement reveal condition checking (time-lock, user actions)
    - Add bluffing mechanism for partial reveals
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 10.2 Write property test for mystery box hiding mechanism
    - **Property 10: Mystery Box Hiding Mechanism**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 10.3 Write property test for bluffing mechanism privacy
    - **Property 12: Bluffing Mechanism Privacy**
    - **Validates: Requirements 4.4**

  - [x] 10.4 Implement Garaga on-chain verifier integration
    - Integrate Garaga for on-chain proof verification
    - Create verifier contracts for mystery box reveals
    - Add proof validation and state updates
    - _Requirements: 4.5_

  - [x] 10.5 Write property test for ZK reveal proof verification
    - **Property 11: ZK Reveal Proof Verification**
    - **Validates: Requirements 4.2, 4.5**

- [-] 11. Semaphore Anonymous Governance
  - [x] 11.1 Implement Semaphore protocol integration
    - Port Semaphore protocol to Cairo for Starknet
    - Implement group membership management
    - Add anonymous proof generation and verification
    - _Requirements: 5.1, 5.3, 5.5_

  - [ ] 11.2 Write property test for anonymous governance integrity
    - **Property 13: Anonymous Governance Integrity**
    - **Validates: Requirements 5.1, 5.3, 5.5**

  - [ ] 11.3 Implement private signaling system
    - Create anonymous signaling for governance decisions
    - Implement vote aggregation and tallying
    - Add support for different proposal types
    - _Requirements: 5.2, 5.4_

  - [ ] 11.4 Write property test for private signaling anonymity
    - **Property 14: Private Signaling Anonymity**
    - **Validates: Requirements 5.2, 5.4**

- [ ] 12. Bitcoin Bridge and Enhanced Minting
  - [ ] 12.1 Implement LayerSwap bridge integration for BTC/WBTC
    - Integrate LayerSwap SDK for cross-chain BTC transfers to Starknet
    - Add support for BTC to WBTC conversion during minting
    - Implement bridge transaction monitoring and confirmation
    - _Requirements: 3.4, 3.5_

  - [ ] 12.2 Implement Garden Finance SDK integration
    - Integrate Garden Finance for Bitcoin DeFi operations
    - Add support for BTC wrapping and unwrapping
    - Implement atomic swap functionality for BTC yield
    - _Requirements: 3.4, 3.5_

  - [ ] 12.3 Implement Xverse wallet bridge integration
    - Integrate Xverse Starknet bridge for BTC transfers
    - Add wallet connection and transaction signing for BTC operations
    - Implement bridge fee estimation and optimization
    - _Requirements: 6.5_

  - [ ] 12.4 Create Cairo contracts for BTC yield management
    - Implement BTC/WBTC yield tracking contract
    - Add yield source registration and management
    - Create yield claim and distribution logic for BTC yields
    - _Requirements: 3.1, 3.4_

  - [ ] 12.5 Implement BTC/WBTC yield source selection at mint
    - Add yield source selection to minting flow (BTC, WBTC, or mixed)
    - Implement automatic BTC to WBTC conversion during mint
    - Add yield source configuration and validation
    - Store yield preferences in NFT metadata
    - _Requirements: 2.1, 3.1, 3.4_

  - [ ] 12.6 Write property test for BTC bridge integration
    - **Property 20: BTC Bridge Round-Trip**
    - **Validates: Requirements 3.4, 3.5**

- [ ] 13. Wallet Allocation and Multi-Token Support
  - [ ] 13.1 Implement wallet allocation based on rarity and custom factors
    - Create allocation algorithm based on rarity scores
    - Add custom allocation factor support (stake weight, rarity weight, custom multipliers)
    - Implement proportional yield distribution to NFT wallets
    - Add allocation preview before minting
    - _Requirements: 3.1, 3.2_

  - [ ] 13.2 Extend Cairo wallet contract for multi-token support
    - Update wallet contract to hold any ERC-20 token
    - Implement token balance tracking and queries for multiple assets
    - Add support for native ETH and STRK holdings
    - Create token registry for supported assets
    - _Requirements: 2.3_

  - [ ] 13.3 Implement comprehensive wallet functions
    - Add token transfer functionality from NFT wallets
    - Implement token swap integration with DEX aggregator
    - Add staking/unstaking from NFT wallets to DeFi protocols
    - Create batch transaction support for multiple operations
    - _Requirements: 2.3_

  - [ ] 13.4 Create Cairo yield distributor contract
    - Implement proportional yield distribution logic in Cairo
    - Add support for multiple yield sources and tokens
    - Create allocation tracking and history
    - Implement automatic yield deposit to NFT wallets
    - _Requirements: 3.1, 3.2_

  - [ ] 13.5 Write property test for yield allocation
    - **Property 21: Yield Allocation Proportionality**
    - **Validates: Requirements 3.1, 3.2**

- [ ] 14. Real DeFi Protocol Integration
  - [ ] 14.1 Implement Vesu lending protocol integration
    - Integrate Vesu SDK for lending yield tracking
    - Add support for lending pool deposits and withdrawals from NFT wallets
    - Implement real-time yield calculation from lending rates
    - Replace mock implementation with actual Vesu API calls
    - _Requirements: 3.4, 3.5_

  - [ ] 14.2 Implement Ekubo DEX integration
    - Integrate Ekubo SDK for LP yield tracking
    - Add support for liquidity provision and removal from NFT wallets
    - Implement real-time yield calculation from trading fees
    - Replace mock implementation with actual Ekubo API calls
    - _Requirements: 3.4, 3.5_

  - [ ] 14.3 Implement Atomiq exchange integration
    - Integrate Atomiq SDK for trading yield tracking
    - Add support for market making and trading from NFT wallets
    - Implement real-time yield calculation from trading rewards
    - Replace mock implementation with actual Atomiq API calls
    - _Requirements: 3.4, 3.5_

  - [ ] 14.4 Create unified DeFi yield aggregator
    - Build aggregator to combine yields from all DeFi sources
    - Implement weighted yield calculation across protocols
    - Add yield source health monitoring and failover
    - Create yield optimization recommendations
    - _Requirements: 3.4, 3.5_

  - [ ] 14.5 Write property test for multi-protocol yield aggregation
    - **Property 22: Multi-Protocol Yield Consistency**
    - **Validates: Requirements 3.4, 3.5**

- [ ] 15. Complete Tongo Integration
  - [ ] 15.1 Replace Tongo mock implementations with real SDK calls
    - Integrate actual Tongo SDK for shielded transactions
    - Implement real fund, withdraw, and transfer operations
    - Add proper error handling for Tongo operations
    - Test with Tongo testnet
    - _Requirements: 2.2, 7.4_

  - [ ] 15.2 Implement Tongo balance queries and proofs
    - Add real shielded balance queries using Tongo SDK
    - Implement proof generation for balance verification
    - Add encrypted balance display in UI
    - _Requirements: 2.2, 7.4_

  - [ ] 15.3 Create Cairo contracts for Tongo integration
    - Implement Tongo pool interface contracts
    - Add shielded staking verification
    - Create yield distribution with privacy preservation
    - _Requirements: 2.2, 7.4_

- [ ] 16. Garaga-Noir Mystery Box Integration
  - [ ] 16.1 Complete Noir circuit compilation
    - Finalize mystery box reveal circuit in Noir
    - Compile circuits for both full and bluffing reveals
    - Generate verification keys for Garaga
    - Test circuit execution with sample inputs
    - _Requirements: 4.2, 4.5_

  - [ ] 16.2 Integrate Garaga verifier with Cairo contracts
    - Connect Garaga verifier to mystery box contract
    - Implement proof verification in Cairo using Garaga
    - Add verification key management
    - Test on-chain proof verification
    - _Requirements: 4.5_

  - [ ] 16.3 Complete SDK integration for mystery box proofs
    - Replace mock proof generation with real Noir compilation
    - Implement proof submission to Garaga verifier
    - Add proof verification status tracking
    - Create user-friendly proof generation interface
    - _Requirements: 4.1, 4.2, 4.5_

- [ ] 17. Data Encryption and Security
  - [ ] 12.1 Implement comprehensive data encryption
    - Create encryption system for all sensitive data
    - Implement key management and rotation
    - Add secure storage and retrieval mechanisms
    - _Requirements: 7.2_

- [ ] 17. Data Encryption and Security
  - [ ] 17.1 Implement comprehensive data encryption
    - Create encryption system for all sensitive data
    - Implement key management and rotation
    - Add secure storage and retrieval mechanisms
    - _Requirements: 7.2_

  - [ ] 17.2 Write property test for sensitive data encryption
    - **Property 17: Sensitive Data Encryption**
    - **Validates: Requirements 7.2**

- [ ] 18. SDK Integration and Packaging
  - [ ] 18.1 Create unified TypeScript SDK interface
    - Combine all components into cohesive SDK
    - Implement high-level API for developers
    - Add comprehensive error handling and logging
    - _Requirements: 6.1, 6.3_

  - [ ] 18.2 Implement wallet compatibility layer
    - Add support for Xverse, Argent X and Braavos wallets
    - Implement wallet detection and connection
    - Create unified wallet interface
    - _Requirements: 6.5_

  - [ ] 18.3 Package and publish NPM module
    - Configure build pipeline for NPM publishing
    - Create comprehensive documentation and examples
    - Set up automated testing and CI/CD
    - _Requirements: 6.1_

- [ ] 19. Demo Application
  - [ ] 19.1 Create React demo application using Scaffold-Stark
    - Build demo dApp showcasing all SDK features
    - Implement complete user flow: mint with BTC yield selection → stake → claim yield
    - Add wallet integration and transaction handling
    - Show wallet allocation and multi-token holdings
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 19.2 Implement minting UI with yield source selection
    - Create minting interface with BTC/WBTC yield options
    - Add allocation factor configuration (rarity, stake, custom)
    - Show yield preview and allocation breakdown
    - Implement wallet connection for BTC bridge
    - _Requirements: 8.1, 8.2_

  - [ ] 19.3 Implement NFT wallet management UI
    - Create wallet dashboard showing all held tokens
    - Add token transfer and swap interfaces
    - Implement yield claim and distribution display
    - Show transaction history and analytics
    - _Requirements: 8.3_

  - [ ] 19.4 Write integration tests for demo application
    - Test complete user workflows end-to-end
    - Verify all privacy features work correctly
    - Test wallet compatibility and error handling
    - Test BTC bridge and yield distribution flows

- [ ] 20. Final Integration and Testing
  - [ ] 20.1 Deploy contracts to Starknet Sepolia and mainnet
    - Deploy all smart contracts to both networks
    - Verify contract functionality on both networks
    - Update SDK configuration for network support
    - _Requirements: 6.2_

  - [ ] 20.2 Comprehensive integration testing
    - Test all components working together
    - Verify privacy properties across the entire system
    - Test error handling and edge cases
    - _Requirements: 6.4_

  - [ ] 20.3 Performance optimization and final polish
    - Optimize gas usage and transaction costs
    - Improve user experience and error messages
    - Add monitoring and analytics capabilities

- [ ] 21. Final Checkpoint - Complete System Verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks are comprehensive and include all testing and documentation from the beginning
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties using fast-check for TypeScript and Cairo testing framework for smart contracts
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript for SDK components and Cairo for smart contracts
- All privacy features are implemented using established protocols (Tongo, Noir/Garaga, Semaphore)

## Production Implementation Priorities

The following tasks replace mock implementations with production-ready code:

1. **Bitcoin Integration** (Tasks 12.1-12.6): LayerSwap, Garden Finance, Xverse bridges
2. **Wallet Allocation** (Tasks 13.1-13.5): Rarity-based distribution, multi-token support
3. **DeFi Integration** (Tasks 14.1-14.5): Vesu, Ekubo, Atomiq real API calls
4. **Tongo Integration** (Tasks 15.1-15.3): Real shielded transaction implementation
5. **Garaga-Noir** (Tasks 16.1-16.3): Complete mystery box proof system
6. **Demo Application** (Tasks 19.1-19.4): Full-featured dApp with all features