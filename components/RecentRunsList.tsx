import React from 'react';
import type { BacktestRun } from '../types';
import { BeakerIcon } from './icons.tsx';

interface RecentRunsListProps {
  runs: BacktestRun[];
  onViewRun: (run: BacktestRun) => void;
}

export const RecentRunsList: React.FC<RecentRunsListProps> = ({ runs, onViewRun }) => {
    return (
        <div>
            <h3 className="text-md font-semibold text-slate-200 mb-3">Recent Backtest Runs</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {runs.length > 0 ? runs.map(run => (
                    <div key={run.id} className="bg-slate-800/50 p-2.5 rounded-md border border-slate-700/50 flex justify-between items-center animate-fade-in-up">
                        <div>
                            <p className="text-sm font-medium text-slate-200 truncate max-w-40" title={run.params?.symbol}>{run.params?.symbol}</p>
                            <p className="text-xs text-slate-400">{new Date(run.started_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                             <p className={`text-sm font-semibold ${run.metrics && run.metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {run.metrics ? `$${run.metrics.total_pnl.toFixed(2)}` : 'N/A'}
                            </p>
                            <button onClick={() => onViewRun(run)} className="text-xs text-brand-accent/80 hover:text-brand-accent">
                                View Details
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-sm text-slate-500 py-8 flex flex-col items-center">
                        <BeakerIcon className="w-10 h-10 mb-2 text-slate-600" />
                        No recent runs.
                    </div>
                )}
            </div>
        </div>
    );
};