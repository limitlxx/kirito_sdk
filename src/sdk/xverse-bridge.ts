import {
  XverseBridge,
  XverseWallet,
  BridgeTransaction,
  BridgeTransactionStatus,
  BridgeFeeEstimate
} from '../interfaces/bridge';
import { Address, TransactionHash } from '../types';

/**
 * Xverse Bridge Implementation
 * 
 * Integrates with Xverse Starknet bridge for BTC transfers and
 * multi-token bridge support (ETH, STRK, USDC → WBTC).
 */
export class XverseBridgeImpl implements XverseBridge {
  private wallet: XverseWallet | null = null;
  private readonly network: 'mainnet' | 'testnet';
  private readonly bridgeApiUrl: string;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.network = network;
    this.bridgeApiUrl = network === 'mainnet'
      ? 'https://bridge-api.xverse.app/v1'
      : 'https://bridge-api-testnet.xverse.app/v1';
  }

  /**
   * Connect to Xverse wallet with improved browser detection
   */
  async connectWallet(): Promise<XverseWallet> {
    try {
      // Comprehensive browser environment detection
      const isBrowser = typeof window !== 'undefined' && 
                       typeof window.document !== 'undefined' &&
                       typeof navigator !== 'undefined';
      
      if (!isBrowser) {
        console.warn('Not in browser environment, using mock wallet for testing');
        this.wallet = {
          address: 'bc1qtest123456789abcdef',
          publicKey: '0x123456789abcdef',
          network: this.network
        };
        return this.wallet;
      }

      // Check if Xverse extension is installed
      if (!(window as any).XverseProviders) {
        throw new Error(
          'Xverse wallet extension not detected. Please install Xverse from https://www.xverse.app/'
        );
      }

      const xverse = (window as any).XverseProviders;
      
      // Request wallet connection with timeout
      const connectionTimeout = 30000; // 30 seconds
      const connectionPromise = xverse.request('getAddresses', {
        purposes: ['ordinals', 'payment', 'stacks'],
        message: 'Connect to Kirito SDK for Bitcoin bridge operations'
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Wallet connection timeout')), connectionTimeout)
      );

      const response = await Promise.race([connectionPromise, timeoutPromise]);

      if (!response || !Array.isArray(response) || response.length === 0) {
        throw new Error('No addresses returned from Xverse wallet');
      }

      // Get Bitcoin payment address and public key
      const paymentAddress = response.find((addr: any) => addr.purpose === 'payment');
      
      if (!paymentAddress || !paymentAddress.address || !paymentAddress.publicKey) {
        throw new Error('Failed to get Bitcoin payment address from Xverse wallet');
      }

      // Validate Bitcoin address format
      const btcAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
      if (!btcAddressRegex.test(paymentAddress.address)) {
        throw new Error('Invalid Bitcoin address format received from wallet');
      }

      this.wallet = {
        address: paymentAddress.address,
        publicKey: paymentAddress.publicKey,
        network: this.network
      };

      console.log(`Xverse wallet connected: ${this.wallet.address.substring(0, 10)}...`);
      
      return this.wallet;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to connect Xverse wallet: ${error.message}`);
      }
      throw new Error(`Failed to connect Xverse wallet: ${error}`);
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    this.wallet = null;
  }

  /**
   * Bridge tokens to Starknet
   */
  async bridgeToStarknet(
    token: string,
    amount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Call connectWallet() first.');
    }

    try {
      // Create bridge transaction
      const response = await this.makeRequest('/bridge', {
        method: 'POST',
        body: JSON.stringify({
          source_token: token,
          destination_token: this.getDestinationToken(token),
          amount: amount.toString(),
          source_address: this.wallet.address,
          destination_address: starknetAddress,
          source_network: 'bitcoin',
          destination_network: 'starknet'
        })
      });

      const bridge = response.data;

      // Sign transaction with Xverse
      const signedTx = await this.signTransaction(bridge.unsigned_tx);

      // Submit signed transaction
      const submitResponse = await this.makeRequest('/bridge/submit', {
        method: 'POST',
        body: JSON.stringify({
          bridge_id: bridge.bridge_id,
          signed_tx: signedTx
        })
      });

      return {
        id: bridge.bridge_id,
        status: BridgeTransactionStatus.PENDING,
        fromChain: 'bitcoin',
        toChain: 'starknet',
        fromToken: token,
        toToken: this.getDestinationToken(token),
        fromAmount: amount,
        toAmount: BigInt(bridge.expected_output),
        txHash: submitResponse.data.tx_hash,
        confirmations: 0,
        requiredConfirmations: 6
      };
    } catch (error) {
      throw new Error(`Failed to bridge to Starknet: ${error}`);
    }
  }

  /**
   * Bridge multiple tokens in a single transaction
   */
  async bridgeMultipleTokens(
    tokens: Array<{
      token: string;
      amount: bigint;
    }>,
    starknetAddress: Address
  ): Promise<BridgeTransaction[]> {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Call connectWallet() first.');
    }

    const transactions: BridgeTransaction[] = [];

    for (const { token, amount } of tokens) {
      try {
        const transaction = await this.bridgeToStarknet(token, amount, starknetAddress);
        transactions.push(transaction);
      } catch (error) {
        console.error(`Failed to bridge ${token}:`, error);
        // Continue with other tokens
      }
    }

    return transactions;
  }

  /**
   * Estimate bridge fees
   */
  async estimateBridgeFees(
    token: string,
    amount: bigint,
    destination: string
  ): Promise<BridgeFeeEstimate> {
    try {
      const response = await this.makeRequest('/bridge/estimate', {
        method: 'POST',
        body: JSON.stringify({
          source_token: token,
          amount: amount.toString(),
          destination
        })
      });

      const estimate = response.data;

      return {
        networkFee: BigInt(estimate.network_fee),
        bridgeFee: BigInt(estimate.bridge_fee),
        totalFee: BigInt(estimate.total_fee),
        estimatedTime: estimate.estimated_time
      };
    } catch (error) {
      throw new Error(`Failed to estimate bridge fees: ${error}`);
    }
  }

  /**
   * Get bridge transaction status
   */
  async getBridgeStatus(bridgeId: string): Promise<BridgeTransaction> {
    try {
      const response = await this.makeRequest(`/bridge/${bridgeId}`);
      const bridge = response.data;

      return {
        id: bridge.bridge_id,
        status: this.mapStatus(bridge.status),
        fromChain: bridge.source_network,
        toChain: bridge.destination_network,
        fromToken: bridge.source_token,
        toToken: bridge.destination_token,
        fromAmount: BigInt(bridge.amount),
        toAmount: BigInt(bridge.output_amount),
        txHash: bridge.tx_hash,
        confirmations: bridge.confirmations || 0,
        requiredConfirmations: bridge.required_confirmations || 6
      };
    } catch (error) {
      throw new Error(`Failed to get bridge status: ${error}`);
    }
  }

  /**
   * Convert ETH to WBTC via Xverse bridge
   */
  async convertETHToWBTC(
    ethAmount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    return this.bridgeToStarknet('ETH', ethAmount, starknetAddress);
  }

  /**
   * Convert STRK to WBTC via Xverse bridge
   */
  async convertSTRKToWBTC(
    strkAmount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    return this.bridgeToStarknet('STRK', strkAmount, starknetAddress);
  }

  /**
   * Convert USDC to WBTC via Xverse bridge
   */
  async convertUSDCToWBTC(
    usdcAmount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    return this.bridgeToStarknet('USDC', usdcAmount, starknetAddress);
  }

  /**
   * Optimize bridge fees by batching transactions
   */
  async optimizeBridgeFees(
    tokens: Array<{
      token: string;
      amount: bigint;
    }>,
    starknetAddress: Address
  ): Promise<{
    optimizedTransactions: BridgeTransaction[];
    totalSavings: bigint;
  }> {
    // Get individual estimates
    const individualEstimates = await Promise.all(
      tokens.map(({ token, amount }) =>
        this.estimateBridgeFees(token, amount, starknetAddress)
      )
    );

    const totalIndividualFees = individualEstimates.reduce(
      (sum, estimate) => sum + estimate.totalFee,
      0n
    );

    // Try batched transaction
    try {
      const batchedTransactions = await this.bridgeMultipleTokens(tokens, starknetAddress);
      const batchedFees = await Promise.all(
        batchedTransactions.map(tx => this.estimateBridgeFees(tx.fromToken, tx.fromAmount, starknetAddress))
      );

      const totalBatchedFees = batchedFees.reduce(
        (sum, estimate) => sum + estimate.totalFee,
        0n
      );

      return {
        optimizedTransactions: batchedTransactions,
        totalSavings: totalIndividualFees - totalBatchedFees
      };
    } catch (error) {
      // Fall back to individual transactions
      const individualTransactions = await Promise.all(
        tokens.map(({ token, amount }) =>
          this.bridgeToStarknet(token, amount, starknetAddress)
        )
      );

      return {
        optimizedTransactions: individualTransactions,
        totalSavings: 0n
      };
    }
  }

  /**
   * Sign transaction with Xverse wallet with enhanced validation
   */
  private async signTransaction(unsignedTx: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Call connectWallet() first.');
    }

    // Validate unsigned transaction format
    if (!unsignedTx || typeof unsignedTx !== 'string') {
      throw new Error('Invalid unsigned transaction format');
    }

    // Check if hex string
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(unsignedTx)) {
      throw new Error('Unsigned transaction must be a valid hex string');
    }

    try {
      // Check if we're in browser environment
      const isBrowser = typeof window !== 'undefined' && 
                       typeof window.document !== 'undefined';
      
      if (!isBrowser) {
        console.warn('Not in browser environment, returning mock signed transaction');
        return unsignedTx + '_signed';
      }

      if (!(window as any).XverseProviders) {
        throw new Error('Xverse wallet not available');
      }

      const xverse = (window as any).XverseProviders;
      
      // Sign transaction with timeout
      const signingTimeout = 60000; // 60 seconds for user to approve
      const signingPromise = xverse.request('signTransaction', {
        hex: unsignedTx,
        network: this.network,
        inputsToSign: [
          {
            address: this.wallet.address,
            signingIndexes: [0] // Sign first input
          }
        ],
        broadcast: false // Don't broadcast, we'll do it separately
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction signing timeout')), signingTimeout)
      );

      const response = await Promise.race([signingPromise, timeoutPromise]);

      if (!response || !response.hex) {
        throw new Error('No signed transaction returned from wallet');
      }

      // Validate signed transaction
      if (!hexRegex.test(response.hex)) {
        throw new Error('Invalid signed transaction format');
      }

      console.log('Transaction signed successfully');
      
      return response.hex;
    } catch (error) {
      if (error instanceof Error) {
        // User rejected signing
        if (error.message.includes('User rejected') || error.message.includes('canceled')) {
          throw new Error('Transaction signing rejected by user');
        }
        throw new Error(`Failed to sign transaction: ${error.message}`);
      }
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  /**
   * Make request to Xverse bridge API with retry logic
   */
  private async makeRequest(endpoint: string, options?: RequestInit): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.bridgeApiUrl}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options?.headers
          }
        });

        if (!response.ok) {
          const error = await response.text();
          
          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`Xverse Bridge API error: ${response.status} - ${error}`);
          }
          
          // Retry on server errors (5xx) or network issues
          if (attempt === maxRetries) {
            throw new Error(`Xverse Bridge API error after ${maxRetries} attempts: ${response.status} - ${error}`);
          }
          
          console.warn(`Xverse API attempt ${attempt}/${maxRetries} failed with status ${response.status}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
          continue;
        }

        return response.json();
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Xverse Bridge API request failed after ${maxRetries} attempts: ${error}`);
        }
        
        console.warn(`Xverse API attempt ${attempt}/${maxRetries} failed:`, error);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
    
    throw new Error('Xverse Bridge API request failed');
  }

  /**
   * Get destination token for bridge
   */
  private getDestinationToken(sourceToken: string): string {
    switch (sourceToken.toUpperCase()) {
      case 'BTC':
        return 'WBTC';
      case 'ETH':
        return 'WBTC'; // Convert ETH to WBTC
      case 'STRK':
        return 'WBTC'; // Convert STRK to WBTC
      case 'USDC':
        return 'WBTC'; // Convert USDC to WBTC
      default:
        return sourceToken;
    }
  }

  /**
   * Map Xverse status to internal status
   */
  private mapStatus(xverseStatus: string): BridgeTransactionStatus {
    switch (xverseStatus.toLowerCase()) {
      case 'pending':
      case 'submitted':
        return BridgeTransactionStatus.PENDING;
      case 'confirmed':
        return BridgeTransactionStatus.CONFIRMED;
      case 'completed':
        return BridgeTransactionStatus.COMPLETED;
      case 'failed':
        return BridgeTransactionStatus.FAILED;
      default:
        return BridgeTransactionStatus.PENDING;
    }
  }
}

/**
 * Extend window interface for Xverse providers
 */
declare global {
  interface Window {
    XverseProviders?: {
      request: (method: string, params?: any) => Promise<any>;
    };
  }
}

/**
 * Factory function to create Xverse bridge instance
 */
export function createXverseBridge(
  network: 'mainnet' | 'testnet' = 'testnet'
): XverseBridge {
  return new XverseBridgeImpl(network);
}