import React from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { CopyIcon } from './icons';

interface SignalCardProps {
  signal: Signal;
  onCopyTrade: (signal: Signal) => void;
  copiedTrades: CopiedTrade[];
  user: User;
  isNew: boolean;
}

const formatPrice = (price: number): string => {
    return price.toFixed(2); // Standard for crypto, gold, etc.
};

const StatusBadge: React.FC<{ status: 'Win' | 'Loss' | 'Active' | 'Expired' }> = ({ status }) => {
    const statusStyles = {
        Win: 'bg-emerald-500/20 text-emerald-400',
        Loss: 'bg-red-500/20 text-red-400',
        Active: 'bg-sky-500/20 text-sky-400',
        Expired: 'bg-slate-500/20 text-slate-400',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status]}`}>{status}</span>;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onCopyTrade, copiedTrades, user, isNew }) => {
  const sideColor = signal.side === 'buy' ? 'text-emerald-500' : 'text-red-500';
  const confidenceColor = signal.confidence > 0.75 ? 'text-sky-400' : signal.confidence > 0.5 ? 'text-yellow-400' : 'text-orange-400';
  
  const userTrade = copiedTrades.find(t => t.signal_id === signal.id && t.user_id === user.id);
  const ageInMinutes = (Date.now() - new Date(signal.created_at).getTime()) / 60000;
  
  let status: 'Win' | 'Loss' | 'Active' | 'Expired';

  if (userTrade) {
      status = (userTrade.pnl ?? 0) > 0 ? 'Win' : 'Loss';
  } else if (ageInMinutes > 60) {
      status = 'Expired';
  } else {
      status = 'Active';
  }

  return (
    <tr className={`hover:bg-slate-800/60 transition-colors duration-150 ${isNew ? 'animate-highlight-fade' : ''}`}>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-slate-100">{signal.symbol}</div>
        <div className="text-xs text-slate-400">{signal.exchange}</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400 font-mono">
        {new Date(signal.created_at).toLocaleTimeString()}
      </td>
      <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold uppercase ${sideColor}`}>{signal.side}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-200 font-mono">{formatPrice(signal.price)}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-200 font-mono">{formatPrice(signal.stop_loss)}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-200 font-mono">{formatPrice(signal.take_profit)}</td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
            <div className="w-20 bg-slate-700 rounded-full h-1.5">
              <div className="bg-brand-accent h-1.5 rounded-full transition-all duration-500" style={{ width: `${signal.confidence * 100}%` }}></div>
            </div>
            <span className={`ml-3 text-sm font-medium font-mono ${confidenceColor}`}>{ (signal.confidence * 100).toFixed(0) }%</span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <button 
          onClick={() => onCopyTrade(signal)}
          disabled={!!userTrade}
          className="inline-flex items-center px-3 py-1.5 border border-slate-600 text-xs font-medium rounded-md shadow-sm text-slate-300 bg-slate-800 hover:bg-brand-accent hover:text-white hover:border-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:border-slate-700 disabled:hover:text-slate-300 disabled:hover:border-slate-700"
        >
          <CopyIcon className="w-4 h-4 mr-2" />
          {userTrade ? 'Copied' : 'Copy'}
        </button>
      </td>
    </tr>
  );
};