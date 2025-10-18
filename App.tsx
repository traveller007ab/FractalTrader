import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { signalEngine } from './lib/signalEngine';
import { useMarketData } from './hooks/useMarketData';
import type { Signal } from './types';

import { Header } from './components/Header';
import { Auth } from './components/Auth';
import { SignalFeed } from './components/SignalFeed';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { BacktestResults } from './components/BacktestResults';
import { Toast, ToastContainer } from './components/Toast';

type ToastMessage = {
  id: number;
  message: string;
  type: 'success' | 'error';
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { loading, signals, backtests, pnlHistory, performanceMetrics, userPnl } = useMarketData(session?.user ?? null);

  useEffect(() => {
    if (session) {
      // Start generating mock signals and inserting them into Supabase
      signalEngine.start();
    } else {
      signalEngine.stop();
    }
    return () => signalEngine.stop();
  }, [session]);

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  const handleCopyTrade = async (signal: Signal) => {
    if (!session) {
        addToast('You must be logged in to copy a trade.', 'error');
        return;
    }
    console.log('Copying trade for signal:', signal.id);
    // Simulate trade execution
    const entry_price = signal.price + (Math.random() - 0.5) * 0.1 * signal.price; // simulate slippage
    const pnl = (Math.random() - 0.45) * signal.price * 0.1 * signal.size; // simulate P&L
    
    const { error } = await supabase.from('copied_trades').insert({
        signal_id: signal.id,
        user_id: session.user.id,
        executed_at: new Date().toISOString(),
        entry_price: entry_price,
        exit_price: entry_price + pnl / signal.size,
        pnl: pnl,
        status: 'closed', // For simplicity, we close it immediately
    });

    if (error) {
        addToast(`Error copying trade: ${error.message}`, 'error');
    } else {
        addToast(`Successfully copied trade for ${signal.symbol}`, 'success');
    }
  };

  const handleRunBacktest = () => {
    addToast('Feature not implemented yet.', 'error');
    console.log('Running new backtest...');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="bg-slate-900 text-slate-200 min-h-screen">
      <Header session={session} onSignOut={handleSignOut} />
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            <PerformanceDashboard 
              metrics={performanceMetrics} 
              pnlHistory={pnlHistory}
              userPnl={userPnl}
              loading={loading}
            />
            <SignalFeed signals={signals} onCopyTrade={handleCopyTrade} />
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <BacktestResults backtests={backtests} loading={loading} onRunBacktest={handleRunBacktest} />
          </div>
        </div>
      </main>
      <ToastContainer>
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </ToastContainer>
    </div>
  );
}

export default App;
