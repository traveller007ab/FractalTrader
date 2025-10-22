import React from 'react';

const SkeletonRow: React.FC = () => (
    <tr className="animate-shimmer" style={{ background: 'linear-gradient(to right, #0f172a 4%, #1e293b 25%, #0f172a 36%)', backgroundSize: '1000px 100%' }}>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-20"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-24"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-12"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-24"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-24"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-24"></div></td>
        <td className="px-4 py-3"><div className="h-4 bg-slate-700/50 rounded w-16 mx-auto"></div></td>
        <td className="px-4 py-3"><div className="h-5 bg-slate-700/50 rounded-full w-20"></div></td>
        <td className="px-4 py-3 text-center"><div className="h-8 w-10 bg-slate-700/50 rounded-md mx-auto"></div></td>
    </tr>
);

export const SignalFeedSkeleton: React.FC = () => (
    <table className="min-w-full divide-y divide-border-color">
        <thead className="bg-slate-900/50">
            <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Symbol</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Side</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Entry Price</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stop Loss</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Take Profit</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Confidence</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Action</th>
            </tr>
        </thead>
        <tbody className="bg-container-bg divide-y divide-border-color">
            {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
        </tbody>
    </table>
);
