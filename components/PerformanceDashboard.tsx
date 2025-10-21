import React, { useState, useMemo } from 'react';
import type { PerformanceMetrics, PnlDataPoint, BacktestRun } from '../types';
import { AnalyticsChart } from './AnalyticsChart';
import { ChartIcon, DollarIcon, PercentIcon, LatencyIcon, UserIcon, BacktestIcon, SignalIcon, XCircleIcon } from './icons';
import { Tooltip } from './Tooltip';
import { AnimatedNumber } from './AnimatedNumber';

interface SessionPerformanceMetrics {
  total_pnl: number;
  avg_win_rate: number;
  total_trades: number;
  run_count: number;
}

interface PerformanceDashboardProps {
  liveMetrics: PerformanceMetrics;
  livePnlHistory: PnlDataPoint[];
  userPnl: number | null;
  sessionRuns: BacktestRun[];
  loading: boolean;
  activeBacktest: BacktestRun | null;
  onClearActiveBacktest: () => void;
}

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; tooltip: string; formatter: (value: number) => string; }> = ({ title, value, icon, tooltip, formatter }) => (
  <div className="bg-container-bg p-4 rounded-lg border border-border-color">
    <div className="flex items-center">
      <div className="text-slate-500 mr-3">{icon}</div>
      <Tooltip content={tooltip}>
        <p className="text-sm text-slate-400 font-medium cursor-help">{title}</p>
      </Tooltip>
    </div>
    <p className="text-2xl font-semibold text-slate-100 mt-2 font-mono">
        <AnimatedNumber value={value} formatter={formatter} />
    </p>
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

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ liveMetrics, livePnlHistory, userPnl, sessionRuns, loading, activeBacktest, onClearActiveBacktest }) => {
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
  
  const sessionMetrics = useMemo((): SessionPerformanceMetrics => {
    if (!sessionRuns || sessionRuns.length === 0) {
        return { total_pnl: 0, avg_win_rate: 0, total_trades: 0, run_count: 0 };
    }
    const totalPnl = sessionRuns.reduce((acc, b) => acc + (b.metrics?.total_pnl || 0), 0);
    const totalWinRate = sessionRuns.reduce((acc, b) => acc + (b.metrics?.win_rate || 0), 0);
    const totalTrades = sessionRuns.reduce((acc, b) => acc + (b.metrics?.total_trades || 0), 0);

    return {
        total_pnl: totalPnl,
        avg_win_rate: totalWinRate / sessionRuns.length,
        total_trades: totalTrades,
        run_count: sessionRuns.length,
    };
  }, [sessionRuns]);

  const sessionPnlHistory = useMemo((): PnlDataPoint[] => {
      if (!sessionRuns || sessionRuns.length === 0) return [];

      const sortedRuns = [...sessionRuns].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
      
      return sortedRuns.reduce((acc, run, index) => {
          const lastPnl = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
          const runPnl = run.metrics?.total_pnl || 0;
          acc.push({ date: `Run ${index + 1}`, pnl: lastPnl + runPnl });
          return acc;
      }, [] as PnlDataPoint[]);
  }, [sessionRuns]);


  const renderBacktestView = () => {
    if (activeBacktest) {
        const metrics = activeBacktest.metrics;
        return (
             <div className="p-4 animate-fade-in-up">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-md font-semibold text-slate-200 truncate" title={activeBacktest.strategy}>Focused Run: <span className="text-brand-accent">{activeBacktest.strategy}</span></h3>
                     <button onClick={onClearActiveBacktest} className="flex items-center text-xs text-slate-400 hover:text-white transition-colors">
                         <XCircleIcon className="w-4 h-4 mr-1"/>
                         Return to Aggregate
                     </button>
                 </div>
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
                    <StatCard title="Total P&L" value={metrics?.total_pnl ?? 0} formatter={v => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The net profit or loss from this specific backtest run." />
                    <StatCard title="Win Rate" value={metrics?.win_rate ?? 0} formatter={v => `${v.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The percentage of trades in this run that were closed with a profit." />
                    <StatCard title="Total Trades" value={metrics?.total_trades ?? 0} formatter={v => v.toLocaleString()} icon={<ChartIcon className="w-5 h-5"/>} tooltip="The total number of simulated trades executed in this run." />
                    <StatCard title="Profit Factor" value={metrics?.profit_factor ?? 0} formatter={v => v.toFixed(2)} icon={<BacktestIcon className="w-5 h-5"/>} tooltip="Gross profit divided by gross loss for this run. A value above 1 indicates profitability." />
                </div>
                <div className="h-80">
                    <AnalyticsChart data={metrics?.pnl_history || []} />
                </div>
             </div>
        )
    }
    
    // Default aggregated session view
    return (
        <div className="p-4 animate-fade-in-up">
            <h3 className="text-md font-semibold text-slate-200 mb-4">Current Backtest Session Aggregate</h3>
            {sessionRuns.length === 0 ? (
                 <div className="h-96 flex items-center justify-center text-slate-400">
                    <p>Run a new backtest session to see aggregate results here.</p>
                </div>
            ) : (
                <>
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
                    <StatCard title="Session P&L" value={sessionMetrics.total_pnl} formatter={v => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The sum of the profit or loss from all runs in this session."/>
                    <StatCard title="Avg. Win Rate" value={sessionMetrics.avg_win_rate} formatter={v => `${v.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The average win rate across all completed runs in this session."/>
                    <StatCard title="Total Trades" value={sessionMetrics.total_trades} formatter={v => v.toLocaleString()} icon={<ChartIcon className="w-5 h-5"/>} tooltip="The total number of simulated trades across all runs in this session."/>
                    <StatCard title="Completed Runs" value={sessionMetrics.run_count} formatter={v => v.toLocaleString()} icon={<BacktestIcon className="w-5 h-5"/>} tooltip="The total number of backtest files successfully processed in this session."/>
                </div>
                 <div className="h-80">
                    <AnalyticsChart data={sessionPnlHistory} />
                </div>
                </>
            )}
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
                <StatCard title="Global P&L" value={liveMetrics.total_pnl} formatter={(v) => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} tooltip="The net profit or loss from all closed trades copied by all users."/>
                {userPnl !== null && (
                    <StatCard title="My P&L" value={userPnl} formatter={(v) => `$${v.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<UserIcon className="w-5 h-5"/>} tooltip="Your personal profit or loss from the trades you have copied."/>
                )}
                <StatCard title="Win Rate" value={liveMetrics.win_rate} formatter={v => `${v.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The percentage of all copied trades that were closed with a profit."/>
                <StatCard title="Max Drawdown" value={liveMetrics.max_drawdown} formatter={v => `${v.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} tooltip="The largest peak-to-trough decline in account equity, based on a sample account."/>
                <StatCard title="Avg. Latency" value={liveMetrics.latency_ms} formatter={v => `${v.toFixed(0)}ms`} icon={<LatencyIcon className="w-5 h-5"/>} tooltip="The average time between signal generation and when it appears in the feed."/>
                </div>
            )}
            <div className="h-80">
            {loading ? (
                <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse"></div>
            ) : (
                <AnalyticsChart data={livePnlHistory} />
            )}
            </div>
        </div>
      )}

      {activeTab === 'backtest' && renderBacktestView()}

    </div>
  );
};