import { useState, useEffect, useCallback } from 'react';
// Fix: Add file extensions to imports
import { getTimeSeries } from '../lib/twelveDataClient.ts';
import type { TimeSeriesData } from '../types.ts';

interface MarketDataState {
    data: TimeSeriesData[];
    loading: boolean;
    error: string | null;
}

export function useMarketData(symbol: string, interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month', outputsize: number) {
    const [state, setState] = useState<MarketDataState>({
        data: [],
        loading: true,
        error: null,
    });

    const fetchData = useCallback(async () => {
        setState(s => ({ ...s, loading: true, error: null }));
        try {
            const timeSeriesData = await getTimeSeries({ symbol, interval, outputsize });
            // API returns newest first, so we reverse for charting
            setState({ data: timeSeriesData.reverse(), loading: false, error: null });
        } catch (err: any) {
            let errorMessage = 'Failed to fetch market data.';
            if (typeof err.message === 'string' && err.message.startsWith('RATE_LIMIT_EXCEEDED')) {
                 errorMessage = "API rate limit reached. Please wait a minute and try again.";
            }
            setState({ data: [], loading: false, error: errorMessage });
        }
    }, [symbol, interval, outputsize]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { ...state, refetch: fetchData };
}
