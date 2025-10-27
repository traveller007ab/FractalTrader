// A client for fetching market data from the Polygon.io API.

const API_KEY = 'bokJ0FSxrrrl6fxpq0MMBa_pe_HuUL7M';
const BASE_URL = 'https://api.polygon.io';

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


function mapSymbolToTicker(symbol: string): string {
    switch (symbol) {
        case 'BTC/USD': return 'X:BTCUSD';
        case 'ETH/USD': return 'X:ETHUSD';
        case 'XAU/USD': return 'C:XAUUSD'; // Forex
        default:
            // Attempt a generic conversion for other forex pairs if needed
            if (symbol.includes('/')) return `C:${symbol.replace('/', '')}`;
            return symbol; // Fallback
    }
}

function parseInterval(interval: TimeSeriesParams['interval']): { multiplier: number, timespan: string } {
    // Polygon doesn't support 45min, 2h, 4h directly.
    // A more advanced implementation could fetch smaller intervals and aggregate them.
    const supportedIntervals = ['1min', '5min', '15min', '30min', '1h', '1day', '1week', '1month'];
    if (!supportedIntervals.includes(interval)) {
        throw new Error(`Polygon.io client does not support interval: ${interval}. Supported intervals are: ${supportedIntervals.join(', ')}.`);
    }

    const match = interval.match(/^(\d+)(min|h|day|week|month)$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'min': return { multiplier: value, timespan: 'minute' };
        case 'h': return { multiplier: value, timespan: 'hour' };
        case 'day': return { multiplier: value, timespan: 'day' };
        case 'week': return { multiplier: value, timespan: 'week' };
        case 'month': return { multiplier: value, timespan: 'month' };
        default: throw new Error(`Unsupported interval unit: ${unit}`);
    }
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

/**
 * Fetches time series (OHLCV) data for a given symbol from Polygon.io.
 * @param params - The parameters for the time series request.
 * @returns A promise that resolves to an array of time series data points.
 */
export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    const { symbol, interval, outputsize = 30 } = params;

    const ticker = mapSymbolToTicker(symbol);
    const { multiplier, timespan } = parseInterval(interval);

    const to = new Date();
    const from = new Date();
    
    // Heuristic calculation to determine a sufficient lookback period
    // to get at least `outputsize` data points, accounting for non-trading periods.
    let daysToSubtract;
    switch (timespan) {
        case 'minute':
        case 'hour':
             // For intraday, look back a bit more to cross weekends
            daysToSubtract = Math.ceil((outputsize * multiplier * (timespan === 'minute' ? 1 : 60)) / (60 * 8)) + 5; // Assuming ~8 trading hours + buffer
            break;
        case 'day':
            daysToSubtract = Math.ceil(outputsize * 1.8); // Buffer for weekends/holidays
            break;
        case 'week':
            daysToSubtract = outputsize * 7 * 1.2;
            break;
        case 'month':
            daysToSubtract = outputsize * 31 * 1.2;
            break;
        default:
            daysToSubtract = outputsize * 2; // Generic fallback
    }
    from.setDate(to.getDate() - Math.max(daysToSubtract, 3)); // Minimum 3 days lookback

    const url = new URL(`${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${formatDate(from)}/${formatDate(to)}`);
    url.searchParams.append('apiKey', API_KEY);
    url.searchParams.append('sort', 'asc'); // Get oldest first
    url.searchParams.append('limit', '5000'); // Fetch a good amount of data to slice from

    try {
        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            let errorMessage = `Polygon.io API error (${response.status}): ${data.error || data.message || 'Unknown error'}`;
            if (response.status === 429) {
                errorMessage = `RATE_LIMIT_EXCEEDED: ${data.error || 'Too many requests'}`;
            }
            throw new Error(errorMessage);
        }

        if (data.status === 'ERROR') {
            throw new Error(`Polygon.io API error: ${data.error || data.message}`);
        }

        if (!data.results || data.resultsCount === 0) {
            console.warn(`No time series data returned for ${params.symbol} from ${formatDate(from)} to ${formatDate(to)}`);
            return [];
        }

        // Slice the most recent `outputsize` bars from the results
        const finalData = data.results.slice(-outputsize);

        return finalData.map((v: any) => ({
            datetime: new Date(v.t).toISOString(),
            open: v.o,
            high: v.h,
            low: v.l,
            close: v.c,
            volume: v.v,
        }));

    } catch (error) {
        console.error('Failed to fetch time series data from Polygon.io:', error);
        throw error; // Re-throw to be handled by the caller
    }
}
