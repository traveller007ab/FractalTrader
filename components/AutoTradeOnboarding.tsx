import React, { useState } from 'react';
import { InformationCircleIcon, CheckIcon } from './icons.tsx';

interface RiskSettings {
    maxPositions: number;
    volumeCap: number;
}

interface AutoTradeOnboardingProps {
    onComplete: (settings: RiskSettings) => void;
}

const StepIndicator: React.FC<{ currentStep: number, totalSteps: number }> = ({ currentStep, totalSteps }) => (
    <div className="flex justify-center items-center space-x-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
            <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i + 1 === currentStep ? 'bg-accent p-1' : 'bg-border'}`}
            />
        ))}
    </div>
);

export const AutoTradeOnboarding: React.FC<AutoTradeOnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [settings, setSettings] = useState<RiskSettings>({ maxPositions: 5, volumeCap: 0.1 });
    const [acknowledged, setAcknowledged] = useState(false);

    const renderStep = () => {
        switch (step) {
            case 1: // Disclaimer & Welcome
                return (
                    <div className="text-center animate-fade-in-up">
                        <InformationCircleIcon className="h-12 w-12 text-accent mx-auto" />
                        <h2 className="text-xl font-semibold text-text-primary mt-4">Enable Auto-Trading</h2>
                        <p className="text-sm text-text-secondary mt-2">
                            This feature connects SignalFlow to your trading account to execute signals automatically. Please read the following carefully.
                        </p>
                        <div className="text-left text-xs bg-bg-primary/50 border border-border rounded-md p-3 mt-6 space-y-2">
                            <p><strong>High Risk:</strong> Automated trading involves substantial risk and is not suitable for all investors. You could lose all of your initial investment.</p>
                            <p><strong>Demo First:</strong> It is highly recommended to run this on a demo account to understand its behavior before connecting to a live account.</p>
                             <p><strong>No Guarantee:</strong> Past performance, whether in backtests or live, is not indicative of future results.</p>
                        </div>
                         <label className="flex items-center justify-center mt-6 space-x-2 cursor-pointer">
                            <input type="checkbox" checked={acknowledged} onChange={() => setAcknowledged(!acknowledged)} className="h-4 w-4 rounded bg-bg-primary border-border text-accent focus:ring-accent" />
                            <span className="text-sm text-text-secondary">I understand the risks and wish to proceed.</span>
                        </label>
                        <button
                            onClick={() => setStep(2)}
                            disabled={!acknowledged}
                            className="w-full mt-6 inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next: Configure Risk
                        </button>
                    </div>
                );
            case 2: // Risk Settings
                return (
                    <div className="animate-fade-in-up">
                        <h2 className="text-xl text-center font-semibold text-text-primary">Initial Risk Setup</h2>
                        <p className="text-sm text-center text-text-secondary mt-1">These settings act as a safety net for the automation.</p>
                        <div className="space-y-6 mt-8">
                            <div>
                                <label htmlFor="maxPositions" className="flex justify-between items-center text-sm font-medium text-text-secondary">
                                    <span>Max Open Positions</span>
                                    <span className="text-text-primary font-semibold">{settings.maxPositions}</span>
                                </label>
                                <input id="maxPositions" type="range" min="1" max="10" step="1" value={settings.maxPositions} onChange={(e) => setSettings(s => ({ ...s, maxPositions: parseInt(e.target.value, 10) }))} className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent mt-2" />
                                <p className="text-xs text-text-muted mt-1">Limits concurrent trades to prevent overexposure.</p>
                            </div>
                            <div>
                                <label htmlFor="volumeCap" className="flex justify-between items-center text-sm font-medium text-text-secondary">
                                    <span>Volume Cap (Lots)</span>
                                    <span className="text-text-primary font-semibold">{settings.volumeCap.toFixed(2)}</span>
                                </label>
                                <input id="volumeCap" type="range" min="0.01" max="0.1" step="0.01" value={settings.volumeCap} onChange={(e) => setSettings(s => ({ ...s, volumeCap: parseFloat(e.target.value) }))} className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-accent mt-2" />
                                <p className="text-xs text-text-muted mt-1">A hard limit on the size of any single trade.</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-8">
                            <button onClick={() => setStep(1)} className="w-full inline-flex justify-center items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-text-primary bg-bg-secondary hover:bg-border">Back</button>
                            <button onClick={() => onComplete(settings)} className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover">
                                <CheckIcon className="w-5 h-5 mr-2" />
                                Complete Setup & Activate
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-4 h-full flex flex-col justify-center">
            <div className="bg-bg-secondary border border-border rounded-lg p-6 w-full max-w-md mx-auto">
                {renderStep()}
                <div className="mt-6">
                    <StepIndicator currentStep={step} totalSteps={2} />
                </div>
            </div>
        </div>
    );
};
