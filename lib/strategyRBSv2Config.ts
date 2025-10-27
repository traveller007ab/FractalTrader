import type { StrategySettings } from '../types.ts';

type SymbolSettings = Partial<StrategySettings> & { exchange: 'BINANCE' | 'OANDA' };

interface StrategyConfig {
    base: StrategySettings;
    symbolSettings: {
        [symbol: string]: SymbolSettings;
    };
}

// Configuration for the RBS v1 Strategy.
// This has been updated to match the user-provided v1 specification.
export const strategyConfig: StrategyConfig = {
    // Base settings are used for all symbols per RBS v1 spec.
    base: {
        // Detection
        shiftAtrMultiplier: 0.25, // Note: This is now part of a more complex rule in the engine.
        // Trend
        smaPeriod: 20,
        // Daily Structure
        proximityAtrMultiplier: 0.5,
        // Volatility & Volume
        atrPeriod: 14,
        atrFilterMultiplier: 0.75,
        volumeFilterMultiplier: 2.0,
        // Risk
        stopLossAtrMultiplier: 1.5,
        takeProfitR_R: 2.0,
        riskPercent: 0.5,
        // Emission & Lifecycle
        confidenceThreshold: 0.60,
        cooldownBars: 5,
        duplicateThresholdPct: 0.0025, // 0.25%
    },
    // Per-symbol settings are now only for exchange information, not strategy overrides.
    symbolSettings: {
        'BTC/USD': {
            exchange: 'BINANCE',
        },
        'ETH/USD': {
            exchange: 'BINANCE',
        },
        'XAU/USD': {
            exchange: 'OANDA',
        },
        'XAG/USD': {
            exchange: 'OANDA',
        },
    }
};

// Helper function to get the final settings for a symbol, merging base and specific settings
export function getSymbolSettings(symbol: string, currentSettings: StrategySettings): StrategySettings {
    const symbolOverrides = strategyConfig.symbolSettings[symbol] || {};
    // Start with the strategyConfig base, then symbol-specific overrides (exchange), and finally the current settings
    // This ensures that passed-in settings (from UI or optimizer) have the highest priority for optimizable params.
    return {
        ...strategyConfig.base,
        ...symbolOverrides,
        ...currentSettings,
    };
}