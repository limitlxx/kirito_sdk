"use strict";
/**
 * Starknet Client Utility
 *
 * Provides production-ready Starknet.js integration for contract interactions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetClient = void 0;
exports.createStarknetClient = createStarknetClient;
const starknet_1 = require("starknet");
class StarknetClient {
    constructor(config, account) {
        this.config = config;
        this.provider = new starknet_1.RpcProvider({
            nodeUrl: config.network.rpcUrl
        });
        this.account = account;
    }
    /**
     * Execute a contract call (state-changing transaction)
     */
    async executeContractCall(contractAddress, entrypoint, calldata) {
        if (!this.account) {
            throw new Error('Account not configured. Cannot execute transactions.');
        }
        try {
            const call = {
                contractAddress,
                entrypoint,
                calldata: starknet_1.CallData.compile(calldata)
            };
            const response = await this.account.execute(call);
            // Wait for transaction acceptance
            await this.provider.waitForTransaction(response.transaction_hash);
            return response.transaction_hash;
        }
        catch (error) {
            throw new Error(`Failed to execute contract call: ${error}`);
        }
    }
    /**
     * Execute multiple contract calls in a single transaction
     */
    async executeMultiCall(calls) {
        if (!this.account) {
            throw new Error('Account not configured. Cannot execute transactions.');
        }
        try {
            const response = await this.account.execute(calls);
            await this.provider.waitForTransaction(response.transaction_hash);
            return response.transaction_hash;
        }
        catch (error) {
            throw new Error(`Failed to execute multi-call: ${error}`);
        }
    }
    /**
     * Call a contract view function (read-only)
     */
    async callContractView(contractAddress, entrypoint, calldata = []) {
        try {
            const result = await this.provider.callContract({
                contractAddress,
                entrypoint,
                calldata: starknet_1.CallData.compile(calldata)
            });
            return result;
        }
        catch (error) {
            throw new Error(`Failed to call contract view: ${error}`);
        }
    }
    /**
     * Get account nonce
     */
    async getNonce(address) {
        try {
            const nonce = await this.provider.getNonceForAddress(address);
            return nonce;
        }
        catch (error) {
            throw new Error(`Failed to get nonce: ${error}`);
        }
    }
    /**
     * Get transaction receipt
     */
    async getTransactionReceipt(txHash) {
        try {
            return await this.provider.getTransactionReceipt(txHash);
        }
        catch (error) {
            throw new Error(`Failed to get transaction receipt: ${error}`);
        }
    }
    /**
     * Get transaction status
     */
    async getTransactionStatus(txHash) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            // Handle different receipt types
            if ('execution_status' in receipt) {
                return receipt.execution_status || 'UNKNOWN';
            }
            // Fallback for older receipt formats
            if ('status' in receipt) {
                return receipt.status || 'UNKNOWN';
            }
            return 'UNKNOWN';
        }
        catch (error) {
            throw new Error(`Failed to get transaction status: ${error}`);
        }
    }
    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(txHash, options) {
        try {
            return await this.provider.waitForTransaction(txHash, options);
        }
        catch (error) {
            throw new Error(`Transaction failed or timed out: ${error}`);
        }
    }
    /**
     * Get contract class hash
     */
    async getClassHashAt(contractAddress) {
        try {
            return await this.provider.getClassHashAt(contractAddress);
        }
        catch (error) {
            throw new Error(`Failed to get class hash: ${error}`);
        }
    }
    /**
     * Check if address is a contract
     */
    async isContract(address) {
        try {
            const classHash = await this.getClassHashAt(address);
            return classHash !== '0x0';
        }
        catch {
            return false;
        }
    }
    /**
     * Get provider instance
     */
    getProvider() {
        return this.provider;
    }
    /**
     * Get account instance
     */
    getAccount() {
        return this.account;
    }
    /**
     * Set account for transactions
     */
    setAccount(account) {
        this.account = account;
    }
}
exports.StarknetClient = StarknetClient;
/**
 * Factory function to create Starknet client
 */
function createStarknetClient(config, account) {
    return new StarknetClient(config, account);
}
//# sourceMappingURL=starknet-client.js.map