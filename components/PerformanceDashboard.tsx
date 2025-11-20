import React, { useMemo, useState } from 'react';
import type { CopiedTrade, BacktestRun, PnlDataPoint, BacktestTrade } from '../types';
import { AnalyticsChart } from './AnalyticsChart';
import { AnimatedNumber } from './AnimatedNumber';
import { ChartIcon, XMarkIcon, ListBulletIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';

interface PerformanceDashboardProps {
  copiedTrades: CopiedTrade[];
  sessionBacktestRuns: BacktestRun[];
  activeBacktest: BacktestRun | null;
  onClearActiveBacktest: () => void;
}

interface DisplayMetrics {
    pnl: number;
    winRate: number;
    trades: number;
    pnlHistory: PnlDataPoint[];
    activeCount?: number; // New metric for active copies
    runs?: number;
    profit_factor?: number;
    max_drawdown?: number;
    tradeLog?: BacktestTrade[];
}

const StatCardComponent: React.FC<{ title: string; value: number | undefined; formatter: (val: number) => string; tooltip: string }> = ({ title, value, formatter, tooltip }) => (
  <div className="bg-bg-primary/50 p-3 rounded-lg stat-card-group">
     <Tooltip content={tooltip}>
        <h3 className="text-xs font-medium text-text-muted truncate cursor-help border-b border-dashed border-transparent hover:border-text-muted/50">{title}</h3>
     </Tooltip>
    <p className="text-xl font-semibold text-text-primary tracking-tight mt-1 font-mono">
      {value !== undefined && !isNaN(value) ? <AnimatedNumber value={value} formatter={formatter} /> : '-'}
    </p>
  </div>
);
const StatCard = React.memo(StatCardComponent);

const BacktestTradeLog: React.FC<{ trades: BacktestTrade[] }> = ({ trades }) => {
    if (!trades || trades.length === 0) {
        return (
            <div className="text-center text-sm text-text-muted py-8">
                No individual trades were recorded for this backtest.
            </div>
        );
    }

    const formatDateTime = (isoString: string | undefined) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    const formatPrice = (price: number | undefined) => {
        if (price === undefined) return 'N/A';
        return price.toFixed(price > 100 ? 2 : 4);
    };

    return (
        <div className="mt-4 max-h-80 overflow-y-auto scroll-gutter-stable bg-bg-primary/50 rounded-lg border border-border">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-bg-secondary/50 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Side</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Entry Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Exit Time</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Entry Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Exit Price</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">P&L ($)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {trades.map((trade, index) => (
                        <tr key={index} className="hover:bg-border/40">
                            <td className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${trade.side === 'buy' ? 'text-success' : 'text-danger'}`}>{trade.side.toUpperCase()}</td>
                            <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap font-mono">{formatDateTime(trade.entry_datetime)}</td>
                            <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap font-mono">{formatDateTime(trade.exit_datetime)}</td>
                            <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap font-mono text-right">{formatPrice(trade.entry_price)}</td>
                            <td className="px-3 py-2 text-xs text-text-secondary whitespace-nowrap font-mono text-right">{formatPrice(trade.exit_price)}</td>
                            <td className={`px-3 py-2 text-xs font-semibold whitespace-nowrap font-mono text-right ${trade.pnl && trade.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                                {trade.pnl?.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ copiedTrades, sessionBacktestRuns, activeBacktest, onClearActiveBacktest }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

  const liveMetrics: DisplayMetrics = useMemo(() => {
    // Calculate Active Copies first
    const activeCount = copiedTrades.filter(t => t.status === 'open').length;

    const closedTrades = copiedTrades.filter(t => t.status === 'closed' && t.pnl != null);
    
    // Initialize Account Balance history starting at $1000
    const STARTING_BALANCE = 1000;
    let currentBalance = STARTING_BALANCE;
    const pnlHistory: PnlDataPoint[] = [{ date: 'Start', pnl: STARTING_BALANCE }];

    if (closedTrades.length > 0) {
        const sortedTrades = closedTrades
            .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime());
        
        sortedTrades.forEach(trade => {
            currentBalance += trade.pnl ?? 0;
            pnlHistory.push({ date: new Date(trade.executed_at).toLocaleTimeString(), pnl: currentBalance });
        });
    } else if (activeCount > 0) {
        // NEW: If we have active trades but no closed ones, add a 'Now' point so the chart renders a flat line
        // This gives immediate visual feedback that the account is "live".
        pnlHistory.push({ date: 'Now', pnl: STARTING_BALANCE });
    }
        
    const totalPnl = currentBalance - STARTING_BALANCE;
    const winRate = closedTrades.length > 0 ? (closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100 : 0;
    
    return { pnl: totalPnl, winRate, pnlHistory, trades: closedTrades.length, activeCount };
  }, [copiedTrades]);

  const backtestMetrics: DisplayMetrics = useMemo(() => {
    if (sessionBacktestRuns.length === 0) return { pnl: 0, winRate: 0, trades: 0, runs: 0, pnlHistory: [] };
    
    let totalPnl = 0;
    let totalTrades = 0;
    let totalWins = 0;

    sessionBacktestRuns.forEach(run => {
        totalPnl += run.metrics?.total_pnl || 0;
        totalTrades += run.metrics?.total_trades || 0;
        totalWins += Math.round((run.metrics?.total_trades || 0) * ((run.metrics?.win_rate || 0) / 100));
    });

    // For the aggregate view, we use the latest run's equity curve for simplicity
    const latestRunPnlHistory = sessionBacktestRuns[0]?.metrics?.pnl_history || [];

    return {
        pnl: totalPnl,
        winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
        trades: totalTrades,
        runs: sessionBacktestRuns.length,
        pnlHistory: latestRunPnlHistory
    };
  }, [sessionBacktestRuns]);
  
  const focusedBacktestMetrics: (DisplayMetrics & { fileName: string }) | null = useMemo(() => {
    if (!activeBacktest || !activeBacktest.metrics) return null;
    const { metrics } = activeBacktest;
    return {
        pnl: metrics.total_pnl,
        winRate: metrics.win_rate,
        trades: metrics.total_trades,
        profit_factor: metrics.profit_factor,
        max_drawdown: metrics.max_drawdown,
        pnlHistory: metrics.pnl_history || [],
        tradeLog: metrics.trades || [],
        fileName: activeBacktest.params?.symbol || 'Focused Run'
    };
  }, [activeBacktest]);
  
  const isBacktestTab = activeTab === 'backtest';
  const displayPnlHistory = (isBacktestTab ? (focusedBacktestMetrics || backtestMetrics) : liveMetrics).pnlHistory;
  const cardTitle = isBacktestTab ? (focusedBacktestMetrics ? `Focused: ${focusedBacktestMetrics.fileName}` : 'Backtest Session') : 'Live Signals';

  return (
    <div className="main-panel">
      <div className="p-4 border-b border-border flex items-center justify-between">
         <div className="flex items-center">
            <ChartIcon className="w-6 h-6 mr-3 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Performance Analytics</h2>
         </div>
         <div className="relative flex items-center bg-bg-primary/50 rounded-md p-1 border border-border w-40">
            <div className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-accent rounded transition-transform duration-300 ease-in-out"
                style={{ transform: `translateX(${activeTab === 'live' ? '0%' : '100%'})` }}>
            </div>
            <button onClick={() => setActiveTab('live')} className={`relative z-10 w-1/2 py-1 text-sm rounded-sm transition-colors duration-300 ${activeTab === 'live' ? 'text-white' : 'text-text-secondary hover:bg-border/50'}`}>Live</button>
            <button onClick={() => setActiveTab('backtest')} className={`relative z-10 w-1/2 py-1 text-sm rounded-sm transition-colors duration-300 ${activeTab === 'backtest' ? 'text-white' : 'text-text-secondary hover:bg-border/50'}`}>Backtests</button>
         </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className={`font-semibold transition-colors ${focusedBacktestMetrics ? 'text-accent text-base' : 'text-text-primary'}`}>{cardTitle}</h3>
            {focusedBacktestMetrics && (
                <button onClick={onClearActiveBacktest} className="text-xs flex items-center gap-1 text-text-secondary hover:text-text-primary">
                    <XMarkIcon className="w-4 h-4"/> Return to Aggregate
                </button>
            )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isBacktestTab ? (
                focusedBacktestMetrics ? (
                    <>
                        <StatCard title="Total P&L" value={focusedBacktestMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Total profit and loss from this run."/>
                        <StatCard title="Win Rate" value={focusedBacktestMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The percentage of trades that were profitable."/>
                        <StatCard title="Profit Factor" value={focusedBacktestMetrics.profit_factor} formatter={v => v.toFixed(2)} tooltip="Gross profit divided by gross loss."/>
                        <StatCard title="Max Drawdown" value={focusedBacktestMetrics.max_drawdown} formatter={v => `${v.toFixed(2)}%`} tooltip="The largest peak-to-trough decline in account equity."/>
                    </>
                ) : (
                    <>
                        <StatCard title="Total P&L" value={backtestMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Aggregate profit and loss from all backtests in this session."/>
                        <StatCard title="Win Rate" value={backtestMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The average win rate across all backtests in this session."/>
                        <StatCard title="Total Trades" value={backtestMetrics.trades} formatter={v => v.toFixed(0)} tooltip="Total number of trades executed across all backtests."/>
                        <StatCard title="Total Runs" value={backtestMetrics.runs} formatter={v => v.toFixed(0)} tooltip="Total backtests completed in this session."/>
                    </>
                )
            ) : (
                <>
                    <StatCard title="Total P&L" value={liveMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Total profit and loss from your copied live trades."/>
                    <StatCard title="Win Rate" value={liveMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The percentage of your copied trades that were profitable."/>
                    <StatCard title="Closed Trades" value={liveMetrics.trades} formatter={v => v.toFixed(0)} tooltip="Total number of copied trades that have been closed."/>
                    <StatCard title="Active Copies" value={liveMetrics.activeCount} formatter={v => v.toFixed(0)} tooltip="Number of trades currently open in your journal."/>
                </>
            )}
        </div>
      </div>
      <div className="h-64 p-4">
         {displayPnlHistory.length > 1 ? (
            <AnalyticsChart data={displayPnlHistory} baseline={1000} />
         ) : (
            <div className="flex items-center justify-center h-full text-text-muted">
                {isBacktestTab ? 'Run a backtest to see results.' : 'Copy trades to see live performance.'}
            </div>
         )}
      </div>
      {focusedBacktestMetrics && focusedBacktestMetrics.tradeLog && (
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
             <ListBulletIcon className="w-5 h-5 text-text-secondary" />
            <h3 className="font-semibold text-text-primary">Focused Run: Trade Log ({focusedBacktestMetrics.tradeLog.length} trades)</h3>
          </div>
          <BacktestTradeLog trades={focusedBacktestMetrics.tradeLog} />
        </div>
      )}
    </div>
  );
};