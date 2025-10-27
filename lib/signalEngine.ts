// Fix: Add file extensions to imports to ensure proper module resolution and typing.
import { supabase } from './supabaseClient.ts';
import { getTimeSeries } from './twelveDataClient.ts';
import type { Signal, SignalMetadata, StrategySettings, TimeSeriesData, FullStrategySettings } from '../types.ts';
import { strategyConfig, getSymbolSettings } from './strategyRBSv2Config.ts';

// Technical Analysis helper functions
const calculateSMA = (data: { close: number }[], period: number): number[] => {
  const sma: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    sma.push(sum / period);
  }
  return sma;
};

const calculateATR = (data: { high: number; low: number; close: number }[], period: number): number[] => {
  const trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const tr1 = data[i].high - data[i].low;
    const tr2 = Math.abs(data[i].high - data[i-1].close);
    const tr3 = Math.abs(data[i].low - data[i-1].close);
    trs.push(Math.max(tr1, tr2, tr3));
  }
  
  const atr: number[] = [];
  if (trs.length >= period) {
      let firstAtr = trs.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
      atr.push(firstAtr);
      for (let i = period; i < trs.length; i++) {
          const nextAtr = (atr[atr.length - 1] * (period - 1) + trs[i]) / period;
          atr.push(nextAtr);
      }
  }
  return atr;
};

