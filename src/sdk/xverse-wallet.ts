/**
 * Xverse Wallet Integration
 * 
 * Official Sats Connect integration for Bitcoin wallet operations.
 * Provides wallet connection, transaction signing, and Bitcoin data access.
 * 
 * Documentation:
 * - Sats Connect: https://docs.xverse.app/sats-connect
 * - Xverse API: https://docs.xverse.app/api
 * 
 * Key Features:
 * - Wallet connection via Sats Connect
 * - Bitcoin transaction signing
 * - Ordinals and Runes support
 * - Bitcoin balance and transaction queries
 */

import { Address, TransactionHash } from '../types';

/**
 * Sats Connect types - will be imported from sats-connect at runtime
 * These are placeholder interfaces for TypeScript
 */
interface GetAddressResponse {
  addresses: Array<{
    address: string;
    publicKey: string;
    purpose: string;
  }>;
}

interface SignTransactionResponse {
  hex: string;
  txId?: string;
}

interface SignMessageResponse {
  signature: string;
  address: string;
}

/**
 * Xverse wallet information
 */
export interface XverseWallet {
  paymentAddress: string;
  paymentPublicKey: string;
  ordinalsAddress?: string;
  ordinalsPublicKey?: string;
  stacksAddress?: string;
  network: 'mainnet' | 'testnet';
}

/**
 * Bitcoin balance information
 */
export interface BitcoinBalance {
  confirmed: bigint;
  unconfirmed: bigint;
  total: bigint;
}

/**
 * Bitcoin transaction information
 */
export interface BitcoinTransaction {
  txid: string;
  blockHeight?: number;
  timestamp?: number;
  fee: bigint;
  inputs: Array<{
    address: string;
    value: bigint;
  }>;
  outputs: Array<{
    address: string;
    value: bigint;
  }>;
}

/**
 * Ordinal inscription information
 */
export interface OrdinalInscription {
  id: string;
  number: number;
  address: string;
  contentType: string;
  contentLength: number;
  timestamp: number;
}

/**
 * Rune balance information
 */
export interface RuneBalance {
  rune: string;
  runeId: string;
  amount: bigint;
  symbol: string;
  divisibility: number;
}

/**
 * Xverse Wallet Integration
 * 
 * Provides Bitcoin wallet operations using Sats Connect and Xverse API.
 */
export class XverseWalletIntegration {
  private wallet: XverseWallet | null = null;
  private readonly network: 'mainnet' | 'testnet';
  private readonly apiBaseUrl: string;
  private readonly apiKey?: string;

  constructor(
    network: 'mainnet' | 'testnet' = 'testnet',
    apiKey?: string
  ) {
    this.network = network;
    this.apiBaseUrl = 'https://api.secretkeylabs.io';
    this.apiKey = apiKey;
  }

