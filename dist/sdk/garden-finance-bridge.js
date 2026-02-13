"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GardenFinanceBridgeImpl = void 0;
exports.createGardenFinanceBridge = createGardenFinanceBridge;
const bridge_1 = require("../interfaces/bridge");
/**
 * Garden Finance Bridge Implementation
 *
 * Integrates with Garden Finance for Bitcoin DeFi operations,
 * BTC wrapping/unwrapping, and atomic swaps.
 */
class GardenFinanceBridgeImpl {
    constructor(network = 'testnet', apiKey) {
        this.network = network;
        this.apiKey = apiKey;
        this.apiUrl = network === 'mainnet'
            ? 'https://api.garden.finance/v1'
            : 'https://api-testnet.garden.finance/v1';
    }
    /**
     * Wrap BTC to WBTC with transaction confirmation monitoring
     */
    async wrapBTC(amount, destinationAddress) {
        try {
            const response = await this.makeRequest('/wrap', {
                method: 'POST',
                body: JSON.stringify({
                    amount: amount.toString(),
                    destination_address: destinationAddress,
                    source_token: 'BTC',
                    destination_token: 'WBTC',
                    network: 'starknet'
                })
            });
            const wrap = response.data;
            const transaction = {
                id: wrap.transaction_id,
                status: this.mapStatus(wrap.status),
                fromChain: 'bitcoin',
                toChain: 'starknet',
                fromToken: 'BTC',
                toToken: 'WBTC',
                fromAmount: amount,
                toAmount: BigInt(wrap.wrapped_amount),
                txHash: wrap.tx_hash,
                confirmations: wrap.confirmations || 0,
                requiredConfirmations: 6
            };
            // Start monitoring transaction confirmations in background
            this.monitorTransactionConfirmations(transaction.id).catch(error => {
                console.error(`Failed to monitor wrap transaction ${transaction.id}:`, error);
            });
            return transaction;
        }
        catch (error) {
            throw new Error(`Failed to wrap BTC: ${error}`);
        }
    }
    /**
     * Unwrap WBTC to BTC with transaction confirmation monitoring
     */
    async unwrapWBTC(amount, btcAddress) {
        try {
            // Validate Bitcoin address format
            const btcAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
            if (!btcAddressRegex.test(btcAddress)) {
                throw new Error('Invalid Bitcoin address format');
            }
            const response = await this.makeRequest('/unwrap', {
                method: 'POST',
                body: JSON.stringify({
                    amount: amount.toString(),
                    destination_address: btcAddress,
                    source_token: 'WBTC',
                    destination_token: 'BTC',
                    network: 'bitcoin'
                })
            });
            const unwrap = response.data;
            const transaction = {
                id: unwrap.transaction_id,
                status: this.mapStatus(unwrap.status),
                fromChain: 'starknet',
                toChain: 'bitcoin',
                fromToken: 'WBTC',
                toToken: 'BTC',
                fromAmount: amount,
                toAmount: BigInt(unwrap.unwrapped_amount),
                txHash: unwrap.tx_hash,
                confirmations: unwrap.confirmations || 0,
                requiredConfirmations: 6
            };
            // Start monitoring transaction confirmations in background
            this.monitorTransactionConfirmations(transaction.id).catch(error => {
                console.error(`Failed to monitor unwrap transaction ${transaction.id}:`, error);
            });
            return transaction;
        }
        catch (error) {
            throw new Error(`Failed to unwrap WBTC: ${error}`);
        }
    }
    /**
     * Create atomic swap between Starknet tokens and BTC/WBTC with secure secret generation
     */
    async createAtomicSwap(fromToken, toToken, amount, counterparty) {
        try {
            // Generate cryptographically secure secret for atomic swap
            const secret = await this.generateSecureSecret();
            const secretHash = await this.hashSecret(secret);
            // Validate secret and hash
            if (secret.length !== 64) { // 32 bytes = 64 hex chars
                throw new Error('Invalid secret length');
            }
            if (secretHash.length !== 64) { // SHA-256 = 64 hex chars
                throw new Error('Invalid secret hash length');
            }
            const response = await this.makeRequest('/atomic-swap', {
                method: 'POST',
                body: JSON.stringify({
                    from_token: fromToken,
                    to_token: toToken,
                    amount: amount.toString(),
                    counterparty,
                    secret_hash: secretHash,
                    lock_time: Math.floor(Date.now() / 1000) + 86400 // 24 hours
                })
            });
            const swap = response.data;
            // Store secret securely (in production, use secure storage)
            console.log(`Atomic swap created with ID: ${swap.swap_id}`);
            console.log(`Secret (store securely): ${secret}`);
            console.log(`Secret hash: ${secretHash}`);
            return {
                id: swap.swap_id,
                fromToken,
                toToken,
                amount,
                counterparty,
                lockTime: swap.lock_time,
                secretHash,
                status: bridge_1.AtomicSwapStatus.CREATED
            };
        }
        catch (error) {
            throw new Error(`Failed to create atomic swap: ${error}`);
        }
    }
    /**
     * Get optimal liquidity route for token conversion
     */
    async getOptimalRoute(fromToken, toToken, amount) {
        try {
            const response = await this.makeRequest('/route', {
                method: 'POST',
                body: JSON.stringify({
                    from_token: fromToken,
                    to_token: toToken,
                    amount: amount.toString()
                })
            });
            const route = response.data;
            return {
                path: route.path,
                expectedOutput: BigInt(route.expected_output),
                priceImpact: route.price_impact,
                fees: route.fees.map((fee) => BigInt(fee))
            };
        }
        catch (error) {
            throw new Error(`Failed to get optimal route: ${error}`);
        }
    }
    /**
     * Execute atomic swap with optimal routing
     */
    async executeAtomicSwapWithRouting(fromToken, toToken, amount, destinationAddress) {
        try {
            // First get optimal route
            const route = await this.getOptimalRoute(fromToken, toToken, amount);
            // Execute swap using the optimal route
            const response = await this.makeRequest('/execute-swap', {
                method: 'POST',
                body: JSON.stringify({
                    from_token: fromToken,
                    to_token: toToken,
                    amount: amount.toString(),
                    destination_address: destinationAddress,
                    route: route.path,
                    max_slippage: 0.5 // 0.5% max slippage
                })
            });
            const swap = response.data;
            return {
                id: swap.transaction_id,
                status: this.mapStatus(swap.status),
                fromChain: this.getChainForToken(fromToken),
                toChain: this.getChainForToken(toToken),
                fromToken,
                toToken,
                fromAmount: amount,
                toAmount: route.expectedOutput,
                txHash: swap.tx_hash,
                confirmations: swap.confirmations || 0,
                requiredConfirmations: this.getRequiredConfirmations(toToken)
            };
        }
        catch (error) {
            throw new Error(`Failed to execute atomic swap with routing: ${error}`);
        }
    }
    /**
     * Lock funds for atomic swap
     */
    async lockSwapFunds(swapId, secret) {
        try {
            const response = await this.makeRequest(`/atomic-swap/${swapId}/lock`, {
                method: 'POST',
                body: JSON.stringify({
                    secret
                })
            });
            return response.data.tx_hash;
        }
        catch (error) {
            throw new Error(`Failed to lock swap funds: ${error}`);
        }
    }
    /**
     * Redeem atomic swap
     */
    async redeemSwap(swapId, secret) {
        try {
            const response = await this.makeRequest(`/atomic-swap/${swapId}/redeem`, {
                method: 'POST',
                body: JSON.stringify({
                    secret
                })
            });
            return response.data.tx_hash;
        }
        catch (error) {
            throw new Error(`Failed to redeem swap: ${error}`);
        }
    }
    /**
     * Refund atomic swap (if expired)
     */
    async refundSwap(swapId) {
        try {
            const response = await this.makeRequest(`/atomic-swap/${swapId}/refund`, {
                method: 'POST'
            });
            return response.data.tx_hash;
        }
        catch (error) {
            throw new Error(`Failed to refund swap: ${error}`);
        }
    }
    /**
     * Get swap status
     */
    async getSwapStatus(swapId) {
        try {
            const response = await this.makeRequest(`/atomic-swap/${swapId}`);
            const swap = response.data;
            return {
                id: swap.swap_id,
                fromToken: swap.from_token,
                toToken: swap.to_token,
                amount: BigInt(swap.amount),
                counterparty: swap.counterparty,
                lockTime: swap.lock_time,
                secretHash: swap.secret_hash,
                status: this.mapSwapStatus(swap.status)
            };
        }
        catch (error) {
            throw new Error(`Failed to get swap status: ${error}`);
        }
    }
    /**
     * Make authenticated request to Garden Finance API
     */
    async makeRequest(endpoint, options) {
        const headers = {
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
            throw new Error(`Garden Finance API error: ${response.status} - ${error}`);
        }
        return response.json();
    }
    /**
     * Generate cryptographically secure random secret for atomic swap
     * Uses Web Crypto API for true randomness
     */
    async generateSecureSecret() {
        // Use Web Crypto API for secure random generation
        if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
            throw new Error('Web Crypto API not available. Secure random generation requires a modern browser or Node.js 15+');
        }
        const array = new Uint8Array(32); // 32 bytes = 256 bits
        crypto.getRandomValues(array);
        // Convert to hex string
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Monitor transaction confirmations until completion
     */
    async monitorTransactionConfirmations(transactionId) {
        const maxAttempts = 120; // 20 minutes with 10s intervals
        const checkInterval = 10000; // 10 seconds
        let attempts = 0;
        console.log(`Starting confirmation monitoring for transaction ${transactionId}`);
        while (attempts < maxAttempts) {
            try {
                const response = await this.makeRequest(`/transaction/${transactionId}/status`);
                const status = response.data;
                const confirmations = status.confirmations || 0;
                const requiredConfirmations = status.required_confirmations || 6;
                console.log(`Transaction ${transactionId}: ${confirmations}/${requiredConfirmations} confirmations`);
                // Check if transaction is complete
                if (status.status === 'completed' || confirmations >= requiredConfirmations) {
                    console.log(`Transaction ${transactionId} confirmed with ${confirmations} confirmations`);
                    return;
                }
                // Check if transaction failed
                if (status.status === 'failed' || status.status === 'expired') {
                    console.error(`Transaction ${transactionId} failed with status: ${status.status}`);
                    return;
                }
                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                attempts++;
            }
            catch (error) {
                console.error(`Error monitoring transaction ${transactionId}:`, error);
                // Continue monitoring even if one check fails
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                attempts++;
            }
        }
        console.warn(`Transaction monitoring timeout for ${transactionId} after ${maxAttempts} attempts`);
    }
    /**
     * Hash secret using SHA-256
     */
    async hashSecret(secret) {
        const encoder = new TextEncoder();
        const data = encoder.encode(secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    /**
     * Map Garden Finance status to internal status
     */
    mapStatus(gardenStatus) {
        switch (gardenStatus.toLowerCase()) {
            case 'pending':
            case 'initiated':
                return bridge_1.BridgeTransactionStatus.PENDING;
            case 'confirmed':
                return bridge_1.BridgeTransactionStatus.CONFIRMED;
            case 'completed':
                return bridge_1.BridgeTransactionStatus.COMPLETED;
            case 'failed':
            case 'expired':
                return bridge_1.BridgeTransactionStatus.FAILED;
            default:
                return bridge_1.BridgeTransactionStatus.PENDING;
        }
    }
    /**
     * Map Garden Finance swap status to internal swap status
     */
    mapSwapStatus(gardenStatus) {
        switch (gardenStatus.toLowerCase()) {
            case 'created':
                return bridge_1.AtomicSwapStatus.CREATED;
            case 'locked':
                return bridge_1.AtomicSwapStatus.LOCKED;
            case 'redeemed':
                return bridge_1.AtomicSwapStatus.REDEEMED;
            case 'refunded':
                return bridge_1.AtomicSwapStatus.REFUNDED;
            default:
                return bridge_1.AtomicSwapStatus.CREATED;
        }
    }
    /**
     * Get chain name for token
     */
    getChainForToken(token) {
        switch (token.toLowerCase()) {
            case 'btc':
                return 'bitcoin';
            case 'eth':
            case 'strk':
            case 'usdc':
            case 'wbtc':
                return 'starknet';
            default:
                return 'unknown';
        }
    }
    /**
     * Get required confirmations for token
     */
    getRequiredConfirmations(token) {
        switch (token.toLowerCase()) {
            case 'btc':
                return 6;
            case 'eth':
                return 12;
            case 'strk':
            case 'usdc':
            case 'wbtc':
                return 1;
            default:
                return 6;
        }
    }
}
exports.GardenFinanceBridgeImpl = GardenFinanceBridgeImpl;
/**
 * Factory function to create Garden Finance bridge instance
 */
function createGardenFinanceBridge(network = 'testnet', apiKey) {
    return new GardenFinanceBridgeImpl(network, apiKey);
}
//# sourceMappingURL=garden-finance-bridge.js.map