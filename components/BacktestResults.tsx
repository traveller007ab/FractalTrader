import React, { useState } from 'react';
import type { BacktestRun, TimeSeriesData } from '../types';
import { BacktestIcon, PlayIcon, UploadIcon, SpinnerIcon, CheckCircleIcon, XCircleIcon, XMarkIcon, CogIcon } from './icons';

interface BacktestResultsProps {
  backtests: BacktestRun[];
  loading: boolean;
  onRunBacktest: (csvData: TimeSeriesData[], fileName: string) => Promise<void>;
  onOptimize: (csvData: TimeSeriesData[]) => Promise<void>;
}

type FileStatus = {
    status: 'queued' | 'running' | 'success' | 'failed';
    error?: string;
};

const BacktestCard: React.FC<{ run: BacktestRun }> = ({ run }) => {
    const pnl = run.metrics?.total_pnl ?? 0;
    return (
        <div className="bg-slate-800/70 p-3 rounded-md border border-slate-700/50">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-semibold text-slate-100 truncate w-40" title={run.strategy}>{run.strategy}</p>
                    <p className="text-xs text-slate-400">
                        {new Date(run.started_at).toLocaleDateString()}
                    </p>
                </div>
                <div className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${pnl.toFixed(2)}
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                    <p className="text-slate-400">Win Rate</p>
                    <p className="font-medium text-white">{run.metrics?.win_rate?.toFixed(1) ?? 'N/A'}%</p>
                </div>
                <div>
                    <p className="text-slate-400">Trades</p>
                    <p className="font-medium text-white">{run.metrics?.total_trades ?? 'N/A'}</p>
                </div>
                <div>
                    <p className="text-slate-400">Profit Factor</p>
                    <p className="font-medium text-white">{run.metrics?.profit_factor?.toFixed(2) ?? 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

const BacktestSkeleton: React.FC = () => (
    <div className="bg-slate-800/70 p-3 rounded-md border border-slate-700/50 animate-pulse">
        <div className="flex justify-between items-start">
            <div className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-32"></div>
                <div className="h-3 bg-slate-700 rounded w-24"></div>
            </div>
            <div className="h-5 bg-slate-700 rounded w-16"></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
            <div className="space-y-1"><div className="h-3 bg-slate-700 rounded w-10 mx-auto"></div><div className="h-4 bg-slate-700 rounded w-8 mx-auto"></div></div>
        </div>
    </div>
)

const parseCsvData = (text: string): TimeSeriesData[] => {
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) throw new Error('CSV file is empty.');
    const firstLineValues = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const hasHeader = ['date', 'time', 'open', 'high', 'low', 'close', 'volume'].some(h => firstLineValues.join(',').includes(h));
    
    let headers: string[], dataLines: string[];
    if (hasHeader) {
        if (lines.length < 2) throw new Error('CSV with a header must have at least one data row.');
        headers = firstLineValues; dataLines = lines.slice(1);
    } else {
        headers = ['datetime', 'open', 'high', 'low', 'close', 'volume']; dataLines = lines;
    }
    const headerMapping: { [key: string]: string } = { 'datetime': 'datetime', 'date': 'datetime', 'time': 'datetime', 'timestamp': 'datetime', 'open': 'open', 'high': 'high', 'low': 'low', 'close': 'close', 'volume': 'volume', 'vol': 'volume' };
    const requiredHeaders = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
    const colMapping: { [key in keyof TimeSeriesData]?: number } = {};
    
    if (hasHeader) {
        const foundHeaders: string[] = [];
        headers.forEach((header, index) => {
            const mappedHeader = headerMapping[header];
            if (mappedHeader && requiredHeaders.includes(mappedHeader)) {
                if (!foundHeaders.includes(mappedHeader)) { colMapping[mappedHeader as keyof TimeSeriesData] = index; foundHeaders.push(mappedHeader); }
            }
        });
        const missingHeaders = requiredHeaders.filter(h => !foundHeaders.includes(h));
        if (missingHeaders.length > 0) throw new Error(`Missing required CSV columns: ${missingHeaders.join(', ')}. Found: [${lines[0].split(',').map(v => v.trim()).join(', ')}]`);
    } else {
        if (firstLineValues.length < 6) throw new Error(`Headerless CSV must have at least 6 columns. Found ${firstLineValues.length}.`);
        colMapping.datetime = 0; colMapping.open = 1; colMapping.high = 2; colMapping.low = 3; colMapping.close = 4; colMapping.volume = 5;
    }

    return dataLines.map((line, lineIndex) => {
        const values = line.split(',');
        if (values.length < requiredHeaders.length) return null;
        try {
            let dt_val = values[colMapping.datetime!].trim();
            if (!isNaN(Number(dt_val)) && !dt_val.includes('-') && !dt_val.includes(':')) {
                dt_val = new Date(Number(dt_val) * 1000).toISOString();
            }
            const row: TimeSeriesData = { datetime: dt_val, open: parseFloat(values[colMapping.open!]), high: parseFloat(values[colMapping.high!]), low: parseFloat(values[colMapping.low!]), close: parseFloat(values[colMapping.close!]), volume: parseFloat(values[colMapping.volume!]) };
            if (Object.values(row).some(val => typeof val === 'number' && isNaN(val))) throw new Error(`Row contains non-numeric values: [${values.join(', ')}]`);
            return row;
// FIX: Explicitly type the catch variable as 'unknown' for type safety.
        } catch (e: unknown) { return null; }
    }).filter((row): row is TimeSeriesData => row !== null);
};

const FileStatusDisplay: React.FC<{ file: File, statusInfo: FileStatus }> = ({ file, statusInfo }) => {
    const statusConfig = { queued: { icon: null, color: 'text-slate-400', text: 'Queued' }, running: { icon: <SpinnerIcon className="w-4 h-4 text-sky-400 animate-spin" />, color: 'text-sky-400', text: 'Running...' }, success: { icon: <CheckCircleIcon className="w-5 h-5 text-emerald-400" />, color: 'text-emerald-400', text: 'Success' }, failed: { icon: <XCircleIcon className="w-5 h-5 text-red-400" />, color: 'text-red-400', text: 'Failed' }, };
    const current = statusConfig[statusInfo.status];
    return (
        <div className="bg-slate-800/50 p-2 rounded-md border border-slate-700/50">
            <div className="flex items-center justify-between text-sm">
                <p className="text-slate-300 truncate w-4/5" title={file.name}>{file.name}</p>
                <div className="flex items-center space-x-2"> {current.icon} <span className={`text-xs font-medium ${current.color}`}>{current.text}</span> </div>
            </div>
            {statusInfo.status === 'failed' && ( <p className="text-xs text-red-500 pl-1 pt-1 mt-1 border-t border-slate-700/50">{statusInfo.error}</p> )}
        </div>
    );
};

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtests, loading, onRunBacktest, onOptimize }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
        const csvFiles = Array.from(selectedFiles).filter(f => f.name.toLowerCase().endsWith('.csv'));
        setFiles(csvFiles);
        const initialStatuses = csvFiles.reduce((acc, file) => {
            acc[file.name] = { status: 'queued' };
            return acc;
        }, {} as Record<string, FileStatus>);
        setFileStatuses(initialStatuses);
    }
  };
  
  const handleRunClick = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    for (const file of files) {
      setFileStatuses(prev => ({ ...prev, [file.name]: { status: 'running' } }));
      try {
        const text = await file.text();
        const parsedData = parseCsvData(text);
        if (parsedData.length === 0) throw new Error('No valid data rows found.');
        await onRunBacktest(parsedData, file.name);
        setFileStatuses(prev => ({ ...prev, [file.name]: { status: 'success' } }));
      } catch (e: unknown) {
        let message = 'An unknown error occurred.';
        if (e instanceof Error) { message = e.message; }
        setFileStatuses(prev => ({ ...prev, [file.name]: { status: 'failed', error: message } }));
      }
    }
    setIsProcessing(false);
  };

  const handleOptimizeClick = async () => {
    if (files.length !== 1) return;
    try {
        const file = files[0];
        const text = await file.text();
        const parsedData = parseCsvData(text);
        if (parsedData.length === 0) throw new Error('No valid data in file to optimize.');
        await onOptimize(parsedData);
// FIX: Explicitly type the catch variable as 'unknown' for type safety and handle the error message correctly.
    } catch (e: unknown) {
        let message = 'An unknown error occurred.';
        if (e instanceof Error) { message = e.message; }
        // We can display this error as a toast in App.tsx if needed
        console.error("Optimize click error:", message);
    }
  };
  
  const handleClearFiles = () => { setFiles([]); setFileStatuses({}); };
  
  const completedTests = Object.values(fileStatuses).filter(s => s.status === 'success' || s.status === 'failed').length;

  let buttonText = 'Run Backtest';
  if (isProcessing) buttonText = `Running ${completedTests + 1} of ${files.length}...`;
  else if (completedTests > 0 && completedTests === files.length) buttonText = 'Finished';

  return (
    <div className="bg-container-bg rounded-lg shadow-lg border border-border-color">
      <div className="p-4 border-b border-border-color flex items-center justify-between">
        <div className="flex items-center">
            <BacktestIcon className="w-6 h-6 mr-3 text-brand-accent" />
            <h2 className="text-lg font-semibold text-slate-100">Backtest Center</h2>
        </div>
      </div>

      <div className="p-4 border-b border-border-color">
        <label htmlFor="file-upload" className="relative cursor-pointer bg-slate-800/70 border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-brand-accent transition-colors block">
          <div className="flex flex-col items-center">
            <UploadIcon className="w-10 h-10 text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-brand-accent">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-slate-500 mt-1">Upload CSV files or folders</p>
          </div>
          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".csv" multiple webkitdirectory="" />
        </label>
        
        {files.length > 0 && ( <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2"> {files.map(file => ( <FileStatusDisplay key={file.name} file={file} statusInfo={fileStatuses[file.name]} /> ))} </div> )}

        <div className="flex items-center gap-3 mt-4">
            {completedTests > 0 && !isProcessing && !loading && ( <button onClick={handleClearFiles} className="w-1/3 inline-flex items-center justify-center px-3 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent"> <XMarkIcon className="w-5 h-5 mr-2" /> Clear </button> )}
            {files.length === 1 && !isProcessing && (
                <button onClick={handleOptimizeClick} disabled={loading} className="w-full inline-flex items-center justify-center px-3 py-2 border border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-200 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                    <CogIcon className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Optimizing...' : 'Optimize Strategy'}
                </button>
            )}
             <button onClick={handleRunClick} disabled={files.length === 0 || loading} className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed">
                <PlayIcon className={`w-5 h-5 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
                {buttonText}
             </button>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[40vh] overflow-y-auto">
        <h3 className="text-base text-slate-300 font-semibold">Recent Runs</h3>
        {loading && !backtests.length ? ( <> <BacktestSkeleton /> <BacktestSkeleton /> </> ) : ( backtests.length > 0 ? ( backtests.map(run => <BacktestCard key={run.id} run={run} />) ) : ( <p className="text-center text-slate-400 py-4 text-sm">No backtest results found.</p> ) )}
      </div>
    </div>
  );
};