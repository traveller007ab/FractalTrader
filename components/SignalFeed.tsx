
import React from 'react';
import type { Signal } from '../types';
import { SignalCard } from './SignalCard';
import { SignalIcon } from './icons';

interface SignalFeedProps {
  signals: Signal[];
  onCopyTrade: (signal: Signal) => void;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({ signals, onCopyTrade }) => {
  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg overflow-hidden border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center">
        <SignalIcon className="w-6 h-6 mr-3 text-emerald-400" />
        <h2 className="text-lg font-semibold text-white">Live Signal Feed</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Symbol</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Side</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entry Price</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stop Loss</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Take Profit</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Confidence</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800/50 divide-y divide-slate-700">
            {signals.map(signal => (
              <SignalCard key={signal.id} signal={signal} onCopyTrade={onCopyTrade} />
            ))}
          </tbody>
        </table>
        {signals.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            <p>Awaiting new signals...</p>
          </div>
        )}
      </div>
    </div>
  );
};
