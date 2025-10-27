// Fix: Add file extensions to imports for proper module resolution.
import type { TimeSeriesData, StrategySettings, BacktestMetrics, PnlDataPoint } from '../types.ts';
import { getSymbolSettings } from './strategyRBSv2Config.ts';

interface BacktestTrade {
    entry_price: number;
    exit_price?: number;
    side: 'buy' | 'sell';
    size: number;
    stop_loss: number;
    take_profit: number;
    entry_bar_index: number;
    exit_bar_index?: number;
    pnl?: number;
    status: 'open' | 'closed';
}

// Technical analysis helpers for backtesting
const calculateSMA = (data: { close: number }[], period: number, startIndex: number): number | null => {
    if (startIndex < period - 1) return null;
    const sum = data.slice(startIndex - period + 1, startIndex + 1).reduce((acc, val) => acc + val.close, 0);
    return sum / period;
};

const calculateATR = (data: { high: number; low: number; close: number }[], period: number, endIndex: number): number | null => {
    if (endIndex < period) return null;
    // For simplicity and performance, backtester uses a simplified ATR for the current bar.
    // A more rigorous backtest might calculate the full smoothed ATR series.
    const relevantData = data.slice(Math.max(0, endIndex - period), endIndex + 1);
    const trs: number[] = [];
    for (let i = 1; i < relevantData.length; i++) {
        const prevBar = relevantData[i-1];
        const currBar = relevantData[i];
        const tr1 = currBar.high - currBar.low;
        const tr2 = Math.abs(currBar.high - prevBar.close);
        const tr3 = Math.abs(currBar.low - prevBar.close);
        trs.push(Math.max(tr1, tr2, tr3));
    }
    if (trs.length === 0) return null;
    return trs.reduce((acc, val) => acc + val, 0) / trs.length;
};

