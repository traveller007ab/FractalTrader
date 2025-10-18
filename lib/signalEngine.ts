
import { supabase } from './supabaseClient';
import type { Signal } from '../types';

const symbols = ['BTC/USD', 'ETH/USD', 'SOL/USD', 'ADA/USD', 'DOGE/USD'];
const exchanges = ['BINANCE', 'ALPACA', 'POLYGON'];

class SignalEngine {
  // FIX: Replace NodeJS.Timeout with ReturnType<typeof setInterval> for browser compatibility.
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private generateRandomSignal = async () => {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const price = 50000 + Math.random() * 20000;
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const stopLoss = side === 'buy' ? price * 0.98 : price * 1.02;
    const takeProfit = side === 'buy' ? price * 1.05 : price * 0.95;

    const newSignal: Omit<Signal, 'id' | 'created_at'> = {
      strategy: `Momentum Breakout v${(Math.random() * 3 + 1).toFixed(1)}`,
      symbol,
      exchange: exchanges[Math.floor(Math.random() * exchanges.length)] as 'BINANCE' | 'ALPACA' | 'POLYGON',
      side,
      price,
      size: Math.random() * 5,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      confidence: Math.random() * 0.5 + 0.4, // 0.4 to 0.9
    };

    const { error } = await supabase.from('signals').insert(newSignal);
    if (error) {
      console.error('Error inserting signal:', error);
    }
  };

  start(intervalMs = 5000) {
    if (this.intervalId) {
      console.log('Signal engine already running.');
      return;
    }
    console.log('Starting signal engine...');
    this.generateRandomSignal(); // Generate one immediately
    this.intervalId = setInterval(this.generateRandomSignal, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      console.log('Stopping signal engine...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const signalEngine = new SignalEngine();