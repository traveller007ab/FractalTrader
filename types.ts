export interface SignalMetadata {
  atr: number;
  trend_15m: 'bull' | 'bear' | 'neutral';
  PDH: number;
  PDL: number;
  volume_spike: boolean;
  risk_usd: number;
  volatility_filter: string;
  pd_distance_status: string;
}

export interface Signal {
  signal_id: string;
  strategy: string;
  symbol: string;
  exchange: 'BINANCE' | 'ALPACA' | 'POLYGON' | 'OANDA';
  side: 'buy' | 'sell';
  size: number;
  entry: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  metadata?: Partial<SignalMetadata>;
  timestamp: string;
}

export interface CopiedTrade {
  id: string;
  signal_id: string;
  user_id: string;
  executed_at: string;
  entry_price: number;
  exit_price?: number;
  pnl?: number | null; // PNL can be null for open trades
  status: 'open' | 'closed';
}

export interface BacktestMetrics {
  total_pnl: number;
  win_rate: number;
  max_drawdown: number;
  profit_factor: number;
  total_trades: number;
  grossProfit?: number;
  grossLoss?: number;
  pnl_history?: PnlDataPoint[];
}

export interface BacktestRun {
  id: string;
  user_id: string;
  strategy: string;
  params: { [key: string]: any };
  metrics: BacktestMetrics | null;
  started_at: string;
  ended_at: string;
}

export interface PerformanceMetrics {
  total_pnl: number;
  win_rate: number;
  max_drawdown: number;
  avg_return: number;
  latency_ms: number;
}

export interface PnlDataPoint {
  date: string;
  pnl: number;
}

export interface TimeSeriesData {
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface StrategySettings {
  shiftAtrMultiplier: number;
  smaPeriod: number;
  proximityAtrMultiplier: number;
  atrPeriod: number;
  atrFilterMultiplier: number;
  volumeFilterMultiplier: number;
  stopLossAtrMultiplier: number;
  takeProfitR_R: number;
  riskPercent: number;
  confidenceThreshold: number;
  cooldownBars: number;
  duplicateThresholdPct: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}


// Supabase type structure for type safety
export interface Database {
  public: {
    Tables: {
      // Fix: Add definition for the 'profiles' table to resolve type errors with Supabase client.
      profiles: {
        Row: {
          id: string;
          strategy_settings: StrategySettings | null;
        };
        Insert: {
          id: string;
          strategy_settings: StrategySettings;
        };
        Update: Partial<{
          id: string;
          strategy_settings: StrategySettings;
        }>;
      };
      backtest_runs: {
        Row: BacktestRun;
        // Fix: Changed from Omit<BacktestRun, 'id'> because the client generates and inserts the UUID.
        Insert: BacktestRun;
        Update: Partial<BacktestRun>;
      };
      copied_trades: {
        Row: CopiedTrade;
        Insert: Omit<CopiedTrade, 'id'>;
        Update: Partial<CopiedTrade>;
      };
      signals: {
          Row: Signal;
          Insert: Omit<Signal, 'signal_id' | 'timestamp'>;
          Update: Partial<Signal>;
      }
    };
    // Fix: Add empty Views and Functions to the Database interface to fully conform to the expected structure and resolve type inference issues with the Supabase client.
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
  };
}