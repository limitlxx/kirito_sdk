# Kirito SDK

> **"Forge Private, Yield-Bearing NFTs on Starknet – Where Creativity Meets Confidential DeFi"**

A privacy-first, modular toolkit for creating, minting, and managing yield-generating NFTs on Starknet with built-in zero-knowledge privacy features.

## Overview

Kirito SDK transforms static NFTs into dynamic, yield-generating assets that function as smart wallets with complete privacy. Built on Starknet's zk-STARK infrastructure, it enables developers to create NFT collections with advanced privacy features, shielded DeFi yields, and gamified mystery mechanics.

### Key Capabilities

- **Privacy-Enhanced NFTs**: Each NFT functions as an ERC-4337 smart wallet with account abstraction
- **Shielded Staking & Yields**: Private staking using Tongo protocol with hidden amounts and anonymous yield claims
- **Mystery Boxes**: Hidden traits revealed through zero-knowledge proofs with bluffing mechanics
- **Anonymous Governance**: Semaphore-based voting and signaling without revealing identity
- **DeFi Integration**: Automated yield aggregation from multiple protocols (Vesu, Ekubo, etc.)
- **Cross-Chain Bridges**: Bitcoin and Ethereum asset bridging with privacy preservation
- **NFT Generation**: HashLips-compatible generative art engine with rarity weighting

## Architecture

The SDK consists of nine core components working together to provide a complete privacy-first NFT ecosystem:

### 1. Generation Engine
Creates unique NFT collections from layered image traits with rarity weighting, IPFS upload, and metadata encryption.

### 2. NFT Wallet System
Account abstraction implementation where each NFT is a smart wallet capable of holding assets and executing transactions.

### 3. Shielded Pool Manager
Privacy-preserving staking via Tongo protocol with encrypted balances and zero-knowledge proof claims.

### 4. Mystery Box Manager
Hidden trait management with ZK reveals, time-locked encryption, and bluffing mechanisms.

### 5. Anonymous Governance
Semaphore-based private voting and signaling for collection decisions without revealing voter identity.

### 6. Sealed-Bid Auction System
Private auctions with commitment-reveal schemes for fair price discovery.

### 7. DeFi Yield Aggregator
Automated yield optimization across multiple Starknet DeFi protocols with health monitoring.

### 8. Wallet Allocation Engine
Intelligent yield distribution based on rarity scores, stake amounts, and custom factors.

### 9. Cross-Chain Bridges
Bitcoin (via Xverse) and Ethereum asset bridging with LayerSwap and Garden Finance integration

## Installation

```bash
npm install @kirito/sdk
# or
yarn add @kirito/sdk
# or
pnpm add @kirito/sdk
```

### Prerequisites

- Node.js 18+ and npm 9+
- Cairo 2.6.3+ (for contract development)
- Starknet Foundry (for contract testing)

## Quick Start

### 1. Basic SDK Initialization

```typescript
import { createKiritoSDK, WalletType } from '@kirito/sdk';

// Create SDK instance with configuration
const sdk = createKiritoSDK({
  network: {
    name: 'sepolia',
    chainId: 'SN_SEPOLIA',
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io',
    contracts: {
      nftWallet: '0x...',
      yieldDistributor: '0x...',
      multiTokenWallet: '0x...'
    }
  },
  ipfs: {
    url: 'https://ipfs.infura.io:5001',
    projectId: 'YOUR_INFURA_PROJECT_ID', // Optional
    projectSecret: 'YOUR_INFURA_SECRET'   // Optional
  },
  privacy: {
    tongoEndpoint: 'https://tongo.xyz/api',
    semaphoreEndpoint: 'https://semaphore.xyz/api'
  },
  debug: true // Enable debug logging
});

// Initialize SDK
await sdk.initialize();

// Check system health
const health = await sdk.healthCheck();
console.log('SDK Health:', health);
// Output: { network: true, ipfs: true, tongo: true, semaphore: true, ... }
```

### 2. Connect Wallet

