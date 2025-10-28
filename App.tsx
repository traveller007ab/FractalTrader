import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Auth } from './components/Auth.tsx';
import { Header } from './components/Header.tsx';
import { SignalFeed } from './components/SignalFeed.tsx';
import { PerformanceDashboard } from './components/PerformanceDashboard.tsx';
import { RightSidebar } from './components/RightSidebar.tsx';
import { supabase } from './lib/supabaseClient.ts';
import { signalEngine } from './lib/signalEngine.ts';
import { runBacktestFromData } from './lib/backtester.ts';
import { Optimizer } from './lib/optimizer.ts';
import { strategyConfig } from './lib/strategyRBSv2Config.ts';
import { getSymbolFromFilename } from './lib/utils.ts';
import { usePageFocus } from './hooks/usePageFocus.ts';
import { soundManager } from './lib/soundManager.ts';
import { useAppContext } from './contexts/AppContext.tsx';
import type { Signal, CopiedTrade, StrategySettings, BacktestRun, TimeSeriesData, FullStrategySettings } from './types.ts';

export interface FileWithStatus {
  file: File;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export interface OptimizationData {
    file: File;
    data: TimeSeriesData[];
}

function App() {
    const { session, setSession, user, setUser, addToast } = useAppContext();
    const [signals, setSignals] = useState<Signal[]>([]);
    const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
    const [recentBacktests, setRecentBacktests] = useState<BacktestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategySettings, setStrategySettings] = useState<FullStrategySettings>(strategyConfig);
    const [engineLogs, setEngineLogs] = useState<string[]>([]);
    const [optimizedSettings, setOptimizedSettings] = useState<{ symbol: string; settings: StrategySettings } | null>(null);
    
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [backtestProgress, setBacktestProgress] = useState({ current: 0, total: 0 });
    const stopBacktestRef = useRef(false);

    const [sessionBacktestRuns, setSessionBacktestRuns] = useState<BacktestRun[]>([]);
    const [activeBacktest, setActiveBacktest] = useState<BacktestRun | null>(null);
    const [optimizationState, setOptimizationState] = useState<{fileId: string | null; count: number}>({ fileId: null, count: 0 });
    const [optimizationProgress, setOptimizationProgress] = useState('');
    
    const isFocused = usePageFocus();
    const titleIntervalRef = useRef<number | null>(null);
    const [latestSignalId, setLatestSignalId] = useState<string | null>(null);

    // Effect for dynamic document title
    useEffect(() => {
        if (isFocused) {
            if (titleIntervalRef.current) {
                clearInterval(titleIntervalRef.current);
                titleIntervalRef.current = null;
            }
            document.title = 'SignalFlow';
        }
    }, [isFocused]);

    const fetchInitialData = useCallback(async (currentUser: NonNullable<typeof user>) => {
        setLoading(true);
        try {
            const [signalsRes, copiedTradesRes, backtestsRes, profileRes] = await Promise.all([
                supabase.from('signals').select('*').order('timestamp', { ascending: false }).limit(50),
                supabase.from('copied_trades').select('*').eq('user_id', currentUser.id),
                supabase.from('backtest_runs').select('*').eq('user_id', currentUser.id).order('started_at', { ascending: false }).limit(10),
                supabase.from('profiles').select('strategy_settings').eq('id', currentUser.id).maybeSingle()
            ]);

            if (signalsRes.error) throw signalsRes.error;
            const fetchedSignals = signalsRes.data as Signal[] || [];
            setSignals(fetchedSignals);
            if (fetchedSignals.length > 0) {
                setLatestSignalId(fetchedSignals[0].signal_id);
            }
            
            if (copiedTradesRes.error) throw copiedTradesRes.error;
            setCopiedTrades(copiedTradesRes.data || []);
            
            if (backtestsRes.error) throw backtestsRes.error;
            setRecentBacktests(backtestsRes.data || []);
            
            if (profileRes.error) throw profileRes.error;
            if (profileRes.data && profileRes.data.strategy_settings) {
                const loadedSettings = profileRes.data.strategy_settings as Partial<FullStrategySettings>;
                const mergedSettings: FullStrategySettings = {
                    ...strategyConfig,
                    ...loadedSettings,
                    base: { ...strategyConfig.base, ...(loadedSettings.base || {}) },
                    symbols: { ...strategyConfig.symbols, ...(loadedSettings.symbols || {}) },
                };
                setStrategySettings(mergedSettings);
            }

        } catch (error: any) {
            let message = "Error fetching initial data.";
            if (error && typeof error.message === 'string') {
                message = error.message;
            }
            addToast(message, 'error');
            console.error("Fetch initial data error:", error);
        } finally {
            setLoading(false);
        }
    }, [addToast]);
    
