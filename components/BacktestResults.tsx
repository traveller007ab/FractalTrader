import React, { useState } from 'react';
import type { BacktestRun, TimeSeriesData } from '../types';
import { BacktestIcon, PlayIcon, UploadIcon } from './icons';

interface BacktestResultsProps {
  backtests: BacktestRun[];
  loading: boolean;
  onRunBacktest: (csvData: TimeSeriesData[], fileName: string) => void;
}

const BacktestCard: React.FC<{ run: BacktestRun }> = ({ run }) => {
    const pnl = run.metrics?.total_pnl ?? 0;
    return (
        <div className="bg-slate-800/70 p-3 rounded-md border border-slate-700/50">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-semibold text-slate-100 truncate w-40" title={run.strategy}>{run.strategy}</p>
                    <p className="text-xs text-slate-400">
                        {new Date(run.started_at).toLocaleDateString()} - {new Date(run.ended_at).toLocaleDateString()}
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
    if (lines.length === 0) {
        throw new Error('CSV file is empty.');
    }

    const firstLineValues = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const hasHeader = ['date', 'time', 'open', 'high', 'low', 'close', 'volume'].some(h => firstLineValues.join(',').includes(h));
    
    let headers: string[];
    let dataLines: string[];

    if (hasHeader) {
        if (lines.length < 2) {
            throw new Error('CSV with a header must have at least one data row.');
        }
        headers = firstLineValues;
        dataLines = lines.slice(1);
    } else {
        // Assume headerless and standard order
        headers = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
        dataLines = lines;
    }

    const headerMapping: { [key: string]: string } = {
        'datetime': 'datetime', 'date': 'datetime', 'time': 'datetime', 'timestamp': 'datetime',
        'open': 'open',
        'high': 'high',
        'low': 'low',
        'close': 'close',
        'volume': 'volume', 'vol': 'volume'
    };

    const requiredHeaders = ['datetime', 'open', 'high', 'low', 'close', 'volume'];
    const colMapping: { [key in keyof TimeSeriesData]?: number } = {};
    
    if (hasHeader) {
        const foundHeaders: string[] = [];
        headers.forEach((header, index) => {
            const mappedHeader = headerMapping[header];
            if (mappedHeader && requiredHeaders.includes(mappedHeader)) {
                if (!foundHeaders.includes(mappedHeader)) {
                     colMapping[mappedHeader as keyof TimeSeriesData] = index;
                     foundHeaders.push(mappedHeader);
                }
            }
        });
        const missingHeaders = requiredHeaders.filter(h => !foundHeaders.includes(h));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required CSV columns: ${missingHeaders.join(', ')}. Found: [${lines[0].split(',').map(v => v.trim()).join(', ')}]`);
        }
    } else {
        // For headerless, assume first 6 columns are in order
        if (firstLineValues.length < 6) {
             throw new Error(`Headerless CSV must have at least 6 columns for required data. Found ${firstLineValues.length} in first row.`);
        }
        colMapping.datetime = 0;
        colMapping.open = 1;
        colMapping.high = 2;
        colMapping.low = 3;
        colMapping.close = 4;
        colMapping.volume = 5;
    }

    return dataLines.map((line, lineIndex) => {
        const values = line.split(',');
        if (values.length < requiredHeaders.length) {
            console.warn(`Row ${lineIndex + (hasHeader ? 2 : 1)} has fewer than ${requiredHeaders.length} columns. Skipping.`);
            return null;
        }

        try {
            let dt_val = values[colMapping.datetime!].trim();
            // Handle Unix timestamps (assuming seconds)
            if (!isNaN(Number(dt_val)) && !dt_val.includes('-') && !dt_val.includes(':')) {
                const ts = Number(dt_val);
                // Check if it's seconds or milliseconds. Timestamps like 1704067200 are seconds.
                dt_val = new Date(ts * 1000).toISOString();
            }

            const row: TimeSeriesData = {
                datetime: dt_val,
                open: parseFloat(values[colMapping.open!]),
                high: parseFloat(values[colMapping.high!]),
                low: parseFloat(values[colMapping.low!]),
                close: parseFloat(values[colMapping.close!]),
                volume: parseFloat(values[colMapping.volume!]) // use parseFloat to handle scientific notation
            };
            
            // Validate parsed numbers
            if (Object.values(row).some(val => typeof val === 'number' && isNaN(val))) {
                 throw new Error(`Row contains non-numeric values: [${values.join(', ')}]`);
            }

            return row;
        } catch (e) {
            let errorMessage = "Unknown parsing error";
            if (e instanceof Error) {
                errorMessage = e.message;
            }
            console.warn(`Error parsing row ${lineIndex + (hasHeader ? 2 : 1)}: "${line}". Error: ${errorMessage}. Skipping.`);
            return null;
        }
    }).filter((row): row is TimeSeriesData => row !== null);
};

export const BacktestResults: React.FC<BacktestResultsProps> = ({ backtests, loading, onRunBacktest }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
        const csvFiles = Array.from(selectedFiles).filter(f => f.name.toLowerCase().endsWith('.csv'));
        if (csvFiles.length > 0) {
            setFiles(csvFiles);
            setErrors({});
        } else {
            setFiles([]);
            setErrors({ general: 'No CSV files found in selection.' });
        }
    }
  };
  
  const handleRunClick = async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const newErrors: Record<string, string> = {};

    for (const file of files) {
      try {
        const text = await file.text();
        const parsedData = parseCsvData(text);
        if (parsedData.length === 0) {
            throw new Error('No valid data rows could be parsed from the file.');
        }
        await onRunBacktest(parsedData, file.name);
      } catch (e: unknown) {
        // FIX: The error object `e` is of type `unknown`. We need to safely
        // check its type before accessing properties like `message` or `name` to avoid runtime errors.
        let message = 'An unknown error occurred while processing this file.';
        if (e instanceof Error) {
            message = e.message;
        } else if (typeof e === 'string') {
            message = e;
        } else if (typeof e === 'object' && e !== null) {
            // Safely access message property from a plain object
            message = (e as { message?: string }).message || 'Backtest failed with an unspecified error.';
        }
        newErrors[file.name] = message;
      }
    }

    setErrors(newErrors);
    setIsProcessing(false);
    if (Object.keys(newErrors).length === 0) {
        setFiles([]); // Clear successful files
    }
  };

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
        
        {files.length > 0 && !errors.general && (
            <p className="text-xs text-slate-300 mt-2">
                Loaded: {files.length} CSV file{files.length > 1 ? 's' : ''}.
            </p>
        )}
        {errors.general && <p className="text-xs text-red-400 mt-2">Error: {errors.general}</p>}
        {Object.keys(errors).length > 0 && !errors.general && (
             <div className="mt-2 text-xs text-red-400 space-y-1 max-h-24 overflow-y-auto">
                <p className="font-bold">Backtest failed for:</p>
                {Object.entries(errors).map(([fileName, errorMsg]) => (
                    <p key={fileName}><strong>{fileName}:</strong> {errorMsg}</p>
                ))}
             </div>
        )}

        <button 
            onClick={handleRunClick}
            disabled={files.length === 0 || isProcessing || loading}
            className="w-full mt-4 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-accent/80 hover:bg-brand-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-container-bg focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <PlayIcon className="w-5 h-5 mr-2" />
          {isProcessing ? `Processing ${files.length} file(s)...` : `Run Backtest`}
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[40vh] overflow-y-auto">
        <h3 className="text-base text-slate-300 font-semibold">Recent Runs</h3>
        {loading && !backtests.length ? (
            <>
                <BacktestSkeleton />
                <BacktestSkeleton />
            </>
        ) : (
          backtests.length > 0 ? (
            backtests.map(run => <BacktestCard key={run.id} run={run} />)
          ) : (
            <p className="text-center text-slate-400 py-4 text-sm">No backtest results found.</p>
          )
        )}
      </div>
    </div>
  );
};