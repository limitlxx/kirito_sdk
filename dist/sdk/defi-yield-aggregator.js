"use strict";
/**
 * Unified DeFi Yield Aggregator
 *
 * Aggregates yields from multiple DeFi protocols (Vesu, Ekubo) with
 * weighted distribution, health monitoring, and yield optimization.
 *
 * Note: Atomiq is a cross-chain swap protocol and is NOT included as a yield source.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeFiYieldAggregator = exports.DeFiProtocol = void 0;
exports.createDeFiYieldAggregator = createDeFiYieldAggregator;
const vesu_integration_1 = require("./vesu-integration");
const ekubo_integration_1 = require("./ekubo-integration");
/**
 * DeFi protocol types
 */
var DeFiProtocol;
(function (DeFiProtocol) {
    DeFiProtocol["VESU"] = "vesu";
    DeFiProtocol["EKUBO"] = "ekubo";
})(DeFiProtocol || (exports.DeFiProtocol = DeFiProtocol = {}));
/**
 * Unified DeFi Yield Aggregator
 *
 * Combines yields from Vesu and Ekubo with intelligent weighting,
 * health monitoring, and automatic optimization recommendations.
 *
 * Note: Atomiq is NOT included as it's a cross-chain swap protocol, not a yield source.
 */
class DeFiYieldAggregator {
    constructor(config, starknetAccount) {
        this.protocols = new Map();
        this.integrations = new Map();
        this.healthCache = new Map();
        this.healthCacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.config = config;
        this.starknetAccount = starknetAccount;
        this.initializeDefaultProtocols();
        this.initializeIntegrations();
    }
    /**
     * Add or update protocol configuration
     */
    addProtocol(protocolConfig) {
        this.protocols.set(protocolConfig.protocol, protocolConfig);
        this.initializeProtocolIntegration(protocolConfig);
    }
    /**
     * Remove protocol from aggregation
     */
    removeProtocol(protocol) {
        const removed = this.protocols.delete(protocol);
        if (removed) {
            this.integrations.delete(protocol);
            this.healthCache.delete(protocol);
        }
        return removed;
    }
    /**
     * Get aggregated yield from all active and healthy protocols
     */
    async getAggregatedYield(walletAddress, period) {
        try {
            const protocolBreakdowns = [];
            let totalWeightedYield = BigInt(0);
            let totalWeight = 0;
            let totalHealthScore = 0;
            // Get yields from all active protocols
            for (const [protocol, config] of this.protocols) {
                if (!config.isActive)
                    continue;
                try {
                    // Check protocol health first
                    const health = await this.checkProtocolHealth(protocol, walletAddress);
                    if (!health.isHealthy && health.healthScore < config.healthThreshold) {
                        console.warn(`Skipping unhealthy protocol ${protocol}: ${health.issues.join(', ')}`);
                        continue;
                    }
                    // Get yield from protocol
                    const yieldData = await this.getProtocolYield(protocol, walletAddress, period);
                    const weightedYield = BigInt(Math.floor(Number(yieldData.amount) * config.weight));
                    protocolBreakdowns.push({
                        protocol,
                        protocolName: this.getProtocolName(protocol),
                        rawYield: yieldData.amount,
                        weightedYield,
                        weight: config.weight,
                        healthScore: health.healthScore,
                        isHealthy: health.isHealthy,
                        token: yieldData.token,
                        apy: await this.getProtocolAPY(protocol, walletAddress)
                    });
                    totalWeightedYield += weightedYield;
                    totalWeight += config.weight;
                    totalHealthScore += health.healthScore;
                }
                catch (error) {
                    console.warn(`Failed to get yield from protocol ${protocol}: ${error}`);
                    // Continue with other protocols
                }
            }
            // Normalize weights if they don't sum to 1.0
            if (totalWeight !== 1.0 && totalWeight > 0) {
                const normalizationFactor = 1.0 / totalWeight;
                protocolBreakdowns.forEach(pb => {
                    pb.weight *= normalizationFactor;
                    pb.weightedYield = BigInt(Math.floor(Number(pb.rawYield) * pb.weight));
                });
                // Recalculate total
                totalWeightedYield = protocolBreakdowns.reduce((sum, pb) => sum + pb.weightedYield, BigInt(0));
            }
            // Calculate overall health score
            const overallHealthScore = protocolBreakdowns.length > 0
                ? totalHealthScore / protocolBreakdowns.length
                : 0;
            return {
                totalYield: totalWeightedYield,
                protocolBreakdown: protocolBreakdowns,
                period,
                aggregationTimestamp: Date.now(),
                healthScore: overallHealthScore
            };
        }
        catch (error) {
            throw new Error(`Failed to aggregate DeFi yields: ${error}`);
        }
    }
    /**
     * Monitor health of all protocols
     */
    async monitorProtocolHealth() {
        const healthResults = new Map();
        for (const [protocol, config] of this.protocols) {
            if (!config.isActive)
                continue;
            try {
                // Use representative wallet for health checks
                const representativeWallet = this.config.network.contracts.yieldDistributor;
                const health = await this.checkProtocolHealth(protocol, representativeWallet);
                healthResults.set(protocol, health);
            }
            catch (error) {
                console.error(`Failed to check health for protocol ${protocol}: ${error}`);
                healthResults.set(protocol, {
                    protocol,
                    isHealthy: false,
                    healthScore: 0,
                    issues: [`Health check failed: ${error}`],
                    recommendations: ['Check protocol connectivity and contract status'],
                    lastChecked: Date.now()
                });
            }
        }
        return healthResults;
    }
    /**
     * Get yield optimization recommendations
     */
    async getYieldOptimizationRecommendations(walletAddress, period) {
        try {
            // Get current aggregated yield
            const currentYield = await this.getAggregatedYield(walletAddress, period);
            // Calculate current APY
            const periodDays = (period.end - period.start) / (1000 * 60 * 60 * 24);
            const annualizedYield = Number(currentYield.totalYield) * (365 / periodDays);
            const currentAPY = annualizedYield / 1000000; // Simplified calculation
            // Get individual protocol APYs for optimization
            const protocolAPYs = await Promise.all(Array.from(this.protocols.keys()).map(async (protocol) => ({
                protocol,
                apy: await this.getProtocolAPY(protocol, walletAddress),
                healthScore: (await this.checkProtocolHealth(protocol, walletAddress)).healthScore
            })));
            // Sort protocols by risk-adjusted APY (APY * health score)
            const sortedProtocols = protocolAPYs
                .filter(p => this.protocols.get(p.protocol)?.isActive)
                .sort((a, b) => (b.apy * b.healthScore) - (a.apy * a.healthScore));
            // Generate rebalancing recommendations
            const rebalanceRecommendations = [];
            let optimizedAPY = currentAPY;
            for (let i = 0; i < sortedProtocols.length; i++) {
                const protocol = sortedProtocols[i];
                const currentConfig = this.protocols.get(protocol.protocol);
                if (!currentConfig)
                    continue;
                let recommendedWeight = currentConfig.weight;
                let reason = 'Maintain current allocation';
                // Increase weight for high-performing, healthy protocols
                if (protocol.apy > currentAPY && protocol.healthScore > 0.8) {
                    recommendedWeight = Math.min(0.6, currentConfig.weight + 0.1);
                    reason = 'Increase allocation to high-performing protocol';
                    optimizedAPY += (protocol.apy - currentAPY) * 0.1;
                }
                // Decrease weight for underperforming or unhealthy protocols
                else if (protocol.apy < currentAPY * 0.8 || protocol.healthScore < 0.6) {
                    recommendedWeight = Math.max(0.1, currentConfig.weight - 0.1);
                    reason = 'Reduce allocation due to poor performance or health';
                }
                rebalanceRecommendations.push({
                    protocol: protocol.protocol,
                    currentWeight: currentConfig.weight,
                    recommendedWeight,
                    reason
                });
            }
            // Normalize recommended weights
            const totalRecommendedWeight = rebalanceRecommendations.reduce((sum, rec) => sum + rec.recommendedWeight, 0);
            if (totalRecommendedWeight !== 1.0) {
                const normalizationFactor = 1.0 / totalRecommendedWeight;
                rebalanceRecommendations.forEach(rec => {
                    rec.recommendedWeight *= normalizationFactor;
                });
            }
            return {
                currentAPY,
                optimizedAPY,
                rebalanceRecommendations,
                estimatedGasForRebalance: BigInt(500000), // Mock gas estimate
                estimatedTimeToBreakeven: Math.max(1, (optimizedAPY - currentAPY) > 0 ? 30 / (optimizedAPY - currentAPY) : 365)
            };
        }
        catch (error) {
            throw new Error(`Failed to generate yield optimization recommendations: ${error}`);
        }
    }
    /**
     * Execute automatic rebalancing based on optimization recommendations
     */
    async executeRebalancing(walletAddress, optimization) {
        try {
            const transactions = [];
            for (const recommendation of optimization.rebalanceRecommendations) {
                const currentConfig = this.protocols.get(recommendation.protocol);
                if (!currentConfig)
                    continue;
                // Skip if no significant change needed
                if (Math.abs(recommendation.recommendedWeight - recommendation.currentWeight) < 0.05) {
                    continue;
                }
                // Update protocol weight
                currentConfig.weight = recommendation.recommendedWeight;
                this.protocols.set(recommendation.protocol, currentConfig);
                // Execute rebalancing transaction (simplified)
                const txHash = await this.executeRebalanceTransaction(recommendation.protocol, walletAddress, recommendation.recommendedWeight);
                transactions.push(txHash);
            }
            console.log(`Rebalancing completed with ${transactions.length} transactions`);
            return transactions;
        }
        catch (error) {
            throw new Error(`Failed to execute rebalancing: ${error}`);
        }
    }
    /**
     * Get protocol configurations
     */
    getProtocolConfigurations() {
        return new Map(this.protocols);
    }
    /**
     * Update protocol weights
     */
    updateProtocolWeights(weights) {
        // Validate weights sum to 1.0
        const totalWeight = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0);
        if (Math.abs(totalWeight - 1.0) > 0.01) {
            throw new Error(`Protocol weights must sum to 1.0, got ${totalWeight}`);
        }
        // Update weights
        for (const [protocol, weight] of weights) {
            const config = this.protocols.get(protocol);
            if (config) {
                config.weight = weight;
                this.protocols.set(protocol, config);
            }
        }
    }
    // Private helper methods
    initializeDefaultProtocols() {
        // Note: Atomiq removed as it's a cross-chain swap protocol, not a yield source
        const defaultProtocols = [
            {
                protocol: DeFiProtocol.VESU,
                weight: 0.5, // Increased from 0.4
                isActive: true,
                contractAddress: this.config.network.contracts.vesuLending || '0x123456789abcdef',
                apiEndpoint: 'https://api.vesu.xyz',
                healthThreshold: 0.7
            },
            {
                protocol: DeFiProtocol.EKUBO,
                weight: 0.5, // Increased from 0.35
                isActive: true,
                contractAddress: this.config.network.contracts.ekuboDEX || '0x123456789abcdef',
                apiEndpoint: 'https://api.ekubo.org',
                healthThreshold: 0.6
            }
        ];
        defaultProtocols.forEach(config => {
            this.protocols.set(config.protocol, config);
        });
    }
    initializeIntegrations() {
        for (const [protocol, config] of this.protocols) {
            this.initializeProtocolIntegration(config);
        }
    }
    initializeProtocolIntegration(config) {
        switch (config.protocol) {
            case DeFiProtocol.VESU:
                this.integrations.set(config.protocol, new vesu_integration_1.VesuIntegration(config.apiEndpoint, this.starknetAccount, config.contractAddress, config.apiKey));
                break;
            case DeFiProtocol.EKUBO:
                this.integrations.set(config.protocol, new ekubo_integration_1.EkuboIntegration(this.starknetAccount, config.contractAddress, config.apiEndpoint, config.apiKey));
                break;
            // Atomiq removed - it's a cross-chain swap protocol, not a yield source
        }
    }
    async getProtocolYield(protocol, walletAddress, period) {
        const integration = this.integrations.get(protocol);
        if (!integration) {
            throw new Error(`No integration found for protocol ${protocol}`);
        }
        return integration.getAggregatedYield(walletAddress, period);
    }
    async checkProtocolHealth(protocol, walletAddress) {
        // Check cache first
        const cached = this.healthCache.get(protocol);
        if (cached && (Date.now() - cached.lastChecked) < this.healthCacheExpiry) {
            return cached;
        }
        const integration = this.integrations.get(protocol);
        if (!integration) {
            const health = {
                protocol,
                isHealthy: false,
                healthScore: 0,
                issues: ['No integration available'],
                recommendations: ['Initialize protocol integration'],
                lastChecked: Date.now()
            };
            this.healthCache.set(protocol, health);
            return health;
        }
        let health;
        try {
            switch (protocol) {
                case DeFiProtocol.VESU:
                    const vesuHealth = await integration.monitorPositionHealth(walletAddress);
                    health = {
                        protocol,
                        isHealthy: vesuHealth.isHealthy,
                        healthScore: vesuHealth.isHealthy ? 0.9 : 0.3,
                        issues: vesuHealth.isHealthy ? [] : ['Position health issues detected'],
                        recommendations: vesuHealth.recommendations,
                        lastChecked: Date.now()
                    };
                    break;
                case DeFiProtocol.EKUBO:
                    const ekuboHealth = await integration.monitorPositionHealth(walletAddress);
                    health = {
                        protocol,
                        isHealthy: ekuboHealth.riskLevel !== 'high',
                        healthScore: ekuboHealth.riskLevel === 'low' ? 0.9 : ekuboHealth.riskLevel === 'medium' ? 0.6 : 0.3,
                        issues: ekuboHealth.riskLevel === 'high' ? ['High impermanent loss risk'] : [],
                        recommendations: ekuboHealth.recommendations,
                        lastChecked: Date.now()
                    };
                    break;
                default:
                    health = {
                        protocol,
                        isHealthy: false,
                        healthScore: 0,
                        issues: ['Unknown protocol'],
                        recommendations: ['Protocol not supported'],
                        lastChecked: Date.now()
                    };
            }
        }
        catch (error) {
            health = {
                protocol,
                isHealthy: false,
                healthScore: 0,
                issues: [`Health check failed: ${error}`],
                recommendations: ['Check protocol connectivity'],
                lastChecked: Date.now()
            };
        }
        this.healthCache.set(protocol, health);
        return health;
    }
    async getProtocolAPY(protocol, walletAddress) {
        try {
            const integration = this.integrations.get(protocol);
            if (!integration)
                return 0;
            // Fetch real-time APY from each protocol
            switch (protocol) {
                case DeFiProtocol.VESU: {
                    // Get all pools and calculate weighted average APY based on wallet positions
                    const positions = await integration.getLendingPosition(walletAddress);
                    if (positions.length === 0) {
                        // If no positions, return average pool APY
                        const pools = await integration.getLendingPools();
                        if (pools.length === 0)
                            return 0;
                        const avgAPY = pools.reduce((sum, pool) => sum + pool.supplyAPY, 0) / pools.length;
                        return avgAPY;
                    }
                    // Calculate weighted APY based on position sizes
                    const pools = await integration.getLendingPools();
                    let totalValue = 0;
                    let weightedAPY = 0;
                    for (const position of positions) {
                        const pool = pools.find((p) => p.id === position.poolId);
                        if (!pool)
                            continue;
                        const positionValue = Number(position.suppliedAmount - position.borrowedAmount);
                        totalValue += positionValue;
                        weightedAPY += pool.supplyAPY * positionValue;
                    }
                    return totalValue > 0 ? weightedAPY / totalValue : 0;
                }
                case DeFiProtocol.EKUBO: {
                    // Get all pools and calculate weighted average APY based on wallet positions
                    const positions = await integration.getLiquidityPosition(walletAddress);
                    if (positions.length === 0) {
                        // If no positions, return average pool APY
                        const pools = await integration.getLiquidityPools();
                        if (pools.length === 0)
                            return 0;
                        const avgAPY = pools.reduce((sum, pool) => sum + pool.apy, 0) / pools.length;
                        return avgAPY;
                    }
                    // Calculate weighted APY based on position sizes
                    const pools = await integration.getLiquidityPools();
                    let totalValue = 0;
                    let weightedAPY = 0;
                    for (const position of positions) {
                        const pool = pools.find((p) => p.id === position.poolId);
                        if (!pool)
                            continue;
                        const positionValue = Number(position.token0Amount + position.token1Amount);
                        totalValue += positionValue;
                        weightedAPY += pool.apy * positionValue;
                    }
                    return totalValue > 0 ? weightedAPY / totalValue : 0;
                }
                default:
                    return 0;
            }
        }
        catch (error) {
            console.error(`Failed to get real-time APY for protocol ${protocol}: ${error}`);
            // Return fallback APY estimates
            switch (protocol) {
                case DeFiProtocol.VESU:
                    return 0.08; // 8% fallback
                case DeFiProtocol.EKUBO:
                    return 0.12; // 12% fallback
                default:
                    return 0;
            }
        }
    }
    getProtocolName(protocol) {
        switch (protocol) {
            case DeFiProtocol.VESU:
                return 'Vesu Lending';
            case DeFiProtocol.EKUBO:
                return 'Ekubo DEX';
            default:
                return 'Unknown Protocol';
        }
    }
    async executeRebalanceTransaction(protocol, walletAddress, newWeight) {
        try {
            const integration = this.integrations.get(protocol);
            const config = this.protocols.get(protocol);
            if (!integration || !config) {
                throw new Error(`Protocol ${protocol} not configured`);
            }
            console.log(`Executing rebalancing for ${protocol} to weight ${newWeight} for wallet ${walletAddress}`);
            // Calculate rebalancing amounts based on new weight
            // In a real implementation, this would:
            // 1. Get current position value
            // 2. Calculate target position value based on new weight
            // 3. Execute withdraw/deposit to reach target
            let txHash;
            switch (protocol) {
                case DeFiProtocol.VESU: {
                    // Get current positions
                    const positions = await integration.getLendingPosition(walletAddress);
                    const currentValue = positions.reduce((sum, pos) => sum + pos.suppliedAmount - pos.borrowedAmount, BigInt(0));
                    // For now, execute a simple rebalance transaction
                    // In production, would calculate exact amounts and execute multi-step rebalancing
                    const result = await this.starknetAccount.execute({
                        contractAddress: config.contractAddress,
                        entrypoint: 'rebalance_position',
                        calldata: [
                            walletAddress,
                            Math.floor(newWeight * 1000).toString(), // Weight as basis points
                            currentValue.toString()
                        ]
                    });
                    txHash = result.transaction_hash;
                    break;
                }
                case DeFiProtocol.EKUBO: {
                    // Get current positions
                    const positions = await integration.getLiquidityPosition(walletAddress);
                    const currentValue = positions.reduce((sum, pos) => sum + pos.token0Amount + pos.token1Amount, BigInt(0));
                    const result = await this.starknetAccount.execute({
                        contractAddress: config.contractAddress,
                        entrypoint: 'rebalance_liquidity',
                        calldata: [
                            walletAddress,
                            Math.floor(newWeight * 1000).toString(),
                            currentValue.toString()
                        ]
                    });
                    txHash = result.transaction_hash;
                    break;
                }
                default:
                    throw new Error(`Unsupported protocol for rebalancing: ${protocol}`);
            }
            console.log(`Rebalancing transaction submitted: ${txHash}`);
            // Wait for transaction confirmation
            await this.starknetAccount.waitForTransaction(txHash);
            console.log(`Rebalancing transaction confirmed: ${txHash}`);
            return txHash;
        }
        catch (error) {
            throw new Error(`Failed to execute rebalancing transaction for ${protocol}: ${error}`);
        }
    }
}
exports.DeFiYieldAggregator = DeFiYieldAggregator;
/**
 * Factory function to create DeFi yield aggregator
 */
function createDeFiYieldAggregator(config, starknetAccount) {
    return new DeFiYieldAggregator(config, starknetAccount);
}
//# sourceMappingURL=defi-yield-aggregator.js.map