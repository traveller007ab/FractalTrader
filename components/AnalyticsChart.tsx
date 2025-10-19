import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PnlDataPoint } from '../types';

interface AnalyticsChartProps {
  data: PnlDataPoint[];
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 5,
          right: 20,
          left: -10,
          bottom: 5,
        }}
      >
        <defs>
            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis 
            dataKey="date" 
            stroke="#64748b"
            tick={{ fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
        />
        <YAxis 
            stroke="#64748b"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#1e293b',
                borderRadius: '0.5rem',
                color: '#cbd5e1',
            }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#38bdf8' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
        />
        <Area type="monotone" dataKey="pnl" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorPnl)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};