import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Signal, CopiedTrade, BacktestRun, PerformanceMetrics, PnlDataPoint } from '../types';
import type { User } from '@supabase/supabase-js';

export function useMarketData(user: User | null) {
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [copiedTrades, setCopiedTrades] = useState<CopiedTrade[]>([]);
  const [backtests, setBacktests] = useState<BacktestRun[]>([]);
  const [pnlHistory, setPnlHistory] = useState<PnlDataPoint[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    total_pnl: 0,
    win_rate: 0,
    max_drawdown: 0,
    avg_return: 0,
    latency_ms: 0,
  });
  const [userPnl, setUserPnl] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
        setLoading(false);
        return;
    };
    
    setLoading(true);
    
    try {
      const [signalsRes, tradesRes, backtestsRes] = await Promise.all([
        supabase.from('signals').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('copied_trades').select('*'),
        supabase.from('backtest_runs').select('*').order('started_at', { ascending: false }).limit(10)
      ]);

      if (signalsRes.error) throw signalsRes.error;
      if (tradesRes.error) throw tradesRes.error;
      if (backtestsRes.error) throw backtestsRes.error;
      
      const allTrades = tradesRes.data || [];
      const userTrades = allTrades.filter(t => t.user_id === user.id);

      setSignals(signalsRes.data || []);
      setCopiedTrades(allTrades);
      setBacktests(backtestsRes.data || []);

      // Calculate Metrics
      const closedTrades = allTrades.filter(t => t.status === 'closed' && t.pnl != null);
      const totalPnl = closedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
      
      const currentUserPnl = userTrades
        .filter(t => t.status === 'closed' && t.pnl != null)
        .reduce((acc, t) => acc + (t.pnl || 0), 0);
      setUserPnl(currentUserPnl);

      setPerformanceMetrics({
        total_pnl: totalPnl,
        win_rate: winRate,
        max_drawdown: 15.2, // Mocked for now
        avg_return: 2.1, // Mocked for now
        latency_ms: Math.floor(Math.random() * 50) + 20, // Mocked latency
      });

      // Generate P&L History Chart Data
      const pnlData: PnlDataPoint[] = closedTrades
        .sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime())
        .reduce((acc, trade) => {
            const lastPnl = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
            acc.push({
                date: new Date(trade.executed_at).toLocaleDateString(),
                pnl: lastPnl + (trade.pnl || 0)
            });
            return acc;
        }, [] as PnlDataPoint[]);
      setPnlHistory(pnlData);

    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    const signalChannel = supabase
      .channel('public:signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, (payload) => {
        setSignals(currentSignals => [payload.new as Signal, ...currentSignals]);
      })
      .subscribe();
      
    const tradeChannel = supabase
      .channel('public:copied_trades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'copied_trades' }, () => {
        fetchData(); // Re-fetch all data on trade changes to update metrics
      })
      .subscribe();

    return () => {
      supabase.removeChannel(signalChannel);
      supabase.removeChannel(tradeChannel);
    };
  }, [user, fetchData]);

  return { loading, signals, backtests, pnlHistory, performanceMetrics, userPnl };
}
