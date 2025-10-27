import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PnlDataPoint } from '../types';
import { useTheme } from '../hooks/useTheme.ts';

interface AnalyticsChartProps {
  data: PnlDataPoint[];
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data }) => {
  const { theme } = useTheme();

  // Using HSL values from the new Apex theme
  const colors = {
    dark: {
      accent: 'hsl(173, 100%, 36%)', // Teal
      danger: 'hsl(0, 84%, 60%)', // Red
      grid: 'hsl(222, 47%, 15%)',
      text: 'hsl(210, 40%, 50%)',
      tooltipBg: 'hsl(222, 47%, 8%)',
      tooltipBorder: 'hsl(222, 47%, 15%)',
    },
    light: {
      accent: 'hsl(173, 100%, 32%)',
      danger: 'hsl(0, 72%, 51%)',
      grid: 'hsl(240, 5.9%, 90%)',
      text: 'hsl(240, 3.8%, 46.1%)',
      tooltipBg: '#ffffff',
      tooltipBorder: 'hsl(240, 5.9%, 90%)',
    }
  }

  const themeColors = theme === 'light' ? colors.light : colors.dark;
  
  // Find the min/max PnL to determine gradient stops
  const pnlValues = data.map(d => d.pnl);
  const minPnl = Math.min(...pnlValues);
  const maxPnl = Math.max(...pnlValues);
  
  let zeroOffset = 0;
  if (maxPnl > minPnl) {
    zeroOffset = Math.abs(minPnl) / (maxPnl - minPnl);
  }

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
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={themeColors.accent} stopOpacity={0.7}/>
                {minPnl < 0 && <stop offset={zeroOffset} stopColor={themeColors.accent} stopOpacity={0.1}/>}
                {minPnl < 0 && <stop offset={zeroOffset} stopColor={themeColors.danger} stopOpacity={0.1}/>}
                <stop offset="95%" stopColor={themeColors.danger} stopOpacity={0.5}/>
            </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} vertical={false} />
        <XAxis 
            dataKey="date" 
            stroke={themeColors.text}
            tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} 
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
        />
        <YAxis 
            stroke={themeColors.text}
            tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            domain={['dataMin', 'dataMax']}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: themeColors.tooltipBg,
                borderColor: themeColors.tooltipBorder,
                borderRadius: '0.5rem',
                color: themeColors.text,
                fontFamily: 'var(--font-sans)',
            }}
            labelStyle={{ color: themeColors.text }}
            itemStyle={{ color: themeColors.accent, fontWeight: 'bold' }}
            formatter={(value: number, name: string, props: any) => {
                 const itemColor = value >= 0 ? themeColors.accent : themeColors.danger;
                 return [<span style={{ color: itemColor }}>{`$${value.toFixed(2)}`}</span>, 'P&L'];
            }}
        />
        <ReferenceLine y={0} stroke={themeColors.text} strokeDasharray="2 4" />
        <Area type="monotone" dataKey="pnl" stroke={themeColors.accent} strokeWidth={2} fillOpacity={1} fill="url(#pnlGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};