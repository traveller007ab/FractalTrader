import express from 'express';
import fetch from 'node-fetch';
import { getConnection } from './metaApiConnection.js';

const router = express.Router();

// Middleware for handling async route errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};


// --- Proxy for Finnhub API ---
// NOTE: For production, store this key securely as an environment variable (e.g., in a .env file).
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd410e09r01qtsbunbe3gd410e09r01qtsbunbe40';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Maps the app's interval strings to Finnhub's resolution codes.
 * @param {string} interval - The interval string from the client (e.g., '15min').
 * @returns {string} The corresponding Finnhub resolution code (e.g., '15').
 */
const mapIntervalToResolution = (interval) => {
    const mapping = {
        '1min': '1', '5min': '5', '15min': '15', '30min': '30',
        '1h': '60', '1day': 'D', '1week': 'W', '1month': 'M',
    };
    if (mapping[interval]) {
        return mapping[interval];
    }
    console.warn(`[Finnhub Proxy] Unsupported interval '${interval}', defaulting to 15min.`);
    return '15'; // Default for unsupported intervals like '45min', '2h', etc.
};

/**
 * Gets the correct symbol format and API endpoint for a given app symbol.
 * @param {string} symbol - The application's symbol format (e.g., 'BTC/USD').
 * @returns {{finnhubSymbol: string, endpoint: string}}
 */
const getFinnhubParams = (symbol) => {
    const cryptoSymbols = {
        'BTC/USD': 'BINANCE:BTCUSDT',
        'ETH/USD': 'BINANCE:ETHUSDT',
        'SOL/USD': 'BINANCE:SOLUSDT',
    };
    const forexSymbols = {
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

// GET /api/timeseries - Secure proxy for Finnhub
router.get('/timeseries', asyncHandler(async (req, res) => {
    const { symbol, interval, outputsize = '100' } = req.query;

    if (!symbol || !interval) {
        return res.status(400).json({ message: 'Symbol and interval query parameters are required.' });
    }

    try {
        const { finnhubSymbol, endpoint } = getFinnhubParams(symbol);
        const resolution = mapIntervalToResolution(interval);

        // Finnhub uses `from` and `to` timestamps instead of `outputsize`. We calculate them.
        const to = Math.floor(Date.now() / 1000);
        const count = parseInt(outputsize, 10);
        const now = new Date();
        let from;
        
        switch (resolution) {
            case 'D': from = Math.floor(new Date(now.setDate(now.getDate() - count)).getTime() / 1000); break;
            case 'W': from = Math.floor(new Date(now.setDate(now.getDate() - count * 7)).getTime() / 1000); break;
            case 'M': from = Math.floor(new Date(now.setMonth(now.getMonth() - count)).getTime() / 1000); break;
            default: // Resolution is in minutes
                from = to - (count * parseInt(resolution, 10) * 60);
        }

        const url = new URL(`${FINNHUB_BASE_URL}/${endpoint}`);
        url.searchParams.append('symbol', finnhubSymbol);
        url.searchParams.append('resolution', resolution);
        url.searchParams.append('from', from.toString());
        url.searchParams.append('to', to.toString());
        url.searchParams.append('token', FINNHUB_API_KEY);

        const finnhubResponse = await fetch(url.toString());
        const data = await finnhubResponse.json();
        
        if (!finnhubResponse.ok || data.s === 'error') {
            // Finnhub can return 403 for permission issues.
            const errorMessage = finnhubResponse.status === 403
                ? "You don't have access to this resource."
                : (data.errmsg || 'Failed to fetch data');
            throw new Error(`Finnhub API error (${finnhubResponse.status}): ${errorMessage}`);
        }

        if (data.s === 'no_data' || !data.t) {
            console.warn(`No time series values returned for ${symbol} (${finnhubSymbol}) from Finnhub.`);
            return res.json([]);
        }

        // Map Finnhub's response structure to the one expected by the application.
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

        res.status(200).json(mappedData);

    } catch (err) {
        console.error(`Error fetching from Finnhub for ${symbol} via backend:`, err.message);
        res.status(500).json({ message: err.message || 'Failed to fetch time series data' });
    }
}));


// GET /api/positions
router.get('/positions', asyncHandler(async (req, res) => {
    try {
        const connection = await getConnection();
        const positions = await connection.getPositions();
        
        const mappedPositions = positions.map(p => ({
            id: p.id,
            symbol: p.symbol,
            side: p.type === 'POSITION_TYPE_BUY' ? 'buy' : 'sell',
            volume: p.volume,
            stopLoss: p.stopLoss,
            takeProfit: p.takeProfit,
            pnl: p.profit,
            status: 'open' // getPositions only returns open positions
        }));

        res.status(200).json(mappedPositions);
    } catch (err) {
        console.error('Error fetching positions:', err.message);
        res.status(500).json({ message: 'Failed to fetch positions from MetaAPI' });
    }
}));

// POST /api/execute
router.post('/execute', asyncHandler(async (req, res) => {
    const { signal } = req.body;
    if (!signal) {
        return res.status(400).json({ message: 'Signal data is required.' });
    }

    try {
        const connection = await getConnection();
        const { symbol, side, size, stop_loss, take_profit, rationale } = signal;
        
        let result;
        const options = {
            comment: rationale || 'SignalFlow Execution'
        };

        if (side === 'buy') {
            result = await connection.createMarketBuyOrder(symbol, size, stop_loss, take_profit, options);
        } else {
            result = await connection.createMarketSellOrder(symbol, size, stop_loss, take_profit, options);
        }

        if (result.stringCode !== 'TRADE_RETCODE_DONE') {
            throw new Error(`Trade execution failed: ${result.stringCode}`);
        }

        res.status(200).json({ success: true, orderId: result.orderId, message: 'Trade executed successfully' });

    } catch (err) {
        console.error('Error executing trade:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Failed to execute trade' });
    }
}));


// POST /api/close/:positionId
router.post('/close/:positionId', asyncHandler(async (req, res) => {
    const { positionId } = req.params;
    if (!positionId) {
        return res.status(400).json({ message: 'Position ID is required.' });
    }

    try {
        const connection = await getConnection();
        await connection.closePosition(positionId);
        res.status(200).json({ success: true, message: 'Position closed successfully' });
    } catch (err) {
        console.error(`Error closing position ${positionId}:`, err.message);
        res.status(500).json({ success: false, message: err.message || 'Failed to close position' });
    }
}));

export default router;