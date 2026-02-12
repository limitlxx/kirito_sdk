"use strict";
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
exports.XverseWalletIntegration = void 0;
exports.createXverseWallet = createXverseWallet;
/**
 * Xverse Wallet Integration
 *
 * Provides Bitcoin wallet operations using Sats Connect and Xverse API.
 */
class XverseWalletIntegration {
    constructor(network = 'testnet', apiKey) {
        this.wallet = null;
        this.network = network;
        this.apiBaseUrl = 'https://api.secretkeylabs.io';
        this.apiKey = apiKey;
    }
    /**
     * Connect to Xverse wallet using Sats Connect
     */
    async connectWallet() {
        try {
            // Check if in browser environment
            if (typeof window === 'undefined') {
                throw new Error('Xverse wallet connection only available in browser environment');
            }
            // Dynamic import of sats-connect with proper types
            const { request, AddressPurpose } = await Promise.resolve().then(() => __importStar(require('sats-connect')));
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
        }
        catch (error) {
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
    async disconnectWallet() {
        this.wallet = null;
        console.log('Xverse wallet disconnected');
    }
    /**
     * Get connected wallet info
     */
    getWallet() {
        return this.wallet;
    }
    /**
     * Sign a Bitcoin transaction
     *
     * @param psbtHex - PSBT in hex format
     * @param inputsToSign - Inputs to sign with their indexes
     * @param broadcast - Whether to broadcast after signing
     */
    async signTransaction(psbtHex, inputsToSign, broadcast = false) {
        if (!this.wallet) {
            throw new Error('Wallet not connected. Call connectWallet() first.');
        }
        try {
            if (typeof window === 'undefined') {
                throw new Error('Transaction signing only available in browser environment');
            }
            const { request } = await Promise.resolve().then(() => __importStar(require('sats-connect')));
            // Use 'signPsbt' which is the correct method name in sats-connect
            const response = await request('signPsbt', {
                psbt: psbtHex,
                signInputs: inputsToSign.reduce((acc, input) => {
                    acc[input.address] = input.signingIndexes;
                    return acc;
                }, {}),
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
        }
        catch (error) {
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
    async signMessage(message, address) {
        if (!this.wallet) {
            throw new Error('Wallet not connected. Call connectWallet() first.');
        }
        try {
            if (typeof window === 'undefined') {
                throw new Error('Message signing only available in browser environment');
            }
            const { request } = await Promise.resolve().then(() => __importStar(require('sats-connect')));
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
        }
        catch (error) {
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
    async getBitcoinBalance(address) {
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
        }
        catch (error) {
            throw new Error(`Failed to get Bitcoin balance: ${error}`);
        }
    }
    /**
     * Get Bitcoin transactions for address
     */
    async getBitcoinTransactions(address, limit = 10) {
        const queryAddress = address || this.wallet?.paymentAddress;
        if (!queryAddress) {
            throw new Error('No address provided and wallet not connected');
        }
        try {
            const response = await this.makeApiRequest(`/address/${queryAddress}/transactions?limit=${limit}`);
            return response.transactions.map((tx) => ({
                txid: tx.txid,
                blockHeight: tx.block_height,
                timestamp: tx.timestamp,
                fee: BigInt(tx.fee),
                inputs: tx.inputs.map((input) => ({
                    address: input.address,
                    value: BigInt(input.value)
                })),
                outputs: tx.outputs.map((output) => ({
                    address: output.address,
                    value: BigInt(output.value)
                }))
            }));
        }
        catch (error) {
            throw new Error(`Failed to get Bitcoin transactions: ${error}`);
        }
    }
    /**
     * Get Ordinals inscriptions for address
     */
    async getOrdinals(address, limit = 10) {
        const queryAddress = address || this.wallet?.ordinalsAddress || this.wallet?.paymentAddress;
        if (!queryAddress) {
            throw new Error('No address provided and wallet not connected');
        }
        try {
            const response = await this.makeApiRequest(`/address/${queryAddress}/ordinals?limit=${limit}`);
            return response.inscriptions.map((inscription) => ({
                id: inscription.id,
                number: inscription.number,
                address: inscription.address,
                contentType: inscription.content_type,
                contentLength: inscription.content_length,
                timestamp: inscription.timestamp
            }));
        }
        catch (error) {
            throw new Error(`Failed to get Ordinals: ${error}`);
        }
    }
    /**
     * Get Runes balances for address
     */
    async getRunes(address) {
        const queryAddress = address || this.wallet?.paymentAddress;
        if (!queryAddress) {
            throw new Error('No address provided and wallet not connected');
        }
        try {
            const response = await this.makeApiRequest(`/address/${queryAddress}/runes`);
            return response.runes.map((rune) => ({
                rune: rune.rune,
                runeId: rune.rune_id,
                amount: BigInt(rune.amount),
                symbol: rune.symbol,
                divisibility: rune.divisibility
            }));
        }
        catch (error) {
            throw new Error(`Failed to get Runes: ${error}`);
        }
    }
    /**
     * Get transaction details by txid
     */
    async getTransaction(txid) {
        try {
            const response = await this.makeApiRequest(`/transaction/${txid}`);
            return {
                txid: response.txid,
                blockHeight: response.block_height,
                timestamp: response.timestamp,
                fee: BigInt(response.fee),
                inputs: response.inputs.map((input) => ({
                    address: input.address,
                    value: BigInt(input.value)
                })),
                outputs: response.outputs.map((output) => ({
                    address: output.address,
                    value: BigInt(output.value)
                }))
            };
        }
        catch (error) {
            throw new Error(`Failed to get transaction: ${error}`);
        }
    }
    /**
     * Make authenticated request to Xverse API
     */
    async makeApiRequest(endpoint) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const headers = {
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
            }
            catch (error) {
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
exports.XverseWalletIntegration = XverseWalletIntegration;
/**
 * Factory function to create Xverse wallet integration
 */
function createXverseWallet(network = 'testnet', apiKey) {
    return new XverseWalletIntegration(network, apiKey);
}
//# sourceMappingURL=xverse-wallet.js.map