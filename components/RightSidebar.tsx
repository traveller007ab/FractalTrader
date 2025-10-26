import React, { useState } from 'react';
import { StrategySettings } from './StrategySettings.tsx';
import { BacktestCenter } from './BacktestCenter.tsx';
import { BeakerIcon, ListBulletIcon, RobotIcon } from './icons.tsx';
import type { StrategySettings as StrategySettingsType, BacktestRun, Signal, ToastMessage } from '../types';
import type { FileWithStatus, OptimizationData } from '../App';
import { TradeExecutionSection } from './TradeExecutionSection.tsx';

interface RightSidebarProps {
    strategySettings: StrategySettingsType;
    onSettingsUpdate: (settings: StrategySettingsType) => void;
    onApplyOptimizedSettings: (settings: StrategySettingsType) => void;
    engineLogs: string[];
    files: FileWithStatus[];
    setFiles: React.Dispatch<React.SetStateAction<FileWithStatus[]>>;
    isBacktesting: boolean;
    setIsBacktesting: React.Dispatch<React.SetStateAction<boolean>>;
    isOptimizing: boolean;
    backtestProgress: { current: number, total: number };
    setBacktestProgress: React.Dispatch<React.SetStateAction<{ current: number, total: number }>>;
    stopBacktestRef: React.MutableRefObject<boolean>;
    onRunBacktest: (file: File, parsedData: any[]) => Promise<void>;
    onOptimize: (files: OptimizationData[]) => void;
    onSessionStart: () => void;
    recentBacktests: BacktestRun[];
    onViewBacktest: (run: BacktestRun) => void;
    optimizationState: { fileId: string | null; count: number };
    onClearFiles: () => void;
    optimizedSettings: StrategySettingsType | null;
    onClearOptimizedSettings: () => void;
    signals: Signal[];
    addToast: (message: string, type?: ToastMessage['type']) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'strategy' | 'backtest' | 'trade'>('strategy');

    return (
        <div className="bg-bg-secondary rounded-lg shadow-lg border border-border h-full flex flex-col max-h-[calc(100vh-6rem)]">
            <div className="flex border-b border-border flex-shrink-0">
                <button
                    onClick={() => setActiveTab('strategy')}
                    className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'strategy' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    <ListBulletIcon className="w-5 h-5" />
                    Strategy
                    {activeTab === 'strategy' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('backtest')}
                    className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'backtest' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    <BeakerIcon className="w-5 h-5" />
                    Backtest
                    {activeTab === 'backtest' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>}
                </button>
                 <button
                    onClick={() => setActiveTab('trade')}
                    className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'trade' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                >
                    <RobotIcon className="w-5 h-5" />
                    Auto Trade
                    {activeTab === 'trade' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"></div>}
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'strategy' && (
                    <StrategySettings 
                        settings={props.strategySettings}
                        onSettingsUpdate={props.onSettingsUpdate}
                        onApplyOptimizedSettings={props.onApplyOptimizedSettings}
                        logs={props.engineLogs}
                        optimizedSettings={props.optimizedSettings}
                        onClearOptimizedSettings={props.onClearOptimizedSettings}
                    />
                )}
                {activeTab === 'backtest' && (
                    <BacktestCenter {...props} />
                )}
                 {activeTab === 'trade' && (
                    <TradeExecutionSection
                        signals={props.signals}
                        addToast={props.addToast}
                    />
                )}
            </div>
        </div>
    );
};