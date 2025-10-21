import React, { useState, useEffect } from 'react';
// Fix: Resolve name conflict between imported type and component by aliasing the type.
import type { StrategySettings as StrategySettingsType } from '../types';
import { ChevronDownIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';

interface StrategySettingsProps {
  settings: StrategySettingsType;
  onSettingsUpdate: (settings: StrategySettingsType) => void;
  logs: string[];
}

const SettingInput: React.FC<{ label: string, value: number, name: keyof StrategySettingsType, step: number, onChange: (name: keyof StrategySettingsType, value: number) => void, tooltip: string }> = 
({ label, value, name, step, onChange, tooltip }) => (
    <div>
        <label htmlFor={name} className="block text-xs font-medium text-slate-400">
             <Tooltip content={tooltip}>
                <span className="cursor-help border-b border-dashed border-slate-500/50">{label}</span>
            </Tooltip>
        </label>
        <input
            type="number"
            id={name}
            name={name}
            value={value}
            step={step}
            onChange={(e) => {
                const val = parseFloat(e.target.value);
                if(!isNaN(val)) {
                    onChange(name, val)
                }
            }}
            className="mt-1 block w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-accent text-sm"
        />
    </div>
);

// Fix: This component was named the same as an imported type, causing a declaration merge error. The type is now aliased.
export const StrategySettings: React.FC<StrategySettingsProps> = ({ settings, onSettingsUpdate, logs }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSettingChange = (name: keyof StrategySettingsType, value: number) => {
        setLocalSettings(prev => ({...prev, [name]: value}));
    };

    const handleSave = () => {
        onSettingsUpdate(localSettings);
    };

  return (
    <div className="p-4 space-y-6">
        <div className="space-y-4">
             <h3 className="text-md font-semibold text-slate-200">Risk Management (Base Settings)</h3>
             <div className="grid grid-cols-2 gap-4">
                <SettingInput label="Risk %" value={localSettings.riskPercent} name="riskPercent" step={0.1} onChange={handleSettingChange} tooltip="Base percentage of total equity to risk per trade. Symbol-specific settings may override this."/>
                <SettingInput label="R:R Ratio" value={localSettings.takeProfitR_R} name="takeProfitR_R" step={0.1} onChange={handleSettingChange} tooltip="Base ratio of take profit to stop loss. Symbol-specific settings may override this."/>
                <SettingInput label="Stop Loss ATR" value={localSettings.stopLossAtrMultiplier} name="stopLossAtrMultiplier" step={0.1} onChange={handleSettingChange} tooltip="Base ATR multiplier for stop loss. Symbol-specific settings may override this."/>
             </div>
             
             <h3 className="text-md font-semibold text-slate-200 pt-2">Strategy Parameters (Base Settings)</h3>
             <div className="grid grid-cols-2 gap-4">
                 <SettingInput label="SMA Period" value={localSettings.smaPeriod} name="smaPeriod" step={1} onChange={handleSettingChange} tooltip="Lookback period for the Simple Moving Average (SMA) for trend detection."/>
                 <SettingInput label="ATR Period" value={localSettings.atrPeriod} name="atrPeriod" step={1} onChange={handleSettingChange} tooltip="Lookback period for the Average True Range (ATR) calculation."/>
                 <SettingInput label="Shift ATR Mult" value={localSettings.shiftAtrMultiplier} name="shiftAtrMultiplier" step={0.05} onChange={handleSettingChange} tooltip="Base ATR multiplier to confirm a 'shift'. Symbol-specific settings may override this."/>
             </div>
             <p className="text-xs text-slate-500 text-center pt-1">Note: These are base settings. The engine uses specific, optimized parameters for each symbol (e.g., BTC/USD, XAU/USD).</p>

             <button onClick={handleSave} className="w-full mt-2 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent">
                Update Base Live Settings
            </button>
        </div>

        <div>
            <button onClick={() => setShowLogs(!showLogs)} className="flex justify-between items-center w-full text-left">
                <h3 className="text-md font-semibold text-slate-200">Live Engine Logs</h3>
                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${showLogs ? 'rotate-180' : ''}`} />
            </button>
            {showLogs && (
                <div className="mt-3 bg-slate-900/50 p-3 rounded-md border border-border-color max-h-48 overflow-y-auto">
                    <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                        {logs.length > 0 ? logs.join('\n') : 'Awaiting engine logs...'}
                    </pre>
                </div>
            )}
        </div>
    </div>
  );
};