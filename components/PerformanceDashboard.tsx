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

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-slate-800 p-4 rounded-lg flex items-center border border-slate-700">
    <div className={`p-3 rounded-full mr-4 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  </div>
);

const StatCardSkeleton: React.FC = () => (
    <div className="bg-slate-800 p-4 rounded-lg flex items-center border border-slate-700 animate-pulse">
        <div className="p-3 rounded-full mr-4 bg-slate-700 h-12 w-12"></div>
        <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-6 bg-slate-700 rounded w-1/2"></div>
        </div>
    </div>
);

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ metrics, pnlHistory, userPnl, loading }) => {
  const statCardCount = userPnl !== null ? 5 : 4;
  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg border border-slate-700">
       <div className="p-4 border-b border-slate-700 flex items-center">
        <ChartIcon className="w-6 h-6 mr-3 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">Performance Analytics</h2>
      </div>
      <div className="p-4">
        {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
        ) : (
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${statCardCount} gap-4 mb-6`}>
              <StatCard title="Total P&L (Global)" value={`$${metrics.total_pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<DollarIcon className="w-6 h-6 text-white"/>} color="bg-emerald-500/80" />
              {userPnl !== null && (
                 <StatCard title="My Copied P&L" value={`$${userPnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={<UserIcon className="w-6 h-6 text-white"/>} color="bg-indigo-500/80" />
              )}
              <StatCard title="Win Rate" value={`${metrics.win_rate.toFixed(1)}%`} icon={<PercentIcon className="w-6 h-6 text-white"/>} color="bg-sky-500/80" />
              <StatCard title="Max Drawdown" value={`${metrics.max_drawdown.toFixed(1)}%`} icon={<PercentIcon className="w-6 h-6 text-white"/>} color="bg-red-500/80" />
              <StatCard title="Avg. Latency" value={`${metrics.latency_ms}ms`} icon={<LatencyIcon className="w-6 h-6 text-white"/>} color="bg-yellow-500/80" />
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
