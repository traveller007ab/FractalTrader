import { runBacktestFromData } from './backtester.ts';
import { getSymbolFromFilename } from './utils.ts';
// Fix: Add file extension to type import.
import type { StrategySettings, TimeSeriesData, BacktestMetrics } from '../types.ts';

type OptimizableParams = 'smaPeriod' | 'stopLossAtrMultiplier' | 'takeProfitR_R';

export class Optimizer {
    private datasets: { file: File; data: TimeSeriesData[]; symbol: string }[];
    private baselineSettings: StrategySettings;
    private onProgressCallback: ((progress: number, total: number) => void) | null = null;
    private iteration: number;

    constructor(
        datasets: { file: File, data: TimeSeriesData[] }[], 
        baselineSettings: StrategySettings, 
        iteration: number = 0
    ) {
        this.datasets = datasets.map(d => ({
            ...d,
            symbol: getSymbolFromFilename(d.file.name)
        }));
        this.baselineSettings = baselineSettings;
        this.iteration = iteration;
    }

    public onProgress(callback: (progress: number, total: number) => void) {
        this.onProgressCallback = callback;
    }

    private async evaluateSettings(settings: StrategySettings): Promise<{ score: number; settings: StrategySettings }> {
        const runResults: { metrics: BacktestMetrics | null }[] = [];
        for (const dataset of this.datasets) {
            try {
                const { metrics } = runBacktestFromData(dataset.data, settings, dataset.symbol);
                runResults.push({ metrics });
            } catch (error) {
                runResults.push({ metrics: null });
            }
        }

        const validRuns = runResults.filter(r => r.metrics && r.metrics.total_trades > 5);
        const totalTrades = validRuns.reduce((sum, r) => sum + (r.metrics?.total_trades ?? 0), 0);
        
        // A strategy is invalid if it doesn't produce enough trades on all datasets or in total.
        if (validRuns.length < this.datasets.length || totalTrades < this.datasets.length * 10) {
            return { score: -Infinity, settings };
        }

        // --- NEW ROBUSTNESS SCORING ---
        const profitableRuns = validRuns.filter(r => (r.metrics?.total_pnl ?? -1) >= 0);

        // 1. Strict Consistency Check: Reject any strategy that isn't profitable on ALL datasets.
        if (profitableRuns.length < this.datasets.length) {
            return { score: -Infinity, settings };
        }

        // If we reach here, all runs were profitable. Now we evaluate the quality.
        const aggregateMetrics = {
            total_pnl: 0,
            grossProfit: 0,
            grossLoss: 0,
            max_drawdown: 0,
            winning_trades: 0,
        };
        let worstProfitFactor = Infinity;

        validRuns.forEach(run => {
            const metrics = run.metrics!;
            aggregateMetrics.total_pnl += metrics.total_pnl;
            aggregateMetrics.grossProfit += metrics.grossProfit ?? 0;
            aggregateMetrics.grossLoss += metrics.grossLoss ?? 0;
            aggregateMetrics.max_drawdown = Math.max(aggregateMetrics.max_drawdown, metrics.max_drawdown);
            aggregateMetrics.winning_trades += Math.round((metrics.win_rate / 100) * metrics.total_trades);
            
            if (metrics.profit_factor < worstProfitFactor) {
                worstProfitFactor = metrics.profit_factor;
            }
        });

        const win_rate = (aggregateMetrics.winning_trades / totalTrades) * 100;
        let aggregate_profit_factor = aggregateMetrics.grossProfit / aggregateMetrics.grossLoss;
        if (aggregateMetrics.grossLoss === 0) {
            aggregate_profit_factor = aggregateMetrics.grossProfit > 0 ? 9999 : 1;
        }
        if (isNaN(aggregate_profit_factor)) aggregate_profit_factor = 1;
        
        // 2. Robustness Factor: The final score is modulated by how well the strategy performed on its WORST dataset.
        const robustnessFactor = Math.min(worstProfitFactor, 5); // Cap at 5 to prevent outliers from dominating

        const pnl = aggregateMetrics.total_pnl > 0 ? aggregateMetrics.total_pnl : 1;

        // The score is a blend of overall performance and robustness.
        const score = (
            Math.pow(pnl, 1.2) *
            Math.pow(aggregate_profit_factor, 1.5) *
            Math.pow(win_rate / 100, 1.5) *
            robustnessFactor // The performance of the weakest link is a direct multiplier.
        ) / (1 + (aggregateMetrics.max_drawdown / 100));

        return { score, settings };
    }

