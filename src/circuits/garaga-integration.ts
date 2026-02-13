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

import { Account, Contract, RpcProvider, CallData, cairo, type Abi, type AccountInterface, type ProviderInterface } from 'starknet';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ZKProof,
  TokenId,
  BoxId,
  KiritoSDKConfig
} from '../types';

// Garaga proof types based on official documentation
export interface GaragaProof {
  proof: string[];
  public_inputs: string[];
  verification_key_hash: string;
}

// Garaga verifier contract interface
export interface GaragaVerifierContract {
  verify_groth16_proof_bn254(
    proof: string[],
    public_inputs: string[],
    vk_hash: string
  ): Promise<boolean>;
  
  verify_ultra_honk_proof(
    proof: string[],
    public_inputs: string[],
    vk_hash: string
  ): Promise<boolean>;
}

// Verification key configuration
export interface VerificationKeyConfig {
  fullRevealVkPath: string;
  bluffingRevealVkPath: string;
  verifierContractAddress?: string;
}

/**
 * Garaga SDK Integration for Mystery Box Verification
 * Production-ready on-chain proof verification using Garaga verifier contracts
 */
export class GaragaMysteryBoxVerifier {
  private config: KiritoSDKConfig;
  private provider: RpcProvider;
  private verifierContract?: Contract;
  private account?: Account;

  // Verification key hashes loaded from compiled circuits
  // private fullRevealVkHash: string;
  // private bluffingRevealVkHash: string;
  private fullRevealVkHashPromise: Promise<string>;
  private bluffingRevealVkHashPromise: Promise<string>;
  
  // Verification key configurations
  private vkConfig: VerificationKeyConfig;

