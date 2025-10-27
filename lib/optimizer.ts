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

        const profitableRuns = validRuns.filter(r => (r.metrics?.total_pnl ?? -1) >= 0);

        // --- AGGREGATE METRICS ---
        const aggregateMetrics = {
            total_pnl: 0,
            grossProfit: 0,
            grossLoss: 0,
            max_drawdown: 0,
        };

        validRuns.forEach(run => {
            const metrics = run.metrics!;
            aggregateMetrics.total_pnl += metrics.total_pnl;
            aggregateMetrics.grossProfit += metrics.grossProfit ?? 0;
            aggregateMetrics.grossLoss += metrics.grossLoss ?? 0;
            aggregateMetrics.max_drawdown = Math.max(aggregateMetrics.max_drawdown, metrics.max_drawdown);
        });
        
        // --- NEW SCORING LOGIC (v2) ---

        // If there are no profitable runs at all, or less than half, it's a definite failure.
        const profitableRunsRatio = profitableRuns.length / this.datasets.length;
        if (profitableRunsRatio < 0.5) {
             return { score: -Infinity, settings };
        }
        
        let aggregate_profit_factor = aggregateMetrics.grossProfit / aggregateMetrics.grossLoss;
        if (aggregateMetrics.grossLoss === 0) {
            aggregate_profit_factor = aggregateMetrics.grossProfit > 0 ? 9999 : 1;
        }
        if (isNaN(aggregate_profit_factor)) aggregate_profit_factor = 1;

        // 1. Consistency Score: A heavy penalty for each non-profitable run.
        const consistency_penalty = Math.pow(profitableRunsRatio, 4); 

        // 2. Performance Score: Heavily weights profit factor and total PnL.
        // We use Math.max with 1 to avoid issues with negative PnL or small profit factors in the pow function.
        const performance_score = (
            Math.pow(Math.max(1, aggregateMetrics.total_pnl), 1.3) *
            Math.pow(Math.max(1, aggregate_profit_factor), 1.8)
        );

        // 3. Final Score: Combines performance, consistency, and penalizes for drawdown.
        const score = (performance_score * consistency_penalty) / (1 + (aggregateMetrics.max_drawdown / 100));

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