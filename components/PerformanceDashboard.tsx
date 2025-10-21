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

const StatCard: React.FC<{ title: string; value: number | undefined; formatter: (val: number) => string; tooltip: string }> = ({ title, value, formatter, tooltip }) => (
  <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
     <Tooltip content={tooltip}>
        <h3 className="text-xs font-medium text-slate-400 truncate cursor-help border-b border-dashed border-transparent hover:border-slate-500">{title}</h3>
     </Tooltip>
    <p className="text-xl font-semibold text-slate-100 tracking-tight mt-1">
      {value !== undefined ? <AnimatedNumber value={value} formatter={formatter} /> : '-'}
    </p>
  </div>
);

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ copiedTrades, sessionBacktestRuns, activeBacktest, onClearActiveBacktest }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

  const liveMetrics = useMemo(() => {
    const closedTrades = copiedTrades.filter(t => t.status === 'closed' && t.pnl != null);
    if (closedTrades.length === 0) return { pnl: 0, winRate: 0, pnlHistory: [] };
    
    let cumulativePnl = 0;
    const pnlHistory = closedTrades
        .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
        .map(trade => {
            cumulativePnl += trade.pnl ?? 0;
            return { date: new Date(trade.executed_at).toLocaleDateString(), pnl: cumulativePnl };
        });
        
    const totalPnl = pnlHistory.length > 0 ? pnlHistory[pnlHistory.length - 1].pnl : 0;
    const winRate = (closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length) * 100;
    
    return { pnl: totalPnl, winRate, pnlHistory };
  }, [copiedTrades]);

  const backtestMetrics = useMemo(() => {
    if (sessionBacktestRuns.length === 0) return { pnl: 0, winRate: 0, trades: 0, pnlHistory: [] };
    
    let cumulativePnl = 0;
    const pnlHistory: PnlDataPoint[] = [];
    let totalTrades = 0;
    let totalWins = 0;

    sessionBacktestRuns.forEach(run => {
        if(run.metrics?.pnl_history) {
            run.metrics.pnl_history.forEach(pnlPoint => {
                // This logic is simplified; a proper implementation would use a consistent time axis
                cumulativePnl += pnlPoint.pnl - (pnlHistory.length > 0 ? pnlHistory[pnlHistory.length -1].pnl : 0);
                 pnlHistory.push({ date: pnlPoint.date, pnl: cumulativePnl });
            });
        } else if (run.metrics) { // Fallback if no history
             cumulativePnl += run.metrics.total_pnl;
             pnlHistory.push({ date: new Date(run.ended_at).toLocaleDateString(), pnl: cumulativePnl });
        }
        
        totalTrades += run.metrics?.total_trades || 0;
        totalWins += (run.metrics?.total_trades || 0) * ((run.metrics?.win_rate || 0) / 100);
    });

    return {
        pnl: cumulativePnl,
        winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
        trades: totalTrades,
        runs: sessionBacktestRuns.length,
        pnlHistory
    };
  }, [sessionBacktestRuns]);
  
  const focusedBacktestMetrics = useMemo(() => {
    if (!activeBacktest || !activeBacktest.metrics) return null;
    const { metrics } = activeBacktest;
    return {
        ...metrics,
        fileName: (activeBacktest.params as any).symbol || 'Focused Run'
    };
  }, [activeBacktest]);
  
  const isBacktestTab = activeTab === 'backtest';
  const displayMetrics = isBacktestTab ? (focusedBacktestMetrics || backtestMetrics) : liveMetrics;
  const displayPnlHistory = isBacktestTab ? (focusedBacktestMetrics?.pnl_history || backtestMetrics.pnlHistory) : liveMetrics.pnlHistory;
  const cardTitle = isBacktestTab ? (focusedBacktestMetrics ? `Focused: ${focusedBacktestMetrics.fileName}` : 'Backtest Session') : 'Live Signals';

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
          <StatCard title="Total P&L" value={displayMetrics.pnl} formatter={v => `$${v.toFixed(2)}`} tooltip="Total profit and loss from this session."/>
          <StatCard title="Win Rate" value={displayMetrics.winRate} formatter={v => `${v.toFixed(1)}%`} tooltip="The percentage of trades that were profitable."/>
          {isBacktestTab && !focusedBacktestMetrics && <StatCard title="Total Runs" value={backtestMetrics.runs} formatter={v => v.toFixed(0)} tooltip="Total backtests completed in this session." />}
          {(isBacktestTab && focusedBacktestMetrics) && <StatCard title="Profit Factor" value={focusedBacktestMetrics.profit_factor} formatter={v => v.toFixed(2)} tooltip="Gross profit divided by gross loss." />}
          <StatCard title="Total Trades" value={isBacktestTab ? (focusedBacktestMetrics?.total_trades ?? backtestMetrics.trades) : copiedTrades.filter(t=>t.status==='closed').length} formatter={v => v.toFixed(0)} tooltip="Total number of closed trades in this session." />
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
