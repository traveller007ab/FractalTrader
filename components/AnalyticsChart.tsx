
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
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
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} />
        <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: '#475569' }}
        />
        <YAxis 
            stroke="#94a3b8" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#475569' }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
            }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#10b981' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
        />
        <Area type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPnl)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};
