# Kirito SDK - Cairo Contract Tests

This directory contains tests for the Kirito SDK Cairo smart contracts.

## Test Files

### NFT Wallet Tests
- `nft_wallet_deployment_test.cairo`: Tests for NFT wallet deployment and basic functionality
- Validates ERC-721 compliance and account abstraction features

### Proxy Upgradeability Tests
- `proxy_upgradeability_test.cairo`: Tests for UUPS proxy pattern implementation
- Ensures contracts can be safely upgraded without losing state

### Tongo Pool Tests
- `tongo_pool_test.cairo`: Tests for Tongo shielded pool integration
- Validates private staking, transfers, and yield distribution

### Garaga Verifier Tests
- `garaga_verifier_test.cairo`: Tests for Garaga ZK proof verification
- Validates mystery box reveal proof verification
- Tests RevealProof and RevealConditions struct accessibility

## Running Tests

Run all tests:
```bash
cd contracts
snforge test
```

Run specific test file:
```bash
snforge test garaga_verifier
```

Run specific test function:
```bash
snforge test test_garaga_verifier_deployment
```

## Test Coverage

The test suite covers:
- Contract deployment and initialization
- Access control and permissions
- State management and upgrades
- Privacy-preserving operations
- ZK proof verification
- Integration between components

## Notes

- Some tests may require mock implementations of external dependencies
- Garaga verifier tests validate struct visibility and integration
- Full end-to-end tests require deployed contracts on testnet
