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
  entry_price: number;
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
  params: any;
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
export type Database = {
  public: {
    Tables: {
      backtest_runs: {
        Row: {
          ended_at: string
          id: string
          // Fix: Using a specific type for the JSONB column instead of `any` to aid type inference.
          metrics: BacktestMetrics | null
          // Fix: Using a specific type for the JSONB column instead of `any`.
          params: Record<string, any>
          started_at: string
          strategy: string
          user_id: string
        }
        Insert: {
          ended_at: string
          id?: string
          // Fix: Using a specific type for the JSONB column instead of `any`.
          metrics?: BacktestMetrics | null
          // Fix: Using a specific type for the JSONB column instead of `any`.
          params: Record<string, any>
          started_at: string
          strategy: string
          user_id: string
        }
        Update: {
          ended_at?: string
          id?: string
          // Fix: Using a specific type for the JSONB column instead of `any`.
          metrics?: BacktestMetrics | null
          // Fix: Using a specific type for the JSONB column instead of `any`.
          params?: Record<string, any>
          started_at?: string
          strategy?: string
          user_id?: string
        }
      },
      copied_trades: {
        Row: {
          entry_price: number
          executed_at: string
          exit_price: number | null
          id: string
          pnl: number | null
          signal_id: string
          // Fix: Using a specific string literal type for `status` to match the application logic.
          status: "open" | "closed"
          user_id: string
        }
        Insert: {
          entry_price: number
          executed_at: string
          exit_price?: number | null
          id?: string
          pnl?: number | null
          signal_id: string
          // Fix: Using a specific string literal type for `status` to match the application logic.
          status: "open" | "closed"
          user_id: string
        }
        Update: {
          entry_price?: number
          executed_at?: string
          exit_price?: number | null
          id?: string
          pnl?: number | null
          signal_id?: string
          // Fix: Using a specific string literal type for `status` to match the application logic.
          status?: "open" | "closed"
          user_id?: string
        }
      },
      profiles: {
        Row: {
          id: string
          // Fix: Using a specific type for the JSONB column instead of `any`.
          strategy_settings: StrategySettings | null
        }
        Insert: {
          id: string
          // Fix: Using a specific type for the JSONB column instead of `any`.
          strategy_settings?: StrategySettings | null
        }
        Update: {
          id?: string
          // Fix: Using a specific type for the JSONB column instead of `any`.
          strategy_settings?: StrategySettings | null
        }
      },
      signals: {
        Row: {
          confidence: number
          entry_price: number
          // Fix: Using a specific string literal type for `exchange` to match the application logic.
          exchange: 'BINANCE' | 'ALPACA' | 'POLYGON' | 'OANDA'
          // Fix: Using a specific type for the JSONB column instead of `any`.
          metadata: Partial<SignalMetadata> | null
          // Fix: Using a specific string literal type for `side` to match the application logic.
          side: 'buy' | 'sell'
          signal_id: string
          size: number
          stop_loss: number
          strategy: string
          symbol: string
          take_profit: number
          timestamp: string
        }
        Insert: {
          confidence: number
          entry_price: number
          // Fix: Using a specific string literal type for `exchange` to match the application logic.
          exchange: 'BINANCE' | 'ALPACA' | 'POLYGON' | 'OANDA'
          // Fix: Using a specific type for the JSONB column instead of `any`.
          metadata?: Partial<SignalMetadata> | null
          // Fix: Using a specific string literal type for `side` to match the application logic.
          side: 'buy' | 'sell'
          signal_id?: string
          size: number
          stop_loss: number
          strategy: string
          symbol: string
          take_profit: number
          timestamp?: string
        }
        Update: {
          confidence?: number
          entry_price?: number
          // Fix: Using a specific string literal type for `exchange` to match the application logic.
          exchange?: 'BINANCE' | 'ALPACA' | 'POLYGON' | 'OANDA'
          // Fix: Using a specific type for the JSONB column instead of `any`.
          metadata?: Partial<SignalMetadata> | null
          // Fix: Using a specific string literal type for `side` to match the application logic.
          side?: 'buy' | 'sell'
          signal_id?: string
          size?: number
          stop_loss?: number
          strategy?: string
          symbol?: string
          take_profit?: number
          timestamp?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}