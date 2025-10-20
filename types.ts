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
  id: string;
  strategy: string;
  symbol: string;
  exchange: 'BINANCE' | 'ALPACA' | 'POLYGON' | 'OANDA';
  side: 'buy' | 'sell';
  size: number;
  price: number;
  stop_loss: number;
  take_profit: number;
  confidence: number;
  metadata?: Partial<SignalMetadata>;
  created_at: string;
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
  shiftPctThreshold: number;
  smaPeriod: number;
  proximityAtrMultiplier: number;
  atrPeriod: number;
  atrFilterMultiplier: number;
  volumeFilterMultiplier: number;
  stopLossAtrMultiplier: number;
  takeProfitR_R: number;
  riskPercent: number;
  exposureCapPercent: number;
  confidenceThreshold: number;
  cooldownBars: number;
  duplicateThresholdPct: number;
}


// Supabase type structure for type safety
export interface Database {
  public: {
    Tables: {
      backtest_runs: {
        Row: BacktestRun;
        Insert: Omit<BacktestRun, 'id'>;
        Update: Partial<BacktestRun>;
      };
      copied_trades: {
        Row: CopiedTrade;
        Insert: Omit<CopiedTrade, 'id'>;
        Update: Partial<CopiedTrade>;
      };
      signals: {
          Row: Signal;
          Insert: Omit<Signal, 'id' | 'created_at'>;
          Update: Partial<Signal>;
      }
    };
  };
}