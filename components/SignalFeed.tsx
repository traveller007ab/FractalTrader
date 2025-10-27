import React, { useState, useEffect } from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { SignalCard } from './SignalCard.tsx';
import { RefreshIcon, SignalIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';
import { SignalFeedSkeleton } from './SignalFeedSkeleton.tsx';

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

  const renderContent = () => {
    if (loading && signals.length === 0) {
        return <SignalFeedSkeleton />;
    }
    if (signals.length > 0) {
        return (
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-bg-secondary/80 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                    <th scope="col" className="pl-4 pr-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Symbol</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Time</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Side</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Entry Price</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Stop Loss</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Take Profit</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                        <Tooltip content="The bot's calculated confidence in this signal's success, based on multiple factors like volume and trend alignment.">
                            <span className="cursor-help border-b border-dashed border-text-muted/50">Confidence</span>
                        </Tooltip>
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                        <Tooltip content="Win/Loss is based on your copied trades. Active signals are recent. Expired signals are older than 1 hour and may no longer be relevant.">
                            <span className="cursor-help border-b border-dashed border-text-muted/50">Status</span>
                        </Tooltip>
                    </th>
                    <th scope="col" className="px-3 py-3 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-bg-secondary divide-y divide-border">
                    {signals.map(signal => (
                    <SignalCard key={signal.signal_id} signal={signal} onCopyTrade={onCopyTrade} copiedTrades={copiedTrades} user={user} isNew={signal.signal_id === newSignalId} />
                    ))}
                </tbody>
            </table>
        );
    }
    return (
        <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center">
            <SignalIcon className="w-12 h-12 mb-4" />
            <p className="font-semibold text-text-secondary">Awaiting New Signals</p>
            <p className="text-sm mt-1">The engine is running. New signals will appear here automatically.</p>
        </div>
    );
  };

  return (
    <div className="main-panel overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center">
          <SignalIcon className="w-6 h-6 mr-3 text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Live Signal Feed</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 border border-border text-xs font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          <RefreshIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="overflow-auto max-h-[32rem]">
        {renderContent()}
      </div>
    </div>
  );
};