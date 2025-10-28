import React, { useRef, useState, useMemo } from 'react';
import Papa from 'papaparse';
import type { BacktestRun, TimeSeriesData, StrategySettings } from '../types';
import type { FileWithStatus, OptimizationData } from '../App';
import { DocumentPlusIcon, FolderOpenIcon, PlayIcon, CogIcon, StopIcon, XMarkIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon } from './icons';
import { Tooltip } from './Tooltip.tsx';
import { RecentRunsList } from './RecentRunsList.tsx';
import { getSymbolFromFilename } from '../lib/utils.ts';
import { AnalyticsChart } from './AnalyticsChart.tsx';

interface BacktestCenterProps {
    files: FileWithStatus[];
    setFiles: React.Dispatch<React.SetStateAction<FileWithStatus[]>>;
    isBacktesting: boolean;
    setIsBacktesting: React.Dispatch<React.SetStateAction<boolean>>;
    isOptimizing: boolean;
    backtestProgress: { current: number, total: number };
    setBacktestProgress: React.Dispatch<React.SetStateAction<{ current: number, total: number }>>;
    stopBacktestRef: React.MutableRefObject<boolean>;
    onRunBacktest: (file: File, parsedData: TimeSeriesData[]) => Promise<void>;
    onOptimize: (files: OptimizationData[], paramsToOptimize: (keyof StrategySettings)[]) => void;
    onSessionStart: () => void;
    recentBacktests: BacktestRun[];
    onViewBacktest: (run: BacktestRun) => void;
    optimizationState: { fileId: string | null; count: number };
    onClearFiles: () => void;
    optimizationProgress: { text: string; evolution: number[] };
}

const EmptyQueueState: React.FC<{ onUploadClick: () => void }> = ({ onUploadClick }) => (
    <div className="text-center p-6 bg-bg-primary/50 dark:bg-slate-900/50 rounded-lg border-2 border-dashed border-border">
        <DocumentPlusIcon className="w-10 h-10 mx-auto text-text-muted" />
        <h4 className="mt-2 text-sm font-semibold text-text-primary">Backtest Queue is Empty</h4>
        <p className="mt-1 text-xs text-text-secondary">Upload CSV data files to begin a backtest or optimization run.</p>
        <button onClick={onUploadClick} className="mt-4 inline-flex items-center px-3 py-1.5 border border-border text-xs font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border">
            Upload Data
        </button>
    </div>
);

const optimizableParams: { id: keyof StrategySettings, label: string }[] = [
    { id: 'smaPeriod', label: 'SMA Period' },
    { id: 'stopLossAtrMultiplier', label: 'SL ATR' },
    { id: 'takeProfitR_R', label: 'TP R:R' },
    { id: 'riskPercent', label: 'Risk %' },
    { id: 'atrFilterMultiplier', label: 'ATR Vol Filter' },
];

