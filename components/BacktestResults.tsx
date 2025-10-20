import React, { useState, useRef } from 'react';
import type { BacktestRun, TimeSeriesData } from '../types';
import { BacktestIcon, ChartIcon, UploadIcon, CogIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, XMarkIcon } from './icons';
import Papa from 'papaparse';

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
    const stopRequested = useRef(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const newFiles: File[] = Array.from(selectedFiles).filter(file => file.name.endsWith('.csv'));
        if (newFiles.length === 0) {
            alert('No .csv files found in the selection.');
            return;
        }

        const filePromises = newFiles.map(file => new Promise<FileToProcess>((resolve) => {
            // FIX: Replaced `any` with a more specific type for the parsed CSV row data to improve type safety.
             Papa.parse<(string | number)[]>(file, {
                header: false, // We will auto-detect headers
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.errors.length > 0) {
                       resolve({ id: file.name + Math.random(), file, status: 'failed', error: `Parsing error: ${results.errors[0].message}` });
                       return;
                    }
                    if (results.data.length < 2) {
                       resolve({ id: file.name + Math.random(), file, status: 'failed', error: 'CSV must have a header and at least one data row.' });
                       return;
                    }

                    const header = results.data[0];
                    const body = results.data.slice(1);

                    const colMap: { [key: string]: number } = {};
                    const requiredHeaders = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
                    const possibleHeaders: { [key: string]: string[] } = {
                        datetime: ['datetime', 'date', 'timestamp', 'time'],
                        open: ['open'], high: ['high'], low: ['low'], close: ['close'], volume: ['volume']
                    };

                    const isHeaderless = typeof header[0] === 'number' && typeof header[1] === 'number';

                    if (isHeaderless) {
                        for(let i=0; i<requiredHeaders.length; i++) colMap[requiredHeaders[i]] = i;
                        body.unshift(header as any); // The first row was data
                    } else {
                         const foundHeaders = header.map(h => String(h).toLowerCase().trim());
                         for(const key of requiredHeaders){
                            const possible = possibleHeaders[key];
                            const idx = foundHeaders.findIndex(h => possible.includes(h));
                            if (idx !== -1) colMap[key] = idx;
                         }
                    }

                    const missingCols = requiredHeaders.filter(h => colMap[h] === undefined);
                    if (missingCols.length > 0) {
                        resolve({ id: file.name + Math.random(), file, status: 'failed', error: `Missing columns: ${missingCols.join(', ')}` });
                        return;
                    }
                    
                    const parsedData = body.map(row => {
                        // FIX: Improved date parsing to handle both string and number date/timestamps.
                        const dtValue = row[colMap.datetime];
                        const date = typeof dtValue === 'number' ? new Date(dtValue * 1000) : new Date(dtValue as string);
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
                    resolve({ id: file.name + Math.random(), file, data: sortedData, status: 'queued' });
                },
                error: (error: Error) => {
                    resolve({ id: file.name + Math.random(), file, status: 'failed', error: `PapaParse Error: ${error.message}` });
                }
             });
        }));

        Promise.all(filePromises).then(processedFiles => {
            setFiles(prev => [...prev, ...processedFiles.filter(f => f.status !== 'failed')]);
            const failedFiles = processedFiles.filter(f => f.status === 'failed');
            if (failedFiles.length > 0) {
                alert(`Could not load ${failedFiles.length} files due to errors:\n${failedFiles.map(f => `${f.file.name}: ${f.error}`).join('\n')}`);
            }
        });
        
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    
    const handleRunClick = async () => {
        stopRequested.current = false;
        
        for (const file of files) {
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
                     if (e instanceof Error) message = e.message;
                     else if (typeof e === 'object' && e && 'message' in e && typeof e.message === 'string') message = e.message;
                    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'failed', error: message } : f));
                }
            } else {
                 setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'failed', error: "No data to process" } : f));
            }
        }
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

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleClear = () => {
        setFiles([]);
    }

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
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                    multiple
                    //@ts-ignore - webkitdirectory is a non-standard but widely supported attribute
                    webkitdirectory=""
                />
                <button
                    onClick={handleUploadClick}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-dashed border-slate-600 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-800 hover:border-slate-500 transition-colors"
                >
                    <UploadIcon className="w-5 h-5 mr-2" />
                    Upload Files or Folder
                </button>
                
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
                         <div className="flex items-center justify-between gap-4">
                            <button onClick={handleRunClick} disabled={loading} className="w-full inline-flex justify-center items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait">
                                <BacktestIcon className="w-5 h-5 mr-2" />
                                Run All ({files.length})
                            </button>
                            <button onClick={handleOptimizeClick} disabled={loading || files.length !== 1} className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                                <CogIcon className="w-5 h-5 mr-2" />
                                Optimize
                            </button>
                            <button onClick={handleClear} disabled={loading} className="p-2 text-slate-400 hover:text-white bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">
                                <XMarkIcon className="w-5 h-5"/>
                            </button>
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