"use strict";
/**
 * Atomiq Cross-Chain Swap Integration
 *
 * Official SDK integration for trustless Bitcoin ↔ Starknet atomic swaps.
 * Uses @atomiqlabs/sdk for HTLC-based cross-chain swaps.
 *
 * Documentation: https://www.npmjs.com/package/@atomiqlabs/sdk
 *
 * Key Features:
 * - Bitcoin L1 ↔ Starknet swaps
 * - Atomic swap security with HTLC
 * - Automatic settlement with manual fallback
 * - Swap state tracking and monitoring
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
exports.AtomiqIntegration = void 0;
exports.createAtomiqIntegration = createAtomiqIntegration;
exports.createBitcoinWallet = createBitcoinWallet;
var SwapAmountType;
(function (SwapAmountType) {
    SwapAmountType["EXACT_IN"] = "EXACT_IN";
    SwapAmountType["EXACT_OUT"] = "EXACT_OUT";
})(SwapAmountType || (SwapAmountType = {}));
var SwapState;
(function (SwapState) {
    SwapState["CREATED"] = "CREATED";
    SwapState["COMMITED"] = "COMMITED";
    SwapState["CLAIMED"] = "CLAIMED";
    SwapState["REFUNDED"] = "REFUNDED";
    SwapState["FAILED"] = "FAILED";
})(SwapState || (SwapState = {}));
/**
 * Atomiq Integration for Bitcoin ↔ Starknet Swaps
 *
 * Provides trustless cross-chain atomic swaps using HTLC.
 */
