"use strict";
/**
 * Garaga Integration for On-Chain ZK Proof Verification
 * Production implementation for Starknet proof verification using Garaga
 * Based on official Garaga documentation: https://garaga.gitbook.io/garaga
 *
 * Prerequisites:
 * - npm install garaga@latest
 * - Compiled Noir circuits with verification keys
 * - Deployed Garaga verifier contract on Starknet
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GaragaCLIHelper = exports.GaragaMysteryBoxVerifier = void 0;
const starknet_1 = require("starknet");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Garaga SDK Integration for Mystery Box Verification
 * Production-ready on-chain proof verification using Garaga verifier contracts
 */
class GaragaMysteryBoxVerifier {
    constructor(config, vkConfig) {
        this.config = config;
        this.provider = new starknet_1.RpcProvider({ nodeUrl: config.network.rpcUrl });
        this.vkConfig = vkConfig;
        // Load verification key hashes from compiled circuits
        this.fullRevealVkHashPromise = this.loadVerificationKeyHash(vkConfig.fullRevealVkPath);
        this.bluffingRevealVkHashPromise = this.loadVerificationKeyHash(vkConfig.bluffingRevealVkPath);
        console.log('Garaga verifier initialized with VK hashes:');
        // console.log(`  Full reveal: ${this.fullRevealVkHashPromise.substring(0, 16)}...`);
        // console.log(`  Bluffing reveal: ${this.bluffingRevealVkHashPromise.substring(0, 16)}...`);
    }
    /**
     * Load verification key hash from compiled circuit
     */
    async loadVerificationKeyHash(vkPath) {
        try {
            if (!(0, fs_1.existsSync)(vkPath)) {
                throw new Error(`Verification key file not found: ${vkPath}`);
            }
            const vkData = JSON.parse((0, fs_1.readFileSync)(vkPath, 'utf-8'));
            if (vkData.vk_hash) {
                return vkData.vk_hash;
            }
            return await this.computeVkHash(vkData); // ← await here
        }
        catch (error) {
            throw new Error(`Failed to load verification key from ${vkPath}: ${error}`);
        }
    }
    /**
     * Compute verification key hash from VK data
     */
    async computeVkHash(vkData) {
        const vkString = JSON.stringify(vkData);
        const encoder = new TextEncoder();
        const data = encoder.encode(vkString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return '0x' + hashHex;
    }
    /**
     * Initialize Garaga verifier contract with real ABI
     */
    async initialize(account, verifierContractAddress) {
        try {
            this.account = account;
            const contractAddress = verifierContractAddress || this.vkConfig.verifierContractAddress;
            if (!contractAddress) {
                throw new Error('Verifier contract address not provided. Deploy contract first or provide address.');
            }
            const verifierAbi = this.loadVerifierAbi();
            // Preferred: pass Account directly (it includes provider + signer)
            // Fallback to provider only if no account
            const connected = this.account ?? this.provider;
            this.verifierContract = new starknet_1.Contract({
                abi: verifierAbi, // cast if TS complains about exact Abi shape
                address: contractAddress,
                providerOrAccount: this.account ?? this.provider, // Account preferred over plain Provider
            });
            // No need to call .connect() again in most cases
            // If you really need to force a different signer/provider later:
            // this.verifierContract = this.verifierContract.connect(this.account);
            await this.verifyContractConnection();
            console.log(`Garaga verifier contract initialized at ${contractAddress}`);
        }
        catch (error) {
            throw new Error(`Failed to initialize Garaga verifier: ${error}`);
        }
    }
    /**
     * Load verifier contract ABI from compiled contract
     */
    loadVerifierAbi() {
        try {
            // Try to load ABI from compiled contract artifacts
            const abiPath = (0, path_1.join)(process.cwd(), 'contracts', 'target', 'dev', 'garaga_verifier.contract_class.json');
            if ((0, fs_1.existsSync)(abiPath)) {
                const contractClass = JSON.parse((0, fs_1.readFileSync)(abiPath, 'utf-8'));
                return contractClass.abi;
            }
            // Fallback: load from separate ABI file
            const fallbackAbiPath = (0, path_1.join)(process.cwd(), 'contracts', 'abis', 'garaga_verifier.json');
            if ((0, fs_1.existsSync)(fallbackAbiPath)) {
                return JSON.parse((0, fs_1.readFileSync)(fallbackAbiPath, 'utf-8'));
            }
            throw new Error('Verifier contract ABI not found. Compile contracts first with: scarb build');
        }
        catch (error) {
            throw new Error(`Failed to load verifier ABI: ${error}`);
        }
    }
    /**
     * Verify contract connection is working
     */
    async verifyContractConnection() {
        if (!this.verifierContract) {
            throw new Error('Contract not initialized');
        }
        try {
            // Try to call a view function to verify connection
            await this.verifierContract.call('get_full_reveal_vk_hash');
            console.log('Contract connection verified');
        }
        catch (error) {
            throw new Error(`Contract connection failed: ${error}. Ensure contract is deployed and address is correct.`);
        }
    }
    /**
     * Verify mystery box reveal proof on-chain using Garaga
     * Production implementation with proper error handling
     */
    async verifyRevealProofOnChain(boxId, tokenId, proof, revealType = 'full') {
        try {
            if (!this.verifierContract) {
                throw new Error('Verifier contract not initialized. Call initialize() first.');
            }
            // Convert proof to Garaga format
            const garagaProof = await this.convertToGaragaFormat(proof, revealType);
            console.log(`Verifying ${revealType} reveal proof on-chain for mystery box ${boxId}...`);
            // Call Garaga verifier contract using BN254 curve
            const result = await this.verifierContract.call('verify_groth16_proof_bn254', starknet_1.CallData.compile({
                proof: garagaProof.proof,
                public_inputs: garagaProof.public_inputs,
                vk_hash: starknet_1.cairo.felt(garagaProof.verification_key_hash)
            }));
            // Parse result based on contract return type
            const isValid = this.parseVerificationResult(result);
            if (isValid) {
                console.log('✓ On-chain proof verification successful');
            }
            else {
                console.warn('✗ On-chain proof verification failed');
            }
            return isValid;
        }
        catch (error) {
            console.error(`On-chain proof verification error: ${error}`);
            throw new Error(`Proof verification failed: ${error}`);
        }
    }
    /**
     * Parse verification result from contract call
     */
    parseVerificationResult(result) {
        // Handle different return formats from Starknet contracts
        if (typeof result === 'boolean') {
            return result;
        }
        if (typeof result === 'object' && result !== null) {
            // Check for common field names
            if ('is_valid' in result) {
                return result.is_valid === true || result.is_valid === 1n || result.is_valid === '1';
            }
            if ('success' in result) {
                return result.success === true || result.success === 1n || result.success === '1';
            }
            // If result is an array, check first element
            if (Array.isArray(result) && result.length > 0) {
                return result[0] === true || result[0] === 1n || result[0] === '1';
            }
        }
        // Handle bigint/string representations
        if (result === 1n || result === '1' || result === 1) {
            return true;
        }
        return false;
    }
    /**
     * Submit mystery box reveal transaction on-chain
     * Production implementation with proper transaction handling
     */
    async submitRevealTransaction(boxId, proof, nullifier, revealType = 'full') {
        try {
            if (!this.verifierContract || !this.account) {
                throw new Error('Contract or account not initialized. Call initialize() first.');
            }
            // Convert proof to Garaga format
            const garagaProof = await this.convertToGaragaFormat(proof, revealType);
            console.log(`Submitting ${revealType} reveal transaction for mystery box ${boxId}...`);
            // Prepare call data
            const callData = starknet_1.CallData.compile({
                box_id: starknet_1.cairo.felt(this.stringToFelt(boxId)),
                proof_data: garagaProof.proof.map(p => starknet_1.cairo.felt(p)),
                public_inputs: garagaProof.public_inputs.map(pi => starknet_1.cairo.felt(pi)),
                nullifier: starknet_1.cairo.felt(nullifier),
                reveal_type: starknet_1.cairo.felt(revealType === 'full' ? '1' : '2')
            });
            // Submit transaction to reveal mystery box
            const response = await this.account.execute({
                contractAddress: this.verifierContract.address,
                entrypoint: 'verify_mystery_box_reveal',
                calldata: callData
            });
            // Wait for transaction confirmation
            console.log(`Transaction submitted: ${response.transaction_hash}`);
            console.log('Waiting for confirmation...');
            await this.provider.waitForTransaction(response.transaction_hash);
            console.log(`✓ Reveal transaction confirmed: ${response.transaction_hash}`);
            return response.transaction_hash;
        }
        catch (error) {
            throw new Error(`Failed to submit reveal transaction: ${error}`);
        }
    }
    /**
     * Generate Garaga verifier contract using Garaga CLI
     * Production implementation that actually executes Garaga commands
     *
     * Prerequisites:
     * - Garaga CLI installed: pip install garaga
     * - Compiled Noir circuit with verification key
     *
     * Steps:
     * 1. garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     * 2. Compile with scarb build
     * 3. Deploy using starkli or scarb
     */
    async generateVerifierContract(vkPath, outputPath, system = 'groth16') {
        try {
            console.log('Generating Garaga verifier contract...');
            console.log(`  VK path: ${vkPath}`);
            console.log(`  Output path: ${outputPath}`);
            console.log(`  System: ${system}`);
            // Verify verification key exists
            if (!(0, fs_1.existsSync)(vkPath)) {
                throw new Error(`Verification key not found at ${vkPath}`);
            }
            // Execute Garaga CLI command
            const command = `garaga gen --system ${system} --vk ${vkPath} --output ${outputPath}`;
            console.log(`Executing: ${command}`);
            try {
                const output = (0, child_process_1.execSync)(command, {
                    encoding: 'utf-8',
                    stdio: 'pipe'
                });
                console.log('Garaga CLI output:', output);
            }
            catch (execError) {
                // Check if Garaga is installed
                if (execError.message.includes('command not found') || execError.message.includes('not recognized')) {
                    throw new Error('Garaga CLI not found. Install with: pip install garaga\n' +
                        'See: https://garaga.gitbook.io/garaga');
                }
                throw execError;
            }
            // Verify output file was created
            if (!(0, fs_1.existsSync)(outputPath)) {
                throw new Error(`Verifier contract not generated at ${outputPath}`);
            }
            console.log('✓ Verifier contract generated successfully');
            console.log(`  Contract file: ${outputPath}`);
            console.log('\nNext steps:');
            console.log('  1. Add contract to Scarb.toml');
            console.log('  2. Run: scarb build');
            console.log('  3. Deploy with: starkli declare && starkli deploy');
        }
        catch (error) {
            throw new Error(`Failed to generate verifier contract: ${error}`);
        }
    }
    /**
     * Deploy Garaga verifier contract to Starknet
     * Production implementation using Starknet.js
     */
    async deployVerifierContract(compiledContractPath, constructorCalldata) {
        try {
            if (!this.account) {
                throw new Error('Account not initialized. Call initialize() first.');
            }
            console.log('Deploying Garaga verifier contract...');
            console.log(`  Compiled contract: ${compiledContractPath}`);
            // Load compiled contract
            if (!(0, fs_1.existsSync)(compiledContractPath)) {
                throw new Error(`Compiled contract not found at ${compiledContractPath}`);
            }
            const compiledContract = JSON.parse((0, fs_1.readFileSync)(compiledContractPath, 'utf-8'));
            // Declare contract class
            console.log('Declaring contract class...');
            const declareResponse = await this.account.declareIfNot({
                contract: compiledContract,
                casm: compiledContract.casm || compiledContract
            });
            const classHash = declareResponse.class_hash;
            console.log(`✓ Contract class declared: ${classHash}`);
            // Deploy contract instance
            console.log('Deploying contract instance...');
            const deployResponse = await this.account.deployContract({
                classHash,
                constructorCalldata: starknet_1.CallData.compile(constructorCalldata)
            });
            await this.provider.waitForTransaction(deployResponse.transaction_hash);
            const contractAddress = deployResponse.contract_address;
            console.log(`✓ Verifier contract deployed at: ${contractAddress}`);
            console.log(`  Transaction: ${deployResponse.transaction_hash}`);
            // Save deployment info
            this.saveDeploymentInfo(contractAddress, classHash, deployResponse.transaction_hash);
            return contractAddress;
        }
        catch (error) {
            throw new Error(`Failed to deploy verifier contract: ${error}`);
        }
    }
    /**
     * Save deployment information for future reference
     */
    saveDeploymentInfo(contractAddress, classHash, txHash) {
        try {
            const deploymentInfo = {
                contractAddress,
                classHash,
                transactionHash: txHash,
                network: this.config.network.name,
                deployedAt: new Date().toISOString()
            };
            const deploymentPath = (0, path_1.join)(process.cwd(), 'deployments', `garaga_verifier_${this.config.network.name}.json`);
            (0, fs_1.writeFileSync)(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
            console.log(`Deployment info saved to: ${deploymentPath}`);
        }
        catch (error) {
            console.warn(`Failed to save deployment info: ${error}`);
        }
    }
    /**
     * Get verification key hash for proof type
     */
    async getVerificationKeyHash(proofType) {
        return proofType === 'full' ? await this.fullRevealVkHashPromise : await this.bluffingRevealVkHashPromise;
    }
    /**
     * Update verification key hashes (for contract upgrades)
     * Production implementation with proper transaction handling
     */
    async updateVerificationKeys(fullRevealVk, bluffingRevealVk) {
        try {
            if (!this.verifierContract || !this.account) {
                throw new Error('Contract or account not initialized. Call initialize() first.');
            }
            console.log('Updating verification keys...');
            console.log(`  Full reveal VK: ${fullRevealVk.substring(0, 16)}...`);
            console.log(`  Bluffing reveal VK: ${bluffingRevealVk.substring(0, 16)}...`);
            // Prepare call data
            const callData = starknet_1.CallData.compile({
                full_reveal_vk: starknet_1.cairo.felt(fullRevealVk),
                bluffing_reveal_vk: starknet_1.cairo.felt(bluffingRevealVk)
            });
            // Execute update transaction
            const response = await this.account.execute({
                contractAddress: this.verifierContract.address,
                entrypoint: 'update_verification_keys',
                calldata: callData
            });
            console.log(`Transaction submitted: ${response.transaction_hash}`);
            await this.provider.waitForTransaction(response.transaction_hash);
            // Update local cache
            this.fullRevealVkHashPromise = Promise.resolve(fullRevealVk);
            this.bluffingRevealVkHashPromise = Promise.resolve(bluffingRevealVk);
            console.log('✓ Verification keys updated successfully');
        }
        catch (error) {
            throw new Error(`Failed to update verification keys: ${error}`);
        }
    }
    // Private helper methods
    /**
     * Convert ZKProof to Garaga format
     */
    async convertToGaragaFormat(proof, revealType) {
        // Convert proof bytes to felt array
        const proofFelts = this.bytesToFeltArray(proof.proof);
        // Convert public inputs to felt array
        const publicInputsFelts = proof.publicInputs.map(input => this.bytesToFelt(input));
        // Get appropriate verification key hash
        const vkHash = await this.getVerificationKeyHash(revealType);
        return {
            proof: proofFelts,
            public_inputs: publicInputsFelts,
            verification_key_hash: vkHash
        };
    }
    /**
     * Convert bytes to Starknet felt
     */
    bytesToFelt(bytes) {
        // Convert bytes to big integer then to felt string
        // Ensure we don't exceed felt252 max value
        const MAX_FELT = BigInt('0x800000000000011000000000000000000000000000000000000000000000000');
        let value = BigInt(0);
        for (let i = 0; i < Math.min(bytes.length, 31); i++) {
            value = (value << BigInt(8)) + BigInt(bytes[i]);
        }
        // Ensure value is within felt252 range
        if (value >= MAX_FELT) {
            value = value % MAX_FELT;
        }
        return '0x' + value.toString(16);
    }
    /**
     * Convert bytes array to felt array
     */
    bytesToFeltArray(bytes) {
        const felts = [];
        // Split bytes into 31-byte chunks (max felt size)
        for (let i = 0; i < bytes.length; i += 31) {
            const chunk = bytes.slice(i, i + 31);
            felts.push(this.bytesToFelt(chunk));
        }
        return felts;
    }
    /**
     * Convert string to felt
     */
    stringToFelt(str) {
        const bytes = new TextEncoder().encode(str);
        return this.bytesToFelt(bytes);
    }
}
exports.GaragaMysteryBoxVerifier = GaragaMysteryBoxVerifier;
/**
 * Garaga CLI Integration Helper
 * Production utilities for working with Garaga command-line tools
 * Based on official Garaga CLI: https://garaga.gitbook.io/garaga
 */
class GaragaCLIHelper {
    /**
     * Generate verification key from Noir circuit
     * Requires: nargo compile && garaga gen
     */
    static async generateVerificationKey(circuitPath, outputPath) {
        try {
            console.log('Generating verification key for circuit:', circuitPath);
            // Verify circuit exists
            if (!(0, fs_1.existsSync)(circuitPath)) {
                throw new Error(`Circuit not found at ${circuitPath}`);
            }
            // Execute: nargo compile
            console.log('Compiling Noir circuit...');
            const compileCommand = `cd ${circuitPath} && nargo compile`;
            (0, child_process_1.execSync)(compileCommand, { encoding: 'utf-8', stdio: 'pipe' });
            // Execute: garaga gen
            const targetPath = (0, path_1.join)(circuitPath, 'target');
            const vkCommand = `garaga gen --system groth16 --circuit ${targetPath} --output ${outputPath}`;
            console.log(`Executing: ${vkCommand}`);
            const output = (0, child_process_1.execSync)(vkCommand, { encoding: 'utf-8', stdio: 'pipe' });
            console.log('Garaga output:', output);
            if (!(0, fs_1.existsSync)(outputPath)) {
                throw new Error(`Verification key not generated at ${outputPath}`);
            }
            console.log('✓ Verification key generated:', outputPath);
            return outputPath;
        }
        catch (error) {
            throw new Error(`Failed to generate verification key: ${error}`);
        }
    }
    /**
     * Generate verifier contract from verification key
     * Command: garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
     */
    static async generateVerifierContract(vkPath, outputPath) {
        try {
            console.log('Generating verifier contract from VK:', vkPath);
            if (!(0, fs_1.existsSync)(vkPath)) {
                throw new Error(`Verification key not found at ${vkPath}`);
            }
            const command = `garaga gen --system groth16 --vk ${vkPath} --output ${outputPath}`;
            console.log(`Executing: ${command}`);
            const output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
            console.log('Garaga output:', output);
            if (!(0, fs_1.existsSync)(outputPath)) {
                throw new Error(`Verifier contract not generated at ${outputPath}`);
            }
            console.log('✓ Verifier contract generated:', outputPath);
        }
        catch (error) {
            throw new Error(`Failed to generate verifier contract: ${error}`);
        }
    }
    /**
     * Declare contract on Starknet using starkli
     * Requires: scarb build && starkli declare
     */
    static async declareContract(contractPath, accountPath, rpcUrl) {
        try {
            console.log('Declaring contract:', contractPath);
            // Build contract first
            const buildCommand = `scarb build`;
            console.log('Building contract...');
            (0, child_process_1.execSync)(buildCommand, { encoding: 'utf-8', stdio: 'pipe', cwd: (0, path_1.join)(contractPath, '..') });
            // Declare using starkli
            const declareCommand = `starkli declare ${contractPath} --account ${accountPath} --rpc ${rpcUrl}`;
            console.log(`Executing: ${declareCommand}`);
            const output = (0, child_process_1.execSync)(declareCommand, { encoding: 'utf-8', stdio: 'pipe' });
            // Extract class hash from output
            const classHashMatch = output.match(/0x[a-fA-F0-9]{64}/);
            if (!classHashMatch) {
                throw new Error('Failed to extract class hash from declare output');
            }
            const classHash = classHashMatch[0];
            console.log('✓ Contract declared with class hash:', classHash);
            return classHash;
        }
        catch (error) {
            throw new Error(`Failed to declare contract: ${error}`);
        }
    }
    /**
     * Deploy contract instance using starkli
     * Command: starkli deploy <class-hash> <constructor-args>
     */
    static async deployContract(classHash, constructorArgs, accountPath, rpcUrl) {
        try {
            console.log('Deploying contract with class hash:', classHash);
            const argsString = constructorArgs.join(' ');
            const deployCommand = `starkli deploy ${classHash} ${argsString} --account ${accountPath} --rpc ${rpcUrl}`;
            console.log(`Executing: ${deployCommand}`);
            const output = (0, child_process_1.execSync)(deployCommand, { encoding: 'utf-8', stdio: 'pipe' });
            // Extract contract address from output
            const addressMatch = output.match(/0x[a-fA-F0-9]{64}/);
            if (!addressMatch) {
                throw new Error('Failed to extract contract address from deploy output');
            }
            const contractAddress = addressMatch[0];
            console.log('✓ Contract deployed at:', contractAddress);
            return contractAddress;
        }
        catch (error) {
            throw new Error(`Failed to deploy contract: ${error}`);
        }
    }
    /**
     * Verify proof on-chain using Garaga verifier
     * Requires deployed verifier contract
     */
    static async verifyOnChain(contractAddress, vkPath, proofPath, publicInputsPath, accountPath, rpcUrl) {
        try {
            console.log('Verifying proof on-chain at contract:', contractAddress);
            // Load proof and public inputs
            if (!(0, fs_1.existsSync)(proofPath)) {
                throw new Error(`Proof file not found: ${proofPath}`);
            }
            if (!(0, fs_1.existsSync)(publicInputsPath)) {
                throw new Error(`Public inputs file not found: ${publicInputsPath}`);
            }
            const proof = JSON.parse((0, fs_1.readFileSync)(proofPath, 'utf-8'));
            const publicInputs = JSON.parse((0, fs_1.readFileSync)(publicInputsPath, 'utf-8'));
            const vk = JSON.parse((0, fs_1.readFileSync)(vkPath, 'utf-8'));
            // Call verifier contract
            const callCommand = `starkli call ${contractAddress} verify_groth16_proof_bn254 ${proof.proof.join(' ')} ${publicInputs.join(' ')} ${vk.vk_hash} --rpc ${rpcUrl}`;
            console.log(`Executing: ${callCommand}`);
            const output = (0, child_process_1.execSync)(callCommand, { encoding: 'utf-8', stdio: 'pipe' });
            // Parse result
            const isValid = output.includes('0x1') || output.includes('true');
            console.log(isValid ? '✓ Proof verified successfully' : '✗ Proof verification failed');
            return isValid;
        }
        catch (error) {
            throw new Error(`Failed to verify proof on-chain: ${error}`);
        }
    }
    /**
     * Check if Garaga CLI is installed
     */
    static async checkGaragaInstallation() {
        try {
            (0, child_process_1.execSync)('garaga --version', { encoding: 'utf-8', stdio: 'pipe' });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Install Garaga CLI
     */
    static async installGaraga() {
        try {
            console.log('Installing Garaga CLI...');
            (0, child_process_1.execSync)('pip install garaga', { encoding: 'utf-8', stdio: 'inherit' });
            console.log('✓ Garaga CLI installed successfully');
        }
        catch (error) {
            throw new Error(`Failed to install Garaga: ${error}`);
        }
    }
}
exports.GaragaCLIHelper = GaragaCLIHelper;
//# sourceMappingURL=garaga-integration.js.map