"use strict";
/**
 * Wallet Compatibility Layer
 *
 * Provides unified interface for connecting to multiple wallet providers:
 * - Xverse (Bitcoin wallet with Starknet bridge support)
 * - Argent X (Starknet native wallet)
 * - Braavos (Starknet native wallet)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletConnector = exports.ConnectionStatus = exports.WalletType = void 0;
exports.createWalletConnector = createWalletConnector;
exports.getRecommendedWallet = getRecommendedWallet;
const starknet_1 = require("starknet");
/**
 * Supported wallet types
 */
var WalletType;
(function (WalletType) {
    WalletType["XVERSE"] = "xverse";
    WalletType["ARGENT_X"] = "argentX";
    WalletType["BRAAVOS"] = "braavos";
    WalletType["UNKNOWN"] = "unknown";
})(WalletType || (exports.WalletType = WalletType = {}));
/**
 * Wallet connection status
 */
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["DISCONNECTED"] = "disconnected";
    ConnectionStatus["CONNECTING"] = "connecting";
    ConnectionStatus["CONNECTED"] = "connected";
    ConnectionStatus["ERROR"] = "error";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));
/**
 * Unified Wallet Connector
 *
 * Provides a single interface for connecting to and interacting with
 * multiple wallet providers on Starknet.
 */
