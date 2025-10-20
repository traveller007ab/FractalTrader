import React, { useState } from 'react';
import type { PerformanceMetrics, PnlDataPoint, BacktestRun } from '../types';
import { AnalyticsChart } from './AnalyticsChart';
import { ChartIcon, DollarIcon, PercentIcon, LatencyIcon, UserIcon, BacktestIcon, SignalIcon, XCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface BacktestPerformanceMetrics {
  total_pnl: number;
  avg_win_rate: number;
  total_trades: number;
  run_count: number;
}

interface PerformanceDashboardProps {
  metrics: PerformanceMetrics;
  pnlHistory: PnlDataPoint[];
  userPnl: number | null;
  backtestMetrics: BacktestPerformanceMetrics;
  backtestPnlHistory: PnlDataPoint[];
  loading: boolean;
  activeBacktest: BacktestRun | null;
  onClearActiveBacktest: () => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; tooltip: string; }> = ({ title, value, icon, tooltip }) => (
  <div className="bg-container-bg p-4 rounded-lg border border-border-color">
    <div className="flex items-center">
      <div className="text-slate-500 mr-3">{icon}</div>
      <Tooltip content={tooltip}>
        <p className="text-sm text-slate-400 font-medium cursor-help">{title}</p>
      </Tooltip>
    </div>
    <p className="text-2xl font-semibold text-slate-100 mt-2 font-mono">{value}</p>
  </div>
);

const StatCardSkeleton: React.FC = () => (
    <div className="bg-container-bg p-4 rounded-lg border border-border-color animate-pulse">
        <div className="flex items-center">
            <div className="h-5 w-5 bg-slate-700 rounded mr-3"></div>
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
        </div>
        <div className="h-7 bg-slate-700 rounded w-1/2 mt-2"></div>
    </div>
);

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ metrics, pnlHistory, userPnl, backtestMetrics, backtestPnlHistory, loading, activeBacktest, onClearActiveBacktest }) => {
  const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

  const liveStatCardCount = userPnl !== null ? 5 : 4;
  
  const TabButton: React.FC<{ tab: 'live' | 'backtest', children: React.ReactNode, icon: React.ReactNode }> = ({ tab, children, icon }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        activeTab === tab 
          ? 'bg-brand-accent/20 text-brand-accent' 
          : 'text-slate-400 hover:bg-slate-800'
      }`}
    >
      {icon}
      {children}
    </button>
  );

  const renderBacktestView = () => {
    if (activeBacktest) {
        const metrics = activeBacktest.metrics;
        return (
             <div className="p-4 animate-fade-in-up">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-md font-semibold text-slate-200 truncate" title={activeBacktest.strategy}>Focused Run: <span className="text-brand-accent">{activeBacktest.strategy}</span></h3>
                     <button onClick={onClearActiveBacktest} className="flex items-center text-xs text-slate-400 hover:text-white transition-colors">
                         <XCircleIcon className="w-4 h-4 mr-1"/>
                         Show Aggregate
                     </button>
                 </div>
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
                    <StatCard title="Total P&L" value={`$${metrics?.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) ?? '0.00'}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The net profit or loss from this specific backtest run." />
                    <StatCard title="Win Rate" value={`${metrics?.win_rate.toFixed(1) ?? '0.0'}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The percentage of trades in this run that were closed with a profit." />
                    <StatCard title="Total Trades" value={metrics?.total_trades.toLocaleString() ?? '0'} icon={<ChartIcon className="w-5 h-5"/>} tooltip="The total number of simulated trades executed in this run." />
                    <StatCard title="Profit Factor" value={metrics?.profit_factor.toFixed(2) ?? '0.00'} icon={<BacktestIcon className="w-5 h-5"/>} tooltip="Gross profit divided by gross loss for this run. A value above 1 indicates profitability." />
                </div>
                <div className="h-80">
                    <AnalyticsChart data={metrics?.pnl_history || []} />
                </div>
             </div>
        )
    }
    
    // Default aggregated view
    return (
        <div className="p-4 animate-fade-in-up">
            <h3 className="text-md font-semibold text-slate-200 mb-4">Aggregate of All Backtest Runs</h3>
            {loading ? (
                 <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
                    {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
            ) : (
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
                    <StatCard title="Total Backtest P&L" value={`$${backtestMetrics.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The sum of the profit or loss from all your backtest runs."/>
                    <StatCard title="Avg. Win Rate" value={`${backtestMetrics.avg_win_rate.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The average win rate across all your completed backtest runs."/>
                    <StatCard title="Total Trades" value={backtestMetrics.total_trades.toLocaleString()} icon={<ChartIcon className="w-5 h-5"/>} tooltip="The total number of simulated trades across all backtest runs."/>
                    <StatCard title="Total Runs" value={backtestMetrics.run_count.toLocaleString()} icon={<BacktestIcon className="w-5 h-5"/>} tooltip="The total number of backtest files you have successfully processed."/>
                </div>
            )}
             <div className="h-80">
            {loading ? (
                <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse"></div>
            ) : (
                <AnalyticsChart data={backtestPnlHistory} />
            )}
            </div>
         </div>
    );
  }

  return (
    <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
       <div className="p-4 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center">
            <ChartIcon className="w-6 h-6 mr-3 text-brand-accent" />
            <h2 className="text-lg font-semibold text-slate-100">Performance Analytics</h2>
        </div>
        <div className="flex items-center space-x-2 p-1 bg-slate-950 rounded-lg">
            <TabButton tab="live" icon={<SignalIcon className="w-5 h-5 mr-2" />}>Live Signals</TabButton>
            <TabButton tab="backtest" icon={<BacktestIcon className="w-5 h-5 mr-2" />}>Backtests</TabButton>
        </div>
      </div>

      {activeTab === 'live' && (
        <div className="p-4 animate-fade-in-up">
            <h3 className="text-md font-semibold text-slate-200 mb-4">Live Copied Signals Performance</h3>
            {loading ? (
                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6`}>
                    {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
                </div>
            ) : (
                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${liveStatCardCount} gap-4 mb-6`}>
                <StatCard title="Global P&L" value={`$${metrics.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The net profit or loss from all closed trades copied by all users."/>
                {userPnl !== null && (
                    <StatCard title="My P&L" value={`$${userPnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<UserIcon className="w-5 h-5"/>} tooltip="Your personal profit or loss from the trades you have copied."/>
                )}
                <StatCard title="Win Rate" value={`${metrics.win_rate.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The percentage of all copied trades that were closed with a profit."/>
                <StatCard title="Max Drawdown" value={`${metrics.max_drawdown.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The largest peak-to-trough decline in account equity, based on a sample account."/>
                <StatCard title="Avg. Latency" value={`${metrics.latency_ms}ms`} icon={<LatencyIcon className="w-5 h-5"/>} tooltip="The average time between signal generation and when it appears in the feed."/>
                </div>
            )}
            <div className="h-80">
            {loading ? (
                <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse"></div>
            ) : (
                <AnalyticsChart data={pnlHistory} />
            )}
            </div>
        </div>
      )}

      {activeTab === 'backtest' && renderBacktestView()}

    </div>
  );
};