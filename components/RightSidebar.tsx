import React, { useState } from 'react';
import { StrategySettings } from './StrategySettings.tsx';
import { BacktestCenter } from './BacktestCenter.tsx';
import { BeakerIcon, ListBulletIcon, RobotIcon } from './icons.tsx';
// Fix: Import BacktestMetrics to correctly type the optimizedSettings prop.
import type { StrategySettings as StrategySettingsType, BacktestRun, Signal, FullStrategySettings, BacktestMetrics } from '../types';
import type { FileWithStatus, OptimizationData } from '../App';
import { TradeExecutionSection } from './TradeExecutionSection.tsx';
import { soundManager } from '../lib/soundManager.ts';

interface RightSidebarProps {
    strategySettings: FullStrategySettings;
    onSettingsUpdate: (symbol: string, settings: StrategySettingsType) => void;
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
    // Fix: Correct the 'onOptimize' prop signature to accept both files and parameters.
    onOptimize: (files: OptimizationData[], paramsToOptimize: (keyof StrategySettingsType)[]) => void;
    onSessionStart: () => void;
    recentBacktests: BacktestRun[];
    onViewBacktest: (run: BacktestRun) => void;
    optimizationState: { fileId: string | null; count: number };
    onClearFiles: () => void;
    // Fix: Update 'optimizedSettings' to include the full metrics object required by child components.
    optimizedSettings: { 
        symbol: string, 
        settings: StrategySettingsType,
        baselineMetrics: BacktestMetrics,
        optimizedMetrics: BacktestMetrics,
    } | null;
    onClearOptimizedSettings: () => void;
    signals: Signal[];
    // Fix: Correct the 'optimizationProgress' prop type from a simple string to its actual object structure.
    optimizationProgress: { text: string; evolution: number[] };
}

type TabId = 'strategy' | 'backtest' | 'trade';

const tabs: { id: TabId, label: string, icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { id: 'strategy', label: 'Strategy', icon: ListBulletIcon },
    { id: 'backtest', label: 'Backtest', icon: BeakerIcon },
    { id: 'trade', label: 'Auto Trade', icon: RobotIcon },
];

export const RightSidebar: React.FC<RightSidebarProps> = (props) => {
    const [activeTab, setActiveTab] = useState<TabId>('strategy');

    const tabIndices: { [key in TabId]: number } = {
        strategy: 0,
        backtest: 1,
        trade: 2,
    };

    const getPanelStyle = (index: number): React.CSSProperties => {
        const offset = index - tabIndices[activeTab];
        const isVisible = offset === 0;

        return {
            transform: `translateX(${offset * 100}%)`,
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none',
            zIndex: isVisible ? 2 : 1,
            transition: 'transform 0.4s ease-in-out, opacity 0.3s ease-in-out',
        };
    };

    const handleTabClick = (tabId: TabId) => {
        soundManager.play('click');
        setActiveTab(tabId);
    };


    return (
        <div className="main-panel h-full flex flex-col">
            <div className="flex border-b border-border flex-shrink-0 relative">
                {tabs.map((tab, index) => (
                     <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-200 relative ${activeTab === tab.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <tab.icon className="w-5 h-5" />
                        <span>{tab.label}</span>
                    </button>
                ))}
                <div
                    className="absolute bottom-0 h-0.5 bg-accent transition-transform duration-300 ease-in-out"
                    style={{
                        width: `${100 / tabs.length}%`,
                        transform: `translateX(${tabIndices[activeTab] * 100}%)`,
                    }}
                ></div>
            </div>
            
             <div className="flex-grow overflow-hidden relative">
                <div
                    style={getPanelStyle(0)}
                    className="absolute w-full h-full"
                >
                    <div className="w-full h-full overflow-y-auto">
                        <StrategySettings 
                            settings={props.strategySettings}
                            onSettingsUpdate={props.onSettingsUpdate}
                            logs={props.engineLogs}
                            optimizedSettings={props.optimizedSettings}
                            onClearOptimizedSettings={props.onClearOptimizedSettings}
                        />
                    </div>
                </div>
                <div
                    style={getPanelStyle(1)}
                    className="absolute w-full h-full"
                >
                    <div className="w-full h-full overflow-y-auto">
                         <BacktestCenter {...props} />
                    </div>
                </div>
                <div
                    style={getPanelStyle(2)}
                    className="absolute w-full h-full"
                >
                    <div className="w-full h-full overflow-y-auto">
                        <TradeExecutionSection
                            signals={props.signals}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};