```typescript
// Detect available wallets
const wallets = await sdk.detectWallets();
console.log('Available wallets:', wallets);

// Connect to wallet (ArgentX, Braavos, etc.)
const result = await sdk.connectWallet(WalletType.ARGENT_X);

if (result.success) {
  console.log('Connected to:', result.address);
  console.log('Wallet info:', sdk.getConnectedWallet());
} else {
  console.error('Connection failed:', result.error);
}
```

### 3. Generate NFT Collection

```typescript
import { KiritoGenerationEngine } from '@kirito/sdk';

// Create generation engine
const engine = new KiritoGenerationEngine(sdk.getConfig());

// Define collection configuration
const config = {
  layers: [
    {
      name: 'Background',
      path: './traits/backgrounds',
      weight: 1,
      traits: [
        { name: 'Blue', weight: 50, filename: 'blue.png' },
        { name: 'Red', weight: 30, filename: 'red.png' },
        { name: 'Gold', weight: 20, filename: 'gold.png' }
      ]
    },
    {
      name: 'Character',
      path: './traits/characters',
      weight: 1,
      traits: [
        { name: 'Warrior', weight: 40, filename: 'warrior.png' },
        { name: 'Mage', weight: 35, filename: 'mage.png' },
        { name: 'Rogue', weight: 25, filename: 'rogue.png' }
      ]
    }
  ],
  rarityWeights: {
    'Background': { 'Blue': 50, 'Red': 30, 'Gold': 20 },
    'Character': { 'Warrior': 40, 'Mage': 35, 'Rogue': 25 }
  },
  collectionSize: 100,
  semaphoreGroupId: '0x123...'
};

// Generate collection
const collection = await engine.generateCollection(config);
console.log(`Generated ${collection.tokens.length} NFTs`);
console.log('IPFS Hashes:', collection.ipfsHashes);
```

### 4. Mint NFT with Yield Allocation

```typescript
// Prepare NFT metadata
const metadata = {
  name: 'Kirito NFT #1',
  description: 'A privacy-enhanced yield-generating NFT',
  image: 'ipfs://QmXxx...',
  attributes: [
    { trait_type: 'Background', value: 'Gold' },
    { trait_type: 'Character', value: 'Mage' },
    { trait_type: 'Rarity', value: 'Epic' }
  ],
  rarityScore: 95,
  yieldMultiplier: 1.5,
  semaphoreGroupId: '0x123...'
};

// Stake amount (1 ETH)
const stakeAmount = BigInt('1000000000000000000');

// Mint NFT with automatic yield allocation
const { tokenId, txHash, allocation } = await sdk.mintWithYieldAllocation(
  result.address,
  metadata,
  stakeAmount
);

console.log('NFT minted:', tokenId);
console.log('Transaction:', txHash);
console.log('Yield allocation:', allocation);
```

## Complete Feature Guide

### NFT Generation Flow

The generation engine supports HashLips-compatible directory structures and provides advanced compositing options.

#### Directory Structure

```
traits/
├── 1-Background/
│   ├── Blue#50.png
│   ├── Red#30.png
│   └── Gold#20.png
├── 2-Character/
│   ├── Warrior#40.png
│   ├── Mage#35.png
│   └── Rogue#25.png
└── 3-Accessory/
    ├── Sword#60.png
    ├── Staff#30.png
    └── Dagger#10.png
```

The `#` delimiter indicates rarity weight (higher = more common).

#### Generate from Directory

```typescript
import { HashLipsEngine } from '@kirito/sdk';

// Create config from directory structure
const config = HashLipsEngine.createHashLipsConfig(
  './traits',
  100, // Collection size
  '0x123...', // Semaphore group ID
  {
    rarityDelimiter: '#',
    debugLogs: true,
    namePrefix: 'My Collection',
    description: 'A unique NFT collection'
  }
);

// Generate collection
const engine = new KiritoGenerationEngine(sdk.getConfig());
const collection = await engine.generateCollection(config);
```

#### Generate with Image Variants

Create multiple image sizes and formats including animated GIFs:

