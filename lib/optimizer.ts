import { runBacktestFromData } from './backtester.ts';
import type { StrategySettings, TimeSeriesData, BacktestMetrics, FullStrategySettings } from '../types.ts';

const POPULATION_SIZE = 30;
const GENERATIONS = 20;
const MUTATION_RATE = 0.20;
const ELITISM_COUNT = 3; 

type OptimizableParams = keyof typeof PARAM_RANGES;

const PARAM_RANGES = {
    shiftAtrMultiplier: { min: 0.1, max: 0.8, step: 0.05 },
    smaPeriod: { min: 10, max: 60, step: 1 },
    proximityAtrMultiplier: { min: 0.3, max: 1.5, step: 0.1 },
    atrPeriod: { min: 10, max: 30, step: 1 },
    atrFilterMultiplier: { min: 0.5, max: 1.5, step: 0.05 },
    volumeFilterMultiplier: { min: 1.5, max: 4.0, step: 0.1 },
    stopLossAtrMultiplier: { min: 1.0, max: 4.0, step: 0.1 },
    takeProfitR_R: { min: 1.5, max: 5.0, step: 0.1 },
    riskPercent: { min: 0.25, max: 2.0, step: 0.05 },
    confidenceThreshold: { min: 0.55, max: 0.80, step: 0.01 },
    cooldownBars: { min: 3, max: 12, step: 1 },
    duplicateThresholdPct: { min: 0.001, max: 0.005, step: 0.0005 },
};

export class Optimizer {
    private datasets: { file: File; data: TimeSeriesData[]; symbol: string }[];
    private baselineSettings: StrategySettings;
    private onProgressCallback: ((progress: { generation: number, totalGenerations: number, bestScore: number }) => void) | null = null;
    private fullSettings: FullStrategySettings;
    private symbol: string;
    private paramsToOptimize: OptimizableParams[];

    constructor(
        datasets: { file: File, data: TimeSeriesData[] }[],
        fullSettings: FullStrategySettings,
        symbol: string,
        paramsToOptimize: (keyof StrategySettings)[]
    ) {
        this.datasets = datasets.map(d => ({ ...d, symbol }));
        this.fullSettings = fullSettings;
        this.symbol = symbol;
        this.baselineSettings = { ...fullSettings.base, ...(fullSettings.symbols[symbol] || {}) };
        this.paramsToOptimize = paramsToOptimize as OptimizableParams[];
    }

    public onProgress(callback: (progress: { generation: number, totalGenerations: number, bestScore: number }) => void) {
        this.onProgressCallback = callback;
    }

    private async evaluateSettings(settings: StrategySettings): Promise<{ metrics: BacktestMetrics, score: number }> {
        const tempFullSettings: FullStrategySettings = JSON.parse(JSON.stringify(this.fullSettings));
        tempFullSettings.symbols[this.symbol] = { ...tempFullSettings.symbols[this.symbol], ...settings};
        
        const runResults = await Promise.all(this.datasets.map(dataset => 
            runBacktestFromData(dataset.data, tempFullSettings, dataset.symbol)
        ));

        const validRuns = runResults.filter(r => r.metrics && r.metrics.total_trades > 5);
        if (validRuns.length === 0) return { metrics: {} as BacktestMetrics, score: -Infinity };

        const aggregateMetrics: BacktestMetrics = {
            total_pnl: validRuns.reduce((sum, r) => sum + r.metrics.total_pnl, 0),
            win_rate: validRuns.reduce((sum, r) => sum + r.metrics.win_rate, 0) / validRuns.length,
            max_drawdown: Math.max(...validRuns.map(r => r.metrics.max_drawdown)),
            profit_factor: validRuns.reduce((sum, r) => sum + r.metrics.profit_factor, 0) / validRuns.length,
            total_trades: validRuns.reduce((sum, r) => sum + r.metrics.total_trades, 0)
        };
        
        if (aggregateMetrics.total_trades < 10) return { metrics: aggregateMetrics, score: -Infinity };

        // Fitness function: P&L * Profit Factor / (1 + Max Drawdown %)
        const score = (aggregateMetrics.total_pnl * aggregateMetrics.profit_factor) / (1 + (aggregateMetrics.max_drawdown / 100));
        return { metrics: aggregateMetrics, score: isNaN(score) ? -Infinity : score };
    }

    private initializePopulation(): StrategySettings[] {
        const population: StrategySettings[] = [this.baselineSettings]; // Always include the baseline
        while (population.length < POPULATION_SIZE) {
            const individual = { ...this.baselineSettings };
            for (const key of this.paramsToOptimize) {
                const range = PARAM_RANGES[key];
                const randomVal = range.min + Math.random() * (range.max - range.min);
                (individual as any)[key] = parseFloat((Math.round(randomVal / range.step) * range.step).toFixed(4));
            }
            population.push(individual);
        }
        return population;
    }

    private selection(scoredPopulation: { settings: StrategySettings, score: number }[]): StrategySettings[] {
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
        for (const key of this.paramsToOptimize) {
            if (Math.random() < 0.5) {
                (child as any)[key] = (parent2 as any)[key];
            }
        }
        return child;
    }
    
    private mutate(individual: StrategySettings): StrategySettings {
        const mutated = { ...individual };
        for (const key of this.paramsToOptimize) {
            if (Math.random() < MUTATION_RATE) {
                const range = PARAM_RANGES[key];
                const change = (Math.random() - 0.5) * (range.max - range.min) * 0.1; 
                let newValue = (mutated as any)[key] + change;
                newValue = Math.max(range.min, Math.min(range.max, newValue)); 
                (mutated as any)[key] = parseFloat((Math.round(newValue / range.step) * range.step).toFixed(4));
            }
        }
        return mutated;
    }

    public async run(): Promise<{ bestSettings: StrategySettings, baselineMetrics: BacktestMetrics, optimizedMetrics: BacktestMetrics } | null> {
        let population = this.initializePopulation();
        let bestOverall: { settings: StrategySettings, metrics: BacktestMetrics, score: number } | null = null;
        
        for (let gen = 0; gen < GENERATIONS; gen++) {
            const scoredPopulation = await Promise.all(
                population.map(async individual => {
                    const { metrics, score } = await this.evaluateSettings(individual);
                    return { settings: individual, metrics, score };
                })
            );
            
            scoredPopulation.sort((a, b) => b.score - a.score);

            const currentBest = scoredPopulation[0];
            if (!bestOverall || (currentBest && currentBest.score > bestOverall.score)) {
                bestOverall = currentBest;
            }

            if (this.onProgressCallback && bestOverall) {
                this.onProgressCallback({ generation: gen + 1, totalGenerations: GENERATIONS, bestScore: bestOverall.score });
            }

            if (gen === GENERATIONS - 1) break;

            const elite = scoredPopulation.slice(0, ELITISM_COUNT).map(s => s.settings);
            const parents = this.selection(scoredPopulation.filter(p => isFinite(p.score)));
            if (parents.length === 0) { // All individuals might have failed
                population = this.initializePopulation(); // Re-initialize
                continue;
            }
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

        const baselineResult = await this.evaluateSettings(this.baselineSettings);
        if (bestOverall && bestOverall.score > baselineResult.score) {
            return {
                bestSettings: bestOverall.settings,
                baselineMetrics: baselineResult.metrics,
                optimizedMetrics: bestOverall.metrics
            };
        }
        
        return null;
    }
}