import React, { useState, useEffect } from 'react';
import { CheckIcon, InformationCircleIcon } from './icons';

interface RiskSettings {
    maxPositions: number;
    volumeCap: number;
}

interface AutomationSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: RiskSettings) => void;
    currentSettings: RiskSettings;
}

export const AutomationSetupModal: React.FC<AutomationSetupModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
    const [settings, setSettings] = useState<RiskSettings>(currentSettings);

    useEffect(() => {
        setSettings(currentSettings);
    }, [currentSettings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(settings);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div 
                className="bg-bg-secondary border border-border rounded-lg shadow-xl p-6 w-full max-w-sm animate-pop-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center">
                    <InformationCircleIcon className="h-12 w-12 text-accent mx-auto" />
                    <h2 className="text-xl font-semibold text-text-primary mt-4">Automation Setup</h2>
                    <p className="text-sm text-text-secondary mt-1">Configure your risk parameters before enabling auto-trading.</p>
                </div>

                <div className="space-y-6 mt-6">
                    <div>
                        <label htmlFor="maxPositions" className="flex justify-between items-center text-sm font-medium text-text-secondary">
                            <span>Max Open Positions</span>
                            <span className="text-text-primary font-semibold">{settings.maxPositions}</span>
                        </label>
                        <input
                            id="maxPositions"
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={settings.maxPositions}
                            onChange={(e) => setSettings(s => ({ ...s, maxPositions: parseInt(e.target.value, 10) }))}
                            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent mt-2"
                        />
                         <p className="text-xs text-text-muted mt-1">Limits concurrent trades to prevent overexposure.</p>
                    </div>

                    <div>
                        <label htmlFor="volumeCap" className="flex justify-between items-center text-sm font-medium text-text-secondary">
                            <span>Volume Cap (Lots)</span>
                             <span className="text-text-primary font-semibold">{settings.volumeCap.toFixed(2)}</span>
                        </label>
                         <input
                            id="volumeCap"
                            type="range"
                            min="0.01"
                            max="0.1"
                            step="0.01"
                            value={settings.volumeCap}
                            onChange={(e) => setSettings(s => ({ ...s, volumeCap: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent mt-2"
                        />
                        <p className="text-xs text-text-muted mt-1">Maximum lot size for any single trade. (Note: Current strategy calculates size based on risk %)</p>
                    </div>
                </div>

                <div className="mt-8">
                     <p className="text-xs text-center text-red-400/80 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                        <strong>Disclaimer:</strong> Automation carries risk. Always start with a demo account.
                    </p>
                    <button
                        onClick={handleSave}
                        className="w-full mt-4 inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent"
                    >
                        <CheckIcon className="w-5 h-5 mr-2" />
                        Enable Auto & Save
                    </button>
                </div>
            </div>
        </div>
    );
};