```typescript
import { HashLipsEngine } from '@kirito/sdk';

const variants = [
  { name: 'original', width: 512, height: 512, format: 'png', quality: 95 },
  { name: 'large', width: 256, height: 256, format: 'png', quality: 90 },
  { name: 'thumbnail', width: 128, height: 128, format: 'webp', quality: 85 },
  { 
    name: 'gif_preview', 
    width: 128, 
    height: 128, 
    format: 'gif',
    animated: true,
    frames: 8,
    delay: 200,
    quality: 10
  }
];

const { collection, variants: imageVariants } = 
  await engine.generateCollectionWithVariants(config, variants);

// Access variants for each NFT
console.log(imageVariants['1']['gif_preview']); // Buffer of animated GIF
```

#### Custom Composite Options

```typescript
const engine = new KiritoGenerationEngine(sdk.getConfig(), {
  canvasWidth: 1024,
  canvasHeight: 1024,
  backgroundColor: { r: 255, g: 255, b: 255, alpha: 1 },
  layerPositions: {
    'Background': { x: 0, y: 0, scale: 1 },
    'Character': { x: 100, y: 100, scale: 0.8 }
  },
  effects: {
    'Character': { blur: 0.5, brightness: 1.2, contrast: 1.1 }
  },
  outputFormat: 'png',
  quality: 95,
  blend: 'source-over',
  opacity: 1
});
```

### Shielded Staking & Yields

#### Stake with Privacy

```typescript
const shieldedPool = sdk.getShieldedPool();

// Create shielded stake (amount is encrypted)
const stakeAmount = BigInt('1000000000000000000'); // 1 ETH
const { commitment, note } = await shieldedPool.deposit(
  tokenId,
  stakeAmount,
  '0x0' // ETH token address
);

console.log('Stake commitment:', commitment);
console.log('Keep your note safe:', note); // Needed for claims
```

#### Claim Yields Privately

```typescript
// Generate ZK proof for yield claim
const claimAmount = BigInt('50000000000000000'); // 0.05 ETH yield
const proof = await shieldedPool.generateClaimProof(
  note,
  claimAmount,
  metadata.rarityScore,
  metadata.yieldMultiplier
);

// Claim yield without revealing stake amount
const txHash = await shieldedPool.claimYield(
  tokenId,
  claimAmount,
  proof
);

console.log('Yield claimed privately:', txHash);
```

#### Get Encrypted Balance

```typescript
// Get your encrypted balance (only you can decrypt)
const encryptedBalance = await shieldedPool.getEncryptedBalance(
  tokenId,
  note.owner
);

// Decrypt locally
const balance = await shieldedPool.decryptBalance(
  encryptedBalance,
  note
);

console.log('Your private balance:', balance.toString());
```

### DeFi Yield Aggregation

#### Get Aggregated Yields

```typescript
const defiAggregator = sdk.getDeFiAggregator();

// Define time period (last 30 days)
const period = {
  start: Date.now() - (30 * 24 * 60 * 60 * 1000),
  end: Date.now()
};

// Get yields from all protocols
const aggregatedYield = await defiAggregator.getAggregatedYield(
  walletAddress,
  period
);

console.log('Total yield:', aggregatedYield.totalYield.toString());
console.log('Protocol breakdown:');
aggregatedYield.protocolBreakdown.forEach(protocol => {
  console.log(`  ${protocol.protocolName}: ${protocol.weightedYield}`);
  console.log(`    APY: ${(protocol.apy * 100).toFixed(2)}%`);
  console.log(`    Health: ${(protocol.healthScore * 100).toFixed(1)}%`);
});
```

#### Optimize Yield Distribution

```typescript
// Get optimization recommendations
const optimization = await sdk.optimizeYieldDistribution(
  walletAddress,
  period
);

console.log('Current APY:', (optimization.currentAPY * 100).toFixed(2) + '%');
console.log('Optimized APY:', (optimization.optimizedAPY * 100).toFixed(2) + '%');
console.log('Improvement:', 
  ((optimization.optimizedAPY - optimization.currentAPY) * 100).toFixed(2) + '%'
);

// Review rebalancing recommendations
optimization.rebalanceRecommendations.forEach(rec => {
  console.log(`${rec.protocol}:`);
  console.log(`  Current: ${(rec.currentWeight * 100).toFixed(1)}%`);
  console.log(`  Recommended: ${(rec.recommendedWeight * 100).toFixed(1)}%`);
  console.log(`  Reason: ${rec.reason}`);
});

// Execute rebalancing
const txHashes = await sdk.executeRebalancing(walletAddress, optimization);
console.log('Rebalancing complete:', txHashes);
```

