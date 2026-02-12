# Garaga-Noir Mystery Box Integration Guide

This document describes the complete integration of Noir circuits with Garaga on-chain verification for mystery box reveals.

## Architecture Overview

```
┌─────────────────┐
│  TypeScript SDK │
│  (Client Side)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Noir Circuit Integration          │
│   (src/circuits/noir-integration.ts)│
│   - Compiles Noir circuits          │
│   - Generates ZK proofs              │
│   - Manages proof generation         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Garaga Integration                 │
│   (src/circuits/garaga-integration.ts)│
│   - Converts proofs to Garaga format│
│   - Submits to on-chain verifier    │
│   - Manages verification keys        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Cairo Verifier Contract           │
│   (contracts/src/garaga_verifier.cairo)│
│   - Verifies Groth16 proofs on-chain│
│   - Manages mystery box state        │
│   - Prevents double-reveals          │
└─────────────────────────────────────┘
```

## Component Integration

### 1. Noir Circuit (src/circuits/src/main.nr)

The Noir circuit implements the core mystery box reveal logic:

**Features:**
- Full reveal mode: Verifies all hidden traits
- Bluffing mode: Proves category membership without revealing values
- Nullifier verification to prevent double-reveals
- Merkle proof verification for box existence
- Reveal condition checking (timelock, action, combined)

**Compilation:**
```bash
cd src/circuits
nargo compile
```

**Output:** `target/mystery_box_reveal.json`

### 2. TypeScript SDK Integration

#### NoirMysteryBoxCircuit Class

Located in `src/circuits/noir-integration.ts`, this class handles:

- Circuit compilation and caching
- Proof generation for both full and bluffing reveals
- Proof verification using Barretenberg backend
- Input preparation and formatting

**Usage Example:**
```typescript
import { NoirMysteryBoxCircuit } from './circuits/noir-integration';

const circuit = new NoirMysteryBoxCircuit();

// Generate full reveal proof
const proof = await circuit.generateRevealProof(
  boxId,
  tokenId,
  hiddenData,
  revealConditions,
  encryptionKey,
  'full'
);

// Generate bluffing proof
const bluffingProof = await circuit.generateBluffingProof(
  boxId,
  tokenId,
  hiddenData,
  traitCategory,
  encryptionKey
);

// Verify proof
const isValid = await circuit.verifyRevealProof(
  proof,
  boxId,
  tokenId,
  'full'
);
```

#### GaragaMysteryBoxVerifier Class

Located in `src/circuits/garaga-integration.ts`, this class handles:

- On-chain proof verification via Garaga
- Verification key management
- Transaction submission for reveals
- Contract deployment and upgrades

**Usage Example:**
```typescript
import { GaragaMysteryBoxVerifier } from './circuits/garaga-integration';

const verifier = new GaragaMysteryBoxVerifier(config);

// Initialize with deployed contract
await verifier.initialize(account, verifierContractAddress);

// Verify proof on-chain
const isValid = await verifier.verifyRevealProofOnChain(
  boxId,
  tokenId,
  proof,
  'full'
);

// Submit reveal transaction
const txHash = await verifier.submitRevealTransaction(
  boxId,
  proof,
  nullifier,
  'full'
);
```

### 3. Mystery Box Manager Integration

Located in `src/sdk/mystery-box.ts`, the MysteryBoxManagerSDK integrates all components:

**Key Methods:**
- `createMysteryBox()`: Creates encrypted mystery box
- `generateRevealProof()`: Generates ZK proof for reveal
- `generateBluffingProof()`: Generates proof for category membership
- `revealTraits()`: Verifies proof and reveals traits
- `verifyBluffingProof()`: Verifies bluffing proof

**Full Workflow:**
```typescript
import { MysteryBoxManagerSDK } from './sdk/mystery-box';

const manager = new MysteryBoxManagerSDK(config);

// 1. Create mystery box
const mysteryBox = await manager.createMysteryBox(tokenId, hiddenData);

// 2. Generate reveal proof
const proof = await manager.generateRevealProof(
  boxId,
  encryptionKey,
  'full'
);

// 3. Reveal traits
const revealedTraits = await manager.revealTraits(boxId, proof);

// 4. Generate bluffing proof (optional)
const bluffingProof = await manager.generateBluffingProof(
  boxId,
  'power',
  encryptionKey
);

// 5. Verify bluffing proof
const isValid = await manager.verifyBluffingProof(
  boxId,
  bluffingProof,
  'power'
);
```

