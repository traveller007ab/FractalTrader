import React from 'react';
import type { BacktestRun } from '../types';
import { BacktestIcon, PlayIcon } from './icons';

interface BacktestResultsProps {
  backtests: BacktestRun[];
  loading: boolean;
  onRunBacktest: () => void;
}

const BacktestCard: React.FC<{ run: BacktestRun }> = ({ run }) => {
    const pnl = run.metrics?.total_pnl ?? 0;
    return (
        <div className="bg-slate-800 p-3 rounded-md border border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-semibold text-white">{run.strategy}</p>
                    <p className="text-xs text-slate-400">
                        {new Date(run.started_at).toLocaleDateString()} - {new Date(run.ended_at).toLocaleDateString()}
                    </p>
                </div>
                <div className={`text-sm font-bold ${pnl > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${pnl.toFixed(2)}
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                    <p className="text-slate-400">Win Rate</p>
                    <p className="font-medium text-white">{run.metrics?.win_rate?.toFixed(1) ?? 'N/A'}%</p>
                </div>
                <div>
                    <p className="text-slate-400">Profit Factor</p>
                    <p className="font-medium text-white">{run.metrics?.profit_factor?.toFixed(2) ?? 'N/A'}</p>
                </div>
                <div>
                    <p className="text-slate-400">Drawdown</p>
                    <p className="font-medium text-white">{run.metrics?.max_drawdown?.toFixed(1) ?? 'N/A'}%</p>
                </div>
            </div>
        </div>
    );
};

const BacktestSkeleton: React.FC = () => (
    <div className="bg-slate-800 p-3 rounded-md border border-slate-700 animate-pulse">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-32"></div>
                <div className="h-3 bg-slate-700 rounded w-24"></div>
            </div>
            <div className="h-5 bg-slate-700 rounded w-16"></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
        </div>
    </div>
)

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtests, loading, onRunBacktest }) => {
  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center">
            <BacktestIcon className="w-6 h-6 mr-3 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Backtest Runs</h2>
        </div>
        <button 
            onClick={onRunBacktest}
            className="inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md shadow-sm text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 transition-colors"
        >
          <PlayIcon className="w-4 h-4 mr-2" />
          Run New Backtest
        </button>
      </div>
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {loading ? (
            <>
                <BacktestSkeleton />
                <BacktestSkeleton />
                <BacktestSkeleton />
            </>
        ) : (
          backtests.length > 0 ? (
            backtests.map(run => <BacktestCard key={run.id} run={run} />)
          ) : (
            <p className="text-center text-slate-400 py-4">No backtest results found.</p>
          )
        )}
      </div>
    </div>
  );
};
