import type { StrategySettings, FullStrategySettings, Signal } from '../types.ts';

type SymbolSettings = Partial<StrategySettings> & { exchange: 'BINANCE' | 'OANDA' };

interface StrategyConfig {
    base: StrategySettings;
    symbols: {
        [symbol: string]: SymbolSettings;
    };
}

// Configuration for the RBS v2 Strategy.
// This now separates base settings from symbol-specific overrides.
export const strategyConfig: FullStrategySettings = {
    base: {
        shiftAtrMultiplier: 0.25,
        smaPeriod: 20,
        proximityAtrMultiplier: 0.5,
        atrPeriod: 14,
        atrFilterMultiplier: 0.75,
        volumeFilterMultiplier: 2.0,
        stopLossAtrMultiplier: 1.5,
        takeProfitR_R: 2.0,
        riskPercent: 0.5,
        confidenceThreshold: 0.60,
        cooldownBars: 5,
        duplicateThresholdPct: 0.0025,
    },
    symbols: {
        'BTC/USD': {
            exchange: 'BINANCE',
            riskPercent: 0.4,
            takeProfitR_R: 2.2,
        },
        'ETH/USD': {
            exchange: 'BINANCE',
            riskPercent: 0.5,
            takeProfitR_R: 2.5,
        },
        'XAU/USD': {
            exchange: 'OANDA',
            stopLossAtrMultiplier: 1.8,
            smaPeriod: 25,
        },
        'SOL/USD': {
            exchange: 'BINANCE',
            smaPeriod: 22,
            atrFilterMultiplier: 0.8,
        },
        'XAG/USD': {
            exchange: 'OANDA',
        },
    }
};

// Fix: Update getSymbolSettings to correctly merge configurations and include the exchange property in its return type.
// This makes it the single source of truth for a symbol's settings.
// Helper function to get the final, combined settings for a given symbol.
export function getSymbolSettings(symbol: string, fullSettings: FullStrategySettings): StrategySettings & { exchange: Signal['exchange'] } {
    const defaultSymbolConfig = strategyConfig.symbols[symbol as keyof typeof strategyConfig.symbols];
    const userSymbolConfig = fullSettings.symbols[symbol] || {};

    const finalSettings = {
        ...strategyConfig.base,      // 1. Code-level base defaults
        ...(defaultSymbolConfig || {}), // 2. Code-level symbol-specific defaults
        ...fullSettings.base,          // 3. User's saved base settings (overrides defaults)
        ...userSymbolConfig,           // 4. User's symbol settings (overrides all above)
    };
    
    // Ensure there's a fallback exchange if no config exists at all for the symbol
    if (!finalSettings.exchange) {
        (finalSettings as any).exchange = 'BINANCE';
    }

    return finalSettings as StrategySettings & { exchange: Signal['exchange'] };
}