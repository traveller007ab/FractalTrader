import React, { useState, useEffect } from 'react';
import type { StrategySettings as StrategySettingsType } from '../types';
import { ChevronDownIcon, CheckIcon, InformationCircleIcon, XMarkIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';
import { TelegramIntegration } from './TelegramIntegration.tsx';

interface StrategySettingsProps {
  settings: StrategySettingsType;
  onSettingsUpdate: (settings: StrategySettingsType) => void;
  onApplyOptimizedSettings: (settings: StrategySettingsType) => void;
  logs: string[];
  optimizedSettings: StrategySettingsType | null;
  onClearOptimizedSettings: () => void;
}

const SettingInput: React.FC<{ label: string, value: number, name: keyof StrategySettingsType, step: number, onChange: (name: keyof StrategySettingsType, value: number) => void, tooltip: string }> = 
({ label, value, name, step, onChange, tooltip }) => (
    <div>
        <label htmlFor={name} className="block text-xs font-medium text-text-secondary">
             <Tooltip content={tooltip}>
                <span className="cursor-help border-b border-dashed border-text-muted/50">{label}</span>
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
            className="mt-1 block w-full px-2 py-1.5 bg-bg-primary border border-border rounded-md text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent text-sm"
        />
    </div>
);


const OptimizationResults: React.FC<{current: StrategySettingsType, proposed: StrategySettingsType, onSave: () => void, onDiscard: () => void}> = ({ current, proposed, onSave, onDiscard }) => {
    
    const changes = (Object.keys(proposed) as Array<keyof StrategySettingsType>).map(key => {
        const oldValue = current[key];
        const newValue = proposed[key];

        let areDifferent = false;
        if (typeof oldValue === 'number' && typeof newValue === 'number') {
            areDifferent = oldValue.toFixed(4) !== newValue.toFixed(4);
        } else {
            // If types are different or one is undefined, they are different.
            areDifferent = oldValue !== newValue;
        }

        if (!areDifferent) return null;

        return {
            key,
            label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            oldValue,
            newValue
        };
    }).filter(Boolean);

    return (
        <div className="bg-accent/10 p-4 rounded-lg border-2 border-accent/50 space-y-3 mb-6 animate-fade-in-up">
            <div className="flex items-center gap-3">
                <InformationCircleIcon className="w-6 h-6 text-accent flex-shrink-0"/>
                <div>
                    <h3 className="text-md font-semibold text-text-primary">Optimization Results</h3>
                    <p className="text-xs text-text-secondary">A better configuration was found. Review the changes below.</p>
                </div>
            </div>
            <div className="space-y-2 text-sm">
                {changes.map(change => (
                    <div key={change!.key} className="flex justify-between items-center bg-bg-primary/50 dark:bg-slate-800/50 p-2 rounded">
                        <span className="text-text-secondary">{change!.label}</span>
                        <div className="text-right">
                            <span className="text-red-500/80 line-through mr-2 font-mono">
                                {typeof change!.oldValue === 'number' ? change!.oldValue.toFixed(2) : 'N/A'}
                            </span>
                            <span className="text-emerald-500 font-mono">
                                {typeof change!.newValue === 'number' ? change!.newValue.toFixed(2) : 'N/A'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 pt-2">
                <button onClick={onSave} className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover">
                    <CheckIcon className="w-5 h-5 mr-2"/> Apply & Save
                </button>
                 <button onClick={onDiscard} className="w-full inline-flex justify-center items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-text-primary bg-bg-secondary hover:bg-border">
                    <XMarkIcon className="w-5 h-5 mr-2"/> Discard
                </button>
            </div>
        </div>
    );
}


export const StrategySettings: React.FC<StrategySettingsProps> = ({ settings, onSettingsUpdate, onApplyOptimizedSettings, logs, optimizedSettings, onClearOptimizedSettings }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        // If there are no pending optimized settings, sync with the global state
        if(!optimizedSettings) {
            setLocalSettings(settings);
        }
    }, [settings, optimizedSettings]);

    const handleSettingChange = (name: keyof StrategySettingsType, value: number) => {
        setLocalSettings(prev => ({...prev, [name]: value}));
    };

    const handleSave = () => {
        onSettingsUpdate(localSettings);
    };
    
    const handleApplyOptimized = () => {
        if(optimizedSettings) {
            onApplyOptimizedSettings(optimizedSettings);
        }
    }

  return (
    <div className="p-4 space-y-6">
        {optimizedSettings && (
            <OptimizationResults 
                current={settings} 
                proposed={optimizedSettings} 
                onSave={handleApplyOptimized} 
                onDiscard={onClearOptimizedSettings}
            />
        )}
        <div className="space-y-4">
             <h3 className="text-md font-semibold text-text-primary">Risk Management (Base Settings)</h3>
             <div className="grid grid-cols-2 gap-4">
                <SettingInput label="Risk %" value={localSettings.riskPercent} name="riskPercent" step={0.1} onChange={handleSettingChange} tooltip="Base percentage of total equity to risk per trade. Symbol-specific settings may override this."/>
                <SettingInput label="R:R Ratio" value={localSettings.takeProfitR_R} name="takeProfitR_R" step={0.1} onChange={handleSettingChange} tooltip="Base ratio of take profit to stop loss. Symbol-specific settings may override this."/>
                <SettingInput label="Stop Loss ATR" value={localSettings.stopLossAtrMultiplier} name="stopLossAtrMultiplier" step={0.1} onChange={handleSettingChange} tooltip="Base ATR multiplier for stop loss. Symbol-specific settings may override this."/>
             </div>
             
             <h3 className="text-md font-semibold text-text-primary pt-2">Strategy Parameters (Base Settings)</h3>
             <div className="grid grid-cols-2 gap-4">
                 <SettingInput label="SMA Period" value={localSettings.smaPeriod} name="smaPeriod" step={1} onChange={handleSettingChange} tooltip="Lookback period for the Simple Moving Average (SMA) for trend detection."/>
                 <SettingInput label="ATR Period" value={localSettings.atrPeriod} name="atrPeriod" step={1} onChange={handleSettingChange} tooltip="Lookback period for the Average True Range (ATR) calculation."/>
                 <SettingInput label="Shift ATR Mult" value={localSettings.shiftAtrMultiplier} name="shiftAtrMultiplier" step={0.05} onChange={handleSettingChange} tooltip="Base ATR multiplier to confirm a 'shift'. Symbol-specific settings may override this."/>
             </div>
             <p className="text-xs text-text-muted text-center pt-1">Note: These are base settings. The engine uses specific, optimized parameters for each symbol (e.g., BTC/USD, XAU/USD).</p>

             <button onClick={handleSave} className="w-full mt-2 inline-flex justify-center items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent"
                disabled={!!optimizedSettings}
             >
                Update Base Live Settings
            </button>
        </div>

        <div>
            <button onClick={() => setShowLogs(!showLogs)} className="flex justify-between items-center w-full text-left">
                <h3 className="text-md font-semibold text-text-primary">Live Engine Logs</h3>
                <ChevronDownIcon className={`w-5 h-5 text-text-secondary transition-transform ${showLogs ? 'rotate-180' : ''}`} />
            </button>
            {showLogs && (
                <div className="mt-3 bg-bg-primary/50 dark:bg-slate-900/50 p-3 rounded-md border border-border max-h-48 overflow-y-auto">
                    <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap">
                        {logs.length > 0 ? logs.join('\n') : 'Awaiting engine logs...'}
                    </pre>
                </div>
            )}
        </div>

        <TelegramIntegration />
    </div>
  );
};