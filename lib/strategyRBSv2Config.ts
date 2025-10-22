import type { StrategySettings } from '../types.ts';

type SymbolSettings = Partial<StrategySettings> & { exchange: 'BINANCE' | 'OANDA' };

interface StrategyConfig {
    base: StrategySettings;
    symbolSettings: {
        [symbol: string]: SymbolSettings;
    };
}

// Configuration for the RBS v2 Strategy
export const strategyConfig: StrategyConfig = {
    // Base settings are used if a symbol doesn't have an override
    base: {
        // Detection
        shiftAtrMultiplier: 0.35,
        // Trend
        smaPeriod: 26,
        // Daily Structure
        proximityAtrMultiplier: 0.6,
        // Volatility & Volume
        atrPeriod: 14,
        atrFilterMultiplier: 0.75,
        volumeFilterMultiplier: 2.0,
        // Risk
        stopLossAtrMultiplier: 1.6,
        takeProfitR_R: 2.0,
        riskPercent: 1.0,
        // Emission & Lifecycle
        confidenceThreshold: 0.60,
        cooldownBars: 5,
        duplicateThresholdPct: 0.0025, // 0.25%
    },
    symbolSettings: {
        'BTC/USD': {
            exchange: 'BINANCE',
            riskPercent: 0.75,
            takeProfitR_R: 2.4,
            stopLossAtrMultiplier: 1.9,
            shiftAtrMultiplier: 0.4,
        },
        'ETH/USD': {
            exchange: 'BINANCE',
            riskPercent: 0.9,
            takeProfitR_R: 2.3,
            stopLossAtrMultiplier: 1.8,
        },
        'XAU/USD': {
            exchange: 'OANDA',
            riskPercent: 1.0,
            takeProfitR_R: 2.0,
            stopLossAtrMultiplier: 1.6,
        },
    }
};

// Helper function to get the final settings for a symbol, merging base and specific settings
export function getSymbolSettings(symbol: string, currentSettings: StrategySettings): StrategySettings {
    const symbolOverrides = strategyConfig.symbolSettings[symbol] || {};
    // Start with the strategyConfig base, then symbol-specific overrides, and finally the current settings
    // This ensures that passed-in settings (from UI or optimizer) have the highest priority.
    return {
        ...strategyConfig.base,
        ...symbolOverrides,
        ...currentSettings,
    };
}