import React, { useState, useEffect } from 'react';
// FIX: Renamed imported type to avoid name collision with the component.
import type { StrategySettings as StrategySettingsType } from '../types';
import { CogIcon } from './icons';
import { Tooltip } from './Tooltip';

interface StrategySettingsProps {
  settings: StrategySettingsType;
  onSettingsChange: (newSettings: StrategySettingsType) => void;
  defaultSettings: StrategySettingsType;
}

const SettingInput: React.FC<{label: string; value: number; onChange: (value: number) => void; step?: number; title?: string;}> = ({ label, value, onChange, step = 0.1, title }) => (
    <div>
        <Tooltip content={title || ''}>
          <label className="block text-xs font-medium text-slate-400 mb-1 cursor-help">{label}</label>
        </Tooltip>
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            step={step}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm font-mono"
        />
    </div>
);

// The component was named 'StrategySettings', same as the imported type.
// The error is fixed by renaming the imported type. The component name remains the same to avoid breaking changes in other files.
export const StrategySettings: React.FC<StrategySettingsProps> = ({ settings, onSettingsChange, defaultSettings }) => {
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSettingChange = (key: keyof StrategySettingsType, value: number) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleApply = () => {
        onSettingsChange(localSettings);
    };

    const handleReset = () => {
        setLocalSettings(defaultSettings);
        onSettingsChange(defaultSettings);
    };

    return (
        <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
            <div className="p-4 border-b border-border-color flex items-center justify-between">
                <div className="flex items-center">
                    <CogIcon className="w-6 h-6 mr-3 text-brand-accent" />
                    <h2 className="text-lg font-semibold text-slate-100">Strategy Settings</h2>
                </div>
            </div>
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SettingInput label="SMA Period" value={localSettings.smaPeriod} onChange={(v) => handleSettingChange('smaPeriod', v)} step={1} title="Simple Moving Average period for trend detection." />
                    <SettingInput label="ATR Period" value={localSettings.atrPeriod} onChange={(v) => handleSettingChange('atrPeriod', v)} step={1} title="Average True Range period for volatility." />
                    <SettingInput label="Shift ATR Multiplier" value={localSettings.shiftAtrMultiplier} onChange={(v) => handleSettingChange('shiftAtrMultiplier', v)} step={0.05} title="Multiplier for ATR to detect a fractal shift." />
                    <SettingInput label="Shift % Threshold" value={localSettings.shiftPctThreshold} onChange={(v) => handleSettingChange('shiftPctThreshold', v)} step={0.001} title="Percentage threshold to detect a fractal shift." />
                    <SettingInput label="PD Proximity ATR Multi" value={localSettings.proximityAtrMultiplier} onChange={(v) => handleSettingChange('proximityAtrMultiplier', v)} step={0.1} title="ATR Multiplier to block trades near previous day's high/low."/>
                    <SettingInput label="ATR Filter Multiplier" value={localSettings.atrFilterMultiplier} onChange={(v) => handleSettingChange('atrFilterMultiplier', v)} step={0.05} title="Filter trades if current ATR is below a multiple of the median ATR."/>
                    <SettingInput label="Volume Filter Multiplier" value={localSettings.volumeFilterMultiplier} onChange={(v) => handleSettingChange('volumeFilterMultiplier', v)} step={0.5} title="Confidence is reduced if volume is below this multiple of median volume."/>
                    <SettingInput label="Stop Loss ATR Multi" value={localSettings.stopLossAtrMultiplier} onChange={(v) => handleSettingChange('stopLossAtrMultiplier', v)} step={0.1} title="ATR multiplier to set the stop loss distance."/>
                    <SettingInput label="Take Profit R:R" value={localSettings.takeProfitR_R} onChange={(v) => handleSettingChange('takeProfitR_R', v)} step={0.5} title="Risk-to-Reward ratio for setting the take profit."/>
                    <SettingInput label="Risk per Trade %" value={localSettings.riskPercent} onChange={(v) => handleSettingChange('riskPercent', v)} step={0.001} title="Percentage of account equity to risk per trade."/>
                    <SettingInput label="Confidence Threshold" value={localSettings.confidenceThreshold} onChange={(v) => handleSettingChange('confidenceThreshold', v)} step={0.01} title="Minimum confidence score required to emit a signal."/>
                    <SettingInput label="Cooldown Bars (15m)" value={localSettings.cooldownBars} onChange={(v) => handleSettingChange('cooldownBars', v)} step={1} title="Number of 15-minute bars to wait before issuing another signal in the same direction."/>
                </div>
                <div className="flex items-center justify-between gap-4 pt-2">
                    <button onClick={handleReset} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent">Reset to Default</button>
                    <button onClick={handleApply} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent">Apply Changes</button>
                </div>
            </div>
        </div>
    );
};