    // Refresh data on page focus
    useEffect(() => {
        if (isFocused && user) {
            addToast('Refreshing data...', 'info');
            fetchInitialData(user);
        }
    }, [isFocused, user, fetchInitialData, addToast]);


    useEffect(() => {
        const getSession = async () => {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            if (currentSession?.user) {
                fetchInitialData(currentSession.user);
            } else {
                setLoading(false);
            }
        };
        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, currentSession) => {
                const currentUser = currentSession?.user;
                setSession(currentSession);
                setUser(currentUser ?? null);
                if (currentUser) {
                    fetchInitialData(currentUser);
                } else {
                    setSignals([]);
                    setCopiedTrades([]);
                    setRecentBacktests([]);
                    setStrategySettings(strategyConfig);
                }
            }
        );

        return () => { authListener?.subscription.unsubscribe(); };
    }, [fetchInitialData, setSession, setUser]);

    useEffect(() => {
        if (!user) return;

        const signalsChannel = supabase
            .channel('public:signals')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
                const newSignal = payload.new as Signal;
                setSignals(currentSignals => [newSignal, ...currentSignals]);
                
                if (newSignal.signal_id !== latestSignalId) {
                    setLatestSignalId(newSignal.signal_id);
                    addToast(`New ${newSignal.side.toUpperCase()} signal for ${newSignal.symbol}!`, 'info');
                    soundManager.play('newSignal');

                    if (!isFocused) {
                        let isFlashing = false;
                        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
                        titleIntervalRef.current = window.setInterval(() => {
                            document.title = isFlashing ? 'SignalFlow' : `New Signal! | ${newSignal.symbol}`;
                            isFlashing = !isFlashing;
                        }, 1000);
                    }
                }
            })
            .subscribe();
        
        const fetchCopiedTrades = async () => {
            if (!user) return;
            const { data } = await supabase.from('copied_trades').select('*').eq('user_id', user.id);
            setCopiedTrades(data || []);
        };

        const copiedTradesChannel = supabase
            .channel(`public:copied_trades:user_id=eq.${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'copied_trades' }, fetchCopiedTrades)
            .subscribe();

        return () => {
            supabase.removeChannel(signalsChannel);
            supabase.removeChannel(copiedTradesChannel);
        };
    }, [user, addToast, isFocused, latestSignalId]);

    useEffect(() => {
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            originalConsoleLog.apply(console, args);
            if(args[0]?.toString().startsWith('[SignalEngine]')) {
                 const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
                 setEngineLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message.substring(15)}`, ...prev.slice(0, 99)]);
            }
        };
        
        signalEngine.setOnError((error) => {
            addToast(`Signal Engine Error: ${error.message}`, 'error');
        });
        
        signalEngine.updateSettings(strategySettings);
        signalEngine.start();
        return () => {
            signalEngine.stop();
            console.log = originalConsoleLog;
        };
    }, [strategySettings, addToast]);

    const handleCopyTrade = async (signal: Signal) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('copied_trades').insert({
                signal_id: signal.signal_id,
                user_id: user.id,
                executed_at: new Date().toISOString(),
                entry_price: signal.price,
                status: 'open'
            });
            if (error) throw error;
            addToast('Trade copied successfully!', 'success');
            soundManager.play('success');
        } catch (error: any) {
            addToast(`Error copying trade: ${error.message}`, 'error');
        }
    };
    
    const handleSettingsUpdate = async (symbolToUpdate: string, newSettings: StrategySettings) => {
        const updatedSettings: FullStrategySettings = {
            ...strategySettings,
            base: symbolToUpdate === 'base' ? newSettings : strategySettings.base,
            symbols: {
                ...strategySettings.symbols,
                ...(symbolToUpdate !== 'base' && { [symbolToUpdate]: newSettings }),
            }
        };

        setStrategySettings(updatedSettings);
        signalEngine.updateSettings(updatedSettings);

        addToast(`${symbolToUpdate.toUpperCase()} settings saved and applied.`, 'success');
        soundManager.play('success');
        
        if (optimizedSettings) {
            setOptimizedSettings(null);
        }

        if (!user) return;
        try {
            const { error } = await supabase.from('profiles').upsert({ id: user.id, strategy_settings: updatedSettings });
            if (error) throw error;
        } catch(error: any) {
            addToast(`Failed to save settings to profile: ${error.message}`, 'error');
        }
    };

    const handleSessionStart = () => {
        setSessionBacktestRuns([]);
        setActiveBacktest(null);
    };

    const handleBacktestComplete = async (file: File, parsedData: TimeSeriesData[]): Promise<void> => {
        if (!user) return;
        const startTime = new Date();
        try {
            const symbol = getSymbolFromFilename(file.name);
            const { metrics } = runBacktestFromData(parsedData, strategySettings, symbol);
            const endTime = new Date();
            const newRun: BacktestRun = {
                id: crypto.randomUUID(),
                user_id: user.id,
                strategy: "fractal_shift_rbs_v2",
                params: { symbol, ...strategySettings },
                metrics,
                started_at: startTime.toISOString(),
                ended_at: endTime.toISOString(),
            };
            
            const { error } = await supabase.from('backtest_runs').insert(newRun);
            if (error) throw error;

            setRecentBacktests(prev => [newRun, ...prev.slice(0, 9)]);
            setSessionBacktestRuns(prev => [...prev, newRun]);
            setActiveBacktest(newRun);

        } catch (e: unknown) {
             let message = 'An unknown error occurred during backtest.';
            if (e instanceof Error) message = e.message;
            console.error("Backtest error:", e);
            addToast(`Backtest for ${file.name} failed: ${message}`, 'error');
            throw new Error(message);
        }
    };
    
    const handleOptimize = async (filesToOptimize: OptimizationData[]) => {
      if (!user || filesToOptimize.length === 0) return;
      setIsOptimizing(true);
      setOptimizedSettings(null);
      setOptimizationProgress('');
      
      const symbolToOptimize = getSymbolFromFilename(filesToOptimize[0].file.name);
      addToast(`Optimizing for ${symbolToOptimize}... This may take a moment.`, 'info');
      
      try {
        const optimizer = new Optimizer(filesToOptimize, strategySettings, symbolToOptimize);
        optimizer.onProgress(({ generation, totalGenerations, bestScore }) => {
            setOptimizationProgress(`Gen ${generation}/${totalGenerations} | Best Score: ${bestScore.toFixed(2)}`);
        });

        const bestSettings = await optimizer.run();

        if(bestSettings) {
            setOptimizedSettings({ symbol: symbolToOptimize, settings: bestSettings });
            addToast('Optimization complete! Review the new settings.', 'success');
        } else {
            addToast(`Optimization could not find a better configuration for ${symbolToOptimize}.`, 'info');
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown optimization error";
        addToast(`Optimization failed: ${message}`, 'error');
      } finally {
        setIsOptimizing(false);
        setOptimizationProgress('');
      }
    }

    const handleClearFiles = () => {
        setFiles([]);
        setOptimizationState({ fileId: null, count: 0 });
    };


    if (!session) {
        return <Auth />;
    }

    return (
        <div className="bg-bg-primary h-screen text-text-secondary flex flex-col overflow-hidden">
            <Header onSignOut={() => supabase.auth.signOut()} />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_26rem] gap-6 h-full">
                    <div className="space-y-6 animate-fade-in-up overflow-y-auto pr-2" style={{ animationDelay: '200ms' }}>
                        <PerformanceDashboard 
                            copiedTrades={copiedTrades}
                            sessionBacktestRuns={sessionBacktestRuns}
                            activeBacktest={activeBacktest}
                            onClearActiveBacktest={() => setActiveBacktest(null)}
                        />
                        <SignalFeed
                            signals={signals}
                            onCopyTrade={handleCopyTrade}
                            onRefresh={() => user && fetchInitialData(user)}
                            loading={loading}
                            copiedTrades={copiedTrades}
                        />
                    </div>
                    <div className="w-full lg:w-[26rem] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <RightSidebar 
                            strategySettings={strategySettings} 
                            onSettingsUpdate={handleSettingsUpdate}
                            engineLogs={engineLogs}
                            files={files}
                            setFiles={setFiles}
                            isBacktesting={isBacktesting}
                            setIsBacktesting={setIsBacktesting}
                            isOptimizing={isOptimizing}
                            backtestProgress={backtestProgress}
                            setBacktestProgress={setBacktestProgress}
                            stopBacktestRef={stopBacktestRef}
                            onRunBacktest={handleBacktestComplete}
                            onOptimize={handleOptimize}
                            onSessionStart={handleSessionStart}
                            recentBacktests={recentBacktests}
                            onViewBacktest={setActiveBacktest}
                            optimizationState={optimizationState}
                            onClearFiles={handleClearFiles}
                            optimizedSettings={optimizedSettings}
                            onClearOptimizedSettings={() => { setOptimizedSettings(null); soundManager.play('click'); }}
                            signals={signals}
                            optimizationProgress={optimizationProgress}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
