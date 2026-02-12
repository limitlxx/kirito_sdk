# Mystery Box Reveal Circuit

This directory contains the Noir circuit for mystery box reveals with privacy preservation.

## Circuit Compilation

The circuit has been successfully compiled using Nargo 1.0.0-beta.18.

```bash
cd src/circuits
nargo compile
```

The compiled circuit is available at: `target/mystery_box_reveal.json`

## Circuit Features

### Full Reveal Mode (reveal_type = 1)
- Verifies all hidden traits are properly hashed
- Validates trait categories (POWER, ABILITY, YIELD, RARITY)
- Checks yield multipliers are within reasonable bounds (1-500)
- Verifies reveal conditions are met (timelock, action, or combined)

### Bluffing Reveal Mode (reveal_type = 2)
- Proves knowledge of a trait in a specific category
- Does NOT reveal the actual trait value
- Maintains privacy while proving category membership
- Useful for strategic gameplay without full disclosure

## Circuit Inputs

### Public Inputs
- `box_id`: Unique identifier for the mystery box
- `token_id`: NFT token ID
- `current_timestamp`: Current block timestamp
- `merkle_root`: Root of merkle tree containing all mystery boxes
- `nullifier`: Prevents double-reveals
- `reveal_type`: 1 for full reveal, 2 for bluffing

### Private Inputs (Witness)
- `traits`: Array of up to 10 hidden traits
- `trait_count`: Number of actual traits (rest are padding)
- `encryption_key`: Key used to encrypt trait data
- `reveal_conditions`: Conditions that must be met for reveal
- `merkle_proof`: Proof of box existence in merkle tree
- `action_proof`: Proof that required action was completed
- `bluff_category`: Category to prove for bluffing mode

## Verification Key Generation

To generate verification keys for Garaga integration:

```bash
# Generate verification key (requires Garaga CLI)
garaga gen --system groth16 --circuit target/mystery_box_reveal.json --output vk.json

# Generate Cairo verifier contract
garaga gen --system groth16 --vk vk.json --output ../contracts/src/mystery_box_verifier.cairo
```

## Testing

Test inputs are provided in `Prover.toml`. To execute the circuit:

```bash
nargo execute
```

Note: The test inputs use simplified values. In production, all hash values must be computed using the actual Pedersen hash function to match the circuit's verification logic.

## Integration with SDK

The TypeScript SDK integrates with this circuit through:
- `src/circuits/noir-integration.ts`: Handles circuit compilation and proof generation
- `src/circuits/garaga-integration.ts`: Manages on-chain verification via Garaga

## Security Considerations

1. **Nullifier Uniqueness**: Each reveal must use a unique nullifier to prevent replay attacks
2. **Merkle Proof Verification**: Ensures the mystery box exists in the registered set
3. **Condition Verification**: Time-locks and action requirements are enforced
4. **Category Validation**: Only valid trait categories are accepted
5. **Yield Bounds**: Multipliers are capped at 500 to prevent overflow attacks
