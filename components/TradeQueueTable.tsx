import React from 'react';
import type { Signal } from '../types';
import { PlayIcon, InformationCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface TradeQueueTableProps {
    signals: Signal[];
    onExecute: (signal: Signal) => void;
    disabled: boolean;
}

export const TradeQueueTable: React.FC<TradeQueueTableProps> = ({ signals, onExecute, disabled }) => {
    
    const renderContent = () => {
        if (signals.length === 0) {
            return (
                <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-text-muted">
                         <InformationCircleIcon className="w-8 h-8 mx-auto mb-2" />
                        Awaiting new signals from the engine.
                    </td>
                </tr>
            );
        }
        return signals.map(signal => (
            <tr key={signal.signal_id} className="hover:bg-border/50">
                <td className="px-3 py-2 text-sm font-medium text-text-primary whitespace-nowrap">{signal.symbol}</td>
                <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${signal.side === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>{signal.side.toUpperCase()}</td>
                <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap font-mono">{((signal.confidence || 0) * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-sm">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-500/20 text-sky-400">
                        Pending
                    </span>
                </td>
                <td className="px-3 py-2 text-center">
                    <Tooltip content={disabled ? "Enable Manual mode to execute" : "Execute this trade now"}>
                        <button
                            onClick={() => onExecute(signal)}
                            disabled={disabled}
                            className="p-1.5 rounded-md text-text-muted hover:bg-emerald-500/20 hover:text-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlayIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                </td>
            </tr>
        ));
    };

    return (
        <div className="bg-bg-primary/50 dark:bg-slate-900/50 rounded-lg border border-border max-h-60 overflow-y-auto">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-bg-secondary/50 sticky top-0 backdrop-blur-sm">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Symbol</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Side</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Confidence</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Execute</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {renderContent()}
                </tbody>
            </table>
        </div>
    );
};