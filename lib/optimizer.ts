// Fix: Add .ts extension to backtester import
import { runBacktestFromData } from './backtester.ts';
import type { StrategySettings, TimeSeriesData } from '../types';

// Define the parameter space for optimization
const paramRanges = {
    smaPeriod: [15, 20, 25],
    stopLossAtrMultiplier: [1.0, 1.5, 2.0, 2.5],
    takeProfitR_R: [1.5, 2.0, 2.5, 3.0]
};

export class Optimizer {
    private data: TimeSeriesData[];
    private baselineSettings: StrategySettings;
    private onProgressCallback: ((progress: number, total: number) => void) | null = null;

    constructor(data: TimeSeriesData[], baselineSettings: StrategySettings) {
        this.data = data;
        this.baselineSettings = baselineSettings;
    }

    public onProgress(callback: (progress: number, total: number) => void) {
        this.onProgressCallback = callback;
    }

    public async run(): Promise<StrategySettings | null> {
        const combinations: StrategySettings[] = [];

        // Generate all combinations of parameters
        for (const sma of paramRanges.smaPeriod) {
            for (const sl of paramRanges.stopLossAtrMultiplier) {
                for (const tp of paramRanges.takeProfitR_R) {
                    combinations.push({
                        ...this.baselineSettings,
                        smaPeriod: sma,
                        stopLossAtrMultiplier: sl,
                        takeProfitR_R: tp,
                    });
                }
            }
        }
        
        let bestSettings: StrategySettings | null = null;
        let bestScore = -Infinity;
        let progress = 0;
        const total = combinations.length;
        
        console.log(`[Optimizer] Starting optimization with ${total} combinations...`);

        for (const settings of combinations) {
            try {
                const { metrics } = runBacktestFromData(this.data, settings);
                // Score based on profit factor, but penalize for low trade count and high drawdown
                const score = (metrics.profit_factor || 0) * Math.sqrt(metrics.total_trades) / (1 + (metrics.max_drawdown / 100));

                if (score > bestScore) {
                    bestScore = score;
                    bestSettings = settings;
                }

            } catch (error) {
                // Ignore runs that fail (e.g., insufficient data for a parameter set)
            }
            progress++;
            if (this.onProgressCallback) {
                this.onProgressCallback(progress, total);
            }
        }
        
        console.log(`[Optimizer] Finished. Best score: ${bestScore}`, bestSettings);

        return bestSettings;
    }
}