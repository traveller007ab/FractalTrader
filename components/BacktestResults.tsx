import React, { useState, useRef, ChangeEvent } from 'react';
import type { BacktestRun, TimeSeriesData } from '../types';
import Papa from 'papaparse';
import { BacktestIcon, SpinnerIcon, FolderOpenIcon, DocumentPlusIcon, CheckCircleIcon, XCircleIcon, XMarkIcon, CogIcon, StopIcon } from './icons';
import { Tooltip } from './Tooltip';

interface BacktestResultsProps {
  backtests: BacktestRun[];
  loading: boolean;
  onRunBacktest: (csvData: TimeSeriesData[], fileName: string) => Promise<void>;
  onOptimize: (csvData: TimeSeriesData[]) => Promise<void>;
  onSessionStart: () => void;
}

interface FileStatus {
    id: string;
    file: File;
    status: 'Queued' | 'Running' | 'Succeeded' | 'Failed';
    error?: string;
    data?: TimeSeriesData[];
}

const parseCSV = (file: File): Promise<TimeSeriesData[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: (results) => {
                const rows = results.data as (string | number)[][];
                if (rows.length < 2) {
                    return reject(new Error('CSV must have a header and at least one data row.'));
                }

                let header: string[] = rows[0].map(h => String(h).trim().toLowerCase());
                let dataRows = rows.slice(1);
                
                const hasHeader = header.some(h => ['date', 'time', 'datetime', 'open', 'high', 'low', 'close', 'volume'].includes(h));

                if (!hasHeader) {
                    dataRows = rows;
                    header = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
                }

                const colMap: { [key: string]: number } = {};
                const requiredCols = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
                const aliases: { [key: string]: string[] } = {
                    datetime: ['date', 'timestamp', 'time'],
                    open: [], high: [], low: [], close: [], volume: [],
                };
                
                header.forEach((h, i) => {
                    colMap[h] = i;
                    for (const key in aliases) {
                        if (aliases[key].includes(h)) {
                            colMap[key] = i;
                        }
                    }
                });

                const missingCols = requiredCols.filter(rc => colMap[rc] === undefined);
                if (missingCols.length > 0) {
                     return reject(new Error(`Missing required CSV columns: ${missingCols.join(', ')}. Found: [${header.join(', ')}]`));
                }

                const data: TimeSeriesData[] = dataRows.map((row) => {
                    if (!Array.isArray(row) || row.length < header.length) return null;
                    
                    const dtValue = row[colMap['datetime']];
                    let dateStr: string;

                    if (typeof dtValue === 'number') {
                        const date = new Date(dtValue * (String(dtValue).length === 10 ? 1000 : 1));
                        dateStr = date.toISOString();
                    } else {
                        dateStr = String(dtValue);
                    }
                    
                    return {
                        datetime: dateStr,
                        open: parseFloat(String(row[colMap['open']])),
                        high: parseFloat(String(row[colMap['high']])),
                        low: parseFloat(String(row[colMap['low']])),
                        close: parseFloat(String(row[colMap['close']])),
                        volume: parseFloat(String(row[colMap['volume']])),
                    };
                }).filter((d): d is TimeSeriesData => d !== null && d.datetime !== '' && !isNaN(d.open) && !isNaN(d.close));

                if (data.length === 0) {
                    return reject(new Error('No valid data rows could be parsed.'));
                }

                data.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
                resolve(data);
            },
            error: (err: any) => {
                reject(new Error(`PapaParse error: ${err.message}`));
            }
        });
    });
};

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtests, loading, onRunBacktest, onOptimize, onSessionStart }) => {
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const stopRequest = useRef(false);
    const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const handleFilesSelected = async (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;
        const newFiles: FileStatus[] = [];
        const existingFileIds = new Set(files.map(f => `${f.file.name}-${f.file.lastModified}`));

        for (const file of Array.from(selectedFiles)) {
             if (file.name.toLowerCase().endsWith('.csv')) {
                 const fileId = `${file.name}-${file.lastModified}`;
                 if (!existingFileIds.has(fileId)) {
                     newFiles.push({ id: fileId, file, status: 'Queued' });
                 }
             }
        }
        
        setFiles(prev => [...prev, ...newFiles]);

        for (const newFile of newFiles) {
             try {
                const data = await parseCSV(newFile.file);
                setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, data } : f));
            } catch (error: unknown) {
                 const errorMessage = error instanceof Error ? error.message : "An unknown parsing error occurred.";
                setFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, status: 'Failed', error: errorMessage } : f));
            }
        }
    };
    
    const handleRunClick = async () => {
        onSessionStart();
        setIsProcessing(true);
        stopRequest.current = false;
        
        const filesToRun = files.filter(f => f.status === 'Queued' && f.data);
        const totalRuns = filesToRun.length;
        let completedCount = 0;
        setRunProgress({ current: 0, total: totalRuns });

        for (const currentFile of filesToRun) {
            if (stopRequest.current) break;

            completedCount++;
            setRunProgress({ current: completedCount, total: totalRuns });
            setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'Running' } : f));
            
            try {
                await onRunBacktest(currentFile.data!, currentFile.file.name);
                setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'Succeeded' } : f));
            } catch (e: unknown) {
                let errorMessage = "An unknown error occurred.";
                if (e instanceof Error) errorMessage = e.message;
                else if (typeof e === 'object' && e !== null && 'message' in e) errorMessage = String((e as { message: string }).message);
                setFiles(prev => prev.map(f => f.id === currentFile.id ? { ...f, status: 'Failed', error: errorMessage } : f));
            }
        }
        
        setIsProcessing(false);
        setRunProgress(null);
        stopRequest.current = false;
    };
    
    const handleOptimizeClick = async () => {
        const fileToOptimize = files.find(f => f.status === 'Queued' && f.data);
        if (!fileToOptimize || !fileToOptimize.data) return;
        
        onSessionStart();
        setIsProcessing(true);
        setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'Running' } : f));
        try {
            await onOptimize(fileToOptimize.data);
            setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'Succeeded' } : f));
        } catch (err) {
            setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'Failed', error: 'Optimization failed.' } : f));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStop = () => stopRequest.current = true;
    const handleClear = () => setFiles([]);

    const hasCompletedRun = files.some(f => f.status === 'Succeeded' || f.status === 'Failed');
    const hasQueuedFiles = files.some(f => f.status === 'Queued');

    return (
        <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
            <div className="p-4 border-b border-border-color flex items-center justify-between">
                <div className="flex items-center">
                    <BacktestIcon className="w-6 h-6 mr-3 text-brand-accent" />
                    <h2 className="text-lg font-semibold text-slate-100">Backtest Center</h2>
                </div>
            </div>
            
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                     <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFilesSelected(e.target.files)} />
                     <input type="file" ref={folderInputRef} className="hidden" webkitdirectory="" onChange={(e) => handleFilesSelected(e.target.files)} />
                     <button onClick={() => fileInputRef.current?.click()} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                        <DocumentPlusIcon className="w-5 h-5 mr-2"/>
                        Upload Files
                    </button>
                    <button onClick={() => folderInputRef.current?.click()} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-700 text-sm font-medium rounded-md shadow-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">
                        <FolderOpenIcon className="w-5 h-5 mr-2"/>
                        Upload Folder
                    </button>
                </div>
                
                {files.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {files.map(f => (
                            <div key={f.id} className="flex items-center justify-between text-sm p-2 bg-slate-800 rounded-md">
                                <span className="truncate text-slate-300" title={f.file.name}>{f.file.name}</span>
                                {f.status === 'Queued' && !f.data && !f.error && <SpinnerIcon className="animate-spin h-4 w-4 text-slate-400" />}
                                {f.status === 'Queued' && f.data && <span className="text-xs text-slate-400">Ready</span>}
                                {f.status === 'Running' && <SpinnerIcon className="animate-spin h-4 w-4 text-sky-400" />}
                                {f.status === 'Succeeded' && <CheckCircleIcon className="h-5 w-5 text-emerald-400" />}
                                {f.status === 'Failed' && <Tooltip content={f.error || ''}><XCircleIcon className="h-5 w-5 text-red-400 cursor-help" /></Tooltip>}
                            </div>
                        ))}
                    </div>
                )}
                
                {isProcessing && runProgress && (
                    <div className="space-y-2 pt-2">
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div>
                                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-sky-600 bg-sky-200">
                                        Running {runProgress.current} of {runProgress.total}
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-sky-200">
                                <div style={{ width: `${(runProgress.current / runProgress.total) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-500"></div>
                            </div>
                        </div>
                         <Tooltip content="Stop processing after the current file is finished.">
                            <button onClick={handleStop} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                                <StopIcon className="w-5 h-5 mr-2" />
                                Stop
                            </button>
                        </Tooltip>
                    </div>
                )}

                {!isProcessing && (
                     <div className="flex items-center justify-between gap-4 pt-2">
                        <button onClick={handleRunClick} disabled={loading || !hasQueuedFiles} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            Run All
                        </button>
                        <Tooltip content="Optimize strategy based on a single historical dataset. Please upload only one file.">
                            <button onClick={handleOptimizeClick} disabled={loading || files.length !== 1 || !hasQueuedFiles} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                                <CogIcon className="w-5 h-5 mr-2" />
                                Optimize
                            </button>
                        </Tooltip>
                    </div>
                )}
                { hasCompletedRun && !isProcessing &&
                    <button onClick={handleClear} className="w-full text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center pt-2">
                        <XMarkIcon className="w-4 h-4 mr-1"/> Clear File List
                    </button>
                }
            </div>

            <div className="border-t border-border-color">
                <h3 className="text-md font-semibold text-slate-200 p-4 border-b border-border-color">Recent Backtest Runs</h3>
                <div className="overflow-auto max-h-[16rem]">
                    <table className="min-w-full divide-y divide-border-color">
                         <thead className="bg-slate-900/50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Strategy File</th>
                                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">P&amp;L</th>
                                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Win Rate</th>
                                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Trades</th>
                            </tr>
                        </thead>
                        <tbody className="bg-container-bg divide-y divide-border-color">
                            {backtests.map(run => (
                                <tr key={run.id} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-200 truncate" title={run.strategy}>{run.strategy}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">{new Date(run.started_at).toLocaleDateString()}</td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-mono ${run.metrics && run.metrics.total_pnl > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {run.metrics?.total_pnl.toFixed(2) ?? 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-right font-mono">{run.metrics?.win_rate.toFixed(1) ?? 'N/A'}%</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-right font-mono">{run.metrics?.total_trades ?? 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {backtests.length === 0 && (
                        <div className="p-6 text-center text-slate-400 text-sm">
                            <p>{loading ? 'Loading...' : 'No past backtests found.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
