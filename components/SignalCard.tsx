import React, { useState, useEffect, useMemo } from 'react';
import type { Signal, CopiedTrade } from '../types';
import type { User } from '@supabase/supabase-js';
import { CopyIcon, CheckIcon } from './icons.tsx';
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
    // Immediate check: if we copied it, it is NEVER expired for us.
    if (copiedTrade) return false;
    return (Date.now() - new Date(signal.timestamp).getTime()) > 3600000;
  });

  useEffect(() => {
    if (copiedTrade) {
      setIsExpired(false);
      return;
    }
    
    const signalTime = new Date(signal.timestamp).getTime();
    const expiryTime = signalTime + 3600000; // 1 hour in ms
    const timeUntilExpiry = expiryTime - Date.now();

    if (timeUntilExpiry > 0) {
      setIsExpired(false);
      const timer = setTimeout(() => {
        setIsExpired(true);
      }, timeUntilExpiry);
      return () => clearTimeout(timer);
    } else {
      setIsExpired(true);
    }
  }, [signal.timestamp, copiedTrade]);
  
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

  // Determine button styling state
  const isCopied = !!copiedTrade;
  const isOpen = copiedTrade?.status === 'open';

  let buttonClass = "inline-flex items-center p-2 border text-xs font-medium rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent";
  
  if (!isCopied) {
      // Default State
      buttonClass += " border-border text-text-secondary bg-bg-secondary hover:bg-accent/10 hover:border-accent/30 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed";
  } else if (isOpen) {
      // Active State (Open Trade) - Glowing Teal
      buttonClass += " border-accent bg-accent text-white shadow-[0_0_10px_hsl(var(--color-accent)/0.4)] hover:shadow-[0_0_15px_hsl(var(--color-accent)/0.6)] cursor-default"; 
  } else {
      // History State (Closed Trade) - Muted
      buttonClass += " border-border/50 bg-bg-secondary/50 text-text-muted opacity-60 cursor-default";
  }

  return (
    <tr className={rowClass}>
      <td className="pl-4 pr-2 py-3 text-sm font-medium text-text-primary whitespace-nowrap align-middle text-left">{signal.symbol}</td>
      <td className="px-2 py-3 text-sm text-text-secondary whitespace-nowrap font-mono align-middle text-left">{new Date(signal.timestamp).toLocaleTimeString()}</td>
      <td className={`px-1 py-3 text-sm font-semibold whitespace-nowrap text-center align-middle ${signal.side === 'buy' ? 'text-success' : 'text-danger'}`}>{signal.side.toUpperCase()}</td>
      
      {/* Prices are Right Aligned */}
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono text-right align-middle">{formatPrice(signal.price)}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono text-right align-middle">{formatPrice(signal.stop_loss)}</td>
      <td className="px-3 py-3 text-sm text-text-secondary whitespace-nowrap font-mono text-right align-middle">{formatPrice(signal.take_profit)}</td>
      
      {/* Metadata is Centered */}
      <td className="px-1 py-3 text-sm text-text-secondary whitespace-nowrap font-mono text-center align-middle">{formatConfidence(signal.confidence)}</td>
      <td className="px-1 py-3 text-sm whitespace-nowrap text-center align-middle">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.bg} ${status.color}`}>
            {status.text}
        </span>
      </td>
      <td className="px-3 py-3 text-center align-middle">
        <Tooltip content={copiedTrade ? (isOpen ? "Trade is active in your journal" : "Trade closed and journaled") : "Copy this trade to your journal"} position="bottom">
            <button
                onClick={() => !isCopied && onCopyTrade(signal)}
                disabled={isCopied}
                className={buttonClass}
            >
                {isCopied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
            </button>
        </Tooltip>
      </td>
    </tr>
  );
};

const areEqual = (prevProps: SignalCardProps, nextProps: SignalCardProps) => {
    if (prevProps.signal.signal_id !== nextProps.signal.signal_id || prevProps.isNew !== nextProps.isNew) {
        return false;
    }
    const prevCopied = prevProps.copiedTrades.find(t => t.signal_id === prevProps.signal.signal_id);
    const nextCopied = nextProps.copiedTrades.find(t => t.signal_id === nextProps.signal.signal_id);

    // Re-render if copy status or PnL changes (for open/closed check)
    return prevCopied?.status === nextCopied?.status && prevCopied?.pnl === nextCopied?.pnl;
};

export const SignalCard = React.memo(SignalCardComponent, areEqual);