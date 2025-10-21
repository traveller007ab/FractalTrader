import React, { useState } from 'react';
import { StrategySettings } from './StrategySettings';
import { BacktestCenter } from './BacktestCenter';
import { BeakerIcon, ListBulletIcon } from './icons';
import type { StrategySettings as StrategySettingsType, BacktestRun, TimeSeriesData } from '../types';
import type { FileWithStatus } from '../App';

interface RightSidebarProps {
    strategySettings: StrategySettingsType;
    onSettingsUpdate: (settings: StrategySettingsType) => void;
    engineLogs: string[];
    files: FileWithStatus[];
    setFiles: React.Dispatch<React.SetStateAction<FileWithStatus[]>>;
    isBacktesting: boolean;
    setIsBacktesting: React.Dispatch<React.SetStateAction<boolean>>;
    isOptimizing: boolean;
    backtestProgress: { current: number, total: number };
    setBacktestProgress: React.Dispatch<React.SetStateAction<{ current: number, total: number }>>;
    stopBacktestRef: React.MutableRefObject<boolean>;
    onRunBacktest: (file: File, parsedData: TimeSeriesData[]) => Promise<void>;
    onOptimize: (file: File, parsedData: TimeSeriesData[]) => void;
    onSessionStart: () => void;
    recentBacktests: BacktestRun[];
    onViewBacktest: (run: BacktestRun) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<'strategy' | 'backtest'>('strategy');

    return (
        <div className="bg-container-bg rounded-lg shadow-lg border border-border-color h-full flex flex-col max-h-[calc(100vh-6rem)]">
            <div className="flex border-b border-border-color flex-shrink-0">
                <button
                    onClick={() => setActiveTab('strategy')}
                    className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'strategy' ? 'text-brand-accent' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <ListBulletIcon className="w-5 h-5" />
                    Strategy
                    {activeTab === 'strategy' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('backtest')}
                    className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'backtest' ? 'text-brand-accent' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <BeakerIcon className="w-5 h-5" />
                    Backtest
                    {activeTab === 'backtest' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent"></div>}
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'strategy' ? (
                    <StrategySettings 
                        settings={props.strategySettings}
                        onSettingsUpdate={props.onSettingsUpdate}
                        logs={props.engineLogs}
                    />
                ) : (
                    <BacktestCenter {...props} />
                )}
            </div>
        </div>
    );
};