  constructor(config: KiritoSDKConfig, vkConfig: VerificationKeyConfig) {
    this.config = config;
    this.provider = new RpcProvider({ nodeUrl: config.network.rpcUrl });
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
 private async loadVerificationKeyHash(vkPath: string): Promise<string> {
  try {
    if (!existsSync(vkPath)) {
      throw new Error(`Verification key file not found: ${vkPath}`);
    }

    const vkData = JSON.parse(readFileSync(vkPath, 'utf-8'));

    if (vkData.vk_hash) {
      return vkData.vk_hash;
    }

    return await this.computeVkHash(vkData);   // ← await here
  } catch (error) {
    throw new Error(`Failed to load verification key from ${vkPath}: ${error}`);
  }
}
  
  /**
   * Compute verification key hash from VK data
   */
  private async computeVkHash(vkData: any): Promise<string> {
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
async initialize(account: Account, verifierContractAddress?: string): Promise<void> {
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

   this.verifierContract = new Contract({
    abi: verifierAbi as Abi,  // cast if TS complains about exact Abi shape
    address: contractAddress,
    providerOrAccount: this.account ?? this.provider,  // Account preferred over plain Provider
  });

    // No need to call .connect() again in most cases
    // If you really need to force a different signer/provider later:
    // this.verifierContract = this.verifierContract.connect(this.account);

    await this.verifyContractConnection();

    console.log(`Garaga verifier contract initialized at ${contractAddress}`);
  } catch (error) {
    throw new Error(`Failed to initialize Garaga verifier: ${error}`);
  }
}
  
  /**
   * Load verifier contract ABI from compiled contract
   */
  private loadVerifierAbi(): any[] {
    try {
      // Try to load ABI from compiled contract artifacts
      const abiPath = join(process.cwd(), 'contracts', 'target', 'dev', 'garaga_verifier.contract_class.json');
      
      if (existsSync(abiPath)) {
        const contractClass = JSON.parse(readFileSync(abiPath, 'utf-8'));
        return contractClass.abi;
      }
      
      // Fallback: load from separate ABI file
      const fallbackAbiPath = join(process.cwd(), 'contracts', 'abis', 'garaga_verifier.json');
      if (existsSync(fallbackAbiPath)) {
        return JSON.parse(readFileSync(fallbackAbiPath, 'utf-8'));
      }
      
      throw new Error('Verifier contract ABI not found. Compile contracts first with: scarb build');
    } catch (error) {
      throw new Error(`Failed to load verifier ABI: ${error}`);
    }
  }
  
  /**
   * Verify contract connection is working
   */
  private async verifyContractConnection(): Promise<void> {
    if (!this.verifierContract) {
      throw new Error('Contract not initialized');
    }
    
    try {
      // Try to call a view function to verify connection
      await this.verifierContract.call('get_full_reveal_vk_hash');
      console.log('Contract connection verified');
    } catch (error) {
      throw new Error(`Contract connection failed: ${error}. Ensure contract is deployed and address is correct.`);
    }
  }

  /**
   * Verify mystery box reveal proof on-chain using Garaga
   * Production implementation with proper error handling
   */
  async verifyRevealProofOnChain(
    boxId: BoxId,
    tokenId: TokenId,
    proof: ZKProof,
    revealType: 'full' | 'bluffing' = 'full'
  ): Promise<boolean> {
    try {
      if (!this.verifierContract) {
        throw new Error('Verifier contract not initialized. Call initialize() first.');
      }

      // Convert proof to Garaga format
      const garagaProof = await this.convertToGaragaFormat(proof, revealType);
      
      console.log(`Verifying ${revealType} reveal proof on-chain for mystery box ${boxId}...`);

      // Call Garaga verifier contract using BN254 curve
      const result = await this.verifierContract.call(
        'verify_groth16_proof_bn254',
        CallData.compile({
          proof: garagaProof.proof,
          public_inputs: garagaProof.public_inputs,
          vk_hash: cairo.felt(garagaProof.verification_key_hash)
        })
      );

      // Parse result based on contract return type
      const isValid = this.parseVerificationResult(result);
      
      if (isValid) {
        console.log('✓ On-chain proof verification successful');
      } else {
        console.warn('✗ On-chain proof verification failed');
      }

      return isValid;
    } catch (error) {
      console.error(`On-chain proof verification error: ${error}`);
      throw new Error(`Proof verification failed: ${error}`);
    }
  }
  
  /**
   * Parse verification result from contract call
   */
  private parseVerificationResult(result: any): boolean {
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
  async submitRevealTransaction(
    boxId: BoxId,
    proof: ZKProof,
    nullifier: string,
    revealType: 'full' | 'bluffing' = 'full'
  ): Promise<string> {
    try {
      if (!this.verifierContract || !this.account) {
        throw new Error('Contract or account not initialized. Call initialize() first.');
      }

      // Convert proof to Garaga format
      const garagaProof = await this.convertToGaragaFormat(proof, revealType);

      console.log(`Submitting ${revealType} reveal transaction for mystery box ${boxId}...`);

      // Prepare call data
      const callData = CallData.compile({
        box_id: cairo.felt(this.stringToFelt(boxId)),
        proof_data: garagaProof.proof.map(p => cairo.felt(p)),
        public_inputs: garagaProof.public_inputs.map(pi => cairo.felt(pi)),
        nullifier: cairo.felt(nullifier),
        reveal_type: cairo.felt(revealType === 'full' ? '1' : '2')
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
    } catch (error) {
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
  async generateVerifierContract(
    vkPath: string,
    outputPath: string,
    system: 'groth16' | 'ultra_honk' = 'groth16'
  ): Promise<void> {
    try {
      console.log('Generating Garaga verifier contract...');
      console.log(`  VK path: ${vkPath}`);
      console.log(`  Output path: ${outputPath}`);
      console.log(`  System: ${system}`);
      
      // Verify verification key exists
      if (!existsSync(vkPath)) {
        throw new Error(`Verification key not found at ${vkPath}`);
      }
      
      // Execute Garaga CLI command
      const command = `garaga gen --system ${system} --vk ${vkPath} --output ${outputPath}`;
      console.log(`Executing: ${command}`);
      
      try {
        const output = execSync(command, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        console.log('Garaga CLI output:', output);
      } catch (execError: any) {
        // Check if Garaga is installed
        if (execError.message.includes('command not found') || execError.message.includes('not recognized')) {
          throw new Error(
            'Garaga CLI not found. Install with: pip install garaga\n' +
            'See: https://garaga.gitbook.io/garaga'
          );
        }
        throw execError;
      }
      
      // Verify output file was created
      if (!existsSync(outputPath)) {
        throw new Error(`Verifier contract not generated at ${outputPath}`);
      }
      
      console.log('✓ Verifier contract generated successfully');
      console.log(`  Contract file: ${outputPath}`);
      console.log('\nNext steps:');
      console.log('  1. Add contract to Scarb.toml');
      console.log('  2. Run: scarb build');
      console.log('  3. Deploy with: starkli declare && starkli deploy');
      
    } catch (error) {
      throw new Error(`Failed to generate verifier contract: ${error}`);
    }
  }

  /**
   * Deploy Garaga verifier contract to Starknet
   * Production implementation using Starknet.js
   */
  async deployVerifierContract(
    compiledContractPath: string,
    constructorCalldata: string[]
  ): Promise<string> {
    try {
      if (!this.account) {
        throw new Error('Account not initialized. Call initialize() first.');
      }

      console.log('Deploying Garaga verifier contract...');
      console.log(`  Compiled contract: ${compiledContractPath}`);

      // Load compiled contract
      if (!existsSync(compiledContractPath)) {
        throw new Error(`Compiled contract not found at ${compiledContractPath}`);
      }

      const compiledContract = JSON.parse(readFileSync(compiledContractPath, 'utf-8'));

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
        constructorCalldata: CallData.compile(constructorCalldata)
      });

      await this.provider.waitForTransaction(deployResponse.transaction_hash);

      const contractAddress = deployResponse.contract_address;
      console.log(`✓ Verifier contract deployed at: ${contractAddress}`);
      console.log(`  Transaction: ${deployResponse.transaction_hash}`);

      // Save deployment info
      this.saveDeploymentInfo(contractAddress, classHash, deployResponse.transaction_hash);

      return contractAddress;
    } catch (error) {
      throw new Error(`Failed to deploy verifier contract: ${error}`);
    }
  }

  /**
   * Save deployment information for future reference
   */
  private saveDeploymentInfo(contractAddress: string, classHash: string, txHash: string): void {
    try {
      const deploymentInfo = {
        contractAddress,
        classHash,
        transactionHash: txHash,
        network: this.config.network.name,
        deployedAt: new Date().toISOString()
      };

      const deploymentPath = join(process.cwd(), 'deployments', `garaga_verifier_${this.config.network.name}.json`);
      writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`Deployment info saved to: ${deploymentPath}`);
    } catch (error) {
      console.warn(`Failed to save deployment info: ${error}`);
    }
  }

  /**
   * Get verification key hash for proof type
   */
  async getVerificationKeyHash(proofType: 'full' | 'bluffing'): Promise<string> {
    return proofType === 'full' ? await this.fullRevealVkHashPromise : await this.bluffingRevealVkHashPromise;
  }

  /**
   * Update verification key hashes (for contract upgrades)
   * Production implementation with proper transaction handling
   */
  async updateVerificationKeys(
    fullRevealVk: string,
    bluffingRevealVk: string
  ): Promise<void> {
    try {
      if (!this.verifierContract || !this.account) {
        throw new Error('Contract or account not initialized. Call initialize() first.');
      }

      console.log('Updating verification keys...');
      console.log(`  Full reveal VK: ${fullRevealVk.substring(0, 16)}...`);
      console.log(`  Bluffing reveal VK: ${bluffingRevealVk.substring(0, 16)}...`);

      // Prepare call data
      const callData = CallData.compile({
        full_reveal_vk: cairo.felt(fullRevealVk),
        bluffing_reveal_vk: cairo.felt(bluffingRevealVk)
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
    } catch (error) {
      throw new Error(`Failed to update verification keys: ${error}`);
    }
  }

  // Private helper methods

  /**
   * Convert ZKProof to Garaga format
   */
  private async convertToGaragaFormat(proof: ZKProof, revealType: 'full' | 'bluffing'): Promise<GaragaProof> {
    // Convert proof bytes to felt array
    const proofFelts = this.bytesToFeltArray(proof.proof);
    
    // Convert public inputs to felt array
    const publicInputsFelts = proof.publicInputs.map(input => 
      this.bytesToFelt(input)
    );

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
  private bytesToFelt(bytes: Uint8Array): string {
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
  private bytesToFeltArray(bytes: Uint8Array): string[] {
    const felts: string[] = [];
    
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
  private stringToFelt(str: string): string {
    const bytes = new TextEncoder().encode(str);
    return this.bytesToFelt(bytes);
  }
}

/**
 * Garaga CLI Integration Helper
 * Production utilities for working with Garaga command-line tools
 * Based on official Garaga CLI: https://garaga.gitbook.io/garaga
 */
export class GaragaCLIHelper {
  /**
   * Generate verification key from Noir circuit
   * Requires: nargo compile && garaga gen
   */
  static async generateVerificationKey(circuitPath: string, outputPath: string): Promise<string> {
    try {
      console.log('Generating verification key for circuit:', circuitPath);
      
      // Verify circuit exists
      if (!existsSync(circuitPath)) {
        throw new Error(`Circuit not found at ${circuitPath}`);
      }
      
      // Execute: nargo compile
      console.log('Compiling Noir circuit...');
      const compileCommand = `cd ${circuitPath} && nargo compile`;
      execSync(compileCommand, { encoding: 'utf-8', stdio: 'pipe' });
      
      // Execute: garaga gen
      const targetPath = join(circuitPath, 'target');
      const vkCommand = `garaga gen --system groth16 --circuit ${targetPath} --output ${outputPath}`;
      console.log(`Executing: ${vkCommand}`);
      
      const output = execSync(vkCommand, { encoding: 'utf-8', stdio: 'pipe' });
      console.log('Garaga output:', output);
      
      if (!existsSync(outputPath)) {
        throw new Error(`Verification key not generated at ${outputPath}`);
      }
      
      console.log('✓ Verification key generated:', outputPath);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to generate verification key: ${error}`);
    }
  }

  /**
   * Generate verifier contract from verification key
   * Command: garaga gen --system groth16 --vk verification_key.json --output verifier.cairo
   */
  static async generateVerifierContract(vkPath: string, outputPath: string): Promise<void> {
    try {
      console.log('Generating verifier contract from VK:', vkPath);
      
      if (!existsSync(vkPath)) {
        throw new Error(`Verification key not found at ${vkPath}`);
      }
      
      const command = `garaga gen --system groth16 --vk ${vkPath} --output ${outputPath}`;
      console.log(`Executing: ${command}`);
      
      const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
      console.log('Garaga output:', output);
      
      if (!existsSync(outputPath)) {
        throw new Error(`Verifier contract not generated at ${outputPath}`);
      }
      
      console.log('✓ Verifier contract generated:', outputPath);
    } catch (error) {
      throw new Error(`Failed to generate verifier contract: ${error}`);
    }
  }

  /**
   * Declare contract on Starknet using starkli
   * Requires: scarb build && starkli declare
   */
  static async declareContract(contractPath: string, accountPath: string, rpcUrl: string): Promise<string> {
    try {
      console.log('Declaring contract:', contractPath);
      
      // Build contract first
      const buildCommand = `scarb build`;
      console.log('Building contract...');
      execSync(buildCommand, { encoding: 'utf-8', stdio: 'pipe', cwd: join(contractPath, '..') });
      
      // Declare using starkli
      const declareCommand = `starkli declare ${contractPath} --account ${accountPath} --rpc ${rpcUrl}`;
      console.log(`Executing: ${declareCommand}`);
      
      const output = execSync(declareCommand, { encoding: 'utf-8', stdio: 'pipe' });
      
      // Extract class hash from output
      const classHashMatch = output.match(/0x[a-fA-F0-9]{64}/);
      if (!classHashMatch) {
        throw new Error('Failed to extract class hash from declare output');
      }
      
      const classHash = classHashMatch[0];
      console.log('✓ Contract declared with class hash:', classHash);
      return classHash;
    } catch (error) {
      throw new Error(`Failed to declare contract: ${error}`);
    }
  }

  /**
   * Deploy contract instance using starkli
   * Command: starkli deploy <class-hash> <constructor-args>
   */
  static async deployContract(
    classHash: string,
    constructorArgs: string[],
    accountPath: string,
    rpcUrl: string
  ): Promise<string> {
    try {
      console.log('Deploying contract with class hash:', classHash);
      
      const argsString = constructorArgs.join(' ');
      const deployCommand = `starkli deploy ${classHash} ${argsString} --account ${accountPath} --rpc ${rpcUrl}`;
      console.log(`Executing: ${deployCommand}`);
      
      const output = execSync(deployCommand, { encoding: 'utf-8', stdio: 'pipe' });
      
      // Extract contract address from output
      const addressMatch = output.match(/0x[a-fA-F0-9]{64}/);
      if (!addressMatch) {
        throw new Error('Failed to extract contract address from deploy output');
      }
      
      const contractAddress = addressMatch[0];
      console.log('✓ Contract deployed at:', contractAddress);
      return contractAddress;
    } catch (error) {
      throw new Error(`Failed to deploy contract: ${error}`);
    }
  }

  /**
   * Verify proof on-chain using Garaga verifier
   * Requires deployed verifier contract
   */
  static async verifyOnChain(
    contractAddress: string,
    vkPath: string,
    proofPath: string,
    publicInputsPath: string,
    accountPath: string,
    rpcUrl: string
  ): Promise<boolean> {
    try {
      console.log('Verifying proof on-chain at contract:', contractAddress);
      
      // Load proof and public inputs
      if (!existsSync(proofPath)) {
        throw new Error(`Proof file not found: ${proofPath}`);
      }
      if (!existsSync(publicInputsPath)) {
        throw new Error(`Public inputs file not found: ${publicInputsPath}`);
      }
      
      const proof = JSON.parse(readFileSync(proofPath, 'utf-8'));
      const publicInputs = JSON.parse(readFileSync(publicInputsPath, 'utf-8'));
      const vk = JSON.parse(readFileSync(vkPath, 'utf-8'));
      
      // Call verifier contract
      const callCommand = `starkli call ${contractAddress} verify_groth16_proof_bn254 ${proof.proof.join(' ')} ${publicInputs.join(' ')} ${vk.vk_hash} --rpc ${rpcUrl}`;
      console.log(`Executing: ${callCommand}`);
      
      const output = execSync(callCommand, { encoding: 'utf-8', stdio: 'pipe' });
      
      // Parse result
      const isValid = output.includes('0x1') || output.includes('true');
      console.log(isValid ? '✓ Proof verified successfully' : '✗ Proof verification failed');
      
      return isValid;
    } catch (error) {
      throw new Error(`Failed to verify proof on-chain: ${error}`);
    }
  }
  
  /**
   * Check if Garaga CLI is installed
   */
  static async checkGaragaInstallation(): Promise<boolean> {
    try {
      execSync('garaga --version', { encoding: 'utf-8', stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Install Garaga CLI
   */
  static async installGaraga(): Promise<void> {
    try {
      console.log('Installing Garaga CLI...');
      execSync('pip install garaga', { encoding: 'utf-8', stdio: 'inherit' });
      console.log('✓ Garaga CLI installed successfully');
    } catch (error) {
      throw new Error(`Failed to install Garaga: ${error}`);
    }
  }
}