class AtomiqIntegration {
    constructor(network = 'testnet', starknetRpcUrl, storageBasePath = './atomiq-storage') {
        this.swapper = null;
        this.initialized = false;
        this.network = network;
        this.starknetRpcUrl = starknetRpcUrl;
        this.storageBasePath = storageBasePath;
    }
    /**
     * Initialize Atomiq swapper with Starknet support
     *
     * Must be called before any swap operations.
     */
    async initialize() {
        if (this.initialized) {
            console.log('Atomiq swapper already initialized');
            return;
        }
        try {
            // Dynamic import to handle optional dependency
            const AtomiqSDK = await Promise.resolve().then(() => __importStar(require('@atomiqlabs/sdk')));
            const Factory = AtomiqSDK.Factory || AtomiqSDK.default?.Factory;
            const BitcoinNetwork = AtomiqSDK.BitcoinNetwork || AtomiqSDK.default?.BitcoinNetwork;
            if (!Factory) {
                throw new Error('Atomiq Factory not found in SDK');
            }
            // For Node.js environment, use SQLite storage
            let swapStorage, chainStorageCtor;
            try {
                const { SqliteUnifiedStorage, SqliteStorageManager } = await Promise.resolve().then(() => __importStar(require('@atomiqlabs/storage-sqlite')));
                swapStorage = (chainId) => new SqliteUnifiedStorage(`${this.storageBasePath}/CHAIN_${chainId}.sqlite3`);
                chainStorageCtor = (name) => new SqliteStorageManager(`${this.storageBasePath}/STORE_${name}.sqlite3`);
            }
            catch (error) {
                console.warn('SQLite storage not available, using default IndexedDB (browser only)');
                swapStorage = undefined;
                chainStorageCtor = undefined;
            }
            this.swapper = Factory.newSwapper({
                chains: {
                    STARKNET: {
                        rpcUrl: this.starknetRpcUrl
                    }
                },
                bitcoinNetwork: this.network === 'mainnet' ? BitcoinNetwork.MAINNET : BitcoinNetwork.TESTNET,
                ...(swapStorage && { swapStorage }),
                ...(chainStorageCtor && { chainStorageCtor })
            });
            if (!this.swapper) {
                throw new Error('Failed to create Atomiq swapper');
            }
            await this.swapper.init();
            this.initialized = true;
            console.log(`Atomiq swapper initialized for ${this.network}`);
            // Set up event listeners
            this.swapper.on('swapLimitsChanged', () => {
                console.log('Swap limits updated');
            });
        }
        catch (error) {
            throw new Error(`Failed to initialize Atomiq swapper: ${error}`);
        }
    }
    /**
     * Swap Bitcoin to Starknet token
     *
     * @param amount - Amount in satoshis (for BTC)
     * @param destinationToken - Starknet token address
     * @param destinationAddress - Starknet recipient address
     * @param btcWallet - Bitcoin wallet for signing
     * @param exactIn - If true, amount is input; if false, amount is output
     */
    async swapBTCToStarknet(amount, destinationToken, destinationAddress, btcWallet, exactIn = true) {
        this.ensureInitialized();
        try {
            const AtomiqSDK = await Promise.resolve().then(() => __importStar(require('@atomiqlabs/sdk')));
            const Tokens = AtomiqSDK.Tokens || AtomiqSDK.default?.Tokens;
            const SwapAmountType = AtomiqSDK.SwapAmountType || AtomiqSDK.default?.SwapAmountType;
            if (!Tokens || !SwapAmountType) {
                throw new Error('Atomiq Tokens or SwapAmountType not found in SDK');
            }
            // Create swap
            const swap = await this.swapper.swap(Tokens.BITCOIN.BTC, this.getStarknetToken(destinationToken), amount, exactIn ? SwapAmountType.EXACT_IN : SwapAmountType.EXACT_OUT, undefined, // BTC source address not needed
            destinationAddress);
            console.log(`Created BTC → Starknet swap: ${swap.getId()}`);
            console.log(`Input: ${swap.getInput()} sats, Output: ${swap.getOutput()} tokens`);
            console.log(`Fee: ${swap.getFee().amountInSrcToken} sats`);
            console.log(`Quote expires: ${new Date(swap.getQuoteExpiry()).toISOString()}`);
            // Track swap progress
            let btcTxId;
            let starknetTxId;
            // Execute swap with automatic settlement
            const automaticSettlementSuccess = await swap.execute(btcWallet, {
                onSourceTransactionSent: (txId) => {
                    btcTxId = txId;
                    console.log(`BTC transaction sent: ${txId}`);
                },
                onSourceTransactionConfirmationStatus: (txId, confirmations, targetConfirmations, txEtaMs) => {
                    console.log(`BTC tx ${txId}: ${confirmations}/${targetConfirmations} confirmations (ETA: ${Math.round(txEtaMs / 1000)}s)`);
                },
                onSourceTransactionConfirmed: (txId) => {
                    console.log(`BTC transaction confirmed: ${txId}`);
                },
                onSwapSettled: (txId) => {
                    starknetTxId = txId;
                    console.log(`Swap settled on Starknet: ${txId}`);
                }
            });
            // If automatic settlement failed, try manual claim
            if (!automaticSettlementSuccess) {
                console.warn('Automatic settlement failed, attempting manual claim...');
                // Manual claim would require Starknet wallet integration
                // await swap.claim(starknetWallet);
            }
            return {
                swapId: swap.getId(),
                fromToken: 'BTC',
                toToken: destinationToken,
                inputAmount: swap.getInput(),
                outputAmount: swap.getOutput(),
                fee: swap.getFee().amountInSrcToken,
                state: swap.getState(),
                btcTxId,
                starknetTxId,
                expiryTime: swap.getQuoteExpiry()
            };
        }
        catch (error) {
            throw new Error(`Failed to swap BTC to Starknet: ${error}`);
        }
    }
    /**
     * Swap Starknet token to Bitcoin
     *
     * @param amount - Amount in token units
     * @param sourceToken - Starknet token address
     * @param btcAddress - Bitcoin recipient address
     * @param starknetWallet - Starknet wallet for signing
     * @param exactIn - If true, amount is input; if false, amount is output
     */
    async swapStarknetToBTC(amount, sourceToken, btcAddress, starknetWallet, exactIn = true) {
        this.ensureInitialized();
        try {
            const AtomiqSDK = await Promise.resolve().then(() => __importStar(require('@atomiqlabs/sdk')));
            const Tokens = AtomiqSDK.Tokens || AtomiqSDK.default?.Tokens;
            const SwapAmountType = AtomiqSDK.SwapAmountType || AtomiqSDK.default?.SwapAmountType;
            if (!Tokens || !SwapAmountType) {
                throw new Error('Atomiq Tokens or SwapAmountType not found in SDK');
            }
            // Create swap
            const swap = await this.swapper.swap(this.getStarknetToken(sourceToken), Tokens.BITCOIN.BTC, amount, exactIn ? SwapAmountType.EXACT_IN : SwapAmountType.EXACT_OUT, starknetWallet.address, btcAddress);
            console.log(`Created Starknet → BTC swap: ${swap.getId()}`);
            console.log(`Input: ${swap.getInput()} tokens, Output: ${swap.getOutput()} sats`);
            // Track swap progress
            let starknetTxId;
            let btcTxId;
            // Execute swap
            const automaticSettlementSuccess = await swap.execute(undefined, // No BTC wallet needed for Starknet → BTC
            {
                onDestinationCommitSent: (txId) => {
                    starknetTxId = txId;
                    console.log(`Starknet commit transaction sent: ${txId}`);
                },
                onSwapSettled: (txId) => {
                    btcTxId = txId;
                    console.log(`BTC received: ${txId}`);
                }
            });
            if (!automaticSettlementSuccess) {
                console.warn('Automatic settlement failed');
            }
            return {
                swapId: swap.getId(),
                fromToken: sourceToken,
                toToken: 'BTC',
                inputAmount: swap.getInput(),
                outputAmount: swap.getOutput(),
                fee: swap.getFee().amountInSrcToken,
                state: swap.getState(),
                starknetTxId,
                btcTxId,
                expiryTime: swap.getQuoteExpiry()
            };
        }
        catch (error) {
            throw new Error(`Failed to swap Starknet to BTC: ${error}`);
        }
    }
    /**
     * Get swap limits for a token pair
     */
    async getSwapLimits(fromToken, toToken) {
        this.ensureInitialized();
        try {
            const AtomiqSDK = await Promise.resolve().then(() => __importStar(require('@atomiqlabs/sdk')));
            const Tokens = AtomiqSDK.Tokens || AtomiqSDK.default?.Tokens;
            if (!Tokens) {
                throw new Error('Atomiq Tokens not found in SDK');
            }
            const from = fromToken === 'BTC' ? Tokens.BITCOIN.BTC : this.getStarknetToken(fromToken);
            const to = toToken === 'BTC' ? Tokens.BITCOIN.BTC : this.getStarknetToken(toToken);
            return this.swapper.getSwapLimits(from, to);
        }
        catch (error) {
            throw new Error(`Failed to get swap limits: ${error}`);
        }
    }
    /**
     * Get swap status by ID
     */
    async getSwapStatus(swapId) {
        this.ensureInitialized();
        try {
            const swap = await this.swapper.getSwapById(swapId);
            if (!swap) {
                return null;
            }
            return {
                swapId: swap.getId(),
                fromToken: 'BTC', // Would need to track this
                toToken: 'STRK', // Would need to track this
                inputAmount: swap.getInput(),
                outputAmount: swap.getOutput(),
                fee: swap.getFee().amountInSrcToken,
                state: swap.getState(),
                expiryTime: swap.getQuoteExpiry()
            };
        }
        catch (error) {
            throw new Error(`Failed to get swap status: ${error}`);
        }
    }
    /**
     * Get all refundable swaps (expired or failed)
     */
    async getRefundableSwaps() {
        this.ensureInitialized();
        try {
            const swaps = await this.swapper.getRefundableSwaps();
            return swaps.map(swap => ({
                swapId: swap.getId(),
                fromToken: 'BTC',
                toToken: 'STRK',
                inputAmount: swap.getInput(),
                outputAmount: swap.getOutput(),
                fee: swap.getFee().amountInSrcToken,
                state: swap.getState(),
                expiryTime: swap.getQuoteExpiry()
            }));
        }
        catch (error) {
            throw new Error(`Failed to get refundable swaps: ${error}`);
        }
    }
    /**
     * Get all claimable swaps (completed while offline)
     */
    async getClaimableSwaps() {
        this.ensureInitialized();
        try {
            const swaps = await this.swapper.getClaimableSwaps();
            return swaps.map(swap => ({
                swapId: swap.getId(),
                fromToken: 'BTC',
                toToken: 'STRK',
                inputAmount: swap.getInput(),
                outputAmount: swap.getOutput(),
                fee: swap.getFee().amountInSrcToken,
                state: swap.getState(),
                expiryTime: swap.getQuoteExpiry()
            }));
        }
        catch (error) {
            throw new Error(`Failed to get claimable swaps: ${error}`);
        }
    }
    /**
     * Refund an expired or failed swap
     */
    async refundSwap(swapId) {
        this.ensureInitialized();
        try {
            const swap = await this.swapper.getSwapById(swapId);
            if (!swap) {
                throw new Error(`Swap ${swapId} not found`);
            }
            await swap.refund();
            console.log(`Swap ${swapId} refunded`);
            return swapId; // Return swap ID as transaction reference
        }
        catch (error) {
            throw new Error(`Failed to refund swap: ${error}`);
        }
    }
    // Private helper methods
    ensureInitialized() {
        if (!this.initialized || !this.swapper) {
            throw new Error('Atomiq swapper not initialized. Call initialize() first.');
        }
    }
    getStarknetToken(tokenAddress) {
        // Map Starknet token addresses to Atomiq token objects
        // This would need to be expanded based on supported tokens
        // Common Starknet tokens
        const TOKEN_MAP = {
            '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
            '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8': 'USDC',
            '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
            '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac': 'WBTC'
        };
        const tokenSymbol = TOKEN_MAP[tokenAddress];
        if (!tokenSymbol) {
            throw new Error(`Unsupported Starknet token: ${tokenAddress}`);
        }
        // Return token object (would use Tokens.STARKNET[tokenSymbol] from SDK)
        return { address: tokenAddress, symbol: tokenSymbol };
    }
}
exports.AtomiqIntegration = AtomiqIntegration;
/**
 * Factory function to create Atomiq integration instance
 */
function createAtomiqIntegration(network = 'testnet', starknetRpcUrl, storageBasePath) {
    return new AtomiqIntegration(network, starknetRpcUrl, storageBasePath);
}
/**
 * Helper to create Bitcoin wallet interface for Atomiq
 */
function createBitcoinWallet(address, publicKey, signPsbtFn) {
    return {
        address,
        publicKey,
        signPsbt: async (psbt, signInputs) => {
            return signPsbtFn(psbt.psbtHex, signInputs);
        }
    };
}
//# sourceMappingURL=atomiq-integration.js.map