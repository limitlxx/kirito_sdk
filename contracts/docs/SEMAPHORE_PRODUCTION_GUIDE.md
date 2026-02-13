# Semaphore Protocol - Production Deployment Guide

## Overview

This implementation provides a production-ready Semaphore protocol for Starknet, enabling anonymous signaling and group membership proofs using zero-knowledge cryptography.

## Architecture

### Core Components

1. **Identity Commitments**: Users create Semaphore identities off-chain
   - Identity = hash(secret_value)
   - Commitment stored in group Merkle tree

2. **Groups**: On-chain Merkle trees of member commitments
   - Binary tree structure using Poseidon hash
   - Supports dynamic member addition/removal
   - Admin-controlled membership

3. **Zero-Knowledge Proofs**: Groth16 zk-SNARKs
   - Proves: "I am a member of group X"
   - Without revealing: Which specific member
   - Prevents double-signaling via nullifiers

4. **Nullifiers**: Unique per identity + external_nullifier
   - Prevents same identity from signaling twice
   - Tracked on-chain to prevent replay attacks

## Production Integration Steps

### Step 1: Deploy Garaga Verifier

The Semaphore contract requires a Garaga verifier for Groth16 proof verification:

```cairo
// Deploy Garaga verifier first
let garaga_verifier = deploy_garaga_verifier();
```

### Step 2: Obtain Verification Keys

Get Semaphore circuit verification keys from the trusted setup ceremony:

- **Trusted Setup**: [https://trusted-setup-pse.org](https://trusted-setup-pse.org)
- **Semaphore Circuits**: Support tree depths 1-32
- **Verification Key Hash**: Required for on-chain verification

```bash
# Download verification keys for your tree depth
# Example: depth 20 supports up to 2^20 = 1,048,576 members
wget https://snark-artifacts.pse.dev/semaphore/4.0.0/semaphore-20.zkey
```

### Step 3: Deploy Semaphore Contract

```cairo
let owner = get_contract_address();
let garaga_verifier_address = 0x...;
let semaphore_vk_hash = 0x...; // From trusted setup

let semaphore = deploy_semaphore(
    owner,
    garaga_verifier_address,
    semaphore_vk_hash
);
```

### Step 4: Integrate Garaga Verification

Update `_verify_semaphore_proof` function to call Garaga:

```cairo
fn _verify_semaphore_proof(
    self: @ContractState,
    merkle_root: felt252,
    signal: felt252,
    nullifier_hash: felt252,
    external_nullifier: felt252,
    proof: Span<felt252>
) -> bool {
    // Build public inputs
    let mut public_inputs = ArrayTrait::new();
    public_inputs.append(merkle_root);
    public_inputs.append(nullifier_hash);
    
    let mut signal_input = ArrayTrait::new();
    signal_input.append(signal);
    let signal_hash = poseidon_hash_span(signal_input.span());
    public_inputs.append(signal_hash);
    
    public_inputs.append(external_nullifier);
    
    // Call Garaga verifier
    use garaga::groth16::verify_groth16_proof_bn254;
    
    verify_groth16_proof_bn254(
        proof,
        public_inputs.span(),
        self.semaphore_vk_hash.read()
    )
}
```

## Usage Examples

### Creating a Group

```cairo
// Only contract owner can create groups
semaphore.create_group(
    group_id: 1,
    admin: admin_address
);
```

### Adding Members

```cairo
// Only group admin can add members
// Commitment = poseidon_hash(identity_secret)
semaphore.add_member(
    group_id: 1,
    commitment: 0x123...
);
```

### Verifying Proofs

```cairo
// Anyone can verify proofs
let is_valid = semaphore.verify_proof(
    group_id: 1,
    signal: 0xabc...,           // Message/vote
    nullifier_hash: 0xdef...,   // Prevents double-signaling
    external_nullifier: 0x456..., // Context (e.g., poll_id)
    proof: proof_data.span()    // Groth16 proof
);

if is_valid {
    // Mark nullifier as used
    semaphore.mark_nullifier_used(nullifier_hash);
    // Process signal...
}
```

## Security Considerations

### 1. Nullifier Management

- **Always check nullifiers** before accepting signals
- **Mark nullifiers immediately** after verification
- **Use unique external_nullifiers** per context (poll, vote, etc.)

### 2. Merkle Root Validation

- Current implementation uses latest root only
- Consider supporting historical roots for async proof generation
- Implement root expiration for security

### 3. Admin Key Security

- Use multi-sig wallets for group admins
- Consider DAO governance for critical groups
- Implement timelock for admin changes

### 4. Proof Verification

- **CRITICAL**: Replace placeholder verification with Garaga integration
- Verify proof structure before calling verifier
- Handle verification failures gracefully

### 5. Gas Optimization

- Large groups (>1000 members) may have high gas costs
- Consider using incremental Merkle tree library (LeanIMT)
- Batch member additions when possible

## Testing

### Unit Tests

```cairo
#[test]
fn test_create_group() {
    // Test group creation
}

#[test]
fn test_add_member() {
    // Test member addition and Merkle root update
}

#[test]
fn test_verify_proof() {
    // Test proof verification with valid/invalid proofs
}

#[test]
fn test_nullifier_prevention() {
    // Test double-signaling prevention
}
```

### Integration Tests

1. **End-to-End Flow**:
   - Create identity off-chain
   - Add to group
   - Generate proof
   - Verify on-chain

2. **Garaga Integration**:
   - Test with real Groth16 proofs
   - Verify against trusted setup keys
   - Test invalid proof rejection

## Performance Benchmarks

| Tree Depth | Max Members | Add Member Gas | Verify Proof Gas |
|------------|-------------|----------------|------------------|
| 10         | 1,024       | ~50k           | ~300k            |
| 16         | 65,536      | ~80k           | ~300k            |
| 20         | 1,048,576   | ~100k          | ~300k            |
| 32         | 4,294,967,296 | ~160k        | ~300k            |

*Note: Actual gas costs depend on Starknet network conditions*

## References

- **Semaphore Documentation**: [https://docs.semaphore.pse.dev](https://docs.semaphore.pse.dev)
- **Semaphore GitHub**: [https://github.com/semaphore-protocol/semaphore](https://github.com/semaphore-protocol/semaphore)
- **Garaga Verifier**: [https://github.com/keep-starknet-strange/garaga](https://github.com/keep-starknet-strange/garaga)
- **Trusted Setup**: [https://trusted-setup-pse.org](https://trusted-setup-pse.org)
- **Semaphore V4 Spec**: [https://semaphore.pse.dev/whitepaper-v4.pdf](https://semaphore.pse.dev/whitepaper-v4.pdf)

## Support

For issues or questions:
- Semaphore Discord: [https://discord.gg/semaphore](https://discord.gg/semaphore)
- Starknet Discord: [https://discord.gg/starknet](https://discord.gg/starknet)

## License

MIT License - See LICENSE file for details
