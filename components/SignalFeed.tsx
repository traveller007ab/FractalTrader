import React, { useState, useEffect } from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { SignalCard } from './SignalCard.tsx';
// Fix: Add .tsx extension to icons import
import { RefreshIcon, SignalIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';

interface SignalFeedProps {
  signals: Signal[];
  onCopyTrade: (signal: Signal) => void;
  onRefresh: () => void;
  loading: boolean;
  copiedTrades: CopiedTrade[];
  user: User;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({ signals, onCopyTrade, onRefresh, loading, copiedTrades, user }) => {
  const [newSignalId, setNewSignalId] = useState<string | null>(null);
  
  useEffect(() => {
    if (signals.length > 0) {
        // Simple way to detect a new signal is just checking the first one
        const latestSignal = signals[0];
        if (latestSignal.signal_id !== newSignalId) {
            setNewSignalId(latestSignal.signal_id);
        }
    }
  }, [signals, newSignalId]);

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
        {signals.length > 0 ? (
            <table className="min-w-full divide-y divide-border-color">
            <thead className="bg-slate-900/50 sticky top-0 z-10">
                <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Symbol</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Side</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entry Price</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stop Loss</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Take Profit</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <Tooltip content="The bot's calculated confidence in this signal's success, based on multiple factors like volume and trend alignment.">
                        <span className="cursor-help border-b border-dashed border-slate-500">Confidence</span>
                    </Tooltip>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    <Tooltip content="Win/Loss is based on your copied trades. Active signals are recent. Expired signals are older than 1 hour and may no longer be relevant.">
                        <span className="cursor-help border-b border-dashed border-slate-500">Status</span>
                    </Tooltip>
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
                </tr>
            </thead>
            <tbody className="bg-container-bg divide-y divide-border-color">
                {signals.map(signal => (
                <SignalCard key={signal.signal_id} signal={signal} onCopyTrade={onCopyTrade} copiedTrades={copiedTrades} user={user} isNew={signal.signal_id === newSignalId} />
                ))}
            </tbody>
            </table>
        ) : (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
            <SignalIcon className="w-12 h-12 mb-4 text-slate-600" />
            <p className="font-semibold text-slate-400">{loading ? 'Loading Signals...' : 'Awaiting New Signals'}</p>
            <p className="text-sm mt-1">{loading ? 'Fetching latest data...' : 'The engine is running. New signals will appear here automatically.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};