const median = (arr: number[]): number => {
    if(arr.length === 0) return 0;
    const sorted = [...arr].sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const symbols = ['ETH/USD', 'XAU/USD', 'BTC/USD', 'XAG/USD', 'SOL/USD'];

class SignalEngine {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastSignalInfo: Map<string, { timestamp: number; price: number; side: 'buy' | 'sell' }> = new Map();
  private settings: FullStrategySettings = strategyConfig;
  private onError: ((error: Error) => void) | null = null;
  private dailyDataCache: Map<string, { fetchedDate: string; data: TimeSeriesData[] }> = new Map();

  public setOnError(callback: (error: Error) => void) {
    this.onError = callback;
  }
  
  public updateSettings(newSettings: FullStrategySettings) {
    console.log('[SignalEngine] Full strategy settings updated.', newSettings);
    this.settings = newSettings;
  }
  
  private async getDailyData(symbol: string): Promise<TimeSeriesData[]> {
    const today = new Date().toISOString().split('T')[0];
    const cachedEntry = this.dailyDataCache.get(symbol);

    if (cachedEntry && cachedEntry.fetchedDate === today) {
        console.log(`[SignalEngine] Using cached daily data for ${symbol}.`);
        return cachedEntry.data;
    }

    console.log(`[SignalEngine] Fetching fresh daily data for ${symbol}.`);
    const dailyDataRes = await getTimeSeries({ symbol, interval: '1day', outputsize: 55 });
    const dailyData = dailyDataRes.reverse();
    
    if (dailyData.length > 0) {
      this.dailyDataCache.set(symbol, { fetchedDate: today, data: dailyData });
    }
    return dailyData;
  }
  
  private async runStrategyForAllSymbols() {
    console.log(`[SignalEngine] Starting check for all ${symbols.length} symbols.`);
    for (const symbol of symbols) {
       try {
        await this.processSymbol(symbol);
      } catch (error: any) {
        const errorMessage = `[SignalEngine] Error processing symbol ${symbol}: ${error.message}`;
        console.error(errorMessage, error);
        if (this.onError) {
            this.onError(new Error(errorMessage));
        }
      }
      // Add a delay to avoid hitting API rate limits. 15 seconds is a safe buffer.
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    console.log('[SignalEngine] All symbols checked.');
  }
  
  private async processSymbol(symbol: string) {
    const symbolSettings = getSymbolSettings(symbol, this.settings);
    
    const { 
        smaPeriod, atrPeriod, shiftAtrMultiplier,
        proximityAtrMultiplier, atrFilterMultiplier, volumeFilterMultiplier,
        confidenceThreshold, cooldownBars, duplicateThresholdPct,
        stopLossAtrMultiplier, takeProfitR_R, riskPercent
    } = symbolSettings;
    
    // 1. Fetch Data
    const [dailyData, intervalDataRes] = await Promise.all([
      this.getDailyData(symbol),
      getTimeSeries({ symbol, interval: '15min', outputsize: 100 }) // Analysis is on the 15min timeframe
    ]);
    
    const intervalData = intervalDataRes.reverse();
    
    if (intervalData.length < 50 || dailyData.length < 51) {
        console.warn(`[SignalEngine] Insufficient data for ${symbol}. Needed 50 (15min) and 51 (daily), got ${intervalData.length} and ${dailyData.length}.`);
        return;
    }
    
    const latestBar = intervalData[intervalData.length - 1];
    const metadata: Partial<SignalMetadata> = {};

    // --- Rule D1: Detection - Fractal Logic ---
    let lastPivotHigh = null, lastPivotLow = null;
    for (let i = intervalData.length - 3; i >= 2; i--) {
        const p2 = intervalData[i-2], p1 = intervalData[i-1], center = intervalData[i], n1 = intervalData[i+1], n2 = intervalData[i+2];
        if (center.high > p1.high && center.high > p2.high && center.high >= n1.high && center.high >= n2.high) {
            if (!lastPivotHigh) lastPivotHigh = { price: center.high, index: i };
        }
        if (center.low < p1.low && center.low < p2.low && center.low <= n1.low && center.low <= n2.low) {
            if (!lastPivotLow) lastPivotLow = { price: center.low, index: i };
        }
        if(lastPivotHigh && lastPivotLow) break;
    }

    if (!lastPivotHigh || !lastPivotLow) return;

    const latestAtr = calculateATR(intervalData, atrPeriod).pop();
    if(!latestAtr) return;
    metadata.atr = latestAtr;
    
    // --- Rule D2: Shift Trigger Logic ---
    let shift: 'buy' | 'sell' | null = null;
    const entryPrice = latestBar.close;
    const shiftBreakValue = Math.max(latestAtr * shiftAtrMultiplier, entryPrice * 0.002);

    if (lastPivotHigh.index > lastPivotLow.index && entryPrice > lastPivotHigh.price + shiftBreakValue) {
      shift = 'buy';
    } else if (lastPivotLow.index > lastPivotHigh.index && entryPrice < lastPivotLow.price - shiftBreakValue) {
      shift = 'sell';
    }
    if (!shift) return;

    // --- Rule T1 & T2: Trend Confirmation ---
    const smas = calculateSMA(intervalData, smaPeriod);
    if(smas.length < 4) return;
    const smaSlope = smas[smas.length - 1] - smas[smas.length - 4];
    const trend = smaSlope > 0 ? 'bull' : 'bear';
    metadata.trend_15m = trend;
    if ((shift === 'buy' && trend !== 'bull') || (shift === 'sell' && trend !== 'bear')) {
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Trend mismatch.`);
        return;
    }

    // --- Rule S1 & S2: Daily Context & Proximity Filter ---
    const PDH = dailyData[dailyData.length - 2].high;
    const PDL = dailyData[dailyData.length - 2].low;
    metadata.PDH = PDH;
    metadata.PDL = PDL;
    
    metadata.pd_distance_status = 'safe';
    if (shift === 'buy' && Math.abs(entryPrice - PDH) <= latestAtr * proximityAtrMultiplier) {
        metadata.pd_distance_status = 'blocked_near_pdh';
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Too close to PDH.`);
        return;
    }
    if (shift === 'sell' && Math.abs(entryPrice - PDL) <= latestAtr * proximityAtrMultiplier) {
        metadata.pd_distance_status = 'blocked_near_pdl';
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Too close to PDL.`);
        return;
    }

    // --- Rule V1: Volatility Filter ---
    const atrs = calculateATR(intervalData, atrPeriod).slice(-50);
    const medianAtr = median(atrs);
    if (latestAtr < medianAtr * atrFilterMultiplier) {
        metadata.volatility_filter = 'fail_low_volatility';
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Low volatility.`);
        return;
    }
    metadata.volatility_filter = 'pass';
    
    // --- Rule V2 Setup ---
    const volume50 = intervalData.slice(-50).map(d => d.volume);
    const medianVolume = median(volume50);
    metadata.volume_spike = latestBar.volume >= medianVolume * volumeFilterMultiplier;

    // --- Rule C1, S3, S4, V2: Signal Confidence Model ---
    let confidence = 0.0;
    // C1: Base components
    confidence += 0.40; // Trend Match
    const atrStrength = Math.min(1.0, latestAtr / medianAtr);
    confidence += 0.10 * atrStrength; // ATR Strength
    confidence += 0.18 * 0.70; // Mock Recent Success @ 70%
    confidence += 0.05 * 1.0;  // Mock Liquidity as good

    // Modifiers from other rules
    if (!metadata.volume_spike) { // V2: Volume Filter Penalty
        confidence -= 0.20;
    }
    if (entryPrice > PDL && entryPrice < PDH) { // S4: Range Bias Penalty
        confidence -= 0.15;
    }
    if (shift === 'buy' && entryPrice > PDH) { // S3: Breakout Bonus
        confidence += 0.10;
    }
    if (shift === 'sell' && entryPrice < PDL) { // S3: Breakout Bonus
        confidence += 0.10;
    }
    
    // --- Rule C2: Emission Condition ---
    if (confidence < confidenceThreshold) {
        console.log(`[SignalEngine] ${symbol} ${shift} signal skipped: Low confidence (${confidence.toFixed(2)}).`);
        return;
    }

    // --- Rule L1 & L2: Signal Lifecycle ---
    const lastSignal = this.lastSignalInfo.get(`${symbol}_${shift}`);
    if (lastSignal && (Date.now() - lastSignal.timestamp) < (cooldownBars * 15 * 60 * 1000)) {
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Cooldown period active.`);
        return;
    }
    if (lastSignal && Math.abs(entryPrice - lastSignal.price) / lastSignal.price < duplicateThresholdPct) {
        console.log(`[SignalEngine] ${symbol} ${shift} signal rejected: Duplicate entry price.`);
        return;
    }

    // --- Rule R1, R2, R3: Risk Management ---
    const accountEquity = 100000; // Mock account equity
    const stopDistance = latestAtr * stopLossAtrMultiplier;
    const stop_loss = shift === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
    const take_profit = shift === 'buy' ? entryPrice + (stopDistance * takeProfitR_R) : entryPrice - (stopDistance * takeProfitR_R);
    
    const riskUsd = accountEquity * (riskPercent / 100);
    metadata.risk_usd = riskUsd;
    let size = riskUsd / stopDistance;

    // R3: Exposure Cap
    if (size * entryPrice > accountEquity * 0.20) {
        size = (accountEquity * 0.20) / entryPrice;
        console.log(`[SignalEngine] ${symbol} size adjusted due to exposure cap. New size: ${size.toFixed(4)}`);
    }

    // --- Signal Output Schema ---
    const newSignal: Omit<Signal, 'signal_id' | 'timestamp'> = {
      strategy: 'fractal_shift_rbs_v2',
      symbol: symbol,
      // Fix: Use the exchange from the resolved symbol settings, which correctly handles defaults and user overrides.
      exchange: symbolSettings.exchange,
      side: shift,
      price: entryPrice,
      size,
      stop_loss,
      take_profit,
      confidence,
      metadata
    };
    
    console.log(`[SignalEngine] Emitting NEW SIGNAL for ${symbol}:`, newSignal);
    
    const { error } = await supabase.from('signals').insert(newSignal);
    if (error) {
      console.error('[SignalEngine] Error inserting signal:', error);
      if (this.onError) {
        this.onError(error);
      }
    } else {
        this.lastSignalInfo.set(`${symbol}_${shift}`, { timestamp: Date.now(), price: entryPrice, side: shift });
    }
  }
  
  private scheduleNextRun() {
    if (this.timeoutId) {
        clearTimeout(this.timeoutId);
    }

    const intervalMs = 15 * 60 * 1000; // 15 minutes
    const nextRunTime = new Date(Date.now() + intervalMs);
    console.log(`[SignalEngine] Scheduling next check in 15 minutes at ${nextRunTime.toLocaleTimeString()}.`);


    this.timeoutId = setTimeout(async () => {
        await this.runStrategyForAllSymbols();
        this.scheduleNextRun(); // Reschedule for the next run
    }, intervalMs);
  }

  start() {
    if (this.timeoutId) {
      console.log('[SignalEngine] Engine already running.');
      return;
    }
    console.log('[SignalEngine] Starting real-time strategy engine (RBS v2)...');
    
    // Run once immediately, then schedule subsequent runs.
    (async () => {
      await this.runStrategyForAllSymbols();
      this.scheduleNextRun();
    })();
  }

  stop() {
    if (this.timeoutId) {
      console.log('[SignalEngine] Stopping engine...');
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export const signalEngine = new SignalEngine();