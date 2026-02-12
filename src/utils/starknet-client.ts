/**
 * Starknet Client Utility
 * 
 * Provides production-ready Starknet.js integration for contract interactions
 */

import { Account, Contract, Provider, RpcProvider, CallData, Call, InvokeFunctionResponse } from 'starknet';
import { KiritoSDKConfig, Address, TransactionHash } from '../types';

export interface StarknetClientConfig {
  rpcUrl: string;
  chainId: string;
  account?: Account;
}

export class StarknetClient {
  private provider: RpcProvider;
  private account?: Account;
  private config: KiritoSDKConfig;

  constructor(config: KiritoSDKConfig, account?: Account) {
    this.config = config;
    this.provider = new RpcProvider({ 
      nodeUrl: config.network.rpcUrl 
    });
    this.account = account;
  }

  /**
   * Execute a contract call (state-changing transaction)
   */
  async executeContractCall(
    contractAddress: Address,
    entrypoint: string,
    calldata: any[]
  ): Promise<TransactionHash> {
    if (!this.account) {
      throw new Error('Account not configured. Cannot execute transactions.');
    }

    try {
      const call: Call = {
        contractAddress,
        entrypoint,
        calldata: CallData.compile(calldata)
      };

      const response: InvokeFunctionResponse = await this.account.execute(call);
      
      // Wait for transaction acceptance
      await this.provider.waitForTransaction(response.transaction_hash);
      
      return response.transaction_hash;
    } catch (error) {
      throw new Error(`Failed to execute contract call: ${error}`);
    }
  }

  /**
   * Execute multiple contract calls in a single transaction
   */
  async executeMultiCall(calls: Call[]): Promise<TransactionHash> {
    if (!this.account) {
      throw new Error('Account not configured. Cannot execute transactions.');
    }

    try {
      const response = await this.account.execute(calls);
      await this.provider.waitForTransaction(response.transaction_hash);
      return response.transaction_hash;
    } catch (error) {
      throw new Error(`Failed to execute multi-call: ${error}`);
    }
  }

  /**
   * Call a contract view function (read-only)
   */
  async callContractView(
    contractAddress: Address,
    entrypoint: string,
    calldata: any[] = []
  ): Promise<any> {
    try {
      const result = await this.provider.callContract({
        contractAddress,
        entrypoint,
        calldata: CallData.compile(calldata)
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to call contract view: ${error}`);
    }
  }

  /**
   * Get account nonce
   */
  async getNonce(address: Address): Promise<string> {
    try {
      const nonce = await this.provider.getNonceForAddress(address);
      return nonce;
    } catch (error) {
      throw new Error(`Failed to get nonce: ${error}`);
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: TransactionHash): Promise<any> {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      throw new Error(`Failed to get transaction receipt: ${error}`);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: TransactionHash): Promise<string> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      // Handle different receipt types
      if ('execution_status' in receipt) {
        return receipt.execution_status || 'UNKNOWN';
      }
      // Fallback for older receipt formats
      if ('status' in receipt) {
        return (receipt as any).status || 'UNKNOWN';
      }
      return 'UNKNOWN';
    } catch (error) {
      throw new Error(`Failed to get transaction status: ${error}`);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: TransactionHash,
    options?: { retryInterval?: number }
  ): Promise<any> {
    try {
      return await this.provider.waitForTransaction(
        txHash,
        options
      );
    } catch (error) {
      throw new Error(`Transaction failed or timed out: ${error}`);
    }
  }

  /**
   * Get contract class hash
   */
  async getClassHashAt(contractAddress: Address): Promise<string> {
    try {
      return await this.provider.getClassHashAt(contractAddress);
    } catch (error) {
      throw new Error(`Failed to get class hash: ${error}`);
    }
  }

  /**
   * Check if address is a contract
   */
  async isContract(address: Address): Promise<boolean> {
    try {
      const classHash = await this.getClassHashAt(address);
      return classHash !== '0x0';
    } catch {
      return false;
    }
  }

  /**
   * Get provider instance
   */
  getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * Get account instance
   */
  getAccount(): Account | undefined {
    return this.account;
  }

  /**
   * Set account for transactions
   */
  setAccount(account: Account): void {
    this.account = account;
  }
}

/**
 * Factory function to create Starknet client
 */
export function createStarknetClient(
  config: KiritoSDKConfig,
  account?: Account
): StarknetClient {
  return new StarknetClient(config, account);
}
