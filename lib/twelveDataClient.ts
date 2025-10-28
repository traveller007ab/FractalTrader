// A client for fetching market data directly from Polygon.io.
import type { TimeSeriesData } from './types.ts';

const API_KEY = 'Y8WARtovmM_YrVfZeFiZPUfEQJ4v3uJI';
const BASE_URL = 'https://api.polygon.io';

interface TimeSeriesParams {
    symbol: string;
    interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month';
    outputsize?: number;
}

/**
 * Maps a trading pair symbol (e.g., 'BTC/USD') to the format expected by the Polygon.io API.
 * @param symbol The input symbol.
 * @returns The ticker symbol for Polygon.io.
 */
function mapSymbolToTicker(symbol: string): string {
    switch (symbol) {
        case 'BTC/USD': return 'X:BTCUSD';
        case 'ETH/USD': return 'X:ETHUSD';
        case 'SOL/USD': return 'X:SOLUSD';
        case 'XAU/USD': return 'C:XAUUSD'; // Forex
        default:
            if (symbol.includes('/')) return `C:${symbol.replace('/', '')}`;
            return symbol;
    }
}

/**
 * Parses the interval string (e.g., '15min') into a multiplier and timespan for the Polygon.io API.
 * @param interval The interval string from TimeSeriesParams.
 * @returns An object with the multiplier and timespan.
 */
function parseInterval(interval: TimeSeriesParams['interval']): { multiplier: number; timespan: string } {
    const match = interval.match(/^(\d+)([a-zA-Z]+)$/);
    if (!match) {
        throw new Error(`Invalid interval format: ${interval}`);
    }
    
    const multiplier = parseInt(match[1], 10);
    let timespan = match[2];

    if (timespan === 'min') timespan = 'minute';
    else if (timespan === 'h') timespan = 'hour';

    return { multiplier, timespan };
}

/**
 * Formats a Date object into a 'YYYY-MM-DD' string for the API.
 * @param date The date to format.
 * @returns The formatted date string.
 */
const formatDate = (date: Date): string => date.toISOString().split('T')[0];

/**
 * Fetches time series data from the Polygon.io API.
 * @param params An object containing the symbol, interval, and outputsize.
 * @returns A promise that resolves to an array of TimeSeriesData, sorted oldest to newest.
 */
export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    if (!API_KEY) {
        const errorMsg = "Polygon.io API key is not configured. Please set API_KEY environment variable.";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const { symbol, interval, outputsize = 30 } = params;

    try {
        const ticker = mapSymbolToTicker(symbol);
        const { multiplier, timespan } = parseInterval(interval);

        // Set a wide date range to ensure we find data. 'limit' is the primary controller of data volume.
        const to = new Date();
        const from = new Date();
        from.setFullYear(to.getFullYear() - 5); // A 5-year lookback is sufficient for any timeframe.

        const url = new URL(`${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${formatDate(from)}/${formatDate(to)}`);
        url.searchParams.append('apiKey', API_KEY);
        url.searchParams.append('sort', 'desc'); // Get the most recent bars first.
        url.searchParams.append('limit', String(outputsize));

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            const errorMessage = `Polygon.io API error (${response.status}): ${data.error || data.message || 'Unknown error'}`;
            if (response.status === 429) {
                throw new Error(`RATE_LIMIT_EXCEEDED: ${data.error || 'Too many requests to Polygon.io'}`);
            }
            throw new Error(errorMessage);
        }

        if (!data.results || data.results.length === 0) {
            console.warn(`No time series data returned for ${symbol} from Polygon.io.`);
            return [];
        }

        // Map the Polygon.io response format to our internal TimeSeriesData format.
        const mappedData: TimeSeriesData[] = data.results.map((bar: any) => ({
            datetime: new Date(bar.t).toISOString(),
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v,
        }));
        
        // The API returns newest-to-oldest, but our app expects oldest-to-newest.
        return mappedData.reverse();

    } catch (error) {
        console.error(`Failed to fetch time series for ${symbol}:`, error);
        throw error;
    }
}