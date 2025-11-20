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
import { SignalIcon, CogIcon } from './components/icons.tsx';
import { getTimeSeries } from './lib/twelveDataClient.ts';
import type { Signal, CopiedTrade, StrategySettings, BacktestRun, TimeSeriesData, FullStrategySettings, BacktestMetrics } from './types.ts';

export interface FileWithStatus {
  file: File;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export interface OptimizationData {
    file: File;
    data: TimeSeriesData[];
}

// Type for the state holding optimization results
type OptimizationResultState = {
    symbol: string;
    settings: StrategySettings;
    baselineMetrics: BacktestMetrics;
    optimizedMetrics: BacktestMetrics;
} | null;

function App() {
    const { session, setSession, user, setUser, addToast } = useAppContext();
    const [signals, setSignals] = useState<Signal[]>([]);
    const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
    const [recentBacktests, setRecentBacktests] = useState<BacktestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [strategySettings, setStrategySettings] = useState<FullStrategySettings>(strategyConfig);
    const [engineLogs, setEngineLogs] = useState<string[]>([]);
    const [optimizedSettings, setOptimizedSettings] = useState<OptimizationResultState>(null);
    
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [backtestProgress, setBacktestProgress] = useState({ current: 0, total: 0 });
    const stopBacktestRef = useRef(false);

    const [sessionBacktestRuns, setSessionBacktestRuns] = useState<BacktestRun[]>([]);
    const [activeBacktest, setActiveBacktest] = useState<BacktestRun | null>(null);
    const [optimizationState, setOptimizationState] = useState<{fileId: string | null; count: number}>({ fileId: null, count: 0 });
    const [optimizationProgress, setOptimizationProgress] = useState({ text: '', evolution: [] as number[] });
    
    const isFocused = usePageFocus();
    const titleIntervalRef = useRef<number | null>(null);
    const [latestSignalId, setLatestSignalId] = useState<string | null>(null);

    // Mobile Navigation State
    const [mobileTab, setMobileTab] = useState<'dashboard' | 'tools'>('dashboard');

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
            fetchInitialData(user);
        }
    }, [isFocused, user, fetchInitialData]);


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
    
    // --- TP/SL Monitoring for Open Trades ---
    useEffect(() => {
        if (!user || copiedTrades.length === 0) return;

        const manageOpenTrades = async () => {
            const openTrades = copiedTrades.filter(t => t.status === 'open');
            if (openTrades.length === 0) return;

            for (const trade of openTrades) {
                let signal = signals.find(s => s.signal_id === trade.signal_id);
                
                // Fallback: fetch signal from DB if not in local state
                if (!signal) {
                    try {
                        const { data } = await supabase
                            .from('signals')
                            .select('*')
                            .eq('signal_id', trade.signal_id)
                            .maybeSingle();
                        if (data) signal = data as Signal;
                    } catch (e) {
                        console.error("Error fetching missing signal:", e);
                    }
                }

                if (!signal) continue;

                try {
                    // Fetch the latest candle (1 minute) to check High/Low
                    const prices = await getTimeSeries({ symbol: signal.symbol, interval: '1min', outputsize: 1 });
                    if (prices.length > 0) {
                        // getTimeSeries returns [oldest, ..., newest] (via .reverse() in client)
                        // So the last element is the most recent candle.
                        const latestCandle = prices[prices.length - 1];
                        
                        let closePrice: number | null = null;
                        let closeReason = '';

                        // Check TP/SL hits
                        if (signal.side === 'buy') {
                            if (latestCandle.low <= signal.stop_loss) {
                                closePrice = signal.stop_loss;
                                closeReason = 'Hit Stop Loss';
                            } else if (latestCandle.high >= signal.take_profit) {
                                closePrice = signal.take_profit;
                                closeReason = 'Hit Take Profit';
                            }
                        } else { // Sell
                            if (latestCandle.high >= signal.stop_loss) {
                                closePrice = signal.stop_loss;
                                closeReason = 'Hit Stop Loss';
                            } else if (latestCandle.low <= signal.take_profit) {
                                closePrice = signal.take_profit;
                                closeReason = 'Hit Take Profit';
                            }
                        }

                        // If price hit a target, close the trade
                        if (closePrice !== null) {
                            const pnl = (closePrice - trade.entry_price) * (signal.side === 'buy' ? 1 : -1) * signal.size;
                            
                            await supabase.from('copied_trades').update({
                                status: 'closed',
                                exit_price: closePrice,
                                pnl: pnl,
                            }).eq('id', trade.id);
                            
                            addToast(`${closeReason}: ${signal.symbol} closed at ${closePrice}`, pnl >= 0 ? 'success' : 'info');
                            soundManager.play(pnl >= 0 ? 'success' : 'newSignal');
                        }
                    }
                } catch (error) {
                    console.error(`Failed to monitor trade for ${signal.symbol}`, error);
                }
            }
        };

        // Run check immediately and then every 30 seconds
        manageOpenTrades();
        const interval = setInterval(manageOpenTrades, 30000);
        return () => clearInterval(interval);

    }, [copiedTrades, signals, user, addToast]);

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
    
    const handleOptimize = async (filesToOptimize: OptimizationData[], paramsToOptimize: (keyof StrategySettings)[]) => {
      if (!user || filesToOptimize.length === 0) return;
      setIsOptimizing(true);
      setOptimizedSettings(null);
      setOptimizationProgress({ text: 'Initializing...', evolution: [] });
      
      const symbolToOptimize = getSymbolFromFilename(filesToOptimize[0].file.name);
      addToast(`Optimizing ${paramsToOptimize.length} parameters for ${symbolToOptimize}...`, 'info');
      
      try {
        const optimizer = new Optimizer(filesToOptimize, strategySettings, symbolToOptimize, paramsToOptimize);
        optimizer.onProgress(({ generation, totalGenerations, bestScore }) => {
            setOptimizationProgress(prev => ({
                text: `Gen ${generation}/${totalGenerations} | Best Score: ${bestScore.toFixed(2)}`,
                evolution: [...prev.evolution, bestScore]
            }));
        });

        const result = await optimizer.run();

        if(result) {
            setOptimizedSettings({ 
                symbol: symbolToOptimize, 
                settings: result.bestSettings,
                baselineMetrics: result.baselineMetrics,
                optimizedMetrics: result.optimizedMetrics
            });
            soundManager.play('success');
            addToast('Optimization complete! Review the new settings.', 'success');
        } else {
            addToast(`Optimization could not find a better configuration for ${symbolToOptimize}.`, 'info');
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown optimization error";
        addToast(`Optimization failed: ${message}`, 'error');
      } finally {
        setIsOptimizing(false);
        setOptimizationProgress({ text: '', evolution: [] });
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
            <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow overflow-hidden pb-20 lg:pb-8 relative">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_26rem] gap-6 h-full">
                    <div 
                        className={`space-y-6 animate-fade-in-up overflow-y-auto pr-2 scroll-gutter-stable h-full ${mobileTab === 'dashboard' ? 'block' : 'hidden lg:block'}`}
                        style={{ animationDelay: '200ms' }}
                    >
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
                    <div 
                        className={`w-full lg:w-[26rem] animate-fade-in-up h-full ${mobileTab === 'tools' ? 'block' : 'hidden lg:block'}`}
                        style={{ animationDelay: '300ms' }}
                    >
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

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border z-50 px-6 py-3 flex justify-around items-center safe-area-bottom backdrop-blur-md bg-opacity-95">
                <button 
                    onClick={() => setMobileTab('dashboard')}
                    className={`flex flex-col items-center gap-1 transition-colors ${mobileTab === 'dashboard' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                    <SignalIcon className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Dashboard</span>
                </button>
                <button 
                    onClick={() => setMobileTab('tools')}
                    className={`flex flex-col items-center gap-1 transition-colors ${mobileTab === 'tools' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                    <CogIcon className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Tools</span>
                </button>
            </div>
        </div>
    );
}

export default App;