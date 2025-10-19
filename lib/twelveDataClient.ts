// A client for fetching market data from the Twelve Data API.

const API_KEY = 'aeb4fab6e1f34b2ea972fee5f909bb9e';
const BASE_URL = 'https://api.twelvedata.com';

interface TimeSeriesParams {
    symbol: string;
    interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month';
    outputsize?: number;
}

export interface TimeSeriesData {
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Fetches time series (OHLCV) data for a given symbol.
 * @param params - The parameters for the time series request.
 * @returns A promise that resolves to an array of time series data points.
 */
export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    const url = new URL(`${BASE_URL}/time_series`);
    url.searchParams.append('symbol', params.symbol);
    url.searchParams.append('interval', params.interval);
    url.searchParams.append('apikey', API_KEY);
    url.searchParams.append('outputsize', (params.outputsize || 30).toString());
    url.searchParams.append('format', 'JSON');
    
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = `Twelve Data API error (${response.status}): ${errorData.message || 'Unknown error'}`;
            if (response.status === 429) { // Too Many Requests
                errorMessage = `RATE_LIMIT_EXCEEDED: ${errorData.message}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
             throw new Error(`Twelve Data API error: ${data.message}`);
        }

        // The API returns an object with a 'values' key containing the array
        if (!data.values) {
            console.warn(`No time series data returned for ${params.symbol}`);
            return [];
        }

        return data.values.map((v: any) => ({
            datetime: v.datetime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseInt(v.volume, 10),
        }));

    } catch (error) {
        console.error('Failed to fetch time series data:', error);
        throw error; // Re-throw to be handled by the caller
    }
}