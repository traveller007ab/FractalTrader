import React, { useState, useRef } from 'react';
import type { BacktestRun, TimeSeriesData } from '../types';
import { BacktestIcon, ChartIcon, FolderOpenIcon, CogIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, XMarkIcon, StopIcon, DocumentPlusIcon } from './icons';
import Papa from 'papaparse';
import { Tooltip } from './Tooltip';

interface BacktestResultsProps {
  backtests: BacktestRun[];
  loading: boolean;
  onRunBacktest: (data: TimeSeriesData[], fileName: string) => Promise<void>;
  onOptimize: (data: TimeSeriesData[]) => Promise<void>;
}

interface FileToProcess {
  id: string;
  file: File;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  data?: TimeSeriesData[];
  error?: string;
}

const FileStatusIcon: React.FC<{ status: FileToProcess['status'] }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <SpinnerIcon className="w-5 h-5 text-sky-400 animate-spin" />;
    case 'succeeded':
      return <CheckCircleIcon className="w-5 h-5 text-emerald-400" />;
    case 'failed':
      return <XCircleIcon className="w-5 h-5 text-red-400" />;
    default:
      return <div className="w-5 h-5"></div>;
  }
};


const BacktestListItem: React.FC<{ backtest: BacktestRun }> = ({ backtest }) => (
    <li className="py-3 sm:py-4">
        <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
                <BacktestIcon className="w-6 h-6 text-slate-500"/>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{backtest.strategy}</p>
                <p className="text-sm text-slate-400 truncate">{new Date(backtest.ended_at).toLocaleString()}</p>
            </div>
            <div className={`inline-flex items-center text-base font-semibold ${ (backtest.metrics?.total_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                { (backtest.metrics?.total_pnl ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
            </div>
        </div>
    </li>
);

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtests, loading, onRunBacktest, onOptimize }) => {
    const [files, setFiles] = useState<FileToProcess[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const stopRequested = useRef(false);
    const [isRunning, setIsRunning] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const newFiles: File[] = Array.from(selectedFiles).filter((file): file is File => {
            return file instanceof File && (file.name.toLowerCase().endsWith('.csv') || file.webkitRelativePath.toLowerCase().endsWith('.csv'));
        });
        
        if (newFiles.length === 0) {
            alert('No .csv files found in the selection.');
            return;
        }

        const filePromises = newFiles.map(file => new Promise<FileToProcess>((resolve) => {
             try {
                Papa.parse(file, {
                    header: false,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: (results: Papa.ParseResult<(string | number)[]>, parsedFile: File) => {
                        const targetFile = parsedFile instanceof File ? parsedFile : file;
                        if (results.errors.length > 0) {
                           resolve({ id: targetFile.name + Math.random(), file: targetFile, status: 'failed', error: `Parsing error: ${results.errors[0].message}` });
                           return;
                        }
                        if (results.data.length < 2) {
                           resolve({ id: targetFile.name + Math.random(), file: targetFile, status: 'failed', error: 'CSV must have a header and at least one data row.' });
                           return;
                        }

                        const headerRow = results.data[0];
                        let body = results.data.slice(1);

                        const colMap: { [key: string]: number } = {};
                        const requiredHeaders = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
                        const possibleHeaders: { [key: string]: string[] } = {
                            datetime: ['datetime', 'date', 'timestamp', 'time'],
                            open: ['open'], high: ['high'], low: ['low'], close: ['close'], volume: ['volume']
                        };
                        
                        const isHeaderless = typeof headerRow[0] === 'number' && typeof headerRow[1] === 'number';

                        if (isHeaderless) {
                            for(let i=0; i<requiredHeaders.length; i++) colMap[requiredHeaders[i]] = i;
                            body.unshift(headerRow as (string|number)[]); 
                        } else {
                             const foundHeaders = headerRow.map(h => String(h).toLowerCase().trim());
                             for(const key of requiredHeaders){
                                const possible = possibleHeaders[key];
                                const idx = foundHeaders.findIndex(h => possible.includes(h));
                                if (idx !== -1) colMap[key] = idx;
                             }
                        }

                        const missingCols = requiredHeaders.filter(h => colMap[h] === undefined);
                        if (missingCols.length > 0) {
                            resolve({ id: targetFile.name + Math.random(), file: targetFile, status: 'failed', error: `Missing columns: ${missingCols.join(', ')}` });
                            return;
                        }
                        
                        const parsedData = body.map(row => {
                            const dtValue = row[colMap.datetime];
                            const date = typeof dtValue === 'number' 
                                ? new Date(dtValue * (String(dtValue).length === 10 ? 1000 : 1)) 
                                : new Date(dtValue as string);
                            return {
                                datetime: date.toISOString(),
                                open: Number(row[colMap.open]),
                                high: Number(row[colMap.high]),
                                low: Number(row[colMap.low]),
                                close: Number(row[colMap.close]),
                                volume: Number(row[colMap.volume]),
                            };
                        }).filter(d => !isNaN(d.open) && d.datetime !== 'Invalid Date');
                        
                        const sortedData = parsedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
                        resolve({ id: targetFile.name + Math.random(), file: targetFile, data: sortedData, status: 'queued' });
                    },
                    error: (error: Error, errorFile: File) => {
                        const targetFile = errorFile instanceof File ? errorFile : file;
                        resolve({ id: targetFile.name + Math.random(), file: targetFile, status: 'failed', error: `PapaParse Error: ${error.message}` });
                    }
                });
            } catch (e: unknown) {
                 let message = 'Unexpected parsing error';
                 if (e instanceof Error) message = e.message;
                 resolve({ id: file.name + Math.random(), file, status: 'failed', error: message });
            }
        }));

        Promise.all(filePromises).then(processedFiles => {
            setFiles(prev => [...prev, ...processedFiles]);
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (folderInputRef.current) folderInputRef.current.value = "";
    };
    
    const handleRunClick = async () => {
        setIsRunning(true);
        stopRequested.current = false;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (stopRequested.current) {
                console.log('Backtest run stopped by user.');
                break;
            }
            if(file.status === 'succeeded' || file.status === 'running') continue;

            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'running' } : f));
            
            if (file.data) {
                 try {
                    await onRunBacktest(file.data, file.file.name);
                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'succeeded' } : f));
                } catch (e: unknown) {
                    let message = 'Unknown error';
                     if (e instanceof Error) {
                       message = e.message;
                     } else if (e && typeof e === 'object' && 'message' in e) {
                       message = String((e as {message: unknown}).message);
                     }
                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'failed', error: message } : f));
                }
            } else {
                 setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'failed', error: file.error || "No data to process" } : f));
            }
        }
        setIsRunning(false);
    };
    
    const handleOptimizeClick = async () => {
        const fileToOptimize = files.find(f => f.data);
        if (files.length === 1 && fileToOptimize && fileToOptimize.data) {
             setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'running' } : f));
            try {
                await onOptimize(fileToOptimize.data);
                setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'succeeded' } : f));
            } catch (error: unknown) {
                let message = 'Optimization failed';
                if (error instanceof Error) message = error.message;
                setFiles(prev => prev.map(f => f.id === fileToOptimize.id ? { ...f, status: 'failed', error: message } : f));
            }
        } else {
            alert('Please upload exactly one valid CSV file to run optimization.');
        }
    };
    
    const handleFilesUploadClick = () => fileInputRef.current?.click();
    const handleFolderUploadClick = () => folderInputRef.current?.click();
    
    const handleStopClick = () => {
        stopRequested.current = true;
    }

    const handleClear = () => {
        setFiles([]);
    }

    const allDone = !isRunning && files.length > 0 && files.every(f => f.status === 'succeeded' || f.status === 'failed');

    return (
        <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
            <div className="p-4 border-b border-border-color flex items-center justify-between">
                <div className="flex items-center">
                    <ChartIcon className="w-6 h-6 mr-3 text-brand-accent" />
                    <h2 className="text-lg font-semibold text-slate-100">Backtest Center</h2>
                </div>
            </div>
            <div className="p-4 space-y-4">
                 <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".csv"
                />
                 <input
                    type="file"
                    ref={folderInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    // @ts-ignore
                    webkitdirectory="true"
                />
                <div className="flex gap-2">
                    <button
                        onClick={handleFilesUploadClick}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-dashed border-slate-600 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
                    >
                        <DocumentPlusIcon className="w-5 h-5 mr-2" />
                        Upload Files
                    </button>
                    <button
                        onClick={handleFolderUploadClick}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-dashed border-slate-600 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
                    >
                        <FolderOpenIcon className="w-5 h-5 mr-2" />
                        Upload Folder
                    </button>
                </div>
                
                {files.length > 0 && (
                    <div className="space-y-3">
                        <div className="max-h-40 overflow-y-auto pr-2 space-y-2">
                             {files.map(file => (
                                <div key={file.id} className="flex items-center justify-between bg-slate-800 p-2 rounded-md">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-200 truncate">{file.file.name}</p>
                                        {file.error && <p className="text-xs text-red-400 truncate">{file.error}</p>}
                                    </div>
                                    <FileStatusIcon status={file.status} />
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            {isRunning ? (
                                <Tooltip content="Stop the current backtest queue after the running file is complete.">
                                     <button onClick={handleStopClick} className="w-full inline-flex justify-center items-center px-4 py-2 border border-red-500/50 text-sm font-medium rounded-md shadow-sm text-red-300 bg-red-500/20 hover:bg-red-500/30">
                                        <StopIcon className="w-5 h-5 mr-2" />
                                        Stop
                                    </button>
                                </Tooltip>
                            ) : (
                                <button onClick={handleRunClick} disabled={loading || files.length === 0} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait">
                                    <BacktestIcon className="w-5 h-5 mr-2" />
                                    Run All ({files.filter(f=>f.status === 'queued' || f.status === 'failed').length})
                                </button>
                            )}
                            <div className="w-full">
                                <Tooltip content="Run dozens of backtests with different parameters to find the most profitable settings for this specific dataset.">
                                    {/* Wrapper div for tooltip on disabled button */}
                                    <div className="w-full">
                                        <button onClick={handleOptimizeClick} disabled={loading || files.length !== 1 || isRunning} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                                            <CogIcon className="w-5 h-5 mr-2" />
                                            Optimize
                                        </button>
                                    </div>
                                </Tooltip>
                            </div>
                            { (allDone || !isRunning) &&
                                <Tooltip content="Clear the list of uploaded files.">
                                    <button onClick={handleClear} disabled={loading} className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">
                                        <XMarkIcon className="w-5 h-5"/>
                                    </button>
                                </Tooltip>
                            }
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-border-color">
                <h3 className="text-md font-semibold text-slate-200 mb-2">Recent Backtest Runs</h3>
                 <div className="flow-root max-h-64 overflow-y-auto">
                    <ul role="list" className="divide-y divide-border-color">
                        {backtests.length > 0 ? (
                            backtests.slice(0, 10).map(bt => <BacktestListItem key={bt.id} backtest={bt} />)
                        ) : (
                            <p className="text-center text-sm text-slate-500 py-4">{loading ? 'Loading history...' : 'No backtests run yet.'}</p>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};