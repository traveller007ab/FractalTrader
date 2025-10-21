import type { TimeSeriesData, StrategySettings, BacktestMetrics, PnlDataPoint } from '../types';

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

// These are simplified versions from signalEngine for backtesting
const calculateSMA = (data: { close: number }[], period: number, startIndex: number): number | null => {
    if (startIndex < period - 1) return null;
    const sum = data.slice(startIndex - period + 1, startIndex + 1).reduce((acc, val) => acc + val.close, 0);
    return sum / period;
};

const calculateATR = (data: { high: number; low: number; close: number }[], period: number, endIndex: number): number | null => {
    if (endIndex < period) return null; // Need at least `period+1` bars to calculate first ATR
    const trs: number[] = [];
    for (let i = endIndex - period + 1; i <= endIndex; i++) {
        const tr1 = data[i].high - data[i].low;
        const tr2 = Math.abs(data[i].high - data[i-1].close);
        const tr3 = Math.abs(data[i].low - data[i-1].close);
        trs.push(Math.max(tr1, tr2, tr3));
    }
    return trs.reduce((acc, val) => acc + val, 0) / period;
};


export function runBacktestFromData(
    allData: TimeSeriesData[],
    settings: StrategySettings
): { trades: BacktestTrade[], metrics: BacktestMetrics } {
    const trades: BacktestTrade[] = [];
    let openTrades: BacktestTrade[] = [];
    const equityHistory: number[] = [100000]; // Starting equity
    const pnlHistory: PnlDataPoint[] = [];

    const { 
        smaPeriod, atrPeriod, shiftAtrMultiplier, shiftPctThreshold, 
        stopLossAtrMultiplier, takeProfitR_R
    } = settings;

    for (let i = 50; i < allData.length; i++) {
        const currentBar = allData[i];
        
        // --- Manage Open Trades ---
        const stillOpenTrades: BacktestTrade[] = [];
        for (const trade of openTrades) {
            let closed = false;
            if (trade.side === 'buy') {
                if (currentBar.low <= trade.stop_loss) {
                    trade.exit_price = trade.stop_loss;
                    closed = true;
                } else if (currentBar.high >= trade.take_profit) {
                    trade.exit_price = trade.take_profit;
                    closed = true;
                }
            } else { // sell
                if (currentBar.high >= trade.stop_loss) {
                    trade.exit_price = trade.stop_loss;
                    closed = true;
                } else if (currentBar.low <= trade.take_profit) {
                    trade.exit_price = trade.take_profit;
                    closed = true;
                }
            }

            if (closed) {
                trade.status = 'closed';
                trade.exit_bar_index = i;
                trade.pnl = (trade.exit_price! - trade.entry_price) * trade.size * (trade.side === 'buy' ? 1 : -1);
                trades.push(trade);
                const newEquity = (equityHistory[equityHistory.length - 1] || 100000) + trade.pnl;
                equityHistory.push(newEquity);
                pnlHistory.push({ date: currentBar.datetime, pnl: newEquity });

            } else {
                stillOpenTrades.push(trade);
            }
        }
        openTrades = stillOpenTrades;

        // --- Look for New Trades (simplified from signalEngine) ---
        // Basic fractal logic
        let lastFractalHigh: {price: number, index: number} | null = null;
        let lastFractalLow: {price: number, index: number} | null = null;
        for (let j = i - 3; j >= 2; j--) {
            const center = allData[j];
            if (center.high > allData[j-1].high && center.high > allData[j-2].high && center.high >= allData[j+1].high && center.high >= allData[j+2].high) {
                if (!lastFractalHigh) lastFractalHigh = { price: center.high, index: j };
            }
            if (center.low < allData[j-1].low && center.low < allData[j-2].low && center.low <= allData[j+1].low && center.low <= allData[j+2].low) {
                if (!lastFractalLow) lastFractalLow = { price: center.low, index: j };
            }
            if(lastFractalHigh && lastFractalLow) break;
        }

        if (!lastFractalHigh || !lastFractalLow) continue;

        const latestAtr = calculateATR(allData, atrPeriod, i);
        const latestSma = calculateSMA(allData, smaPeriod, i);
        const prevSma3 = calculateSMA(allData, smaPeriod, i - 3);

        if (!latestAtr || !latestSma || !prevSma3) continue;

        let shift: 'buy' | 'sell' | null = null;
        if (lastFractalHigh.index < lastFractalLow.index && currentBar.close > lastFractalLow.price + Math.max(latestAtr * shiftAtrMultiplier, lastFractalLow.price * shiftPctThreshold)) {
            shift = 'buy';
        } else if (lastFractalLow.index < lastFractalHigh.index && currentBar.close < lastFractalHigh.price - Math.max(latestAtr * shiftAtrMultiplier, lastFractalHigh.price * shiftPctThreshold)) {
            shift = 'sell';
        }

        if (!shift) continue;

        const trend = latestSma > prevSma3 ? 'bull' : 'bear';
        if ((shift === 'buy' && trend !== 'bull') || (shift === 'sell' && trend !== 'bear')) {
            continue;
        }
        
        // If there's already an open trade, don't open another
        if(openTrades.length > 0) continue;

        // --- Create New Trade ---
        const entryPrice = currentBar.close;
        const stopDistance = latestAtr * stopLossAtrMultiplier;
        const stop_loss = shift === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
        const take_profit = shift === 'buy' ? entryPrice + (stopDistance * takeProfitR_R) : entryPrice - (stopDistance * takeProfitR_R);
        
        const newTrade: BacktestTrade = {
            entry_price: entryPrice,
            side: shift,
            size: 1, // Simplified size for backtesting
            stop_loss,
            take_profit,
            entry_bar_index: i,
            status: 'open'
        };
        openTrades.push(newTrade);
    }
    
    // --- Calculate Metrics ---
    const closedTrades = trades.filter(t => t.status === 'closed');
    const total_trades = closedTrades.length;
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const win_rate = total_trades > 0 ? (winningTrades.length / total_trades) * 100 : 0;
    const total_pnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    
    let profit_factor = 1; // Default for no trades or break-even
    if (grossLoss > 0) {
        profit_factor = grossProfit / grossLoss;
    } else if (grossProfit > 0) {
        profit_factor = 999; // Represents an "infinite" profit factor for a perfect run
    }

    let maxDrawdown = 0;
    let peakEquity = 100000;
    for (const equity of equityHistory) {
        if (equity > peakEquity) {
            peakEquity = equity;
        }
        const drawdown = ((peakEquity - equity) / peakEquity) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }
    
    const metrics: BacktestMetrics = {
        total_pnl,
        win_rate,
        max_drawdown: maxDrawdown,
        profit_factor,
        total_trades,
        pnl_history: pnlHistory
    };

    return { trades, metrics };
}