#### Monitor Protocol Health

```typescript
// Monitor all integrated protocols
const healthResults = await defiAggregator.monitorProtocolHealth();

healthResults.forEach((health, protocol) => {
  console.log(`${protocol}:`);
  console.log(`  Status: ${health.isHealthy ? '✓ Healthy' : '✗ Unhealthy'}`);
  console.log(`  Score: ${(health.healthScore * 100).toFixed(1)}%`);
  
  if (health.issues.length > 0) {
    console.log(`  Issues: ${health.issues.join(', ')}`);
  }
  
  if (health.recommendations.length > 0) {
    console.log(`  Recommendations: ${health.recommendations.join(', ')}`);
  }
});
```

### Mystery Box Features

#### Create Mystery Box

```typescript
const mysteryBox = sdk.getMysteryBox();

// Define hidden traits
const hiddenTraits = {
  'Secret Power': 'Lightning Strike',
  'Hidden Rarity': 'Legendary',
  'Bonus Yield': 2.5
};

// Generate encryption key
const encryptionKey = KiritoGenerationEngine.generateEncryptionKey();

// Encrypt traits
const encryptedTraits = await mysteryBox.encryptTraits(
  tokenId,
  hiddenTraits,
  encryptionKey
);

// Set reveal conditions
const revealConditions = {
  type: 'timelock' as const,
  timestamp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
};

// Create mystery box
await mysteryBox.createBox(
  tokenId,
  encryptedTraits,
  revealConditions
);

console.log('Mystery box created! Traits will reveal in 7 days.');
```

#### Reveal with ZK Proof

```typescript
// After reveal conditions are met
const proof = await mysteryBox.generateRevealProof(
  tokenId,
  encryptionKey,
  revealConditions
);

// Reveal traits
const revealedTraits = await mysteryBox.revealTraits(
  tokenId,
  proof
);

console.log('Revealed traits:', revealedTraits);
```

#### Selective Reveal (Bluffing)

```typescript
// Reveal only some traits, keep others hidden
const { encrypted, visible } = await mysteryBox.encryptSelectiveTraits(
  hiddenTraits,
  encryptionKey,
  ['Secret Power'] // Only hide this trait
);

console.log('Visible traits:', visible);
// Output: { 'Hidden Rarity': 'Legendary', 'Bonus Yield': 2.5 }

// Later, reveal the hidden trait
const secretTrait = await mysteryBox.decryptTraits(encrypted, encryptionKey);
console.log('Secret trait:', secretTrait);
// Output: { 'Secret Power': 'Lightning Strike' }
```

#### Category Proof (Prove Without Revealing)

```typescript
// Prove trait is in a category without revealing exact value
const categoryProof = await mysteryBox.generateCategoryProof(
  { rarity: 'Legendary' },
  'Epic+', // Category
  encryptionKey
);

// Verify proof on-chain
const isValid = await mysteryBox.verifyCategoryProof(
  tokenId,
  categoryProof,
  'Epic+'
);

console.log('Is Epic+ rarity:', isValid); // true, but exact rarity stays hidden
```

### Anonymous Governance

#### Create Proposal

```typescript
const governance = sdk.getGovernance();

// Create anonymous proposal
const proposalId = await governance.createProposal(
  {
    title: 'Increase Yield Distribution',
    description: 'Should we allocate 10% more to rare NFTs?',
    options: ['Yes', 'No', 'Abstain'],
    groupId: '0x123...', // Semaphore group
    deadline: Date.now() + (7 * 24 * 60 * 60 * 1000),
    votingPower: 'stake_weighted' as const,
    proposalType: 'binary' as const
  }
);

console.log('Proposal created:', proposalId);
```

#### Vote Anonymously

```typescript
// Generate Semaphore identity
const identity = await governance.generateIdentity();

// Join Semaphore group (proves you're an NFT holder)
await governance.joinGroup('0x123...', identity);

// Vote anonymously (no one knows who voted)
const voteProof = await governance.vote(
  proposalId,
  'Yes',
  identity,
  '0x123...' // Group ID
);

console.log('Vote submitted anonymously');
console.log('Nullifier hash:', voteProof.nullifierHash); // Prevents double voting
```

