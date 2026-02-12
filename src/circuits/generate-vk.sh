#!/bin/bash

# Script to generate verification keys for Garaga integration
# Requires: Garaga CLI (https://garaga.gitbook.io/garaga)

set -e

echo "=== Mystery Box Reveal Circuit - Verification Key Generation ==="
echo ""

# Check if Garaga is installed
if ! command -v garaga &> /dev/null; then
    echo "ERROR: Garaga CLI not found"
    echo "Please install Garaga: pip install garaga"
    echo "Documentation: https://garaga.gitbook.io/garaga"
    exit 1
fi

# Ensure circuit is compiled
if [ ! -f "target/mystery_box_reveal.json" ]; then
    echo "Compiling Noir circuit..."
    nargo compile
fi

echo "Generating verification keys..."
echo ""

# Generate verification key for full reveal circuit
echo "1. Generating full reveal verification key..."
garaga gen --system groth16 \
    --circuit target/mystery_box_reveal.json \
    --output target/full_reveal_vk.json

echo "✓ Full reveal VK generated: target/full_reveal_vk.json"
echo ""

# Generate verification key for bluffing reveal circuit
# (Same circuit, different proof type - VK is the same)
echo "2. Generating bluffing reveal verification key..."
cp target/full_reveal_vk.json target/bluffing_reveal_vk.json
echo "✓ Bluffing reveal VK generated: target/bluffing_reveal_vk.json"
echo ""

# Generate Cairo verifier contract
echo "3. Generating Cairo verifier contract..."
garaga gen --system groth16 \
    --vk target/full_reveal_vk.json \
    --output ../../contracts/src/mystery_box_garaga_verifier.cairo

echo "✓ Cairo verifier generated: contracts/src/mystery_box_garaga_verifier.cairo"
echo ""

echo "=== Verification Key Generation Complete ==="
echo ""
echo "Next steps:"
echo "1. Review the generated Cairo verifier contract"
echo "2. Deploy the verifier contract to Starknet"
echo "3. Update SDK configuration with verifier contract address"
echo ""
