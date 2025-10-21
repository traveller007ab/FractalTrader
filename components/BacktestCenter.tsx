import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import type { BacktestRun, TimeSeriesData } from '../types';
import type { FileWithStatus } from '../App';
import { DocumentPlusIcon, FolderOpenIcon, PlayIcon, CogIcon, StopIcon, XMarkIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon } from './icons';
import { Tooltip } from './Tooltip';

interface RecentRunsListProps {
  runs: BacktestRun[];
  onViewRun: (run: BacktestRun) => void;
}

const RecentRunsList: React.FC<RecentRunsListProps> = ({ runs, onViewRun }) => {
    return (
        <div>
            <h3 className="text-md font-semibold text-slate-200 mt-6 mb-3">Recent Backtest Runs</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {runs.length > 0 ? runs.map(run => (
                    <div key={run.id} className="bg-slate-800/50 p-2.5 rounded-md border border-slate-700/50 flex justify-between items-center">
                        <div>
                            <p className="text-sm font-medium text-slate-200 truncate max-w-40" title={(run.params as any)?.symbol}>{(run.params as any)?.symbol}</p>
                            <p className="text-xs text-slate-400">{new Date(run.started_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                             <p className={`text-sm font-semibold ${run.metrics && run.metrics.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {run.metrics ? `$${run.metrics.total_pnl.toFixed(2)}` : 'N/A'}
                            </p>
                            <button onClick={() => onViewRun(run)} className="text-xs text-brand-accent/80 hover:text-brand-accent">
                                View Details
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-sm text-slate-500 py-4">No recent runs.</div>
                )}
            </div>
        </div>
    );
};

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
    onOptimize: (file: File, parsedData: TimeSeriesData[]) => void;
    onSessionStart: () => void;
    recentBacktests: BacktestRun[];
    onViewBacktest: (run: BacktestRun) => void;
    optimizationState: { fileId: string | null; count: number };
    onClearFiles: () => void;
}

export const BacktestCenter: React.FC<BacktestCenterProps> = ({ 
    files, setFiles, isBacktesting, setIsBacktesting, isOptimizing, 
    backtestProgress, setBacktestProgress, stopBacktestRef, onRunBacktest, 
    onOptimize, onSessionStart, recentBacktests, onViewBacktest,
    optimizationState, onClearFiles
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [parsing, setParsing] = useState(false);

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
        // Reset input value to allow re-uploading the same file
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
        if(files.length !== 1) return;
        const fileWithStatus = files[0];
        try {
            const parsedData = await parseCsv(fileWithStatus.file);
            onOptimize(fileWithStatus.file, parsedData);
        } catch (e: unknown) {
             const error = e as Error;
             console.error("Error parsing file for optimization:", error);
             setFiles(prev => prev.map(f => f.file.name === fileWithStatus.file.name ? { ...f, status: 'failed', error: error.message } : f));
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
    
    const fileId = files.length === 1 ? `${files[0].file.name}-${files[0].file.size}` : null;
    const isRefining = fileId && optimizationState.fileId === fileId && optimizationState.count > 0;

    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="text-md font-semibold text-slate-200 mb-3">Upload Data</h3>
                <div className="grid grid-cols-2 gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".csv,.CSV" />
                    <input type="file" ref={folderInputRef} onChange={handleFileChange} multiple webkitdirectory="" className="hidden" />

                    <button onClick={() => fileInputRef.current?.click()} disabled={parsing || isBacktesting || isOptimizing} className="w-full inline-flex justify-center items-center px-3 py-2 border border-slate-700 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50">
                        <DocumentPlusIcon className="w-5 h-5 mr-2" />
                        Upload Files
                    </button>
                    <button onClick={() => folderInputRef.current?.click()} disabled={parsing || isBacktesting || isOptimizing} className="w-full inline-flex justify-center items-center px-3 py-2 border border-slate-700 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50">
                        <FolderOpenIcon className="w-5 h-5 mr-2" />
                        Upload Folder
                    </button>
                </div>
            </div>
            
            {files.length > 0 && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="text-md font-semibold text-slate-200">File Queue ({files.length})</h3>
                        <Tooltip content="Clear all files from the queue.">
                            <button onClick={onClearFiles} disabled={isBacktesting || isOptimizing} className="text-slate-400 hover:text-white disabled:opacity-50">
                                <XMarkIcon className="w-5 h-5"/>
                            </button>
                        </Tooltip>
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-slate-900/50 p-2 rounded-md border border-border-color space-y-2">
                        {files.map(({file, status, error}, index) => (
                           <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between text-sm p-1.5 rounded bg-slate-800/50">
                               <p className="truncate text-slate-300" title={file.name}>{file.name}</p>
                               {status === 'running' && <SpinnerIcon className="w-4 h-4 text-sky-400 animate-spin" />}
                               {status === 'succeeded' && <CheckCircleIcon className="w-4 h-4 text-emerald-400 animate-pop-in" />}
                               {status === 'failed' && <Tooltip content={error}><XCircleIcon className="w-4 h-4 text-red-400 animate-pop-in cursor-help"/></Tooltip>}
                           </div>
                        ))}
                    </div>
                    
                    {isBacktesting && (
                        <div className="space-y-1">
                             <p className="text-xs font-semibold text-sky-300 text-center">
                                {`Running ${backtestProgress.current} of ${backtestProgress.total}`}
                            </p>
                            <div className="overflow-hidden h-2 text-xs flex rounded bg-sky-200/20">
                                <div style={{ width: `${(backtestProgress.current / backtestProgress.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-300"></div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 pt-1">
                        {!isBacktesting ? (
                             <button onClick={handleRunClick} disabled={isOptimizing || files.length === 0} className="w-full col-span-2 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed">
                                <PlayIcon className="w-5 h-5 mr-2" />
                                Run All
                            </button>
                        ) : (
                             <button onClick={() => stopBacktestRef.current = true} className="w-full col-span-2 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600/80 hover:bg-red-600">
                                <StopIcon className="w-5 h-5 mr-2"/>
                                Stop
                            </button>
                        )}
                       
                    </div>
                     <Tooltip content={
                        isRefining
                            ? `Run a deeper optimization based on the current settings. (Level ${optimizationState.count + 1})`
                            : "Find the best parameters for this dataset. Only enabled for a single file."
                     }>
                        <button onClick={handleOptimizeClick} disabled={isBacktesting || isOptimizing || files.length !== 1} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                            {isOptimizing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <CogIcon className="w-5 h-5 mr-2" />}
                            {isOptimizing ? "Optimizing..." : (isRefining ? `Refine (Lvl ${optimizationState.count + 1})` : "Optimize Strategy")}
                        </button>
                    </Tooltip>
                </div>
            )}
            
            <RecentRunsList runs={recentBacktests} onViewRun={onViewBacktest} />

        </div>
    );
};