#### Private Signaling

```typescript
// Signal preferences without revealing identity
await governance.signal(
  {
    type: 'yield_strategy' as const,
    scope: 'collection-123',
    data: { preferredProtocol: 'Vesu', riskTolerance: 'medium' },
    groupId: '0x123...',
    timestamp: Date.now()
  },
  identity
);

// Aggregate signals (privacy-preserving)
const signals = await governance.getAggregatedSignals(
  'yield_strategy',
  'collection-123'
);

console.log('Community preferences:', signals.aggregation);
// Output: { preferredProtocol: { Vesu: 45, Ekubo: 30, ... }, ... }
```

### Sealed-Bid Auctions

#### Create Auction

```typescript
const auction = sdk.getAuction();

// Create sealed-bid auction
const auctionId = await auction.createAuction({
  tokenId: '1',
  startingPrice: BigInt('100000000000000000'), // 0.1 ETH
  reservePrice: BigInt('500000000000000000'),  // 0.5 ETH
  commitmentPhaseEnd: Date.now() + (3 * 24 * 60 * 60 * 1000), // 3 days
  revealPhaseEnd: Date.now() + (5 * 24 * 60 * 60 * 1000),     // 5 days
  auctioneer: result.address
});

console.log('Auction created:', auctionId);
```

#### Submit Sealed Bid

```typescript
// Generate random nonce
const nonce = crypto.randomBytes(32);

// Create bid commitment (hides amount)
const bidAmount = BigInt('750000000000000000'); // 0.75 ETH
const commitment = await auction.createBidCommitment(
  auctionId,
  bidAmount,
  nonce
);

// Submit commitment (amount is hidden)
const bidId = await auction.submitBid(auctionId, commitment);

console.log('Bid submitted:', bidId);
console.log('Keep your nonce safe for reveal phase!');
```

#### Reveal Bid

```typescript
// After commitment phase ends
await auction.revealBid(
  auctionId,
  bidId,
  bidAmount,
  nonce
);

console.log('Bid revealed');
```

#### Finalize Auction

```typescript
// After reveal phase ends
const results = await auction.finalizeAuction(auctionId);

console.log('Winner:', results.winner);
console.log('Winning bid:', results.winningBid.toString());
console.log('Total bids:', results.totalBids);
```

### Cross-Chain Bridges

#### Bridge Bitcoin

```typescript
import { XverseBridge } from '@kirito/sdk';

const xverseBridge = new XverseBridge(sdk.getConfig());

// Connect Xverse wallet
await xverseBridge.connectWallet();

// Bridge BTC to Starknet
const bridgeTx = await xverseBridge.bridgeBTCToStarknet(
  '0.1', // BTC amount
  result.address // Starknet recipient
);

console.log('Bridge transaction:', bridgeTx);
```

#### Bridge Ethereum Assets

```typescript
import { LayerSwapBridge } from '@kirito/sdk';

const layerswap = new LayerSwapBridge(sdk.getConfig());

// Bridge ETH from Ethereum to Starknet
const quote = await layerswap.getQuote(
  'ETH',
  'ethereum',
  'starknet',
  '1.0'
);

console.log('Bridge quote:', quote);

const swap = await layerswap.initiateSwap(
  'ETH',
  '1.0',
  'ethereum',
  'starknet',
  result.address
);

console.log('Swap initiated:', swap);
```

### Wallet Management

#### Comprehensive Wallet

Each NFT can function as a full-featured wallet:

