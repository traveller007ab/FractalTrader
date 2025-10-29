// This client interacts directly with the Finnhub API for market data.
// This is suitable for static deployments like Netlify where a backend is not available for this task.
import type { TimeSeriesData } from './types.ts';

const FINNHUB_API_KEY = 'd410e09r01qtsbunbe3gd410e09r01qtsbunbe40';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Maps the app's interval strings to Finnhub's resolution codes.
 * @param interval The interval string from the client (e.g., '15min').
 * @returns The corresponding Finnhub resolution code (e.g., '15').
 */
const mapIntervalToResolution = (interval: string): string => {
    const mapping: { [key: string]: string } = {
        '1min': '1', '5min': '5', '15min': '15', '30min': '30',
        '1h': '60', '1day': 'D', '1week': 'W', '1month': 'M',
    };
    if (mapping[interval]) {
        return mapping[interval];
    }
    console.warn(`[Finnhub Client] Unsupported interval '${interval}', defaulting to 15min.`);
    return '15'; // Default for unsupported intervals like '45min', '2h', etc.
};

/**
 * Gets the correct symbol format and API endpoint for a given app symbol.
 * @param symbol The application's symbol format (e.g., 'BTC/USD').
 * @returns An object with the finnhubSymbol and the correct API endpoint.
 */
const getFinnhubParams = (symbol: string): { finnhubSymbol: string; endpoint: string } => {
    const cryptoSymbols: { [key: string]: string } = {
        'BTC/USD': 'BINANCE:BTCUSDT',
        'ETH/USD': 'BINANCE:ETHUSDT',
        'SOL/USD': 'BINANCE:SOLUSDT',
    };
    const forexSymbols: { [key: string]: string } = {
        'XAU/USD': 'OANDA:XAU_USD',
    };

    if (cryptoSymbols[symbol]) {
        return { finnhubSymbol: cryptoSymbols[symbol], endpoint: 'crypto/candle' };
    }
    if (forexSymbols[symbol]) {
        return { finnhubSymbol: forexSymbols[symbol], endpoint: 'forex/candle' };
    }
    throw new Error(`Unsupported symbol for Finnhub: ${symbol}`);
};


interface TimeSeriesParams {
    symbol: string;
    interval: '1min' | '5min' | '15min' | '30min' | '45min' | '1h' | '2h' | '4h' | '1day' | '1week' | '1month';
    outputsize?: number;
}


/**
 * Fetches time series data directly from the Finnhub API.
 * @param params An object containing the symbol, interval, and outputsize.
 * @returns A promise that resolves to an array of TimeSeriesData.
 */
export async function getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesData[]> {
    const { symbol, interval, outputsize = 100 } = params;

    try {
        const { finnhubSymbol, endpoint } = getFinnhubParams(symbol);
        const resolution = mapIntervalToResolution(interval);

        // Finnhub uses `from` and `to` timestamps. We calculate them based on outputsize.
        const to = Math.floor(Date.now() / 1000);
        const count = outputsize;
        const now = new Date();
        let from;

        const resolutionInMinutes = parseInt(resolution, 10);
        if (!isNaN(resolutionInMinutes)) {
            from = to - (count * resolutionInMinutes * 60);
        } else {
            switch (resolution) {
                case 'D': from = Math.floor(new Date(now.setDate(now.getDate() - count)).getTime() / 1000); break;
                case 'W': from = Math.floor(new Date(now.setDate(now.getDate() - count * 7)).getTime() / 1000); break;
                case 'M': from = Math.floor(new Date(now.setMonth(now.getMonth() - count)).getTime() / 1000); break;
                default: from = to - (count * 15 * 60); // Fallback for safety
            }
        }

        const url = new URL(`${FINNHUB_BASE_URL}/${endpoint}`);
        url.searchParams.append('symbol', finnhubSymbol);
        url.searchParams.append('resolution', resolution);
        url.searchParams.append('from', from.toString());
        url.searchParams.append('to', to.toString());
        url.searchParams.append('token', FINNHUB_API_KEY);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok || data.s === 'error') {
            const errorMessage = response.status === 403
                ? "You don't have access to this resource."
                : (data.errmsg || 'Failed to fetch data');
            throw new Error(`Finnhub API error (${response.status}): ${errorMessage}`);
        }

        if (data.s === 'no_data' || !data.t) {
            console.warn(`No time series values returned for ${symbol} (${finnhubSymbol}) from Finnhub.`);
            return [];
        }

        // Map Finnhub's response to the application's TimeSeriesData format.
        const mappedData = [];
        for (let i = 0; i < data.t.length; i++) {
            mappedData.push({
                datetime: new Date(data.t[i] * 1000).toISOString(),
                open: data.o[i],
                high: data.h[i],
                low: data.l[i],
                close: data.c[i],
                volume: data.v[i],
            });
        }
        
        return mappedData;

    } catch (error: any) {
        console.error(`Failed to fetch time series for ${symbol} from Finnhub:`, error.message);
        throw new Error("Failed to fetch"); // Generic error for the UI.
    }
}
