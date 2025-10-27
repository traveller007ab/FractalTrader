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
            transform: `translateX(${offset * 100}%) translateX(${offset * 10}px) rotateY(${-offset * 40}deg)`,
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none',
            zIndex: isVisible ? 2 : 1,
        };
    };


    return (
        <div className="bg-bg-secondary/80 backdrop-blur-md border border-white/10 rounded-lg shadow-lg h-full flex flex-col max-h-[calc(100vh-6rem)]">
            <div className="flex border-b border-white/10 flex-shrink-0 relative">
                {tabs.map((tab, index) => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 transition-all duration-300 relative ${activeTab === tab.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                        <div className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>
                            <tab.icon className="w-5 h-5" />
                        </div>
                        <span className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`}>{tab.label}</span>
                    </button>
                ))}
                <div
                    className="absolute bottom-0 h-0.5 bg-accent transition-all duration-500 ease-in-out"
                    style={{
                        left: `${tabIndices[activeTab] * (100 / tabs.length)}%`,
                        width: `${100 / tabs.length}%`,
                    }}
                ></div>
            </div>
            
             <div className="flex-grow overflow-hidden relative" style={{ perspective: '1200px' }}>
                <div
                    style={getPanelStyle(0)}
                    className="absolute w-full h-full transition-all duration-500 ease-in-out"
                >
                    <div className="w-full h-full overflow-y-auto">
                        <StrategySettings 
                            settings={props.strategySettings}
                            onSettingsUpdate={props.onSettingsUpdate}
                            onApplyOptimizedSettings={props.onApplyOptimizedSettings}
                            logs={props.engineLogs}
                            optimizedSettings={props.optimizedSettings}
                            onClearOptimizedSettings={props.onClearOptimizedSettings}
                        />
                    </div>
                </div>
                <div
                    style={getPanelStyle(1)}
                    className="absolute w-full h-full transition-all duration-500 ease-in-out"
                >
                    <div className="w-full h-full overflow-y-auto">
                         <BacktestCenter {...props} />
                    </div>
                </div>
                <div
                    style={getPanelStyle(2)}
                    className="absolute w-full h-full transition-all duration-500 ease-in-out"
                >
                    <div className="w-full h-full overflow-y-auto">
                        <TradeExecutionSection
                            signals={props.signals}
                            addToast={props.addToast}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
