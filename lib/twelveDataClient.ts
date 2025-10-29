// This client interacts with the backend server, which acts as a secure proxy for market data.
import type { TimeSeriesData } from './types.ts';

const API_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';

interface TimeSeriesParams {
    symbol: string;
    interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month';
    outputsize?: number;
}

/**
 * Fetches time series data from the backend proxy.
 * @param params An object containing the symbol, interval, and outputsize.
 * @returns A promise that resolves to an array of TimeSeriesData.
 */
export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    const { symbol, interval, outputsize = 30 } = params;

    try {
        const url = new URL(`${API_URL}/timeseries`);
        url.searchParams.append('symbol', symbol);
        url.searchParams.append('interval', interval);
        url.searchParams.append('outputsize', outputsize.toString());

        const response = await fetch(url.toString());
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown backend error occurred' }));
            throw new Error(errorData.message || `Backend error (${response.status})`);
        }

        const data = await response.json();
        
        // The backend is responsible for returning data in the correct format (TimeSeriesData[])
        // and chronological order (oldest to newest).
        return data;

    } catch (error) {
        console.error(`Failed to fetch time series for ${symbol} from backend:`, error);
        throw new Error("Failed to fetch"); // Throw a generic error for the UI.
    }
}