```typescript
const wallet = sdk.createComprehensiveWallet(
  result.address,
  tokenId
);

// Get wallet balance
const balance = await wallet.getBalance('0x0'); // ETH
console.log('Wallet balance:', balance.toString());

// Execute transaction from NFT wallet
const tx = await wallet.executeTransaction({
  to: '0x...',
  value: BigInt('100000000000000000'), // 0.1 ETH
  data: new Uint8Array(),
  gasLimit: BigInt('100000')
});

console.log('Transaction executed:', tx);

// Batch transactions
const txs = await wallet.executeBatch([
  { to: '0x...', value: BigInt('100000000000000000'), data: new Uint8Array(), gasLimit: BigInt('100000') },
  { to: '0x...', value: BigInt('200000000000000000'), data: new Uint8Array(), gasLimit: BigInt('100000') }
]);

console.log('Batch executed:', txs);
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


## Development Guide

### Prerequisites

- Node.js 18+ and npm 9+
- Cairo 2.6.3+ (for contract development)
- Starknet Foundry (for contract testing)
- Sharp or Canvas (for image processing)

### Setup

```bash
# Clone repository
git clone https://github.com/kirito-sdk/kirito-sdk.git
cd kirito-sdk

# Install dependencies
npm install

# Build TypeScript SDK
npm run build

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run property-based tests
npm run test:properties

# Build Cairo contracts
cd contracts
scarb build

# Run Cairo contract tests
snforge test
```

### Project Structure

```
kirito-sdk/
├── src/                          # TypeScript SDK source
│   ├── circuits/                 # Noir ZK circuits
│   │   ├── mystery-box-reveal.nr # Mystery box reveal circuit
│   │   ├── noir-integration.ts   # Noir.js integration
│   │   └── garaga-integration.ts # Garaga verifier integration
│   ├── generation/               # NFT generation engine
│   │   ├── generation-engine.ts  # Main generation engine
│   │   ├── hashlips-engine.ts    # HashLips-compatible engine
│   │   └── create-collection-gif.ts # GIF thumbnail creation
│   ├── interfaces/               # Core interfaces
│   │   ├── generation-engine.ts
│   │   ├── nft-wallet.ts
│   │   ├── shielded-pool.ts
│   │   ├── mystery-box.ts
│   │   ├── governance.ts
│   │   ├── auction.ts
│   │   ├── bridge.ts
│   │   └── error-handler.ts
│   ├── sdk/                      # SDK implementations
│   │   ├── kirito-sdk.ts         # Main SDK class
│   │   ├── nft-wallet.ts         # NFT wallet implementation
│   │   ├── shielded-pool.ts      # Shielded pool manager
│   │   ├── mystery-box.ts        # Mystery box manager
│   │   ├── governance.ts         # Anonymous governance
│   │   ├── auction.ts            # Sealed-bid auctions
│   │   ├── wallet-allocation.ts  # Yield allocation engine
│   │   ├── defi-yield-aggregator.ts # DeFi yield aggregation
│   │   ├── comprehensive-wallet.ts  # Multi-token wallet
│   │   ├── wallet-connector.ts   # Wallet connection
│   │   ├── vesu-integration.ts   # Vesu protocol integration
│   │   ├── ekubo-integration.ts  # Ekubo protocol integration
│   │   ├── atomiq-integration.ts # Atomiq integration
│   │   ├── layerswap-bridge.ts   # LayerSwap bridge
│   │   ├── garden-finance-bridge.ts # Garden Finance bridge
│   │   ├── xverse-bridge.ts      # Bitcoin bridge (Xverse)
│   │   └── config.ts             # Configuration
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts              # All type exports
│   ├── utils/                    # Utility functions
│   │   ├── encryption.ts         # Trait encryption
│   │   ├── ipfs.ts               # IPFS client
│   │   ├── tongo-integration.ts  # Tongo SDK integration
│   │   ├── garaga-integration.ts # Garaga verifier
│   │   ├── zk-proof-manager.ts   # ZK proof utilities
│   │   └── starknet-client.ts    # Starknet RPC client
│   └── index.ts                  # Main SDK export
├── contracts/                    # Cairo smart contracts
│   ├── src/                      # Contract source code
│   │   ├── nft_wallet.cairo      # NFT wallet contract
│   │   ├── shielded_pool.cairo   # Shielded pool contract
│   │   ├── mystery_box.cairo     # Mystery box contract
│   │   ├── governance.cairo      # Governance contract
│   │   └── auction.cairo         # Auction contract
│   ├── tests/                    # Contract tests
│   ├── Scarb.toml                # Scarb configuration
│   └── Scarb.lock                # Dependency lock file
├── tests/                        # SDK tests
│   ├── unit/                     # Unit tests
│   └── properties/               # Property-based tests
├── examples/                     # Usage examples
│   ├── basic-usage.ts            # Basic SDK usage
│   ├── minting-with-yield.ts     # Minting with yields
│   └── yield-optimization.ts     # Yield optimization
├── generated-nfts/               # Example generated NFTs
├── traits/                       # Example trait layers
├── docs/                         # Documentation
├── package.json                  # NPM package config
├── tsconfig.json                 # TypeScript config
├── jest.config.js                # Jest test config
└── README.md                     # This file
```

### Available Scripts

```bash
# Development
npm run dev              # Watch mode for TypeScript compilation
npm run build            # Build TypeScript and Cairo contracts
npm run build:contracts  # Build only Cairo contracts
npm run clean            # Clean build artifacts

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:properties  # Run property-based tests only