export const BacktestCenter: React.FC<BacktestCenterProps> = ({ 
    files, setFiles, isBacktesting, setIsBacktesting, isOptimizing, 
    backtestProgress, setBacktestProgress, stopBacktestRef, onRunBacktest, 
    onOptimize, onSessionStart, recentBacktests, onViewBacktest,
    onClearFiles, optimizationProgress
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [parsing, setParsing] = useState(false);
    const [paramsToOptimize, setParamsToOptimize] = useState<(keyof StrategySettings)[]>(['smaPeriod', 'stopLossAtrMultiplier', 'takeProfitR_R']);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles) return;

        setParsing(true);
        const filesToQueue: FileWithStatus[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            if (file && (file.name.toLowerCase().endsWith('.csv') || file.webkitRelativePath)) {
                filesToQueue.push({ file, status: 'queued' });
            }
        }
        
        const uniqueNewFiles = filesToQueue.filter(nf => !files.some(f => f.file.name === nf.file.name && f.file.size === nf.file.size));

        setFiles(prev => [...prev, ...uniqueNewFiles]);
        setParsing(false);
        event.target.value = ''; 
    };

    const handleRunClick = async () => {
        setIsBacktesting(true);
        stopBacktestRef.current = false;
        onSessionStart();
        setBacktestProgress({ current: 0, total: files.length });

        for (let i = 0; i < files.length; i++) {
            if (stopBacktestRef.current) {
                console.log("Backtest run stopped by user.");
                break;
            }

            const fileWithStatus = files[i];
            setBacktestProgress({ current: i + 1, total: files.length });
            setFiles(prev => prev.map(f => f.file.name === fileWithStatus.file.name ? { ...f, status: 'running' } : f));
            
            try {
                const parsedData = await parseCsv(fileWithStatus.file);
                await onRunBacktest(fileWithStatus.file, parsedData);
                setFiles(prev => prev.map(f => f.file.name === fileWithStatus.file.name ? { ...f, status: 'succeeded' } : f));
            } catch (e: unknown) {
                 const message = e instanceof Error ? e.message : 'Parsing or backtest failed';
                setFiles(prev => prev.map(f => f.file.name === fileWithStatus.file.name ? { ...f, status: 'failed', error: message } : f));
            }
        }
        setIsBacktesting(false);
    };
    
    const handleOptimizeClick = async () => {
        if (files.length < 1 || paramsToOptimize.length === 0) return;
        
        setParsing(true);
        const filesToOptimize: OptimizationData[] = [];
        for (const fileWithStatus of files) {
            try {
                const parsedData = await parseCsv(fileWithStatus.file);
                filesToOptimize.push({ file: fileWithStatus.file, data: parsedData });
            } catch (e: unknown) {
                 const error = e as Error;
                 console.error("Error parsing file for optimization:", error);
                 setFiles(prev => prev.map(f => f.file.name === fileWithStatus.file.name ? { ...f, status: 'failed', error: `Parse failed: ${error.message}` } : f));
            }
        }
        setParsing(false);
        
        if (filesToOptimize.length > 0) {
            onOptimize(filesToOptimize, paramsToOptimize);
        }
    }

    const parseCsv = (file: File): Promise<TimeSeriesData[]> => {
        return new Promise((resolve, reject) => {
            try {
                Papa.parse<unknown[]>(file, {
                    complete: (results, parsedFile) => {
                         if (!results.data || results.data.length < 2) {
                            return reject(new Error("CSV must have a header and at least one data row."));
                        }
                        const firstRow = results.data[0];
                        if (!Array.isArray(firstRow)) {
                            return reject(new Error("Invalid CSV format."));
                        }
                        const hasHeader = firstRow.some(cell => typeof cell === 'string' && isNaN(parseFloat(cell)));
                        const rows = hasHeader ? results.data.slice(1) as (string|number)[][] : results.data as (string|number)[][];
                        const header = hasHeader ? firstRow.map(h => String(h).toLowerCase().trim()) : [];
                        
                        if (rows.length < 40) {
                            return reject(new Error(`Insufficient data. Need at least 40 rows, but got ${rows.length}.`));
                        }
                        
                        let columnMap: { [key: string]: number } = {};
                        if(hasHeader){
                            header.forEach((col, idx) => {
                               if(col.includes('date') || col.includes('time')) columnMap['datetime'] = idx;
                               else if(col.includes('open')) columnMap['open'] = idx;
                               else if(col.includes('high')) columnMap['high'] = idx;
                               else if(col.includes('low')) columnMap['low'] = idx;
                               else if(col.includes('close')) columnMap['close'] = idx;
                               else if(col.includes('volume')) columnMap['volume'] = idx;
                            });
                        } else {
                            columnMap = { datetime: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 };
                        }
                        
                        const requiredCols = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
                        const missingCols = requiredCols.filter(col => columnMap[col] === undefined);
                        if(missingCols.length > 0){
                            return reject(new Error(`Missing required CSV columns: ${missingCols.join(', ')}. Found: [${results.data[0].join(', ')}]`));
                        }
                        
                        const parsedData = rows.map(row => {
                            const dt = row[columnMap['datetime']];
                            const date = new Date(typeof dt === 'string' && isNaN(Number(dt)) ? dt : Number(dt) * 1000);
                            return {
                                datetime: date.toISOString(),
                                open: parseFloat(String(row[columnMap['open']])),
                                high: parseFloat(String(row[columnMap['high']])),
                                low: parseFloat(String(row[columnMap['low']])),
                                close: parseFloat(String(row[columnMap['close']])),
                                volume: parseFloat(String(row[columnMap['volume']]))
                            }
                        }).filter(d => !Object.values(d).some(v => v === null || (typeof v === 'number' && isNaN(v)) ));
                        
                        resolve(parsedData);
                    },
                    error: (error, errorFile) => {
                        const targetFile = errorFile instanceof File ? errorFile : file;
                        reject(new Error(`PapaParse error on file ${targetFile.name}: ${error.message}`));
                    }
                });
            } catch (err: unknown) {
                const error = err as Error;
                reject(new Error(`Error processing file ${file.name}: ${error.message}`));
            }
        });
    };
    
    const optimizationSymbol = files.length > 0 ? getSymbolFromFilename(files[0].file.name) : null;

    const evolutionData = useMemo(() => {
        if (!optimizationProgress.evolution || optimizationProgress.evolution.length < 2) return [];
        return optimizationProgress.evolution.map((score, index) => ({
            date: `G${index + 1}`,
            pnl: score
        }));
    }, [optimizationProgress.evolution]);

    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="text-md font-semibold text-text-primary mb-3">Upload Data</h3>
                <div className="grid grid-cols-2 gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".csv,.CSV" />
                    <input type="file" ref={folderInputRef} onChange={handleFileChange} multiple {...{ webkitdirectory: "" }} className="hidden" />

                    <button onClick={() => fileInputRef.current?.click()} disabled={parsing || isBacktesting || isOptimizing} className="w-full inline-flex justify-center items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border transition-colors disabled:opacity-50">
                        <DocumentPlusIcon className="w-5 h-5 mr-2" />
                        Upload Files
                    </button>
                    <button onClick={() => folderInputRef.current?.click()} disabled={parsing || isBacktesting || isOptimizing} className="w-full inline-flex justify-center items-center px-3 py-2 border border-border text-sm font-medium rounded-md text-text-secondary bg-bg-secondary hover:bg-border transition-colors disabled:opacity-50">
                        <FolderOpenIcon className="w-5 h-5 mr-2" />
                        Upload Folder
                    </button>
                </div>
            </div>
            
            {files.length > 0 ? (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold text-text-primary">File Queue ({files.length})</h3>
                        <Tooltip content="Clear all files from the queue.">
                            <button onClick={onClearFiles} disabled={isBacktesting || isOptimizing} className="text-text-muted hover:text-text-primary disabled:opacity-50">
                                <XMarkIcon className="w-5 h-5"/>
                            </button>
                        </Tooltip>
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-bg-primary/50 dark:bg-slate-900/50 p-2 rounded-md border border-border space-y-2">
                        {files.map(({file, status, error}, index) => (
                           <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between text-sm p-1.5 rounded bg-bg-secondary/50 dark:bg-slate-800/50 hover:bg-border/50 transition-colors">
                               <p className="truncate text-text-secondary" title={file.name}>{file.name}</p>
                               {status === 'running' && <SpinnerIcon className="w-4 h-4 text-sky-400 animate-spin" />}
                               {status === 'succeeded' && <CheckCircleIcon className="w-4 h-4 text-emerald-400 animate-pop-in" />}
                               {status === 'failed' && <Tooltip content={error}><XCircleIcon className="w-4 h-4 text-red-400 animate-pop-in cursor-help"/></Tooltip>}
                           </div>
                        ))}
                    </div>
                    
                    {isBacktesting && (
                        <div className="space-y-1">
                             <p className="text-xs font-semibold text-sky-400 text-center">
                                {`Running ${backtestProgress.current} of ${backtestProgress.total}`}
                            </p>
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-sky-500/20">
                                <div style={{ width: `${(backtestProgress.current / backtestProgress.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-300"></div>
                            </div>
                        </div>
                    )}
                     
                    <div className="grid grid-cols-2 gap-2 pt-1">
                         <button onClick={handleRunClick} disabled={isBacktesting || isOptimizing || files.length === 0} className="w-full col-span-2 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            <PlayIcon className="w-5 h-5 mr-2" />
                            Run All Backtests
                        </button>
                    </div>

                    <div className="pt-2">
                        <h4 className="text-sm font-semibold text-text-primary mb-2">Optimization</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {optimizableParams.map(param => (
                                <label key={param.id} className="flex items-center text-xs space-x-2 bg-bg-primary/50 p-2 rounded-md cursor-pointer border border-border hover:border-accent/50">
                                    <input
                                        type="checkbox"
                                        checked={paramsToOptimize.includes(param.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setParamsToOptimize(prev => [...prev, param.id]);
                                            } else {
                                                setParamsToOptimize(prev => prev.filter(p => p !== param.id));
                                            }
                                        }}
                                        className="h-3 w-3 rounded bg-bg-secondary border-border text-accent focus:ring-accent"
                                    />
                                    <span>{param.label}</span>
                                </label>
                            ))}
                        </div>
                        <Tooltip content={`Uses a genetic algorithm to find the best settings for the selected parameters, based on all queued data.`}>
                            <button onClick={handleOptimizeClick} disabled={isBacktesting || isOptimizing || parsing || files.length === 0 || paramsToOptimize.length === 0} className="w-full mt-3 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-accent/30">
                                {isOptimizing || parsing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <CogIcon className="w-5 h-5 mr-2" />}
                                {isOptimizing ? "Optimizing..." : (parsing ? "Parsing..." : `Optimize ${optimizationSymbol} (${paramsToOptimize.length})`)}
                            </button>
                        </Tooltip>
                         {isOptimizing && (
                            <div className="mt-2 text-center">
                                <p className="text-xs font-semibold text-accent animate-pulse">
                                    {optimizationProgress.text}
                                </p>
                                {evolutionData.length > 0 && (
                                    <div className="h-20 mt-2">
                                        <AnalyticsChart data={evolutionData} height={80} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                 <EmptyQueueState onUploadClick={() => fileInputRef.current?.click()} />
            )}
            
            <hr className="border-border my-6" />

            <RecentRunsList runs={recentBacktests} onViewRun={onViewBacktest} />
        </div>
    );
};