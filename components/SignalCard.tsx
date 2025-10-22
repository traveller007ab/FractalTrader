import React from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { CopyIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';

interface SignalCardProps {
  signal: Signal;
  onCopyTrade: (signal: Signal) => void;
  copiedTrades: CopiedTrade[];
  user: User;
  isNew: boolean;
}

const getStatus = (signal: Signal, copiedTrade?: CopiedTrade): { text: string; color: string } => {
    if (copiedTrade) {
        if (copiedTrade.status === 'closed') {
            return (copiedTrade.pnl ?? 0) >= 0 
                ? { text: 'Win', color: 'text-emerald-400' }
                : { text: 'Loss', color: 'text-red-400' };
        }
        return { text: 'Copied', color: 'text-sky-400' };
    }
    const signalAgeHours = (Date.now() - new Date(signal.timestamp).getTime()) / (1000 * 60 * 60);
    return signalAgeHours > 1 
      ? { text: 'Expired', color: 'text-slate-500' }
      : { text: 'Active', color: 'text-amber-400' };
};

const SignalCardComponent: React.FC<SignalCardProps> = ({ signal, onCopyTrade, copiedTrades, user, isNew }) => {
  const isBuy = signal.side === 'buy';
  const copiedTrade = copiedTrades.find(t => t.signal_id === signal.signal_id && t.user_id === user.id);
  const status = getStatus(signal, copiedTrade);

  const formatPrice = (price: number) => {
      if (typeof price !== 'number' || isNaN(price)) {
        return 'N/A';
      }
      return price.toFixed(price > 100 ? 2 : 4);
  };
  
  const formatConfidence = (confidence: number) => {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
        return <span className="text-slate-400">--%</span>;
    }
    const percentage = (confidence * 100).toFixed(1);
    const color = confidence > 0.75 ? 'text-emerald-400' : confidence > 0.60 ? 'text-amber-400' : 'text-slate-400';
    return <span className={color}>{percentage}%</span>;
  }
  
  const rowClass = isNew ? 'animate-highlight-fade' : '';

  return (
    <tr className={rowClass}>
      <td className="px-4 py-3 text-sm font-medium text-slate-200 whitespace-nowrap">{signal.symbol}</td>
      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">{new Date(signal.timestamp).toLocaleTimeString()}</td>
      <td className={`px-4 py-3 text-sm font-semibold whitespace-nowrap ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{signal.side.toUpperCase()}</td>
      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap font-mono">{formatPrice(signal.entry_price)}</td>
      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap font-mono">{formatPrice(signal.stop_loss)}</td>
      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap font-mono">{formatPrice(signal.take_profit)}</td>
      <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap font-mono text-center">{formatConfidence(signal.confidence)}</td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-opacity-20 ${status.color.replace('text-', 'bg-')} ${status.color}`}>
            {status.text}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <Tooltip content={copiedTrade ? "You've already copied this trade" : "Copy this trade to your journal"}>
            <button
            onClick={() => onCopyTrade(signal)}
            disabled={!!copiedTrade}
            className="inline-flex items-center p-2 border border-slate-700 text-xs font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <CopyIcon className="w-4 h-4" />
            </button>
        </Tooltip>
      </td>
    </tr>
  );
};

// Memoize the component to prevent unnecessary re-renders
const areEqual = (prevProps: SignalCardProps, nextProps: SignalCardProps) => {
    if (prevProps.signal.signal_id !== nextProps.signal.signal_id || prevProps.isNew !== nextProps.isNew) {
        return false;
    }
    const prevCopied = prevProps.copiedTrades.find(t => t.signal_id === prevProps.signal.signal_id);
    const nextCopied = nextProps.copiedTrades.find(t => t.signal_id === nextProps.signal.signal_id);

    return prevCopied?.status === nextCopied?.status && prevCopied?.pnl === nextCopied?.pnl;
};

export const SignalCard = React.memo(SignalCardComponent, areEqual);