# Code Quality
npm run lint             # Lint TypeScript code
npm run lint:fix         # Lint and auto-fix issues
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Documentation
npm run docs             # Generate TypeDoc documentation

# Publishing
npm run prepublishOnly   # Pre-publish checks (clean, build, test)
```

### Running Examples

```bash
# Basic usage example
npx ts-node examples/basic-usage.ts

# Minting with yield allocation
npx ts-node examples/minting-with-yield.ts

# Yield optimization
npx ts-node examples/yield-optimization.ts
```

### Creating Custom Integrations

#### Add New DeFi Protocol

```typescript
import { DeFiProtocol } from '@kirito/sdk';

class MyProtocolIntegration implements DeFiProtocol {
  async getAPY(tokenAddress: string): Promise<number> {
    // Implement APY fetching
    return 0.05; // 5% APY
  }

  async deposit(amount: bigint, tokenAddress: string): Promise<string> {
    // Implement deposit logic
    return '0x...'; // Transaction hash
  }

  async withdraw(amount: bigint, tokenAddress: string): Promise<string> {
    // Implement withdrawal logic
    return '0x...'; // Transaction hash
  }

  async getBalance(walletAddress: string, tokenAddress: string): Promise<bigint> {
    // Implement balance fetching
    return BigInt(0);
  }
}

// Register with aggregator
const defiAggregator = sdk.getDeFiAggregator();
defiAggregator.registerProtocol('MyProtocol', new MyProtocolIntegration());
```

#### Add Custom Yield Source

```typescript
import { YieldSourceSelector } from '@kirito/sdk';

const yieldSelector = new YieldSourceSelector(sdk.getConfig());

// Add custom yield source
yieldSelector.addYieldSource({
  id: 'custom-source',
  name: 'My Custom Yield Source',
  type: 'defi' as const,
  apy: 0.08, // 8% APY
  risk: 'medium' as const,
  minStake: BigInt('100000000000000000'), // 0.1 ETH
  supportedTokens: ['0x0'], // ETH
  isActive: true
});
```

### Debugging

Enable debug logging:

```typescript
const sdk = createKiritoSDK({
  // ... config
  debug: true
});

// Or set custom logger
import { SDKLogger } from '@kirito/sdk';

class CustomLogger implements SDKLogger {
  debug(message: string, context?: any): void {
    // Custom debug implementation
  }
  
  info(message: string, context?: any): void {
    // Custom info implementation
  }
  
  warn(message: string, context?: any): void {
    // Custom warn implementation
  }
  
  error(message: string, error?: Error, context?: any): void {
    // Custom error implementation
  }
}

sdk.setLogger(new CustomLogger());
```

### Performance Optimization

#### Batch IPFS Uploads

```typescript
// Configure batch upload options
const engine = new KiritoGenerationEngine(sdk.getConfig());

// Customize batch settings
const ipfsHashes = await engine.uploadToIPFS(images, metadata);
// Uses optimized batching internally:
// - Images: 8 per batch, 1.5s delay, 3 concurrent
// - Metadata: 15 per batch, 0.8s delay, 5 concurrent
```

#### Parallel Generation

```typescript
// Generate multiple collections in parallel
const collections = await Promise.all([
  engine.generateCollection(config1),
  engine.generateCollection(config2),
  engine.generateCollection(config3)
]);
```

### Security Best Practices

1. **Never expose private keys or encryption keys**
```typescript
// ❌ Bad
const key = { key: Buffer.from('secret'), iv: Buffer.from('iv') };

