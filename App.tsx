import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { signalEngine } from './lib/signalEngine';
import { useMarketData } from './hooks/useMarketData';
import { runBacktestFromData } from './lib/backtester';
import { defaultStrategySettings } from './lib/strategyConfig';
import type { Signal, TimeSeriesData, StrategySettings, CopiedTrade } from './types';

import { Header } from './components/Header';
import { Auth } from './components/Auth';
import { SignalFeed } from './components/SignalFeed';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { BacktestResults } from './components/BacktestResults';
import { StrategySettings as StrategySettingsComponent } from './components/StrategySettings';
import { Toast, ToastContainer } from './components/Toast';

type ToastMessage = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [strategySettings, setStrategySettings] = useState<StrategySettings>(defaultStrategySettings);
  
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    
    // Set up a global error handler for the signal engine
    signalEngine.setOnError((error) => {
        if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
            addToast('API credit limit reached. The live engine will pause for a moment.', 'error');
        } else {
            addToast('An unexpected error occurred in the signal engine.', 'error');
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user-specific settings on session load
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (session?.user) {
        try {
            const { data, error } = await supabase
              .from('profiles')
              .select('strategy_settings')
              .eq('id', session.user.id)
              .maybeSingle();
            
            if (error) throw error;

            if (data && data.strategy_settings) {
                const fetchedSettings = data.strategy_settings as StrategySettings;
                if (Object.keys(fetchedSettings).length > 0) {
                     console.log('Loaded settings from profile:', fetchedSettings);
                     setStrategySettings(fetchedSettings);
                     signalEngine.updateSettings(fetchedSettings);
                }
            } else {
                console.log('No user settings found, using default.');
                setStrategySettings(defaultStrategySettings);
                signalEngine.updateSettings(defaultStrategySettings);
            }
        } catch(error: any) {
            console.error('Error fetching user settings:', error);
            const friendlyMessage = error.message ? `DB Error: ${error.message}` : 'Could not load your settings.';
            addToast(`${friendlyMessage} Using defaults.`, 'error');
            setStrategySettings(defaultStrategySettings);
            signalEngine.updateSettings(defaultStrategySettings);
        }
      }
    };

    fetchUserSettings();
  }, [session]);

  const { loading, signals, backtests, pnlHistory, performanceMetrics, userPnl, copiedTrades, fetchData } = useMarketData(session?.user ?? null);
  
  useEffect(() => {
    if (session) {
      signalEngine.start();
    } else {
      signalEngine.stop();
    }
    return () => signalEngine.stop();
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCopyTrade = async (signal: Signal) => {
    if (!session?.user) {
      addToast('You must be logged in to copy a trade.', 'error');
      return;
    }

    const trade: Omit<CopiedTrade, 'id'> = {
      signal_id: signal.id,
      user_id: session.user.id,
      executed_at: new Date().toISOString(),
      entry_price: signal.price,
      // Simulate an immediate close with random P&L for demo purposes
      status: 'closed',
      pnl: (Math.random() - 0.45) * 100 // Random PnL between approx -$45 and +$55
    };
    
    const { error } = await supabase.from('copied_trades').insert(trade);

    if (error) {
      addToast(`Error copying trade: ${error.message}`, 'error');
      console.error(error);
    } else {
      addToast(`Successfully copied ${signal.symbol} ${signal.side} trade.`, 'success');
    }
  };

  const handleRunBacktest = async (csvData: TimeSeriesData[], fileName: string) => {
    if (!session?.user) {
      addToast('You must be logged in to run a backtest.', 'error');
      return;
    }
    
    addToast(`Running backtest on ${fileName}...`, 'info');

    try {
        const metrics = await runBacktestFromData(csvData, strategySettings);
        const backtestRun = {
            user_id: session.user.id,
            strategy: `Fractal Shift (${fileName})`,
            params: strategySettings,
            metrics: metrics,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('backtest_runs').insert(backtestRun);
        if (error) throw error;
        
        addToast('Backtest completed successfully!', 'success');

    } catch (error: any) {
        addToast(`Backtest failed: ${error.message}`, 'error');
        console.error('Backtest error:', error);
    }
  };
  
  const handleSettingsChange = async (newSettings: StrategySettings) => {
    if (!session?.user) {
        addToast('Cannot save settings without a user session.', 'error');
        return;
    }

    setStrategySettings(newSettings);
    signalEngine.updateSettings(newSettings);
    addToast('Strategy settings applied to live engine.', 'info');

    // Persist to Supabase
    // FIX: Removed updated_at as the column may not exist. Supabase can handle this automatically if configured.
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, strategy_settings: newSettings });
    
    if (error) {
        addToast('Failed to save settings to your profile.', 'error');
        console.error('Error saving settings:', error);
    } else {
        addToast('Settings saved to your profile.', 'success');
    }
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <Header session={session} onSignOut={handleSignOut} />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <PerformanceDashboard metrics={performanceMetrics} pnlHistory={pnlHistory} userPnl={userPnl} loading={loading} />
                <SignalFeed signals={signals} onCopyTrade={handleCopyTrade} onRefresh={fetchData} loading={loading} copiedTrades={copiedTrades} user={session.user} />
            </div>
            <div className="lg:col-span-1 space-y-6">
                <StrategySettingsComponent settings={strategySettings} onSettingsChange={handleSettingsChange} defaultSettings={defaultStrategySettings} />
                <BacktestResults backtests={backtests} loading={loading} onRunBacktest={handleRunBacktest} />
            </div>
        </div>
      </main>
      <ToastContainer>
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onClose={() => setToasts(p => p.filter(t => t.id !== toast.id))} />
        ))}
      </ToastContainer>
    </>
  );
}

export default App;