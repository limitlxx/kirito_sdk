# Kirito SDK

A privacy-first toolkit for creating, minting, and managing yield-generating NFTs on Starknet.

## Overview

The Kirito SDK enables designers/developers to create NFT collections with advanced privacy features including:

- **Privacy-Enhanced NFTs**: Each NFT functions as a smart wallet with account abstraction
- **Shielded Staking**: Private staking using Tongo protocol with hidden amounts
- **Mystery Boxes**: Hidden traits revealed through zero-knowledge proofs
- **Anonymous Governance**: Semaphore-based voting and signaling
- **Yield Distribution**: Private yield distribution based on stake and rarity

## Architecture

The SDK consists of five core components:

1. **Generation Engine**: Creates unique NFT collections from image layers
2. **NFT Wallet System**: Account abstraction for NFT-based wallets
3. **Shielded Pool Integration**: Privacy-preserving staking via Tongo
4. **Mystery Box Manager**: Hidden trait management with ZK reveals
5. **Anonymous Governance**: Semaphore-based private voting

## Installation

```bash
npm install kirito-sdk
```

## Quick Start

```typescript
import { KiritoSDK } from 'kirito-sdk';

// Initialize SDK
const sdk = new KiritoSDK({
  network: {
    name: 'starknet-sepolia',
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
    chainId: '0x534e5f5345504f4c4941',
    contracts: {}
  },
  ipfs: {
    url: 'https://ipfs.infura.io:5001'
  },
  privacy: {
    tongoEndpoint: 'https://api.tongo.dev',
    semaphoreEndpoint: 'https://api.semaphore.dev'
  }
});

await sdk.initialize();

// Check system health
const health = await sdk.healthCheck();
console.log('SDK Health:', health);
```

## Development

### Prerequisites

- Node.js 18+
- Cairo 2.6.3+
- Starknet Foundry

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript SDK
npm run build

# Run tests
npm test

# Build Cairo contracts
cd contracts
scarb build

# Run Cairo tests
snforge test
```

### Project Structure

```
├── src/                    # TypeScript SDK source
│   ├── interfaces/         # Core interfaces
│   ├── types/             # Type definitions
│   └── sdk/               # Main SDK implementation
├── contracts/             # Cairo smart contracts
│   ├── src/               # Contract source code
│   └── tests/             # Contract tests
├── tests/                 # SDK tests
│   └── properties/        # Property-based tests
└── docs/                  # Documentation
```

## Testing

The project uses a dual testing approach:

- **Unit Tests**: Specific examples and edge cases using Jest
- **Property Tests**: Universal properties using fast-check (100+ iterations)
- **Contract Tests**: Cairo contract testing with Starknet Foundry

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run property tests only
npm test -- tests/properties/

# Run Cairo contract tests
cd contracts && snforge test
```

## Networks

### Supported Networks

- **Starknet Sepolia** (Testnet): `0x534e5f5345504f4c4941`
- **Starknet Mainnet**: `0x534e5f4d41494e`

### Network Switching

```typescript
import { STARKNET_MAINNET } from 'kirito-sdk';

await sdk.switchNetwork(STARKNET_MAINNET);
```

## Privacy Features

### Tongo Shielded Pools
- Hidden staking amounts using ElGamal encryption
- Zero-knowledge proofs for yield claims
- Stealth addresses for private transfers

### Noir/Garaga ZK Circuits
- Mystery box trait hiding and revealing
- Bluffing mechanisms for partial reveals
- On-chain proof verification

### Semaphore Anonymous Governance
- Anonymous voting on collection decisions
- Private signaling for yield strategies
- Double-voting prevention

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Documentation

- [API Reference](docs/api.md)
- [Privacy Guide](docs/privacy.md)
- [Contract Documentation](docs/contracts.md)
- [Examples](examples/)

## Support

- [GitHub Issues](https://github.com/kirito-sdk/kirito-sdk/issues)
- [Discord Community](https://discord.gg/kirito-sdk)
- [Documentation](https://docs.kirito.dev)