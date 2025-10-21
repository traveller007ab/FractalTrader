import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Auth } from './components/Auth';
import { Header } from './components/Header';
import { SignalFeed } from './components/SignalFeed';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { RightSidebar } from './components/RightSidebar';
import { ToastContainer, Toast } from './components/Toast';
import { supabase } from './lib/supabaseClient';
import { signalEngine } from './lib/signalEngine';
import { runBacktestFromData } from './lib/backtester';
import { Optimizer } from './lib/optimizer';
import { defaultStrategySettings } from './lib/strategyConfig';
import type { Session, User } from '@supabase/supabase-js';
import type { Signal, CopiedTrade, ToastMessage, StrategySettings, BacktestRun, TimeSeriesData } from './types';

export interface FileWithStatus {
  file: File;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
    const [recentBacktests, setRecentBacktests] = useState<BacktestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [strategySettings, setStrategySettings] = useState<StrategySettings>(defaultStrategySettings);
    const [engineLogs, setEngineLogs] = useState<string[]>([]);
    
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const [isBacktesting, setIsBacktesting] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [backtestProgress, setBacktestProgress] = useState({ current: 0, total: 0 });
    const stopBacktestRef = useRef(false);

    const [sessionBacktestRuns, setSessionBacktestRuns] = useState<BacktestRun[]>([]);
    const [activeBacktest, setActiveBacktest] = useState<BacktestRun | null>(null);

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
                supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(50),
                supabase.from('copied_trades').select('*').eq('user_id', currentUser.id),
                supabase.from('backtest_runs').select('*').eq('user_id', currentUser.id).order('started_at', { ascending: false }).limit(10),
                supabase.from('profiles').select('strategy_settings').eq('id', currentUser.id).single()
            ]);

            if (signalsRes.error) throw signalsRes.error;
            setSignals(signalsRes.data || []);
            
            if (copiedTradesRes.error) throw copiedTradesRes.error;
            setCopiedTrades(copiedTradesRes.data || []);
            
            if (backtestsRes.error) throw backtestsRes.error;
            setRecentBacktests(backtestsRes.data || []);

            if (profileRes.data?.strategy_settings) {
                setStrategySettings(profileRes.data.strategy_settings as StrategySettings);
            }

        } catch (error: any) {
            addToast(`Error fetching initial data: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

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
                    setStrategySettings(defaultStrategySettings);
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
                setSignals(currentSignals => [payload.new as Signal, ...currentSignals]);
                addToast(`New ${payload.new.side.toUpperCase()} signal for ${payload.new.symbol}!`, 'info');
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
        signalEngine.updateSettings(strategySettings);
        signalEngine.start();
        return () => {
            signalEngine.stop();
            console.log = originalConsoleLog;
        };
    }, [strategySettings]);

    const handleCopyTrade = async (signal: Signal) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('copied_trades').insert({
                signal_id: signal.id,
                user_id: user.id,
                executed_at: new Date().toISOString(),
                entry_price: signal.price,
                status: 'open'
            });
            if (error) throw error;
            addToast('Trade copied successfully!', 'success');
        } catch (error: any) {
            addToast(`Error copying trade: ${error.message}`, 'error');
        }
    };
    
    const handleSettingsUpdate = async (newSettings: StrategySettings) => {
        setStrategySettings(newSettings);
        signalEngine.updateSettings(newSettings);
        addToast('Live engine settings updated.', 'info');
        
        if (!user) return;
        try {
            const { error } = await supabase.from('profiles').upsert({ id: user.id, strategy_settings: newSettings });
            if (error) throw error;
        } catch(error: any) {
            addToast(`Failed to save settings: ${error.message}`, 'error');
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
            const { metrics } = runBacktestFromData(parsedData, strategySettings);
            const endTime = new Date();
            const newRun: BacktestRun = {
                id: crypto.randomUUID(),
                user_id: user.id,
                strategy: "fractal_shift_rbs_v1",
                params: { symbol: file.name, ...strategySettings },
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
    
    const handleOptimize = async (file: File, parsedData: TimeSeriesData[]) => {
      if (!user) return;
      setIsOptimizing(true);
      addToast(`Optimizing strategy for ${file.name}... This may take a moment.`, 'info');
      try {
        const optimizer = new Optimizer(parsedData, strategySettings);
        const bestSettings = await optimizer.run();
        if(bestSettings) {
            handleSettingsUpdate(bestSettings);
            addToast(`Optimization complete! New settings have been applied.`, 'success');
             // Automatically run a backtest with the new settings for review
            await handleBacktestComplete(file, parsedData);
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