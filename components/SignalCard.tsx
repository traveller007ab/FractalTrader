
import React from 'react';
import type { Signal } from '../types';
import { CopyIcon } from './icons';

interface SignalCardProps {
  signal: Signal;
  onCopyTrade: (signal: Signal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onCopyTrade }) => {
  const sideColor = signal.side === 'buy' ? 'text-emerald-400' : 'text-red-400';
  const confidenceColor = signal.confidence > 0.75 ? 'text-emerald-400' : signal.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <tr className="hover:bg-slate-700/50 transition-colors duration-150">
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-white">{signal.symbol}</div>
        <div className="text-xs text-slate-400">{signal.exchange}</div>
      </td>
      <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold uppercase ${sideColor}`}>{signal.side}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{signal.price.toFixed(2)}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{signal.stop_loss.toFixed(2)}</td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{signal.take_profit.toFixed(2)}</td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
            <div className="w-16 bg-slate-700 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${signal.confidence * 100}%` }}></div>
            </div>
            <span className={`ml-3 text-sm font-medium ${confidenceColor}`}>{ (signal.confidence * 100).toFixed(0) }%</span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-center">
        <button 
          onClick={() => onCopyTrade(signal)}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 transition-colors"
        >
          <CopyIcon className="w-4 h-4 mr-2" />
          Copy
        </button>
      </td>
    </tr>
  );
};
