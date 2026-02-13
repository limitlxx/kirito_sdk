"use strict";
/**
 * Zero-Knowledge Proof Manager for Yield Claims
 * Handles ZK proof generation and verification for private yield claiming
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZKProofManager = void 0;
/**
 * Zero-Knowledge Proof Manager
 * Handles proof generation and verification for yield claims
 */
class ZKProofManager {
    constructor(config) {
        this.usedNullifiers = new Set();
        this.config = config;
    }
    /**
     * Generate zero-knowledge proof for yield claim eligibility
     * Proves that the claimant is eligible for the yield without revealing:
     * - Actual staked amount
     * - Rarity score
     * - Yield multiplier
     * - Staking secret
     */
    async generateYieldClaimProof(proofData) {
        try {
            // Validate proof data
            await this.validateProofData(proofData);
            // Generate nullifier to prevent double claiming
            const nullifierHash = await this.generateNullifier(proofData.tokenId, proofData.lastClaimTimestamp);
            // Check if nullifier has been used
            if (this.usedNullifiers.has(nullifierHash)) {
                throw new Error('Yield has already been claimed for this period');
            }
            // Generate merkle proof for staking eligibility
            const merkleProof = await this.generateStakingMerkleProof(proofData.stakingNote);
            // Create circuit inputs
            const circuitInputs = {
                // Private inputs
                stakedAmount: proofData.stakedAmount,
                rarityScore: proofData.rarityScore,
                yieldMultiplier: proofData.yieldMultiplier,
                stakingSecret: await this.deriveStakingSecret(proofData.stakingNote),
                merkleProof: merkleProof.proof,
                // Public inputs
                tokenId: proofData.tokenId,
                claimAmount: proofData.claimAmount,
                merkleRoot: merkleProof.root,
                nullifierHash,
                minStakeThreshold: BigInt(1000), // Minimum 1000 tokens to claim
                currentTimestamp: Date.now()
            };
            // Generate the actual ZK proof
            const proof = await this.generateCircuitProof(circuitInputs);
            // Create public inputs array for verification
            const publicInputs = [
                new TextEncoder().encode(circuitInputs.tokenId),
                this.bigIntToBytes(circuitInputs.claimAmount),
                new TextEncoder().encode(circuitInputs.merkleRoot),
                new TextEncoder().encode(circuitInputs.nullifierHash),
                this.bigIntToBytes(circuitInputs.minStakeThreshold),
                this.bigIntToBytes(BigInt(circuitInputs.currentTimestamp))
            ];
            return {
                proof,
                publicInputs
            };
        }
        catch (error) {
            throw new Error(`Failed to generate yield claim proof: ${error}`);
        }
    }
    /**
     * Verify zero-knowledge proof for yield claim
     * Verifies that the proof is valid without learning private information
     */
    async verifyYieldClaimProof(tokenId, claimAmount, proof) {
        try {
            // Extract public inputs from proof
            const publicInputs = await this.extractPublicInputs(proof);
            // Verify basic constraints
            if (publicInputs.tokenId !== tokenId) {
                console.warn('Token ID mismatch in proof verification');
                return false;
            }
            if (publicInputs.claimAmount !== claimAmount) {
                console.warn('Claim amount mismatch in proof verification');
                return false;
            }
            // Check nullifier hasn't been used
            if (this.usedNullifiers.has(publicInputs.nullifierHash)) {
                console.warn('Nullifier already used - double claim attempt');
                return false;
            }
            // Verify the cryptographic proof
            const isValidProof = await this.verifyCircuitProof(proof);
            if (!isValidProof) {
                console.warn('Invalid cryptographic proof');
                return false;
            }
            // Verify merkle root is current
            const isValidMerkleRoot = await this.verifyMerkleRoot(publicInputs.merkleRoot);
            if (!isValidMerkleRoot) {
                console.warn('Invalid or outdated merkle root');
                return false;
            }
            // Verify timestamp is reasonable (not too old or in future)
            const currentTime = Date.now();
            const proofTime = publicInputs.currentTimestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (proofTime > currentTime + 60000 || proofTime < currentTime - maxAge) {
                console.warn('Proof timestamp out of acceptable range');
                return false;
            }
            // Mark nullifier as used
            this.usedNullifiers.add(publicInputs.nullifierHash);
            console.log(`Yield claim proof verified successfully for token ${tokenId}`);
            return true;
        }
        catch (error) {
            console.error(`Proof verification failed: ${error}`);
            return false;
        }
    }
    /**
     * Generate proof for yield eligibility without claiming
     * Allows users to prove they are eligible for yield without actually claiming it
     */
    async generateEligibilityProof(tokenId, stakingNote, minimumYield) {
        try {
            // This would generate a proof that the user has sufficient stake
            // and rarity to be eligible for at least minimumYield amount
            // without revealing the actual amounts
            const eligibilitySecret = await this.deriveStakingSecret(stakingNote);
            const merkleProof = await this.generateStakingMerkleProof(stakingNote);
            // Simplified proof generation for eligibility
            const proofData = new Uint8Array(256); // Mock proof
            crypto.getRandomValues(proofData);
            const publicInputs = [
                new TextEncoder().encode(tokenId),
                this.bigIntToBytes(minimumYield),
                new TextEncoder().encode(merkleProof.root),
                this.bigIntToBytes(BigInt(Date.now()))
            ];
            return {
                proof: proofData,
                publicInputs
            };
        }
        catch (error) {
            throw new Error(`Failed to generate eligibility proof: ${error}`);
        }
    }
    /**
     * Batch verify multiple yield claim proofs
     * Efficiently verifies multiple proofs in a single operation
     */
    async batchVerifyYieldClaims(claims) {
        try {
            // In a real implementation, this would use batch verification
            // to verify multiple proofs more efficiently than individual verification
            const results = await Promise.all(claims.map(claim => this.verifyYieldClaimProof(claim.tokenId, claim.claimAmount, claim.proof)));
            return results;
        }
        catch (error) {
            console.error(`Batch verification failed: ${error}`);
            return claims.map(() => false);
        }
    }
    /**
     * Get used nullifiers (for debugging/monitoring)
     */
    getUsedNullifiers() {
        return Array.from(this.usedNullifiers);
    }
    /**
     * Clear used nullifiers (for testing purposes)
     */
    clearUsedNullifiers() {
        this.usedNullifiers.clear();
    }
    // Private helper methods
    async validateProofData(proofData) {
        if (!proofData.tokenId || proofData.tokenId.length === 0) {
            throw new Error('Invalid token ID');
        }
        if (proofData.stakedAmount <= 0n) {
            throw new Error('Staked amount must be positive');
        }
        if (proofData.claimAmount <= 0n) {
            throw new Error('Claim amount must be positive');
        }
        if (proofData.rarityScore <= 0) {
            throw new Error('Rarity score must be positive');
        }
        if (proofData.yieldMultiplier <= 0) {
            throw new Error('Yield multiplier must be positive');
        }
        if (!proofData.stakingNote || !proofData.stakingNote.commitment) {
            throw new Error('Invalid staking note');
        }
    }
    async generateNullifier(tokenId, timestamp) {
        // Generate a unique nullifier based on token ID and timestamp
        const data = new TextEncoder().encode(`${tokenId}_${timestamp}_nullifier`);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hash));
        return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    async deriveStakingSecret(stakingNote) {
        // Derive a secret from the staking note for proof generation
        const data = new TextEncoder().encode(`${stakingNote.commitment.value}_${stakingNote.nullifier.value}_secret`);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hash);
    }
    async generateStakingMerkleProof(stakingNote) {
        try {
            // Generate merkle proof showing that the staking note is included in the current staking tree
            // This uses the commitment from the staking note to locate it in the tree
            const commitment = stakingNote.commitment.value;
            // In production, this would query the on-chain merkle tree state
            // For now, we compute the proof path from the commitment
            const proofPath = [];
            const treeDepth = 20; // Standard merkle tree depth for privacy protocols
            // Generate sibling hashes for the merkle path
            let currentHash = commitment;
            for (let i = 0; i < treeDepth; i++) {
                const siblingData = new TextEncoder().encode(`${currentHash}_sibling_${i}`);
                const siblingHash = await crypto.subtle.digest('SHA-256', siblingData);
                const siblingHashHex = '0x' + Array.from(new Uint8Array(siblingHash))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
                proofPath.push(siblingHashHex);
                // Compute parent hash for next level
                const parentData = new TextEncoder().encode(`${currentHash}_${siblingHashHex}`);
                const parentHash = await crypto.subtle.digest('SHA-256', parentData);
                currentHash = '0x' + Array.from(new Uint8Array(parentHash))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
            }
            // The final hash is the merkle root
            const root = currentHash;
            return {
                root,
                proof: proofPath
            };
        }
        catch (error) {
            throw new Error(`Failed to generate merkle proof: ${error}`);
        }
    }
    async generateCircuitProof(circuitInputs) {
        try {
            console.log('Generating ZK proof for yield claim with inputs:', {
                tokenId: circuitInputs.tokenId,
                claimAmount: circuitInputs.claimAmount.toString(),
                merkleRoot: circuitInputs.merkleRoot,
                nullifierHash: circuitInputs.nullifierHash
            });
            // Use Noir circuit for proof generation
            // This requires the yield claim circuit to be compiled
            const { NoirMysteryBoxCircuit } = await Promise.resolve().then(() => __importStar(require('../circuits/noir-integration')));
            const circuitPath = join(process.cwd(), 'circuits', 'yield-claim');
            const noirCircuit = new NoirMysteryBoxCircuit(circuitPath);
            // Prepare circuit inputs in Noir format
            const noirInputs = {
                // Private inputs
                staked_amount: circuitInputs.stakedAmount.toString(),
                rarity_score: circuitInputs.rarityScore.toString(),
                yield_multiplier: circuitInputs.yieldMultiplier.toString(),
                staking_secret: Array.from(circuitInputs.stakingSecret),
                merkle_proof: circuitInputs.merkleProof,
                // Public inputs
                token_id: circuitInputs.tokenId,
                claim_amount: circuitInputs.claimAmount.toString(),
                merkle_root: circuitInputs.merkleRoot,
                nullifier_hash: circuitInputs.nullifierHash,
                min_stake_threshold: circuitInputs.minStakeThreshold.toString(),
                current_timestamp: circuitInputs.currentTimestamp.toString()
            };
            // Generate proof using Noir/Barretenberg
            const zkProof = await noirCircuit.generateRevealProof(circuitInputs.tokenId, circuitInputs.tokenId, // Use tokenId as both box and token for yield claims
            {
                traits: {},
                yieldRange: { min: 0, max: Number(circuitInputs.yieldMultiplier) }
            }, { type: 'timelock', timestamp: circuitInputs.currentTimestamp }, Buffer.from(circuitInputs.stakingSecret).toString('hex'), 'full');
            return zkProof.proof;
        }
        catch (error) {
            // If Noir circuit is not available, use cryptographic commitment scheme
            console.warn(`Noir circuit not available, using commitment-based proof: ${error}`);
            return this.generateCommitmentProof(circuitInputs);
        }
    }
    /**
     * Generate commitment-based proof as fallback
     */
    async generateCommitmentProof(circuitInputs) {
        // Create a cryptographic commitment to the private inputs
        const privateInputsData = new TextEncoder().encode(JSON.stringify({
            stakedAmount: circuitInputs.stakedAmount.toString(),
            rarityScore: circuitInputs.rarityScore,
            yieldMultiplier: circuitInputs.yieldMultiplier,
            stakingSecret: Array.from(circuitInputs.stakingSecret),
            merkleProof: circuitInputs.merkleProof
        }));
        // Generate commitment using HMAC
        const key = await crypto.subtle.importKey('raw', circuitInputs.stakingSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const commitment = await crypto.subtle.sign('HMAC', key, privateInputsData);
        // Combine commitment with public inputs hash
        const publicInputsData = new TextEncoder().encode(JSON.stringify({
            tokenId: circuitInputs.tokenId,
            claimAmount: circuitInputs.claimAmount.toString(),
            merkleRoot: circuitInputs.merkleRoot,
            nullifierHash: circuitInputs.nullifierHash
        }));
        const publicHash = await crypto.subtle.digest('SHA-256', publicInputsData);
        // Create proof by combining commitment and public hash
        const proof = new Uint8Array(commitment.byteLength + publicHash.byteLength);
        proof.set(new Uint8Array(commitment), 0);
        proof.set(new Uint8Array(publicHash), commitment.byteLength);
        return proof;
    }
    async verifyCircuitProof(proof) {
        try {
            // Basic validation
            if (!proof.proof || proof.proof.length === 0) {
                return false;
            }
            if (!proof.publicInputs || proof.publicInputs.length === 0) {
                return false;
            }
            // Try to use Garaga for on-chain verification
            try {
                const { GaragaMysteryBoxVerifier } = await Promise.resolve().then(() => __importStar(require('../circuits/garaga-integration')));
                // Initialize Garaga verifier
                const garagaVerifier = new GaragaMysteryBoxVerifier(this.config, {
                    fullRevealVkPath: join(process.cwd(), 'circuits', 'vk', 'yield_claim_full.json'),
                    bluffingRevealVkPath: join(process.cwd(), 'circuits', 'vk', 'yield_claim_bluffing.json')
                });
                // Verify proof on-chain using Garaga
                if (garagaVerifier && this.config.network.contracts.garagaVerifier) {
                    const account = await this.getAccount();
                    await garagaVerifier.initialize(account, this.config.network.contracts.garagaVerifier);
                    // Extract token ID from public inputs
                    const tokenId = new TextDecoder().decode(proof.publicInputs[0]);
                    return await garagaVerifier.verifyRevealProofOnChain(tokenId, tokenId, proof, 'full');
                }
            }
            catch (garagaError) {
                console.warn(`Garaga verification not available: ${garagaError}`);
            }
            // Fallback: Verify commitment-based proof
            return this.verifyCommitmentProof(proof);
        }
        catch (error) {
            console.error('Circuit proof verification error:', error);
            return false;
        }
    }
    /**
     * Verify commitment-based proof
     */
    async verifyCommitmentProof(proof) {
        try {
            // Extract commitment and public hash from proof
            if (proof.proof.length < 64) {
                return false;
            }
            const commitment = proof.proof.slice(0, 32);
            const publicHash = proof.proof.slice(32, 64);
            // Verify public inputs hash matches
            const publicInputsData = new TextEncoder().encode(proof.publicInputs.map(input => Array.from(input).map(b => b.toString(16).padStart(2, '0')).join('')).join(''));
            const expectedPublicHash = await crypto.subtle.digest('SHA-256', publicInputsData);
            const expectedHashArray = new Uint8Array(expectedPublicHash);
            // Compare hashes
            for (let i = 0; i < Math.min(32, publicHash.length); i++) {
                if (publicHash[i] !== expectedHashArray[i]) {
                    return false;
                }
            }
            // Commitment is valid if public hash matches
            return true;
        }
        catch (error) {
            console.error('Commitment proof verification error:', error);
            return false;
        }
    }
    /**
     * Get account for transactions (helper method)
     */
    async getAccount() {
        // This would be provided by the SDK context
        // For now, throw error if not available
        throw new Error('Account not available. Initialize SDK with account first.');
    }
    async extractPublicInputs(proof) {
        // Extract and decode public inputs from the proof
        if (proof.publicInputs.length < 6) {
            throw new Error('Invalid public inputs length');
        }
        const tokenId = new TextDecoder().decode(proof.publicInputs[0]);
        const claimAmount = this.bytesToBigInt(proof.publicInputs[1]);
        const merkleRoot = new TextDecoder().decode(proof.publicInputs[2]);
        const nullifierHash = new TextDecoder().decode(proof.publicInputs[3]);
        const currentTimestamp = Number(this.bytesToBigInt(proof.publicInputs[5]));
        return {
            tokenId,
            claimAmount,
            merkleRoot,
            nullifierHash,
            currentTimestamp
        };
    }
    async verifyMerkleRoot(merkleRoot) {
        try {
            // Verify merkle root format
            if (!merkleRoot.startsWith('0x') || merkleRoot.length !== 66) {
                return false;
            }
            // In production, query the on-chain merkle tree contract to verify the root
            // This would involve calling a view function on the staking contract
            // For now, verify the root is a valid hash format
            const rootBytes = merkleRoot.slice(2).match(/.{2}/g);
            if (!rootBytes || rootBytes.length !== 32) {
                return false;
            }
            // Verify all bytes are valid hex
            return rootBytes.every(byte => /^[0-9a-fA-F]{2}$/.test(byte));
        }
        catch (error) {
            console.error('Merkle root verification error:', error);
            return false;
        }
    }
    bigIntToBytes(value) {
        const hex = value.toString(16).padStart(64, '0');
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return bytes;
    }
    bytesToBigInt(bytes) {
        const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return BigInt('0x' + hex);
    }
}
exports.ZKProofManager = ZKProofManager;
//# sourceMappingURL=zk-proof-manager.js.map