// Fix: Add .ts extension to backtester import
import { runBacktestFromData } from './backtester.ts';
import type { StrategySettings, TimeSeriesData } from '../types';

// Helper to generate a numerical range around a center point
const createRange = (center: number, step: number, points: number): number[] => {
    const range = new Set<number>();
    const start = center - Math.floor(points / 2) * step;
    for (let i = 0; i < points; i++) {
        range.add(start + i * step);
    }
    return Array.from(range).filter(v => v > 0); // Ensure parameters are positive
};

export class Optimizer {
    private data: TimeSeriesData[];
    private baselineSettings: StrategySettings;
    private onProgressCallback: ((progress: number, total: number) => void) | null = null;
    private iteration: number;

    constructor(data: TimeSeriesData[], baselineSettings: StrategySettings, iteration: number = 0) {
        this.data = data;
        this.baselineSettings = baselineSettings;
        this.iteration = iteration;
    }

    private generateRanges(): { [key in keyof typeof paramConfig]: number[] } {
        const { iteration, baselineSettings } = this;

        if (iteration === 0) {
            // First run: Wide, coarse search to find a good general area
            return {
                smaPeriod: [15, 20, 25, 30],
                stopLossAtrMultiplier: [1.0, 1.5, 2.0, 2.5],
                takeProfitR_R: [1.5, 2.0, 2.5, 3.0]
            };
        }

        // Subsequent runs: Finer, "deep study" search around the best-found parameters
        const smaStep = iteration === 1 ? 2 : 1;
        const smaPoints = iteration === 1 ? 5 : 3;

        return {
            smaPeriod: createRange(baselineSettings.smaPeriod, smaStep, smaPoints).map(v => Math.round(v)),
            stopLossAtrMultiplier: createRange(baselineSettings.stopLossAtrMultiplier, 0.2, 5).map(v => parseFloat(v.toFixed(2))),
            takeProfitR_R: createRange(baselineSettings.takeProfitR_R, 0.2, 5).map(v => parseFloat(v.toFixed(2)))
        };
    }

    public onProgress(callback: (progress: number, total: number) => void) {
        this.onProgressCallback = callback;
    }

    public async run(): Promise<StrategySettings | null> {
        const paramRanges = this.generateRanges();
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
        
        let bestSettings: StrategySettings | null = this.baselineSettings;
        let bestScore = -Infinity;
        let progress = 0;
        const total = combinations.length;
        
        console.log(`[Optimizer] Starting iteration ${this.iteration} with ${total} combinations...`);

        for (const settings of combinations) {
            try {
                const { metrics } = runBacktestFromData(this.data, settings);

                if (metrics.total_trades < 10) continue; // Skip statistically insignificant results

                // New scoring function with exponential-like weights on key metrics.
                // It heavily rewards high P&L, a strong profit factor, and a high win rate,
                // while still penalizing for high drawdown.
                const pnl = metrics.total_pnl > 0 ? metrics.total_pnl : 0;
                const score = (
                    Math.pow(pnl, 1.2) * 
                    Math.pow(metrics.profit_factor, 2.5) * 
                    Math.pow(metrics.win_rate / 100, 1.5)
                ) / (1 + (metrics.max_drawdown / 100));

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
        
        console.log(`[Optimizer] Finished iteration ${this.iteration}. Best score: ${bestScore}`, bestSettings);

        return bestSettings;
    }
}
// Placeholder for paramConfig keys type generation
const paramConfig = {
    smaPeriod: [],
    stopLossAtrMultiplier: [],
    takeProfitR_R: []
};
