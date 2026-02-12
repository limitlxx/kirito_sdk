import {
  LayerSwapBridge,
  BridgeQuote,
  BridgeTransaction,
  BridgeTransactionStatus,
  BridgeOptions,
  SupportedToken,
  SupportedChain
} from '../interfaces/bridge';
import { Address, TransactionHash } from '../types';

/**
 * LayerSwap Bridge Implementation
 * 
 * Integrates with LayerSwap API for cross-chain BTC transfers to Starknet
 * and Starknet native token to WBTC conversions.
 */
export class LayerSwapBridgeImpl implements LayerSwapBridge {
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly network: 'mainnet' | 'testnet';

  constructor(
    network: 'mainnet' | 'testnet' = 'testnet',
    apiKey?: string
  ) {
    this.network = network;
    this.apiKey = apiKey;
    this.apiUrl = network === 'mainnet' 
      ? 'https://api.layerswap.io/api'
      : 'https://api-sandbox.layerswap.io/api';
  }

  /**
   * Get quote for cross-chain swap
   */
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    fromChain: string,
    toChain: string
  ): Promise<BridgeQuote> {
    try {
      const response = await this.makeRequest('/v1/quote', {
        method: 'POST',
        body: JSON.stringify({
          source_network: fromChain,
          destination_network: toChain,
          source_token: fromToken,
          destination_token: toToken,
          amount: amount.toString(),
          slippage: 0.5 // 0.5% default slippage
        })
      });

      const quote = response.data;
      
      return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: BigInt(quote.receive_amount),
        estimatedFees: BigInt(quote.fee_amount),
        estimatedTime: quote.avg_completion_time,
        slippage: quote.slippage,
        route: [fromChain, toChain]
      };
    } catch (error) {
      throw new Error(`Failed to get LayerSwap quote: ${error}`);
    }
  }

  /**
   * Execute bridge transaction
   */
  async executeBridge(
    quote: BridgeQuote,
    destinationAddress: Address,
    options?: BridgeOptions
  ): Promise<BridgeTransaction> {
    try {
      const response = await this.makeRequest('/v1/swaps', {
        method: 'POST',
        body: JSON.stringify({
          source_network: quote.route[0],
          destination_network: quote.route[1],
          source_token: quote.fromToken,
          destination_token: quote.toToken,
          amount: quote.fromAmount.toString(),
          destination_address: destinationAddress,
          slippage_tolerance: options?.slippageTolerance || 0.5,
          deadline: options?.deadline || Math.floor(Date.now() / 1000) + 3600 // 1 hour
        })
      });

      const swap = response.data;

      return {
        id: swap.swap_id,
        status: this.mapStatus(swap.status),
        fromChain: quote.route[0],
        toChain: quote.route[1],
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        toAmount: quote.toAmount,
        txHash: swap.transaction_hash,
        confirmations: swap.confirmations || 0,
        requiredConfirmations: swap.required_confirmations || 6
      };
    } catch (error) {
      throw new Error(`Failed to execute LayerSwap bridge: ${error}`);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<BridgeTransaction> {
    try {
      const response = await this.makeRequest(`/v1/swaps/${transactionId}`);
      const swap = response.data;

      return {
        id: swap.swap_id,
        status: this.mapStatus(swap.status),
        fromChain: swap.source_network,
        toChain: swap.destination_network,
        fromToken: swap.source_token,
        toToken: swap.destination_token,
        fromAmount: BigInt(swap.requested_amount),
        toAmount: BigInt(swap.receive_amount),
        txHash: swap.transaction_hash,
        confirmations: swap.confirmations || 0,
        requiredConfirmations: swap.required_confirmations || 6
      };
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error}`);
    }
  }

  /**
   * Get supported tokens
   */
  async getSupportedTokens(): Promise<SupportedToken[]> {
    try {
      const response = await this.makeRequest('/v1/currencies');
      
      return response.data.map((token: any) => ({
        symbol: token.asset,
        address: token.contract_address,
        decimals: token.precision,
        chains: token.networks.map((n: any) => n.name)
      }));
    } catch (error) {
      throw new Error(`Failed to get supported tokens: ${error}`);
    }
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(): Promise<SupportedChain[]> {
    try {
      const response = await this.makeRequest('/v1/networks');
      
      return response.data.map((chain: any) => ({
        id: chain.name,
        name: chain.display_name,
        nativeToken: chain.native_currency,
        blockTime: chain.average_completion_time
      }));
    } catch (error) {
      throw new Error(`Failed to get supported chains: ${error}`);
    }
  }

  /**
   * Convert BTC to WBTC during minting
   */
  async convertBTCToWBTC(
    btcAmount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    return this.executeBridge(
      await this.getQuote('BTC', 'WBTC', btcAmount, 'BITCOIN', 'STARKNET_MAINNET'),
      starknetAddress
    );
  }

  /**
   * Convert Starknet native tokens to WBTC
   */
  async convertStarknetTokenToWBTC(
    token: 'ETH' | 'STRK' | 'USDC',
    amount: bigint,
    starknetAddress: Address
  ): Promise<BridgeTransaction> {
    // First get quote for token to WBTC conversion
    const quote = await this.getQuote(
      token,
      'WBTC',
      amount,
      'STARKNET_MAINNET',
      'STARKNET_MAINNET'
    );

    return this.executeBridge(quote, starknetAddress);
  }

  /**
   * Monitor bridge transaction until completion
   */
  async monitorTransaction(
    transactionId: string,
    onUpdate?: (transaction: BridgeTransaction) => void
  ): Promise<BridgeTransaction> {
    const maxAttempts = 60; // 10 minutes with 10s intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const transaction = await this.getTransactionStatus(transactionId);
      
      if (onUpdate) {
        onUpdate(transaction);
      }

      if (transaction.status === BridgeTransactionStatus.COMPLETED ||
          transaction.status === BridgeTransactionStatus.FAILED) {
        return transaction;
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    }

    throw new Error(`Transaction monitoring timeout for ${transactionId}`);
  }

  /**
   * Make authenticated request to LayerSwap API
   */
  private async makeRequest(endpoint: string, options?: RequestInit): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LayerSwap API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Map LayerSwap status to internal status
   */
  private mapStatus(layerSwapStatus: string): BridgeTransactionStatus {
    switch (layerSwapStatus.toLowerCase()) {
      case 'created':
      case 'user_transfer_pending':
        return BridgeTransactionStatus.PENDING;
      case 'user_transfer_confirmed':
        return BridgeTransactionStatus.CONFIRMED;
      case 'completed':
        return BridgeTransactionStatus.COMPLETED;
      case 'failed':
      case 'expired':
        return BridgeTransactionStatus.FAILED;
      default:
        return BridgeTransactionStatus.PENDING;
    }
  }
}

/**
 * Factory function to create LayerSwap bridge instance
 */
export function createLayerSwapBridge(
  network: 'mainnet' | 'testnet' = 'testnet',
  apiKey?: string
): LayerSwapBridge {
  return new LayerSwapBridgeImpl(network, apiKey);
}