const median = (arr: number[]): number => {
    if(arr.length === 0) return 0;
    const sorted = [...arr].sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function runBacktestFromData(
    allData: TimeSeriesData[],
    baseSettings: StrategySettings,
    symbol: string // Symbol is now required for per-symbol settings
): { trades: BacktestTrade[], metrics: BacktestMetrics } {
    const settings = getSymbolSettings(symbol, baseSettings);
    const requiredDataLength = Math.max(settings.smaPeriod + 3, 50);

    if (!allData || allData.length < requiredDataLength) {
        throw new Error(`Insufficient historical data. The strategy requires at least ${requiredDataLength} data points, but only ${allData?.length || 0} were provided.`);
    }
    
    const trades: BacktestTrade[] = [];
    let openTrade: BacktestTrade | null = null;
    let accountEquity = 100000;
    const pnlHistory: PnlDataPoint[] = [{ date: allData[0]?.datetime || new Date().toISOString(), pnl: 0 }];
    let cumulativePnl = 0;

    const { smaPeriod, atrPeriod, atrFilterMultiplier, stopLossAtrMultiplier, takeProfitR_R, riskPercent } = settings;

    for (let i = requiredDataLength; i < allData.length; i++) {
        const currentBar = allData[i];
        
        // --- Manage Open Trade ---
        if (openTrade) {
            let closed = false;
            let exitPrice = 0;
            if (openTrade.side === 'buy') {
                if (currentBar.low <= openTrade.stop_loss) {
                    exitPrice = openTrade.stop_loss;
                    closed = true;
                } else if (currentBar.high >= openTrade.take_profit) {
                    exitPrice = openTrade.take_profit;
                    closed = true;
                }
            } else { // sell
                if (currentBar.high >= openTrade.stop_loss) {
                    exitPrice = openTrade.stop_loss;
                    closed = true;
                } else if (currentBar.low <= openTrade.take_profit) {
                    exitPrice = openTrade.take_profit;
                    closed = true;
                }
            }

            if (closed) {
                openTrade.exit_price = exitPrice;
                openTrade.status = 'closed';
                openTrade.exit_bar_index = i;
                openTrade.pnl = (openTrade.exit_price - openTrade.entry_price) * openTrade.size * (openTrade.side === 'buy' ? 1 : -1);
                
                accountEquity += openTrade.pnl;
                cumulativePnl += openTrade.pnl;
                pnlHistory.push({ date: currentBar.datetime, pnl: cumulativePnl });
                
                trades.push(openTrade);
                openTrade = null;
            }
        }
        
        // Don't open a new trade if one is already active
        if (openTrade) continue;

        // --- Look for New Trades (RBS v1 Logic) ---

        // Rule D1: Fractal Detection
        let lastPivotHigh: {price: number, index: number} | null = null;
        let lastPivotLow: {price: number, index: number} | null = null;
        for (let j = i - 3; j >= 2; j--) {
            if (allData[j].high > allData[j-1].high && allData[j].high > allData[j-2].high && allData[j].high >= allData[j+1].high && allData[j].high >= allData[j+2].high) {
                if (!lastPivotHigh) lastPivotHigh = { price: allData[j].high, index: j };
            }
            if (allData[j].low < allData[j-1].low && allData[j].low < allData[j-2].low && allData[j].low <= allData[j+1].low && allData[j].low <= allData[j+2].low) {
                if (!lastPivotLow) lastPivotLow = { price: allData[j].low, index: j };
            }
            if(lastPivotHigh && lastPivotLow) break;
        }

        if (!lastPivotHigh || !lastPivotLow) continue;
        
        const latestAtr = calculateATR(allData, atrPeriod, i);
        if (!latestAtr) continue;
        
        // Rule D2: Shift Trigger
        let shift: 'buy' | 'sell' | null = null;
        const entryPrice = currentBar.close;
        const shiftBreakValue = Math.max(latestAtr * 0.25, entryPrice * 0.002);

        if (lastPivotHigh.index > lastPivotLow.index && entryPrice > lastPivotHigh.price + shiftBreakValue) {
            shift = 'buy';
        } else if (lastPivotLow.index > lastPivotHigh.index && entryPrice < lastPivotLow.price - shiftBreakValue) {
            shift = 'sell';
        }
        if (!shift) continue;

        // Rule T1 & T2: Trend Confirmation
        const latestSma = calculateSMA(allData, smaPeriod, i);
        const prevSma3 = calculateSMA(allData, smaPeriod, i - 3);
        if (!latestSma || !prevSma3) continue;
        const trend = latestSma > prevSma3 ? 'bull' : 'bear';
        if ((shift === 'buy' && trend !== 'bull') || (shift === 'sell' && trend !== 'bear')) {
            continue;
        }
        
        // Rule V1: Volatility Filter
        const atrLookback = allData.slice(Math.max(0, i - 50), i + 1);
        const atrs = atrLookback.map((_, index) => calculateATR(atrLookback, atrPeriod, index)).filter(v => v !== null) as number[];
        const medianAtr = median(atrs);
        if (latestAtr < medianAtr * atrFilterMultiplier) {
            continue; // Skip due to low volatility
        }


        // --- Create New Trade (Rule R1, R2) ---
        const stopDistance = latestAtr * stopLossAtrMultiplier;
        const riskUsd = accountEquity * (riskPercent / 100);
        const size = stopDistance > 0 ? riskUsd / stopDistance : 0;
        if (size <= 0) continue;

        const stop_loss = shift === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
        const take_profit = shift === 'buy' ? entryPrice + (stopDistance * takeProfitR_R) : entryPrice - (stopDistance * takeProfitR_R);
        
        openTrade = {
            entry_price: entryPrice,
            side: shift,
            size,
            stop_loss,
            take_profit,
            entry_bar_index: i,
            status: 'open'
        };
    }
    
    // --- Calculate Metrics ---
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    const total_trades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const win_rate = total_trades > 0 ? (winningTrades.length / total_trades) * 100 : 0;
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    let profit_factor = grossProfit / grossLoss;
    if (grossLoss === 0) {
        profit_factor = grossProfit > 0 ? 9999 : 1; // Infinite or neutral
    }
    if (isNaN(profit_factor)) profit_factor = 1;


    let maxDrawdown = 0;
    let peakEquity = 100000;
    const equityCurve = [100000, ...closedTrades.map(t => (peakEquity += t.pnl || 0))];
    peakEquity = 100000;
    for (const equity of equityCurve) {
        peakEquity = Math.max(peakEquity, equity);
        const drawdown = ((peakEquity - equity) / peakEquity);
        maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    const metrics: BacktestMetrics = {
        total_pnl: cumulativePnl,
        win_rate,
        max_drawdown: maxDrawdown * 100,
        profit_factor,
        total_trades,
        grossProfit,
        grossLoss,
        pnl_history: pnlHistory.length > 1 ? pnlHistory : []
    };

    return { trades, metrics };
}