// ✓ Good
const key = KiritoGenerationEngine.generateEncryptionKey();
// Store securely, never log or commit
```

2. **Validate all inputs**
```typescript
// Always validate before processing
await engine.validateConfig(config);
```

3. **Use environment variables for sensitive data**
```typescript
const sdk = createKiritoSDK({
  ipfs: {
    url: process.env.IPFS_URL,
    projectId: process.env.INFURA_PROJECT_ID,
    projectSecret: process.env.INFURA_SECRET
  }
});
```

4. **Keep dependencies updated**
```bash
npm audit
npm update
```

### Troubleshooting

#### Image Processing Issues

If you encounter image processing errors:

```bash
# Install Sharp (recommended)
npm install sharp

# Or install Canvas (fallback)
npm install canvas
```

Check capabilities:

```typescript
const capabilities = await HashLipsEngine.validateImageProcessing();
console.log('Available:', capabilities);
// { sharp: true, canvas: true, capabilities: ['sharp', 'high-performance', ...] }
```

#### IPFS Upload Failures

If IPFS uploads fail:

1. Check network connectivity
2. Verify IPFS endpoint is accessible
3. Check rate limits
4. Use retry logic (built-in)

```typescript
// SDK automatically retries failed uploads
// Check health status
const health = await sdk.healthCheck();
console.log('IPFS status:', health.ipfs);
```

#### Contract Deployment Issues

```bash
# Verify Cairo installation
scarb --version

# Clean and rebuild
cd contracts
scarb clean
scarb build

# Run tests to verify
snforge test
```

### Contributing Guidelines

1. **Code Style**: Follow existing patterns, use TypeScript strict mode
2. **Testing**: Add tests for all new features (unit + property tests)
3. **Documentation**: Update README and add JSDoc comments
4. **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)
5. **Pull Requests**: Include description, tests, and examples

### Resources

- [Starknet Documentation](https://docs.starknet.io/)
- [Cairo Book](https://book.cairo-lang.org/)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/)
- [HashLips Art Engine](https://github.com/HashLips/hashlips_art_engine)
- [Tongo SDK](https://docs.tongo.cash/sdk/quick-start.html)
- [Noir Language](https://noir-lang.org/)
- [Garaga](https://github.com/keep-starknet-strange/garaga)
- [Semaphore](https://docs.semaphore.pse.dev/)

### Roadmap

- [x] NFT Generation Engine
- [x] Shielded Pool Integration
- [x] Mystery Box System
- [x] Anonymous Governance
- [x] Sealed-Bid Auctions
- [x] DeFi Yield Aggregation
- [x] Cross-Chain Bridges
- [ ] Multi-chain Support (Ethereum, Polygon)
- [ ] Advanced ZK Circuits (Recursive proofs)
- [ ] Mobile SDK (React Native)
- [ ] Governance Token ($KIRITO)
- [ ] DAO Treasury Management
- [ ] NFT Lending/Borrowing
- [ ] Fractional NFT Ownership

### Community

- **Discord**: [Join our community](https://discord.gg/kirito-sdk)
- **Twitter**: [@KiritoSDK](https://twitter.com/KiritoSDK)
- **GitHub**: [kirito-sdk/kirito-sdk](https://github.com/kirito-sdk/kirito-sdk)
- **Forum**: [forum.kirito.dev](https://forum.kirito.dev)

### Acknowledgments

Built with:
- [Starknet](https://starknet.io/) - Layer 2 scaling solution
- [HashLips Art Engine](https://github.com/HashLips/hashlips_art_engine) - Generative art inspiration
- [Tongo](https://tongo.cash/) - Privacy protocol
- [Semaphore](https://semaphore.pse.dev/) - Anonymous signaling
- [Noir](https://noir-lang.org/) - ZK circuit language
- [Garaga](https://github.com/keep-starknet-strange/garaga) - ZK proof verification

---

Made with ❤️ by the Kirito SDK Team
