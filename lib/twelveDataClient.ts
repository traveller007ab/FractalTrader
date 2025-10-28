// A client for fetching market data from the Polygon.io API.

// The API key is now securely sourced from environment variables.
// This must be set in the deployment environment.
const API_KEY = process.env.POLYGON_API_KEY;
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
        case 'SOL/USD': return 'X:SOLUSD';
        case 'XAU/USD': return 'C:XAUUSD'; // Forex
        default:
            if (symbol.includes('/')) return `C:${symbol.replace('/', '')}`;
            return symbol;
    }
}

function parseInterval(interval: TimeSeriesParams['interval']): { multiplier: number, timespan: string } {
    const supportedIntervals = ['1min', '5min', '15min', '30min', '1h', '1day', '1week', '1month'];
    if (!supportedIntervals.includes(interval)) {
        throw new Error(`Polygon.io client does not support interval: ${interval}.`);
    }

    const match = interval.match(/^(\d+)(min|h|day|week|month)$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);
    
    return {
        multiplier: parseInt(match[1], 10),
        timespan: match[2].replace('min', 'minute').replace('h', 'hour')
    };
}

const formatDate = (date: Date) => date.toISOString().split('T')[0];

export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    if (!API_KEY) {
        throw new Error("Polygon.io API key is not configured. Please set POLYGON_API_KEY environment variable.");
    }

    const { symbol, interval, outputsize = 30 } = params;
    const ticker = mapSymbolToTicker(symbol);
    const { multiplier, timespan } = parseInterval(interval);

    const to = new Date();
    const from = new Date();
    
    let daysToSubtract;
    switch (timespan) {
        case 'minute':
        case 'hour':
            daysToSubtract = Math.ceil((outputsize * multiplier * (timespan === 'minute' ? 1 : 60)) / (60 * 8)) + 5;
            break;
        case 'day':
            daysToSubtract = Math.ceil(outputsize * 1.8);
            break;
        default:
            daysToSubtract = outputsize * (timespan === 'week' ? 7 : 31) * 1.2;
    }
    from.setDate(to.getDate() - Math.max(daysToSubtract, 3));

    const url = new URL(`${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${formatDate(from)}/${formatDate(to)}`);
    url.searchParams.append('apiKey', API_KEY);
    url.searchParams.append('sort', 'asc');
    url.searchParams.append('limit', '5000');

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
        
        if (!data.results || data.resultsCount === 0) {
            console.warn(`No time series data returned for ${params.symbol}`);
            return [];
        }

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
        throw error;
    }
}