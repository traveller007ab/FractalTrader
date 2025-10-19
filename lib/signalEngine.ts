import { supabase } from './supabaseClient';
import { getTimeSeries } from './twelveDataClient';
import type { Signal, SignalMetadata, StrategySettings } from '../types';
import { defaultStrategySettings } from './strategyConfig';

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
  if (trs.length > 0) {
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
    const sorted = [...arr].sort((a,b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Configuration for symbols and their respective exchanges
const symbolConfig = {
    'BTC/USD': { exchange: 'BINANCE' },
    'ETH/USD': { exchange: 'BINANCE' },
    'XAU/USD': { exchange: 'OANDA' },
};
const symbols = Object.keys(symbolConfig);

class SignalEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastSignalInfo: Map<string, { timestamp: number; price: number; side: 'buy' | 'sell' }> = new Map();
  private settings: StrategySettings = defaultStrategySettings;
  private currentSymbolIndex = 0;
  private onError: ((error: Error) => void) | null = null;

  public setOnError(callback: (error: Error) => void) {
    this.onError = callback;
  }

  public updateSettings(newSettings: StrategySettings) {
    console.log('[SignalEngine] Updating settings:', newSettings);
    this.settings = newSettings;
  }

  private async runStrategy() {
    const symbol = symbols[this.currentSymbolIndex];
    console.log(`[SignalEngine] Processing symbol ${symbol} (${this.currentSymbolIndex + 1}/${symbols.length})`);
    
    try {
      await this.processSymbol(symbol);
    } catch (error: any) {
      console.error(`[SignalEngine] Error processing symbol ${symbol}:`, error);
      if (this.onError) {
          this.onError(error);
      }
    }
    
    // Move to the next symbol for the next interval run
    this.currentSymbolIndex = (this.currentSymbolIndex + 1) % symbols.length;
  }
  
  private async processSymbol(symbol: string) {
    const { 
        smaPeriod, atrPeriod, shiftAtrMultiplier, shiftPctThreshold, 
        proximityAtrMultiplier, atrFilterMultiplier, volumeFilterMultiplier,
        confidenceThreshold, cooldownBars, duplicateThresholdPct,
        stopLossAtrMultiplier, takeProfitR_R, riskPercent, exposureCapPercent
    } = this.settings;
    
    // 1. Fetch Data
    const [dailyDataRes, fifteenMinDataRes] = await Promise.all([
      getTimeSeries({ symbol, interval: '1day', outputsize: 55 }), // For PDH/PDL and ATR median
      getTimeSeries({ symbol, interval: '15min', outputsize: 100 }) // For execution logic
    ]);
    
    // Reverse data to have it in chronological order (oldest -> newest)
    const dailyData = dailyDataRes.reverse();
    const fifteenMinData = fifteenMinDataRes.reverse();
    
    if (fifteenMinData.length < 50 || dailyData.length < 51) {
        console.warn(`[SignalEngine] Insufficient data for ${symbol}. Needed 50 (15min) and 51 (daily), got ${fifteenMinData.length} and ${dailyData.length}.`);
        return;
    }
    
    const latestBar = fifteenMinData[fifteenMinData.length - 1];
    
    // --- Rule S1: Compute previous day structure ---
    const PDH = dailyData[dailyData.length - 2].high; // -2 is the last *completed* day
    const PDL = dailyData[dailyData.length - 2].low;

    // --- Technical Indicators ---
    const smas = calculateSMA(fifteenMinData, smaPeriod);
    const atrs = calculateATR(fifteenMinData, atrPeriod);
    const dailyAtrs = calculateATR(dailyData, atrPeriod);

    if (smas.length < 4 || atrs.length < 1 || dailyAtrs.length < 30) {
        console.warn(`[SignalEngine] Insufficient indicator data for ${symbol}.`);
        return;
    }
    
    const latestSma = smas[smas.length - 1];
    const prevSma3 = smas[smas.length - 4];
    const latestAtr = atrs[atrs.length - 1];
    const medianAtr50 = median(atrs.slice(-50));
    const medianVolume50 = median(fifteenMinData.slice(-50).map(d => d.volume));

    const metadata: Partial<SignalMetadata> = { atr: latestAtr, PDH, PDL, volatility_filter: 'pass' };

    // --- Rule V1: ATR Filter ---
    if (latestAtr < medianAtr50 * atrFilterMultiplier) {
      metadata.volatility_filter = `fail_low_volatility (ATR: ${latestAtr.toFixed(2)} < ${ (medianAtr50 * atrFilterMultiplier).toFixed(2)})`;
      return; // Skip signal
    }

    // --- Rule D1: Fractal Detection ---
    let lastFractalHigh = null, lastFractalLow = null;
    for (let i = fifteenMinData.length - 3; i >= 2; i--) {
        const center = fifteenMinData[i];
        const p1 = fifteenMinData[i-1], p2 = fifteenMinData[i-2];
        const n1 = fifteenMinData[i+1], n2 = fifteenMinData[i+2];
        if (center.high > p1.high && center.high > p2.high && center.high >= n1.high && center.high >= n2.high) {
            if (!lastFractalHigh) lastFractalHigh = { price: center.high, index: i };
        }
        if (center.low < p1.low && center.low < p2.low && center.low <= n1.low && center.low <= n2.low) {
            if (!lastFractalLow) lastFractalLow = { price: center.low, index: i };
        }
        if(lastFractalHigh && lastFractalLow) break;
    }

    if (!lastFractalHigh || !lastFractalLow) return; // Not enough fractal structure

    let shift: 'buy' | 'sell' | null = null;
    let entryPrice = latestBar.close;

    // --- Rule D2: Shift Trigger ---
    if (lastFractalHigh.index < lastFractalLow.index && entryPrice > lastFractalLow.price + Math.max(latestAtr * shiftAtrMultiplier, lastFractalLow.price * shiftPctThreshold)) {
      shift = 'buy';
    } else if (lastFractalLow.index < lastFractalHigh.index && entryPrice < lastFractalHigh.price - Math.max(latestAtr * shiftAtrMultiplier, lastFractalHigh.price * shiftPctThreshold)) {
      shift = 'sell';
    }

    if (!shift) return;

    // --- Rule T1 & T2: Trend Confirmation ---
    const trend = latestSma > prevSma3 ? 'bull' : 'bear';
    metadata.trend_15m = trend;
    if ((shift === 'buy' && trend !== 'bull') || (shift === 'sell' && trend !== 'bear')) {
        return; // Reject, trend mismatch
    }

    // --- Daily Structure Rules ---
    metadata.pd_distance_status = 'safe';
    if (shift === 'buy' && Math.abs(entryPrice - PDH) <= (latestAtr * proximityAtrMultiplier)) {
        metadata.pd_distance_status = 'blocked_near_pdh';
        return; // Block BUY
    }
    if (shift === 'sell' && Math.abs(entryPrice - PDL) <= (latestAtr * proximityAtrMultiplier)) {
        metadata.pd_distance_status = 'blocked_near_pdl';
        return; // Block SELL
    }

    // --- Confidence & Emission Rules ---
    let confidence = 0;
    // Base confidence for trend match
    confidence += 0.40; 
    
    // Rule V2: Volume Filter
    metadata.volume_spike = latestBar.volume >= medianVolume50 * volumeFilterMultiplier;
    confidence += metadata.volume_spike ? 0.12 * 1.0 : 0.12 * 0.5;

    // ATR Strength
    confidence += 0.10 * Math.min(1.0, latestAtr / medianAtr50);

    // Daily Structure
    if (shift === 'buy' && entryPrice > PDH) confidence += 0.10; // Rule S3 Bonus
    else if (shift === 'sell' && entryPrice < PDL) confidence += 0.10; // Rule S3 Bonus
    else if (entryPrice < PDH && entryPrice > PDL) confidence -= 0.15; // Rule S4 Bias
    else confidence += 0.15 * 0.7; // Default for being far
    
    // Mocked components
    confidence += 0.18 * 0.6; // Mock recent success at 60%
    confidence += 0.05 * 1.0; // Mock liquidity as good

    // --- Rule C2: Emission Condition ---
    if (confidence < confidenceThreshold) return;

    // --- Lifecycle Rules ---
    const lastSignal = this.lastSignalInfo.get(`${symbol}_${shift}`);
    // L1: Cooldown
    if (lastSignal && (Date.now() - lastSignal.timestamp) < (cooldownBars * 15 * 60 * 1000)) return; 
    // L2: Duplicates
    if (lastSignal && Math.abs(entryPrice - lastSignal.price) / lastSignal.price < duplicateThresholdPct) return;


    // --- Risk Management Rules ---
    const stopDistance = latestAtr * stopLossAtrMultiplier;
    const stop_loss = shift === 'buy' ? entryPrice - stopDistance : entryPrice + stopDistance;
    const take_profit = shift === 'buy' ? entryPrice + (stopDistance * takeProfitR_R) : entryPrice - (stopDistance * takeProfitR_R);
    
    const accountEquity = 100000; // Mock account equity
    const riskUsd = accountEquity * riskPercent; // R2
    metadata.risk_usd = riskUsd;
    let size = riskUsd / stopDistance;
    
    if (size * entryPrice > accountEquity * exposureCapPercent) { // R3
      size = (accountEquity * exposureCapPercent) / entryPrice;
    }

    // --- Signal Emission ---
    const newSignal: Omit<Signal, 'id' | 'created_at'> = {
      strategy: 'fractal_shift_rbs_v1',
      symbol: symbol,
      exchange: symbolConfig[symbol as keyof typeof symbolConfig].exchange as Signal['exchange'],
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
    } else {
        this.lastSignalInfo.set(`${symbol}_${shift}`, { timestamp: Date.now(), price: entryPrice, side: shift });
    }
  }

  start(intervalMs = 60000) { // Check every minute
    if (this.intervalId) {
      console.log('[SignalEngine] Engine already running.');
      return;
    }
    console.log('[SignalEngine] Starting real-time strategy engine...');
    this.runStrategy(); // Run immediately
    this.intervalId = setInterval(() => this.runStrategy(), intervalMs);
  }

  stop() {
    if (this.intervalId) {
      console.log('[SignalEngine] Stopping engine...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const signalEngine = new SignalEngine();