class WalletConnector {
    constructor(rpcUrl) {
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        this.eventHandlers = new Map();
        this.provider = new starknet_1.RpcProvider({ nodeUrl: rpcUrl });
        this.initializeEventHandlers();
    }
    /**
     * Detect available wallets
     */
    async detectWallets() {
        const wallets = [];
        // Check for Argent X
        const argentX = await this.detectArgentX();
        if (argentX) {
            wallets.push(argentX);
        }
        // Check for Braavos
        const braavos = await this.detectBraavos();
        if (braavos) {
            wallets.push(braavos);
        }
        // Check for Xverse
        const xverse = await this.detectXverse();
        if (xverse) {
            wallets.push(xverse);
        }
        return wallets;
    }
    /**
     * Connect to a specific wallet
     */
    async connect(walletType) {
        try {
            this.connectionStatus = ConnectionStatus.CONNECTING;
            let result;
            switch (walletType) {
                case WalletType.ARGENT_X:
                    result = await this.connectArgentX();
                    break;
                case WalletType.BRAAVOS:
                    result = await this.connectBraavos();
                    break;
                case WalletType.XVERSE:
                    result = await this.connectXverse();
                    break;
                default:
                    result = {
                        success: false,
                        walletType: WalletType.UNKNOWN,
                        error: 'Unsupported wallet type'
                    };
            }
            if (result.success) {
                this.connectedWallet = walletType;
                this.connectedAccount = result.account;
                this.connectedAddress = result.address;
                this.connectionStatus = ConnectionStatus.CONNECTED;
                this.emit('connect', { walletType, address: result.address });
            }
            else {
                this.connectionStatus = ConnectionStatus.ERROR;
            }
            return result;
        }
        catch (error) {
            this.connectionStatus = ConnectionStatus.ERROR;
            return {
                success: false,
                walletType,
                error: `Failed to connect to ${walletType}: ${error}`
            };
        }
    }
    /**
     * Disconnect from current wallet
     */
    async disconnect() {
        if (this.connectedWallet) {
            this.emit('disconnect', { walletType: this.connectedWallet });
        }
        this.connectedWallet = undefined;
        this.connectedAccount = undefined;
        this.connectedAddress = undefined;
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
    }
    /**
     * Get connected wallet info
     */
    getConnectedWallet() {
        if (!this.connectedWallet || !this.connectedAddress) {
            return null;
        }
        return {
            type: this.connectedWallet,
            name: this.getWalletName(this.connectedWallet),
            address: this.connectedAddress,
            isInstalled: true,
            isConnected: true
        };
    }
    /**
     * Get connected account
     */
    getAccount() {
        return this.connectedAccount;
    }
    /**
     * Get connection status
     */
    getStatus() {
        return this.connectionStatus;
    }
    /**
     * Check if wallet is connected
     */
    isConnected() {
        return this.connectionStatus === ConnectionStatus.CONNECTED;
    }
    /**
     * Execute transaction through connected wallet
     */
    async executeTransaction(request) {
        if (!this.connectedAccount) {
            throw new Error('No wallet connected');
        }
        try {
            const result = await this.connectedAccount.execute({
                contractAddress: request.contractAddress,
                entrypoint: request.entrypoint,
                calldata: request.calldata
            });
            return result.transaction_hash;
        }
        catch (error) {
            throw new Error(`Transaction failed: ${error}`);
        }
    }
    /**
     * Sign message with connected wallet
     */
    async signMessage(message) {
        if (!this.connectedAccount) {
            throw new Error('No wallet connected');
        }
        try {
            // Convert message to typed data for signing
            const typedData = {
                types: {
                    StarkNetDomain: [
                        { name: 'name', type: 'felt' },
                        { name: 'version', type: 'felt' },
                        { name: 'chainId', type: 'felt' }
                    ],
                    Message: [{ name: 'message', type: 'felt' }]
                },
                primaryType: 'Message',
                domain: {
                    name: 'Kirito SDK',
                    version: '1',
                    chainId: starknet_1.constants.StarknetChainId.SN_SEPOLIA
                },
                message: {
                    message
                }
            };
            const signature = await this.connectedAccount.signMessage(typedData);
            return signature;
        }
        catch (error) {
            throw new Error(`Message signing failed: ${error}`);
        }
    }
    /**
     * Switch network
     */
    async switchNetwork(chainId) {
        if (!this.connectedWallet) {
            throw new Error('No wallet connected');
        }
        try {
            // Request network switch through wallet
            const starknet = window.starknet;
            if (starknet && starknet.request) {
                await starknet.request({
                    type: 'wallet_switchStarknetChain',
                    params: { chainId }
                });
                this.emit('networkChanged', { chainId });
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Failed to switch network:', error);
            return false;
        }
    }
    /**
     * Add event listener
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }
    /**
     * Remove event listener
     */
    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    /**
     * Private helper methods
     */
    async detectArgentX() {
        try {
            const starknet = window.starknet;
            if (starknet && starknet.id === 'argentX') {
                return {
                    type: WalletType.ARGENT_X,
                    name: 'Argent X',
                    icon: 'https://www.argent.xyz/favicon.ico',
                    isInstalled: true,
                    isConnected: starknet.isConnected || false,
                    address: starknet.selectedAddress
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async detectBraavos() {
        try {
            const starknet = window.starknet;
            if (starknet && starknet.id === 'braavos') {
                return {
                    type: WalletType.BRAAVOS,
                    name: 'Braavos',
                    icon: 'https://braavos.app/favicon.ico',
                    isInstalled: true,
                    isConnected: starknet.isConnected || false,
                    address: starknet.selectedAddress
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async detectXverse() {
        try {
            // Xverse is primarily a Bitcoin wallet with Starknet bridge support
            const xverse = window.XverseProviders?.StacksProvider;
            if (xverse) {
                return {
                    type: WalletType.XVERSE,
                    name: 'Xverse',
                    icon: 'https://www.xverse.app/favicon.ico',
                    isInstalled: true,
                    isConnected: false // Will be connected through bridge
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    async connectArgentX() {
        try {
            const starknet = window.starknet;
            if (!starknet || starknet.id !== 'argentX') {
                return {
                    success: false,
                    walletType: WalletType.ARGENT_X,
                    error: 'Argent X not installed'
                };
            }
            // Enable wallet connection
            await starknet.enable({ starknetVersion: 'v5' });
            if (!starknet.isConnected) {
                return {
                    success: false,
                    walletType: WalletType.ARGENT_X,
                    error: 'Failed to connect to Argent X'
                };
            }
            // Create account instance
            const account = new starknet_1.Account(this.provider, starknet.selectedAddress, starknet.account);
            return {
                success: true,
                walletType: WalletType.ARGENT_X,
                address: starknet.selectedAddress,
                account
            };
        }
        catch (error) {
            return {
                success: false,
                walletType: WalletType.ARGENT_X,
                error: `Argent X connection failed: ${error}`
            };
        }
    }
    async connectBraavos() {
        try {
            const starknet = window.starknet;
            if (!starknet || starknet.id !== 'braavos') {
                return {
                    success: false,
                    walletType: WalletType.BRAAVOS,
                    error: 'Braavos not installed'
                };
            }
            // Enable wallet connection
            await starknet.enable({ starknetVersion: 'v5' });
            if (!starknet.isConnected) {
                return {
                    success: false,
                    walletType: WalletType.BRAAVOS,
                    error: 'Failed to connect to Braavos'
                };
            }
            // Create account instance
            const account = new starknet_1.Account(this.provider, starknet.selectedAddress, starknet.account);
            return {
                success: true,
                walletType: WalletType.BRAAVOS,
                address: starknet.selectedAddress,
                account
            };
        }
        catch (error) {
            return {
                success: false,
                walletType: WalletType.BRAAVOS,
                error: `Braavos connection failed: ${error}`
            };
        }
    }
    async connectXverse() {
        try {
            // Xverse connection is handled through the Xverse bridge integration
            // This is a simplified implementation
            const xverse = window.XverseProviders?.StacksProvider;
            if (!xverse) {
                return {
                    success: false,
                    walletType: WalletType.XVERSE,
                    error: 'Xverse not installed'
                };
            }
            // Request connection
            const response = await xverse.request('stx_requestAccounts', null);
            if (!response || !response.result) {
                return {
                    success: false,
                    walletType: WalletType.XVERSE,
                    error: 'Failed to connect to Xverse'
                };
            }
            // For Xverse, we need to use the bridge to get Starknet address
            // This is a mock implementation - actual implementation would use XverseBridge
            const mockStarknetAddress = '0x' + '0'.repeat(63) + '1';
            return {
                success: true,
                walletType: WalletType.XVERSE,
                address: mockStarknetAddress,
                // Note: Xverse doesn't provide direct Starknet account
                // Transactions go through the bridge
            };
        }
        catch (error) {
            return {
                success: false,
                walletType: WalletType.XVERSE,
                error: `Xverse connection failed: ${error}`
            };
        }
    }
    getWalletName(walletType) {
        switch (walletType) {
            case WalletType.ARGENT_X:
                return 'Argent X';
            case WalletType.BRAAVOS:
                return 'Braavos';
            case WalletType.XVERSE:
                return 'Xverse';
            default:
                return 'Unknown';
        }
    }
    initializeEventHandlers() {
        // Listen for wallet events from browser extension
        if (typeof window !== 'undefined') {
            const starknet = window.starknet;
            if (starknet) {
                // Account changed
                starknet.on?.('accountsChanged', (accounts) => {
                    this.emit('accountsChanged', { accounts });
                    if (accounts.length > 0) {
                        this.connectedAddress = accounts[0];
                    }
                });
                // Network changed
                starknet.on?.('networkChanged', (network) => {
                    this.emit('networkChanged', { network });
                });
            }
        }
    }
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }
}
exports.WalletConnector = WalletConnector;
/**
 * Factory function to create wallet connector
 */
function createWalletConnector(rpcUrl) {
    return new WalletConnector(rpcUrl);
}
/**
 * Utility function to get recommended wallet for user
 */
async function getRecommendedWallet() {
    const connector = new WalletConnector('');
    const wallets = await connector.detectWallets();
    // Prefer Argent X if installed (most popular Starknet wallet)
    const argentX = wallets.find(w => w.type === WalletType.ARGENT_X);
    if (argentX?.isInstalled) {
        return WalletType.ARGENT_X;
    }
    // Then Braavos
    const braavos = wallets.find(w => w.type === WalletType.BRAAVOS);
    if (braavos?.isInstalled) {
        return WalletType.BRAAVOS;
    }
    // Finally Xverse (for Bitcoin users)
    const xverse = wallets.find(w => w.type === WalletType.XVERSE);
    if (xverse?.isInstalled) {
        return WalletType.XVERSE;
    }
    // Default to Argent X (most popular)
    return WalletType.ARGENT_X;
}
//# sourceMappingURL=wallet-connector.js.map