  /**
   * Connect to Xverse wallet using Sats Connect
   */
  async connectWallet(): Promise<XverseWallet> {
    try {
      // Check if in browser environment
      if (typeof window === 'undefined') {
        throw new Error('Xverse wallet connection only available in browser environment');
      }

      // Dynamic import of sats-connect with proper types
      const { request, AddressPurpose } = await import('sats-connect');

      // Request wallet addresses using the enum values
      const response = await request('getAddresses', {
        purposes: [AddressPurpose.Ordinals, AddressPurpose.Payment, AddressPurpose.Stacks],
        message: 'Connect to Kirito SDK for Bitcoin operations'
      });

      // Extract result from RpcResult wrapper
      if (response.status !== 'success') {
        throw new Error('Failed to get addresses from wallet');
      }

      const addressData = response.result;

      if (!addressData.addresses || addressData.addresses.length === 0) {
        throw new Error('No addresses returned from Xverse wallet');
      }

      // Extract addresses by purpose (compare with enum values)
      const paymentAddr = addressData.addresses.find(a => a.purpose === AddressPurpose.Payment);
      const ordinalsAddr = addressData.addresses.find(a => a.purpose === AddressPurpose.Ordinals);
      const stacksAddr = addressData.addresses.find(a => a.purpose === AddressPurpose.Stacks);

      if (!paymentAddr) {
        throw new Error('Payment address not found in wallet response');
      }

      this.wallet = {
        paymentAddress: paymentAddr.address,
        paymentPublicKey: paymentAddr.publicKey,
        ordinalsAddress: ordinalsAddr?.address,
        ordinalsPublicKey: ordinalsAddr?.publicKey,
        stacksAddress: stacksAddr?.address,
        network: this.network
      };

      console.log(`Xverse wallet connected: ${this.wallet.paymentAddress.substring(0, 10)}...`);

      return this.wallet;
    } catch (error) {
      if (error instanceof Error) {
        // User rejected connection
        if (error.message.includes('User rejected') || error.message.includes('canceled')) {
          throw new Error('Wallet connection rejected by user');
        }
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
    console.log('Xverse wallet disconnected');
  }

  /**
   * Get connected wallet info
   */
  getWallet(): XverseWallet | null {
    return this.wallet;
  }

  /**
   * Sign a Bitcoin transaction
   * 
   * @param psbtHex - PSBT in hex format
   * @param inputsToSign - Inputs to sign with their indexes
   * @param broadcast - Whether to broadcast after signing
   */
  async signTransaction(
    psbtHex: string,
    inputsToSign: Array<{ address: string; signingIndexes: number[] }>,
    broadcast: boolean = false
  ): Promise<SignTransactionResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Call connectWallet() first.');
    }

    try {
      if (typeof window === 'undefined') {
        throw new Error('Transaction signing only available in browser environment');
      }

      const { request } = await import('sats-connect');

      // Use 'signPsbt' which is the correct method name in sats-connect
      const response = await request('signPsbt', {
        psbt: psbtHex,
        signInputs: inputsToSign.reduce((acc, input) => {
          acc[input.address] = input.signingIndexes;
          return acc;
        }, {} as Record<string, number[]>),
        broadcast
      });

      // Extract result from RpcResult wrapper
      if (response.status !== 'success') {
        throw new Error('Failed to sign transaction');
      }

      const signResult = response.result;

      console.log('Transaction signed successfully');
      if (signResult.txid) {
        console.log(`Transaction broadcast: ${signResult.txid}`);
      }

      return {
        hex: signResult.psbt,
        txId: signResult.txid
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('canceled')) {
          throw new Error('Transaction signing rejected by user');
        }
        throw new Error(`Failed to sign transaction: ${error.message}`);
      }
      throw new Error(`Failed to sign transaction: ${error}`);
    }
  }

  /**
   * Sign a message with Bitcoin address
   */
  async signMessage(message: string, address?: string): Promise<SignMessageResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not connected. Call connectWallet() first.');
    }

    try {
      if (typeof window === 'undefined') {
        throw new Error('Message signing only available in browser environment');
      }

      const { request } = await import('sats-connect');

      const signingAddress = address || this.wallet.paymentAddress;

      const response = await request('signMessage', {
        address: signingAddress,
        message
      });

      // Extract result from RpcResult wrapper
      if (response.status !== 'success') {
        throw new Error('Failed to sign message');
      }

      const signResult = response.result;

      console.log('Message signed successfully');

      return {
        signature: signResult.signature,
        address: signResult.address
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('User rejected') || error.message.includes('canceled')) {
          throw new Error('Message signing rejected by user');
        }
        throw new Error(`Failed to sign message: ${error.message}`);
      }
      throw new Error(`Failed to sign message: ${error}`);
    }
  }

  /**
   * Get Bitcoin balance for connected wallet
   */
  async getBitcoinBalance(address?: string): Promise<BitcoinBalance> {
    const queryAddress = address || this.wallet?.paymentAddress;

    if (!queryAddress) {
      throw new Error('No address provided and wallet not connected');
    }

    try {
      const response = await this.makeApiRequest(`/address/${queryAddress}/balance`);

      return {
        confirmed: BigInt(response.confirmed),
        unconfirmed: BigInt(response.unconfirmed),
        total: BigInt(response.confirmed) + BigInt(response.unconfirmed)
      };
    } catch (error) {
      throw new Error(`Failed to get Bitcoin balance: ${error}`);
    }
  }

  /**
   * Get Bitcoin transactions for address
   */
  async getBitcoinTransactions(
    address?: string,
    limit: number = 10
  ): Promise<BitcoinTransaction[]> {
    const queryAddress = address || this.wallet?.paymentAddress;

    if (!queryAddress) {
      throw new Error('No address provided and wallet not connected');
    }

    try {
      const response = await this.makeApiRequest(
        `/address/${queryAddress}/transactions?limit=${limit}`
      );

      return response.transactions.map((tx: any) => ({
        txid: tx.txid,
        blockHeight: tx.block_height,
        timestamp: tx.timestamp,
        fee: BigInt(tx.fee),
        inputs: tx.inputs.map((input: any) => ({
          address: input.address,
          value: BigInt(input.value)
        })),
        outputs: tx.outputs.map((output: any) => ({
          address: output.address,
          value: BigInt(output.value)
        }))
      }));
    } catch (error) {
      throw new Error(`Failed to get Bitcoin transactions: ${error}`);
    }
  }

  /**
   * Get Ordinals inscriptions for address
   */
  async getOrdinals(address?: string, limit: number = 10): Promise<OrdinalInscription[]> {
    const queryAddress = address || this.wallet?.ordinalsAddress || this.wallet?.paymentAddress;

    if (!queryAddress) {
      throw new Error('No address provided and wallet not connected');
    }

    try {
      const response = await this.makeApiRequest(
        `/address/${queryAddress}/ordinals?limit=${limit}`
      );

      return response.inscriptions.map((inscription: any) => ({
        id: inscription.id,
        number: inscription.number,
        address: inscription.address,
        contentType: inscription.content_type,
        contentLength: inscription.content_length,
        timestamp: inscription.timestamp
      }));
    } catch (error) {
      throw new Error(`Failed to get Ordinals: ${error}`);
    }
  }

  /**
   * Get Runes balances for address
   */
  async getRunes(address?: string): Promise<RuneBalance[]> {
    const queryAddress = address || this.wallet?.paymentAddress;

    if (!queryAddress) {
      throw new Error('No address provided and wallet not connected');
    }

    try {
      const response = await this.makeApiRequest(`/address/${queryAddress}/runes`);

      return response.runes.map((rune: any) => ({
        rune: rune.rune,
        runeId: rune.rune_id,
        amount: BigInt(rune.amount),
        symbol: rune.symbol,
        divisibility: rune.divisibility
      }));
    } catch (error) {
      throw new Error(`Failed to get Runes: ${error}`);
    }
  }

  /**
   * Get transaction details by txid
   */
  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const response = await this.makeApiRequest(`/transaction/${txid}`);

      return {
        txid: response.txid,
        blockHeight: response.block_height,
        timestamp: response.timestamp,
        fee: BigInt(response.fee),
        inputs: response.inputs.map((input: any) => ({
          address: input.address,
          value: BigInt(input.value)
        })),
        outputs: response.outputs.map((output: any) => ({
          address: output.address,
          value: BigInt(output.value)
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get transaction: ${error}`);
    }
  }

  /**
   * Make authenticated request to Xverse API
   */
  private async makeApiRequest(endpoint: string): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const maxRetries = 3;
    const retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers
        });

        if (!response.ok) {
          const error = await response.text();

          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`Xverse API error: ${response.status} - ${error}`);
          }

          // Retry on server errors (5xx)
          if (attempt === maxRetries) {
            throw new Error(`Xverse API error after ${maxRetries} attempts: ${response.status} - ${error}`);
          }

          console.warn(`Xverse API attempt ${attempt}/${maxRetries} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
          continue;
        }

        return response.json();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        console.warn(`Xverse API attempt ${attempt}/${maxRetries} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }

    throw new Error('Xverse API request failed');
  }
}

/**
 * Factory function to create Xverse wallet integration
 */
export function createXverseWallet(
  network: 'mainnet' | 'testnet' = 'testnet',
  apiKey?: string
): XverseWalletIntegration {
  return new XverseWalletIntegration(network, apiKey);
}
