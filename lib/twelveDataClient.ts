import type { TimeSeriesData } from './types.ts';

// NOTE: In this environment, we are using the API key directly on the client.
// We reverted from the backend proxy because the local backend server is not accessible in this preview.
const API_KEY = 'aeb4fab6e1f34b2ea972fee5f909bb9e';
const BASE_URL = 'https://api.twelvedata.com';

/**
 * Fetches time series data directly from Twelve Data API.
 * @param params An object containing the symbol, interval, and outputsize.
 * @returns A promise that resolves to an array of TimeSeriesData.
 */
export async function getTimeSeries(params: { symbol: string, interval: string, outputsize?: number }): Promise<TimeSeriesData[]> {
    const { symbol, interval, outputsize = 100 } = params;

    try {
        const url = new URL(`${BASE_URL}/time_series`);
        url.searchParams.append('symbol', symbol);
        url.searchParams.append('interval', interval);
        url.searchParams.append('outputsize', outputsize.toString());
        url.searchParams.append('apikey', API_KEY);
        
        const response = await fetch(url.toString());

        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData.message || `TwelveData API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
             throw new Error(data.message || 'Unknown TwelveData error');
        }
        
        if (!data.values || !Array.isArray(data.values)) {
            console.warn(`[TwelveData] No values returned for ${symbol}. Response:`, data);
            return [];
        }

        // Twelve Data returns newest first. 
        // The app expects chronological order (oldest to newest) for calculations/charts.
        return data.values.map((item: any) => ({
            datetime: new Date(item.datetime).toISOString(),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || '0'),
        })).reverse();

    } catch (error: any) {
        console.error(`Failed to fetch time series for ${symbol}:`, error.message);
        throw error; 
    }
}