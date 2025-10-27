import React, { useState, useEffect, useMemo } from 'react';
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

const SignalCardComponent: React.FC<SignalCardProps> = ({ signal, onCopyTrade, copiedTrades, user, isNew }) => {
  const copiedTrade = useMemo(() => copiedTrades.find(t => t.signal_id === signal.signal_id && t.user_id === user.id), [copiedTrades, signal.signal_id, user.id]);

  const [isExpired, setIsExpired] = useState(() => {
    // A signal is only considered expired for styling if it hasn't been copied and is over an hour old.
    return !copiedTrade && (Date.now() - new Date(signal.timestamp).getTime()) > 3600000;
  });

  useEffect(() => {
    if (copiedTrade) {
      // If a trade is copied, it can't be considered expired for styling purposes.
      setIsExpired(false);
      return;
    }
    
    const signalTime = new Date(signal.timestamp).getTime();
    const expiryTime = signalTime + 3600000; // 1 hour in ms
    const timeUntilExpiry = expiryTime - Date.now();

    if (timeUntilExpiry > 0) {
      // The signal is still active, set a timer to update its state when it expires.
      setIsExpired(false); // Ensure it's not expired initially
      const timer = setTimeout(() => {
        setIsExpired(true);
      }, timeUntilExpiry);
      
      // Cleanup the timer if the component unmounts or props change.
      return () => clearTimeout(timer);
    } else {
      // The signal was already expired on mount.
      setIsExpired(true);
    }
  }, [signal.timestamp, copiedTrade]); // Rerun effect if the signal or copied status changes.
  
  const getStatus = (): { text: string; color: string; bg: string } => {
    if (copiedTrade) {
        if (copiedTrade.status === 'closed') {
            return (copiedTrade.pnl ?? 0) >= 0 
                ? { text: 'Win', color: 'text-success', bg: 'bg-success/20' }
                : { text: 'Loss', color: 'text-danger', bg: 'bg-danger/20' };
        }
        return { text: 'Copied', color: 'text-accent', bg: 'bg-accent/20' };
    }
    return isExpired
      ? { text: 'Expired', color: 'text-text-muted', bg: 'bg-text-muted/20' }
      : { text: 'Active', color: 'text-amber-500', bg: 'bg-amber-500/20' };
  };

  const status = getStatus();

  const formatPrice = (price: number) => {
      if (typeof price !== 'number' || isNaN(price)) {
        return 'N/A';
      }
      return price.toFixed(price > 100 ? 2 : 4);
  };
  
  const formatConfidence = (confidence: number) => {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
        return <span className="text-text-muted">--%</span>;
    }
    const percentage = (confidence * 100).toFixed(1);
    const color = confidence > 0.75 ? 'text-success' : confidence > 0.60 ? 'text-amber-500' : 'text-text-muted';
    return <span className={color}>{percentage}%</span>;
  }
  
  const rowClass = isNew ? 'new-signal-row' : isExpired ? 'expired-signal-row' : '';

  return (
    <tr className={rowClass}>
      <td className="pl-4 pr-3 py-3 text-sm font-medium text-text-primary whitespace-nowrap">{signal.symbol}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">{new Date(signal.timestamp).toLocaleTimeString()}</td>
      <td className={`px-3 py-3 text-sm font-semibold whitespace-nowrap ${signal.side === 'buy' ? 'text-success' : 'text-danger'}`}>{signal.side.toUpperCase()}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">{formatPrice(signal.price)}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">{formatPrice(signal.stop_loss)}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono">{formatPrice(signal.take_profit)}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono text-center">{formatConfidence(signal.confidence)}</td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.bg} ${status.color}`}>
            {status.text}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        <Tooltip content={copiedTrade ? "You've already copied this trade" : "Copy this trade to your journal"}>
            <button
            onClick={() => onCopyTrade(signal)}
            disabled={!!copiedTrade}
            className="inline-flex items-center p-2 border border-border text-xs font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <CopyIcon className="w-4 h-4" />
            </button>
        </Tooltip>
      </td>
    </tr>
  );
};

// Memoize the component to prevent unnecessary re-renders based on prop changes.
// The component's internal state now handles time-based updates.
const areEqual = (prevProps: SignalCardProps, nextProps: SignalCardProps) => {
    if (prevProps.signal.signal_id !== nextProps.signal.signal_id || prevProps.isNew !== nextProps.isNew) {
        return false;
    }
    const prevCopied = prevProps.copiedTrades.find(t => t.signal_id === prevProps.signal.signal_id);
    const nextCopied = nextProps.copiedTrades.find(t => t.signal_id === nextProps.signal.signal_id);

    return prevCopied?.status === nextCopied?.status && prevCopied?.pnl === nextCopied?.pnl;
};

export const SignalCard = React.memo(SignalCardComponent, areEqual);