import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PnlDataPoint } from '../types';
import { useTheme } from '../hooks/useTheme.ts';

interface AnalyticsChartProps {
  data: PnlDataPoint[];
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data }) => {
  const { theme } = useTheme();

  const colors = {
    light: {
      accent: '#2563eb', // blue-600
      grid: '#e2e8f0', // slate-200
      text: '#475569', // slate-600
      tooltipBg: '#ffffff',
      tooltipBorder: '#e2e8f0',
    },
    dark: {
      accent: '#38bdf8', // sky-400
      grid: '#1e293b', // slate-800
      text: '#64748b', // slate-500
      tooltipBg: '#0f172a',
      tooltipBorder: '#1e293b',
    }
  }

  const themeColors = theme === 'light' ? colors.light : colors.dark;

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
                <stop offset="5%" stopColor={themeColors.accent} stopOpacity={0.7}/>
                <stop offset="95%" stopColor={themeColors.accent} stopOpacity={0}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} vertical={false} />
        <XAxis 
            dataKey="date" 
            stroke={themeColors.text}
            tick={{ fontSize: 12 }} 
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
        />
        <YAxis 
            stroke={themeColors.text}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: themeColors.tooltipBg,
                borderColor: themeColors.tooltipBorder,
                borderRadius: '0.5rem',
                color: themeColors.text,
            }}
            labelStyle={{ color: themeColors.text }}
            itemStyle={{ color: themeColors.accent }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
        />
        <Area type="monotone" dataKey="pnl" stroke={themeColors.accent} strokeWidth={2} fillOpacity={1} fill="url(#colorPnl)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};