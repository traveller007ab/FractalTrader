import express from 'express';
import { getConnection } from './metaApiConnection.js';

const router = express.Router();

// Middleware for handling async route errors
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};


// --- Helpers for Polygon.io API ---
function mapSymbolToTicker(symbol) {
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

function parseInterval(interval) {
    const supportedIntervals = ['1min', '5min', '15min', '30min', '1h', '1day', '1week', '1month'];
    if (!supportedIntervals.includes(interval)) {
        // Prevent allowing unsupported intervals like '45min', '2h', '4h' which were in the frontend type but not supported here.
        throw new Error(`Polygon.io client does not support interval: ${interval}.`);
    }

    const match = interval.match(/^(\d+)(min|h|day|week|month)$/);
    if (!match) throw new Error(`Invalid interval format: ${interval}`);
    
    return {
        multiplier: parseInt(match[1], 10),
        timespan: match[2].replace('min', 'minute').replace('h', 'hour')
    };
}

const formatDate = (date) => date.toISOString().split('T')[0];


// GET /api/timeseries - Secure proxy for Polygon.io data
router.get('/timeseries', asyncHandler(async (req, res) => {
    const API_KEY = process.env.API_KEY;
    const BASE_URL = 'https://api.polygon.io';

    if (!API_KEY) {
        console.error("Polygon.io API key is not configured on the backend.");
        return res.status(500).json({ message: 'API key not configured on server.' });
    }

    const { symbol, interval, outputsize = '30' } = req.query;

    if (!symbol || !interval) {
        return res.status(400).json({ message: 'Symbol and interval query parameters are required.' });
    }

    try {
        const ticker = mapSymbolToTicker(symbol);
        const { multiplier, timespan } = parseInterval(interval);
        const outputsizeNum = parseInt(outputsize, 10);

        const to = new Date();
        const from = new Date();
        
        let daysToSubtract;
        switch (timespan) {
            case 'minute':
            case 'hour':
                daysToSubtract = Math.ceil((outputsizeNum * multiplier * (timespan === 'minute' ? 1 : 60)) / (60 * 8)) + 5;
                break;
            case 'day':
                daysToSubtract = Math.ceil(outputsizeNum * 1.8);
                break;
            default:
                daysToSubtract = outputsizeNum * (timespan === 'week' ? 7 : 31) * 1.2;
        }
        from.setDate(to.getDate() - Math.max(daysToSubtract, 3));

        const url = new URL(`${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${formatDate(from)}/${formatDate(to)}`);
        url.searchParams.append('apiKey', API_KEY);
        url.searchParams.append('sort', 'asc');
        url.searchParams.append('limit', '5000');

        const polygonResponse = await fetch(url.toString());
        const data = await polygonResponse.json();

        if (!polygonResponse.ok) {
            let errorMessage = `Polygon.io API error (${polygonResponse.status}): ${data.error || data.message || 'Unknown error'}`;
            if (polygonResponse.status === 429) {
                errorMessage = `RATE_LIMIT_EXCEEDED: ${data.error || 'Too many requests'}`;
            }
            throw new Error(errorMessage);
        }

        if (!data.results || data.resultsCount === 0) {
            console.warn(`No time series data returned for ${symbol} from Polygon.io`);
            return res.json([]);
        }

        const finalData = data.results.slice(-outputsizeNum);
        const mappedData = finalData.map((v) => ({
            datetime: new Date(v.t).toISOString(),
            open: v.o,
            high: v.h,
            low: v.l,
            close: v.c,
            volume: v.v,
        }));
        
        res.status(200).json(mappedData);

    } catch (err) {
        console.error('Error fetching from Polygon.io via backend:', err.message);
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
