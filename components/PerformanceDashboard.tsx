import React, { useMemo, useState } from 'react';
import type { CopiedTrade, BacktestRun, PnlDataPoint } from '../types';
import { AnalyticsChart } from './AnalyticsChart';
import { AnimatedNumber } from './AnimatedNumber';
import { ChartIcon, XMarkIcon } from './icons';
import { Tooltip } from './Tooltip';

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
    avgPnlPerTrade?: number;
    runs?: number;
    profit_factor?: number;
    max_drawdown?: number;
}

const StatCard: React.FC<{ title: string; value: number | undefined; formatter: (val: number) => string; tooltip: string }> = ({ title, value, formatter, tooltip }) => (
  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
     <Tooltip content={tooltip}>
        <h3 className="text-xs font-medium text-slate-400 truncate cursor-help border-b border-dashed border-transparent hover:border-slate-500">{title}</h3>
     </Tooltip>
    <p className="text-xl font-semibold text-slate-100 tracking-tight mt-1">
      {value !== undefined && !isNaN(value) ? <AnimatedNumber value={value} formatter={formatter} /> : '-'}
    </p>
  </div>
);

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ copiedTrades, sessionBacktestRuns, activeBacktest, onClearActiveBacktest }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

  const liveMetrics: DisplayMetrics = useMemo(() => {
    const closedTrades = copiedTrades.filter(t => t.status === 'closed' && t.pnl != null);
    if (closedTrades.length === 0) return { pnl: 0, winRate: 0, trades: 0, pnlHistory: [], avgPnlPerTrade: 0 };
    
    let cumulativePnl = 0;
    const pnlHistory = closedTrades
        .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
        .map(trade => {
            cumulativePnl += trade.pnl ?? 0;
            return { date: new Date(trade.executed_at).toLocaleDateString(), pnl: cumulativePnl };
        });
        
    const totalPnl = pnlHistory.length > 0 ? pnlHistory[pnlHistory.length - 1].pnl : 0;
    const winRate = (closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100;
    const avgPnlPerTrade = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
    
    return { pnl: totalPnl, winRate, pnlHistory, trades: closedTrades.length, avgPnlPerTrade };
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
        // Fix: Removed `as any` cast as `params` is now typed as `any`.
        fileName: activeBacktest.params?.symbol || 'Focused Run'
    };
  }, [activeBacktest]);
  
  const isBacktestTab = activeTab === 'backtest';
  const displayPnlHistory = (isBacktestTab ? (focusedBacktestMetrics || backtestMetrics) : liveMetrics).pnlHistory;
  const cardTitle = isBacktestTab ? (focusedBacktestMetrics ? `Focused: ${focusedBacktestMetrics.fileName}` : 'Backtest Session') : 'Live Signals';

  const renderCards = () => {
    if(isBacktestTab) {
        if(focusedBacktestMetrics) {
            return (
                <>
                    <StatCard title="Total P&L" value={focusedBacktestMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Total profit and loss from this run."/>
                    <StatCard title="Win Rate" value={focusedBacktestMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The percentage of trades that were profitable."/>
                    <StatCard title="Profit Factor" value={focusedBacktestMetrics.profit_factor} formatter={v => v.toFixed(2)} tooltip="Gross profit divided by gross loss."/>
                    <StatCard title="Max Drawdown" value={focusedBacktestMetrics.max_drawdown} formatter={v => `${v.toFixed(2)}%`} tooltip="The largest peak-to-trough decline in account equity."/>
                </>
            );
        } else {
            return (
                <>
                    <StatCard title="Total P&L" value={backtestMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Aggregate profit and loss from all backtests in this session."/>
                    <StatCard title="Win Rate" value={backtestMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The average win rate across all backtests in this session."/>
                    <StatCard title="Total Trades" value={backtestMetrics.trades} formatter={v => v.toFixed(0)} tooltip="Total number of trades executed across all backtests."/>
                    <StatCard title="Total Runs" value={backtestMetrics.runs} formatter={v => v.toFixed(0)} tooltip="Total backtests completed in this session."/>
                </>
            );
        }
    } else {
        return (
             <>
                <StatCard title="Total P&L" value={liveMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Total profit and loss from your copied live trades."/>
                <StatCard title="Win Rate" value={liveMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The percentage of your copied trades that were profitable."/>
                <StatCard title="Total Trades" value={liveMetrics.trades} formatter={v => v.toFixed(0)} tooltip="Total number of copied trades that have been closed."/>
                <StatCard title="Avg P&L / Trade" value={liveMetrics.avgPnlPerTrade} formatter={v => `$${v.toFixed(2)}`} tooltip="The average profit or loss for each closed trade."/>
             </>
        );
    }
  };

  return (
    <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
      <div className="p-4 border-b border-border-color flex items-center justify-between">
         <div className="flex items-center">
            <ChartIcon className="w-6 h-6 mr-3 text-brand-accent" />
            <h2 className="text-lg font-semibold text-slate-100">Performance Analytics</h2>
         </div>
         <div className="flex items-center bg-slate-800/50 rounded-md p-1 border border-slate-700/50">
             <button onClick={() => setActiveTab('live')} className={`px-3 py-1 text-sm rounded ${activeTab === 'live' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}>Live</button>
             <button onClick={() => setActiveTab('backtest')} className={`px-3 py-1 text-sm rounded ${activeTab === 'backtest' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'}`}>Backtests</button>
         </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-200">{cardTitle}</h3>
            {focusedBacktestMetrics && (
                <button onClick={onClearActiveBacktest} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white">
                    <XMarkIcon className="w-4 h-4"/> Return to Aggregate
                </button>
            )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {renderCards()}
        </div>
      </div>
      <div className="h-64 p-4">
         {displayPnlHistory.length > 1 ? (
            <AnalyticsChart data={displayPnlHistory} />
         ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
                {isBacktestTab ? 'Run a backtest to see results.' : 'Copy trades to see live performance.'}
            </div>
         )}
      </div>
    </div>
  );
};