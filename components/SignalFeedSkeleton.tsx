import React from 'react';

const SkeletonRow: React.FC = () => (
    <tr className="animate-shimmer" style={{ background: 'linear-gradient(to right, hsl(var(--color-bg-secondary)) 4%, hsl(var(--color-border)) 25%, hsl(var(--color-bg-secondary)) 36%)', backgroundSize: '1000px 100%' }}>
        <td className="px-4 py-3"><div className="h-4 bg-border rounded w-20"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-border rounded w-24"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-border rounded w-12"></div></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-border rounded w-24 inline-block"></div></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-border rounded w-24 inline-block"></div></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-border rounded w-24 inline-block"></div></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-border rounded w-16 inline-block"></div></td>
        <td className="px-4 py-3"><div className="h-5 bg-border rounded-full w-20"></div></td>
        <td className="px-4 py-3 text-center"><div className="h-8 w-10 bg-border rounded-md mx-auto"></div></td>
    </tr>
);

export const SignalFeedSkeleton: React.FC = () => (
    <table className="min-w-full divide-y divide-border">
        <thead className="bg-bg-secondary/80">
            <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Symbol</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Side</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Entry Price</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Stop Loss</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Take Profit</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Confidence</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-text-muted uppercase tracking-wider">Action</th>
            </tr>
        </thead>
        <tbody className="bg-bg-secondary divide-y divide-border">
            {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
        </tbody>
    </table>
);