import type { TimeSeriesData, BacktestMetrics, StrategySettings } from '../types';

// Standalone technical analysis functions for backtesting
const calculateSMA = (data: { close: number }[], period: number): number | null => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val.close, 0);
  return sum / period;
};

const calculateATR = (data: { high: number; low: number; close: number }[], period: number): number | null => {
  if (data.length < period + 1) return null;
  const relevantData = data.slice(-(period + 1));
  const trs: number[] = [];
  for (let i = 1; i < relevantData.length; i++) {
    const tr1 = relevantData[i].high - relevantData[i].low;
    const tr2 = Math.abs(relevantData[i].high - relevantData[i-1].close);
    const tr3 = Math.abs(relevantData[i].low - relevantData[i-1].close);
    trs.push(Math.max(tr1, tr2, tr3));
  }
  if (trs.length < period) return null;
  // Simple ATR calculation for backtesting (not smoothed)
  return trs.reduce((acc, val) => acc + val, 0) / period;
};

interface ActiveTrade {
    side: 'buy' | 'sell';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    size: number;
}

export async function runBacktestFromData(data: TimeSeriesData[], settings: StrategySettings): Promise<BacktestMetrics> {
    let trades: { pnl: number }[] = [];
    let activeTrade: ActiveTrade | null = null;
    let equity = 100000;
    let peakEquity = 100000;
    let maxDrawdown = 0;
    
    const { 
        smaPeriod, atrPeriod, shiftAtrMultiplier, shiftPctThreshold,
        stopLossAtrMultiplier, takeProfitR_R, riskPercent
    } = settings;

    const lookbackPeriod = 50; // Reduced lookback to accommodate smaller datasets
    if (data.length <= lookbackPeriod) {
        throw new Error(`Insufficient data. Need at least ${lookbackPeriod + 1} rows, but got ${data.length}.`);
    }

    for (let i = lookbackPeriod; i < data.length; i++) {
        const historicalSlice = data.slice(0, i);
        const currentBar = data[i];

        // 1. Check for SL/TP on active trade
        if (activeTrade) {
            let pnl = 0;
            let tradeClosed = false;
            if (activeTrade.side === 'buy') {
                if (currentBar.low <= activeTrade.stopLoss) {
                    pnl = (activeTrade.stopLoss - activeTrade.entryPrice) * activeTrade.size;
                    tradeClosed = true;
                } else if (currentBar.high >= activeTrade.takeProfit) {
                    pnl = (activeTrade.takeProfit - activeTrade.entryPrice) * activeTrade.size;
                    tradeClosed = true;
                }
            } else { // sell
                if (currentBar.high >= activeTrade.stopLoss) {
                    pnl = (activeTrade.entryPrice - activeTrade.stopLoss) * activeTrade.size;
                    tradeClosed = true;
                } else if (currentBar.low <= activeTrade.takeProfit) {
                    pnl = (activeTrade.entryPrice - activeTrade.takeProfit) * activeTrade.size;
                    tradeClosed = true;
                }
            }
            if (tradeClosed) {
                trades.push({ pnl });
                equity += pnl;
                const drawdown = (peakEquity - equity) / peakEquity;
                if (drawdown > maxDrawdown) {
                    maxDrawdown = drawdown;
                }
                if (equity > peakEquity) {
                    peakEquity = equity;
                }
                activeTrade = null;
            }
        }
        
        // 2. Check for new trade signal if no trade is active
        if (!activeTrade) {
            const smaCurrent = calculateSMA(historicalSlice, smaPeriod);
            const sma3BarsAgo = calculateSMA(historicalSlice.slice(0, -3), smaPeriod);
            const atrCurrent = calculateATR(historicalSlice, atrPeriod);

            if (!smaCurrent || !sma3BarsAgo || !atrCurrent) continue;

            // Fractal Detection
            let lastFractalHigh = null, lastFractalLow = null;
            const fractalSlice = historicalSlice.slice(-30);
            for (let j = fractalSlice.length - 3; j >= 2; j--) {
                const center = fractalSlice[j], p1 = fractalSlice[j-1], p2 = fractalSlice[j-2], n1 = fractalSlice[j+1], n2 = fractalSlice[j+2];
                if (center.high > p1.high && center.high > p2.high && center.high >= n1.high && center.high >= n2.high) {
                    if (!lastFractalHigh) lastFractalHigh = { price: center.high, index: j };
                }
                if (center.low < p1.low && center.low < p2.low && center.low <= n1.low && center.low <= n2.low) {
                    if (!lastFractalLow) lastFractalLow = { price: center.low, index: j };
                }
                if(lastFractalHigh && lastFractalLow) break;
            }

            if (!lastFractalHigh || !lastFractalLow) continue;

            let shift: 'buy' | 'sell' | null = null;
            const entryPrice = historicalSlice[historicalSlice.length - 1].close;

            // Shift Trigger
            if (lastFractalHigh.index < lastFractalLow.index && entryPrice > lastFractalLow.price + Math.max(atrCurrent * shiftAtrMultiplier, lastFractalLow.price * shiftPctThreshold)) {
                shift = 'buy';
            } else if (lastFractalLow.index < lastFractalHigh.index && entryPrice < lastFractalHigh.price - Math.max(atrCurrent * shiftAtrMultiplier, lastFractalHigh.price * shiftPctThreshold)) {
                shift = 'sell';
            }

            if (!shift) continue;

            // Trend Confirmation
            const trend = smaCurrent > sma3BarsAgo ? 'bull' : 'bear';
            if ((shift === 'buy' && trend !== 'bull') || (shift === 'sell' && trend !== 'bear')) continue;
            
            // If all checks pass, open a new trade
            const stopDistance = atrCurrent * stopLossAtrMultiplier;
            const stopLoss = shift === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
            const takeProfit = shift === 'buy' ? entryPrice + (stopDistance * takeProfitR_R) : entryPrice - (stopDistance * takeProfitR_R);
            const riskUsd = equity * riskPercent;
            const size = riskUsd / stopDistance;
            
            activeTrade = { side: shift, entryPrice, stopLoss, takeProfit, size };
        }
    }

    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const totalProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));

    return {
        total_pnl: totalPnl,
        win_rate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
        max_drawdown: maxDrawdown * 100,
        profit_factor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0,
        total_trades: trades.length,
    };
}