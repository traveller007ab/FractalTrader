import React from 'react';
import type { PerformanceMetrics, PnlDataPoint } from '../types';
import { AnalyticsChart } from './AnalyticsChart';
import { ChartIcon, DollarIcon, PercentIcon, LatencyIcon, UserIcon } from './icons';

interface PerformanceDashboardProps {
  metrics: PerformanceMetrics;
  pnlHistory: PnlDataPoint[];
  userPnl: number | null;
  loading: boolean;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
  <div className="bg-container-bg p-4 rounded-lg border border-border-color">
    <div className="flex items-center">
      <div className="text-slate-500 mr-3">{icon}</div>
      <p className="text-sm text-slate-400 font-medium">{title}</p>
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

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ metrics, pnlHistory, userPnl, loading }) => {
  const statCardCount = userPnl !== null ? 5 : 4;
  
  const pnlColor = metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const userPnlColor = userPnl !== null && userPnl >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
       <div className="p-4 border-b border-border-color flex items-center">
        <ChartIcon className="w-6 h-6 mr-3 text-brand-accent" />
        <h2 className="text-lg font-semibold text-slate-100">Performance Analytics</h2>
      </div>
      <div className="p-4">
        {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
        ) : (
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${statCardCount} gap-4 mb-6`}>
              <StatCard title="Global P&L" value={`$${metrics.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-5 h-5"/>} />
              {userPnl !== null && (
                 <StatCard title="My P&L" value={`$${userPnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<UserIcon className="w-5 h-5"/>} />
              )}
              <StatCard title="Win Rate" value={`${metrics.win_rate.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} />
              <StatCard title="Max Drawdown" value={`${metrics.max_drawdown.toFixed(1)}%`} icon={<PercentIcon className="w-5 h-5"/>} />
              <StatCard title="Avg. Latency" value={`${metrics.latency_ms}ms`} icon={<LatencyIcon className="w-5 h-5"/>} />
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
    </div>
  );
};