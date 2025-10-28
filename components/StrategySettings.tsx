import React, { useState, useEffect } from 'react';
import type { StrategySettings as StrategySettingsType, FullStrategySettings } from '../types';
import { ChevronDownIcon, CheckIcon, InformationCircleIcon, XMarkIcon, RefreshCcwIcon } from './icons.tsx';
import { Tooltip } from './Tooltip.tsx';
import { TelegramIntegration } from './TelegramIntegration.tsx';
import { strategyConfig } from '../lib/strategyRBSv2Config.ts';

interface StrategySettingsProps {
  settings: FullStrategySettings;
  onSettingsUpdate: (symbol: string, settings: StrategySettingsType) => void;
  logs: string[];
  optimizedSettings: { symbol: string, settings: StrategySettingsType } | null;
  onClearOptimizedSettings: () => void;
}

const SettingInput: React.FC<{ 
    label: string, 
    value: number, 
    name: keyof StrategySettingsType, 
    step: number, 
    onChange: (name: keyof StrategySettingsType, value: number) => void, 
    tooltip: string,
    isInherited: boolean,
    onReset?: () => void,
}> = ({ label, value, name, step, onChange, tooltip, isInherited, onReset }) => (
    <div>
        <div className="flex justify-between items-center">
            <label htmlFor={name} className={`block text-xs font-medium ${isInherited ? 'text-text-muted' : 'text-text-secondary'}`}>
                <Tooltip content={tooltip}>
                    <span className="cursor-help border-b border-dashed border-text-muted/50">{label}</span>
                </Tooltip>
            </label>
            {!isInherited && onReset && (
                 <Tooltip content="Reset to base value">
                    <button onClick={onReset} className="text-text-muted hover:text-accent transition-colors">
                        <RefreshCcwIcon className="w-3 h-3" />
                    </button>
                 </Tooltip>
            )}
        </div>
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
            className={`mt-1 block w-full bg-transparent border-0 border-b-2 px-1 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:ring-0 focus:border-accent transition-colors duration-200 text-sm ${isInherited ? 'border-border/50' : 'border-border'}`}
        />
    </div>
);


const OptimizationResults: React.FC<{current: StrategySettingsType, proposed: StrategySettingsType, onSave: () => void, onDiscard: () => void, symbol: string}> = ({ current, proposed, onSave, onDiscard, symbol }) => {
    
    const changes = (Object.keys(proposed) as Array<keyof StrategySettingsType>).map(key => {
        const oldValue = current[key];
        const newValue = proposed[key];

        let areDifferent = false;
        if (typeof oldValue === 'number' && typeof newValue === 'number') {
            areDifferent = oldValue.toFixed(4) !== newValue.toFixed(4);
        } else {
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
                    <h3 className="text-md font-semibold text-text-primary">Optimization Results for {symbol}</h3>
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

const settingOptions = ['base', ...Object.keys(strategyConfig.symbols)];

export const StrategySettings: React.FC<StrategySettingsProps> = ({ settings, onSettingsUpdate, logs, optimizedSettings, onClearOptimizedSettings }) => {
    const [selectedSymbol, setSelectedSymbol] = useState('base');
    const [localSettings, setLocalSettings] = useState<StrategySettingsType>(settings.base);
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        if (optimizedSettings) {
            setSelectedSymbol(optimizedSettings.symbol);
        }
    }, [optimizedSettings]);
    
    useEffect(() => {
        const currentSymbolSettings = settings.symbols[selectedSymbol] || {};
        const effectiveSettings = { ...settings.base, ...currentSymbolSettings };
        setLocalSettings(effectiveSettings);
    }, [selectedSymbol, settings]);


    const handleSettingChange = (name: keyof StrategySettingsType, value: number) => {
        setLocalSettings(prev => ({...prev, [name]: value}));
    };

    const handleSave = () => {
        onSettingsUpdate(selectedSymbol, localSettings);
    };
    
    const handleApplyOptimized = () => {
        if(optimizedSettings) {
            onSettingsUpdate(optimizedSettings.symbol, optimizedSettings.settings);
        }
    }

    const handleResetToDefault = (keyToReset: keyof StrategySettingsType) => {
        setLocalSettings(prev => ({ ...prev, [keyToReset]: settings.base[keyToReset] }));
    };

    const currentEffectiveSettings = { ...settings.base, ...(settings.symbols[optimizedSettings?.symbol || ''] || {}) };

  return (
    <div className="p-4 space-y-6">
        {optimizedSettings && (
            <OptimizationResults 
                current={currentEffectiveSettings} 
                proposed={optimizedSettings.settings} 
                onSave={handleApplyOptimized} 
                onDiscard={onClearOptimizedSettings}
                symbol={optimizedSettings.symbol}
            />
        )}
        <fieldset disabled={!!optimizedSettings} className="space-y-4 disabled:opacity-50">
            <div className='flex justify-between items-center'>
                <h3 className="text-md font-semibold text-text-primary">Strategy Settings</h3>
                <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="bg-bg-primary border border-border rounded-md text-text-primary text-sm p-1.5 focus:outline-none focus:ring-1 focus:ring-accent custom-select-arrow disabled:cursor-not-allowed"
                >
                    {settingOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === 'base' ? 'Base Settings' : opt}
                        </option>
                    ))}
                </select>
            </div>

             <div className="grid grid-cols-2 gap-4">
                {(Object.keys(localSettings) as Array<keyof StrategySettingsType>).map(key => {
                    const isInherited = selectedSymbol !== 'base' && !(settings.symbols[selectedSymbol] && key in settings.symbols[selectedSymbol]);
                    return (
                        <SettingInput
                            key={key}
                            label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            value={localSettings[key]}
                            name={key}
                            step={0.1} // This is a simplification, ideally step should be per-setting
                            onChange={handleSettingChange}
                            tooltip="A tooltip for this setting."
                            isInherited={isInherited}
                            onReset={isInherited ? undefined : () => handleResetToDefault(key)}
                        />
                    );
                })}
             </div>
             
             <button onClick={handleSave} className="w-full mt-2 inline-flex justify-center items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:cursor-not-allowed"
             >
                Update {selectedSymbol === 'base' ? 'Base' : selectedSymbol} Settings
            </button>
        </fieldset>

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
