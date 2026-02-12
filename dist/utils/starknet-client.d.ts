/**
 * Starknet Client Utility
 *
 * Provides production-ready Starknet.js integration for contract interactions
 */
import { Account, RpcProvider, Call } from 'starknet';
import { KiritoSDKConfig, Address, TransactionHash } from '../types';
export interface StarknetClientConfig {
    rpcUrl: string;
    chainId: string;
    account?: Account;
}
export declare class StarknetClient {
    private provider;
    private account?;
    private config;
    constructor(config: KiritoSDKConfig, account?: Account);
    /**
     * Execute a contract call (state-changing transaction)
     */
    executeContractCall(contractAddress: Address, entrypoint: string, calldata: any[]): Promise<TransactionHash>;
    /**
     * Execute multiple contract calls in a single transaction
     */
    executeMultiCall(calls: Call[]): Promise<TransactionHash>;
    /**
     * Call a contract view function (read-only)
     */
    callContractView(contractAddress: Address, entrypoint: string, calldata?: any[]): Promise<any>;
    /**
     * Get account nonce
     */
    getNonce(address: Address): Promise<string>;
    /**
     * Get transaction receipt
     */
    getTransactionReceipt(txHash: TransactionHash): Promise<any>;
    /**
     * Get transaction status
     */
    getTransactionStatus(txHash: TransactionHash): Promise<string>;
    /**
     * Wait for transaction confirmation
     */
    waitForTransaction(txHash: TransactionHash, options?: {
        retryInterval?: number;
    }): Promise<any>;
    /**
     * Get contract class hash
     */
    getClassHashAt(contractAddress: Address): Promise<string>;
    /**
     * Check if address is a contract
     */
    isContract(address: Address): Promise<boolean>;
    /**
     * Get provider instance
     */
    getProvider(): RpcProvider;
    /**
     * Get account instance
     */
    getAccount(): Account | undefined;
    /**
     * Set account for transactions
     */
    setAccount(account: Account): void;
}
/**
 * Factory function to create Starknet client
 */
export declare function createStarknetClient(config: KiritoSDKConfig, account?: Account): StarknetClient;
//# sourceMappingURL=starknet-client.d.ts.map