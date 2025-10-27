import { runBacktestFromData } from './backtester.ts';
import { getSymbolFromFilename } from './utils.ts';
import type { StrategySettings, TimeSeriesData, BacktestMetrics, FullStrategySettings } from '../types.ts';

const POPULATION_SIZE = 30;
const GENERATIONS = 15;
const MUTATION_RATE = 0.15;
const ELITISM_COUNT = 2; // Keep the best N individuals from the previous generation

type OptimizableParams = 'smaPeriod' | 'stopLossAtrMultiplier' | 'takeProfitR_R' | 'riskPercent' | 'atrFilterMultiplier';

const PARAM_RANGES: Record<OptimizableParams, { min: number, max: number, step: number }> = {
    smaPeriod: { min: 10, max: 50, step: 1 },
    stopLossAtrMultiplier: { min: 1.0, max: 3.5, step: 0.1 },
    takeProfitR_R: { min: 1.5, max: 4.0, step: 0.1 },
    riskPercent: { min: 0.25, max: 1.5, step: 0.05 },
    atrFilterMultiplier: { min: 0.5, max: 1.25, step: 0.05 },
};

export class Optimizer {
    private datasets: { file: File; data: TimeSeriesData[]; symbol: string }[];
    private baselineSettings: StrategySettings;
    private onProgressCallback: ((progress: { generation: number, totalGenerations: number, bestScore: number }) => void) | null = null;
    private fullSettings: FullStrategySettings;
    private symbol: string;

    constructor(
        datasets: { file: File, data: TimeSeriesData[] }[],
        fullSettings: FullStrategySettings,
        symbol: string
    ) {
        this.datasets = datasets.map(d => ({ ...d, symbol }));
        this.fullSettings = fullSettings;
        this.symbol = symbol;
        // The baseline for optimization is the specific setting for this symbol
        this.baselineSettings = { ...fullSettings.base, ...(fullSettings.symbols[symbol] || {}) };
    }

    public onProgress(callback: (progress: { generation: number, totalGenerations: number, bestScore: number }) => void) {
        this.onProgressCallback = callback;
    }

    private async evaluateSettings(settings: StrategySettings): Promise<number> {
        const tempFullSettings: FullStrategySettings = JSON.parse(JSON.stringify(this.fullSettings));
        tempFullSettings.symbols[this.symbol] = settings;
        
        const runResults = await Promise.all(this.datasets.map(dataset => 
            runBacktestFromData(dataset.data, tempFullSettings, dataset.symbol)
        ));

        const validRuns = runResults.filter(r => r.metrics && r.metrics.total_trades > 5);
        if (validRuns.length !== this.datasets.length) return -Infinity;

        const totalPnl = validRuns.reduce((sum, r) => sum + r.metrics.total_pnl, 0);
        const grossProfit = validRuns.reduce((sum, r) => sum + (r.metrics.grossProfit || 0), 0);
        const grossLoss = validRuns.reduce((sum, r) => sum + (r.metrics.grossLoss || 0), 0);
        const maxDrawdown = Math.max(...validRuns.map(r => r.metrics.max_drawdown));

        const profitableRunsRatio = validRuns.filter(r => r.metrics.total_pnl > 0).length / validRuns.length;
        if (profitableRunsRatio < 0.6) return -Infinity; // Require at least 60% of runs to be profitable

        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 9999 : 1);

        const score = (totalPnl * profitFactor * profitableRunsRatio) / (1 + (maxDrawdown / 100));
        return isNaN(score) ? -Infinity : score;
    }

    private initializePopulation(): StrategySettings[] {
        const population: StrategySettings[] = [this.baselineSettings]; // Always include the baseline
        while (population.length < POPULATION_SIZE) {
            const individual = { ...this.baselineSettings };
            for (const key of Object.keys(PARAM_RANGES) as OptimizableParams[]) {
                const range = PARAM_RANGES[key];
                const randomVal = range.min + Math.random() * (range.max - range.min);
                individual[key] = parseFloat((Math.round(randomVal / range.step) * range.step).toFixed(4));
            }
            population.push(individual);
        }
        return population;
    }

    private selection(scoredPopulation: { settings: StrategySettings, score: number }[]): StrategySettings[] {
        // Tournament Selection
        const parents: StrategySettings[] = [];
        for (let i = 0; i < POPULATION_SIZE; i++) {
            const p1_idx = Math.floor(Math.random() * POPULATION_SIZE);
            const p2_idx = Math.floor(Math.random() * POPULATION_SIZE);
            const winner = scoredPopulation[p1_idx].score > scoredPopulation[p2_idx].score ? scoredPopulation[p1_idx] : scoredPopulation[p2_idx];
            parents.push(winner.settings);
        }
        return parents;
    }

    private crossover(parent1: StrategySettings, parent2: StrategySettings): StrategySettings {
        const child = { ...parent1 };
        const keys = Object.keys(PARAM_RANGES) as OptimizableParams[];
        for (const key of keys) {
            if (Math.random() < 0.5) {
                child[key] = parent2[key];
            }
        }
        return child;
    }
    
    private mutate(individual: StrategySettings): StrategySettings {
        const mutated = { ...individual };
        const keys = Object.keys(PARAM_RANGES) as OptimizableParams[];
        for (const key of keys) {
            if (Math.random() < MUTATION_RATE) {
                const range = PARAM_RANGES[key];
                const change = (Math.random() - 0.5) * (range.max - range.min) * 0.1; // Mutate by up to 10% of range
                let newValue = mutated[key] + change;
                newValue = Math.max(range.min, Math.min(range.max, newValue)); // Clamp within bounds
                mutated[key] = parseFloat((Math.round(newValue / range.step) * range.step).toFixed(4));
            }
        }
        return mutated;
    }

    public async run(): Promise<StrategySettings | null> {
        let population = this.initializePopulation();
        let bestOverall: { settings: StrategySettings, score: number } | null = null;
        
        for (let gen = 0; gen < GENERATIONS; gen++) {
            const scoredPopulation = await Promise.all(
                population.map(async individual => ({
                    settings: individual,
                    score: await this.evaluateSettings(individual)
                }))
            );
            
            scoredPopulation.sort((a, b) => b.score - a.score);

            const currentBest = scoredPopulation[0];
            if (!bestOverall || currentBest.score > bestOverall.score) {
                bestOverall = currentBest;
            }

            if (this.onProgressCallback) {
                this.onProgressCallback({ generation: gen + 1, totalGenerations: GENERATIONS, bestScore: bestOverall?.score ?? 0 });
            }

            if (gen === GENERATIONS - 1) break;

            const elite = scoredPopulation.slice(0, ELITISM_COUNT).map(s => s.settings);
            const parents = this.selection(scoredPopulation);
            const newPopulation: StrategySettings[] = [...elite];

            while (newPopulation.length < POPULATION_SIZE) {
                const parent1 = parents[Math.floor(Math.random() * parents.length)];
                const parent2 = parents[Math.floor(Math.random() * parents.length)];
                let child = this.crossover(parent1, parent2);
                child = this.mutate(child);
                newPopulation.push(child);
            }
            population = newPopulation;
        }

        const baselineScore = await this.evaluateSettings(this.baselineSettings);
        if (bestOverall && bestOverall.score > baselineScore) {
            return bestOverall.settings;
        }
        
        return null; // No improvement found
    }
}