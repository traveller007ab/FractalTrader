import React from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { SignalCard } from './SignalCard';
import { RefreshIcon, SignalIcon } from './icons';

interface SignalFeedProps {
  signals: Signal[];
  onCopyTrade: (signal: Signal) => void;
  onRefresh: () => void;
  loading: boolean;
  copiedTrades: CopiedTrade[];
  user: User;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({ signals, onCopyTrade, onRefresh, loading, copiedTrades, user }) => {
  return (
    <div className="bg-container-bg rounded-lg shadow-lg overflow-hidden border border-border-color">
      <div className="p-4 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center">
          <SignalIcon className="w-6 h-6 mr-3 text-brand-accent" />
          <h2 className="text-lg font-semibold text-slate-100">Live Signal Feed</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 border border-slate-700 text-xs font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="overflow-auto max-h-[32rem]">
        <table className="min-w-full divide-y divide-border-color">
          <thead className="bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Symbol</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Side</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entry Price</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stop Loss</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Take Profit</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Confidence</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-container-bg divide-y divide-border-color">
            {signals.map(signal => (
              <SignalCard key={signal.id} signal={signal} onCopyTrade={onCopyTrade} copiedTrades={copiedTrades} user={user} />
            ))}
          </tbody>
        </table>
        {signals.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <p>{loading ? 'Loading...' : 'Awaiting new signals...'}</p>
          </div>
        )}
      </div>
    </div>
  );
};