### 4. Cairo Contract Integration

The Garaga verifier contract (`contracts/src/garaga_verifier.cairo`) provides:

**Core Functions:**
- `create_mystery_box()`: Registers mystery box on-chain
- `reveal_mystery_box()`: Verifies proof and updates state
- `verify_bluffing_proof()`: Verifies category membership proofs
- `is_nullifier_used()`: Prevents double-reveals
- `update_verification_keys()`: Manages VK upgrades

**Contract Deployment:**
```bash
# Generate verifier contract from VK
garaga gen --system groth16 --vk vk.json --output verifier.cairo

# Deploy to Starknet
starknet deploy --contract verifier.cairo
```

## Verification Key Generation

### Step 1: Compile Noir Circuit
```bash
cd src/circuits
nargo compile
```

### Step 2: Generate Verification Key
```bash
# Using Garaga CLI
garaga gen --system groth16 \
  --circuit target/mystery_box_reveal.json \
  --output target/full_reveal_vk.json
```

### Step 3: Generate Cairo Verifier
```bash
garaga gen --system groth16 \
  --vk target/full_reveal_vk.json \
  --output ../../contracts/src/mystery_box_garaga_verifier.cairo
```

### Step 4: Deploy Verifier Contract
```bash
cd contracts
scarb build
starknet declare --contract target/dev/mystery_box_garaga_verifier.json
starknet deploy --class-hash <hash> --inputs <constructor_args>
```

## Testing

### Unit Tests
```bash
# Test Noir circuit compilation
cd src/circuits
nargo test

# Test TypeScript integration
npm test -- tests/properties/zk-reveal-proof-verification.test.ts

# Test Cairo contracts
cd contracts
snforge test garaga_verifier
```

### Integration Tests
```bash
# Full end-to-end test
npm test -- tests/properties/mystery-box-hiding-mechanism.test.ts
npm test -- tests/properties/bluffing-mechanism-privacy.test.ts
```

## Production Deployment Checklist

- [ ] Compile Noir circuit with production settings
- [ ] Generate real verification keys using Garaga CLI
- [ ] Deploy Garaga verifier contract to Starknet mainnet
- [ ] Update SDK configuration with contract addresses
- [ ] Test proof generation and verification on testnet
- [ ] Verify gas costs and optimize if needed
- [ ] Set up monitoring for proof verification failures
- [ ] Document VK update procedures for upgrades

## Security Considerations

1. **Nullifier Management**: Each reveal must use a unique nullifier
2. **Verification Key Security**: Store VKs securely and verify integrity
3. **Proof Validation**: Always verify proofs on-chain before state updates
4. **Access Control**: Restrict VK updates to authorized addresses
5. **Circuit Auditing**: Have Noir circuits audited before production use

## Troubleshooting

### Circuit Compilation Fails
- Ensure nargo is installed: `curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash`
- Check Noir version compatibility: `nargo --version`
- Verify circuit syntax matches Noir version

### Proof Generation Fails
- Check input format matches circuit ABI
- Verify all required fields are provided
- Ensure field values are within valid range
- Check Barretenberg backend initialization

### On-Chain Verification Fails
- Verify proof format matches Garaga expectations
- Check verification key hash matches deployed contract
- Ensure nullifier hasn't been used before
- Verify reveal conditions are met

### Performance Issues
- Use proof caching for repeated verifications
- Optimize circuit constraints if possible
- Consider batching multiple reveals
- Monitor gas costs and adjust accordingly

## Future Enhancements

1. **Batch Verification**: Support verifying multiple proofs in one transaction
2. **Recursive Proofs**: Enable proof composition for complex reveals
3. **Alternative Backends**: Support PLONK or other proof systems
4. **Circuit Optimization**: Reduce constraint count for faster proving
5. **Hardware Acceleration**: Utilize GPU for proof generation

## References

- [Noir Documentation](https://noir-lang.org/docs)
- [Garaga Documentation](https://garaga.gitbook.io/garaga)
- [Starknet Cairo Documentation](https://docs.starknet.io/documentation/architecture_and_concepts/Smart_Contracts/cairo-and-sierra/)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