    private async runGridSearch(): Promise<StrategySettings | null> {
        const paramRanges = {
            smaPeriod: [20, 26, 30, 40],
            stopLossAtrMultiplier: [1.5, 1.9, 2.2, 2.5],
            takeProfitR_R: [2.0, 2.4, 2.8, 3.2]
        };
        const combinations: StrategySettings[] = [];
        for (const sma of paramRanges.smaPeriod) {
            for (const sl of paramRanges.stopLossAtrMultiplier) {
                for (const tp of paramRanges.takeProfitR_R) {
                    combinations.push({ ...this.baselineSettings, smaPeriod: sma, stopLossAtrMultiplier: sl, takeProfitR_R: tp });
                }
            }
        }

        let bestResult = { score: -Infinity, settings: this.baselineSettings };
        const results = await Promise.all(combinations.map(c => this.evaluateSettings(c)));

        for (const result of results) {
            if (result.score > bestResult.score) {
                bestResult = result;
            }
        }
        return bestResult.score > -Infinity ? bestResult.settings : null;
    }
    
    private getNeighbors(settings: StrategySettings): StrategySettings[] {
        const neighbors: StrategySettings[] = [];
        const paramSteps: Record<OptimizableParams, number> = {
            smaPeriod: this.iteration === 1 ? 2 : 1,
            stopLossAtrMultiplier: 0.1,
            takeProfitR_R: 0.1,
        };

        (Object.keys(paramSteps) as OptimizableParams[]).forEach(param => {
            const originalValue = settings[param];
            const step = paramSteps[param];
            
            // Neighbor above
            const neighborUp = { ...settings, [param]: originalValue + step };
            if(param === 'smaPeriod') neighborUp[param] = Math.round(neighborUp[param]);
            else neighborUp[param] = parseFloat(neighborUp[param].toFixed(2));
            neighbors.push(neighborUp);

            // Neighbor below
            const neighborDown = { ...settings, [param]: originalValue - step };
             if(param === 'smaPeriod') neighborDown[param] = Math.round(neighborDown[param]);
            else neighborDown[param] = parseFloat(neighborDown[param].toFixed(2));
            if (neighborDown[param] > 0) { // All params must be positive
                neighbors.push(neighborDown);
            }
        });
        return neighbors;
    }

    private async runHillClimbingRefinement(): Promise<StrategySettings | null> {
        let currentBest = await this.evaluateSettings(this.baselineSettings);
        if (currentBest.score === -Infinity) {
            console.warn("[Optimizer] Baseline settings for refinement are not profitable. Cannot refine.");
            return null; // Cannot refine if baseline is not profitable
        }

        let climbed = true;
        while(climbed) {
            climbed = false;
            const neighbors = this.getNeighbors(currentBest.settings);
            const neighborEvals = await Promise.all(neighbors.map(n => this.evaluateSettings(n)));

            for (const evalResult of neighborEvals) {
                if (evalResult.score > currentBest.score) {
                    currentBest = evalResult;
                    climbed = true; // We found a better spot, so we'll check its neighbors in the next loop
                }
            }
            // After checking all neighbors, if we climbed, the loop continues from the new best spot
        }
        return currentBest.settings;
    }

    public async run(): Promise<StrategySettings | null> {
        if (this.iteration === 0) {
            console.log(`[Optimizer] Starting wide search with ${this.datasets.length} file(s)...`);
            return this.runGridSearch();
        } else {
            console.log(`[Optimizer] Starting refinement (Lvl ${this.iteration}) for ${this.datasets.length} file(s)...`);
            return this.runHillClimbingRefinement();
        }
    }
}
// Placeholder for paramConfig keys type generation
const paramConfig = {
    smaPeriod: [],
    stopLossAtrMultiplier: [],
    takeProfitR_R: []
};