import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { PnlDataPoint } from '../types';
import { useTheme } from '../hooks/useTheme.ts';

interface AnalyticsChartProps {
  data: PnlDataPoint[];
  height?: number | string; // Optional height prop
  baseline?: number; // Starting value for equity curve (default 0)
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data, height = "100%", baseline = 0 }) => {
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
  
  // Calculate offset based on the baseline provided
  if (maxPnl === minPnl) {
      // Handle flat line case to avoid divide by zero
      // If value >= baseline, we want it Green (zeroOffset 0 -> gradientOffset 1)
      // If value < baseline, we want it Red (zeroOffset 1 -> gradientOffset 0)
      zeroOffset = maxPnl >= baseline ? 0 : 1;
  } else {
      zeroOffset = (baseline - minPnl) / (maxPnl - minPnl);
      // Clamp offset between 0 and 1
      zeroOffset = Math.max(0, Math.min(1, zeroOffset));
  }
  
  // Invert for SVG gradient (0 is top, 1 is bottom)
  const gradientOffset = 1 - zeroOffset;
  
  const isCompact = typeof height === 'number';

  return (
    <ResponsiveContainer width="100%" height={height as any}>
      <AreaChart
        data={data}
        margin={isCompact ? 
          { top: 5, right: 0, left: 0, bottom: 0 } : 
          { top: 5, right: 20, left: -10, bottom: 5 }
        }
      >
        <defs>
            <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={themeColors.accent} stopOpacity={0.7}/>
                <stop offset={gradientOffset} stopColor={themeColors.accent} stopOpacity={0.1}/>
                <stop offset={gradientOffset} stopColor={themeColors.danger} stopOpacity={0.1}/>
                <stop offset="100%" stopColor={themeColors.danger} stopOpacity={0.5}/>
            </linearGradient>
        </defs>
        {!isCompact && <CartesianGrid strokeDasharray="3 3" stroke={themeColors.grid} vertical={false} />}
        <XAxis 
            hide={isCompact}
            dataKey="date" 
            stroke={themeColors.text}
            tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} 
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
        />
        <YAxis 
            hide={isCompact}
            stroke={themeColors.text}
            tick={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
            tickLine={false}
            axisLine={{ stroke: themeColors.grid }}
            tickFormatter={(value) => `$${Number(value).toLocaleString()}`}
            domain={['auto', 'auto']}
        />
        {!isCompact && <Tooltip
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
                 const itemColor = value >= baseline ? themeColors.accent : themeColors.danger;
                 return [<span style={{ color: itemColor }}>{`$${value.toFixed(2)}`}</span>, 'Balance'];
            }}
        />}
        {!isCompact && <ReferenceLine y={baseline} stroke={themeColors.text} strokeDasharray="2 4" />}
        <Area type="monotone" dataKey="pnl" stroke={themeColors.accent} strokeWidth={2} fillOpacity={1} fill="url(#pnlGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};