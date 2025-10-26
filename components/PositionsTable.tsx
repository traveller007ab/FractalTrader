import React from 'react';
import type { LivePosition } from '../types';
import { XMarkIcon, InformationCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface PositionsTableProps {
    positions: LivePosition[];
    onClose: (positionId: string) => void;
    loading: boolean;
}

const SkeletonRow: React.FC = () => (
    <tr className="animate-shimmer" style={{ background: 'linear-gradient(to right, hsl(var(--color-bg-primary)) 4%, hsl(var(--color-border)) 25%, hsl(var(--color-bg-primary)) 36%)', backgroundSize: '1000px 100%' }}>
        <td className="px-3 py-3"><div className="h-4 bg-border rounded w-20"></div></td>
        <td className="px-3 py-3"><div className="h-4 bg-border rounded w-12"></div></td>
        <td className="px-3 py-3"><div className="h-4 bg-border rounded w-16"></div></td>
        <td className="px-3 py-3"><div className="h-4 bg-border rounded w-20"></div></td>
        <td className="px-3 py-3"><div className="h-4 bg-border rounded w-16"></div></td>
        <td className="px-3 py-3 text-center"><div className="h-6 w-8 bg-border rounded-md mx-auto"></div></td>
    </tr>
);


export const PositionsTable: React.FC<PositionsTableProps> = ({ positions, onClose, loading }) => {
    const openPositions = positions.filter(p => p.status === 'open');

    const renderContent = () => {
        if (loading) {
            return [...Array(3)].map((_, i) => <SkeletonRow key={i} />);
        }
        if (openPositions.length === 0) {
            return (
                <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-text-muted">
                        <InformationCircleIcon className="w-8 h-8 mx-auto mb-2" />
                        No open positions.
                    </td>
                </tr>
            );
        }
        return openPositions.map(pos => (
            <tr key={pos.id} className="hover:bg-border/50">
                <td className="px-3 py-2 text-sm font-medium text-text-primary whitespace-nowrap">{pos.symbol}</td>
                <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${pos.side === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>{pos.side.toUpperCase()}</td>
                <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap font-mono">{pos.volume.toFixed(2)}</td>
                <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap font-mono">{pos.stopLoss}/{pos.takeProfit}</td>
                <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap font-mono ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center">
                    <Tooltip content="Manually close this position">
                        <button
                            onClick={() => onClose(pos.id)}
                            className="p-1.5 rounded-md text-text-muted hover:bg-red-500/20 hover:text-red-500 transition-colors"
                        >
                            <XMarkIcon className="w-4 h-4" />
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
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Vol</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">SL/TP</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">P&L</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Close</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {renderContent()}
                </tbody>
            </table>
        </div>
    );
};