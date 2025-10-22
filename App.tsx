import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Auth } from './components/Auth.tsx';
import { Header } from './components/Header.tsx';
import { SignalFeed } from './components/SignalFeed.tsx';
import { PerformanceDashboard } from './components/PerformanceDashboard.tsx';
import { RightSidebar } from './components/RightSidebar.tsx';
import { ToastContainer, Toast } from './components/Toast.tsx';
import { supabase } from './lib/supabaseClient.ts';
import { signalEngine } from './lib/signalEngine.ts';
import { runBacktestFromData } from './lib/backtester.ts';
import { Optimizer } from './lib/optimizer.ts';
import { strategyConfig } from './lib/strategyRBSv2Config.ts';
import { getSymbolFromFilename } from './lib/utils.ts';
import { usePageFocus } from './hooks/usePageFocus.ts';
import type { Session, User } from '@supabase/supabase-js';
import type { Signal, CopiedTrade, ToastMessage, StrategySettings, BacktestRun, TimeSeriesData } from './types.ts';

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
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
    const [recentBacktests, setRecentBacktests] = useState<BacktestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [strategySettings, setStrategySettings] = useState<StrategySettings>(strategyConfig.base);
    const [engineLogs, setEngineLogs] = useState<string[]>([]);
    const [optimizedSettings, setOptimizedSettings] = useState<StrategySettings | null>(null);
    
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [backtestProgress, setBacktestProgress] = useState({ current: 0, total: 0 });
    const stopBacktestRef = useRef(false);

    const [sessionBacktestRuns, setSessionBacktestRuns] = useState<BacktestRun[]>([]);
    const [activeBacktest, setActiveBacktest] = useState<BacktestRun | null>(null);
    const [optimizationState, setOptimizationState] = useState<{fileId: string | null; count: number}>({ fileId: null, count: 0 });


    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);
    
    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const fetchInitialData = useCallback(async (currentUser: User) => {
        setLoading(true);
        try {
            const [signalsRes, copiedTradesRes, backtestsRes, profileRes] = await Promise.all([
                supabase.from('signals').select('*').order('timestamp', { ascending: false }).limit(50),
                supabase.from('copied_trades').select('*').eq('user_id', currentUser.id),
                supabase.from('backtest_runs').select('*').eq('user_id', currentUser.id).order('started_at', { ascending: false }).limit(10),
                supabase.from('profiles').select('strategy_settings').eq('id', currentUser.id).single()
            ]);

            if (signalsRes.error) throw signalsRes.error;
            setSignals(signalsRes.data as Signal[] || []);
            
            if (copiedTradesRes.error) throw copiedTradesRes.error;
            setCopiedTrades(copiedTradesRes.data || []);
            
            if (backtestsRes.error) throw backtestsRes.error;
            setRecentBacktests(backtestsRes.data || []);
            
            if (profileRes.data && profileRes.data.strategy_settings) {
                setStrategySettings(profileRes.data.strategy_settings as StrategySettings);
            }

        } catch (error: any) {
            addToast(`Error fetching data. Please check your connection and refresh.`, 'error');
            console.error("Fetch initial data error:", error);
        } finally {
            setLoading(false);
        }
    }, [addToast]);
    
    // Auto-refetch data when tab becomes visible again
    usePageFocus(() => {
        if (user) {
            addToast('Refreshing data...', 'info');
            fetchInitialData(user);
        }
    });

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchInitialData(session.user);
            } else {
                setLoading(false);
            }
        };
        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const currentUser = session?.user;
                setSession(session);
                setUser(currentUser ?? null);
                if (currentUser) {
                    fetchInitialData(currentUser);
                } else {
                    setSignals([]);
                    setCopiedTrades([]);
                    setRecentBacktests([]);
                    setStrategySettings(strategyConfig.base);
                }
            }
        );

        return () => { authListener?.subscription.unsubscribe(); };
    }, [fetchInitialData]);

    // Real-time subscriptions
    useEffect(() => {
        if (!user) return;

        const signalsChannel = supabase
            .channel('public:signals')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
                const newSignal = payload.new as Signal;
                setSignals(currentSignals => [newSignal, ...currentSignals]);
                addToast(`New ${newSignal.side.toUpperCase()} signal for ${newSignal.symbol}!`, 'info');
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
    }, [user, addToast]);

    // Initialize Signal Engine
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
            // Shorten common, verbose errors for better toast display
            let message = error.message;
            if (message.includes("Failed to fetch")) {
                message = "Signal Engine: Network error fetching market data.";
            } else if (message.includes("rate limit")) {
                message = "Signal Engine: API rate limit reached.";
            }
            addToast(message, 'error');
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
                entry_price: signal.entry_price,
                status: 'open'
            });
            if (error) throw error;
            addToast('Trade copied successfully!', 'success');
        } catch (error: any) {
            addToast(`Error copying trade: ${error.message}`, 'error');
        }
    };
    
    const handleSettingsUpdate = async (newSettings: StrategySettings, source: 'user' | 'optimizer' = 'user') => {
        setStrategySettings(newSettings);
        signalEngine.updateSettings(newSettings);

        if(source === 'optimizer') {
            addToast('Optimized settings have been applied and saved.', 'success');
        } else {
            addToast('Strategy settings saved and applied to live engine.', 'success');
        }
        
        // Clear any pending optimization results after saving
        if (optimizedSettings) {
            setOptimizedSettings(null);
        }

        if (!user) return;
        try {
            const { error } = await supabase.from('profiles').upsert({ id: user.id, strategy_settings: newSettings });
            if (error) throw error;
        } catch(error: any) {
            addToast(`Failed to save settings to profile: ${error.message}`, 'error');
        }
    };

    const handleSessionStart = () => {
        setSessionBacktestRuns([]);
        setActiveBacktest(null);
    };

    const handleBacktestComplete = async (file: File, parsedData: TimeSeriesData[], settingsToUse: StrategySettings): Promise<void> => {
        if (!user) return;
        const startTime = new Date();
        try {
            const symbol = getSymbolFromFilename(file.name);
            const { metrics } = runBacktestFromData(parsedData, settingsToUse, symbol);
            const endTime = new Date();
            const newRun: BacktestRun = {
                id: crypto.randomUUID(),
                user_id: user.id,
                strategy: "fractal_shift_rbs_v2",
                params: { symbol, ...settingsToUse },
                metrics,
                started_at: startTime.toISOString(),
                ended_at: endTime.toISOString(),
            };
            
            const { error } = await supabase.from('backtest_runs').insert(newRun);
            if (error) {
                 if(error.message.includes("violates row-level security policy")) {
                     throw new Error("DB security policy is blocking saves. Please check Supabase RLS settings.");
                } else if (error.message.toLowerCase().includes('fetch')) {
                    throw new Error("Network error: Backtest ran but failed to save results.");
                }
                throw error;
            }

            setRecentBacktests(prev => [newRun, ...prev.slice(0, 9)]);
            setSessionBacktestRuns(prev => [...prev, newRun]);
            setActiveBacktest(newRun);

        } catch (e: unknown) {
             let message = 'An unknown error occurred during backtest.';
            if (e instanceof Error) {
                message = e.message;
            } else if (typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string') {
                message = (e as any).message;
            } else if (typeof e === 'string') {
                message = e;
            }
            console.error("Backtest error:", e);
            addToast(`Backtest for ${file.name} failed: ${message}`, 'error');
            throw new Error(message);
        }
    };
    
    const handleOptimize = async (filesToOptimize: OptimizationData[]) => {
      if (!user || filesToOptimize.length === 0) return;
      setIsOptimizing(true);
      setOptimizedSettings(null); // Clear previous results
      
      const fileId = filesToOptimize.map(f => `${f.file.name}-${f.file.size}`).sort().join(';');
      const currentCount = optimizationState.fileId === fileId ? optimizationState.count : 0;
      
      const fileNames = filesToOptimize.length > 1 ? `${filesToOptimize.length} files` : filesToOptimize[0].file.name;
      addToast(
        currentCount === 0
          ? `Optimizing strategy for ${fileNames}... This may take a moment.`
          : `Refining optimization (Lvl ${currentCount + 1})...`,
        'info'
      );
      
      try {
        const optimizer = new Optimizer(filesToOptimize, strategySettings, currentCount);
        const bestSettings = await optimizer.run();

        if(bestSettings) {
            setOptimizedSettings(bestSettings);
            addToast('Optimization complete! Review the new settings.', 'success');
            
            // Automatically run a "preview" backtest with the new settings if it was a single file
            if (filesToOptimize.length === 1) {
                await handleBacktestComplete(filesToOptimize[0].file, filesToOptimize[0].data, bestSettings);
            }
            setOptimizationState({ fileId, count: currentCount + 1 });
        } else {
            addToast(`Optimization could not find a better configuration.`, 'info');
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown optimization error";
        addToast(`Optimization failed: ${message}`, 'error');
      } finally {
        setIsOptimizing(false);
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
        <div className="bg-dark-bg min-h-screen text-slate-300">
            <Header session={session} onSignOut={() => supabase.auth.signOut()} />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-grow space-y-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
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
                            user={user}
                        />
                    </div>
                    <div className="flex-shrink-0 w-full lg:w-[26rem] animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                        <RightSidebar 
                            strategySettings={strategySettings} 
                            onSettingsUpdate={(settings) => handleSettingsUpdate(settings, 'user')}
                            onApplyOptimizedSettings={(settings) => handleSettingsUpdate(settings, 'optimizer')}
                            engineLogs={engineLogs}
                            files={files}
                            setFiles={setFiles}
                            isBacktesting={isBacktesting}
                            setIsBacktesting={setIsBacktesting}
                            isOptimizing={isOptimizing}
                            backtestProgress={backtestProgress}
                            setBacktestProgress={setBacktestProgress}
                            stopBacktestRef={stopBacktestRef}
                            onRunBacktest={(file, data) => handleBacktestComplete(file, data, strategySettings)}
                            onOptimize={handleOptimize}
                            onSessionStart={handleSessionStart}
                            recentBacktests={recentBacktests}
                            onViewBacktest={setActiveBacktest}
                            optimizationState={optimizationState}
                            onClearFiles={handleClearFiles}
                            optimizedSettings={optimizedSettings}
                            onClearOptimizedSettings={() => setOptimizedSettings(null)}
                        />
                    </div>
                </div>
            </main>
            <ToastContainer>
                {toasts.map(toast => (
                    <Toast 
                        key={toast.id}
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                    />
                ))}
            </ToastContainer>
        </div>
    );
}

export default App;